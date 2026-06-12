// PasteNinja — detect paste rejection and inject.
//
// Listen for paste events. When one fires, snapshot the target input's value,
// then let the event chain run and check if the value changed. If it did, do
// nothing. Otherwise, inject the clipboard text.
//
// Why this method: The check-for-changes approach is preferable to existing
// solutions that preemptively call `stopImmediatePropagation()` on all paste
// events, which can 1) miss paste blockers that don't rely on paste events,
// and/or 2) break sites that use their paste listeners for crucial
// functionality (eg Google Sheets).
//
// Injection uses document.execCommand("insertText", ...) as the preferred path
// because it leverages the browser's native undo support, caret-position
// insertion, and number-sanitizing.
//
// Because execCommand is deprecated but supported, we provide a fallback to
// setter of HTMLInputElement.prototype.value. We do our own caret-position
// management and a rough approximation of native number-sanitizing, but undo
// support is lost.
//
// Runs at document_start in all frames.

(() => {
  "use strict";

  console.log("[PasteNinja] loaded on", location.href);

  document.addEventListener(
    "paste",
    async (e) => {
      const target = e.target;
      if (
        !target ||
        (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")
      ) {
        return;
      }

      if (!e.clipboardData) return;
      const clipboard = e.clipboardData.getData("text");

      const before = target.value;
      const beforeBad = target.validity?.badInput;

      // Wait for an `input` event or a timeout.
      await new Promise((resolve) => {
        const handler = () => {
          target.removeEventListener("input", handler);
          clearTimeout(timer);
          resolve();
        };
        target.addEventListener("input", handler);
        const timer = setTimeout(() => {
          target.removeEventListener("input", handler);
          resolve();
        }, 50);
      });

      const after = target.value;
      const afterBad = target.validity?.badInput;

      // If either thae value or validity of the input changed, take no action
      if (after !== before || afterBad !== beforeBad) return;

      // Otherwise inject
      console.log(
        "[PasteNinja] paste blocked, injecting",
        clipboard.length,
        "chars into",
        target,
      );
      inject(target, clipboard);
    },
    true,
  );

  function inject(el, value) {
    // Ensure focus
    el.focus();

    // Primary path: native text insertion. Undoable via Cmd-Z, caret-aware, and
    // routes type=number through the browser's char-by-char extraction
    if (document.execCommand("insertText", false, value)) {
      pulse(el);
      return;
    }

    // Fallback: use the prototype value setter

    // If it's a number input, try to extract a valid number string
    if (el.tagName === "INPUT" && el.type === "number") {
      value = extractNumber(value);
    }

    // Get the setter function from the appropriate prototype
    const proto =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;

    // Determine the insertion point and generate the post-insertion value
    let next, caret;
    if (typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      next = el.value.slice(0, start) + value + el.value.slice(end);
      caret = start + value.length;
    } else {
      next = value;
    }

    // Update the input value and set the caret position
    setter.call(el, next);
    if (caret !== undefined) {
      try {
        el.setSelectionRange(caret, caret);
      } catch {}
    }

    // Dispatch the appropriate events
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    pulse(el);
  }

  // Extract a valid number from a arbitrary string
  function extractNumber(raw = "") {
    // get current locale's decimal separator
    const dot =
      new Intl.NumberFormat()
        .formatToParts(0.1)
        .find((p) => p.type === "decimal")?.value || ".";

    // drop invalid characters
    let s = raw.replace(new RegExp(`[^+\\-\\d${dot}eE]`, "g"), "");

    let result = "";
    let seen = { digit: false, dot: false, e: false };

    // walk the string char by char
    for (const c of s) {
      const prev = result.slice(-1);
      const is = { digit: /\d/.test(c), dot: c === dot, e: /[eE]/.test(c) };
      // accept digits, one e, one dot before e, +/- at start or right after e
      const accepted =
        is.digit ||
        (is.dot && !seen.dot && !seen.e) ||
        (is.e && seen.digit && !seen.e) ||
        (/[+-]/.test(c) && (!prev || /[eE]/.test(prev)));

      if (accepted) {
        result += c;
        for (const x in seen) seen[x] ||= is[x];
      }
    }

    return Number.isFinite(Number(result)) ? result : "";
  }

  // Give a visual signal that PasteNinja intervened
  function pulse(el) {
    const oldOutline = el.style.outline;
    el.style.outline = "2px solid #4caf50";
    setTimeout(() => {
      el.style.outline = oldOutline;
    }, 400);
  }
})();

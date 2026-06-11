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

  document.addEventListener("paste", async (e) => {
    const target = e.target;
    if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")) {
      return;
    }

    if (!e.clipboardData) return;
    const clipboard = e.clipboardData.getData("text");

    const before = target.value;
    const beforeBad = target.validity?.badInput;

    // Wait for an `input` event (paste inserted something) or a timeout (paste
    // failed). A 50ms timeout proved too short for some native paste
    // operations, eg pasting "(212) 555-1212" into a type=number field, which
    // triggers the browser's char-by-char extraction algorithm. 150ms seems to
    // work, but hasn't been extensively tested. Most input events complete well
    // before that.
    const inputFired = await new Promise((resolve) => {
      const handler = () => {
        target.removeEventListener("input", handler);
        clearTimeout(timer);
        resolve(true);
      };
      target.addEventListener("input", handler);
      const timer = setTimeout(() => {
        target.removeEventListener("input", handler);
        resolve(false);
      }, 150);
    });

    if (inputFired) {
      // Native paste produced an input event. Confirm the result actually
      // persisted — React-style reverters fire input and then snap the value
      // back, in which case we still want to inject.
      const after = target.value;
      const afterBad = target.validity?.badInput;
      if (after !== before || (afterBad && !beforeBad)) return;
    }

    console.log("[PasteNinja] paste blocked, injecting", clipboard.length, "chars into", target);
    inject(target, clipboard);
  }, true);

  function inject(el, value) {
    // Ensure focus — execCommand requires it, and the user may have moved focus
    // while we were waiting for the input event.
    el.focus();

    // Primary path: native text insertion. Undoable via Cmd-Z, caret-aware, and
    // routes type=number through the browser's char-by-char extraction.
    if (document.execCommand("insertText", false, value)) {
      pulse(el);
      return;
    }

    // Fallback: prototype value setter for elements where execCommand fails.
    // Pre-filter type=number so the all-or-nothing value sanitization doesn't
    // clear the field.
    if (el.tagName === "INPUT" && el.type === "number") {
      value = value.replace(/[^\d.eE-]/g, "");
      if (!value || !Number.isFinite(Number(value))) return;
    }

    const proto = el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;

    // Determine the insertion point and generate the post-insertion value
    let next, caret;
    if (typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      next  = el.value.slice(0, start) + value + el.value.slice(end);
      caret = start + value.length;
    } else {
      next = value;
    }

    // Update the input value and set the caret position
    setter.call(el, next);
    if (caret !== undefined) {
      try { el.setSelectionRange(caret, caret); } catch {}
    }

    // Dispatch the appropriate events
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    pulse(el);
  }

  // Give a visual signal that PasteNinja intervened
  function pulse(el) {
    const oldOutline = el.style.outline;
    el.style.outline = "2px solid #4caf50";
    setTimeout(() => { el.style.outline = oldOutline; }, 400);
  }
})();

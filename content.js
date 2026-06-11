// PasteNinja — detect paste blockage and inject.
//
// Single strategy: listen for paste events in capture phase, snapshot the
// input's value, let the natural paste chain run, then check if the value
// updated. If it did, do nothing. If it didn't (paste was blocked or
// silently rejected), inject the clipboard.
//
// Injection uses document.execCommand("insertText", ...) as the primary path
// because it integrates with the browser's undo stack (Cmd-Z works), handles
// caret position naturally, and triggers native sanitization for type=number
// (e.g. "$1,300" → "1300" via Chromium's HandleBeforeTextInsertedEvent).
// Falls back to the HTMLInputElement.prototype.value setter for cases where
// execCommand returns false.
//
// Why this design (vs preemptive stopPropagation): we don't interfere with
// legitimate paste handlers — rich text editors keep their HTML
// sanitization, paste-magic URL detectors still fire, paste sanitizers
// still strip what they want to strip. We only intervene when the field
// genuinely failed to update.
//
// Covers keyboard (Cmd-V/Ctrl-V), menu paste, and right-click paste
// uniformly because all of them fire the paste event.
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

    // Wait for an input event on the target (native paste or a page handler
    // actually inserted something), or for a timeout (paste was blocked at the
    // event level and nothing happened). Event-driven detection handles slow
    // native paths — notably type=number's char-by-char extraction, which can
    // take >50ms for strings with separators — without false-positive injections.
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

    // Primary path: native text insertion. Undoable via Cmd-Z, caret-aware,
    // and routes type=number through the browser's char-by-char extraction.
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

    let next, caret;
    if (typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      next  = el.value.slice(0, start) + value + el.value.slice(end);
      caret = start + value.length;
    } else {
      next = value;
    }

    setter.call(el, next);
    if (caret !== undefined) {
      try { el.setSelectionRange(caret, caret); } catch {}
    }
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    pulse(el);
  }

  function pulse(el) {
    const oldOutline = el.style.outline;
    el.style.outline = "2px solid #4caf50";
    setTimeout(() => { el.style.outline = oldOutline; }, 400);
  }
})();

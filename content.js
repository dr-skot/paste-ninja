// PasteNinja — detect paste blockage and inject.
//
// Single strategy: listen for paste events in capture phase, snapshot the
// input's value, let the natural paste chain run, then check if the value
// updated. If it did, do nothing. If it didn't (paste was blocked or
// silently rejected), inject the clipboard via HTMLInputElement.prototype.value
// setter + synthetic input/change events.
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
    let clipboard = e.clipboardData.getData("text");

    const before = target.value;
    await new Promise((r) => setTimeout(r, 50));
    const after = target.value;

    if (after !== before) return;   // natural paste worked

    // type=number: strip non-numeric chars (handles "$1,300" → "1300", "3024 234" → "3024234").
    // Bail if nothing useful remains. Approximates Chromium's char-by-char extraction without
    // replicating its full state machine.
    if (target.type === "number") {
      clipboard = clipboard.replace(/[^\d.eE-]/g, "");
      if (!clipboard || !Number.isFinite(Number(clipboard))) return;
    }

    console.log("[PasteNinja] paste blocked, injecting", clipboard.length, "chars into", target);
    inject(target, clipboard);
  }, true);

  function inject(el, value) {
    const proto = el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;

    // Splice at caret if the input supports selection APIs, else replace whole field.
    // Must check before the type=number recast below — original type=number has
    // null selectionStart, which correctly routes it to whole-field replacement
    // (the right semantic for date/time/color/range/number).
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

    // Visual ack — 400ms green outline pulse
    const oldOutline = el.style.outline;
    el.style.outline = "2px solid #4caf50";
    setTimeout(() => { el.style.outline = oldOutline; }, 400);
  }
})();

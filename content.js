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
//
// Diagnostics: every path that declines to act says why. Routine decisions are
// quiet unless you opt in with
//
//   localStorage.setItem("pasteninja:debug", "1")   // then reload
//
// but anything that looks like a failure we could have prevented warns
// unconditionally — a blocker we can't defeat, an injection that didn't land, a
// paste the site accepted and then reverted behind our back. Silence on a
// failed paste is a bug in this file, not a diagnosis.
//
// To check whether the script is live in a frame without having to catch a log
// at load time, read the marker it leaves on the DOM (the page world can see
// it, so this works from an ordinary console):
//
//   document.documentElement.dataset.pasteninja

(() => {
  "use strict";

  // Read from the manifest so the marker can never drift out of sync with the
  // version the browser is actually running.
  const VERSION = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      return "unpackaged";
    }
  })();

  const DEBUG = (() => {
    try {
      return localStorage.getItem("pasteninja:debug") === "1";
    } catch {
      return false; // sandboxed frames throw on localStorage access
    }
  })();

  const log = (...args) => {
    if (DEBUG) console.log("[PasteNinja]", ...args);
  };
  const warn = (...args) => console.warn("[PasteNinja]", ...args);

  console.log(`[PasteNinja] loaded v${VERSION} on`, location.href);
  mark();

  // From lib.js, loaded ahead of this file into the same isolated world.
  const { resolveField, extractNumber } = PasteNinjaLib;

  // Sites that block the keyboard shortcut prevent the paste event from ever
  // firing, so the only way to notice is to watch for the shortcut ourselves
  // and see whether a paste follows.
  let shortcutPending = false;
  let shortcutTimer;

  document.addEventListener(
    "keydown",
    (e) => {
      if (!(e.metaKey || e.ctrlKey) || String(e.key).toLowerCase() !== "v") {
        return;
      }
      shortcutPending = true;
      clearTimeout(shortcutTimer);
      shortcutTimer = setTimeout(() => {
        if (!shortcutPending) return;
        shortcutPending = false;
        warn(
          "paste shortcut pressed but no paste event followed — this site" +
            " blocks at the keydown level, which PasteNinja cannot defeat." +
            " Focused:",
          describe(deepActiveElement()),
        );
      }, 400);
    },
    true,
  );

  document.addEventListener(
    "paste",
    async (e) => {
      shortcutPending = false;

      const target = resolveField(e);

      if (!target) {
        // A paste into a contenteditable or a custom element is routine on
        // plenty of sites, so stay quiet — unless a closed shadow root is
        // hiding a field from us, which we cannot reach and should admit to.
        const host = e.target;
        if (host?.tagName?.includes("-") && !host.shadowRoot) {
          warn(
            "ignoring paste on",
            describe(host),
            "— it looks like a custom element with a closed shadow root, so" +
              " the field inside it is unreachable from the composed path.",
          );
        } else {
          log(
            "ignoring paste: no INPUT or TEXTAREA in the composed path (target",
            describe(host) + ")",
          );
        }
        return;
      }

      if (!e.clipboardData) {
        warn(
          "cannot act on paste into",
          describe(target),
          "— the event carried no clipboardData.",
        );
        return;
      }
      const clipboard = e.clipboardData.getData("text");

      const before = target.value;
      const beforeBad = target.validity?.badInput;

      log(
        "paste into",
        describe(target),
        `— ${clipboard.length} chars on the clipboard, field currently`,
        JSON.stringify(before),
      );

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

      // If either the value or validity of the input changed, take no action
      if (after !== before || afterBad !== beforeBad) {
        log(
          "site handled the paste itself (value now",
          JSON.stringify(after),
          `badInput ${beforeBad} → ${afterBad}) — standing down`,
        );
        // ...but a site that accepts the paste and reverts it a moment later
        // has defeated us behind our back. Say so rather than leaving the user
        // staring at an empty field and a silent console.
        watchForRevert(target, before, after, clipboard);
        return;
      }

      // Otherwise inject
      log(
        "paste blocked, injecting",
        clipboard.length,
        "chars into",
        describe(target),
      );
      inject(target, clipboard);
      confirmInjection(target, before, clipboard);
    },
    true,
  );

  function inject(el, value) {
    // Ensure focus
    el.focus();

    // Primary path: native text insertion. Undoable via Cmd-Z, caret-aware, and
    // routes type=number through the browser's char-by-char extraction
    if (document.execCommand("insertText", false, value)) {
      log("injected via execCommand");
      pulse(el);
      return;
    }

    log("execCommand refused; falling back to the value setter");

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

  // execCommand can report success without moving a character, and a site can
  // undo our write on the input event we just caused. Either way the user sees
  // nothing happen, so check instead of assuming.
  function confirmInjection(el, before, clipboard) {
    const check = (label) => {
      if (el.value !== before) return true;
      warn(
        `injection into ${describe(el)} did not land (${label}): field is` +
          ` still ${JSON.stringify(before)} after writing ${clipboard.length}` +
          ` chars. The site is rejecting programmatic input too —` +
          ` readOnly=${el.readOnly} disabled=${el.disabled}` +
          ` maxLength=${el.maxLength} type=${el.type}`,
      );
      return false;
    };
    setTimeout(() => {
      if (!check("immediately")) return;
      const injected = el.value;
      setTimeout(() => {
        if (el.value === injected) return;
        warn(
          `the site reverted our injection into ${describe(el)} within 600ms` +
            ` (now ${JSON.stringify(el.value)}). PasteNinja lost this one.`,
        );
      }, 600);
    }, 0);
  }

  // The 50ms detection window assumes a blocker acts before the field settles.
  // A slower revert reads as a successful paste and we stand down — then the
  // text vanishes. Catch that and name it.
  function watchForRevert(el, before, accepted, clipboard) {
    const look = (ms) =>
      setTimeout(() => {
        if (el.value !== before || el.value === accepted) return;
        warn(
          `the site accepted your paste into ${describe(el)} and then reverted` +
            ` it ${ms}ms later — past the 50ms window PasteNinja waits, so it` +
            ` stood down and never injected. ${clipboard.length} chars lost.` +
            " This is the sub-50ms-revert case; please report it.",
        );
      }, ms);
    look(300);
    look(1200);
  }

  // Give a visual signal that PasteNinja intervened
  function pulse(el) {
    const oldOutline = el.style.outline;
    el.style.outline = "2px solid #4caf50";
    setTimeout(() => {
      el.style.outline = oldOutline;
    }, 400);
  }

  // Leave a queryable "I am running here" marker, one per frame.
  function mark() {
    const set = () => {
      const root = document.documentElement;
      if (!root) return false;
      root.dataset.pasteninja = VERSION;
      root.dataset.pasteninjaDebug = DEBUG ? "1" : "0";
      return true;
    };
    if (!set()) {
      document.addEventListener("DOMContentLoaded", set, { once: true });
    }
  }

  // Short, readable identity for an element in a log line.
  function describe(el) {
    if (!el) return String(el);
    if (el.nodeType !== 1) return String(el.nodeName || el);
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    if (typeof el.className === "string" && el.className.trim()) {
      s += `.${el.className.trim().split(/\s+/).join(".")}`;
    }
    if (el.tagName === "INPUT") s += `[type=${el.type}]`;
    const root = el.getRootNode?.();
    if (root && root !== document && root.host) {
      s += ` (in shadow root of ${describe(root.host)})`;
    }
    return s;
  }

  // activeElement stops at a shadow or frame boundary; follow it down so logs
  // name the field the user is actually typing in.
  function deepActiveElement() {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }
})();

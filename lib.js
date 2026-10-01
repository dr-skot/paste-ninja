// PasteNinja — the parts that are just logic.
//
// Kept free of DOM globals so they can be exercised directly with
// `node --test dev/lib.test.js`. Loaded as the first content script and hung
// off globalThis so content.js can reach it from the same isolated world — an
// explicit assignment rather than a bare top-level `var`, which only lands on
// the global when nothing has wrapped the script. The guarded module.exports
// at the bottom is the one line here that exists for the tests.

globalThis.PasteNinjaLib = (() => {
  "use strict";

  const isField = (el) =>
    !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");

  // A paste that starts inside a shadow root is retargeted on its way out: a
  // listener on document sees the host custom element, not the field. The
  // composed path still holds the real one (for open roots), and its first
  // field is the element the user is actually typing in.
  function resolveField(e) {
    if (isField(e.target)) return e.target;
    for (const node of e.composedPath?.() || []) {
      if (isField(node)) return node;
    }
    return null;
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

  return { isField, resolveField, extractNumber };
})();

if (typeof module !== "undefined") module.exports = globalThis.PasteNinjaLib;

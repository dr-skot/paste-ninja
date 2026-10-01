// Tests for the logic in lib.js. No dependencies — `node --test dev/`.
//
// These stub the DOM rather than drive a browser, so they cover decisions, not
// paste mechanics. Whether execCommand actually inserts, whether the 50ms
// detection window is long enough, and whether retargeting really happens are
// browser questions, and nothing here will catch a regression in them.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isField, resolveField, extractNumber } = require("../lib.js");

const el = (tagName, extra = {}) => ({ tagName, ...extra });
const INPUT = el("INPUT");
const TEXTAREA = el("TEXTAREA");
const DIV = el("DIV");
const HOST = el("MDS-TEXT-INPUT");

test("isField accepts the two editable form fields and nothing else", () => {
  assert.equal(isField(INPUT), true);
  assert.equal(isField(TEXTAREA), true);
  assert.equal(isField(DIV), false);
  assert.equal(isField(HOST), false);
  assert.equal(isField(null), false);
  assert.equal(isField(undefined), false);
});

test("resolveField returns the target when it is already a field", () => {
  assert.equal(resolveField({ target: INPUT }), INPUT);
  assert.equal(resolveField({ target: TEXTAREA }), TEXTAREA);
});

// The regression that prompted all of this: Chase's "Verify account number" is
// an <input> inside the open shadow root of an mds-text-input. The paste event
// is retargeted to the host on its way out, so a listener on document that
// trusts event.target sees a custom element, decides it is not a field, and
// silently does nothing.
test("resolveField sees past shadow-DOM retargeting to the real field", () => {
  const e = {
    target: HOST,
    composedPath: () => [INPUT, DIV, DIV, el("#shadow-root"), HOST, DIV],
  };
  assert.equal(resolveField(e), INPUT);
});

test("resolveField takes the innermost field in the composed path", () => {
  const outer = el("INPUT");
  const e = { target: HOST, composedPath: () => [INPUT, DIV, outer, HOST] };
  assert.equal(resolveField(e), INPUT);
});

test("resolveField gives up when no field is in the path", () => {
  const e = { target: DIV, composedPath: () => [DIV, el("SECTION"), el("BODY")] };
  assert.equal(resolveField(e), null);
});

// A closed shadow root truncates the composed path at the host, so the field
// inside is genuinely unreachable and we must not pretend otherwise.
test("resolveField gives up when a closed root hides the field", () => {
  const e = { target: HOST, composedPath: () => [HOST, DIV, el("BODY")] };
  assert.equal(resolveField(e), null);
});

test("resolveField survives an event with no composedPath", () => {
  assert.equal(resolveField({ target: DIV }), null);
  assert.equal(resolveField({ target: INPUT }), INPUT);
});

test("extractNumber keeps what a number input can hold", () => {
  assert.equal(extractNumber("$1,300"), "1300");
  assert.equal(extractNumber("+5"), "+5");
  assert.equal(extractNumber("abc12"), "12");
  assert.equal(extractNumber("1e5"), "1e5");
  assert.equal(extractNumber("time 2 go"), "2");
  assert.equal(extractNumber("-42"), "-42");
});

test("extractNumber keeps only the first decimal separator", () => {
  assert.equal(extractNumber("1.2.3"), "1.23");
});

test("extractNumber drops a sign that is not leading or post-exponent", () => {
  assert.equal(extractNumber("(212) 555-1212"), "2125551212");
  assert.equal(extractNumber("--5"), "-5");
  assert.equal(extractNumber("1e-5"), "1e-5");
});

test("extractNumber returns empty rather than something unparseable", () => {
  assert.equal(extractNumber("1e"), "");
  assert.equal(extractNumber("abc"), "");
  assert.equal(extractNumber(""), "");
  assert.equal(extractNumber(), "");
});

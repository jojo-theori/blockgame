import test from "node:test";
import assert from "node:assert/strict";
import { attackNotes, SCALES } from "../src/sound.js";

test("a clear's sound grows with its attack", () => {
  // single, double, triple, quad
  assert.deepEqual([1, 2, 3, 4].map((lines) => attackNotes(lines)), [1, 2, 3, 4]);
  // T-spin single (as much as a triple), double (as much as a quad), triple
  assert.deepEqual([1, 2, 3].map((lines) => attackNotes(lines, true)), [3, 4, 5]);
  assert.equal(attackNotes(1, true, true), 1, "a mini sends nothing");
});

test("every combo scale starts on the root and stays inside an octave", () => {
  for (const [name, steps] of Object.entries(SCALES)) {
    assert.equal(steps[0], 0, name);
    assert.ok(steps.every((s, i) => s >= 0 && s < 12 && (i === 0 || s > steps[i - 1])), name);
  }
});

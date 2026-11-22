import test from "node:test";
import assert from "node:assert/strict";
import { qr, checkBytes, formatBits } from "../src/qr.js";

test("QR: check bytes, format bits and the fixed patterns are right", () => {
  // The standard's worked example (version 1-M, "01234567"): 16 data bytes, 10 check bytes.
  const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  assert.deepEqual(checkBytes(data, 10), [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]);
  assert.equal(formatBits(0).toString(2), "111011111000100");
  const m = qr("http://localhost:5173/");
  assert.equal(m.length, 25, "22 bytes fit version 2");
  // Finder corners and centres are dark, their inner ring is light; the timing line alternates.
  for (const [x, y] of [[0, 0], [3, 3], [24, 0], [21, 3], [0, 24], [3, 21]]) assert.equal(m[y][x], true);
  for (const [x, y] of [[1, 1], [23, 1], [1, 23], [7, 7]]) assert.equal(m[y][x], false);
  assert.deepEqual(m[6].slice(8, 17), [true, false, true, false, true, false, true, false, true]);
  assert.equal(m[17][8], true, "the dark module");
  assert.equal(qr("x".repeat(106)).length, 37, "version 5");
  assert.equal(qr("x".repeat(107)).length, 41, "version 6, two blocks");
  assert.equal(qr("x".repeat(425)).length, 69, "version 13");
  assert.equal(qr("x".repeat(858)).length, 97, "version 20");
  assert.equal(qr("x".repeat(859)), null);
  // A tail of digits and capitals takes less room than the same length in bytes.
  assert.ok(qr("https://example.com/#q=" + "A1$".repeat(100)).length < qr("https://example.com/#q=" + "a1_".repeat(100)).length);
});

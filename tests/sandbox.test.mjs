import test from "node:test";
import assert from "node:assert/strict";
import { dtCannonExample } from "../src/modes/sandbox/store.js";
import { tSpins } from "../src/analysis.js";

const best = (matrix) => tSpins(matrix).filter((s) => !s.mini).sort((a, b) => b.cleared - a.cleared)[0];

test("the DT Cannon example offers a T-spin double, then a triple", () => {
  const ex = dtCannonExample();
  assert.deepEqual(ex.order, [2, 2], "two T pieces to come");
  const double = best(ex.board);
  assert.equal(double?.cleared, 2, "the first T spins in for two lines");
  const triple = best(double.matrix);
  assert.equal(triple?.cleared, 3, "the second spins into the hole it leaves, for three");
  // Every filled cell belongs to a piece, so Erase → Piece works on it.
  ex.board.forEach((row, r) => row.forEach((v, c) => assert.equal(!!v, !!ex.marks[r][c])));
});

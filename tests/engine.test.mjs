import test from "node:test";
import assert from "node:assert/strict";
import { BlockEngine, ROWS, COLS } from "../src/game.js";
import { play } from "./helpers.mjs";

test("the same seed deals the same pieces", () => {
  const deal = (seed) => {
    const e = new BlockEngine({ seed });
    e.start();
    return [e.currentId, ...e.queue.slice(0, 20)];
  };
  assert.deepEqual(deal(42), deal(42));
  assert.notDeepEqual(deal(42), deal(43));
});

test("pieces come in bags of seven", () => {
  const e = new BlockEngine({ seed: 7 });
  e.start();
  const dealt = [e.currentId];
  while (dealt.length < 70) {
    e.hardDrop();
    if (!e.playing) break;
    dealt.push(e.currentId);
  }
  for (let i = 0; i + 7 <= dealt.length; i += 7) {
    assert.deepEqual([...dealt.slice(i, i + 7)].sort(), [1, 2, 3, 4, 5, 6, 7], `bag starting at piece ${i + 1}`);
  }
});

test("the board keeps its shape through a whole game, top out included", async () => {
  for (const seed of [1, 2, 3]) {
    const e = await play("random", seed, { pieces: 200 });
    assert.equal(e.matrix.length, ROWS);
    for (const row of e.matrix) assert.equal(row.length, COLS);
  }
});

// Fills `rows` rows at the bottom but for the last column, leaves one stray
// cell above (so it is never a perfect clear), and drops an I down the gap.
function clearRows(e, rows) {
  for (let r = ROWS - rows; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) e.matrix[r][c] = 8;
  e.matrix[ROWS - rows - 1][0] = 8;
  e.currentId = 1; // I
  e.currentRot = 1;
  e.currentX = COLS - 3; // the vertical I sits in the third column of its box
  e.currentY = 0;
  e.updateGhost();
  const before = e.lines;
  e.hardDrop();
  return { cleared: e.lines - before, attack: e.lastAttack };
}
const fresh = () => {
  const e = new BlockEngine({ seed: 11 });
  e.start();
  return e;
};

test("full rows are cleared and counted", () => {
  for (const rows of [1, 2, 3, 4]) {
    const e = fresh();
    assert.equal(clearRows(e, rows).cleared, rows);
    for (const row of e.matrix) assert.ok(row.some((v) => v === 0), "a full row was left on the board");
  }
});

test("attack follows the table: 0, 1, 2 and 4 lines, and one more for a quad back to back", () => {
  assert.deepEqual([1, 2, 3, 4].map((rows) => clearRows(fresh(), rows).attack), [0, 1, 2, 4]);
  const e = fresh();
  assert.equal(clearRows(e, 4).attack, 4);
  assert.equal(clearRows(e, 4).attack, 5, "the second quad in a row is back to back");
  assert.equal(clearRows(e, 1).attack, 1, "a single keeps the combo going (+1) and breaks back to back");
  assert.equal(clearRows(e, 4).attack, 4 + 1, "combo of three; back to back starts over");
});

test("shapes and kicks come out as SRS gives them", async () => {
  const { getShape } = await import("../src/engine/pieces.js");
  const { getKicks } = await import("../src/engine/srs.js");
  const { awkwardStart } = await import("../src/engine/deal.js");
  // T pointing right, I upright in its third column, O the same in every state.
  assert.deepEqual(getShape(2, 1), [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
  assert.deepEqual(getShape(1, 1).map((row) => row.indexOf(1)), [2, 2, 2, 2]);
  assert.deepEqual(getShape(7, 3), getShape(7, 0));
  // The tables as tetris.wiki prints them (x right, y up).
  assert.deepEqual(getKicks(2)[0][1], [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]);
  assert.deepEqual(getKicks(2)[3]["-1"], [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]);
  assert.deepEqual(getKicks(1)[0][1], [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]);
  assert.deepEqual(getKicks(1)[2]["-1"], [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]);
  assert.equal(getKicks(5)[1][2].length, 12, "a half turn has its own list");
  // S, Z or O first is dealt again; no game opens on one.
  assert.equal(awkwardStart([5, 1]), true);
  assert.equal(awkwardStart([6, 1]), true);
  assert.equal(awkwardStart([7, 1]), true);
  assert.equal(awkwardStart([2, 5]), false);
  for (let seed = 1; seed <= 300; seed++) assert.ok(![5, 6, 7].includes(new BlockEngine({ seed }).queue[0]), `seed ${seed}`);
});

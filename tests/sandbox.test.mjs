import test from "node:test";
import assert from "node:assert/strict";
import { dtCannonExample, spinExamples } from "../src/modes/sandbox/store.js";
import { BlockEngine } from "../src/game.js";
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

// Every resting place the piece can reach on this board, as "x,y,rot".
// spin: turning is allowed anywhere; without it, only before the piece comes down.
function restingPlaces(board, id, spin) {
  const e = new BlockEngine({ seed: 1, sprintLines: 999999 });
  e.start();
  e.matrix = board.map((row) => row.slice());
  e.queue.unshift(id);
  e.spawn();
  const top = e.currentY;
  const seen = new Set([[e.currentX, e.currentY, e.currentRot].join()]);
  const todo = [[e.currentX, e.currentY, e.currentRot]];
  const steps = [() => e.move(-1), () => e.move(1), () => !e.collides(e.currentX, e.currentY + 1, e.currentRot) && (e.currentY++, true), () => e.rotate(1), () => e.rotate(-1)];
  while (todo.length) {
    const [x, y, r] = todo.shift();
    steps.forEach((step, i) => {
      if (i > 2 && !spin && y > top) return;
      [e.currentX, e.currentY, e.currentRot] = [x, y, r];
      if (!step()) return;
      const k = [e.currentX, e.currentY, e.currentRot].join();
      if (!seen.has(k)) seen.add(k) && todo.push([e.currentX, e.currentY, e.currentRot]);
    });
  }
  // The cells the piece would fill, and the lines that would clear.
  return [...seen]
    .map((k) => k.split(",").map(Number))
    .filter(([x, y, r]) => e.collides(x, y + 1, r))
    .map(([x, y, r]) => {
      const m = board.map((row) => row.slice());
      m.forEach((row, rr) =>
        row.forEach((v, c) => {
          if (v) return;
          e.matrix[rr][c] = 8;
          if (e.collides(x, y, r)) m[rr][c] = 1;
          e.matrix[rr][c] = 0;
        }),
      );
      return { cells: m.flat().join(""), lines: m.filter((row) => row.every(Boolean)).length };
    });
}

test("each spin example clears its lines only with a spin", () => {
  for (const ex of spinExamples()) {
    const lines = +{ Single: 1, Double: 2, Triple: 3 }[ex.title.split(" ")[1]];
    const plain = new Set(restingPlaces(ex.board, ex.order[0], false).map((p) => p.cells));
    const spun = restingPlaces(ex.board, ex.order[0], true).filter((p) => !plain.has(p.cells));
    assert.equal(Math.max(0, ...spun.map((p) => p.lines)), lines, ex.title);
    const plainBest = Math.max(0, ...[...plain].map((cells) => cells.match(/.{10}/g).filter((row) => !row.includes("0")).length));
    assert.ok(plainBest < lines, ex.title + ": a spin clears more than any plain drop");
  }
});

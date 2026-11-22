import test from "node:test";
import assert from "node:assert/strict";
import { BlockEngine, buildLogText } from "../src/game.js";
import { findBestPlacement } from "../src/cpu.js";
import { parseLog, buildFrames, logMode } from "../src/replay.js";
import { sampleLog } from "../src/sample.js";
import { rng } from "./helpers.mjs";

const cells = (matrix) => matrix.map((row) => row.map((v) => (v ? 1 : 0)).join("")).join("\n");

// Plays a game with holds and incoming garbage, keeping the board, hold and
// line count as they were after every piece.
function recorded(seed, pieces = 60) {
  const e = new BlockEngine({ seed, sprintLines: 999999 });
  e.start();
  const rand = rng(seed);
  const after = [];
  for (let n = 0; e.playing && n < pieces; n++) {
    if (n % 7 === 3) e.holdPiece();
    if (n % 11 === 5) e.receiveGarbage(1 + Math.floor(rand() * 3));
    const best = findBestPlacement(e.matrix, e.currentId);
    if (!best) break;
    let { x, rot } = best;
    if (rand() < 0.2) x = Math.floor(rand() * 8);
    for (let i = 0; i < rot; i++) e.rotate(1);
    for (let i = 0; i < 14; i++) {
      const dx = x - e.currentX;
      if (!dx || !e.move(dx < 0 ? -1 : 1)) break;
    }
    e.hardDrop();
    e.clock += 0.4;
    after.push({ board: cells(e.matrix), hold: e.hold || null, lines: e.lines });
  }
  return { engine: e, after };
}

test("a log replays to the same board, hold and lines after every piece", () => {
  let steps = 0;
  let garbage = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const { engine, after } = recorded(seed);
    const events = parseLog(buildLogText(engine, "BATTLE P1 vs CPU"));
    const { frames } = buildFrames(events);
    garbage += events.filter((ev) => ev.kind === "garbage").length;
    let k = 0;
    for (let i = 0; i < events.length; i++) {
      if (events[i].kind !== "place") continue;
      // The garbage that rose on this lock is logged right after it.
      let end = i + 1;
      while (end < events.length && events[end].kind === "garbage") end++;
      const frame = frames[end];
      // A top out is logged, but the engine stops before the board settles.
      if (k === after.length - 1 && engine.gameOver) break;
      assert.equal(cells(frame.matrix), after[k].board, `seed ${seed}, piece ${k + 1}: board`);
      assert.equal(frame.hold || null, after[k].hold, `seed ${seed}, piece ${k + 1}: hold`);
      assert.equal(frame.lines, after[k].lines, `seed ${seed}, piece ${k + 1}: lines`);
      k++;
      steps++;
    }
  }
  assert.ok(steps > 1000, `only ${steps} steps were compared`);
  assert.ok(garbage > 50, `only ${garbage} garbage events were replayed`);
});

test("the log's first line says what was played", () => {
  assert.deepEqual(logMode("SPRINT 40L | 101 blocks"), { mode: "sprint", lines: 40 });
  const battle = logMode("BATTLE P1 vs Cold Clear (Hard) -1 | 80 blocks");
  assert.equal(battle.mode, "battle");
  assert.equal(battle.me, "P1");
  assert.equal(battle.vs, "Cold Clear");
  assert.equal(battle.level, "Hard");
  assert.deepEqual(battle.handicap, [0, -1]);
  assert.equal(logMode("something else").mode, "unknown");
});

test("the sample is the same 40-line run every time", () => {
  const a = sampleLog();
  assert.equal(a, sampleLog());
  const events = parseLog(a);
  const { frames } = buildFrames(events);
  assert.equal(logMode(a, events).lines, 40);
  assert.ok(frames[frames.length - 1].lines >= 40);
});

test("a piece's path survives the trip through text and ends where it locked", async () => {
  const { BlockEngine, buildLogText } = await import("../src/game.js");
  const { createTrace, parseMoves, pathAt } = await import("../src/trace.js");
  const { parseLog } = await import("../src/replay.js");
  const { findBestPlacement } = await import("../src/cpu.js");
  const e = new BlockEngine({ seed: 7, sprintLines: 999999 });
  e.start();
  const trace = createTrace();
  const act = (f) => {
    f();
    e.clock += 0.05;
    trace.sample(e);
  };
  trace.sample(e);
  for (let n = 0; e.playing && n < 30; n++) {
    const best = findBestPlacement(e.matrix, e.currentId);
    for (let i = 0; i < best.rot; i++) act(() => e.rotate(1));
    for (let i = 0; i < 12 && e.currentX !== best.x; i++) act(() => e.move(best.x < e.currentX ? -1 : 1));
    act(() => e.hardDrop());
  }
  const text = buildLogText(e, "SPRINT 40L") + "\n\n" + trace.text();
  const events = parseLog(text);
  const paths = parseMoves(text);
  assert.equal(events.length, 30, "the moves do not read as pieces");
  assert.deepEqual(paths, trace.paths.slice(0, paths.length));
  events.forEach((ev, n) => {
    const end = pathAt(paths, n, ev.t);
    assert.deepEqual([end.x, end.rot], [ev.placed[0], ev.rot], `piece ${n + 1}`);
  });
  assert.equal(parseMoves(buildLogText(e, "SPRINT 40L")), null, "a log without moves");
});

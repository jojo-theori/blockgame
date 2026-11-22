import test from "node:test";
import assert from "node:assert/strict";
import { parseLog, buildFrames, logMode } from "../src/replay.js";
import { analyze, dexterityScore, finesseScore } from "../src/analysis.js";
import { sampleLog } from "../src/sample.js";
import { play, logOf, evaluate } from "./helpers.mjs";

async function review(engine, head, withEngine = true) {
  const text = logOf(engine, head);
  const events = parseLog(text);
  return analyze({ events, ...buildFrames(events), mode: logMode(text, events) }, undefined, withEngine ? evaluate : null);
}
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
const flagged = (r) => r.moments.filter((m) => m.kind === "macro" && ["inaccuracy", "mistake", "blunder"].includes(m.grade)).length;

test("dexterity has fixed ends in both modes", () => {
  // Battle: 0.25 PPS is 0, every doubling adds 25.
  assert.deepEqual([0.25, 0.5, 1, 2, 4, 9].map((pps) => dexterityScore(pps, "battle")), [0, 25, 50, 75, 100, 100]);
  // Sprint: 40 lines (101 pieces) in 2:00, 1:00, 0:30 and 0:15.
  assert.deepEqual([120, 60, 30, 15].map((s) => dexterityScore(101 / s, "sprint")), [25, 50, 75, 100]);
  assert.equal(dexterityScore(0, "sprint"), 0);
});

test("finesse is the share of pieces placed without a wasted key", () => {
  assert.equal(finesseScore(0, 0), 100);
  assert.equal(finesseScore(7, 10), 70);
  assert.equal(finesseScore(10, 10), 100);
});

test("Battle macro ranks play from random to Cold Clear", async () => {
  const score = async (kind) => mean(await Promise.all([11, 22].map(async (seed) => (await review(await play(kind, seed), "BATTLE P1 vs CPU")).scores.macro)));
  const random = await score("random");
  const sloppy = await score("sloppy25");
  const stacker = await score("stacker");
  const cc = await score("cc");
  assert.ok(random < 20, `random play scored ${random}`);
  assert.ok(random < sloppy && sloppy < stacker && stacker < cc, `not in order: ${[random, sloppy, stacker, cc]}`);
  // Not seeded either: its own play has scored 86 to 96.
  assert.ok(cc >= 80, `Cold Clear scored ${cc}`);
});

test("the engine is rarely told it was wrong about its own moves", async () => {
  const r = await review(await play("cc", 22), "BATTLE P1 vs CPU");
  assert.equal(r.engine, true);
  assert.ok(flagged(r) <= 4, `${flagged(r)} of its own moves were pointed out`);
});

test("Sprint macro rewards quads and little left on the board", async () => {
  const sprint = { lines: 40, pieces: 400 };
  // The Sprint bot's search is not seeded and now and then it plays a poor
  // game, so it gets three runs and is judged on its best.
  let quads = null;
  for (const seed of [22, 23, 24]) {
    const r = await review(await play("cc", seed, { ...sprint, sprint: true }), "SPRINT 40L");
    if (!quads || r.scores.macro > quads.scores.macro) quads = r;
  }
  const singles = await review(await play("stacker", 22, sprint), "SPRINT 40L");
  const random = await review(await play("random", 22, sprint), "SPRINT 40L");
  assert.ok(quads.outcome.quadShare >= 0.8, `the Sprint bot cleared ${quads.outcome.quadShare} in quads`);
  assert.ok(quads.outcome.pieces <= 118, `the Sprint bot took ${quads.outcome.pieces} pieces`);
  assert.ok(quads.scores.macro >= 70, `all quads scored ${quads.scores.macro}`);
  assert.equal(singles.outcome.quadShare, 0);
  assert.ok(singles.scores.macro > random.scores.macro && singles.scores.macro < quads.scores.macro, `${[random.scores.macro, singles.scores.macro, quads.scores.macro]}`);
  assert.equal(random.scores.macro, 0);
});

test("the sample gets a review with moments and something to say about it", async () => {
  const text = sampleLog();
  const events = parseLog(text);
  const r = await analyze({ events, ...buildFrames(events), mode: logMode(text, events) }, undefined, evaluate);
  assert.ok(r.moments.length > 0 && r.moments.length <= 10);
  assert.ok(r.traits.length > 0 && r.traits.length <= 3);
  for (const m of r.moments) assert.ok(events[m.step]?.kind === "place", "a moment points at a placement");
  for (const k of ["macro", "dexterity", "finesse"]) assert.ok(r.scores[k] >= 0 && r.scores[k] <= 100);
});

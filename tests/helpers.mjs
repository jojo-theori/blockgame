// Shared by the tests: players that drive the real engine, and the bridge to
// the WebAssembly bot (which looks for a CommonJS `module` when run in Node).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { BlockEngine, buildLogText } from "../src/game.js";
import { findBestPlacement } from "../src/cpu.js";
import { botMove } from "../src/bots/engines.js";
import { readEngine, applyMove } from "../src/bots/play.js";
import { parseEval } from "../src/bots/review.js";

globalThis.module ??= { require: createRequire(import.meta.url) };
const wasm = readFileSync(new URL("../src/bots/cc/jbl_cc_bg.wasm", import.meta.url));

export const evaluate = async (state, nodes) => parseEval(await botMove("cc-eval", state, { nodes }, wasm));

// A small seeded generator, so every run of the tests plays the same games.
export function rng(seed) {
  let s = seed * 7919 + 13;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

// Plays one game and returns the engine.
//   kind  "random" (every piece anywhere), "sloppyN" (N% of pieces anywhere),
//         "stacker" (the built-in CPU, no mistakes), "cc" (Cold Clear)
//   opts  lines: sprint goal (0 for none); pieces: stop after this many;
//         hold: hold now and then; sprint: Cold Clear plays for lines
export async function play(kind, seed, { lines = 0, pieces = 80, hold = false, sprint = false } = {}) {
  const e = new BlockEngine({ seed, sprintLines: lines || 999999 });
  e.start();
  const rand = rng(seed);
  const wrong = kind === "random" ? 1 : kind.startsWith("sloppy") ? +kind.slice(6) / 100 : 0;
  for (let n = 0; e.playing && n < pieces; n++) {
    if (kind === "cc") {
      const state = readEngine(e);
      state.sprint = sprint;
      const moves = await botMove("cc", state, { nodes: 1500 }, wasm);
      if (!moves) break;
      for (const ch of moves) applyMove(e, ch);
    } else {
      if (hold && n % 9 === 4) e.holdPiece();
      const best = findBestPlacement(e.matrix, e.currentId);
      if (!best) break;
      let { x, rot } = best;
      if (rand() < wrong) {
        x = Math.floor(rand() * 9) - 1;
        rot = Math.floor(rand() * 4);
      }
      for (let i = 0; i < rot; i++) e.rotate(1);
      for (let i = 0; i < 14; i++) {
        const dx = x - e.currentX;
        if (!dx || !e.move(dx < 0 ? -1 : 1)) break;
      }
      e.hardDrop();
    }
    e.clock += 0.5;
  }
  return e;
}

export const logOf = (engine, head) => buildLogText(engine, head);

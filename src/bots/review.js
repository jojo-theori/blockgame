// ─── Cold Clear as a reviewer ───
// Asks the engine about one position: every move it weighed with the value it
// gave each, the move it would play, and the line it expects after it. Used by
// the replay analysis; the thinking happens in the same worker the Battle CPU uses.
import { ROWS } from "../game.js";

const LETTER_ID = { I: 1, T: 2, L: 3, J: 4, S: 5, Z: 6, O: 7 };
// "x,y;x,y;…" with rows counted from the floor → [[row, col]…] from the top.
const cellsOf = (text) => text.split(";").map((p) => p.split(",").map(Number)).map(([x, y]) => [ROWS - 1 - y, x]);
// Two placements are the same when they fill the same cells.
export const cellKey = (cells) => cells.map(([r, c]) => r * 10 + c).sort((a, b) => a - b).join(",");

// The text cc_eval returns → { best, plan, moves }, or null when the engine
// had nothing (a dead position).
export function parseEval(out) {
  if (!out) return null;
  const res = { best: null, plan: [], moves: [] };
  for (const line of out.split("\n")) {
    if (line.startsWith("best ")) {
      const [hold, piece, cells] = line.slice(5).split("|");
      res.best = { hold: hold === "h", id: LETTER_ID[piece], cells: cellsOf(cells) };
    } else if (line.startsWith("plan ")) {
      const [piece, cells, lines] = line.slice(5).split("|");
      res.plan.push({ id: LETTER_ID[piece], cells: cellsOf(cells), cleared: +lines });
    } else if (line) {
      const [hold, piece, cells, value, spike, lines, attack, tspin] = line.split("|");
      res.moves.push({ hold: hold === "h", id: LETTER_ID[piece], cells: cellsOf(cells), value: +value, spike: +spike, cleared: +lines, attack: +attack, tspin: tspin !== "None" });
    }
  }
  for (const m of res.moves) m.key = cellKey(m.cells);
  if (res.best) res.best = res.moves.find((m) => m.key === cellKey(res.best.cells) && m.hold === res.best.hold) || null;
  return res.best ? res : null;
}

let worker = null;
let nextId = 1;
const pending = new Map();
// state: what play.js's readEngine gives (rows top to bottom, cur, queue, hold…).
export function evalPosition(state, nodes) {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const done = pending.get(e.data.id);
      pending.delete(e.data.id);
      done?.(e.data);
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (data) => (data.error ? reject(new Error(data.error)) : resolve(parseEval(data.moves))));
    worker.postMessage({ id, bot: "cc-eval", state, opts: { nodes } });
  });
}

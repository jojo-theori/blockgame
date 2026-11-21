// Loads the WebAssembly bots and asks them for one move. Used by the worker
// (and by node tests). Each bot is loaded only when first used.
import createMisa from "./misa.js";

let misa = null;
let misaKey = "";
async function misaMove(s, { level, style = 2 }) {
  if (!misa) {
    const m = await createMisa();
    misa = {
      init: m.cwrap("misa_init", null, ["number", "number"]),
      move: m.cwrap("misa_move", "string", ["string", "number", "number", "string", "number", "number", "number"]),
    };
  }
  const key = `${level}/${style}`;
  if (key !== misaKey) {
    misa.init(level, style);
    misaKey = key;
  }
  // Rows top to bottom; the wrapper turns MisaMino's mirrored moves back.
  const field = s.rows.join("").replace(/1/g, "2");
  const out = misa.move(field, s.cur.charCodeAt(0), (s.hold || " ").charCodeAt(0), s.queue, s.combo, s.b2b ? 1 : 0, s.incoming);
  if (!out) return "";
  // MisaMino spawns 3-wide pieces one column further right than JBL, so line
  // the piece up with it first (after the hold, if it holds).
  const holds = out[0] === "v";
  const piece = holds ? s.hold || s.queue[0] : s.cur;
  const align = piece && "TLJSZ".includes(piece) ? "r" : "";
  return holds ? "v" + align + out.slice(1) : align + out;
}

let cc = null;
async function loadCc(wasmInput) {
  if (!cc) {
    const mod = await import("./cc/jbl_cc.js");
    await mod.default(wasmInput ? { module_or_path: wasmInput } : undefined);
    cc = mod;
  }
}
// Cold Clear wants 40 rows from the bottom up.
const ccField = (s) => s.rows.slice().reverse().join("") + "0".repeat(200);
// For analysis: every move it weighed at this position (see review.js).
async function ccEval(s, { nodes }, wasmInput) {
  await loadCc(wasmInput);
  return cc.cc_eval(ccField(s), s.cur + s.queue, s.hold || " ", s.b2b, s.combo, s.incoming, nodes, s.canHold);
}
async function ccMove(s, { nodes }, wasmInput) {
  await loadCc(wasmInput);
  const field = ccField(s);
  const out = cc.cc_move(field, s.cur + s.queue, s.hold || " ", s.b2b, s.combo, s.incoming, nodes, s.canHold);
  if (!out) return "";
  const [moves] = out.split("|");
  return moves + "V";
}

export async function botMove(bot, state, opts, wasmInput) {
  if (bot === "misa") return misaMove(state, opts);
  if (bot === "cc") return ccMove(state, opts, wasmInput);
  if (bot === "cc-eval") return ccEval(state, opts, wasmInput);
  return "";
}

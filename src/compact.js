// ─── A run small enough for a QR code ───
// The fewest bits that still replay a Sprint: for each piece its type, where
// it was put down and when, whether a key was wasted on it and whether it was
// a spin. Everything else a replay shows (lines, combos, the board) follows
// from those. A 40-line run comes to about 270 bytes, which a phone can read
// off the rank card. How the pieces moved on the way down is not kept: that
// takes the longer link (pack.js).
//
// Layout (bits): version 4, goal lines 10, events 10, final time in ms 22,
// then per event: 3 bits (0 a hold, 1–7 the piece), and
//   hold   the piece held, 3; time
//   piece  x + 2, 4; y + 2, 5; rot, 2; wasted a key, 1; spin, 1 (+ mini, 1); time
// time is the 50 ms steps since the event before: 5 bits, or 31 then 11 more.
import { COLS, ROWS, getShape } from "./game.js";
import { parseLog, logMode } from "./replay.js";

const VERSION = 1;
const STEP = 50;
const LETTERS = " ITLJSZO";
const LINES = ["", "Single", "Double", "Triple", "Quad"];
export const RUN_HASH = "#q=";

function writer() {
  const bytes = [];
  let filled = 0;
  return {
    put(value, n) {
      for (let i = n - 1; i >= 0; i--) {
        if (filled % 8 === 0) bytes.push(0);
        bytes[bytes.length - 1] |= ((value >>> i) & 1) << (7 - (filled % 8));
        filled++;
      }
    },
    bytes,
  };
}
function reader(bytes) {
  let at = 0;
  return (n) => {
    let v = 0;
    for (let i = 0; i < n; i++, at++) v = (v << 1) | ((bytes[at >> 3] >> (7 - (at & 7))) & 1);
    return v;
  };
}
const toUrl = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromUrl = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

// Log text → the packed run, or null when it is not a Sprint this can hold.
export function packRun(text) {
  const events = parseLog(text);
  const mode = logMode(text, events);
  if (mode.mode !== "sprint" || !events.length || events.length > 1023 || events.some((e) => e.kind === "garbage")) return null;
  const w = writer();
  w.put(VERSION, 4);
  w.put(Math.min(1023, mode.lines || 0), 10);
  w.put(events.length, 10);
  w.put(Math.min(2 ** 22 - 1, Math.round(events.at(-1).t * 1000)), 22);
  let prev = 0;
  for (const ev of events) {
    const now = Math.round((ev.t * 1000) / STEP);
    const dt = Math.max(0, now - prev);
    prev = now;
    const time = () => (dt < 31 ? w.put(dt, 5) : (w.put(31, 5), w.put(Math.min(2047, dt), 11)));
    if (ev.kind === "hold") {
      w.put(0, 3);
      w.put(LETTERS.indexOf(ev.type), 3);
      time();
      continue;
    }
    const [x, y] = ev.placed;
    if (x < -2 || x > 13 || y < -2 || y > 29) return null;
    w.put(LETTERS.indexOf(ev.type), 3);
    w.put(x + 2, 4);
    w.put(y + 2, 5);
    w.put(ev.rot, 2);
    w.put(ev.finesseFault > 0 ? 1 : 0, 1);
    const spin = ev.action.includes("T-Spin");
    w.put(spin ? 1 : 0, 1);
    if (spin) w.put(ev.action.includes("Mini") ? 1 : 0, 1);
    time();
  }
  return toUrl(w.bytes);
}

// The packed run → a log the replay reads like any other, or null.
export function unpackRun(packed) {
  try {
    const get = reader(fromUrl(packed));
    if (get(4) !== VERSION) return null;
    const goal = get(10);
    const count = get(10);
    const end = get(22);
    const lines = [];
    let matrix = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    let step = 0;
    let combo = 0;
    for (let n = 0; n < count; n++) {
      const code = get(3);
      const num = `#${String(n + 1).padStart(2, "0")}`;
      const time = () => {
        const dt = get(5);
        step += dt < 31 ? dt : get(11);
        // The last event carries the exact time the run ended at.
        return `[${((n === count - 1 ? end : step * STEP) / 1000).toFixed(3)}s]`;
      };
      if (code === 0) {
        const type = LETTERS[get(3)];
        lines.push(`${num} ${time()} ${type} hold`);
        continue;
      }
      const x = get(4) - 2;
      const y = get(5) - 2;
      const rot = get(2);
      const fault = get(1);
      const spin = get(1);
      const mini = spin ? get(1) : 0;
      const stamp = time();
      // Put the piece down to see what it cleared.
      const shape = getShape(code, rot);
      matrix = matrix.map((row) => row.slice());
      shape.forEach((row, r) => row.forEach((on, c) => on && matrix[y + r]?.[x + c] !== undefined && (matrix[y + r][x + c] = code)));
      const kept = matrix.filter((row) => row.some((v) => !v));
      const cleared = ROWS - kept.length;
      while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));
      matrix = kept;
      combo = cleared ? combo + 1 : 0;
      const name = cleared ? (spin ? `T-Spin ${mini ? "Mini " : ""}${LINES[cleared]}` : LINES[cleared]) : "";
      const words = [name + (combo > 1 ? ` Combo ${combo - 1}` : ""), cleared && matrix.every((row) => row.every((v) => !v)) ? "PC" : ""].filter(Boolean).join(" ");
      // Key counts are not kept: only whether one was wasted.
      lines.push(`${num} ${stamp} ${LETTERS[code]} spawn(3,-1) → placed(${x},${y}) rot=${rot} | keys=${1 + fault} | optimal=1${words ? ` | ${words}` : ""}`);
    }
    return [`SPRINT ${goal}L`, "", ...lines].join("\n");
  } catch {
    return null;
  }
}

// A link that opens this run, short enough for a QR code; null when the run
// cannot be packed this way.
export function runLink(text) {
  const packed = packRun(text);
  return packed ? `${location.origin}${location.pathname}${RUN_HASH}${packed}` : null;
}

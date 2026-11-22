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
//   piece  x + 2, 4; rot, 2; fell straight, 1 (else y + 2, 5); wasted a key, 1;
//          spin, 1 (+ mini, 1); time
// Where a piece simply fell to rest, its height is not written: dropping it
// in that column gives it back. time is the 100 ms steps since the event
// before: 3 bits up to 0.6 s, or 7 then 4 more, or 7, 15 and 10 more.
//
// As text it is written in 43 characters a QR code packs tightly (digits,
// capitals and a few signs: 16 bits to every three characters), which makes
// the code about a quarter smaller than the usual base 64 would.
import { COLS, ROWS, getShape } from "./game.js";
import { parseLog, logMode } from "./replay.js";

const VERSION = 2;
const STEP = 100;
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
// Bytes ↔ text in the 43 characters: two bytes to three characters, a last
// odd byte to two. An "E" is always added at the end, so the text never ends
// in a sign that a chat app would leave out of a link.
const SIGNS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:";
function toText(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    const pair = i + 1 < bytes.length;
    let v = pair ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
    const chars = [];
    for (let n = pair ? 3 : 2; n > 0; n--) {
      chars.unshift(SIGNS[v % 43]);
      v = Math.floor(v / 43);
    }
    out += chars.join("");
  }
  return out + "E";
}
function fromText(text) {
  const body = text.slice(0, -1);
  const bytes = [];
  for (let i = 0; i < body.length; i += 3) {
    const part = body.slice(i, i + 3);
    let v = 0;
    for (const ch of part) {
      const d = SIGNS.indexOf(ch);
      if (d < 0) throw new Error("not a run");
      v = v * 43 + d;
    }
    if (part.length === 3) bytes.push(v >> 8, v & 255);
    else bytes.push(v & 255);
  }
  return Uint8Array.from(bytes);
}

// The row a piece comes to rest on when it falls straight down this column.
function restY(matrix, id, x, rot) {
  const shape = getShape(id, rot);
  const fits = (y) => shape.every((row, r) => row.every((on, c) => !on || (x + c >= 0 && x + c < COLS && y + r < ROWS && (y + r < 0 || !matrix[y + r][x + c]))));
  let y = -3;
  if (!fits(y)) return null;
  while (fits(y + 1)) y++;
  return y;
}
// The board after a piece is put down, and how many lines that cleared.
function settle(matrix, id, x, y, rot) {
  const next = matrix.map((row) => row.slice());
  getShape(id, rot).forEach((row, r) => row.forEach((on, c) => on && next[y + r]?.[x + c] !== undefined && (next[y + r][x + c] = id)));
  const kept = next.filter((row) => row.some((v) => !v));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));
  return [kept, cleared];
}
const emptyBoard = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

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
  let matrix = emptyBoard();
  for (const ev of events) {
    const now = Math.round((ev.t * 1000) / STEP);
    const dt = Math.max(0, now - prev);
    prev = now;
    const time = () => {
      if (dt < 7) return w.put(dt, 3);
      w.put(7, 3);
      if (dt < 22) return w.put(dt - 7, 4);
      w.put(15, 4);
      w.put(Math.min(1023, dt), 10);
    };
    if (ev.kind === "hold") {
      w.put(0, 3);
      w.put(LETTERS.indexOf(ev.type), 3);
      time();
      continue;
    }
    const [x, y] = ev.placed;
    if (x < -2 || x > 13 || y < -2 || y > 29) return null;
    const id = LETTERS.indexOf(ev.type);
    w.put(id, 3);
    w.put(x + 2, 4);
    w.put(ev.rot, 2);
    const straight = restY(matrix, id, x, ev.rot) === y;
    w.put(straight ? 1 : 0, 1);
    if (!straight) w.put(y + 2, 5);
    [matrix] = settle(matrix, id, x, y, ev.rot);
    w.put(ev.finesseFault > 0 ? 1 : 0, 1);
    const spin = ev.action.includes("T-Spin");
    w.put(spin ? 1 : 0, 1);
    if (spin) w.put(ev.action.includes("Mini") ? 1 : 0, 1);
    time();
  }
  return toText(w.bytes);
}

// The packed run → a log the replay reads like any other, or null.
export function unpackRun(packed) {
  try {
    const get = reader(fromText(packed));
    if (get(4) !== VERSION) return null;
    const goal = get(10);
    const count = get(10);
    const end = get(22);
    const lines = [];
    let matrix = emptyBoard();
    let step = 0;
    let combo = 0;
    for (let n = 0; n < count; n++) {
      const code = get(3);
      const num = `#${String(n + 1).padStart(2, "0")}`;
      const time = () => {
        let dt = get(3);
        if (dt === 7) {
          dt = get(4);
          dt = dt < 15 ? dt + 7 : get(10);
        }
        step += dt;
        // The last event carries the exact time the run ended at.
        return `[${((n === count - 1 ? end : step * STEP) / 1000).toFixed(3)}s]`;
      };
      if (code === 0) {
        const type = LETTERS[get(3)];
        lines.push(`${num} ${time()} ${type} hold`);
        continue;
      }
      const x = get(4) - 2;
      const rot = get(2);
      const y = get(1) ? restY(matrix, code, x, rot) : get(5) - 2;
      if (y === null) return null;
      const fault = get(1);
      const spin = get(1);
      const mini = spin ? get(1) : 0;
      const stamp = time();
      // Put the piece down to see what it cleared.
      let cleared;
      [matrix, cleared] = settle(matrix, code, x, y, rot);
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

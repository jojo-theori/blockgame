// ─── A run small enough for a QR code ───
// The fewest bits that still replay a Sprint: which pieces came, where each
// was put down, whether a key was wasted on it and whether it was a spin,
// and the time the run took. Everything else a replay shows (lines, combos,
// the board) follows from those. A 40-line run comes to about 140 bytes,
// which a phone reads easily off the rank card. What is not kept: how the
// pieces moved on the way down and when each one landed (the replay spaces
// them evenly); the longer link (pack.js) has those.
//
// Layout (bits): version 4, goal lines 10, events 10, final time in ms 22,
// bags 1, then the events in order. Before an event that takes a new piece
// from the queue, that piece: its place among those left in the bag of seven
// (3, 3, 3, 2, 2, 1, 0 bits), or 3 bits each if the pieces did not come in
// bags. Then the event:
//   hold   15 in 4 bits
//   piece  x + 2, 4; rot, 2 (not for O); fell straight, 1 (else y + 2, 5);
//          wasted a key, 1; for a T, spin, 1 (+ mini, 1)
// Where a piece simply fell to rest, its height is not written: dropping it
// in that column gives it back.
//
// As text it is written in 43 characters a QR code packs tightly (digits,
// capitals and a few signs: 16 bits to every three characters), which makes
// the code about a quarter smaller than the usual base 64 would.
import { COLS, ROWS, getShape } from "./game.js";
import { parseLog, logMode } from "./replay.js";

const VERSION = 3;
const HOLD = 15;
const O = 7;
const T = 2;
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

// The pieces in the order they came from the queue. A piece shows up as the
// type of the first event after one is taken; swapping with the hold takes
// none.
function dealtOf(events) {
  const dealt = [];
  let hold = null;
  let take = true;
  for (const ev of events) {
    if (take) dealt.push(LETTERS.indexOf(ev.type));
    if (ev.kind === "hold") {
      take = hold === null;
      hold = ev.type;
    } else {
      take = true;
    }
  }
  return dealt;
}
const BAG = [1, 2, 3, 4, 5, 6, 7];
const bitsFor = (n) => Math.ceil(Math.log2(n));

// Log text → the packed run, or null when it is not a Sprint this can hold.
export function packRun(text) {
  const events = parseLog(text);
  const mode = logMode(text, events);
  if (mode.mode !== "sprint" || !events.length || events.length > 1023 || events.some((e) => e.kind === "garbage")) return null;
  const dealt = dealtOf(events);
  // In bags of seven, each with one of every piece (the last may be cut short)?
  const bags = dealt.every((id, i) => !dealt.slice(i - (i % 7), i).includes(id));
  const w = writer();
  w.put(VERSION, 4);
  w.put(Math.min(1023, mode.lines || 0), 10);
  w.put(events.length, 10);
  w.put(Math.min(2 ** 22 - 1, Math.round(events.at(-1).t * 1000)), 22);
  w.put(bags ? 1 : 0, 1);
  let matrix = emptyBoard();
  let left = [];
  let next = 0;
  let current = 0;
  let hold = 0;
  let take = true;
  for (const ev of events) {
    if (take) {
      current = dealt[next++];
      if (bags) {
        if (!left.length) left = [...BAG];
        w.put(left.indexOf(current), bitsFor(left.length));
        left.splice(left.indexOf(current), 1);
      } else {
        w.put(current, 3);
      }
    }
    // The piece in hand must be the one the log says: otherwise this is not
    // a run that can be told this way.
    if (LETTERS[current] !== ev.type) return null;
    if (ev.kind === "hold") {
      w.put(HOLD, 4);
      take = !hold;
      [hold, current] = [current, hold];
      continue;
    }
    const [x, y] = ev.placed;
    if (x < -2 || x > 12 || y < -2 || y > 29) return null;
    w.put(x + 2, 4);
    if (current !== O) w.put(ev.rot, 2);
    const straight = restY(matrix, current, x, ev.rot) === y;
    w.put(straight ? 1 : 0, 1);
    if (!straight) w.put(y + 2, 5);
    [matrix] = settle(matrix, current, x, y, ev.rot);
    w.put(ev.finesseFault > 0 ? 1 : 0, 1);
    if (current === T) {
      const spin = ev.action.includes("T-Spin");
      w.put(spin ? 1 : 0, 1);
      if (spin) w.put(ev.action.includes("Mini") ? 1 : 0, 1);
    }
    take = true;
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
    const bags = get(1);
    const lines = [];
    let matrix = emptyBoard();
    let combo = 0;
    let left = [];
    let current = 0;
    let hold = 0;
    let take = true;
    for (let n = 0; n < count; n++) {
      if (take) {
        if (bags) {
          if (!left.length) left = [...BAG];
          current = left.splice(get(bitsFor(left.length)), 1)[0];
        } else {
          current = get(3);
        }
      }
      if (!current) return null;
      const num = `#${String(n + 1).padStart(2, "0")}`;
      // When each piece landed is not kept: they are spaced evenly to the end.
      const stamp = `[${((end * (n + 1)) / count / 1000).toFixed(3)}s]`;
      const field = get(4);
      if (field === HOLD) {
        lines.push(`${num} ${stamp} ${LETTERS[current]} hold`);
        take = !hold;
        [hold, current] = [current, hold];
        continue;
      }
      const x = field - 2;
      const rot = current === O ? 0 : get(2);
      const y = get(1) ? restY(matrix, current, x, rot) : get(5) - 2;
      if (y === null) return null;
      const fault = get(1);
      const spin = current === T ? get(1) : 0;
      const mini = spin ? get(1) : 0;
      // Put the piece down to see what it cleared.
      let cleared;
      [matrix, cleared] = settle(matrix, current, x, y, rot);
      combo = cleared ? combo + 1 : 0;
      const name = cleared ? (spin ? `T-Spin ${mini ? "Mini " : ""}${LINES[cleared]}` : LINES[cleared]) : "";
      const words = [name + (combo > 1 ? ` Combo ${combo - 1}` : ""), cleared && matrix.every((row) => row.every((v) => !v)) ? "PC" : ""].filter(Boolean).join(" ");
      // Key counts are not kept: only whether one was wasted.
      lines.push(`${num} ${stamp} ${LETTERS[current]} spawn(3,-1) → placed(${x},${y}) rot=${rot} | keys=${1 + fault} | optimal=1${words ? ` | ${words}` : ""}`);
      take = true;
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

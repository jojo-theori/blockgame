// ─── A run small enough for a QR code ───
// The fewest bits that still replay a Sprint: which pieces came, where each
// was put down, whether a T was a spin, and the time the run took. Everything
// else a replay shows (lines, combos, the board) follows from those. A
// 40-line run comes to about 100 bytes, which a phone reads easily off the
// rank card. What is not kept: how the pieces moved on the way down, when
// each one landed (the replay spaces them evenly) and the key counts; the
// longer link (pack.js) has those.
//
// The run is written as a row of choices, each one out of a known number:
//   version (of 16), goal lines (1024), events (1024), time in ms (2^22),
//   how the pieces are told (3): each one named, by its place in a bag of
//   seven, or by the seed that dealt them, and then that seed (2^32),
//   how many pieces did not simply fall to rest (events + 1), and for each
//   of those which placement it was (events) and its row (32),
//   then the events in order. Before an event that takes a new piece from
//   the queue, that piece, unless a seed tells it: its place among those left
//   in the bag (7, 6, … 1), or one of 8 if not in bags. Then where it went: one of the ways that
//   piece can stand on a ten-wide board (9 for O, 17 for I, 34 for the
//   rest), or one more, meaning it was held. For a T that was placed, spin
//   (2) and then mini (2).
// A piece's row is not written unless it is one of the exceptions: dropping
// it in its column gives the row back.
//
// The choices are folded into one number (the first choice is the remainder
// by its count, and so on), so none of them is rounded up to whole bits, and
// the number is written in 43 characters a QR code packs tightly: digits,
// capitals and "$*+-./:".
import { COLS, ROWS, getShape, pieceOrder } from "./game.js";
import { parseLog, logMode } from "./replay.js";

const VERSION = 5;
const NAMED = 0;
const BAGS = 1;
const SEED = 2;
const O = 7;
const T = 2;
const LETTERS = " ITLJSZO";
const LINES = ["", "Single", "Double", "Triple", "Quad"];
const SIGNS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:";
export const RUN_HASH = "#q=";

// Every way each piece can stand on the board, as [rot, x].
const STANDS = [null];
for (let id = 1; id <= 7; id++) {
  const list = [];
  for (let rot = 0; rot < (id === O ? 1 : 4); rot++) {
    const shape = getShape(id, rot);
    for (let x = -3; x < COLS; x++) {
      if (shape.every((row) => row.every((on, c) => !on || (x + c >= 0 && x + c < COLS)))) list.push([rot, x]);
    }
  }
  STANDS.push(list);
}

// Choices → text, and back. Each choice is [which, out of how many].
function toText(choices) {
  let v = 0n;
  for (let i = choices.length - 1; i >= 0; i--) v = v * BigInt(choices[i][1]) + BigInt(choices[i][0]);
  let out = "";
  for (; v > 0n; v /= 43n) out += SIGNS[Number(v % 43n)];
  // An "E" at the end, so the text never ends in a sign that a chat app
  // would leave out of a link.
  return out + "E";
}
function reader(text) {
  let v = 0n;
  const body = text.slice(0, -1);
  for (let i = body.length - 1; i >= 0; i--) {
    const d = SIGNS.indexOf(body[i]);
    if (d < 0) throw new Error("not a run");
    v = v * 43n + BigInt(d);
  }
  return (count) => {
    const which = Number(v % BigInt(count));
    v /= BigInt(count);
    return which;
  };
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

// Log text → the packed run, or null when it is not a Sprint this can hold.
export function packRun(text) {
  const events = parseLog(text);
  const mode = logMode(text, events);
  const count = events.length;
  if (mode.mode !== "sprint" || !count || count > 1023 || events.some((e) => e.kind === "garbage")) return null;
  const dealt = dealtOf(events);
  // In bags of seven, each with one of every piece (the last may be cut short)?
  const bags = dealt.every((id, i) => !dealt.slice(i - (i % 7), i).includes(id));
  // Dealt by the seed the log names? Then the seed alone tells them all.
  const seed = text.split(/\r?\n/, 1)[0].match(/\bSEED:(\d+)/)?.[1];
  const deal = seed && pieceOrder(+seed);
  const how = deal && dealt.every((id) => id === deal()) ? SEED : bags ? BAGS : NAMED;
  const body = [];
  const odd = []; // placements that did not simply fall to rest: [which event, row]
  let matrix = emptyBoard();
  let left = [];
  let next = 0;
  let current = 0;
  let hold = 0;
  let take = true;
  for (const [n, ev] of events.entries()) {
    if (take) {
      current = dealt[next++];
      if (how === SEED) {
        // told by the seed
      } else if (how === BAGS) {
        if (!left.length) left = [...BAG];
        body.push([left.indexOf(current), left.length]);
        left.splice(left.indexOf(current), 1);
      } else {
        body.push([current, 8]);
      }
    }
    // The piece in hand must be the one the log says: otherwise this is not
    // a run that can be told this way.
    if (LETTERS[current] !== ev.type) return null;
    const stands = STANDS[current];
    if (ev.kind === "hold") {
      body.push([stands.length, stands.length + 1]);
      take = !hold;
      [hold, current] = [current, hold];
      continue;
    }
    const [x, y] = ev.placed;
    const rot = current === O ? 0 : ev.rot;
    const at = stands.findIndex(([r, sx]) => r === rot && sx === x);
    if (at < 0 || y < -2 || y > 29) return null;
    body.push([at, stands.length + 1]);
    if (restY(matrix, current, x, rot) !== y) odd.push([n, y + 2]);
    [matrix] = settle(matrix, current, x, y, rot);
    if (current === T) {
      const spin = ev.action.includes("T-Spin");
      body.push([spin ? 1 : 0, 2]);
      if (spin) body.push([ev.action.includes("Mini") ? 1 : 0, 2]);
    }
    take = true;
  }
  const head = [
    [VERSION, 16],
    [Math.min(1023, mode.lines || 0), 1024],
    [count, 1024],
    [Math.min(2 ** 22 - 1, Math.round(events.at(-1).t * 1000)), 2 ** 22],
    [how, 3],
    ...(how === SEED ? [[+seed, 2 ** 32]] : []),
    [odd.length, count + 1],
    ...odd.flatMap(([n, row]) => [
      [n, count],
      [row, 32],
    ]),
  ];
  return toText([...head, ...body]);
}

// The packed run → a log the replay reads like any other, or null.
export function unpackRun(packed) {
  try {
    const get = reader(packed);
    if (get(16) !== VERSION) return null;
    const goal = get(1024);
    const count = get(1024);
    const end = get(2 ** 22);
    const how = get(3);
    const seed = how === SEED ? get(2 ** 32) : null;
    const deal = how === SEED ? pieceOrder(seed) : null;
    const odd = new Map();
    for (let k = get(count + 1); k > 0; k--) {
      const n = get(count);
      odd.set(n, get(32) - 2);
    }
    const lines = [];
    let matrix = emptyBoard();
    let combo = 0;
    let left = [];
    let current = 0;
    let hold = 0;
    let take = true;
    for (let n = 0; n < count; n++) {
      if (take) {
        if (deal) {
          current = deal();
        } else if (how === BAGS) {
          if (!left.length) left = [...BAG];
          current = left.splice(get(left.length), 1)[0];
        } else {
          current = get(8);
        }
      }
      if (!current) return null;
      const num = `#${String(n + 1).padStart(2, "0")}`;
      // When each piece landed is not kept: they are spaced evenly to the end.
      const stamp = `[${((end * (n + 1)) / count / 1000).toFixed(3)}s]`;
      const stands = STANDS[current];
      const at = get(stands.length + 1);
      if (at === stands.length) {
        lines.push(`${num} ${stamp} ${LETTERS[current]} hold`);
        take = !hold;
        [hold, current] = [current, hold];
        continue;
      }
      const [rot, x] = stands[at];
      const y = odd.has(n) ? odd.get(n) : restY(matrix, current, x, rot);
      if (y === null) return null;
      const spin = current === T ? get(2) : 0;
      const mini = spin ? get(2) : 0;
      // Put the piece down to see what it cleared.
      let cleared;
      [matrix, cleared] = settle(matrix, current, x, y, rot);
      combo = cleared ? combo + 1 : 0;
      const name = cleared ? (spin ? `T-Spin ${mini ? "Mini " : ""}${LINES[cleared]}` : LINES[cleared]) : "";
      const words = [name + (combo > 1 ? ` Combo ${combo - 1}` : ""), cleared && matrix.every((row) => row.every((v) => !v)) ? "PC" : ""].filter(Boolean).join(" ");
      // Key counts are not kept, so the line says nothing of finesse.
      lines.push(`${num} ${stamp} ${LETTERS[current]} spawn(3,-1) → placed(${x},${y}) rot=${rot} | keys=0${words ? ` | ${words}` : ""}`);
      take = true;
    }
    return [`SPRINT ${goal}L${deal ? ` | SEED:${seed}` : ""}`, "", ...lines].join("\n");
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

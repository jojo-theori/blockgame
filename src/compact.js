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
//   in the bag (7, 6, … 1), or one of 8 if not in bags. Then where it went.
//   For a T that was placed, spin (2) and then mini (2).
// A piece's row is not written unless it is one of the exceptions: dropping
// it in its column gives the row back.
//
// Where a piece went is the costly part, so it is not written as a plain
// number. Every way the piece can stand on the board (9 for O, 17 for I, 34
// for the rest) is ranked by how tidy it leaves the stack (cost below), and
// what is written is the rank: most pieces go to one of the first few, and
// those take a bit or two instead of five (ODDS). Holding is one more choice
// in the same list.
//
// The choices are folded into one number, a likely choice growing it less
// than an unlikely one, and the number is written in 41 characters that a QR
// code packs tightly and that are safe in the path of a link: digits,
// capitals and "$*+-:".
//
// Reading a run back needs the same ranking and the same odds, so changing
// cost, ODDS or the engine's piece order means a new VERSION: codes made
// before stop opening.
import { COLS, ROWS, getShape, pieceOrder } from "./game.js";
import { parseLog, logMode } from "./replay.js";

const VERSION = 6;
const NAMED = 0;
const BAGS = 1;
const SEED = 2;
const O = 7;
const T = 2;
const LETTERS = " ITLJSZO";
const LINES = ["", "Single", "Double", "Triple", "Quad"];
const SIGNS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-:";
const BASE = BigInt(SIGNS.length);
// A run's link is the site, this, and the run: all capitals, so the whole
// link packs tightly.
export const RUN_PATH = "/Q/";

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

// Choices → text, and back. Each choice is [where its share starts, how big
// its share is, the sum of all shares]: one of n equally likely is [which, 1, n].
function toText(choices) {
  let v = 0n;
  for (let i = choices.length - 1; i >= 0; i--) {
    const [start, share, sum] = choices[i].map(BigInt);
    v = (v / share) * sum + start + (v % share);
  }
  let out = "";
  for (; v > 0n; v /= BASE) out += SIGNS[Number(v % BASE)];
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
    v = v * BASE + BigInt(d);
  }
  // One of count, equally likely.
  const get = (count) => {
    const which = Number(v % BigInt(count));
    v /= BigInt(count);
    return which;
  };
  // One of shares.length, each as likely as its share.
  get.of = (shares) => {
    const sum = shares.reduce((a, b) => a + b, 0);
    const slot = Number(v % BigInt(sum));
    let which = 0;
    let start = 0;
    while (start + shares[which] <= slot) start += shares[which++];
    v = BigInt(shares[which]) * (v / BigInt(sum)) + BigInt(slot - start);
    return which;
  };
  return get;
}
const pick = (shares, which) => [shares.slice(0, which).reduce((a, b) => a + b, 0), shares[which], shares.reduce((a, b) => a + b, 0)];

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

// How untidy the stack is after the piece falls in this column: holes, an
// uneven top (the deepest column, the well, left out), height. A quad is
// worth a lot, any other clear a little less than none. Whole numbers only,
// so every device ranks alike.
function cost(matrix, id, rot, x) {
  const y = restY(matrix, id, x, rot);
  if (y === null) return 1e6;
  const [after, cleared] = settle(matrix, id, x, y, rot);
  const heights = [];
  let holes = 0;
  for (let c = 0; c < COLS; c++) {
    let top = 0;
    while (top < ROWS && !after[top][c]) top++;
    heights.push(ROWS - top);
    for (let r = top + 1; r < ROWS; r++) if (!after[r][c]) holes++;
  }
  const well = heights.indexOf(Math.min(...heights));
  const tops = heights.filter((_, i) => i !== well);
  let bumps = 0;
  for (let i = 1; i < tops.length; i++) bumps += Math.abs(tops[i] - tops[i - 1]);
  const shape = getShape(id, rot);
  const foot = shape.findLastIndex((row) => row.some(Boolean));
  return 12 * holes + 2 * bumps + 2 * (ROWS - y - foot) + Math.max(...heights) - (cleared === 4 ? 16 : cleared ? -2 : 0);
}
// The ways this piece can stand, most likely first: indexes into STANDS[id].
function ranked(matrix, id) {
  return STANDS[id]
    .map(([rot, x], i) => [cost(matrix, id, rot, x), i])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, i]) => i);
}
// How often a piece goes to the first-ranked way, the second, …, out of their
// sum, from games played by people and by the CPUs; and how often it is held.
const ODDS = [480, 100, 80, 45, 30, 20, 14, 10, 8, 6, 5, 4, 3, 3, 2, 2, 2, 2];
const HOLD_ODDS = 70;
const sharesOf = (ways) => [...Array.from({ length: ways }, (_, i) => ODDS[i] ?? 1), HOLD_ODDS];

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
        body.push([left.indexOf(current), 1, left.length]);
        left.splice(left.indexOf(current), 1);
      } else {
        body.push([current, 1, 8]);
      }
    }
    // The piece in hand must be the one the log says: otherwise this is not
    // a run that can be told this way.
    if (LETTERS[current] !== ev.type) return null;
    const stands = STANDS[current];
    const shares = sharesOf(stands.length);
    if (ev.kind === "hold") {
      body.push(pick(shares, stands.length));
      take = !hold;
      [hold, current] = [current, hold];
      continue;
    }
    const [x, y] = ev.placed;
    const rot = current === O ? 0 : ev.rot;
    const at = stands.findIndex(([r, sx]) => r === rot && sx === x);
    if (at < 0 || y < -2 || y > 29) return null;
    body.push(pick(shares, ranked(matrix, current).indexOf(at)));
    if (restY(matrix, current, x, rot) !== y) odd.push([n, y + 2]);
    [matrix] = settle(matrix, current, x, y, rot);
    if (current === T) {
      const spin = ev.action.includes("T-Spin");
      body.push([spin ? 1 : 0, 1, 2]);
      if (spin) body.push([ev.action.includes("Mini") ? 1 : 0, 1, 2]);
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
  ].map(([which, of]) => [which, 1, of]);
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
      const rank = get.of(sharesOf(stands.length));
      if (rank === stands.length) {
        lines.push(`${num} ${stamp} ${LETTERS[current]} hold`);
        take = !hold;
        [hold, current] = [current, hold];
        continue;
      }
      const [rot, x] = stands[ranked(matrix, current)[rank]];
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
// cannot be packed this way. In capitals throughout (a site's name reads the
// same either way), which is what lets a QR code pack it tightly.
export function runLink(text) {
  const packed = packRun(text);
  return packed ? `${location.origin.toUpperCase()}${RUN_PATH}${packed}` : null;
}
// The run a link like that names, from the page's path; null when it is not one.
export const runInPath = (path) => (path.toUpperCase().startsWith(RUN_PATH) ? path.slice(RUN_PATH.length).toUpperCase() : null);

// Sandbox: saved boards, the pieces and cells a board is made of, and what an erase takes.
import { OPENERS, LETTER_ID } from "../../openings.js";
import { COLS, ROWS } from "../../game.js";

export const ACCENT = "#f2913d";

export const STORE = "jbl-sandbox";

export const PIECES = [1, 2, 3, 4, 5, 6, 7]; // I T L J S Z O

// Cell paint: the seven piece colours and garbage grey.
export const PAINTS = [...PIECES, 8];

export const emptyBoard = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

export const EMPTY = emptyBoard();

export const NONE = [];

export const shuffled = (a) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export const bags = (n) => Array.from({ length: n }, () => shuffled(PIECES)).flat();

// Kept in this browser for now; everything that touches storage is here, so
// it can move to an account later.
export const LIST = "jbl-sandboxes";

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const blank = (title) => ({ id: newId(), title, board: emptyBoard(), marks: emptyBoard(), order: [], hold: 0, randomAfter: true, gravity: false, updatedAt: Date.now() });

// ── Editor shortcuts ──
// By physical key, laid out like the things they pick: Q W E over the three
// tools, A S D F and Z X C V over the two rows of chips under them, and on
// the other hand J K L ; and N M , over the pieces of the order.
export const TOOL_KEYS = ["KeyQ", "KeyW", "KeyE"];
export const CHIP_KEYS = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyZ", "KeyX", "KeyC", "KeyV"];
export const ERASE_KEYS = ["KeyA", "KeyS", "KeyZ", "KeyX"]; // two by two
export const ORDER_KEYS = ["KeyJ", "KeyK", "KeyL", "Semicolon", "KeyN", "KeyM", "Comma"];
export const TURN_KEYS = ["KeyR", "KeyT"]; // left, right
export const HOLD_KEY = "KeyH";
export const keyCap = (code) => ({ Semicolon: ";", Comma: "," })[code] || code.replace("Key", "");

// ── Examples ──
// Boards that come with the Sandbox, added to the list once (delete one and it
// stays gone). Built from the opener book, so they are the shapes Opening teaches.
const EXAMPLES_SEEN = "jbl-sandbox-examples";
// DT Cannon with both bags down and the two T pieces to come: a T-spin double,
// then a T-spin triple into the hole it leaves.
export function dtCannonExample() {
  const [bag1, bag2] = OPENERS.find((o) => o.id === "dt").steps;
  const b = blank("DT: TSD → TST");
  const marks = new Map(); // "bag letter" → the number that ties a piece's cells together
  const mark = (key) => marks.get(key) ?? marks.set(key, marks.size + 1).get(key);
  bag2.grid.forEach((row, i) => {
    const r = ROWS - bag2.grid.length + i;
    // The first bag sits on the floor too, so its rows line up from the bottom.
    const under = bag1.grid[i - (bag2.grid.length - bag1.grid.length)];
    [...row].forEach((ch, c) => {
      const letter = ch === "X" ? under[c] : ch;
      if (letter === "." || ch === "T") return; // the T of this step is the one to spin in
      b.board[r][c] = LETTER_ID[letter];
      b.marks[r][c] = mark((ch === "X" ? "1" : "2") + letter);
    });
  });
  return { ...b, order: [LETTER_ID.T, LETTER_ID.T] };
}
function withExamples(list) {
  try {
    if (localStorage.getItem(EXAMPLES_SEEN)) return list;
    localStorage.setItem(EXAMPLES_SEEN, "1");
  } catch {
    return list;
  }
  const out = [...list, dtCannonExample()];
  saveList(out);
  return out;
}

export function loadList() {
  try {
    const list = JSON.parse(localStorage.getItem(LIST) || "null");
    if (Array.isArray(list)) return withExamples(list.filter((b) => Array.isArray(b.board) && b.board.length === ROWS));
    // First run with lists: bring over the one board the editor used to keep.
    const one = JSON.parse(localStorage.getItem(STORE) || "null");
    if (one && Array.isArray(one.board) && one.board.length === ROWS) return withExamples([{ ...blank("Board 1"), ...one, id: newId(), title: "Board 1" }]);
  } catch {
    /* ignore */
  }
  return withExamples([]);
}

export function saveList(list) {
  try {
    localStorage.setItem(LIST, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export const nextTitle = (list) => {
  let n = list.length + 1;
  while (list.some((b) => b.title === `Board ${n}`)) n++;
  return `Board ${n}`;
};

// The cells an erase at this point would clear, for each erase mode.
export function eraseCells(board, marks, mode, at) {
  if (!at) return [];
  const [r0, c0] = at;
  if (mode === "row") return board[r0].map((v, c) => [r0, c]).filter(([r, c]) => board[r][c]);
  if (mode === "column") return board.map((row, r) => [r, c0]).filter(([r, c]) => board[r][c]);
  if (!board[r0][c0]) return [];
  if (mode === "piece") {
    const id = marks[r0][c0];
    if (!id) return [at];
    const out = [];
    marks.forEach((row, r) => row.forEach((v, c) => v === id && board[r][c] && out.push([r, c])));
    return out;
  }
  return [at];
}

// Small 3×3 picture of what an erase mode takes away (lit cells).
export const ERASE_LIT = {
  cell: [4],
  row: [3, 4, 5],
  column: [1, 4, 7],
  piece: [1, 3, 4, 5],
};

export const ERASE_MODES = [
  ["cell", "Cell"],
  ["row", "Row"],
  ["column", "Column"],
  ["piece", "Piece"],
];

export const ORDER_CELLS = 21; // cells in the piece-order box: 7 across, 3 down

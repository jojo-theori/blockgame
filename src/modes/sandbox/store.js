// Sandbox: saved boards, the pieces and cells a board is made of, and what an erase takes.
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

export function loadList() {
  try {
    const list = JSON.parse(localStorage.getItem(LIST) || "null");
    if (Array.isArray(list)) return list.filter((b) => Array.isArray(b.board) && b.board.length === ROWS);
    // First run with lists: bring over the one board the editor used to keep.
    const one = JSON.parse(localStorage.getItem(STORE) || "null");
    if (one && Array.isArray(one.board) && one.board.length === ROWS) return [{ ...blank("Board 1"), ...one, id: newId(), title: "Board 1" }];
  } catch {
    /* ignore */
  }
  return [];
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

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
export const CLEAR_KEY = "Period"; // empties the piece order
export const keyCap = (code) => ({ Semicolon: ";", Comma: ",", Period: "." })[code] || code.replace("Key", "");

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
// A slot for each of the other pieces that only a spin reaches (the piece
// cannot drop or slide in): turn it at the mouth and the kick carries it in.
// [title, piece, rows from the floor up, drawn top to bottom]
const SPINS = [
  ["I-Spin Single", "I", ["XXX.X.....", "....XXXXXX"]],
  ["S-Spin Double", "S", ["..X.......", "X..XXXXXXX", "..XXXXXXXX"]],
  ["Z-Spin Double", "Z", [".......X..", "XXXXXXX..X", "XXXXXXXX.."]],
  ["L-Spin Double", "L", ["XX.XXXXXXX", "...XXXXXXX"]],
  ["J-Spin Double", "J", ["XXXXXXX.XX", "XXXXXXX..."]],
];
export function spinExamples() {
  return SPINS.map(([title, letter, rows]) => {
    const b = blank(title);
    let n = 0;
    rows.forEach((row, i) => {
      const r = ROWS - rows.length + i;
      [...row].forEach((ch, c) => {
        if (ch === ".") return;
        b.board[r][c] = 8; // garbage grey
        b.marks[r][c] = ++n; // each cell on its own, so Erase → Piece takes one
      });
    });
    return { ...b, order: [LETTER_ID[letter]] };
  });
}
// Situations from the 정원 blog's guides to cleaning up a field with spins
// (hse30.tistory.com/343 S and Z, /340 L and J, /544 I), numbered as there.
// [title, hold, the pieces to come (the first is the one in hand), rows down to the floor]
// A letter is a cell of that piece, X a garbage cell.
const SITUATIONS = [
  ["SZ-Spin 1-1", "I", "LZISTO", ["...S......", "...SS.....", "....S....I", "...JJ....I", "..ZJOO...I", ".ZZJOOSS.I", ".ZTJJSSLLL", ".XXXXXXXXX", ".XXXXXXXXX"]],
  ["SZ-Spin 1-3", "T", "ZSITLJ", [".........Z", "........ZZ", "OO..SS..ZL", "OO.SS..LLL", "XXXXX.XXXX", "XXXXX.XXXX", "XXXXX.XXXX", "XXXXX.XXXX", "XXXXX.XXXX", "XXXXXXX.XX", "XXXXXXX.XX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXX.XXXX", "XXX.XXXXXX", ".XXXXXXXXX", "XXXXX.XXXX", "XXXXX.XXXX"]],
  ["SZ-Spin 1-4", "I", "ZSLJIJ", ["OO........", "OO........", "LLLOO.....", "LSSOO....T", "XXXXX.XXXX", "XXXXX.XXXX", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXX.X", "XXXXXXXX.X", "XXXXXXXX.X", "XXX.XXXXXX", "XXX.XXXXXX"]],
  ["SZ-Spin 2-1", "L", "ZTJISO", ["....T.ZZ..", "...TTTIZZ.", "....SSI...", "OO.SSLIJ..", "OO.LLLIJJJ"]],
  ["SZ-Spin 2-2", "T", "SIZOLJ", [".........T", "...SS...TT", "OOSS.....T", "OOJJJ.ZS.I", ".LLLJZZSSI", ".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX"]],
  ["SZ-Spin 3", "I", "SLZTOJ", ["......SS..", "IIII.SS..J", "XXXXXXX.XX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX"]],
  ["LJ-Spin 1", "I", "ZLJLOI", [".JJ.......", ".JS....OOI", ".JSS...OOI", ".ZZS...LLI", ".XXXXXXXXX", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX."]],
  ["LJ-Spin 2", "T", "LOTZSI", ["......LLL.", "OOZZ..L...", "OOJZZ.S.OO", "ISJJJ.SSOO", "ISSLL.JSLL", "XXXXX.XXXX", "XXXXX.XXXX"]],
  ["LJ-Spin 3", "I", "ZJISTO", ["..ZZ......", ".OOZZS....", ".OOSSSSJJ.", ".XXXXXXXXX", ".XXXXXXXXX", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXX.XXXX", "XXXX.XXXXX"]],
  ["LJ-Spin 4-1", "I", "JLTISO", ["..OO......", "L.OOSSZOO.", "L..SSZZOO.", "LLIIZZJJJ.", "XXXXXXXXX.", "XXXXX.XXXX", "XXXXXX.XXX", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX."]],
  ["LJ-Spin 4-2", "O", "LTZJSI", [".JJ..OO...", ".JTTTOO...", ".JZTZZ..SS", ".ZZSSZZSSL", ".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX"]],
  ["LJ-Spin 5", "I", "LJTOSI", ["....JJJ...", "..SSI.J...", ".SSLI.....", ".LLLIJJ...", ".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX"]],
  ["I-Spin 1", "I", "TILJSI", [".....OO...", "...JSOO...", "...JSS....", "OOJJZS.JJJ", "OOZZZT..SJ", "XXXXXX.XXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "XXX.XXXXXX"]],
  ["I-Spin 2", "I", "LSIZJO", ["JJ...JJLLL", "J....JSLOO", "LL.ZZSIIII"]],
  ["I-Spin 3", "I", "LJSTLO", ["........OO", "........OO", ".......OOJ", ".......OOJ", ".......JJJ", "TTTZI..JJJ", "STZZI.LSLL", "SSZZI.LSSL", "SSZZI.LLSL", "XXXX.XXXXX", "XXXX.XXXXX", "XXXX.XXXXX", "XXXX.XXXXX", "XXXX.XXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX"]],
  ["I-Spin 4", "S", "JITSZL", ["J.ZZ...OO.", "JJJZZ..OOL", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX", "X.XXXXXXXX"]],
  ["I-Spin 5", "I", "ISLZJT", [".......S..", "I......SS.", "I.......S.", "IZZLLJJ.OO", "IZZZLJ..OO", "ZZSSLJJ.LL", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX", "XXXXXX.XXX"]],
  ["I-Spin 6", "I", "IJLTZI", [".....SZZ..", "...ZZSSZZI", "....ZZSOOI", "LLL.JJJOOI", "LZ..JJJSSI", "ZZT.JSSSLL", "OO.LZZIIII", "LS.ZSOOJJI", "LS.ZZJSJJJ", "XX.XXXXXXX", "XX.XXXXXXX", "XX.XXXXXXX", "XX.XXXXXXX", "XX.XXXXXXX", "XX.XXXXXXX", "XX.XXXXXXX"]],
  ["I-Spin 7", "", "I", ["......T...", ".....XX...", ".....X....", "XXXXXX.XXX", "XXXXXX..XX", "XXXXXX.XXX"]],
];
export function situationExamples() {
  return SITUATIONS.map(([title, hold, order, rows]) => {
    const b = blank(title);
    const top = ROWS - rows.length;
    let n = 0;
    // Touching cells of one letter are taken as one piece (Erase → Piece).
    const spread = (r, c, ch, id) => {
      if (rows[r]?.[c] !== ch || b.marks[top + r][c]) return;
      b.marks[top + r][c] = id;
      if (ch === "X") return; // garbage cells each stand alone
      spread(r + 1, c, ch, id);
      spread(r - 1, c, ch, id);
      spread(r, c + 1, ch, id);
      spread(r, c - 1, ch, id);
    };
    rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === ".") return;
        b.board[top + r][c] = ch === "X" ? 8 : LETTER_ID[ch];
        spread(r, c, ch, ++n);
      }),
    );
    return { ...b, hold: hold ? LETTER_ID[hold] : 0, order: [...order].map((ch) => LETTER_ID[ch]) };
  });
}
// Each set of examples is added once: the number kept is the last set given.
const EXAMPLE_SETS = [() => [dtCannonExample()], spinExamples, situationExamples];
function withExamples(list) {
  let seen;
  try {
    seen = Number(localStorage.getItem(EXAMPLES_SEEN)) || 0;
    if (seen >= EXAMPLE_SETS.length) return list;
    localStorage.setItem(EXAMPLES_SEEN, String(EXAMPLE_SETS.length));
  } catch {
    return list;
  }
  const out = [...list, ...EXAMPLE_SETS.slice(seen).flatMap((make) => make())];
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

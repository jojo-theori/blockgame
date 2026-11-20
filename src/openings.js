// ─── OPENERS ───
// Each opener is a list of steps. A step's grid is drawn top → bottom and sits
// on the floor: letters are the pieces to place in this step, X is what the
// board already holds when the step starts, "." is empty. Within one step each
// letter is used by exactly one piece. The last step of a T-spin opener ends
// with the T that clears lines; the next step is written for the board after
// that clear.
//
// Shapes transcribed from four.lol (TKI, PCO, DT Cannon, Albatross) and
// hse30.tistory.com (Mountainous Stacking 2).

import { COLS, ROWS } from "./game.js";

export const LETTER_ID = { I: 1, T: 2, L: 3, J: 4, S: 5, Z: 6, O: 7 };
export const ID_LETTER = { 1: "I", 2: "T", 3: "L", 4: "J", 5: "S", 6: "Z", 7: "O" };

export const OPENERS = [
  {
    // Shapes from hse30.tistory.com/1095 (bag 1 J-early form; the L-early form
    // is its mirror), form A for bag 2, and the first form-A PC solution.
    id: "mountain2",
    name: "Mountainous 2",
    jp: "山岳積み2号",
    desc: "Works with any first bag. TST, then TSD into a perfect clear.",
    steps: [
      {
        label: "Bag 1",
        grid: [
          "......L...",
          "......L...",
          "IS....LL..",
          "ISS....T..",
          "IJS.ZZTTOO",
          "IJJJ.ZZTOO",
        ],
      },
      {
        label: "Bag 2 · TST",
        grid: [
          "JJOO......",
          "JSOO..X..I",
          "JSS...XLLI",
          "XXSTZZXXLI",
          "XXXTTZZXLI",
          "XXXTXXXXXX",
          "XXXX.XXXXX",
        ],
        spin: true,
      },
      {
        label: "Bag 3 · TSD · PC",
        grid: [
          "IIIILLLJJJ",
          "XXXXLSSOOJ",
          "XXXXSSXOOX",
          "XXXTTTXXXX",
          "XXXXTXXXXX",
        ],
        // Order from the fumen solution (TOSJLI): the T spins in first.
        order: ["T", "O", "S", "J", "L", "I"],
      },
    ],
  },
  {
    id: "tki",
    name: "TKI",
    jp: "開幕TSD",
    desc: "A T-spin double straight away. Needs an early I.",
    steps: [
      {
        label: "Build · TSD",
        grid: [
          "L..ZZ.S...",
          "LTTTZZSSOO",
          "LLTIIIISOO",
        ],
        spin: true,
        extra: ["J"],
      },
    ],
  },
  {
    id: "pco",
    name: "PCO",
    jp: "パフェテンプレ",
    desc: "Perfect clear opener. Keep the I in hold for the second bag.",
    steps: [
      {
        label: "Bag 1",
        grid: [
          "LLL.....SS",
          "LOO....SST",
          "JOO...ZZTT",
          "JJJ....ZZT",
        ],
        extra: ["I"],
      },
      {
        label: "Perfect clear",
        grid: [
          "XXXIJJSSXX",
          "XXXIJSSXXX",
          "XXXIJTXXXX",
          "XXXITTTXXX",
        ],
        // The T tucks under the Z overhang before anything covers its path.
        order: ["T", "S", "J", "I"],
        extra: ["O", "L", "Z"],
      },
    ],
  },
  {
    id: "dt",
    name: "DT Cannon",
    jp: "DT砲",
    desc: "TSD into TST over two bags. Works with an early L and S.",
    steps: [
      {
        label: "Bag 1",
        grid: [
          "....T.....",
          "...TTTI...",
          "....SSIZZ.",
          "OO.SSLIJZZ",
          "OO.LLLIJJJ",
        ],
      },
      {
        label: "Bag 2 · TSD",
        grid: [
          "..LL....SS",
          "...LZZ.SSI",
          "JJ.LXZZOOI",
          "J..XXXXOOI",
          "JTTTXXXXXI",
          "XXTXXXXXXX",
          "XX.XXXXXXX",
        ],
        spin: true,
      },
      {
        label: "TST",
        grid: [
          "..XX....XX",
          "...XXX.XXX",
          "XXTXXXXXXX",
          "XTTXXXXXXX",
          "XXTXXXXXXX",
        ],
        spin: true,
      },
    ],
  },
  {
    id: "albatross",
    name: "Albatross",
    jp: "アルバトロスSP",
    desc: "Air TSD, then TST, then TSD. Needs an early O.",
    steps: [
      {
        label: "Bag 1 · TSD",
        grid: [
          "...ZZ....I",
          "STTTZZJJJI",
          "SSTOOLLLJI",
          ".S.OOL...I",
        ],
        spin: true,
      },
      {
        label: "Bag 2 · TST",
        grid: [
          "..LL.Z....",
          "...LZZ....",
          "JJTLZSIIII",
          "JTTXXSSOOX",
          "JXTXXXSOOX",
        ],
        spin: true,
      },
      {
        label: "Bag 3 · TSD",
        grid: [
          "..S.......",
          "..SS.Z...I",
          "TTTSZZLLLI",
          "JTXXZXLOOI",
          "JJJXXX.OOI",
        ],
        spin: true,
      },
    ],
  },
];

// Left-right mirror of an opener: columns reversed, L↔J and S↔Z swapped.
const MIRROR_LETTER = { L: "J", J: "L", S: "Z", Z: "S" };
const mirrorLetter = (ch) => MIRROR_LETTER[ch] || ch;

export function mirrorOpener(op) {
  return {
    ...op,
    mirrored: true,
    steps: op.steps.map((st) => ({
      ...st,
      grid: st.grid.map((row) => [...row].reverse().map(mirrorLetter).join("")),
      order: st.order ? st.order.map(mirrorLetter) : undefined,
      extra: st.extra ? st.extra.map(mirrorLetter) : undefined,
    })),
  };
}

// Expand a step grid to a full ROWS×COLS matrix of letters ("" = nothing).
export function stepTarget(step) {
  const out = Array.from({ length: ROWS }, () => new Array(COLS).fill(""));
  const off = ROWS - step.grid.length;
  step.grid.forEach((row, i) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      if (ch && ch !== ".") out[off + i][c] = ch;
    }
  });
  return out;
}

// Pieces of a step: [{ letter, id, cells: [[r,c]...] }]
export function stepPieces(step) {
  const t = stepTarget(step);
  const map = new Map();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = t[r][c];
      if (!ch || ch === "X") continue;
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch).push([r, c]);
    }
  return [...map.entries()].map(([letter, cells]) => ({ letter, id: LETTER_ID[letter], cells }));
}

// A placement order for a step: every piece rests on the floor or on something
// already placed, and (when possible) nothing placed earlier sits above it, so
// it can be hard dropped. A spin step's T goes last (it is slid in).
export function buildOrder(step) {
  if (step.order) return step.order;
  // Prefer plain drops; fall back to allowing tucks under overhangs.
  return orderWith(step, true) || orderWith(step, false);
}

function orderWith(step, strict) {
  const t = stepTarget(step);
  const pieces = stepPieces(step);
  const filled = t.map((row) => row.map((ch) => ch === "X"));
  const spinT = step.spin ? pieces.find((p) => p.letter === "T") : null;
  const rest = pieces.filter((p) => p !== spinT);
  const order = [];

  const ok = (p) => {
    const own = new Set(p.cells.map(([r, c]) => r * COLS + c));
    let supported = false;
    for (const [r, c] of p.cells) {
      if (r === ROWS - 1 || (filled[r + 1][c] && !own.has((r + 1) * COLS + c))) supported = true;
      if (strict)
        for (let rr = r - 1; rr >= 0; rr--) if (filled[rr][c] && !own.has(rr * COLS + c)) return false;
    }
    return supported;
  };

  const solve = () => {
    if (order.length === rest.length) return true;
    for (const p of rest) {
      if (order.includes(p) || !ok(p)) continue;
      order.push(p);
      for (const [r, c] of p.cells) filled[r][c] = true;
      if (solve()) return true;
      for (const [r, c] of p.cells) filled[r][c] = false;
      order.pop();
    }
    return false;
  };

  if (!solve()) return null;
  if (spinT) order.push(spinT);
  return order.map((p) => p.letter);
}

// Fixed piece sequence for a whole opener (ids), extras appended per step.
export function openerSequence(opener) {
  const seq = [];
  for (const step of opener.steps) {
    const order = buildOrder(step) || stepPieces(step).map((p) => p.letter);
    for (const l of order) seq.push(LETTER_ID[l]);
    for (const l of step.extra || []) seq.push(LETTER_ID[l]);
  }
  return seq;
}

// Small picture of the finished build (before the last spin clears), ids with
// -1 for X cells. Combines a step's own pieces only.
export function stepPicture(step) {
  return step.grid.map((row) =>
    [...row].map((ch) => (ch === "." ? 0 : ch === "X" ? -1 : LETTER_ID[ch])),
  );
}

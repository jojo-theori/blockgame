// The Super Rotation System: where a piece may go when a turn does not fit.
//
// SRS is given here the way the Guideline defines it, as five offsets for each
// of a piece's four states (0 spawn, 1 right, 2 upside down, 3 left; y up).
// The places to try for a turn are the offsets of the state it leaves minus
// those of the state it enters, in order; the first that fits is taken.
// https://tetris.wiki/Super_Rotation_System ("How Guideline SRS Really Works")
const OFFSETS = [
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
];
// I turns about a point between cells, so its offsets also carry where its box
// sits; only how each try differs from the first is a kick.
const OFFSETS_I = [
  [[0, 0], [-1, 0], [2, 0], [-1, 0], [2, 0]],
  [[-1, 0], [0, 0], [0, 0], [0, 1], [0, -2]],
  [[-1, 1], [1, 1], [-2, 1], [1, 0], [-2, 0]],
  [[0, 1], [0, 1], [0, 1], [0, -1], [0, 2]],
];
function quarterTurn(offsets, from, to) {
  const tries = offsets[from].map(([x, y], i) => [x - offsets[to][i][0], y - offsets[to][i][1]]);
  const [x0, y0] = tries[0];
  return tries.map(([x, y]) => [x - x0, y - y0]);
}

// A half turn is not part of SRS. These are the places tried for one, the same
// from every state for the three-wide pieces; for I, sideways first (toward
// the side its box leans), then up, then down.
const HALF = [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [-1, 0], [-2, 0], [-1, 1], [-2, 1], [0, -1], [3, 0], [-3, 0]];
const HALF_I = [
  [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]],
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]],
];

// kicks[from state][direction] = [[dx, dy], …]; direction 1 is clockwise,
// -1 counter-clockwise, 2 a half turn.
function table(offsets, half) {
  const kicks = {};
  for (let from = 0; from < 4; from++) {
    kicks[from] = {
      1: quarterTurn(offsets, from, (from + 1) % 4),
      "-1": quarterTurn(offsets, from, (from + 3) % 4),
      2: half(from),
    };
  }
  return kicks;
}
const KICKS_JLSTZ = table(OFFSETS, () => HALF);
const KICKS_I = table(OFFSETS_I, (from) => HALF_I[from]);

export function getKicks(pieceId) {
  return pieceId === 1 ? KICKS_I : KICKS_JLSTZ;
}

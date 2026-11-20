// ─── FINESSE ───
// On an empty board every drop position is a set of four cells. For a piece we
// list the distinct sets, and for a target set we search the shortest key
// sequence from spawn (tap left/right, DAS to a wall, the three rotations) and
// end with a hard drop. Rotation states that land on the same cells (I, S, Z,
// O) count as the same target.

import { COLS, ROWS, getShape } from "./game.js";

const SPAWN_X = 3;

function bounds(id, rot) {
  const s = getShape(id, rot);
  let minC = 9,
    maxC = 0;
  s.forEach((row) =>
    row.forEach((v, c) => {
      if (v) {
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }),
  );
  return { left: -minC, right: COLS - 1 - maxC };
}

// Cells of a piece dropped on an empty board at column x, rotation rot.
export function dropCells(id, rot, x) {
  const s = getShape(id, rot);
  let maxR = 0;
  s.forEach((row, r) => row.forEach((v) => v && (maxR = Math.max(maxR, r))));
  const y = ROWS - 1 - maxR;
  const out = [];
  s.forEach((row, r) => row.forEach((v, c) => v && out.push([y + r, x + c])));
  return out;
}

const keyOf = (cells) =>
  cells
    .map(([r, c]) => r * COLS + c)
    .sort((a, b) => a - b)
    .join(",");

// Distinct placements for a piece: [{ rot, x, cells, key }]
export function placements(id) {
  const seen = new Map();
  for (let rot = 0; rot < 4; rot++) {
    const b = bounds(id, rot);
    for (let x = b.left; x <= b.right; x++) {
      const cells = dropCells(id, rot, x);
      const key = keyOf(cells);
      if (!seen.has(key)) seen.set(key, { rot, x, cells, key });
    }
  }
  return [...seen.values()];
}

function step(id, x, rot, move) {
  const b = bounds(id, rot);
  switch (move) {
    case "left":
      return x - 1 >= b.left ? [x - 1, rot] : null;
    case "right":
      return x + 1 <= b.right ? [x + 1, rot] : null;
    case "dasLeft":
      return x !== b.left ? [b.left, rot] : null;
    case "dasRight":
      return x !== b.right ? [b.right, rot] : null;
    default: {
      const dr = move === "rotateCW" ? 1 : move === "rotateCCW" ? 3 : 2;
      const nr = (rot + dr) % 4;
      const nb = bounds(id, nr);
      return [Math.min(nb.right, Math.max(nb.left, x)), nr];
    }
  }
}

const MOVES = ["left", "right", "dasLeft", "dasRight", "rotateCW", "rotateCCW", "rotate180"];

// Every shortest input for a target cell set (several orders and mirror-image
// choices usually tie, e.g. rotate-then-move vs move-then-rotate, or CW twice
// vs 180). Returns { count, paths } — count includes the hard drop, each path
// ends with "harddrop". opts.allow180 = false leaves the 180 key out.
export function bestPaths(id, cells, opts = {}) {
  const goal = keyOf(cells);
  const moves = opts.allow180 === false ? MOVES.filter((m) => m !== "rotate180") : MOVES;
  const hit = (x, rot) => keyOf(dropCells(id, rot, x)) === goal;
  for (let len = 0; len <= 6; len++) {
    const paths = [];
    const walk = (x, rot, path) => {
      if (path.length === len) {
        if (hit(x, rot)) paths.push([...path, "harddrop"]);
        return;
      }
      for (const m of moves) {
        const n = step(id, x, rot, m);
        if (n) walk(n[0], n[1], [...path, m]);
      }
    };
    walk(SPAWN_X, 0, []);
    if (paths.length) {
      // Different orders of the same keys are all valid; drop exact duplicates.
      const seen = new Set();
      const uniq = paths.filter((p) => {
        const k = p.join(" ");
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { count: len + 1, paths: uniq };
    }
  }
  return { count: Infinity, paths: [] };
}

// Back-compat: one shortest path.
export function bestPath(id, cells, opts) {
  const r = bestPaths(id, cells, opts);
  return { count: r.count, path: r.paths[0] || [] };
}

export function sameCells(a, b) {
  return keyOf(a) === keyOf(b);
}

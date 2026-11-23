// Every way to set S, Z and O down so the three make one shape: the stock a
// logo is chosen from (Lab → Logo). Positions that differ only by where they
// sit are one arrangement; turning or mirroring gives a different one, since
// it changes what the eye reads.
const SHAPES = {
  S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
  Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
  O: [[[0, 0], [1, 0], [0, 1], [1, 1]]],
};
export const PIECES = ["S", "Z", "O"];
export const PIECE_COLORS = { S: "#5cc45c", Z: "#e8505b", O: "#f2cb4c" };

const key = ([x, y]) => `${x},${y}`;
const at = (cells, dx, dy) => cells.map(([x, y]) => [x + dx, y + dy]);
const overlap = (a, b) => {
  const set = new Set(b.map(key));
  return a.some((c) => set.has(key(c)));
};
const touch = (a, b) => {
  const set = new Set(b.map(key));
  return a.some(([x, y]) => set.has(key([x + 1, y])) || set.has(key([x - 1, y])) || set.has(key([x, y + 1])) || set.has(key([x, y - 1])));
};
const centre = (cells, axis) => cells.reduce((sum, c) => sum + c[axis], 0) / cells.length;

// What is worth knowing about one arrangement when choosing among them.
function describe(P) {
  const all = PIECES.flatMap((n) => P[n]);
  const w = Math.max(...all.map((c) => c[0])) + 1;
  const h = Math.max(...all.map((c) => c[1])) + 1;
  const filled = new Set(all.map(key));
  // Edges of the outline: fewer means a rounder, calmer shape.
  let edge = 0;
  for (const [x, y] of all) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!filled.has(key([x + dx, y + dy]))) edge++;
  // Empty cells shut in on all sides (reached from no border of the box).
  const open = new Set();
  const walk = [];
  for (let x = -1; x <= w; x++) walk.push([x, -1], [x, h]);
  for (let y = 0; y < h; y++) walk.push([-1, y], [w, y]);
  while (walk.length) {
    const [x, y] = walk.pop();
    const k = key([x, y]);
    if (open.has(k) || filled.has(k) || x < -1 || y < -1 || x > w || y > h) continue;
    open.add(k);
    walk.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let holes = 0;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (!filled.has(key([x, y])) && !open.has(key([x, y]))) holes++;
  const flipped = (cells) => cells.map(([x, y]) => key([w - 1 - x, y])).sort().join(";");
  const same = (cells) => cells.map(key).sort().join(";");
  const xs = PIECES.map((n) => centre(P[n], 0));
  const ys = PIECES.map((n) => centre(P[n], 1));
  return {
    P,
    w,
    h,
    edge,
    holes,
    touches: (touch(P.S, P.Z) ? 1 : 0) + (touch(P.Z, P.O) ? 1 : 0) + (touch(P.S, P.O) ? 1 : 0),
    // S and Z are each other's mirror image, so a shape can be symmetric with O on the axis.
    mirror: flipped(P.S) === same(P.Z) && flipped(P.O) === same(P.O),
    // Reads S, Z, O from the left, or from the top.
    across: xs[0] < xs[1] && xs[1] < xs[2],
    down: ys[0] < ys[1] && ys[1] < ys[2],
  };
}

let cache = null;
export function logoLayouts() {
  if (cache) return cache;
  const seen = new Map();
  for (const s of SHAPES.S)
    for (const z0 of SHAPES.Z)
      for (let zx = -5; zx <= 5; zx++)
        for (let zy = -5; zy <= 5; zy++) {
          const z = at(z0, zx, zy);
          if (overlap(s, z)) continue;
          for (let ox = -8; ox <= 8; ox++)
            for (let oy = -8; oy <= 8; oy++) {
              const o = at(SHAPES.O[0], ox, oy);
              if (overlap(s, o) || overlap(z, o)) continue;
              // One shape: at least two of the three pairs share an edge.
              if ((touch(s, z) ? 1 : 0) + (touch(z, o) ? 1 : 0) + (touch(s, o) ? 1 : 0) < 2) continue;
              const all = [...s, ...z, ...o];
              const mx = Math.min(...all.map((c) => c[0]));
              const my = Math.min(...all.map((c) => c[1]));
              const P = { S: at(s, -mx, -my), Z: at(z, -mx, -my), O: at(o, -mx, -my) };
              const id = PIECES.map((n) => P[n].map(key).sort().join(";")).join("|");
              if (!seen.has(id)) seen.set(id, P);
            }
        }
  const list = [...seen.entries()].map(([id, P]) => ({ id, ...describe(P) }));
  // Tightest first: the smaller box, then no holes, then the shorter outline.
  list.sort((a, b) => a.w * a.h - b.w * b.h || a.w - b.w || a.holes - b.holes || a.edge - b.edge || (a.id < b.id ? -1 : 1));
  // A name to call each by: its box, then its place in that box's list ("4×4-03").
  const counts = {};
  for (const a of list) {
    const box = `${a.w}×${a.h}`;
    counts[box] = (counts[box] || 0) + 1;
    a.box = box;
    a.code = `${box}-${String(counts[box]).padStart(2, "0")}`;
  }
  cache = list;
  return list;
}

// The arrangement as squares to draw inside a box `size` wide: [{x, y, side, color}].
export function markCells(layout, size, pad = 0.16) {
  const room = size * (1 - 2 * pad);
  const side = Math.floor(room / Math.max(layout.w, layout.h)) || room / Math.max(layout.w, layout.h);
  // On whole pixels, so neighbouring squares meet without a hairline between them.
  const x0 = Math.round((size - side * layout.w) / 2);
  const y0 = Math.round((size - side * layout.h) / 2);
  return PIECES.flatMap((n) => layout.P[n].map(([x, y]) => ({ x: x0 + x * side, y: y0 + y * side, side, color: PIECE_COLORS[n] })));
}

// Which pieces come, and in what order.

// The pieces a seed deals, one per call: bags of seven, each shuffled. A run
// that knows its seed can be told without listing its pieces (compact.js).
export function pieceOrder(seed) {
  const rng = mulberry32(seed);
  let bag = [];
  return () => {
    if (!bag.length) bag = sevenBag(rng);
    return bag.shift();
  };
}

export function sevenBag(rng) {
  const bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Simple seedable PRNG (mulberry32)
export function mulberry32(seed) {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// A start to deal again: the first piece is S, Z or O, the three that cannot
// be set down without leaving a gap or an overhang on an empty board. (Piece
// ids: I=1, T=2, L=3, J=4, S=5, Z=6, O=7.) It is an old convention, and the
// game's name: NullpoMino's standard rule (BagNoSZORandomizer) and tetr.js
// both reshuffle the first bag until it does not start with one of them.
export function awkwardStart(queue) {
  return queue[0] === 5 || queue[0] === 6 || queue[0] === 7;
}

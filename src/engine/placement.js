// What a placement was worth looking back on: the fewest key presses that
// would have made it, and the stack's heights and covered holes after it.
import { COLS, ROWS, EMPTY, getShape } from "./pieces.js";

function pieceXBounds(pieceId, rot) {
  const shape = getShape(pieceId, rot);
  let minC = Infinity,
    maxC = -Infinity;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  return { leftX: -minC, rightX: COLS - 1 - maxC };
}

export function computeFinesseOptimal(pieceId, spawnX, placedX, placedRot) {
  const isO = pieceId === 7;
  const goalRot = isO ? 0 : placedRot;
  const visited = new Set();
  const startKey = `${spawnX},0`;
  visited.add(startKey);
  let frontier = [{ x: spawnX, r: 0 }];
  let cost = 0;
  while (frontier.length && cost < 20) {
    const next = [];
    for (const cur of frontier) {
      const curR = isO ? 0 : cur.r;
      if (cur.x === placedX && curR === goalRot) {
        return cost + 1;
      }
      const { leftX, rightX } = pieceXBounds(pieceId, cur.r);
      const candidates = [];
      if (cur.x - 1 >= leftX)
        candidates.push({ x: cur.x - 1, r: cur.r });
      if (cur.x + 1 <= rightX)
        candidates.push({ x: cur.x + 1, r: cur.r });
      if (cur.x !== leftX) candidates.push({ x: leftX, r: cur.r });
      if (cur.x !== rightX) candidates.push({ x: rightX, r: cur.r });
      for (const dr of [1, 3, 2]) {
        const nr = (cur.r + dr) % 4;
        const b = pieceXBounds(pieceId, nr);
        let nx = cur.x;
        if (nx < b.leftX) nx = b.leftX;
        if (nx > b.rightX) nx = b.rightX;
        candidates.push({ x: nx, r: nr });
      }
      for (const n of candidates) {
        const key = `${n.x},${isO ? 0 : n.r}`;
        if (!visited.has(key)) {
          visited.add(key);
          next.push(n);
        }
      }
    }
    frontier = next;
    cost++;
  }
  return -1;
}

export function computeHeights(matrix) {
  const heights = new Array(COLS).fill(0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (matrix[r][c] !== EMPTY) {
        heights[c] = ROWS - r;
        break;
      }
    }
  }
  return heights;
}

export function countHoles(matrix) {
  let holes = 0;
  for (let c = 0; c < COLS; c++) {
    let foundBlock = false;
    for (let r = 0; r < ROWS; r++) {
      if (matrix[r][c] !== EMPTY) foundBlock = true;
      else if (foundBlock) holes++;
    }
  }
  return holes;
}

// One or two text lines per event of the piece log.

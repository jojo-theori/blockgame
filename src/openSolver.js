// ─── OPENER SOLVER ───
// Decides whether an opener can be built from a given piece sequence (with
// hold), and if so how. Reachability uses the real engine (SRS kicks), so
// tucks and T-spins count exactly as they would in play.
//
// State: current piece, next index in the queue, hold piece, whether hold is
// still allowed for this piece, current step and which of its pieces are
// placed. A piece can be placed when the engine can move it from spawn into its
// target cells on the board built so far. Pieces the step doesn't use must sit
// in hold.

import { BlockEngine, ROWS, COLS, getShape } from "./game.js";
import { stepTarget, stepPieces, ID_LETTER, mirrorOpener } from "./openings.js";

const MOVES = ["L", "R", "D", "CW", "CCW", "180"];

function cellsAt(id, x, y, rot) {
  const s = getShape(id, rot);
  const out = [];
  for (let r = 0; r < s.length; r++) for (let c = 0; c < s.length; c++) if (s[r][c]) out.push((y + r) * COLS + (x + c));
  return out;
}

// Can the engine bring piece `id` from spawn to exactly `goal` cells on `board`?
function reachable(engine, board, id, goal) {
  engine.matrix = board;
  engine.currentId = id;
  engine.respawnCurrent();
  if (engine.collides(engine.currentX, engine.currentY, engine.currentRot)) return false;
  const goalSet = new Set(goal);
  const seen = new Set();
  const q = [[engine.currentX, engine.currentY, engine.currentRot]];
  seen.add(q[0].join());
  while (q.length) {
    const [x, y, rot] = q.shift();
    if (engine.collides(x, y + 1, rot)) {
      const cs = cellsAt(id, x, y, rot);
      if (cs.every((c) => goalSet.has(c))) return true;
    }
    for (const m of MOVES) {
      engine.currentX = x;
      engine.currentY = y;
      engine.currentRot = rot;
      if (m === "L") engine.move(-1);
      else if (m === "R") engine.move(1);
      else if (m === "D") engine.softDrop();
      else engine.rotate(m === "CW" ? 1 : m === "CCW" ? -1 : 2);
      const k = [engine.currentX, engine.currentY, engine.currentRot].join();
      if (!seen.has(k)) {
        seen.add(k);
        q.push([engine.currentX, engine.currentY, engine.currentRot]);
      }
    }
  }
  return false;
}

const solverCache = new Map();

export function getSolver(opener) {
  const key = opener.id + (opener.mirrored ? "~m" : "");
  if (solverCache.has(key)) return solverCache.get(key);

  const engine = new BlockEngine({ sprintLines: 999999 });

  const steps = opener.steps.map((step) => {
    const target = stepTarget(step);
    const pieces = stepPieces(step);
    const idx = {};
    pieces.forEach((p, i) => (idx[p.letter] = i));
    const xCells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (target[r][c] === "X") xCells.push([r, c]);
    return {
      pieces,
      idx,
      xCells,
      full: (1 << pieces.length) - 1,
      spinT: step.spin && idx.T !== undefined ? idx.T : -1,
    };
  });

  const placeMemo = new Map();
  // Piece k of step si can be placed once the pieces in `mask` are down.
  function placeable(si, mask, k) {
    const key = si * 1024 + mask * 8 + k;
    if (placeMemo.has(key)) return placeMemo.get(key);
    const S = steps[si];
    let ok = true;
    if (S.spinT >= 0 && k === S.spinT && mask !== (S.full & ~(1 << k))) ok = false; // the spin T goes last
    if (ok) {
      const filled = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
      for (const [r, c] of S.xCells) filled[r][c] = 8;
      S.pieces.forEach((p, i) => {
        if (mask & (1 << i)) for (const [r, c] of p.cells) filled[r][c] = p.id;
      });
      // Rows already completed have cleared: drop them, shift the goal down.
      const fullRows = [];
      for (let r = 0; r < ROWS; r++) if (filled[r].every((v) => v)) fullRows.push(r);
      const board = filled.filter((_, r) => !fullRows.includes(r));
      while (board.length < ROWS) board.unshift(new Array(COLS).fill(0));
      const goal = S.pieces[k].cells.map(([r, c]) => {
        const below = fullRows.filter((fr) => fr > r).length;
        return (r + below) * COLS + c;
      });
      ok = reachable(engine, board, S.pieces[k].id, goal);
    }
    placeMemo.set(key, ok);
    return ok;
  }

  // Search from a state. Returns the list of actions ("place" | "hold") or null.
  function solve(queue, state) {
    const memo = new Set();
    const dfs = (cur, j, hold, si, mask, canHold) => {
      if (si >= steps.length) return [];
      const S = steps[si];
      if (mask === S.full) return dfs(cur, j, hold, si + 1, 0, canHold);
      if (cur == null) return null;
      const key = `${cur},${j},${hold},${si},${mask},${canHold}`;
      if (memo.has(key)) return null;
      memo.add(key);
      const k = S.idx[ID_LETTER[cur]];
      if (k !== undefined && !(mask & (1 << k)) && placeable(si, mask, k)) {
        const r = dfs(queue[j], j + 1, hold, si, mask | (1 << k), true);
        if (r) return ["place", ...r];
      }
      if (canHold) {
        const r = hold == null ? dfs(queue[j], j + 1, cur, si, mask, false) : dfs(hold, j, cur, si, mask, false);
        if (r) return ["hold", ...r];
      }
      return null;
    };
    const s = state || {};
    return dfs(
      s.cur ?? queue[0],
      s.next ?? 1,
      s.hold ?? null,
      s.step ?? 0,
      s.mask ?? 0,
      s.canHold ?? true,
    );
  }

  const solver = { steps, solve };
  solverCache.set(key, solver);
  return solver;
}

function shuffledBag(rand) {
  const bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// A random 7-bag sequence (and orientation, when mirroring is on) that the
// opener can be built from. Rerolls until one works.
export function solvableRun(opener, { mirror = false, random = true, ideal = null, rand = Math.random } = {}) {
  const orientations = () => (mirror ? (rand() < 0.5 ? [false, true] : [true, false]) : [false]);
  for (let tries = 0; tries < 400; tries++) {
    for (const m of orientations()) {
      const op = m ? mirrorOpener(opener) : opener;
      let seq;
      if (random) {
        seq = [];
        for (let b = 0; b < 6; b++) seq.push(...shuffledBag(rand));
      } else {
        seq = ideal(op);
      }
      const plan = getSolver(op).solve(seq);
      if (plan) return { op, seq, mirrored: m, plan };
    }
    if (!random) break;
  }
  return null;
}

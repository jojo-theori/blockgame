// ─── Run analysis ───
// Reads a replay (events + frames from replay.js) and scores three things:
//   macro      how well the stack was planned, whatever the speed
//   dexterity  raw speed of the hands
//   finesse    how few key presses each placement took
// and picks the handful of moments worth looking at again.
//
// Nothing here is a language model: macro compares every placement with what
// a plain drop could have done on the same board, using a stack evaluator.
// The result is data ({ kind, grade, text: [key, params] }); the UI words it.
import { ROWS, COLS, EMPTY, getShape, BlockEngine } from "./game.js";

const LETTER_ID = { I: 1, T: 2, L: 3, J: 4, S: 5, Z: 6, O: 7 };
const ROTATIONS = { 1: 2, 5: 2, 6: 2, 7: 1 }; // distinct shapes; the rest have 4

// ── Board features ──
function heights(m) {
  const h = new Array(COLS).fill(0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (m[r][c] !== EMPTY) {
        h[c] = ROWS - r;
        break;
      }
    }
  }
  return h;
}
// Empty cells with something above them in the same column.
function gaps(m) {
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    let roof = false;
    for (let r = 0; r < ROWS; r++) {
      if (m[r][c] !== EMPTY) roof = true;
      else if (roof) n++;
    }
  }
  return n;
}
// Surface roughness, leaving the lowest column out: one open well is a plan
// (it is where the I piece goes), not a flaw.
function bumps(h) {
  const well = h.indexOf(Math.min(...h));
  const rest = h.filter((_, c) => c !== well);
  let n = 0;
  for (let i = 0; i + 1 < rest.length; i++) n += Math.abs(rest[i] - rest[i + 1]);
  return n;
}
function features(m) {
  const h = heights(m);
  return { gaps: gaps(m), bumps: bumps(h), top: Math.max(...h) };
}
// Lower is better. Covered gaps dominate; clearing lines pays some of it back.
// The two modes want different things from a clear and a tall stack:
//   Sprint  every line counts the same, and height is safe for longer.
//   Battle  only clears that send attack are worth much (a quad far more than
//           four singles), and height is dangerous sooner: garbage is coming.
const CLEAR_WORTH = { battle: [0, 0, 1.5, 4, 11] };
function cost(f, cleared, mode) {
  const battle = mode === "battle";
  const worth = battle ? CLEAR_WORTH.battle[cleared] : 2.5 * cleared;
  return 12 * f.gaps + 1.2 * f.bumps + 3 * Math.max(0, f.top - (battle ? 9 : 12)) - worth;
}

// ── Every spot a straight drop can reach ──
function collides(m, shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      const mx = x + c;
      const my = y + r;
      if (mx < 0 || mx >= COLS || my >= ROWS) return true;
      if (my >= 0 && m[my][mx] !== EMPTY) return true;
    }
  }
  return false;
}
function settle(m, id, rot, x, y) {
  const shape = getShape(id, rot);
  const out = m.map((row) => row.slice());
  const cells = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape.length; c++) {
      if (!shape[r][c]) continue;
      if (y + r < 0) return null;
      out[y + r][x + c] = id;
      cells.push([y + r, x + c]);
    }
  }
  const kept = out.filter((row) => row.some((v) => v === EMPTY));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(EMPTY));
  // placed: the board with the piece on it, before any full rows go.
  return { matrix: kept, cleared, cells, placed: out };
}
function bestDrop(m, id, mode) {
  let best = null;
  for (let rot = 0; rot < (ROTATIONS[id] || 4); rot++) {
    const shape = getShape(id, rot);
    for (let x = -2; x <= COLS; x++) {
      let y = -2;
      if (collides(m, shape, x, y)) continue;
      while (!collides(m, shape, x, y + 1)) y++;
      const done = settle(m, id, rot, x, y);
      if (!done) continue;
      const f = features(done.matrix);
      const c = cost(f, done.cleared, mode);
      if (!best || c < best.cost) best = { cost: c, f, cleared: done.cleared, cells: done.cells, matrix: done.matrix, placed: done.placed };
    }
  }
  return best;
}

// A board with a piece painted on these cells, full rows left in place.
export function paint(matrix, id, cells) {
  const out = matrix.map((row) => row.slice());
  for (const [r, c] of cells) if (r >= 0 && r < ROWS) out[r][c] = id;
  return out;
}

// The best continuation from a board: each piece in turn at its best straight
// drop. Returns one entry per piece: the cells it took and the board after.
// first: a move to open with instead of the first piece's best drop.
export function bestLine(matrix, ids, mode, first = null) {
  const line = first ? [first] : [];
  let m = first ? first.matrix : matrix;
  for (const id of first ? ids.slice(1) : ids) {
    const best = bestDrop(m, id, mode);
    if (!best) break;
    line.push({ id, cells: best.cells, cleared: best.cleared, matrix: best.matrix, placed: best.placed });
    m = best.matrix;
  }
  return line;
}

// ── The engine's view (Battle) ──
// Cold Clear looks at the position before every piece (before a hold, if the
// player held) and says what each move was worth to it. The loss of a move is
// the engine's best value less the value of the move played.
const ID_LETTER = " ITLJSZO";
const ENGINE_NODES = 2500;
// In the engine's own units. Measured on solo runs: Cold Clear replaying its
// own play loses about 40 a move, a plain stacker 150, a careless one 850.
const ENGINE_GRADES = { inaccuracy: 150, mistake: 300, blunder: 600 };
const ENGINE_CAP = 800; // one disaster should not sink the whole score
const ENGINE_SCALE = 350;
const cellKey = (cells) => cells.map(([r, c]) => r * 10 + c).sort((x, y) => x - y).join(",");
// A line of moves ({ id, cells }, each on the board the one before left)
// played out: the board after each, and with the piece still on it.
export function playLine(matrix, raw) {
  const line = [];
  let m = matrix;
  for (const mv of raw) {
    const placed = paint(m, mv.id, mv.cells);
    const kept = placed.filter((row) => row.some((v) => v === EMPTY));
    const cleared = ROWS - kept.length;
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(EMPTY));
    line.push({ id: mv.id, cells: mv.cells, cleared, matrix: kept, placed });
    m = kept;
  }
  return line;
}
// → Map(step of a placement → { loss, best, mine, line }); mine is null when
// the engine never considered the spot that was played.
export async function engineMacro({ events, frames, dealt }, evaluate, onProgress = () => {}) {
  const out = new Map();
  let combo = 0;
  let b2b = false;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind !== "place") continue;
    const s = i > 0 && events[i - 1].kind === "hold" ? i - 1 : i;
    const f = frames[s];
    const res = await evaluate(
      {
        rows: f.matrix.map((row) => row.map((v) => (v === EMPTY ? "0" : "1")).join("")),
        cur: events[s].type,
        queue: dealt.slice(f.dealtCount, f.dealtCount + 5).map((id) => ID_LETTER[id]).join(""),
        hold: f.hold ? ID_LETTER[f.hold] : "",
        canHold: true,
        b2b,
        combo,
        incoming: 0,
      },
      ENGINE_NODES,
    );
    const id = LETTER_ID[ev.type];
    const shape = getShape(id, ev.rot);
    const cells = [];
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape.length; c++) if (shape[r][c]) cells.push([ev.placed[1] + r, ev.placed[0] + c]);
    if (res) {
      const key = cellKey(cells);
      const mine = res.moves.filter((m) => m.id === id && m.key === key).sort((p, q) => q.value - p.value)[0] || null;
      // The plan is the line after the best move, when it starts with it.
      const plan = res.plan.length && cellKey(res.plan[0].cells) === res.best.key ? res.plan : [res.best];
      out.set(i, { loss: mine ? Math.max(0, res.best.value - mine.value) : null, best: res.best, mine, line: playLine(f.matrix, plan.slice(0, 4)) });
    }
    const cleared = frames[i + 1].lines - frames[i].lines;
    if (cleared) {
      combo++;
      b2b = /quad|spin/i.test(ev.action || "");
    } else {
      combo = 0;
    }
    onProgress(i / events.length);
  }
  return out;
}

// ── T-spins the board offered ──
// A T-spin needs the last move to be a rotation into a spot the piece cannot
// drop out of, so a straight drop never finds one. This walks every position
// the T can reach (left, right, down, both rotations) on a scratch engine, so
// the game's own kicks and its own T-spin test decide what counts.
let scratch = null;
export function tSpins(matrix) {
  if (!scratch) {
    scratch = new BlockEngine({ sequence: [2], seed: 1 });
    scratch.start();
    scratch.spawnAt = [scratch.currentX, scratch.currentY];
  }
  const e = scratch;
  e.matrix = matrix;
  e.currentId = 2;
  e.playing = true;
  const [sx, sy] = e.spawnAt;
  if (e.collides(sx, sy, 0)) return [];
  const seen = new Set([`${sx},${sy},0`]);
  const queue = [[sx, sy, 0]];
  const found = new Map();
  while (queue.length) {
    const [x, y, rot] = queue.pop();
    const visit = (nx, ny, nr) => {
      const key = `${nx},${ny},${nr}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push([nx, ny, nr]);
      }
    };
    for (const d of [-1, 1]) if (!e.collides(x + d, y, rot)) visit(x + d, y, rot);
    if (!e.collides(x, y + 1, rot)) visit(x, y + 1, rot);
    for (const dir of [1, -1]) {
      e.currentX = x;
      e.currentY = y;
      e.currentRot = rot;
      e.spinPossible = false;
      e.spinMini = false;
      e.lockActivated = false;
      if (!e.rotate(dir)) continue;
      const [nx, ny, nr] = [e.currentX, e.currentY, e.currentRot];
      visit(nx, ny, nr);
      // Rotated into a resting spot the engine calls a T-spin: a candidate.
      if (e.spinPossible && e.collides(nx, ny + 1, nr)) {
        const done = settle(matrix, 2, nr, nx, ny);
        if (done && done.cleared > 0) {
          const key = `${nx},${ny},${nr}`;
          if (!found.has(key)) found.set(key, { ...done, id: 2, mini: e.spinMini });
        }
      }
    }
  }
  return [...found.values()];
}

const round = (n) => Math.round(n);
const median = (a) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// events, frames: from parseLog / buildFrames. onProgress(0..1) is called as
// it goes; the work is cut into slices so the page stays responsive.
// evaluate: asks the engine about a position (review.js's evalPosition). With
// it, a Battle is judged by Cold Clear; without it (or if it fails) and in
// every other mode, by the stack evaluator above.
export async function analyze({ events, frames, dealt, mode: played }, onProgress = () => {}, evaluate = null) {
  const mode = played?.mode;
  let engine = null;
  if (mode === "battle" && evaluate && dealt) {
    try {
      engine = await engineMacro({ events, frames, dealt }, evaluate, (p) => onProgress(p * 0.9));
    } catch (err) {
      console.error("Engine review failed:", err);
    }
  }
  const found = []; // candidate moments
  const places = [];
  let regret = 0; // summed macro loss
  let prevT = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind !== "place") continue;
    const id = LETTER_ID[ev.type];
    const before = frames[i].matrix;
    const after = frames[i + 1].matrix;
    const cleared = frames[i + 1].lines - frames[i].lines;
    const f = features(after);
    const mine = cost(f, cleared, mode);
    const best = bestDrop(before, id, mode);
    const dt = prevT === null ? null : ev.t - prevT;
    prevT = ev.t;
    places.push({ i, ev, dt });

    const seen = engine?.get(i);
    if (seen) {
      // Macro by the engine: what its best move was worth, less this one.
      // A spot it never weighed is left alone.
      if (seen.loss !== null) {
        regret += Math.min(seen.loss, ENGINE_CAP);
        const special = /spin|quad|perfect/i.test(ev.action || "") || ev.pc;
        if (seen.loss >= ENGINE_GRADES.inaccuracy && !special) {
          const b = seen.best;
          const bf = features(seen.line[0].matrix);
          const text =
            b.tspin && b.cleared && !/spin/i.test(ev.action || "")
              ? [b.cleared >= 3 ? "Missed a T-spin triple." : b.cleared === 2 ? "Missed a T-spin double." : "Missed a T-spin single.", {}]
              : b.cleared > cleared
                ? cleared === 0
                  ? ["Missed a chance to clear {b} lines.", { b: b.cleared }]
                  : ["Missed a bigger clear: {b} lines, not {a}.", { a: cleared, b: b.cleared }]
                : b.id !== id
                  ? ["{piece} was the piece to play here, keeping this one for later.", { piece: ID_LETTER[b.id] }]
                  : f.gaps > bf.gaps
                    ? bf.gaps === 0
                      ? ["Missed a chance to place it without a gap. {a} cells are covered now.", { a: f.gaps }]
                      : ["Missed a cleaner spot. {a} cells are covered now; it could have been {b}.", { a: f.gaps, b: bf.gaps }]
                    : ["The engine puts it elsewhere, which leaves it more to work with.", {}];
          found.push({
            step: i,
            kind: "macro",
            grade: seen.loss >= ENGINE_GRADES.blunder ? "blunder" : seen.loss >= ENGINE_GRADES.mistake ? "mistake" : "inaccuracy",
            weight: seen.loss / 20,
            text,
            best: { id: b.id, cells: b.cells },
            line: seen.line,
          });
        }
      }
    } else if (best) {
      // Macro: how much worse than the best straight drop.
      const loss = mine - best.cost;
      regret += Math.max(0, loss);
      const special = /spin|quad|perfect/i.test(ev.action || "") || ev.pc;
      if (loss >= 7 && !special) {
        // Worded as a verdict on the move, the way a game review reads: what was
        // missed, then the numbers. {a} is what happened, {b} the marked spot.
        const text =
          f.gaps > best.f.gaps
            ? best.f.gaps === 0
              ? ["Missed a chance to place it without a gap. {a} cells are covered now.", { a: f.gaps }]
              : ["Missed a cleaner spot. {a} cells are covered now; it could have been {b}.", { a: f.gaps, b: best.f.gaps }]
            : cleared < best.cleared
              ? cleared === 0
                ? ["Missed a chance to clear {b} lines.", { b: best.cleared }]
                : ["Missed a bigger clear: {b} lines, not {a}.", { a: cleared, b: best.cleared }]
              : f.top > best.f.top
                ? ["Missed a chance to keep the stack low: {a} rows now, {b} was possible.", { a: f.top, b: best.f.top }]
                : ["Missed a chance to keep the surface flat.", {}];
        found.push({ step: i, kind: "macro", grade: loss >= 22 ? "blunder" : loss >= 14 ? "mistake" : "inaccuracy", weight: loss, text, best: { id, cells: best.cells } });
      } else if (loss <= -6) {
        found.push({ step: i, kind: "macro", grade: "brilliant", weight: -loss, text: ["Found a spot no straight drop reaches. It beats every one of them.", {}] });
      }
    }
    // Battle: a T-spin double or triple that was there and not taken. (In a
    // Sprint it would only cost time, so it is not held against the player.)
    if (!seen && mode === "battle" && id === 2 && !/spin/i.test(ev.action || "")) {
      const spin = tSpins(before)
        .filter((c) => !c.mini && c.cleared >= 2)
        .sort((p, q) => q.cleared - p.cleared)[0];
      if (spin) {
        found.push({
          step: i,
          kind: "macro",
          grade: "mistake",
          // Heavier than any stacking slip on the same move: this is the point to make.
          weight: 60 + 5 * spin.cleared,
          text: [spin.cleared >= 3 ? "Missed a T-spin triple." : "Missed a T-spin double.", {}],
          best: { id, cells: spin.cells },
          // "Show best" starts from the spin itself, which no straight drop makes.
          first: { id, cells: spin.cells, cleared: spin.cleared, matrix: spin.matrix, placed: paint(before, id, spin.cells) },
        });
      }
    }
    // Strong clears are worth a look too.
    if (/quad|spin/i.test(ev.action || "") || ev.pc) {
      found.push({ step: i, kind: "macro", grade: ev.pc ? "brilliant" : "good", weight: (ev.pc ? 30 : 12) + (ev.b2b ? 4 : 0), text: [ev.b2b ? "{action}, back-to-back. The chain holds." : "{action}. Well set up.", { action: ev.pc ? "Perfect clear" : ev.action }] });
    }
    // Finesse: wasted key presses.
    if (ev.finesseFault >= 2) {
      found.push({ step: i, kind: "finesse", grade: "waste", weight: ev.finesseFault * 3, text: ["{a} key presses. {b} would have done it.", { a: ev.keys, b: ev.optimal }] });
    }

    if (i % 40 === 0) {
      onProgress(i / events.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Dexterity: pace, and the pieces that took far longer than usual.
  const gapsT = places.map((p) => p.dt).filter((d) => d !== null);
  const usual = median(gapsT);
  for (const p of places) {
    if (p.dt !== null && usual > 0 && p.dt > Math.max(3 * usual, usual + 0.8)) {
      found.push({ step: p.i, kind: "dexterity", grade: "slow", weight: (p.dt / usual) * 3, text: ["{a}s on this piece. You usually take {b}s.", { a: p.dt.toFixed(2), b: usual.toFixed(2) }] });
    }
  }

  const total = places.length ? places[places.length - 1].ev.t : 0;
  const keys = places.reduce((n, p) => n + (p.ev.keys || 0), 0);
  const scored = places.filter((p) => p.ev.optimal > 0);
  const need = scored.reduce((n, p) => n + p.ev.optimal, 0);
  const used = scored.reduce((n, p) => n + Math.max(p.ev.keys, p.ev.optimal), 0);
  const pps = total > 0 ? places.length / total : 0;

  // The moments shown: the heaviest of each kind, at most ten, in play order.
  const pick = (kind, grades, n) =>
    found
      .filter((m) => m.kind === kind && grades.includes(m.grade))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, n);
  const chosen = new Map();
  for (const m of [
    ...pick("macro", ["blunder", "mistake", "inaccuracy"], 5),
    ...pick("finesse", ["waste"], 2),
    ...pick("dexterity", ["slow"], 2),
    ...pick("macro", ["brilliant", "good"], 2),
  ]) {
    const had = chosen.get(m.step);
    if (!had || had.weight < m.weight) chosen.set(m.step, m);
  }
  const moments = [...chosen.values()].sort((a, b) => a.step - b.step).slice(0, 10);

  onProgress(1);
  return {
    scores: {
      macro: places.length ? round(100 * Math.exp(-regret / places.length / (engine ? ENGINE_SCALE : 5))) : 0,
      dexterity: round(100 * (1 - Math.exp(-pps / 1.5))),
      finesse: used ? round((100 * need) / used) : 100,
    },
    engine: !!engine,
    facts: { pps, kps: total > 0 ? keys / total : 0, usual, pieces: places.length },
    moments,
  };
}

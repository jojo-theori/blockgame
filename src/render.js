// ─── CANVAS RENDERING ───
// Flat cells, hairline grid, no bevels. Canvases are sized for the device
// pixel ratio so the board stays crisp on retina screens.

import { COLS, ROWS, CELL, COLORS, getShape } from "./game.js";

export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;

// Prepare a canvas for drawing at CSS size w×h; returns a 2D context in CSS px.
export function prep(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

// ─── Block skins ───
// How one cell of a piece is painted. All of them are drawn from the piece's
// colour (no image files), so they follow any colour the game uses.
export const SKINS = ["flat", "bevel", "gloss", "outline", "inset"];
let skin = "flat";
export function setSkin(name) {
  skin = SKINS.includes(name) ? name : "flat";
}
// The thin gap between neighbouring cells. Off, cells meet edge to edge and a
// piece reads as one shape.
let gaps = true;
// Board colours per page theme.
const TONES = {
  dark: { bg: "#050505", grid: "#141414", mark: "#ebebeb", dead: "#333", block: "#2a2a2a", meter: "#141414", charge: "rgba(235, 235, 235, 0.28)" },
  light: { bg: "#fbfbfa", grid: "#e8e8e5", mark: "#161616", dead: "#c6c6c2", block: "#d0d0cc", meter: "#e2e2df", charge: "rgba(22, 22, 22, 0.25)" },
};
let tone = TONES.dark;
export function setBoardTheme(name) { tone = TONES[name] || TONES.dark; }
export function boardTone() { return tone; }
export function setCellLines(on) {
  gaps = !!on;
}
// Orientation mark: on pieces that look the same after a turn (I, S, Z, O),
// one cell of the falling piece is drawn darker, so its rotation state shows.
let orientMark = false;
export function setOrientMark(on) {
  orientMark = !!on;
}
const O_MARK = [[0, 1], [0, 2], [1, 2], [1, 1]]; // O doesn't move in its box
function markCell(id, rot) {
  if (id === 7) return O_MARK[rot % 4];
  if (id !== 1 && id !== 5 && id !== 6) return null;
  const s0 = getShape(id, 0);
  const n = s0.length;
  let pos = null;
  for (let r = 0; r < n && !pos; r++) for (let c = 0; c < n; c++) if (s0[r][c]) { pos = [r, c]; break; }
  // Follow that cell as the box turns clockwise.
  for (let k = 0; k < rot % 4; k++) pos = [pos[1], n - 1 - pos[0]];
  return getShape(id, rot)[pos[0]]?.[pos[1]] ? pos : null;
}

// A colour moved towards white (amount > 0) or black (amount < 0), 0..1.
function shade(color, amount) {
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const to = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const ch = [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + to * k));
  return `rgb(${ch.join(",")})`;
}

// One cell. `as` paints it in a given skin (the settings previews); see-through
// cells (guides, hints) are always flat, whatever the skin.
export function cell(ctx, x, y, size, color, alpha = 1, as, lines = gaps) {
  ctx.globalAlpha = alpha;
  const [l, t, s] = lines ? [x + 0.5, y + 0.5, size - 1] : [x, y, size];
  // Faint cells (guides) stay flat unless a skin is asked for by name.
  const style = as ?? (alpha < 0.8 ? "flat" : skin);
  ctx.fillStyle = color;
  if (style === "bevel") {
    // Lit from the top left: light top and left edges, dark bottom and right.
    const b = Math.max(2, Math.round(s * 0.16));
    ctx.fillRect(l, t, s, s);
    ctx.fillStyle = shade(color, 0.38);
    ctx.beginPath();
    ctx.moveTo(l, t);
    ctx.lineTo(l + s, t);
    ctx.lineTo(l + s - b, t + b);
    ctx.lineTo(l + b, t + b);
    ctx.lineTo(l + b, t + s - b);
    ctx.lineTo(l, t + s);
    ctx.fill();
    ctx.fillStyle = shade(color, -0.4);
    ctx.beginPath();
    ctx.moveTo(l + s, t + s);
    ctx.lineTo(l, t + s);
    ctx.lineTo(l + b, t + s - b);
    ctx.lineTo(l + s - b, t + s - b);
    ctx.lineTo(l + s - b, t + b);
    ctx.lineTo(l + s, t);
    ctx.fill();
  } else if (style === "gloss") {
    // A soft top-to-bottom fall-off with a bright band across the top.
    const g = ctx.createLinearGradient(0, t, 0, t + s);
    g.addColorStop(0, shade(color, 0.3));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -0.32));
    ctx.fillStyle = g;
    ctx.fillRect(l, t, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(l + 1, t + 1, s - 2, Math.max(2, Math.round(s * 0.2)));
  } else if (style === "outline") {
    // A dark body inside a rim of the piece's colour.
    const w = Math.max(2, Math.round(s * 0.12));
    ctx.fillRect(l, t, s, s);
    ctx.fillStyle = shade(color, -0.72);
    ctx.fillRect(l + w, t + w, s - 2 * w, s - 2 * w);
  } else if (style === "inset") {
    // A lighter square set into a darker frame.
    const w = Math.max(3, Math.round(s * 0.2));
    ctx.fillStyle = shade(color, -0.28);
    ctx.fillRect(l, t, s, s);
    ctx.fillStyle = shade(color, 0.2);
    ctx.fillRect(l + w, t + w, s - 2 * w, s - 2 * w);
  } else {
    ctx.fillRect(l, t, s, s);
  }
  ctx.globalAlpha = 1;
}

// The ghost: the skinned cell, faded as a whole. It is painted opaque on a
// scratch canvas first, since a skin's layers overlap and would otherwise
// blend into one flat tone.
let scratch = null;
function ghost(ctx, x, y, size, color, alpha = 0.35) {
  const dpr = window.devicePixelRatio || 1;
  scratch ||= document.createElement("canvas");
  const px = Math.round(size * dpr);
  if (scratch.width !== px) scratch.width = scratch.height = px;
  const sctx = scratch.getContext("2d");
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, size, size);
  cell(sctx, 0, 0, size, color, 1, skin);
  ctx.globalAlpha = alpha;
  ctx.drawImage(scratch, x, y, size, size);
  ctx.globalAlpha = 1;
}

function outline(ctx, x, y, size, color, alpha = 1, inset = 1.5) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
  ctx.globalAlpha = 1;
}

// Draw the playfield. opts.guide: ROWS×COLS array of piece ids (0 = none) drawn
// as faint outlines; opts.reject: [[r,c]...] cells flashed red; opts.dead greys out.
export function drawBoard(canvas, engine, opts = {}) {
  if (!canvas) return;
  const ctx = prep(canvas, BOARD_W, BOARD_H);

  ctx.fillStyle = tone.bg;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  // hairline grid
  ctx.strokeStyle = tone.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(BOARD_W, r * CELL + 0.5);
  }
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, BOARD_H);
  }
  ctx.stroke();

  if (!engine) return;

  // guide (target shape)
  if (opts.guide) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = opts.guide[r][c];
        if (id && engine.matrix[r][c] === 0) {
          cell(ctx, c * CELL, r * CELL, CELL, COLORS[id], 0.12);
          outline(ctx, c * CELL, r * CELL, CELL, COLORS[id], 0.55);
        }
      }
    }
  }

  // focus: the cells the current piece should go to (the solution's next move)
  if (opts.focus) {
    const color = COLORS[opts.focus.id];
    for (const [r, c] of opts.focus.cells) {
      if (engine.matrix[r]?.[c]) continue;
      cell(ctx, c * CELL, r * CELL, CELL, color, 0.32);
      outline(ctx, c * CELL, r * CELL, CELL, color, 1);
    }
  }

  const dead = opts.dead;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = engine.matrix[r][c];
      if (v) cell(ctx, c * CELL, r * CELL, CELL, dead ? tone.dead : COLORS[v]);
    }
  }

  if (engine.currentId && (engine.playing || engine.completed || engine.gameOver)) {
    const shape = getShape(engine.currentId, engine.currentRot);
    const color = COLORS[engine.currentId];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape.length; c++) {
        if (!shape[r][c]) continue;
        const gy = engine.ghostY + r;
        if (gy >= 0) ghost(ctx, (engine.currentX + c) * CELL, gy * CELL, CELL, color);
      }
    }
    if (engine.playing) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape.length; c++) {
          if (!shape[r][c]) continue;
          const py = engine.currentY + r;
          if (py >= 0) cell(ctx, (engine.currentX + c) * CELL, py * CELL, CELL, color);
        }
      }
      const m = orientMark && markCell(engine.currentId, engine.currentRot);
      if (m && engine.currentY + m[0] >= 0) {
        const g = gaps ? 1 : 0;
        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
        ctx.fillRect((engine.currentX + m[1]) * CELL + g, (engine.currentY + m[0]) * CELL + g, CELL - 2 * g, CELL - 2 * g);
      }
    }
  }

  // mark: cells ringed in the text colour (the newest piece of a shown line)
  if (opts.mark) {
    for (const [r, c] of opts.mark) {
      if (r >= 0) outline(ctx, c * CELL, r * CELL, CELL, tone.mark, 0.9, 1);
    }
  }

  if (opts.reject) {
    for (const [r, c] of opts.reject.cells) {
      if (r < 0) continue;
      outline(ctx, c * CELL, r * CELL, CELL, "#e8505b", opts.reject.alpha, 1);
    }
  }
}

// Mini piece centred in a 4×2 box at (ox, oy).
export function drawMini(ctx, id, ox, oy, size, alpha = 1) {
  const shape = getShape(id, 0);
  const filled = [];
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape.length; c++) if (shape[r][c]) filled.push([r, c]);
  const minR = Math.min(...filled.map((f) => f[0]));
  const maxR = Math.max(...filled.map((f) => f[0]));
  const minC = Math.min(...filled.map((f) => f[1]));
  const maxC = Math.max(...filled.map((f) => f[1]));
  const w = maxC - minC + 1;
  const h = maxR - minR + 1;
  const offX = ox + ((4 - w) * size) / 2 - minC * size;
  const offY = oy + ((2 - h) * size) / 2 - minR * size;
  for (const [r, c] of filled) cell(ctx, offX + c * size, offY + r * size, size, COLORS[id], alpha);
}

// Hold and queue pieces are drawn at the board's own cell size, so the queue
// reads at a glance while the eyes stay on the board.
export const MINI = CELL;
export const HOLD_W = 4 * MINI + 8;
export const HOLD_H = 2 * MINI + 8;
export const SLOT = 2 * MINI + 16;

export function drawHold(canvas, id, used = false) {
  if (!canvas) return;
  const ctx = prep(canvas, HOLD_W, HOLD_H);
  if (id) drawMini(ctx, id, 4, 4, MINI, used ? 0.3 : 1);
}

// slot: height each piece takes (a tighter one where the column is crowded).
export function drawQueue(canvas, queue, n = 5, slot = SLOT) {
  if (!canvas) return;
  const ctx = prep(canvas, HOLD_W, slot * n);
  for (let i = 0; i < Math.min(n, queue.length); i++) {
    drawMini(ctx, queue[i], 4, 4 + i * slot, MINI, i === 0 ? 1 : 0.85);
  }
}

// Empty board, hold and queue: what the countdown shows before a run starts.
export function clearPlayfield(board, hold, queue) {
  drawBoard(board, null);
  if (hold) prep(hold, HOLD_W, HOLD_H);
  if (queue) prep(queue, HOLD_W, queue.height / (window.devicePixelRatio || 1));
}

// Small static board picture (used for opener previews). grid: rows of ids.
export function drawPicture(canvas, grid, size = 12) {
  if (!canvas) return;
  const rows = grid.length;
  const ctx = prep(canvas, COLS * size, rows * size);
  ctx.fillStyle = tone.bg;
  ctx.fillRect(0, 0, COLS * size, rows * size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = grid[r][c];
      if (v === -1) cell(ctx, c * size, r * size, size, tone.block);
      else if (v) cell(ctx, c * size, r * size, size, COLORS[v]);
    }
  }
}

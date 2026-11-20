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

export function cell(ctx, x, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x + 0.5, y + 0.5, size - 1, size - 1);
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

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  // hairline grid
  ctx.strokeStyle = "#141414";
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
      if (v) cell(ctx, c * CELL, r * CELL, CELL, dead ? "#333" : COLORS[v]);
    }
  }

  if (engine.currentId && (engine.playing || engine.completed || engine.gameOver)) {
    const shape = getShape(engine.currentId, engine.currentRot);
    const color = COLORS[engine.currentId];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape.length; c++) {
        if (!shape[r][c]) continue;
        const gy = engine.ghostY + r;
        if (gy >= 0) outline(ctx, (engine.currentX + c) * CELL, gy * CELL, CELL, color, 0.6);
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

export const MINI = 16;
export const HOLD_W = 4 * MINI + 8;
export const HOLD_H = 2 * MINI + 8;
export const SLOT = 2 * MINI + 18;

export function drawHold(canvas, id, used = false) {
  if (!canvas) return;
  const ctx = prep(canvas, HOLD_W, HOLD_H);
  if (id) drawMini(ctx, id, 4, 4, MINI, used ? 0.3 : 1);
}

export function drawQueue(canvas, queue, n = 5) {
  if (!canvas) return;
  const ctx = prep(canvas, HOLD_W, SLOT * n);
  for (let i = 0; i < Math.min(n, queue.length); i++) {
    drawMini(ctx, queue[i], 4, 4 + i * SLOT, MINI, i === 0 ? 1 : 0.85);
  }
}

// Small static board picture (used for opener previews). grid: rows of ids.
export function drawPicture(canvas, grid, size = 12) {
  if (!canvas) return;
  const rows = grid.length;
  const ctx = prep(canvas, COLS * size, rows * size);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, COLS * size, rows * size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = grid[r][c];
      if (v === -1) cell(ctx, c * size, r * size, size, "#2a2a2a");
      else if (v) cell(ctx, c * size, r * size, size, COLORS[v]);
    }
  }
}

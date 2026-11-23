// Drawing single blocks and small previews on a canvas.
import { CELL, COLORS, getShape } from "./pieces.js";

export function drawBlock(ctx, x, y, colorId, alpha = 1, isGhost = false) {
  const color = COLORS[colorId] || "#333";
  const px = x * CELL;
  const py = y * CELL;
  if (isGhost) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = color;
    ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, CELL, CELL);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px, py, CELL, 2);
  ctx.fillRect(px, py, 2, CELL);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(px, py + CELL - 2, CELL, 2);
  ctx.fillRect(px + CELL - 2, py, 2, CELL);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
  ctx.globalAlpha = 1;
}

export function drawMiniBlock(ctx, x, y, colorId, size = 14) {
  const color = COLORS[colorId] || "#333";
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, y, size, 1);
  ctx.fillRect(x, y, 1, size);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

export function drawPiecePreview(ctx, id, ox, oy, cellSize = 14) {
  const shape = getShape(id, 0);
  const size = shape.length;
  const filled = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (shape[r][c]) filled.push([r, c]);
  const minR = Math.min(...filled.map((f) => f[0]));
  const maxR = Math.max(...filled.map((f) => f[0]));
  const minC = Math.min(...filled.map((f) => f[1]));
  const maxC = Math.max(...filled.map((f) => f[1]));
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;
  const offX =
    ox + (4 * cellSize - w * cellSize) / 2 - minC * cellSize;
  const offY =
    oy + (2 * cellSize - h * cellSize) / 2 - minR * cellSize;

  for (const [r, c] of filled) {
    drawMiniBlock(
      ctx,
      offX + c * cellSize,
      offY + r * cellSize,
      id,
      cellSize,
    );
  }
}

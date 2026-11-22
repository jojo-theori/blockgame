// Small pictures of pieces and cells.
import { getShape, COLORS, PIECE_NAMES } from "../game.js";

// A piece drawn small in its own colour and spawn shape, used wherever a piece
// is named (chips, lists, logs) instead of its letter. size = one cell in px.
// Cells meet edge to edge with square corners, so it reads as one shape.
const LETTER_TO_ID = { I: 1, T: 2, L: 3, J: 4, S: 5, Z: 6, O: 7 };

// rot: the rotation to draw it in (0 as it spawns).
export function PieceIcon({ id, type, size = 5, gap = 0, rot = 0 }) {
  const pid = id ?? LETTER_TO_ID[type];
  if (!pid) return null;
  const shape = getShape(pid, rot);
  const cells = [];
  shape.forEach((row, r) => row.forEach((v, c) => v && cells.push([r, c])));
  const r0 = Math.min(...cells.map(([r]) => r));
  const c0 = Math.min(...cells.map(([, c]) => c));
  const w = Math.max(...cells.map(([, c]) => c)) - c0 + 1;
  const h = Math.max(...cells.map(([r]) => r)) - r0 + 1;
  const step = size + gap;
  return (
    <svg
      className="piece-icon"
      width={w * step - gap}
      height={h * step - gap}
      viewBox={`0 0 ${w * step - gap} ${h * step - gap}`}
      role="img"
      aria-label={PIECE_NAMES[pid]}
    >
      {cells.map(([r, c]) => (
        <rect key={r * 10 + c} x={(c - c0) * step} y={(r - r0) * step} width={size} height={size} fill={COLORS[pid]} shapeRendering="crispEdges" />
      ))}
    </svg>
  );
}

// A garbage row: grey cells with one gap (the hole), drawn like PieceIcon.
export function GarbageIcon({ size = 5, cells = 6, hole = 3 }) {
  const w = cells * size;
  return (
    <svg className="piece-icon" width={w} height={size} viewBox={`0 0 ${w} ${size}`} role="img" aria-label="Garbage row">
      {Array.from({ length: cells }, (_, c) => (c === hole ? null : <rect key={c} x={c * size} y={0} width={size} height={size} fill={COLORS[8]} shapeRendering="crispEdges" />))}
    </svg>
  );
}

// One cell's colour, for picking a paint colour.
export function Swatch({ color, size = 10 }) {
  return <i className="swatch" style={{ background: color, width: size, height: size }} />;
}

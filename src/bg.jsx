import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "./game.js";
import { sfx } from "./sound.js";

// ─── Page background: a fine grid with a few solid pieces on it ───
// The pieces are part of the grid layer (same colour, whole cells, far apart)
// and drift with it. Under the mouse a piece lights up in its own colour;
// clicked, it drops out of the grid and falls to the foot of the window.
const CELL = 14;
const COLS = 30; // one tile of pieces, in cells
const ROWS = 15;
const PIECES = [
  { id: 2, cells: [[3, 2], [4, 2], [5, 2], [4, 3]] }, // T
  { id: 3, cells: [[14, 5], [14, 6], [14, 7], [15, 7]] }, // L
  { id: 5, cells: [[24, 1], [25, 1], [23, 2], [24, 2]] }, // S
  { id: 7, cells: [[8, 10], [9, 10], [8, 11], [9, 11]] }, // O
  { id: 4, cells: [[20, 11], [20, 12], [21, 12], [22, 12]] }, // J
  { id: 1, cells: [[27, 6], [27, 7], [27, 8], [27, 9]] }, // I
];
// Lighting a piece under the mouse and dropping it on a click. Off for now:
// it cost frames and got in the way. Set to true to bring both back.
const INTERACTIVE = false;
const GRAVITY = 3200; // px/s², for a clicked piece
const REST_MS = 2600; // how long it lies at the bottom before fading
const FADE_MS = 500;
const AT = new Map(PIECES.flatMap((p, n) => p.cells.map(([x, y]) => [`${x},${y}`, n])));

// A piece as overlapping runs of cells, so no seam shows between its cells.
function runs(cells) {
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  const out = [];
  for (const [x, y] of cells) {
    if (!has.has(`${x - 1},${y}`)) {
      let n = 1;
      while (has.has(`${x + n},${y}`)) n++;
      out.push([x, y, n, 1]);
    }
    if (!has.has(`${x},${y - 1}`)) {
      let n = 1;
      while (has.has(`${x},${y + n}`)) n++;
      if (n > 1) out.push([x, y, 1, n]);
    }
  }
  return out;
}
const RUNS = PIECES.map((p) => runs(p.cells));

function tile(color) {
  const rects = RUNS.flat()
    .map(([x, y, w, h]) => `<rect x='${x * CELL}' y='${y * CELL}' width='${w * CELL}' height='${h * CELL}'/>`)
    .join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${COLS * CELL}' height='${ROWS * CELL}' fill='${color}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function Background({ theme }) {
  const gridRef = useRef(null);
  const glowRef = useRef(null);
  const [lit, setLit] = useState(null); // { piece, col, row }: which copy of which piece
  const [shown, setShown] = useState(null); // stays while it fades out
  // Pieces knocked loose by a click: { key, piece, col, row, x, y, t0 }. Each
  // falls from where it was, lands, rests, fades; its place in the grid stays
  // empty (a patch of plain grid over it) until then.
  const [drops, setDrops] = useState([]);
  const dropEls = useRef(new Map()); // key → { piece: svg, hole: svg }
  const litRef = useRef(null);
  const minos = useMemo(() => tile(theme === "light" ? "#000" : "#fff"), [theme]);

  // Where the drifting layer is right now, in px.
  const offset = () => {
    const [x, y] = getComputedStyle(gridRef.current).backgroundPosition.split(",")[0].trim().split(/\s+/).map(parseFloat);
    return [x || 0, y || 0];
  };

  useEffect(() => {
    if (!INTERACTIVE) return;
    const onMove = (e) => {
      // Only the bare background counts: not when something is in the way.
      const free = !(e.target instanceof Element) || !e.target.closest("button, a, input, textarea, canvas, .veil, .dialog, .lab-side, .rlog");
      let hit = null;
      if (free && gridRef.current) {
        const [ox, oy] = offset();
        const cx = Math.floor((e.clientX - ox) / CELL);
        const cy = Math.floor((e.clientY - oy) / CELL);
        const piece = AT.get(`${((cx % COLS) + COLS) % COLS},${((cy % ROWS) + ROWS) % ROWS}`);
        if (piece !== undefined) hit = { piece, col: Math.floor(cx / COLS), row: Math.floor(cy / ROWS) };
      }
      const same = (was) => (was?.piece === hit?.piece && was?.col === hit?.col && was?.row === hit?.row ? was : hit);
      litRef.current = hit;
      setLit(same);
      if (hit) setShown(same); // the last one lit stays up while it fades
    };
    // A click on a piece knocks it loose.
    const onDown = (e) => {
      onMove(e);
      const hit = litRef.current;
      if (!hit || e.button !== 0) return;
      const [ox, oy] = offset();
      const key = `${hit.piece}:${hit.col}:${hit.row}`;
      setDrops((list) =>
        list.some((d) => d.key === key)
          ? list
          : [...list, { ...hit, key, x: ox + hit.col * COLS * CELL, y: oy + hit.row * ROWS * CELL, t0: performance.now() }],
      );
      litRef.current = null;
      setLit(null);
    };
    const onLeave = () => setLit(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // The glow rides along with the drift for as long as it is up.
  useEffect(() => {
    if (!shown) return;
    let raf;
    const follow = () => {
      const el = glowRef.current;
      if (el && gridRef.current) {
        const [ox, oy] = offset();
        el.style.transform = `translate(${ox + shown.col * COLS * CELL}px, ${oy + shown.row * ROWS * CELL}px)`;
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [shown]);

  // Falling: constant acceleration down to the window's foot, then rest and
  // fade. The patch over its old place keeps drifting with the grid.
  useEffect(() => {
    if (!drops.length) return;
    let raf;
    const step = (now) => {
      const [ox, oy] = offset();
      const done = [];
      for (const d of drops) {
        const els = dropEls.current.get(d.key);
        if (!els?.piece || !els.hole) continue;
        const bottom = (Math.max(...PIECES[d.piece].cells.map(([, y]) => y)) + 1) * CELL;
        const floor = window.innerHeight - bottom;
        const t = (now - d.t0) / 1000;
        const y = d.y + 0.5 * GRAVITY * t * t;
        const landed = y >= floor;
        if (landed && !d.landedAt) {
          d.landedAt = now;
          sfx.drop();
        }
        els.piece.style.transform = `translate(${d.x}px, ${landed ? floor : y}px)`;
        els.piece.classList.toggle("landed", landed);
        if (landed) {
          const age = now - d.landedAt;
          els.piece.style.opacity = age < REST_MS ? "" : String(Math.max(0, 1 - (age - REST_MS) / FADE_MS) * 0.5);
          if (age >= REST_MS + FADE_MS) done.push(d.key);
        }
        els.hole.style.transform = `translate(${ox + d.col * COLS * CELL}px, ${oy + d.row * ROWS * CELL}px)`;
      }
      if (done.length) setDrops((list) => list.filter((d) => !done.includes(d.key)));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [drops]);
  // Keeps each drop's two elements. React clears and sets these again on every
  // render, so one part going away must not take the other with it.
  const hold = (key, part) => (el) => {
    const entry = dropEls.current.get(key) || {};
    if (el) entry[part] = el;
    else delete entry[part];
    if (entry.piece || entry.hole) dropEls.current.set(key, entry);
    else dropEls.current.delete(key);
  };

  const color = shown ? COLORS[PIECES[shown.piece].id] : null;
  return (
    <>
      <div ref={gridRef} className="bg-grid" style={{ "--minos": minos }} />
      {drops.map((d) => (
        <svg key={"hole" + d.key} ref={hold(d.key, "hole")} className="bg-hole" width={COLS * CELL} height={ROWS * CELL} aria-hidden="true">
          {/* Plain grid where the piece was: page colour, then the cell lines. */}
          {RUNS[d.piece].map(([x, y, w, h], n) => (
            <rect key={n} className="fill" x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
          ))}
          {PIECES[d.piece].cells.map(([x, y], n) => (
            <path key={n} className="lines" d={`M${x * CELL} ${y * CELL + 0.5}h${CELL}M${x * CELL + 0.5} ${y * CELL}v${CELL}`} />
          ))}
        </svg>
      ))}
      {drops.map((d) => (
        <svg
          key={"drop" + d.key}
          ref={hold(d.key, "piece")}
          className="bg-drop"
          width={COLS * CELL}
          height={ROWS * CELL}
          style={{ color: COLORS[PIECES[d.piece].id], transform: `translate(${d.x}px, ${d.y}px)` }}
          aria-hidden="true"
        >
          <g>
            {RUNS[d.piece].map(([x, y, w, h], n) => (
              <rect key={n} x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
            ))}
          </g>
        </svg>
      ))}
      {shown && (
        <svg
          ref={glowRef}
          className={"bg-glow" + (lit ? " on" : "")}
          width={COLS * CELL}
          height={ROWS * CELL}
          style={{ color }}
          aria-hidden="true"
          onTransitionEnd={() => !lit && setShown(null)}
        >
          {RUNS[shown.piece].map(([x, y, w, h], n) => (
            <rect key={n} x={x * CELL} y={y * CELL} width={w * CELL} height={h * CELL} />
          ))}
        </svg>
      )}
    </>
  );
}

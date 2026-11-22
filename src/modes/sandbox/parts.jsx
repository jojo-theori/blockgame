// Small pictures used by the Sandbox screens.
import { useEffect, useRef } from "react";
import { COLS, ROWS } from "../../game.js";
import { drawPicture } from "../../render.js";
import { ERASE_LIT } from "./store.js";

export function EraseIcon({ mode }) {
  const lit = ERASE_LIT[mode];
  return (
    <svg className="erase-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={(i % 3) * 5} y={Math.floor(i / 3) * 5} width="4" height="4" fill="currentColor" opacity={lit.includes(i) ? 1 : 0.22} />
      ))}
    </svg>
  );
}

// A board's small picture for the list.
export function Preview({ board }) {
  const ref = useRef(null);
  useEffect(() => {
    drawPicture(ref.current, board, 9);
  }, [board]);
  return <canvas ref={ref} className="sb-thumb" width={COLS * 9} height={ROWS * 9} />;
}

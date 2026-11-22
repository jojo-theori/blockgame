// The three tools of the Sandbox editor, as pictures.

// The two ways to draw, as pictures: a whole piece, or one cell at a time.
export const DRAW_ICONS = {
  piece: (
    <svg className="sb-draw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="12" width="5.2" height="5.2" rx="0.8" />
      <rect x="9.4" y="12" width="5.2" height="5.2" rx="0.8" />
      <rect x="15.3" y="12" width="5.2" height="5.2" rx="0.8" />
      <rect x="9.4" y="6.1" width="5.2" height="5.2" rx="0.8" />
    </svg>
  ),
  cell: (
    <svg className="sb-draw-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1" />
    </svg>
  ),
  erase: (
    <svg className="sb-draw-icon line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 20h12M5.5 15.5l9-9a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L12 17l-3 3H7l-1.5-1.5a2 2 0 0 1 0-3Z" />
      <path d="M9.5 11.5l4 4" />
    </svg>
  ),
};

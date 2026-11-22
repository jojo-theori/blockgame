// The three tools of the Sandbox editor, as pictures.
import { Icon } from "../../ui.jsx";

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
  erase: <Icon name="empty" size={17} />,
};

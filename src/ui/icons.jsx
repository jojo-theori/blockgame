// The line icons the app draws, by name. One place, one stroke: use
// <Icon name="…" /> and do not paste an <svg> into a screen.
import { PATHS } from "./iconPaths.jsx";

export function Icon({ name, size = 16 }) {
  return (
    <svg className="ds-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

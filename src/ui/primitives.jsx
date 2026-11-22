// The small parts screens are built from. Reach for these before writing a
// new button or box: they carry the sizes, the hover and the focus ring.
import { t } from "../i18n.js";
import { Icon } from "./icons.jsx";

// A round button holding one icon. label names it (tooltip and screen
// reader). size: "s" 32px, "m" 40px. filled: sits on a soft fill.
// danger: goes red under the pointer. lead: the one main action, reversed.
export function IconButton({ icon, label, size = "s", filled = false, danger = false, lead = false, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={"icon-btn " + size + (filled ? " filled" : "") + (danger ? " danger" : "") + (lead ? " lead" : "") + (className ? " " + className : "")}
      title={t(label)}
      aria-label={t(label)}
      {...rest}
    >
      <Icon name={icon} size={size === "m" ? 17 : 16} />
    </button>
  );
}

// A pill that holds a picture or a word and can be chosen. on: the chosen one.
export function Chip({ on = false, danger = false, className = "", children, ...rest }) {
  return (
    <button type="button" className={"chip-btn" + (on ? " on" : "") + (danger ? " danger" : "") + (className ? " " + className : "")} {...rest}>
      {children}
    </button>
  );
}

// Chips in equal columns, so they line up in both directions.
export function ChipGrid({ cols = 4, className = "", children, ...rest }) {
  return (
    <div className={"chip-grid" + (className ? " " + className : "")} style={{ "--cols": cols }} {...rest}>
      {children}
    </div>
  );
}

// A soft box that holds things (a list of pieces, a note). hint: what it
// says, centred, while it has nothing in it.
export function Well({ hint, className = "", children, ...rest }) {
  const empty = !!hint;
  return (
    <div className={"well" + (empty ? " empty" : "") + (className ? " " + className : "")} {...rest}>
      {empty ? <p className="well-hint">{hint}</p> : children}
    </div>
  );
}

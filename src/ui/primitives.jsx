// The small parts screens are built from. Reach for these before writing a
// new button or box: they carry the sizes, the hover and the focus ring.
import { t } from "../i18n.js";
import { Icon } from "./icons.jsx";
import { Kbd } from "./keys.jsx";

// Every part below is described by a few props that do not depend on each
// other: any value of one goes with any value of the rest.
//   variant  how much it stands out (the surface it is drawn on)
//   tone     what it means ("danger" for something that removes)
//   size     how big it is
// The values are listed in variants.js, so the Components page can lay out every combination.
const cls = (...parts) => parts.filter(Boolean).join(" ");

// A button with a word on it.
//   variant  "primary" (the one main action), "secondary" (default), "ghost" (quiet)
//   tone     "neutral", "danger" (removes something), "accent" (the mode's colour)
//   size     "s" 34px, "m" 38px, "l" 40px
//   block    as wide as its place
//   icon     the name of an icon to lead with
export function Button({ variant = "secondary", tone = "neutral", size = "m", block = false, icon, className, children, ...rest }) {
  return (
    <button type="button" className={cls("btn", variant !== "secondary" && variant, tone !== "neutral" && "tone-" + tone, size !== "m" && "size-" + size, block && "block", className)} {...rest}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

// A round button holding one icon. label names it (tooltip and screen reader).
//   variant  "ghost" (clear, default), "filled" (on a soft fill), "lead" (the one main action, reversed)
//   tone     "neutral", "danger" (goes red under the pointer)
//   size     "s" 32px, "m" 40px
export function IconButton({ icon, label, variant = "ghost", tone = "neutral", size = "s", className, ...rest }) {
  return (
    <button type="button" className={cls("icon-btn", size, variant !== "ghost" && variant, tone !== "neutral" && "tone-" + tone, className)} title={t(label)} aria-label={t(label)} {...rest}>
      <Icon name={icon} size={size === "m" ? 17 : 16} />
    </button>
  );
}

// What a control is, and the keys that reach it, shown above it while the
// pointer is on it. Goes inside the control (which takes the class "has-tip");
// Chip and Segmented do that themselves when given `tip` / `keys`.
export function Tip({ label, keys = [] }) {
  return (
    <span className="tip-body" role="tooltip">
      {label && <span>{label}</span>}
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}

// A pill that holds a picture or a word and can be chosen.
//   on    the chosen one
//   tone  "neutral", "danger" (goes red under the pointer)
//   tip   its name, shown on hover (and read out); keys: the keys that pick it
export function Chip({ on = false, tone = "neutral", tip, keys, className, children, ...rest }) {
  const hinted = !!(tip || keys);
  return (
    <button type="button" className={cls("chip-btn", on && "on", tone !== "neutral" && "tone-" + tone, hinted && "has-tip", className)} aria-label={tip} {...rest}>
      {children}
      {hinted && <Tip label={tip} keys={keys} />}
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

// A small question mark; what it explains shows while the pointer (or the
// keyboard focus) is on it. label names the button for a screen reader.
export function HelpTip({ label, className, children }) {
  return (
    <span className={cls("help-tip", className)}>
      <button type="button" aria-label={t(label)}>
        <Icon name="help" size={16} />
      </button>
      <span className="help-tip-body" role="tooltip">
        {children}
      </span>
    </span>
  );
}

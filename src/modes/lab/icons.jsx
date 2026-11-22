// Icons of the replay screen: transport buttons, the three kinds of score, the grade marks.
import { t } from "../../i18n.js";

// Transport and navigation icons. Chevrons step, the triangle plays.
const ICONS = {
  first: <path d="M17 6.5 11.5 12l5.5 5.5M7.5 6.5v11" />,
  prev: <path d="M14.5 6.5 9 12l5.5 5.5" />,
  next: <path d="M9.5 6.5 15 12l-5.5 5.5" />,
  last: <path d="M7 6.5 12.5 12 7 17.5M16.5 6.5v11" />,
  back: <path d="M11 6.5 5.5 12l5.5 5.5M6 12h12.5" />,
  close: <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />,
  play: <path className="solid" d="M8.5 5.5v13l10-6.5z" />,
  pause: <path className="solid" d="M8 5.5h2.5v13H8zM13.5 5.5H16v13h-2.5z" />,
};

// main: the filled, reversed one (play); round: a quiet filled circle (close).
export function IconButton({ icon, label, main, round, ...rest }) {
  return (
    <button type="button" className={"lab-icon" + (main ? " lead" : "") + (round ? " round" : "")} title={t(label)} aria-label={t(label)} {...rest}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[icon]}
      </svg>
    </button>
  );
}

// One picture per thing scored, used beside its score and on the comments
// about it: a brain for macro (planning the stack), a bolt for dexterity
// (speed), a target for finesse (exact, with nothing wasted).
const KIND_ICONS = {
  // Brain outline, after the Lucide icon set (ISC licence).
  macro: (
    <>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    </>
  ),
  dexterity: <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />,
  // A target with an arrow in its centre: the fewest inputs, placed exactly.
  finesse: (
    <>
      <circle cx="10.5" cy="13.5" r="7.5" />
      <circle cx="10.5" cy="13.5" r="3" />
      <path d="M10.5 13.5 20.5 3.5M16.5 3.5h4v4" />
    </>
  ),
};

export function KindIcon({ kind }) {
  return (
    <svg className={"lab-kind-icon " + kind} viewBox="0 0 24 24" aria-hidden="true">
      {KIND_ICONS[kind]}
    </svg>
  );
}

// The mark of a grade: a filled circle in one of the piece colours, with the
// annotation sign (as in chess reviews) or a small picture.
const GRADE_ICONS = {
  brilliant: "!!",
  good: <path className="solid" d="M12 4.2l2.3 4.9 5.3.7-3.9 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3-3.9-3.7 5.3-.7z" />,
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
  slow: (
    <>
      <circle cx="12" cy="13.5" r="6" />
      <path d="M12 13.5V10M10 4.5h4" />
    </>
  ),
  waste: (
    <>
      <rect x="5" y="7.5" width="14" height="10" rx="2.2" />
      <path d="M12 10.2v4.6M9.7 12.5h4.6" />
    </>
  ),
};

export function GradeIcon({ grade }) {
  const icon = GRADE_ICONS[grade];
  return (
    <i className={"lab-badge " + grade} aria-hidden="true">
      {typeof icon === "string" ? icon : <svg viewBox="0 0 24 24">{icon}</svg>}
    </i>
  );
}

// The run as a whole: the summary card and the help on the scores.
import { t } from "../../i18n.js";
import { KIND_NAMES, SCORES } from "./consts.js";
import { pointsOf, rankOf } from "./rank.js";
import { drawRankCard, saveRankCard } from "./rankCard.js";
import { Button } from "../../ui.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KindIcon } from "./icons.jsx";

function verdict(review) {
  const kinds = Object.keys(KIND_NAMES);
  // Macro counts double: quick, exact hands do not make up for a poor stack.
  const points = pointsOf(review.scores);
  const { letter, step, title } = rankOf(points);
  const sorted = [...kinds].sort((a, b) => review.scores[b] - review.scores[a]);
  const [best, worst] = [sorted[0], sorted[sorted.length - 1]];
  const even = review.scores[best] - review.scores[worst] < 10;
  return { letter, step, title, points, note: even ? ["Even across all three."] : ["Strongest in {best}, weakest in {worst}.", { best: KIND_NAMES[best], worst: KIND_NAMES[worst] }] };
}

// What the three scores mean and where the bar sits, on hover (or focus) of a
// small question mark at the end of the score row. Macro is judged differently
// in a Battle (against the engine) than elsewhere, so its text follows the run.
export function ScoreHelp({ review, mode }) {
  const rows = [
    [
      "macro",
      "Macro",
      mode === "sprint"
        ? ["How well the stack was built, read off the result: how little was left on the board, and how much was cleared in quads.", "40 lines in 100 pieces, all quads, is 100. All singles in 102 pieces is 55. The moves pointed out come from an engine tuned for Sprint."]
        : review.engine
        ? ["How well the stack was built. Every move is compared with the best move of the Cold Clear engine.", "The engine itself scores 95 or more. Stacking flat with no mistakes, but no T-spins, is about 75 to 80."]
        : ["How well the stack was built. Every move is compared with the best spot for gaps, height and flatness.", "A stack with no covered gaps scores 90 or more. In a Battle the engine is the yardstick instead."],
    ],
    [
      "dexterity",
      "Dexterity",
      mode === "sprint"
        ? ["How fast the pieces go down.", "For 40 lines: 4:00 is 25, 2:00 is 50, 1:00 is 75, 0:30 is 100."]
        : ["How fast the pieces go down, in pieces per second (PPS).", "By TETR.IO's rank averages: D (0.7 PPS) is 48, B (1.1) is 64, S (1.6) is 77, U (2.4) is 92, and 3 PPS or more is 100."],
    ],
    ["finesse", "Finesse", ["The share of pieces placed without a wasted key press.", "70% is the usual mark for moving on to harder things."]],
  ];
  return (
    <span className="lab-help">
      <button type="button" aria-label={t("About the scores")}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 16.9v.2" />
        </svg>
      </button>
      <span className="lab-tip" role="tooltip">
        {rows.map(([kind, name, lines]) => (
          <span key={kind} className="lab-tip-row">
            <b>
              <KindIcon kind={kind} />
              {t(name)}
            </b>
            {lines.map((line) => (
              <span key={line}>{t(line)}</span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

// The seal: the rank's letter in a ring, with its step (+ or −) set smaller
// beside it. The S ranks are dressed up in replay.css.
export function RankSeal({ letter, step }) {
  return (
    <div className={"lab-seal seal-" + letter} aria-label={letter + step}>
      <span>{letter}</span>
      {step && <i>{step}</i>}
    </div>
  );
}

// The card, large, over the page: it leans toward the pointer like a card in
// the hand, with a light moving across it. Save is underneath; a click
// outside or Esc closes it.
function RankCardView({ what, onClose }) {
  const src = useMemo(() => drawRankCard(what).toDataURL("image/png"), [what]);
  const cardRef = useRef(null);
  useEffect(() => {
    const key = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  const lean = (e) => {
    const el = cardRef.current;
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 16).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 20).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const rest = () => ["--rx", "--ry"].forEach((k) => cardRef.current.style.setProperty(k, "0deg"));
  return createPortal(
    <div
      className="lab-cardview"
      onPointerMove={lean}
      onPointerLeave={rest}
      onClick={(e) => {
        e.stopPropagation(); // the card under it opened this: a click here must not open it again
        onClose();
      }}
    >
      <div ref={cardRef} className={"lab-cardview-card holo-" + what.letter} onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" draggable={false} />
      </div>
      <div className="lab-cardview-actions" onClick={(e) => e.stopPropagation()}>
        <Button variant="primary" icon="download" onClick={() => saveRankCard(what)}>
          {t("Save as image")}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t("Close")}
        </Button>
      </div>
    </div>,
    document.body,
  );
}

// The summary, set out like a certificate so it never reads as one of the
// move comments: a seal with the rank, the title, then what stood out.
export function Award({ review, card }) {
  const v = verdict(review);
  const [key, vars] = v.note;
  // The card to keep: opened large first, saved from there.
  const [shown, setShown] = useState(null);
  const open = () => {
    setShown({ ...v, ...card, title: t(v.title), date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), scores: SCORES.map(([kind, label]) => [label, review.scores[kind]]) });
  };
  return (
    <div
      className={"lab-award open rank-" + v.letter}
      role="button"
      tabIndex={0}
      aria-label={t("Show the card")}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        open();
      }}
    >
      {shown && <RankCardView what={shown} onClose={() => setShown(null)} />}
      <RankSeal letter={v.letter} step={v.step} />
      <div className="lab-award-title">{t(v.title)}</div>
      <p className="lab-award-note">{t(key, vars && { best: t(vars.best), worst: t(vars.worst) })}</p>
      {review.traits.length > 0 && (
        <ul className="lab-traits">
          {review.traits.map((trait, n) => (
            <li key={trait.text[0]} className={trait.good ? "good" : "bad"} style={{ "--i": n }}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {trait.good ? <path d="M5.5 12.5l4.2 4.2L18.5 8" /> : <path d="M12 6.5v7M12 17.2v.3" />}
              </svg>
              <span>{t(trait.text[0], trait.text[1])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

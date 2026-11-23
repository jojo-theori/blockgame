// Lab → Logo: where the mark is chosen. The name is three pieces, so the mark
// is those three set down as one shape; this page lays out every way to do
// that (logoLayouts.js) and shows a chosen one at the sizes it will be used.
// It is built like the Components page: topics on the left, one on the right.
import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n.js";
import { logoLayouts, markCells } from "../logoLayouts.js";

// The arrangement the favicon uses now (public/favicon.svg).
export const CURRENT = "4×4-13";
const PICK_KEY = "jbl-logo-pick";

// The mark. As a favicon it sits on its dark rounded square; bare, it is only the pieces.
function Mark({ layout, size, bare = false }) {
  const cells = markCells(layout, size, bare ? 0 : 0.16);
  return (
    <svg className={bare ? "" : "exp-logo-icon"} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {!bare && <rect width={size} height={size} rx={size * 0.25} fill="#0a0a0a" />}
      <g shapeRendering="crispEdges">
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.side} height={c.side} fill={c.color} />
        ))}
      </g>
    </svg>
  );
}

function Section({ title, count, children }) {
  return (
    <section>
      <div className="k">
        {title}
        {count != null && ` · ${count}`}
      </div>
      <div className="exp-logo-grid">{children}</div>
    </section>
  );
}

// One arrangement to choose: the mark, and under it its name.
function Choice({ layout, picked, onPick }) {
  const facts = [layout.code === CURRENT && t("Now"), (layout.mirror || layout.flip || layout.diagonal || layout.antidiagonal) && t("symmetric"), layout.across && "S·Z·O", layout.holes > 0 && t("{n} shut in", { n: layout.holes })].filter(Boolean).join(" · ");
  return (
    <button type="button" className={"exp-logo-choice" + (picked ? " on" : "")} onClick={() => onPick(layout.code)} aria-pressed={picked} title={facts || undefined}>
      <Mark layout={layout} size={56} bare />
      <span>{layout.code}</span>
    </button>
  );
}

// An arrangement at the sizes and in the company it will keep.
function Uses({ layout, label }) {
  return (
    <section>
      <div className="k">{label}</div>
      <div className="exp-logo-uses">
        <div className="exp-logo-sizes">
          {[180, 64, 32, 16].map((s) => (
            <Mark key={s} layout={layout} size={s} />
          ))}
        </div>
        <div className="exp-logo-lockup">
          <Mark layout={layout} size={64} bare />
          <strong>SZO</strong>
        </div>
        <div className="exp-logo-lockup stacked">
          <Mark layout={layout} size={88} bare />
          <strong>SZO</strong>
          <em>JOJO&apos;S BLOCKGAME LABORATORY</em>
        </div>
      </div>
    </section>
  );
}

// [id, name, what it is for]
const TOPICS = [
  ["pick", "Chosen", "The arrangement in use and the one chosen, at favicon sizes and with the name."],
  ["tight", "Tightest", "The smallest boxes the three fit in."],
  ["order", "Reads S, Z, O", "The pieces in the order of the name, from the left or from the top."],
  ["mirror", "Symmetric", "S and Z as each other's reflection, O on the axis: left and right, top and bottom, or across a diagonal."],
  ["all", "All", "Every arrangement, by the box it fits in."],
];
const ACCENT = "#f2cb4c";

export default function LogoLab({ onBack }) {
  const all = useMemo(() => logoLayouts(), []);
  const byCode = useMemo(() => new Map(all.map((a) => [a.code, a])), [all]);
  const [topic, setTopic] = useState("pick");
  const [pick, setPick] = useState(() => {
    try {
      return localStorage.getItem(PICK_KEY) || CURRENT;
    } catch {
      return CURRENT;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PICK_KEY, pick);
    } catch {
      /* the choice is only a convenience */
    }
  }, [pick]);
  const choose = (code) => {
    setPick(code);
    setTopic("pick");
  };
  const show = (list) => list.map((a) => <Choice key={a.id} layout={a} picked={a.code === pick} onPick={choose} />);
  const boxes = (names) => all.filter((a) => names.includes(a.box));
  const groups = useMemo(() => {
    const map = new Map();
    for (const a of all) map.set(a.box, [...(map.get(a.box) || []), a]);
    return [...map.entries()];
  }, [all]);
  const chosen = byCode.get(pick) || byCode.get(CURRENT);
  const now = byCode.get(CURRENT);
  const [, name, use] = TOPICS.find(([id]) => id === topic);
  const sets = {
    tight: [
      ["4×4", boxes(["4×4"])],
      ["6×3 · 3×6", boxes(["6×3", "3×6"])],
      ["8×2 · 2×8", boxes(["8×2", "2×8"])],
      ["5×4 · 4×5", boxes(["5×4", "4×5"]).filter((a) => !a.holes)],
    ],
    order: [
      [t("Across"), all.filter((a) => a.across)],
      [t("Down"), all.filter((a) => a.down && !a.across)],
    ],
    mirror: [
      [t("Left and right"), all.filter((a) => a.mirror)],
      [t("Top and bottom"), all.filter((a) => a.flip)],
      [t("Diagonal"), all.filter((a) => a.diagonal || a.antidiagonal)],
    ],
    all: groups,
  };

  return (
    <div className="page wide" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Logo")}</h1>
      <p className="lede">{t("Every way to set S, Z and O down as one mark.")}</p>
      <div className="mid">
        <div className="cat">
          <nav className="cat-nav">
            <div>
              <div className="k">{t("{n} arrangements", { n: all.length })}</div>
              {TOPICS.map(([id, label]) => (
                <button key={id} type="button" className={id === topic ? "on" : ""} onClick={() => setTopic(id)}>
                  {t(label)}
                </button>
              ))}
            </div>
          </nav>
          <article className="cat-doc" key={topic}>
            <header>
              <h2>{t(name)}</h2>
              <p>{t(use)}</p>
            </header>
            {topic === "pick" ? (
              <>
                <Uses layout={now} label={`${t("Now")} · ${now.code}`} />
                {chosen.code !== CURRENT && <Uses layout={chosen} label={`${t("Chosen")} · ${chosen.code}`} />}
              </>
            ) : (
              sets[topic].map(([title, list]) => (
                <Section key={title} title={title} count={list.length}>
                  {show(list)}
                </Section>
              ))
            )}
          </article>
        </div>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

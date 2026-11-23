// Lab → Logo: a design lab for the mark. The name is three pieces, so the mark
// is those three set down as one shape; this page lays out every way to do
// that (logoLayouts.js) and shows a chosen one at the sizes it will be used.
import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n.js";
import { logoLayouts, markCells } from "../logoLayouts.js";

// The arrangement the favicon uses now (public/favicon.svg).
export const CURRENT = "4×4-03";
const PICK_KEY = "jbl-logo-pick";

// The mark on its tile: a dark rounded square, as the favicon is.
function Mark({ layout, size, bare = false, radius = 0.25 }) {
  const cells = markCells(layout, size, bare ? 0 : 0.16);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      {!bare && <rect width={size} height={size} rx={size * radius} fill="#0a0a0a" shapeRendering="geometricPrecision" />}
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={c.side} height={c.side} fill={c.color} />
      ))}
    </svg>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="exp-dl-sec">
      <h2>
        {title}
        {note && <span>{note}</span>}
      </h2>
      <div className="exp-dl-grid">{children}</div>
    </section>
  );
}

// One arrangement to choose: its name and what sets it apart above, the mark below.
function Choice({ layout, picked, onPick }) {
  const facts = [layout.mirror && t("symmetric"), layout.across && "S·Z·O", layout.holes > 0 && t("{n} shut in", { n: layout.holes })].filter(Boolean).join(" · ");
  return (
    <div className="exp-dl-item">
      <div className="exp-dl-label">
        <b className={layout.code === CURRENT ? "now" : ""}>{layout.code === CURRENT ? t("Now") : layout.code}</b>
        <span>{layout.code === CURRENT ? layout.code : facts}</span>
      </div>
      <button type="button" className={"exp-dl-tile" + (picked ? " on" : "") + (layout.code === CURRENT ? " now" : "")} onClick={() => onPick(layout.code)} aria-pressed={picked}>
        <Mark layout={layout} size={88} />
      </button>
    </div>
  );
}

// A chosen arrangement at the sizes and in the company it will keep.
function Uses({ layout, label, now = false }) {
  return (
    <>
      <div className="exp-dl-item wide">
        <div className="exp-dl-label">
          <b className={now ? "now" : ""}>{label}</b>
          <span>{t("Favicon: 180, 64, 32 and 16 px")}</span>
        </div>
        <div className={"exp-dl-tile still" + (now ? " now" : "")}>
          <div className="exp-dl-row">
            {[180, 64, 32, 16].map((s) => (
              <Mark key={s} layout={layout} size={s} />
            ))}
          </div>
        </div>
      </div>
      <div className="exp-dl-item wide">
        <div className="exp-dl-label">
          <b className={now ? "now" : ""}>{label}</b>
          <span>{t("Beside the name, and above it")}</span>
        </div>
        <div className={"exp-dl-tile still" + (now ? " now" : "")}>
          <div className="exp-dl-dark">
            <div className="exp-dl-lockup">
              <Mark layout={layout} size={72} bare />
              <strong>SZO</strong>
            </div>
            <div className="exp-dl-lockup stacked">
              <Mark layout={layout} size={96} bare />
              <strong>SZO</strong>
              <em>JOJO&apos;S BLOCKGAME LABORATORY</em>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const TABS = [
  ["pick", "Chosen"],
  ["tight", "Tightest"],
  ["order", "Reads S, Z, O"],
  ["mirror", "Symmetric"],
  ["all", "All"],
];

export default function LogoLab({ onBack }) {
  const all = useMemo(() => logoLayouts(), []);
  const byCode = useMemo(() => new Map(all.map((a) => [a.code, a])), [all]);
  const [tab, setTab] = useState("pick");
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
    setTab("pick");
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

  return (
    <div className="exp-dl" key={tab}>
      <header className="exp-dl-head">
        <b>SZO · {t("Design lab")}</b>
        <nav>
          {TABS.map(([id, name]) => (
            <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {t(name)}
            </button>
          ))}
        </nav>
        <button type="button" className="exp-dl-back" onClick={onBack}>
          {t("Back to the Lab")}
        </button>
      </header>
      <main>
        {tab === "pick" && (
          <>
            <Section title={t("Mark — the arrangement in use and the one chosen")} note={t("Choose another on any tab; it is shown here.")}>
              <Uses layout={now} label={t("Now")} now />
              {chosen.code !== CURRENT && <Uses layout={chosen} label={chosen.code} />}
            </Section>
          </>
        )}
        {tab === "tight" && (
          <>
            <Section title={t("4×4 — the smallest square box")} note={t("{n} of them", { n: boxes(["4×4"]).length })}>
              {show(boxes(["4×4"]))}
            </Section>
            <Section title={t("6×3 and 3×6 — a low or a tall block")} note={t("{n} of them", { n: boxes(["6×3", "3×6"]).length })}>
              {show(boxes(["6×3", "3×6"]))}
            </Section>
            <Section title={t("8×2 and 2×8 — one band")} note={t("{n} of them", { n: boxes(["8×2", "2×8"]).length })}>
              {show(boxes(["8×2", "2×8"]))}
            </Section>
            <Section title={t("5×4 and 4×5 — nearly square, nothing shut in")} note={t("{n} of them", { n: boxes(["5×4", "4×5"]).filter((a) => !a.holes).length })}>
              {show(boxes(["5×4", "4×5"]).filter((a) => !a.holes))}
            </Section>
          </>
        )}
        {tab === "order" && (
          <>
            <Section title={t("Across — S, then Z, then O from the left")} note={t("{n} of them", { n: all.filter((a) => a.across).length })}>
              {show(all.filter((a) => a.across))}
            </Section>
            <Section title={t("Down — S, then Z, then O from the top")} note={t("{n} of them", { n: all.filter((a) => a.down && !a.across).length })}>
              {show(all.filter((a) => a.down && !a.across))}
            </Section>
          </>
        )}
        {tab === "mirror" && (
          <Section title={t("Mirror — S and Z as each other's reflection, O on the axis")} note={t("{n} of them", { n: all.filter((a) => a.mirror).length })}>
            {show(all.filter((a) => a.mirror))}
          </Section>
        )}
        {tab === "all" &&
          groups.map(([box, list]) => (
            <Section key={box} title={t("{box} — every arrangement in that box", { box })} note={t("{n} of them", { n: list.length })}>
              {show(list)}
            </Section>
          ))}
      </main>
    </div>
  );
}

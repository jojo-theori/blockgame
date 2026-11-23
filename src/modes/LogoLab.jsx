// Lab → Logo: where the mark is chosen. The name is three pieces, so the mark
// is those three set down as one shape; this page lays out every way to do
// that (logoLayouts.js) and shows a chosen one at the sizes it will be used.
// It is built like the Components page: topics on the left, one on the right.
import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n.js";
import { logoLayouts, markCells, markShape } from "../logoLayouts.js";
import { Segmented } from "../ui.jsx";

// The arrangement the favicon uses now (public/favicon.svg).
export const CURRENT = "5×5-183";
export const CURRENT_TURN = 45;
const PICK_KEY = "jbl-logo-pick";

// The mark. As a favicon it sits on its dark rounded square; bare, it is only the pieces.
function Mark({ layout, size, bare = false, turn = 0 }) {
  const cells = markCells(layout, size, bare ? 0 : 0.16, turn);
  return (
    <svg className={bare ? "" : "exp-logo-icon"} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {!bare && <rect width={size} height={size} rx={size * 0.25} fill="#0a0a0a" />}
      {/* Upright, squares sit on whole pixels. Turned, each gets a hair of its
          own colour around it, so no line shows where two meet. */}
      <g shapeRendering={turn ? "geometricPrecision" : "crispEdges"} transform={turn ? `rotate(${turn} ${size / 2} ${size / 2})` : undefined}>
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.side} height={c.side} fill={c.color} stroke={turn ? c.color : undefined} strokeWidth={turn ? Math.max(1, size / 90) : undefined} />
        ))}
      </g>
    </svg>
  );
}

// The mark cut to its own outline, `height` tall: for setting beside type.
function TightMark({ layout, turn, height, style }) {
  const s = markShape(layout, turn);
  return (
    <svg width={(height * s.w) / s.h} height={height} viewBox={`${s.x} ${s.y} ${s.w} ${s.h}`} style={style} aria-hidden="true">
      <g shapeRendering={turn ? "geometricPrecision" : "crispEdges"} transform={turn ? `rotate(${turn} ${s.cx} ${s.cy})` : undefined}>
        {s.cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} stroke={turn ? c.color : undefined} strokeWidth={turn ? 0.03 : undefined} />
        ))}
      </g>
    </svg>
  );
}

// How tall the capitals of the name really are at a type size, and how far
// their feet sit below the baseline (round letters overshoot it a little).
const FACE = '700 100px "Helvetica Neue", Helvetica, Arial, sans-serif';
let capsOf = null;
function caps(size) {
  if (!capsOf) {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = FACE;
    const m = ctx.measureText("SZO");
    capsOf = { up: m.actualBoundingBoxAscent / 100, down: m.actualBoundingBoxDescent / 100 };
  }
  return { up: capsOf.up * size, down: capsOf.down * size };
}

// The mark and the name set together. The eye, not the box, decides the fit:
// the mark is as tall as the capitals, a little taller when it stands on a
// point (a point reads smaller than a flat side), its middle on the middle of
// the capitals, and the space between is measured from the shape itself.
function Lockup({ layout, turn, size, stacked = false }) {
  const { up, down } = caps(size);
  const cap = up + down;
  const pointed = turn % 90 !== 0;
  const tall = cap * (stacked ? 1.5 : 1) * (pointed ? 1.16 : 1.02);
  // Beside the name the mark hangs from the baseline: lift or lower it so the
  // middles agree, then most of the way toward where its weight sits, since a
  // shape heavy at the top looks set too high when only its box is centred.
  const shift = tall / 2 - (up - down) / 2 + (0.5 - markShape(layout, turn).balance) * tall * 0.7;
  return (
    <div className={"exp-logo-lockup" + (stacked ? " stacked" : "")} style={{ gap: stacked ? cap * 0.34 : cap * (pointed ? 0.3 : 0.36) }}>
      <TightMark layout={layout} turn={turn} height={tall} style={stacked ? undefined : { transform: `translateY(${shift}px)` }} />
      <strong style={{ fontSize: size }}>SZO</strong>
      {stacked && <em>JOJO&apos;S BLOCKGAME LABORATORY</em>}
    </div>
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
function Uses({ layout, label, turn }) {
  return (
    <section>
      <div className="k">{label}</div>
      <div className="exp-logo-uses">
        <div className="exp-logo-sizes">
          {[180, 64, 32, 16].map((s) => (
            <Mark key={s} layout={layout} size={s} turn={turn} />
          ))}
        </div>
        <Lockup layout={layout} turn={turn} size={64} />
        <Lockup layout={layout} turn={turn} size={52} stacked />
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
  // The chosen view can show the marks turned an eighth either way: a shape
  // symmetric across a diagonal stands upright that way.
  const [turn, setTurn] = useState(CURRENT_TURN);
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
                <section>
                  <div className="k">{t("Turn")}</div>
                  <div className="exp-logo-turn">
                    <Segmented
                      label={t("Turn")}
                      value={turn}
                      onChange={setTurn}
                      options={[
                        { id: -45, label: "−45°" },
                        { id: 0, label: "0°" },
                        { id: 45, label: "45°" },
                      ]}
                    />
                  </div>
                </section>
                <Uses layout={now} label={`${t("Now")} · ${now.code}${CURRENT_TURN ? ` · ${CURRENT_TURN}°` : ""}`} turn={CURRENT_TURN} />
                {(chosen.code !== CURRENT || turn !== CURRENT_TURN) && <Uses layout={chosen} label={`${t("Chosen")} · ${chosen.code}${turn ? ` · ${turn}°` : ""}`} turn={turn} />}
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

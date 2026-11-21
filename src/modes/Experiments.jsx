import { useState, useEffect, useRef } from "react";
import { t } from "../i18n.js";
import { sfx } from "../sound.js";

const ACCENT = "#f2cb4c";

// ─── Lab: things being tried out ───
// A list of experiments; each opens on its own page. Esc goes back a step.
const EXPERIMENTS = [{ id: "sound", label: "Sound test", desc: "Hear every sound the game makes, one at a time or as a run of clears." }];

export default function Experiments({ settings, onBack }) {
  const [open, setOpen] = useState(null);
  const settingsOpen = !!settings.settingsOpen;
  useEffect(() => {
    if (settingsOpen) return;
    const onKey = (e) => {
      if (e.code !== "Escape") return;
      if (open) setOpen(null);
      else onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onBack, settingsOpen]);

  if (open === "sound") return <SoundTest onBack={() => setOpen(null)} />;
  return (
    <div className="page" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Lab")}</h1>
      <p className="lede">{t("Things being tried out, just for fun.")}</p>
      <div className="mid">
        <div className="exp-list">
          {EXPERIMENTS.map((x) => (
            <button key={x.id} type="button" className="btn exp-item" onClick={() => setOpen(x.id)}>
              <b>{t(x.label)}</b>
              <span>{t(x.desc)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          {t("Main menu")}
        </button>
      </div>
    </div>
  );
}

// One placement, the way the game sounds it (see trackSfx in sound.js): the
// clear, spin or perfect clear, then back-to-back and combo on top.
function place({ lines = 0, spin = false, perfect = false, b2b = false, combo = 0 }) {
  if (perfect) sfx.perfect();
  else if (spin && lines) sfx.spin(lines);
  else if (lines) sfx.clear(lines);
  else sfx.drop();
  if (lines && b2b) sfx.b2b();
  if (lines && combo >= 1) sfx.combo(combo);
}

const GROUPS = [
  {
    label: "Line clears",
    items: [1, 2, 3, 4].map((n) => ({ label: ["Single", "Double", "Triple", "Quad"][n - 1], run: () => place({ lines: n }) })),
  },
  {
    label: "T-spins",
    items: [1, 2, 3].map((n) => ({ label: ["T-spin single", "T-spin double", "T-spin triple"][n - 1], run: () => place({ lines: n, spin: true }) })),
  },
  {
    label: "Back-to-back",
    items: [
      { label: "Quad", run: () => place({ lines: 4, b2b: true }) },
      { label: "T-spin double", run: () => place({ lines: 2, spin: true, b2b: true }) },
      { label: "The bonus alone", run: () => sfx.b2b() },
    ],
  },
  {
    label: "Combo",
    items: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map((n) => ({ label: String(n), run: () => place({ lines: 1, combo: n }) })),
  },
  {
    label: "Runs",
    // Each step is one placement; they are played half a second apart.
    items: [
      { label: "Combo 1 to 15", steps: Array.from({ length: 15 }, (_, i) => ({ lines: 1, combo: i + 1 })) },
      { label: "Four quads back to back", steps: [{ lines: 4 }, { lines: 4, b2b: true }, { lines: 4, b2b: true }, { lines: 4, b2b: true }] },
      { label: "Quad, T-spin double, T-spin triple", steps: [{ lines: 4 }, { lines: 2, spin: true, b2b: true }, { lines: 3, spin: true, b2b: true }] },
      { label: "Back-to-back inside a combo", steps: [{ lines: 4 }, { lines: 4, b2b: true, combo: 1 }, { lines: 2, spin: true, b2b: true, combo: 2 }, { lines: 1, combo: 3 }] },
    ],
  },
  {
    label: "Other",
    items: [
      { label: "Perfect clear", run: () => place({ lines: 4, perfect: true }) },
      { label: "Move", run: () => sfx.move() },
      { label: "Rotate", run: () => sfx.rotate() },
      { label: "Hold", run: () => sfx.hold() },
      { label: "Drop", run: () => sfx.drop() },
      { label: "Garbage", run: () => sfx.garbage() },
      { label: "Fault", run: () => sfx.miss() },
      { label: "Ready", run: () => sfx.ready() },
      { label: "Go", run: () => sfx.go() },
      { label: "Win", run: () => sfx.win() },
      { label: "Lose", run: () => sfx.lose() },
    ],
  },
];

function SoundTest({ onBack }) {
  // A run in progress: its timers, so a new press (or leaving) cuts it short.
  const timers = useRef([]);
  const [playing, setPlaying] = useState(null);
  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(null);
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const press = (item) => (e) => {
    e.currentTarget.blur();
    stop();
    if (!item.steps) return item.run();
    setPlaying(item.label);
    item.steps.forEach((step, i) => timers.current.push(setTimeout(() => place(step), i * 520)));
    timers.current.push(setTimeout(() => setPlaying(null), item.steps.length * 520));
  };
  return (
    <div className="page wide" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Sound test")}</h1>
      <p className="lede">{t("Each button plays what the game would play. Sounds switched off in Settings stay silent here too.")}</p>
      <div className="mid">
        <div className="snd">
          {GROUPS.map((g) => (
            <div key={g.label} className="snd-row">
              <div className="k">{t(g.label)}</div>
              <div className="snd-btns">
                {g.items.map((item) => (
                  <button key={item.label} type="button" className={"btn compact" + (playing === item.label ? " primary" : "")} onClick={press(item)}>
                    {t(item.label)}
                  </button>
                ))}
              </div>
            </div>
          ))}
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

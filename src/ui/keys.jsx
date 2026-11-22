// Keys on screen: key caps, hints, the setup summary, the live key display.
import { useEffect, useState } from "react";
import { keyLabel, loadKeyBindings } from "../keys.js";
import { t } from "../i18n.js";
import { tr } from "./tr.js";

// Arrow glyphs (↑↓←→) render as SVG icons — text arrows look thin and sit
// off-center in most fonts. Rotation is relative to the "up" arrow.
const ARROW_ROTATION = { "↑": 0, "→": 90, "↓": 180, "←": 270 };

function ArrowIcon({ rotate }) {
  // Small filled triangle with softened corners, like the arrow keys on a Mac keyboard.
  return (
    <svg
      className="kbd-arrow"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 6.5 19 17H5Z" />
    </svg>
  );
}

// A key's name from its e.code. Arrow keys draw the same triangle icon as the
// key caps instead of the thin text arrows.
const ARROW_CODES = { ArrowUp: 0, ArrowRight: 90, ArrowDown: 180, ArrowLeft: 270 };

export function KeyName({ code }) {
  const rotate = ARROW_CODES[code];
  if (rotate !== undefined) {
    return (
      <span className="key-arrow" role="img" aria-label={keyLabel(code)}>
        <ArrowIcon rotate={rotate} />
      </span>
    );
  }
  return <>{keyLabel(code)}</>;
}

// Keyboard key cap
export function Kbd({ children }) {
  const rotate = typeof children === "string" ? ARROW_ROTATION[children] : undefined;
  if (rotate !== undefined) {
    return (
      <kbd className="kbd icon" aria-label={children}>
        <ArrowIcon rotate={rotate} />
      </kbd>
    );
  }
  return <kbd className="kbd">{children}</kbd>;
}

// Row of shortcut hints: items = [[["↑","↓"], "move"], [["Enter"], "open"]]
// items: [caps, label, on?]. A boolean `on` marks a toggle, lit while it is on.
export function KeyHints({ items, style }) {
  return (
    <div className="keys" style={style}>
      {items.map(([caps, label, on], i) => (
        <span key={i} className={"hint" + (on ? " on" : "")}>
          {caps.map((c) => (
            <Kbd key={c}>{c}</Kbd>
          ))}
          <span>{tr(label)}</span>
        </span>
      ))}
    </div>
  );
}

// Above the Start button of every mode: the handling values, which key profile
// this game uses, and a way into the settings to change either. profiles: key
// profiles in play ("solo", or "p1" and "p2"; none when only CPUs play).
const PROFILE_KEYS = { solo: "Solo keys", p1: "P1 keys", p2: "P2 keys" };

export function SetupInfo({ settings, profiles = ["solo"] }) {
  return (
    <div className="setup-info">
      <div>
        DAS {settings.das} ms · ARR {settings.arr} ms · SDF {settings.sdf === 100 ? "∞" : settings.sdf}
      </div>
      <div>
        {profiles.map((p) => t(PROFILE_KEYS[p]) + " · ")}
        <button type="button" className="link" onClick={settings.openSettings}>
          {t("Settings")}
        </button>
      </div>
    </div>
  );
}

// The bound game keys as caps that light up while held, laid out like a
// small keyboard: rotations and hold on top, moves below, hard drop as a bar.
const STROKE_ROWS = [
  ["rotateCCW", "rotateCW", "rotate180", "hold"],
  ["left", "softdrop", "right"],
  ["harddrop"],
];

export function KeyStrokes({ profile = "solo" }) {
  const [bind] = useState(() => loadKeyBindings()[profile] || {});
  const [down, setDown] = useState(() => new Set());
  useEffect(() => {
    const codes = new Set(Object.values(bind));
    const set = (code, on) => {
      if (!codes.has(code)) return;
      setDown((d) => {
        if (d.has(code) === on) return d;
        const n = new Set(d);
        if (on) n.add(code);
        else n.delete(code);
        return n;
      });
    };
    const onDown = (e) => set(e.code, true);
    const onUp = (e) => set(e.code, false);
    const clear = () => setDown(new Set());
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", clear);
    };
  }, [bind]);
  return (
    <div className="strokes" aria-hidden="true">
      <div className="k">{t("Input")}</div>
      {STROKE_ROWS.map((row, r) => (
        <div key={r} className="strokes-row">
          {row.map((a) => (
            <span key={a} className={"stroke" + (row.length === 1 ? " wide" : "") + (down.has(bind[a]) ? " on" : "")}>
              <KeyName code={bind[a]} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

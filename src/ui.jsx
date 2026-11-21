import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keyLabel, loadKeyBindings } from "./keys.js";
import { sfx } from "./sound.js";

// ─── SHARED UI ───

// Move a segmented control's highlight onto its selected button.
function placePill(group, pill, instant) {
  const on = group?.querySelector("button.on");
  if (!pill) return;
  if (!on) {
    pill.style.opacity = "0";
    return;
  }
  if (instant) pill.style.transition = "none";
  pill.style.opacity = "1";
  pill.style.width = on.offsetWidth + "px";
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (instant) {
    void pill.offsetWidth;
    pill.style.transition = "";
  }
}

export function Segmented({ options, value, onChange, focus = false, label }) {
  const groupRef = useRef(null);
  const pillRef = useRef(null);

  // The highlight is one element that slides to the selected option. It is a
  // CSS transition, so a new pick mid-slide just retargets it (interruptible),
  // and the value itself changes immediately (optimistic).
  // Value changes slide; the very first placement does not.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    placePill(groupRef.current, pill, !pill?.dataset.ready);
    if (pill) pill.dataset.ready = "1";
  }, [value, options.length]);

  // Size changes (fonts loading, window resize) snap without animating.
  useLayoutEffect(() => {
    let seen = false;
    const ro = new ResizeObserver(() => {
      if (seen) placePill(groupRef.current, pillRef.current, true);
      seen = true;
    });
    ro.observe(groupRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={groupRef} className={"group" + (focus ? " focus" : "")} role="radiogroup" aria-label={label}>
      <span ref={pillRef} className="seg-pill" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? "on" : ""}
          disabled={o.disabled}
          onClick={(e) => {
            e.currentTarget.blur();
            if (o.id !== value) sfx.tick();
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ k, v, big = false, style }) {
  return (
    <div className="stat" style={style}>
      <div className="k">{k}</div>
      <div className={"v" + (big ? " big" : "")}>{v}</div>
    </div>
  );
}

export function Countdown({ text }) {
  useEffect(() => {
    if (text === "Ready") sfx.ready();
    else if (text === "Go") sfx.go();
  }, [text]);
  return (
    <div className="count">
      <span key={text}>{text}</span>
    </div>
  );
}

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
export function KeyHints({ items, style }) {
  return (
    <div className="keys" style={style}>
      {items.map(([caps, label], i) => (
        <span key={i} className="hint">
          {caps.map((c) => (
            <Kbd key={c}>{c}</Kbd>
          ))}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

// Collapsible "Advanced settings" block for options most players never change.
// While collapsed it lists any option that differs from its default, so a
// changed setting is never hidden. Expanding is a CSS transition (interruptible).
export function Advanced({ open, onToggle, changed = [], children }) {
  return (
    <div className={"adv" + (open ? " open" : "")}>
      <button
        type="button"
        className="adv-toggle"
        aria-expanded={open}
        onClick={() => {
          sfx.tick();
          onToggle();
        }}
      >
        <span>Advanced settings</span>
        <svg className="adv-chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 10l4 4 4-4" />
        </svg>
      </button>
      {!open && changed.length > 0 && <div className="adv-sum">{changed.join(" · ")}</div>}
      <div className="adv-body" aria-hidden={!open}>
        <div className="adv-inner">{children}</div>
      </div>
    </div>
  );
}

// Dropdown: a button showing the current choice, with a list that opens below.
// Opening/closing is a CSS transition (interruptible); the choice applies the
// moment it's clicked (optimistic). Esc or a click outside closes it.
export function Dropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const current = options.find((o) => o.id === value);
  return (
    <div
      ref={ref}
      className={"dd" + (open ? " open" : "")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          sfx.tick();
          setOpen((o) => !o);
        }}
      >
        <span>{current?.label}</span>
        <svg className="dd-chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 10l4 4 4-4" />
        </svg>
      </button>
      <ul className="dd-menu" role="listbox" aria-label={label}>
        {options.map((o, i) => (
          <li key={String(o.id)} style={{ "--i": i }}>
            <button
              type="button"
              role="option"
              aria-selected={o.id === value}
              className={o.id === value ? "on" : ""}
              disabled={o.disabled || o.id === value}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                sfx.select();
                onChange(o.id);
                setOpen(false);
              }}
            >
              <span className="dd-label">
                {/* The current choice is marked and can't be picked again */}
                <svg className="dd-check" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {o.label}
              </span>
              {o.id === value ? <span className="dd-note">Current</span> : o.note && <span className="dd-note">{o.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Multi-select chips: each option toggles on/off; at least `min` stay on.
// `all` adds a leading chip that selects every option at once.
export function MultiSelect({ options, values, onChange, min = 1, all = false, label }) {
  const set = new Set(values);
  const everything = options.every((o) => set.has(o.id));
  const toggle = (id) => {
    const next = new Set(set);
    if (next.has(id)) {
      if (next.size <= min) return;
      next.delete(id);
    } else next.add(id);
    sfx.tick();
    onChange(options.filter((o) => next.has(o.id)).map((o) => o.id));
  };
  return (
    <div className="multi" role="group" aria-label={label}>
      {all && (
        <button
          type="button"
          className={"chip-btn" + (everything ? " on" : "")}
          aria-pressed={everything}
          onClick={() => {
            if (everything) return;
            sfx.tick();
            onChange(options.map((o) => o.id));
          }}
        >
          All
        </button>
      )}
      {options.map((o) => (
        <button
          type="button"
          key={String(o.id)}
          className={"chip-btn" + (set.has(o.id) ? " on" : "")}
          aria-pressed={set.has(o.id)}
          onClick={() => toggle(o.id)}
        >
          {o.color && <i className="chip-dot" style={{ background: o.color }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// On/off switch with its label, e.g. "Retry on a fault".
export function Switch({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={"switch-row" + (checked ? " on" : "")}
      onClick={(e) => {
        e.currentTarget.blur();
        sfx.tick();
        onChange(!checked);
      }}
    >
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="switch-hint">{hint}</span>}
      </span>
      <span className="switch" aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}


// ─── Replay log ───
// The same per-piece record that "Copy log" copies, shown live beside the board.
// Newest at the bottom; older rows fade out at the top.
const PIECE_COLOR = { I: "#41b6e6", T: "#b14fd0", L: "#f2913d", J: "#3d6fe0", S: "#5cc45c", Z: "#e8505b", O: "#f2cb4c" };
export function ReplayLog({ events, total }) {
  const first = total - events.length;
  return (
    <div className="rlog" aria-label="Piece log">
      <div className="k">Log</div>
      <ol className="rlog-list">
        {events.map((ev, i) => {
          const n = first + i + 1;
          const fault = ev.kind === "place" && ev.finesseFault > 0;
          return (
            <li key={n} className="rlog-row">
              <span className="rlog-n">{String(n).padStart(2, "0")}</span>
              <span className="rlog-t">{ev.t.toFixed(2)}</span>
              <span className="rlog-p">
                <i style={{ background: PIECE_COLOR[ev.type] }} />
                {ev.type}
              </span>
              {ev.kind === "hold" ? (
                <span className="rlog-dim">hold</span>
              ) : (
                <>
                  <span className={"rlog-keys" + (fault ? " bad" : "")}>
                    {ev.keys}
                    {ev.optimal > 0 && <span className="rlog-dim">/{ev.optimal}</span>}
                  </span>
                  <span className="rlog-tag">{[ev.action, ev.b2b && "B2B", ev.pc && "PC"].filter(Boolean).join(" ")}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Key input display ───
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
      <div className="k">Input</div>
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

import { useLayoutEffect, useRef } from "react";

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

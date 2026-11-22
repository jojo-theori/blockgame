// Text that types itself and numbers that count up.
import { useState, useEffect } from "react";

// Text that types itself out, a few characters at a time. The part not yet
// typed is there but unseen, so the bubble has its final size from the start.
// instant: show it whole at once (while the replay is running past).
export function Typed({ text, instant }) {
  const still = instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(still ? text.length : 0);
  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setN((v) => Math.min(text.length, v + 2)), 24);
    return () => clearTimeout(id);
  }, [n, text]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <i className="lab-caret" aria-hidden="true" />}
      <span style={{ visibility: "hidden" }}>{text.slice(n)}</span>
    </>
  );
}

// A score that counts up to its value when it first appears.
export function CountUp({ to }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const began = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - began) / 700);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return n;
}

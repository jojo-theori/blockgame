import { useEffect, useRef, useState } from "react";
import { loadKeyBindings } from "./keys.js";
import { sfx } from "./sound.js";

// In-game toggles for the display settings: J shows/hides the piece log and
// K the key input, in every game mode. Skipped if the key is a game binding.
export function useDisplayToggles(settings) {
  const ref = useRef(settings);
  useEffect(() => {
    ref.current = settings;
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      const bound = Object.values(loadKeyBindings().solo || {});
      if (bound.includes(e.code)) return;
      const s = ref.current;
      if (e.code === "KeyK" && s.setShowKeys) {
        s.setShowKeys((v) => !v);
        sfx.tick();
      } else if (e.code === "KeyJ" && s.setShowLog) {
        s.setShowLog((v) => !v);
        sfx.tick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// Esc pauses a solo game instead of leaving it. Pausing stops the loop (the
// clock stops too) and lets go of held keys; resuming picks up where it was.
// A pause during the countdown restarts the countdown on resume.
export function usePause({ phase, setPhase, rafRef, countdownRef, lastTimeRef, loopRef, engineRef, restart }) {
  const from = useRef(null);
  const [focusLost, setFocusLost] = useState(false);
  const pause = (why) => {
    if (phase !== "playing" && phase !== "countdown") return;
    setFocusLost(why === "focus");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    const e = engineRef.current;
    if (e) for (const a of ["left", "right", "softdrop"]) e.onKeyUp?.(a);
    from.current = phase;
    setPhase("paused");
  };
  const resume = () => {
    if (phase !== "paused") return;
    setFocusLost(false);
    if (from.current === "countdown" || !engineRef.current) {
      restart();
      return;
    }
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  };
  // Keys can't reach the game without focus, so pause (and say why).
  const pauseRef = useRef(pause);
  useEffect(() => {
    pauseRef.current = pause;
  });
  useFocusLoss(phase === "playing" || phase === "countdown", () => pauseRef.current("focus"));
  return { pause, resume, focusLost };
}

// Calls onLost when the window loses focus or the tab is hidden while active.
export function useFocusLoss(active, onLost) {
  const cb = useRef(onLost);
  useEffect(() => {
    cb.current = onLost;
  });
  useEffect(() => {
    if (!active) return;
    const lost = () => cb.current();
    const vis = () => document.hidden && cb.current();
    window.addEventListener("blur", lost);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("blur", lost);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [active]);
}

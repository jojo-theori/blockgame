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
  const pause = () => {
    if (phase !== "playing" && phase !== "countdown") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    const e = engineRef.current;
    if (e) for (const a of ["left", "right", "softdrop"]) e.onKeyUp?.(a);
    from.current = phase;
    setPhase("paused");
  };
  const resume = () => {
    if (phase !== "paused") return;
    if (from.current === "countdown" || !engineRef.current) {
      restart();
      return;
    }
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  };
  usePlaying(phase === "playing" || phase === "countdown");
  return { pause, resume };
}

// ─── "Is a game running?" — read by the focus warning in App ───
let playing = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f(playing > 0));
export function usePlaying(active) {
  useEffect(() => {
    if (!active) return;
    playing++;
    emit();
    return () => {
      playing--;
      emit();
    };
  }, [active]);
}

// True while a game runs and the window has no keyboard focus. The game keeps
// going (no pause); a click brings focus straight back.
export function useFocusWarning() {
  const [inGame, setInGame] = useState(playing > 0);
  const [focused, setFocused] = useState(() => document.hasFocus());
  useEffect(() => {
    subs.add(setInGame);
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    const vis = () => setFocused(!document.hidden && document.hasFocus());
    window.addEventListener("focus", on);
    window.addEventListener("blur", off);
    document.addEventListener("visibilitychange", vis);
    return () => {
      subs.delete(setInGame);
      window.removeEventListener("focus", on);
      window.removeEventListener("blur", off);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return inGame && !focused;
}

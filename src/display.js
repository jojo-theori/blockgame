import { useEffect, useRef } from "react";
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

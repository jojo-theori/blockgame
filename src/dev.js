import { useEffect, useState } from "react";
import { loadKeyBindings, saveKeyBindings, DEFAULT_BINDINGS } from "./keys.js";

// ─── Developer shortcuts ───
// Typing a name anywhere swaps the solo key profile, for testing with another
// player's layout:
//   lizzy (or 리지, typed on a Korean layout)  → Lizzy's keys
//   jojo  (or 조조)                             → back to your own
// Matching is by physical key (e.code), so it works whichever input language
// is on: "ㅣㅑㅋ쿄" is the same keys as "lizzy", "ㅓㅐㅓㅐ" the same as "jojo".
const LIZZY = {
  left: "ArrowLeft",
  right: "ArrowRight",
  softdrop: "ArrowDown",
  harddrop: "Space",
  rotateCCW: "ArrowUp",
  rotateCW: "KeyZ",
  rotate180: "KeyS",
  hold: "KeyC",
  restart: "KeyF",
};
const WORDS = [
  ["lizzy", "lizzy"],
  ["flwl", "lizzy"], // 리지
  ["jojo", "own"],
  ["whwh", "own"], // 조조
];
const OWN_KEY = "jbl-keys-own"; // your solo keys, kept while Lizzy's are in

function swap(to) {
  const all = loadKeyBindings();
  // Compared key by key: the two objects need not list them in the same order.
  const onLizzy = Object.keys(LIZZY).every((k) => all.solo[k] === LIZZY[k]);
  if (to === "lizzy") {
    if (onLizzy) return "Lizzy";
    localStorage.setItem(OWN_KEY, JSON.stringify(all.solo));
    saveKeyBindings({ ...all, solo: { ...LIZZY } });
    return "Lizzy";
  }
  let own = null;
  try {
    own = JSON.parse(localStorage.getItem(OWN_KEY));
  } catch {
    /* ignore */
  }
  // Only put the saved keys back if Lizzy's are what is in now.
  if (onLizzy) saveKeyBindings({ ...all, solo: { ...DEFAULT_BINDINGS.solo, ...(own || {}) } });
  return "Jojo";
}

// Returns [name, version]: the profile just switched to (shown for a moment)
// and a counter that goes up on every switch, so running modes re-read keys.
export function useDevProfiles() {
  const [state, setState] = useState({ name: "", version: 0 });
  useEffect(() => {
    let typed = "";
    let last = 0;
    let hide;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input:not([type='range']), textarea")) return;
      if (!/^Key[A-Z]$/.test(e.code)) return;
      const now = performance.now();
      typed = (now - last > 1500 ? "" : typed) + e.code.slice(3).toLowerCase();
      last = now;
      typed = typed.slice(-8);
      const hit = WORDS.find(([word]) => typed.endsWith(word));
      if (!hit) return;
      typed = "";
      const name = swap(hit[1]);
      setState((s) => ({ name, version: s.version + 1 }));
      clearTimeout(hide);
      hide = setTimeout(() => setState((s) => ({ ...s, name: "" })), 3000);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(hide);
    };
  }, []);
  return [state.name, state.version];
}

import { useEffect, useState } from "react";

// Scale factor so a w×h block fits the main area (below the 56px header,
// above the footer). Never scales up.
export function useFit(w, h) {
  // Worked out on every render, so it follows a w or h that changes (Battle
  // gets wider with its logs on); a resize just asks for a new render.
  const [, bump] = useState(0);
  useEffect(() => {
    const onResize = () => bump((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return Math.min(1, (window.innerWidth - 64) / w, (window.innerHeight - 56 - 64) / h);
}

// A phone-sized screen: the top bar folds into one menu and the replay is
// laid out tall. Follows the window.
export function usePhone() {
  const [phone, setPhone] = useState(() => window.innerWidth < 720);
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 720);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return phone;
}

// Boolean state remembered in localStorage (e.g. whether "Advanced settings" is open).
export function useStoredBool(key, initial = false) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV];
}

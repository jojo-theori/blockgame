import { useEffect, useState } from "react";

// Scale factor so a w×h block fits the main area (below the 56px header,
// above the footer). Never scales up.
export function useFit(w, h) {
  const calc = () =>
    Math.min(1, (window.innerWidth - 64) / w, (window.innerHeight - 56 - 64) / h);
  const [zoom, setZoom] = useState(calc);
  useEffect(() => {
    const onResize = () => setZoom(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);
  return zoom;
}

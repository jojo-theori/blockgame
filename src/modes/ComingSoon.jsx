import { useEffect } from "react";

export default function ComingSoon({ label, color, onBack }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="page" style={{ "--accent": color }}>
      <h1 className="title">{label}</h1>
      <p className="lede">This mode is still in the lab.</p>
      <div className="actions">
        <button className="btn" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { t } from "../i18n.js";

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
      <p className="lede">{t("This mode is still in the lab.")}</p>
      <div className="actions">
        <button className="btn" onClick={onBack}>
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

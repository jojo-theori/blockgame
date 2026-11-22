// Top bar (always visible, top right): settings, sound, language, theme, full screen.
import { useEffect, useState } from "react";
import { sfx } from "../sound.js";
import { t } from "../i18n.js";

export function TopBar({ lang, setLang, theme, setTheme, sound, setSound, onSettings }) {
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const click = (fn) => (e) => {
    e.currentTarget.blur();
    sfx.tick();
    fn();
  };
  const canFull = !!document.documentElement.requestFullscreen;
  return (
    <div className="topbar">
      <button type="button" className="top-btn" title={t("Settings")} aria-label={t("Settings")} onClick={click(onSettings)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <button type="button" className="top-btn" title={t(sound ? "Sound off" : "Sound on")} aria-label={t(sound ? "Sound off" : "Sound on")} aria-pressed={sound} onClick={click(() => setSound(!sound))}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
          {sound ? <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.5 7.5 0 0 1 0 10.4" /> : <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />}
        </svg>
      </button>
      <button
        type="button"
        className="top-btn lang"
        title={lang === "ko" ? "Switch to English" : "한국어로 보기"}
        aria-label={lang === "ko" ? "Switch to English" : "한국어로 보기"}
        onClick={click(() => setLang(lang === "ko" ? "en" : "ko"))}
      >
        {lang === "ko" ? "한" : "EN"}
      </button>
      <button
        type="button"
        className="top-btn"
        title={t(theme === "light" ? "Dark mode" : "Light mode")}
        aria-label={t(theme === "light" ? "Dark mode" : "Light mode")}
        onClick={click(() => setTheme(theme === "light" ? "dark" : "light"))}
      >
        {theme === "light" ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.5 14.2A7.5 7.5 0 0 1 9.8 4.5a7.5 7.5 0 1 0 9.7 9.7Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.6" />
            <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
          </svg>
        )}
      </button>
      {canFull && (
        <button
          type="button"
          className="top-btn"
          title={t(full ? "Exit full screen" : "Full screen")}
          aria-label={t(full ? "Exit full screen" : "Full screen")}
          onClick={click(() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}))}
        >
          {full ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

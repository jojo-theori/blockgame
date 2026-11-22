// Top bar (always visible, top right): settings, sound, language, theme, full screen.
import { useEffect, useState } from "react";
import { sfx } from "../sound.js";
import { IconButton } from "./primitives.jsx";

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
      <IconButton icon="gear" label="Settings" onClick={click(onSettings)} />
      <IconButton icon={sound ? "sound" : "mute"} label={sound ? "Sound off" : "Sound on"} aria-pressed={sound} onClick={click(() => setSound(!sound))} />
      <button
        type="button"
        className="icon-btn s lang"
        title={lang === "ko" ? "Switch to English" : "한국어로 보기"}
        aria-label={lang === "ko" ? "Switch to English" : "한국어로 보기"}
        onClick={click(() => setLang(lang === "ko" ? "en" : "ko"))}
      >
        {lang === "ko" ? "한" : "EN"}
      </button>
      <IconButton icon={theme === "light" ? "moon" : "sun"} label={theme === "light" ? "Dark mode" : "Light mode"} onClick={click(() => setTheme(theme === "light" ? "dark" : "light"))} />
      {canFull && (
        <IconButton
          icon={full ? "shrink" : "expand"}
          label={full ? "Exit full screen" : "Full screen"}
          onClick={click(() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}))}
        />
      )}
    </div>
  );
}

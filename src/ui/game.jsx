// In-game pieces of UI: stat, countdown, pause menu, focus warning.
import { useEffect } from "react";
import { sfx } from "../sound.js";
import { t } from "../i18n.js";
import { tr } from "./tr.js";

export function Stat({ k, v, big = false, style }) {
  return (
    <div className="stat" style={style}>
      <div className="k">{tr(k)}</div>
      <div className={"v" + (big ? " big" : "")}>{v}</div>
    </div>
  );
}

export function Countdown({ text }) {
  useEffect(() => {
    if (text === "Ready") sfx.ready();
    else if (text === "Go") sfx.go();
  }, [text]);
  return (
    <div className="count">
      <span key={text}>{tr(text)}</span>
    </div>
  );
}

// Pause overlay for solo modes (Esc). `extra` adds mode-specific buttons.
export function PauseMenu({ onResume, onRestart, onSetup, onMenu, extra }) {
  return (
    <div className="veil pause">
      <div className="title">{t("Paused")}</div>
      <div className="row-btns">
        <button className="btn primary" onClick={onResume}>
          {t("Resume")}
        </button>
        {onRestart && (
          <button className="btn" onClick={onRestart}>
            {t("Restart")}
          </button>
        )}
        {extra}
        <button className="btn" onClick={onSetup}>
          {t("Mode options")}
        </button>
        <button className="btn ghost" onClick={onMenu}>
          {t("Main menu")}
        </button>
      </div>
    </div>
  );
}

// Shown over everything while a game runs without keyboard focus. The game
// keeps running; clicking anywhere (this layer) brings focus back.
export function FocusWarning({ show }) {
  return (
    <div className={"focus-warn" + (show ? " on" : "")} aria-hidden={!show} onPointerDown={() => window.focus()}>
      <div className="focus-card">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 22 20.5H2Z" />
          <path d="M12 10v4.5M12 17.2v.3" />
        </svg>
        <div>
          <div className="focus-title">{t("No keyboard focus")}</div>
          <div className="focus-sub">{t("Click anywhere to keep playing.")}</div>
        </div>
      </div>
    </div>
  );
}

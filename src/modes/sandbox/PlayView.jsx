// Sandbox, play: the board being played.
import { t } from "../../i18n.js";
import { buildLogText } from "../../game.js";
import { restartKey, keyLabel } from "../../keys.js";
import { BOARD_W, BOARD_H, HOLD_W, HOLD_H, SLOT } from "../../render.js";
import { Stat, KeyHints, ReplayLog, KeyStrokes, PauseMenu, Button } from "../../ui.jsx";
import { ACCENT } from "./store.js";

export default function PlayView(p) {
  const { hud, zoom, settings, log, engineRef, holdRef, toEdit, canvasRef, action, phase, resume, start, onBack, undo, queueRef } = p;
  const canUndo = hud.undo > 0;
  return (
    <>
      <div className="mode-label">{t("Sandbox")}</div>
      <div className="play sb-stage" style={{ zoom, "--accent": ACCENT }}>
        {settings.showLog !== false && <ReplayLog events={log.events} total={log.total} getText={() => buildLogText(engineRef.current, "SANDBOX")} />}
        <div className="side">
          <div>
            <div className="k">{t("Hold")}</div>
            <canvas ref={holdRef} width={HOLD_W} height={HOLD_H} style={{ marginTop: 8 }} />
          </div>
          <Stat k="Pieces" v={hud.pieces} />
          <Stat k="Lines" v={hud.lines} />
          {settings.showKeys && <KeyStrokes key={settings.keysVersion} />}
          <div className="sb-actions">
            <Button
              icon="restart"
              onClick={(e) => {
                e.currentTarget.blur();
                start();
              }}
            >
              {t("Restart")}
            </Button>
            <button
              className="btn primary sb-edit-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                toEdit();
              }}
            >
              <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
              {t("Edit")}
            </button>
          </div>
        </div>
        <div className="board-wrap">
          <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-frame" />
          {action.text && (
            <div key={action.key} className="action-pop">
              {action.text}
            </div>
          )}
          {phase === "paused" && <PauseMenu onResume={resume} onRestart={start} onSetup={toEdit} onMenu={onBack} />}
          {(phase === "gameover" || phase === "out") && (
            <div className="veil">
              <div className="k">{phase === "out" ? t("The piece order is used up") : t("Top out")}</div>
              <div className="title">{t("{n} lines", { n: hud.lines })}</div>
              <div className="row-btns">
                <button className="btn primary" onClick={start}>
                  {t("Again")}
                </button>
                <button className="btn" onClick={undo} disabled={!canUndo}>
                  {t("Undo")}
                </button>
                <button className="btn" onClick={toEdit}>
                  {t("Edit board")}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="side right">
          <div>
            <div className="k">{t("Next")}</div>
            <canvas ref={queueRef} width={HOLD_W} height={SLOT * 5} style={{ marginTop: 8 }} />
          </div>
          <KeyHints
            style={{ flexDirection: "column", alignItems: "flex-start" }}
            items={[
              [[keyLabel(restartKey())], "restart"],
              [["Bksp"], "undo"],
              [["J"], `log ${settings.showLog !== false ? "on" : "off"}`, settings.showLog !== false],
              [["K"], `input ${settings.showKeys ? "on" : "off"}`, !!settings.showKeys],
              [["Esc"], phase === "paused" ? "resume" : "pause"],
            ]}
          />

        </div>
      </div>
    </>
  );
}

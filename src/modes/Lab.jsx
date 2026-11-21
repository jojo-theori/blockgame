import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { t } from "../i18n.js";
import { formatTime } from "../game.js";
import { parseLog, buildFrames } from "../replay.js";
import { drawBoard, drawHold, drawQueue, BOARD_W, BOARD_H, HOLD_W, HOLD_H, SLOT } from "../render.js";
import { Stat, KeyHints, ReplayLog, Kbd } from "../ui.jsx";
import { useFit } from "../fit.js";
import { selectKey, backKey, keyLabel } from "../keys.js";

const ACCENT = "#3fc8b4";
const LETTER_ID = { I: 1, T: 2, L: 3, J: 4, S: 5, Z: 6, O: 7 };
const SPEEDS = [0.5, 1, 2, 4];
const PASTE_MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
const MAX_LINES = 400; // lines of a pasted log shown on the input page

// ─── Lab: watch a run again from its copied piece log ───
export default function Lab({ settings, onBack }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const settingsOpen = !!settings.settingsOpen;

  // The log is read as soon as it arrives, so the page can say what is in it.
  const replay = useMemo(() => {
    const events = parseLog(text);
    return events.some((e) => e.kind === "place") ? { events, ...buildFrames(events) } : null;
  }, [text]);
  const lines = useMemo(() => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), [text]);

  const take = useCallback((pasted) => {
    const clean = (pasted || "").trim();
    if (!clean) return setError("The clipboard is empty.");
    setText(clean);
    setError(parseLog(clean).some((e) => e.kind === "place") ? "" : "No pieces found in this log.");
  }, []);
  // The button is always offered where the browser has the API. A refusal
  // (blocked for this site, or an embedded browser) is explained on the spot.
  const canRead = !!navigator.clipboard?.readText;
  const pasteFromClipboard = () =>
    navigator.clipboard
      .readText()
      .then(take)
      .catch(() => setError("This browser blocked clipboard access for this site. Allow it in the site settings, or paste with {key}."));

  // Pasting with the keyboard works anywhere on the page; Esc goes back.
  useEffect(() => {
    if (open || settingsOpen) return;
    const onPaste = (e) => {
      e.preventDefault();
      take(e.clipboardData?.getData("text"));
    };
    const onKey = (e) => {
      if (e.code === "Escape") onBack();
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, settingsOpen, onBack, take]);

  if (open && replay) return <Viewer replay={replay} keysOff={settingsOpen} onClose={() => setOpen(false)} />;

  const last = replay?.frames[replay.frames.length - 1];
  return (
    <div className="page" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Lab")}</h1>
      <p className="lede">{t("Paste a log copied in Sprint or Battle to watch the run again.")}</p>
      <div className="mid">
        {/* What the pasted log holds, above the box. The row is there even while
            empty, so nothing moves when a log lands. */}
        <div className="lab-head">
          {lines.length > 0 && (
            <>
              <span>
                {replay
                  ? `${t("{n} pieces", { n: last.placed })} · ${formatTime(replay.events[replay.events.length - 1].t)} · ${t("{n} lines", { n: last.lines })}`
                  : t("Not a log")}
              </span>
              {canRead && (
                <button className="link" onClick={pasteFromClipboard}>
                  {t("Paste again")}
                </button>
              )}
            </>
          )}
        </div>
        <div className="lab-box">
          {/* An unseen text field over the box: a click puts the cursor in it,
              so the paste shortcut and the right-click menu always have a
              real field to paste into. It never keeps what lands in it. */}
          <textarea
            className="lab-catch"
            value=""
            aria-label={t("Paste a log here")}
            spellCheck={false}
            onChange={(e) => {
              take(e.target.value);
              e.target.blur();
            }}
            onPaste={(e) => {
              e.preventDefault();
              e.stopPropagation();
              take(e.clipboardData.getData("text"));
              e.target.blur();
            }}
          />
          {lines.length === 0 ? (
            <div className="lab-empty">
              {/* Where the browser refuses clipboard access the button could only
                  fail, so the keyboard shortcut is offered on its own. */}
              {canRead && (
                <button className="btn" onClick={pasteFromClipboard}>
                  {t("Paste from clipboard")}
                </button>
              )}
              <div className="lab-keys">
                <Kbd>{PASTE_MOD}</Kbd>
                <Kbd>V</Kbd>
                <span>{t(canRead ? "also pastes" : "to paste the log")}</span>
              </div>
            </div>
          ) : (
            // Long lines are cut short, so the box never scrolls sideways.
            <ol className="lab-lines scroll">
              {lines.slice(0, MAX_LINES).map((l, n) => (
                <li key={n}>{l}</li>
              ))}
              {lines.length > MAX_LINES && <li>…</li>}
            </ol>
          )}
        </div>
        <div className="key-msg">{error && <span className="err">{t(error, { key: `${PASTE_MOD}V` })}</span>}</div>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={() => setOpen(true)} disabled={!replay}>
          {t("Play replay")}
        </button>
        <button className="btn ghost" onClick={onBack}>
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

function Viewer({ replay, keysOff, onClose }) {
  const { events, frames, dealt } = replay;
  const total = events.length;
  const end = events[total - 1].t;
  const zoom = useFit(640, 680);
  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const queueRef = useRef(null);

  // step: how many events have happened; clock: the replay's own time.
  const [step, setStep] = useState(0);
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const clockRef = useRef(0);

  const seek = useCallback(
    (k) => {
      const n = Math.min(total, Math.max(0, k));
      clockRef.current = n ? events[n - 1].t : 0;
      setClock(clockRef.current);
      setStep(n);
    },
    [events, total],
  );

  // Playback: the clock runs and events happen as their time comes.
  useEffect(() => {
    if (!playing) return;
    let raf;
    let last = 0;
    const tick = (now) => {
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      clockRef.current = Math.min(end, clockRef.current + (dt / 1000) * speed);
      let n = 0;
      while (n < total && events[n].t <= clockRef.current) n++;
      setClock(clockRef.current);
      setStep((s) => Math.max(s, n));
      if (clockRef.current >= end) return setPlaying(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, events, total, end]);

  const toggle = useCallback(() => {
    if (!playing && step >= total) seek(0);
    setPlaying((p) => !p);
  }, [playing, step, total, seek]);
  const stepBy = useCallback(
    (d) => {
      setPlaying(false);
      seek(step + d);
    },
    [seek, step],
  );

  useEffect(() => {
    if (keysOff) return;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest("input")) return;
      if (e.code === selectKey()) {
        e.preventDefault();
        if (!e.repeat) toggle();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepBy(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepBy(1);
      } else if (e.code === "Escape" || e.code === backKey()) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keysOff, toggle, stepBy, onClose]);

  // Draw: the board so far, plus the next piece above the spot it will land on.
  const frame = frames[step];
  useEffect(() => {
    const next = events[step];
    const board = { matrix: frame.matrix, currentId: 0 };
    if (next?.kind === "place") {
      Object.assign(board, {
        playing: true,
        currentId: LETTER_ID[next.type],
        currentRot: next.rot,
        currentX: next.placed[0],
        currentY: next.spawn[1],
        ghostY: next.placed[1],
      });
    }
    drawBoard(canvasRef.current, board);
    drawHold(holdRef.current, frame.hold);
    drawQueue(queueRef.current, dealt.slice(frame.dealtCount));
  }, [events, dealt, frame, step]);

  const held = step > 0 && events[step - 1].kind === "hold";
  const shown = useMemo(() => events.slice(Math.max(0, step - 40), step), [events, step]);
  const blur = (fn) => (e) => {
    e.currentTarget.blur();
    fn();
  };

  return (
    <>
      <div className="mode-label">{t("Lab")} · Replay</div>
      <div style={{ zoom }}>
        <div className="play">
          <ReplayLog events={shown} total={step} />
          <div className="side">
            {/* A hold is easy to miss in a replay, so the step it happens on lights
                the hold up; the key restarts the pop on every new hold. */}
            <div key={held ? step : "hold"} className={held ? "lab-held" : ""}>
              <div className="k">{t("Hold")}</div>
              <canvas ref={holdRef} width={HOLD_W} height={HOLD_H} style={{ marginTop: 8 }} />
            </div>
            <Stat k="Time" v={formatTime(clock)} big />
            <Stat k="Pieces" v={`${frame.placed} / ${frames[total].placed}`} />
            <Stat k="Lines" v={frame.lines} />
            <Stat k="PPS" v={clock > 0 ? (frame.placed / clock).toFixed(2) : "0.00"} />
          </div>
          <div className="board-wrap">
            <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-frame" />
          </div>
          <div className="side right">
            <div>
              <div className="k">{t("Next")}</div>
              <canvas ref={queueRef} width={HOLD_W} height={SLOT * 5} style={{ marginTop: 8 }} />
            </div>
            <KeyHints
              style={{ flexDirection: "column", alignItems: "flex-start", whiteSpace: "nowrap" }}
              items={[
                [[keyLabel(selectKey())], playing ? "pause" : "play"],
                [["←", "→"], "step"],
                [["Esc"], "exit"],
              ]}
            />
          </div>
        </div>
        <div className="lab-bar">
          <button type="button" className="lab-icon" onClick={blur(toggle)} title={t(playing ? "Pause" : "Play")} aria-label={t(playing ? "Pause" : "Play")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? <path d="M8 5.5h2.5v13H8zM13.5 5.5H16v13h-2.5z" /> : <path d="M8.5 5.5v13l10-6.5z" />}
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={total}
            value={step}
            aria-label={t("Position")}
            onChange={(e) => {
              setPlaying(false);
              seek(+e.target.value);
            }}
            onPointerUp={(e) => e.currentTarget.blur()}
          />
          {/* One button that steps through the speeds, to keep the bar short. */}
          <button
            type="button"
            className="lab-speed"
            onClick={blur(() => setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length]))}
            title={t("Speed")}
            aria-label={`${t("Speed")} ${speed}×`}
          >
            {speed}×
          </button>
          <button type="button" className="btn ghost compact" onClick={onClose}>
            {t("Exit")}
          </button>
        </div>
      </div>
    </>
  );
}

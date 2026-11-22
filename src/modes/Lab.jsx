import { useState, useEffect, useCallback, useMemo } from "react";
import { t } from "../i18n.js";
import { formatTime } from "../game.js";
import { parseLog, buildFrames, logMode } from "../replay.js";
import { sampleLog } from "../sample.js";
import { loadRecent } from "../recent.js";
import { parseMoves } from "../trace.js";
import { Kbd } from "../ui.jsx";
import { ACCENT, PASTE_MOD, modeName, MAX_LINES, RECENT_SHOWN } from "./lab/consts.js";
import Viewer from "./lab/Viewer.jsx";

export default function Lab({ settings, initial = "", onBack }) {
  // A log handed over from a result screen opens straight into its replay.
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(!!initial);
  const [error, setError] = useState("");
  const settingsOpen = !!settings.settingsOpen;

  // The log is read as soon as it arrives, so the page can say what is in it.
  const replay = useMemo(() => {
    const events = parseLog(text);
    return events.some((e) => e.kind === "place") ? { events, ...buildFrames(events), mode: logMode(text, events), moves: parseMoves(text) } : null;
  }, [text]);
  const lines = useMemo(() => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), [text]);
  // Runs that were sent here from a result screen, newest first, each with
  // the one line that says what it was.
  const recent = useMemo(
    () =>
      loadRecent()
        .map((r) => {
          const events = parseLog(r.text);
          if (!events.some((e) => e.kind === "place")) return null;
          const end = buildFrames(events).frames.at(-1);
          return { ...r, what: `${modeName(logMode(r.text, events))}${t("{n} pieces", { n: end.placed })} · ${formatTime(events.at(-1).t)} · ${t("{n} lines", { n: end.lines })}` };
        })
        .filter(Boolean)
        .slice(0, RECENT_SHOWN),
    [],
  );

  const take = useCallback((pasted) => {
    const clean = (pasted || "").trim();
    if (!clean) return setError("The clipboard is empty.");
    const valid = parseLog(clean).some((e) => e.kind === "place");
    setText(clean);
    setError(valid ? "" : "No pieces found in this log.");
    // A log that reads goes straight to its replay, which analyses it at once.
    if (valid) setOpen(true);
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

  if (open && replay) return <Viewer replay={replay} look={settings.look} keysOff={settingsOpen} onClose={() => setOpen(false)} onMenu={onBack} />;

  const last = replay?.frames[replay.frames.length - 1];
  return (
    <div className="page" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Replay")}</h1>
      <p className="lede">{t("Paste a log to watch the run again and analyse it.")}</p>
      <div className="mid">
        {/* What the pasted log holds, above the box. The row is there even while
            empty, so nothing moves when a log lands. */}
        <div className="lab-head">
          {lines.length > 0 && (
            <>
              <span>
                {replay
                  ? `${modeName(replay.mode)}${t("{n} pieces", { n: last.placed })} · ${formatTime(replay.events[replay.events.length - 1].t)} · ${t("{n} lines", { n: last.lines })}`
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
              {/* For a look without a log of your own: a made-up 40-line run. */}
              <button className="btn ghost" onClick={() => take(sampleLog())}>
                {t("Try a sample")}
              </button>
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
        {recent.length > 0 && (
          <div className="lab-recent">
            <div className="k">{t("Recently analysed")}</div>
            {recent.map((r) => (
              <button key={r.at} type="button" onClick={() => take(r.text)}>
                <span>{r.what}</span>
                <small>{new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small>
              </button>
            ))}
          </div>
        )}
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

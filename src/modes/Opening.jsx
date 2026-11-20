import { useState, useEffect, useRef, useCallback } from "react";
import { ROWS, COLS, COLORS, BlockEngine, formatTime } from "../game.js";
import { buildKeyMap, loadKeyBindings } from "../keys.js";
import {
  drawBoard,
  drawHold,
  drawQueue,
  drawPicture,
  BOARD_W,
  BOARD_H,
  HOLD_W,
  HOLD_H,
  SLOT,
} from "../render.js";
import { playDropSound } from "../sound.js";
import { Segmented, Stat, Countdown, KeyHints, Kbd } from "../ui.jsx";
import { useFit } from "../fit.js";
import {
  OPENERS,
  LETTER_ID,
  ID_LETTER,
  stepTarget,
  stepPicture,
  openerSequence,
  mirrorOpener,
} from "../openings.js";

const PREFS_KEY = "jbl-opening";

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function hasLetters(grid) {
  for (const row of grid) for (const ch of row) if (ch && ch !== "X") return true;
  return false;
}

// Static picture of one step
function StepPicture({ step, size = 12 }) {
  const ref = useRef(null);
  useEffect(() => {
    drawPicture(ref.current, stepPicture(step), size);
  }, [step, size]);
  return <canvas ref={ref} width={COLS * size} height={step.grid.length * size} />;
}

export default function Opening({ settings, onBack }) {
  const zoom = useFit(700, 600);
  const prefs = loadPrefs();
  const [phase, setPhase] = useState("select"); // select | countdown | playing | done
  const [openerIdx, setOpenerIdx] = useState(() =>
    Math.max(0, OPENERS.findIndex((o) => o.id === prefs.opener)),
  );
  const [order, setOrder] = useState(prefs.order ?? "fixed"); // fixed | random
  const [guide, setGuide] = useState(prefs.guide ?? true);
  const [mirror, setMirror] = useState(prefs.mirror ?? "off"); // off | on | random
  const [mirroredRun, setMirroredRun] = useState(false);
  const [countdownText, setCountdownText] = useState("");
  const [, setTick] = useState(0);
  const [result, setResult] = useState(null);
  const [missFlash, setMissFlash] = useState(0);

  const baseOpener = OPENERS[openerIdx];
  const showMirrored = phase === "select" ? mirror === "on" : mirroredRun;
  const opener = showMirrored ? mirrorOpener(baseOpener) : baseOpener;

  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const queueRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const loopRef = useRef(null);
  const lastTimeRef = useRef(0);
  const countdownRef = useRef(null);
  const keysRef = useRef(buildKeyMap(loadKeyBindings().solo));
  const settingsRef = useRef(settings);
  const prevPlacedRef = useRef(0);

  // Practice state lives in refs so the engine hook can read and update it.
  const playOpRef = useRef(null); // opener (possibly mirrored) of the current run
  const run = useRef({ step: 0, target: null, misses: 0, done: false, reject: null, lastAction: "", actionKey: 0 });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ opener: opener.id, order, guide, mirror }));
    } catch {
      /* ignore */
    }
  }, [opener.id, order, guide, mirror]);

  // ─── PLACEMENT CHECK ───
  const validate = useCallback(
    (cells, id, engine) => {
      const st = run.current;
      const letter = ID_LETTER[id];
      const ok = cells.every(([r, c]) => r >= 0 && st.target[r][c] === letter);
      if (!ok) {
        st.misses++;
        st.reject = { cells, t: performance.now() };
        setMissFlash((n) => n + 1);
        return false;
      }
      for (const [r, c] of cells) st.target[r][c] = "X";
      // Rows this piece completes are about to clear: drop them from the target too.
      for (let r = 0; r < ROWS; r++) {
        if (engine.matrix[r].every((v) => v !== 0)) {
          st.target.splice(r, 1);
          st.target.unshift(new Array(COLS).fill(""));
        }
      }
      if (!hasLetters(st.target)) {
        const op = playOpRef.current;
        st.step++;
        if (st.step < op.steps.length) st.target = stepTarget(op.steps[st.step]);
        else st.done = true;
      }
      return true;
    },
    [],
  );

  const guideGrid = () => {
    const t = run.current.target;
    if (!t || !guide) return null;
    return t.map((row) => row.map((ch) => (ch && ch !== "X" ? LETTER_ID[ch] : 0)));
  };

  // ─── RENDER ───
  const render = useCallback(() => {
    const engine = engineRef.current;
    const st = run.current;
    let reject = null;
    if (st.reject) {
      const age = (performance.now() - st.reject.t) / 600;
      if (age < 1) reject = { cells: st.reject.cells, alpha: 1 - age };
      else st.reject = null;
    }
    drawBoard(canvasRef.current, engine, { guide: guideGrid(), reject });
    if (engine) {
      drawHold(holdRef.current, engine.hold, engine.holdUsed);
      drawQueue(queueRef.current, engine.queue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide]);

  // ─── LOOP ───
  useEffect(() => {
    loopRef.current = (timestamp) => {
      const engine = engineRef.current;
      if (!engine) return;
      const st = run.current;

      const dt = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;
      engine.update(Math.min(dt, 100), performance.now());

      if (engine.placedBlocks > prevPlacedRef.current) {
        prevPlacedRef.current = engine.placedBlocks;
        if (settingsRef.current.soundEnabled) playDropSound();
        if (engine.lastAction && engine.lastAction !== st.lastAction) {
          st.lastAction = engine.lastAction;
          st.actionKey++;
        }
      }

      if (st.done) {
        engine.playing = false;
        const pieces = engine.placedBlocks;
        setResult({
          time: engine.clock,
          misses: st.misses,
          pieces,
          pps: engine.clock > 0 ? pieces / engine.clock : 0,
          finish: engine.lastAction || "",
        });
        setPhase("done");
        render();
        return;
      }
      if (engine.gameOver) {
        setResult(null);
        setPhase("done");
        render();
        return;
      }

      setTick((x) => x + 1);
      render();
      rafRef.current = requestAnimationFrame(loopRef.current);
    };
  }, [render]);

  // Redraw when the guide is toggled while paused
  useEffect(() => {
    render();
  }, [render, phase]);

  const launch = useCallback((op) => {
    playOpRef.current = op;
    const s = settingsRef.current;
    const engine = new BlockEngine({
      das: s.das,
      arr: s.arr,
      sdf: s.sdf,
      sprintLines: 999999,
      sequence: order === "fixed" ? openerSequence(op) : null,
    });
    engine.validatePlacement = validate;
    engineRef.current = engine;
    run.current = {
      step: 0,
      target: stepTarget(op.steps[0]),
      misses: 0,
      done: false,
      reject: null,
      lastAction: "",
      actionKey: 0,
    };
    prevPlacedRef.current = 0;
    engine.start();
    setResult(null);
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [order, validate]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    keysRef.current = buildKeyMap(loadKeyBindings().solo);
    engineRef.current = null;
    const mir = mirror === "on" || (mirror === "random" && Math.random() < 0.5);
    const op = mir ? mirrorOpener(baseOpener) : baseOpener;
    setMirroredRun(mir);
    run.current = { ...run.current, step: 0, target: stepTarget(op.steps[0]), done: false, reject: null };
    setPhase("countdown");
    setCountdownText("Ready");
    countdownRef.current = setTimeout(() => {
      setCountdownText("Go");
      countdownRef.current = setTimeout(() => launch(op), 350);
    }, 550);
  }, [launch, baseOpener, mirror]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    setPhase("select");
  }, []);

  // ─── KEYS ───
  useEffect(() => {
    const onDown = (e) => {
      if (phase === "select") {
        if (e.code === "Escape") return onBack();
        if (e.code === "ArrowDown" || e.code === "ArrowUp") {
          e.preventDefault();
          const d = e.code === "ArrowDown" ? 1 : -1;
          setOpenerIdx((i) => (i + d + OPENERS.length) % OPENERS.length);
        } else if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
          e.preventDefault();
          setOrder((o) => (o === "fixed" ? "random" : "fixed"));
        } else if (e.code === "KeyG") {
          setGuide((g) => !g);
        } else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
          e.preventDefault();
          startGame();
        }
        return;
      }
      if (e.code === "Escape") return stop();
      if (e.repeat) return;
      if (e.code === "KeyF" && phase !== "countdown") {
        e.preventDefault();
        return startGame();
      }
      if (e.code === "KeyG") {
        setGuide((g) => !g);
        return;
      }
      if (phase !== "playing") return;
      const action = keysRef.current[e.code];
      if (!action) return;
      e.preventDefault();
      engineRef.current?.onKeyDown(action, performance.now());
    };
    const onUp = (e) => {
      const action = keysRef.current[e.code];
      if (action) engineRef.current?.onKeyUp(action);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [phase, onBack, startGame, stop]);


  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    },
    [],
  );

  // ─── SELECT ───
  if (phase === "select") {
    return (
      <div className="page wide" style={{ "--accent": "#b14fd0" }}>
        <h1 className="title">Opening</h1>
        <p className="lede">
          Build an opener piece by piece. A piece placed off the target goes back to the top.
        </p>
        <div className="mid">
        <div className="openers">
          <div>
            <div className="oplist">
              {OPENERS.map((o, i) => (
                <button
                  key={o.id}
                  className={openerIdx === i ? "on" : ""}
                  onMouseEnter={() => setOpenerIdx(i)}
                  onClick={() => {
                    setOpenerIdx(i);
                    startGame();
                  }}
                >
                  <span className="nm">
                    {o.name} <span className="small dim">{o.jp}</span>
                  </span>
                  <span className="ds">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="preview">
            {opener.steps.map((s, i) => (
              <div key={opener.id + i}>
                <div className="k" style={{ marginBottom: 8 }}>
                  {String(i + 1).padStart(2, "0")} · {s.label}
                </div>
                <StepPicture step={s} size={10} />
              </div>
            ))}
            {order === "random" && (
              <p className="note" style={{ marginTop: 4 }}>
                With a random bag some orders can&apos;t build the opener. Use hold, or press <Kbd>F</Kbd> to
                reroll.
              </p>
            )}
          </div>
        </div>
        <div className="opts inline" style={{ marginTop: 28 }}>
          <div className="opt">
            <div className="k">Piece order</div>
            <Segmented
              label="Piece order"
              options={[
                { id: "fixed", label: "Ideal" },
                { id: "random", label: "Random bag" },
              ]}
              value={order}
              onChange={setOrder}
            />
          </div>
          <div className="opt">
            <div className="k">Mirror</div>
            <Segmented
              label="Mirror"
              options={[
                { id: "off", label: "Off" },
                { id: "on", label: "On" },
                { id: "random", label: "Random" },
              ]}
              value={mirror}
              onChange={setMirror}
            />
          </div>
          <div className="opt">
            <div className="k">Guide</div>
            <Segmented
              label="Guide"
              options={[
                { id: true, label: "Show" },
                { id: false, label: "Hide" },
              ]}
              value={guide}
              onChange={setGuide}
            />
          </div>
        </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={startGame}>
            Start {opener.name}
          </button>
          <button className="btn ghost" onClick={onBack}>
            Back
          </button>
          <KeyHints items={[[["↑", "↓"], "opener"], [["←", "→"], "order"], [["G"], "guide"], [["Enter"], "start"]]} />
        </div>
      </div>
    );
  }

  // ─── PLAY ───
  const st = run.current;
  const engine = engineRef.current;
  const stepIdx = Math.min(st.step, opener.steps.length - 1);
  const step = opener.steps[stepIdx];
  const remaining = new Set();
  if (st.target && !st.done) for (const row of st.target) for (const ch of row) if (ch && ch !== "X") remaining.add(ch);
  const wrongPiece =
    engine && engine.playing && !remaining.has(ID_LETTER[engine.currentId]) && !st.done
      ? ID_LETTER[engine.currentId]
      : null;

  return (
    <>
      <div className="mode-label">
        Opening · {opener.name}
        {opener.mirrored ? " · Mirrored" : ""}
      </div>
      <div className="play" style={{ zoom }}>
        <div className="side" style={{ width: 150 }}>
          <div>
            <div className="k">Hold</div>
            <canvas ref={holdRef} width={HOLD_W} height={HOLD_H} style={{ marginTop: 8 }} />
          </div>
          <Stat k="Time" v={formatTime(engine?.clock || 0)} big />
          <div className="stat">
            <div className="k">Misses</div>
            <div key={missFlash} className={"v" + (missFlash ? " flash" : "")}>
              {st.misses}
            </div>
          </div>
          <div>
            <div className="k">
              Step {stepIdx + 1} / {opener.steps.length}
            </div>
            <div className="v xs" style={{ marginTop: 4 }}>
              {step.label}
            </div>
          </div>
        </div>

        <div className="board-wrap">
          <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-frame" />

          {phase === "countdown" && <Countdown text={countdownText} />}

          {phase === "playing" && st.lastAction && (
            <div key={st.actionKey} className="action-pop">
              {st.lastAction}
            </div>
          )}

          {phase === "done" && (
            <div className="veil">
              {result ? (
                <>
                  <div className="k">{opener.name} built</div>
                  <div className="title">
                    {formatTime(result.time)}
                  </div>
                  <div className="grid2">
                    <Stat k="Misses" v={result.misses === 0 ? "Clean" : result.misses} />
                    <Stat k="Pieces" v={result.pieces} />
                    <Stat k="PPS" v={result.pps.toFixed(2)} />
                    <Stat k="Order" v={order === "fixed" ? "Ideal" : "Random"} />
                    {result.finish && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <Stat k="Finish" v={result.finish} />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="k">Top out</div>
                  <div className="title">Try again</div>
                  <div style={{ height: 24 }} />
                </>
              )}
              <div className="row-btns">
                <button className="btn primary" onClick={startGame}>
                  Again
                </button>
                <button className="btn ghost" onClick={stop}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="side right" style={{ width: 150 }}>
          <div>
            <div className="k">Next</div>
            <canvas ref={queueRef} width={HOLD_W} height={SLOT * 5} style={{ marginTop: 8 }} />
          </div>
          <div>
            {/* Space is always reserved so the hint never pushes anything around */}
            <p
              className="note"
              style={{ marginTop: 0, minHeight: "3.2em", visibility: wrongPiece && phase === "playing" ? "visible" : "hidden" }}
            >
              {wrongPiece || "–"} isn&apos;t in this step. Hold it.
            </p>
          </div>
          <KeyHints style={{ flexDirection: "column", alignItems: "flex-start" }} items={[[["F"], "restart"], [["G"], guide ? "guide off" : "guide on"], [["Esc"], "list"]]} />
        </div>
      </div>
    </>
  );
}

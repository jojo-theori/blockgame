import { useState, useEffect, useRef, useCallback } from "react";
import { BlockEngine, formatTime, buildReplayText } from "../game.js";
import { buildKeyMap, loadKeyBindings } from "../keys.js";
import { drawBoard, drawHold, drawQueue, BOARD_W, BOARD_H, HOLD_W, HOLD_H, SLOT } from "../render.js";
import { sfx, sfxForAction, trackSfx } from "../sound.js";
import { Stat, Countdown, KeyHints, ReplayLog, KeyStrokes } from "../ui.jsx";
import { useFit } from "../fit.js";

const SPRINT_OPTIONS = [1, 20, 40, 100, 1000];

export default function Sprint({ settings, onBack }) {
  const zoom = useFit(640, 600);
  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const queueRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const keysRef = useRef(buildKeyMap(loadKeyBindings().solo));
  const prevPlacedRef = useRef(0);
  const stateRef = useRef("select");
  const settingsRef = useRef(settings);
  const gameLoopRef = useRef(null);

  // select | countdown | playing | completed | gameover
  const [phase, setPhase] = useState("select");
  const [countdownText, setCountdownText] = useState("");
  const [displayTime, setDisplayTime] = useState("0:00.000");
  const [displayLines, setDisplayLines] = useState(40);
  const [displayPPS, setDisplayPPS] = useState("0.00");
  const [displayAction, setDisplayAction] = useState("");
  const [actionKey, setActionKey] = useState(0);
  const [displayAttack, setDisplayAttack] = useState(0);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [log, setLog] = useState({ events: [], total: 0 });
  const logLenRef = useRef(0);
  const [sprintLines, setSprintLines] = useState(
    () => {
      try {
        const saved = localStorage.getItem("jbl-settings");
        return saved ? JSON.parse(saved).sprintLines ?? 40 : 40;
      } catch {
        return 40;
      }
    },
  );

  // Sync refs
  useEffect(() => {
    stateRef.current = phase;
  }, [phase]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jbl-settings") || "{}");
      saved.sprintLines = sprintLines;
      localStorage.setItem("jbl-settings", JSON.stringify(saved));
    } catch { /* ignore */ }
  }, [sprintLines]);

  // ─── RENDERER ───
  const render = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    drawBoard(canvasRef.current, engine, { dead: engine.gameOver });
    drawHold(holdRef.current, engine.hold, engine.holdUsed);
    drawQueue(queueRef.current, engine.queue);
  }, []);

  // ─── END STATS ───
  const buildEndStats = useCallback((engine) => {
    const pps =
      engine.clock > 0
        ? (engine.placedBlocks / engine.clock).toFixed(2)
        : "0.00";
    const s = settingsRef.current;
    return {
      ...engine.stats,
      time: engine.clock,
      pps: parseFloat(pps),
      lines: engine.lines,
      attack: engine.totalAttack,
      blocks: engine.placedBlocks,
      replayText: buildReplayText(
        engine,
        { das: s.das, arr: s.arr, sprintLines: engine.sprintLines },
        {
          time: engine.clock,
          pps: parseFloat(pps),
          blocks: engine.placedBlocks,
        },
      ),
    };
  }, []);

  // ─── GAME LOOP ───
  useEffect(() => {
    gameLoopRef.current = (timestamp) => {
      const engine = engineRef.current;
      if (!engine) return;

      trackSfx(engine);

      if (engine.completed && stateRef.current !== "completed") {
        sfx.win();
        setPhase("completed");
        setStats(buildEndStats(engine));
        render();
        return;
      }
      if (engine.gameOver && stateRef.current !== "gameover") {
        setPhase("gameover");
        setStats(buildEndStats(engine));
        render();
        return;
      }
      if (!engine.playing) {
        render();
        return;
      }

      const dt = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;
      engine.update(Math.min(dt, 100), performance.now());

      setDisplayTime(formatTime(engine.clock));
      setDisplayLines(engine.linesRemaining);
      const pps =
        engine.clock > 0
          ? (engine.placedBlocks / engine.clock).toFixed(2)
          : "0.00";
      setDisplayPPS(pps);
      setDisplayAction(engine.lastAction);
      setActionKey((k) => k + 1);
      setDisplayAttack(engine.totalAttack);
      if (engine.replay.length !== logLenRef.current) {
        logLenRef.current = engine.replay.length;
        setLog({ events: engine.replay.slice(-40), total: engine.replay.length });
      }

      if (engine.completed) {
        sfx.win();
        setPhase("completed");
        setStats(buildEndStats(engine));
        render();
        return;
      }
      if (engine.gameOver) {
        setPhase("gameover");
        setStats(buildEndStats(engine));
        render();
        return;
      }

      render();
      rafRef.current = requestAnimationFrame(gameLoopRef.current);
    };
  }, [render, buildEndStats]);

  // ─── START GAME (with countdown) ───
  const launchGame = useCallback(() => {
    const s = settingsRef.current;
    const engine = new BlockEngine({
      das: s.das,
      arr: s.arr,
      sdf: s.sdf,
      sprintLines,
    });
    engineRef.current = engine;
    prevPlacedRef.current = 0;
    logLenRef.current = 0;
    setLog({ events: [], total: 0 });
    engine.start();
    setPhase("playing");
    setDisplayAction("");
    setDisplayAttack(0);
    setStats(null);
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(gameLoopRef.current);
  }, [sprintLines]);

  const countdownRef = useRef(null);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    setPhase("countdown");
    setCountdownText("Ready");
    countdownRef.current = setTimeout(() => {
      setCountdownText("Go");
      countdownRef.current = setTimeout(() => {
        launchGame();
      }, 500);
    }, 700);
  }, [launchGame]);

  // ─── KEY HANDLING ───
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const action = keysRef.current[e.code];

      if (e.code === "KeyF") {
        if (phase === "playing" || phase === "gameover" || phase === "completed") {
          startGame();
          return;
        }
      }
      if (e.code === "KeyC") {
        if ((phase === "completed" || phase === "gameover") && stats?.replayText) {
          navigator.clipboard
            .writeText(stats.replayText)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
            .catch((err) => console.error("Copy failed:", err));
          return;
        }
      }
      if (e.key === "Escape") {
        if (phase === "playing" || phase === "gameover" || phase === "completed") {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          setPhase("select");
          return;
        }
        if (phase === "select") {
          onBack();
          return;
        }
      }
      if (e.code === "Enter" && phase === "select") {
        e.preventDefault();
        startGame();
        return;
      }
      if ((e.code === "ArrowUp" || e.code === "ArrowDown") && phase === "select") {
        e.preventDefault();
        const i = SPRINT_OPTIONS.indexOf(sprintLines);
        const next = SPRINT_OPTIONS[Math.min(SPRINT_OPTIONS.length - 1, Math.max(0, i + (e.code === "ArrowDown" ? 1 : -1)))];
        if (next !== sprintLines) {
          sfx.tick();
          setSprintLines(next);
        }
        return;
      }

      if (!action || phase !== "playing") return;
      e.preventDefault();
      engineRef.current?.onKeyDown(action, performance.now());
      sfxForAction(action);
    };
    const handleKeyUp = (e) => {
      const action = keysRef.current[e.code];
      if (!action) return;
      engineRef.current?.onKeyUp(action);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [phase, startGame, stats, onBack, sprintLines]);

  // Reload bindings whenever entering select (settings may have been edited)
  useEffect(() => {
    if (phase === "select") {
      keysRef.current = buildKeyMap(loadKeyBindings().solo);
    }
  }, [phase]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, []);

  const copyReplay = async () => {
    if (!stats?.replayText) return;
    try {
      await navigator.clipboard.writeText(stats.replayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  // ─── SELECT SCREEN ───
  if (phase === "select") {
    return (
      <div className="page" style={{ "--accent": "#41b6e6" }}>
        <h1 className="title">Sprint</h1>
        <p className="lede">Clear the lines as fast as you can. The clock starts on the first piece.</p>
        <div className="opts center">
          <div className="opt">
            <div className="k">Lines</div>
            {/* Plenty of room here, so the choices are big buttons in a column */}
            <div className="choice-list" role="radiogroup" aria-label="Lines">
              {SPRINT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={sprintLines === n}
                  className={sprintLines === n ? "on" : ""}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (n !== sprintLines) sfx.tick();
                    setSprintLines(n);
                  }}
                >
                  <span className="n">{n}</span>
                  <span className="u">{n === 1 ? "line" : "lines"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="opt">
            <div className="k">Handling</div>
            <div className="dim small">
              DAS {settings.das} ms · ARR {settings.arr} ms · SDF {settings.sdf === 100 ? "∞" : settings.sdf}
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={startGame}>
            Start
          </button>
          <button className="btn ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const linesColor = displayLines <= 5 ? "var(--bad)" : undefined;

  // ─── GAME VIEW ───
  return (
    <>
      <div className="mode-label">Sprint · {sprintLines} lines</div>
      <div className="play" style={{ zoom }}>
        {settings.showLog !== false && <ReplayLog events={log.events} total={log.total} />}
        <div className="side">
          <div>
            <div className="k">Hold</div>
            <canvas ref={holdRef} width={HOLD_W} height={HOLD_H} style={{ marginTop: 8 }} />
          </div>
          <Stat k="Time" v={displayTime} big />
          <div className="stat">
            <div className="k">Lines left</div>
            <div className="v big" style={{ color: linesColor }}>
              {displayLines}
            </div>
          </div>
          <Stat k="PPS" v={displayPPS} />
          <Stat k="Attack" v={displayAttack} />
          {settings.showKeys && <KeyStrokes />}
        </div>

        <div className="board-wrap">
          <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-frame" />

          {phase === "countdown" && <Countdown text={countdownText} />}

          {displayAction && (
            <div key={actionKey} className="action-pop">
              {displayAction}
            </div>
          )}

          {phase === "completed" && stats && (
            <div className="veil">
              <div className="k">{sprintLines} lines cleared</div>
              <div className="title">
                {formatTime(stats.time)}
              </div>
              <div className="grid2">
                <Stat k="Pieces" v={stats.blocks} />
                <Stat k="PPS" v={stats.pps.toFixed(2)} />
                <Stat k="Attack" v={stats.attack} />
                <Stat k="Quads" v={stats.quads} />
                <Stat k="T-spins" v={stats.tspins} />
                <Stat k="Max combo" v={stats.maxCombo} />
              </div>
              <div className="row-btns">
                <button className="btn primary" onClick={startGame}>
                  Again
                </button>
                <button className="btn" onClick={copyReplay}>
                  {copied ? (
                    <>
                      <svg className="btn-check" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    "Copy log"
                  )}
                </button>
                <button className="btn ghost" onClick={onBack}>
                  Menu
                </button>
              </div>
            </div>
          )}

          {phase === "gameover" && (
            <div className="veil">
              <div className="k">Top out</div>
              <div className="title">
                {stats?.lines || 0} lines in {formatTime(stats?.time || 0)}
              </div>
              <div className="row-btns">
                <button className="btn primary" onClick={startGame}>
                  Again
                </button>
                {stats?.replayText && (
                  <button className="btn" onClick={copyReplay}>
                    {copied ? (
                    <>
                      <svg className="btn-check" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    "Copy log"
                  )}
                  </button>
                )}
                <button className="btn ghost" onClick={onBack}>
                  Menu
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="side right">
          <div>
            <div className="k">Next</div>
            <canvas ref={queueRef} width={HOLD_W} height={SLOT * 5} style={{ marginTop: 8 }} />
          </div>
          <KeyHints style={{ flexDirection: "column", alignItems: "flex-start" }} items={[[["F"], "restart"], [["Esc"], "exit"]]} />
        </div>
      </div>
    </>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { ROWS, CELL, BlockEngine } from "../game.js";
import { CPUPlayer } from "../cpu.js";
import { buildKeyMap, loadKeyBindings } from "../keys.js";
import { drawBoard, drawHold, drawQueue, prep, BOARD_W, BOARD_H, HOLD_W, HOLD_H, SLOT } from "../render.js";
import { Segmented, Countdown, KeyHints } from "../ui.jsx";
import { useFit } from "../fit.js";

const METER_W = 6;

function createEngine(settings) {
  return new BlockEngine({
    das: settings.das,
    arr: settings.arr,
    sdf: settings.sdf,
    sprintLines: 999999, // never trigger sprint completion
  });
}

function PlayerBoard({ engineRef, label, sub, result, mirror }) {
  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const queueRef = useRef(null);
  const meterRef = useRef(null);

  useEffect(() => {
    let raf;
    const tick = () => {
      const engine = engineRef.current;
      drawBoard(canvasRef.current, engine, { dead: engine?.gameOver });
      if (engine) {
        drawHold(holdRef.current, engine.hold, engine.holdUsed);
        drawQueue(queueRef.current, engine.queue);
        const m = meterRef.current;
        if (m) {
          const ctx = prep(m, METER_W, BOARD_H);
          ctx.fillStyle = "#141414";
          ctx.fillRect(0, 0, METER_W, BOARD_H);
          let pending = 0;
          for (const g of engine.garbageQueue) pending += g.amount;
          const n = Math.min(pending, ROWS);
          ctx.fillStyle = n >= 4 ? "#e8505b" : "#ebebeb";
          ctx.fillRect(0, BOARD_H - n * CELL, METER_W, n * CELL);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engineRef]);

  const hold = (
    <div className="side" style={{ width: HOLD_W }}>
      <div>
        <div className="k">Hold</div>
        <canvas ref={holdRef} width={HOLD_W} height={HOLD_H} style={{ marginTop: 8 }} />
      </div>
      <div>
        <div className="v s">{label}</div>
        {sub && <div className="k" style={{ marginTop: 4 }}>{sub}</div>}
        {result && <div className="k" style={{ marginTop: 12, color: "var(--fg)" }}>{result}</div>}
      </div>
    </div>
  );
  const next = (
    <div className="side right" style={{ width: HOLD_W }}>
      <div>
        <div className="k">Next</div>
        <canvas ref={queueRef} width={HOLD_W} height={SLOT * 5} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
  const board = (
    <div style={{ display: "flex", gap: 6, flexDirection: mirror ? "row-reverse" : "row" }}>
      <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-frame" style={{ opacity: result === "Lost" ? 0.5 : 1 }} />
      <canvas ref={meterRef} width={METER_W} height={BOARD_H} />
    </div>
  );

  return (
    <div className="play" style={{ gap: 20 }}>
      {hold}
      {board}
      {next}
    </div>
  );
}

export default function Battle({ settings, onBack }) {
  const zoom = useFit(1040, 600);
  // select | countdown | playing | finished
  const [phase, setPhase] = useState("select");
  const [opponent, setOpponent] = useState("cpu"); // cpu | player
  const [difficulty, setDifficulty] = useState("normal"); // easy | normal | hard
  const [selectIdx, setSelectIdx] = useState(0);
  const [countdownText, setCountdownText] = useState("");
  const [, forceUpdate] = useState(0);
  const [winner, setWinner] = useState(null); // "p1" | "p2"

  const engine1Ref = useRef(null);
  const engine2Ref = useRef(null);
  const cpuRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef("select");
  const settingsRef = useRef(settings);
  const countdownRef = useRef(null);
  const loopRef = useRef(null);

  // Key map per player
  const p1KeysRef = useRef({});
  const p2KeysRef = useRef({});

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const reloadKeys = useCallback(() => {
    const all = loadKeyBindings();
    if (opponent === "cpu") {
      p1KeysRef.current = buildKeyMap(all.solo);
      p2KeysRef.current = {};
    } else {
      p1KeysRef.current = buildKeyMap(all.p1);
      p2KeysRef.current = buildKeyMap(all.p2);
    }
  }, [opponent]);

  useEffect(() => {
    reloadKeys();
  }, [reloadKeys]);

  const setOpponentAndResetFocus = useCallback((next) => {
    setOpponent(next);
    setSelectIdx(0);
  }, []);

  // Shared loop, ref-based to avoid stale closures.
  useEffect(() => {
    loopRef.current = (timestamp) => {
      const e1 = engine1Ref.current;
      const e2 = engine2Ref.current;
      if (!e1 || !e2 || phaseRef.current !== "playing") return;

      const dt = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;
      const cappedDt = Math.min(dt, 100);
      const now = performance.now();

      e1.update(cappedDt, now);
      e2.update(cappedDt, now);
      cpuRef.current?.update(now);

      // Hand over attack whenever it is there: player pieces lock inside key
      // handlers, between frames, so "placed this frame" would miss them.
      if (e1.outgoingAttack > 0) {
        e2.receiveGarbage(e1.outgoingAttack);
        e1.outgoingAttack = 0;
      }
      if (e2.outgoingAttack > 0) {
        e1.receiveGarbage(e2.outgoingAttack);
        e2.outgoingAttack = 0;
      }

      forceUpdate((x) => x + 1);

      if (e1.gameOver || e2.gameOver) {
        const w = e1.gameOver ? "p2" : "p1";
        setWinner(w);
        setPhase("finished");
        return;
      }

      rafRef.current = requestAnimationFrame(loopRef.current);
    };
  }, []);

  const launch = useCallback(() => {
    const e1 = createEngine(settingsRef.current);
    const e2 = createEngine(settingsRef.current);
    e1.start();
    e2.start();
    engine1Ref.current = e1;
    engine2Ref.current = e2;
    cpuRef.current = opponent === "cpu" ? new CPUPlayer(e2, difficulty) : null;
    setWinner(null);
    phaseRef.current = "playing";
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [opponent, difficulty]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    reloadKeys();
    setPhase("countdown");
    setCountdownText("Ready");
    countdownRef.current = setTimeout(() => {
      setCountdownText("Go");
      countdownRef.current = setTimeout(() => {
        launch();
      }, 500);
    }, 700);
  }, [launch, reloadKeys]);

  // Key handling for in-game.
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === "Escape" || e.key === "Escape") {
        if (phase === "playing" || phase === "finished" || phase === "countdown") {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          if (countdownRef.current) clearTimeout(countdownRef.current);
          setPhase("select");
        } else if (phase === "select") {
          onBack();
        }
        return;
      }
      if (e.code === "KeyF" && (phase === "playing" || phase === "finished")) {
        e.preventDefault();
        startGame();
        return;
      }
      if (phase !== "playing") return;
      if (e.repeat) return;

      const a1 = p1KeysRef.current[e.code];
      if (a1) {
        e.preventDefault();
        engine1Ref.current?.onKeyDown(a1, performance.now());
        return;
      }
      const a2 = p2KeysRef.current[e.code];
      if (a2) {
        e.preventDefault();
        engine2Ref.current?.onKeyDown(a2, performance.now());
      }
    };
    const onUp = (e) => {
      const a1 = p1KeysRef.current[e.code];
      if (a1) engine1Ref.current?.onKeyUp(a1);
      const a2 = p2KeysRef.current[e.code];
      if (a2) engine2Ref.current?.onKeyUp(a2);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [phase, onBack, startGame]);

  // Cleanup
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (countdownRef.current) clearTimeout(countdownRef.current);
    },
    [],
  );

  // ─── SELECT SCREEN ───
  if (phase === "select") {
    const items = [
      { id: "opponent" },
      ...(opponent === "cpu" ? [{ id: "difficulty" }] : []),
      { id: "start" },
      { id: "back" },
    ];
    const cur = items[selectIdx]?.id;
    return (
      <div className="page" style={{ "--accent": "#e8505b" }}>
        <h1 className="title">Battle</h1>
        <p className="lede">
          First to top out loses. Line clears send garbage; clearing while garbage is queued cancels it.
        </p>
        <div className="opts">
          <div className={"opt" + (cur === "opponent" ? " focus" : "")}>
            <div className="k">Opponent</div>
            <Segmented
              label="Opponent"
              options={[
                { id: "cpu", label: "CPU" },
                { id: "player", label: "Player 2" },
              ]}
              value={opponent}
              onChange={setOpponentAndResetFocus}
              focus={cur === "opponent"}
            />
          </div>
          {opponent === "cpu" ? (
            <div className={"opt" + (cur === "difficulty" ? " focus" : "")}>
              <div className="k">Difficulty</div>
              <Segmented
                label="Difficulty"
                options={[
                  { id: "easy", label: "Easy" },
                  { id: "normal", label: "Normal" },
                  { id: "hard", label: "Hard" },
                ]}
                value={difficulty}
                onChange={setDifficulty}
                focus={cur === "difficulty"}
              />
            </div>
          ) : (
            <div className="opt">
              <div className="k">Keys</div>
              <div className="dim small">P1 and P2 use their own bindings. Change them in Settings.</div>
            </div>
          )}
        </div>
        <div className="actions">
          <button className={"btn primary" + (cur === "start" ? " focus" : "")} onClick={startGame}>
            Start
          </button>
          <button className={"btn ghost" + (cur === "back" ? " focus" : "")} onClick={onBack}>
            Back
          </button>
          <KeyHints items={[[["↑", "↓"], "move"], [["←", "→"], "change"], [["Enter"], "select"]]} />
        </div>

        <BattleSelectKeyboard
          itemsCount={items.length}
          setSelectIdx={setSelectIdx}
          onLeftRight={(dir) => {
            if (cur === "opponent") {
              setOpponentAndResetFocus(opponent === "cpu" ? "player" : "cpu");
            } else if (cur === "difficulty") {
              setDifficulty((d) => {
                const order = ["easy", "normal", "hard"];
                const i = order.indexOf(d);
                return order[(i + (dir > 0 ? 1 : order.length - 1)) % order.length];
              });
            }
          }}
          onEnter={() => {
            if (cur === "back") onBack();
            else startGame();
          }}
        />
      </div>
    );
  }

  const nameP2 = opponent === "cpu" ? "CPU" : "P2";
  const subP2 = opponent === "cpu" ? difficulty[0].toUpperCase() + difficulty.slice(1) : null;
  const done = phase === "finished";

  return (
    <>
      <div className="mode-label">Battle · {opponent === "cpu" ? "vs CPU" : "vs Player"}</div>
      <div style={{ position: "relative" }}>
        {/* When the match ends the boards fade back instead of being covered by a
            dark box, so the page background and grid stay continuous. */}
        <div
          style={{
            display: "flex",
            gap: 56,
            alignItems: "flex-start",
            zoom,
            opacity: done ? 0.12 : 1,
            transition: "opacity 0.35s var(--out)",
          }}
        >
          <PlayerBoard
            engineRef={engine1Ref}
            label="P1"
            result={done ? (winner === "p1" ? "Won" : "Lost") : null}
          />
          <PlayerBoard
            engineRef={engine2Ref}
            label={nameP2}
            sub={subP2}
            result={done ? (winner === "p2" ? "Won" : "Lost") : null}
          />
        </div>
        {phase === "countdown" && <Countdown text={countdownText} />}
        <KeyHints
          style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 24 }}
          items={[[["F"], "rematch"], [["Esc"], "setup"]]}
        />

        {done && (
          <div className="veil" style={{ alignItems: "center", textAlign: "center", background: "transparent" }}>
            <div className="k">{winner === "p1" ? `${nameP2} topped out` : "P1 topped out"}</div>
            <div className="title">
              {winner === "p1" ? "P1 wins" : `${nameP2} wins`}
            </div>
            <div className="row-btns" style={{ width: 220 }}>
              <button className="btn primary" onClick={startGame} autoFocus>
                Rematch
              </button>
              <button className="btn" onClick={() => setPhase("select")}>
                Change setup
              </button>
              <button className="btn ghost" onClick={onBack}>
                Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── SELECT-SCREEN KEYBOARD ───
function BattleSelectKeyboard({ itemsCount, setSelectIdx, onLeftRight, onEnter }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        setSelectIdx((i) => (i + 1) % itemsCount);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setSelectIdx((i) => (i - 1 + itemsCount) % itemsCount);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        onLeftRight(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        onLeftRight(1);
      } else if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [itemsCount, setSelectIdx, onLeftRight, onEnter]);
  return null;
}

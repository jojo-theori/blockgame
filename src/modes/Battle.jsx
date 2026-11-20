import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { ROWS, CELL, BlockEngine } from "../game.js";
import { CPUPlayer } from "../cpu.js";
import { buildKeyMap, loadKeyBindings } from "../keys.js";
import { drawBoard, drawHold, drawQueue, prep, BOARD_W, BOARD_H, HOLD_W, HOLD_H, SLOT } from "../render.js";
import { Countdown, KeyHints, Dropdown } from "../ui.jsx";
import { sfx, sfxForAction, trackSfx } from "../sound.js";
import { useFit } from "../fit.js";

const METER_W = 6;

const WHO = [
  { id: "p1", label: "Player 1" },
  { id: "cpu", label: "CPU" },
  { id: "p2", label: "Player 2" },
];
const LEVELS = [
  { id: "easy", label: "Easy" },
  { id: "normal", label: "Normal" },
  { id: "hard", label: "Hard" },
];
const SEAT_COLOR = { p1: "#41b6e6", p2: "#e8505b", cpu: "#8a8a8a" };

// A seat in the match: who plays it, and the CPU level when it's the CPU.
function SeatCard({ seat, seats, humans }) {
  const isCpu = seat.who === "cpu";
  const name = WHO.find((w) => w.id === seat.who).label;
  const sub = isCpu ? "Computer" : humans === 1 ? "Solo keys" : `${seat.who === "p1" ? "P1" : "P2"} keys`;
  // Picking a player who already sits elsewhere swaps the two seats.
  const options = WHO.map((w) => {
    const takenBy = w.id !== "cpu" && seats.find((o) => o !== seat && o.who === w.id);
    return { ...w, note: takenBy ? `Swap with seat ${takenBy.n}` : null };
  });
  const choose = (id) => {
    const other = id !== "cpu" && seats.find((o) => o !== seat && o.who === id);
    if (other) other.setWho(seat.who);
    seat.setWho(id);
  };
  return (
    <div className="seat" style={{ "--seat": SEAT_COLOR[seat.who] }}>
      <div className="k">Seat {seat.n}</div>
      <div className="seat-id">
        <div className="seat-name">{name}</div>
        <div className="seat-sub">{sub}</div>
      </div>
      <div className="seat-fields">
        <Dropdown label={`Seat ${seat.n} player`} value={seat.who} options={options} onChange={choose} />
        {/* Always rendered so switching to/from CPU never shifts the layout */}
        <div style={{ visibility: isCpu ? "visible" : "hidden" }}>
          <Dropdown label={`Seat ${seat.n} CPU level`} value={seat.level} options={LEVELS} onChange={seat.setLevel} />
        </div>
      </div>
    </div>
  );
}

function loadBattlePrefs() {
  try {
    return JSON.parse(localStorage.getItem("jbl-battle") || "{}");
  } catch {
    return {};
  }
}

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
          // Ready garbage (will rise on the next drop) is solid; garbage that
          // is still charging sits above it, dimmed.
          const { ready, charging } = engine.garbageCounts();
          const r = Math.min(ready, ROWS);
          const ch = Math.min(charging, ROWS - r);
          ctx.fillStyle = r >= 4 ? "#e8505b" : "#ebebeb";
          ctx.fillRect(0, BOARD_H - r * CELL, METER_W, r * CELL);
          ctx.fillStyle = "rgba(235, 235, 235, 0.28)";
          ctx.fillRect(0, BOARD_H - (r + ch) * CELL, METER_W, ch * CELL);
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

export default function Battle({ settings, onBack, onSettings }) {
  const zoom = useFit(1040, 600);
  // select | countdown | playing | finished
  const [phase, setPhase] = useState("select");
  // Each side is Player 1, Player 2 or CPU (a human can only be on one side).
  const saved = loadBattlePrefs();
  const [left, setLeft] = useState(saved.left ?? "p1");
  const [right, setRight] = useState(saved.right ?? "cpu");
  const [leftLevel, setLeftLevel] = useState(saved.leftLevel ?? "normal");
  const [rightLevel, setRightLevel] = useState(saved.rightLevel ?? "normal");
  const [countdownText, setCountdownText] = useState("");
  const [, forceUpdate] = useState(0);
  const [winner, setWinner] = useState(null); // "p1" | "p2"

  const engine1Ref = useRef(null);
  const engine2Ref = useRef(null);
  const cpusRef = useRef([]);
  const seatsRef = useRef(["p1", "cpu"]);
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
  useEffect(() => {
    try {
      localStorage.setItem("jbl-battle", JSON.stringify({ left, right, leftLevel, rightLevel }));
    } catch {
      /* ignore */
    }
  }, [left, right, leftLevel, rightLevel]);

  const reloadKeys = useCallback(() => {
    const all = loadKeyBindings();
    const humans = [left, right].filter((x) => x !== "cpu").length;
    const mapFor = (slot) => (slot === "cpu" ? {} : buildKeyMap(humans === 1 ? all.solo : all[slot]));
    p1KeysRef.current = mapFor(left);
    p2KeysRef.current = mapFor(right);
  }, [left, right]);

  useEffect(() => {
    reloadKeys();
  }, [reloadKeys]);

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
      for (const cpu of cpusRef.current) cpu.update(now);

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

      // Sounds follow the human players' boards only (CPU boards stay quiet).
      if (seatsRef.current[0] !== "cpu") trackSfx(e1, { topout: false });
      if (seatsRef.current[1] !== "cpu") trackSfx(e2, { topout: false });

      forceUpdate((x) => x + 1);

      if (e1.gameOver || e2.gameOver) {
        const w = e1.gameOver ? "p2" : "p1";
        const winnerSeat = seatsRef.current[w === "p1" ? 0 : 1];
        const humans = seatsRef.current.filter((x) => x !== "cpu").length;
        if (winnerSeat !== "cpu" || humans === 0) sfx.win();
        else sfx.lose();
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
    seatsRef.current = [left, right];
    cpusRef.current = [
      left === "cpu" ? new CPUPlayer(e1, leftLevel) : null,
      right === "cpu" ? new CPUPlayer(e2, rightLevel) : null,
    ].filter(Boolean);
    setWinner(null);
    phaseRef.current = "playing";
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [left, right, leftLevel, rightLevel]);

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
      if (phase === "select" && (e.code === "Enter" || e.code === "NumpadEnter")) {
        e.preventDefault();
        startGame();
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
        sfxForAction(a1);
        return;
      }
      const a2 = p2KeysRef.current[e.code];
      if (a2) {
        e.preventDefault();
        engine2Ref.current?.onKeyDown(a2, performance.now());
        sfxForAction(a2);
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
    // One card per seat. Built from an array so more seats can be added later.
    const seats = [
      { n: 1, who: left, setWho: setLeft, level: leftLevel, setLevel: setLeftLevel },
      { n: 2, who: right, setWho: setRight, level: rightLevel, setLevel: setRightLevel },
    ];
    const bothCpu = left === "cpu" && right === "cpu";
    const humans = [left, right].filter((x) => x !== "cpu").length;
    return (
      <div className="page wide" style={{ "--accent": "#e8505b" }}>
        <h1 className="title">Battle</h1>
        <p className="lede">
          First to top out loses. Line clears send garbage; clearing while garbage is queued cancels it.
        </p>
        <div className="opts fill">
          <div className="seats">
            {seats.map((seat, i) => (
              <Fragment key={seat.n}>
                {i > 0 && (
                  <div className="vs">
                    <span>vs</span>
                    <button
                      type="button"
                      className="swap"
                      aria-label="Swap seats"
                      title="Swap seats"
                      onClick={() => {
                        const a = seats[i - 1];
                        const b = seat;
                        const [aw, al] = [a.who, a.level];
                        a.setWho(b.who);
                        a.setLevel(b.level);
                        b.setWho(aw);
                        b.setLevel(al);
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 7h11l-3-3M17 17H6l3 3" />
                      </svg>
                    </button>
                  </div>
                )}
                <SeatCard seat={seat} seats={seats} humans={humans} />
              </Fragment>
            ))}
          </div>
          <p className="note slot-note">
            {bothCpu ? (
              <span className="warn">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3.5 22 20.5H2Z" />
                  <path d="M12 10v4.5M12 17.2v.3" />
                </svg>
                Both sides are CPU, so you&apos;ll be watching.
              </span>
            ) : humans === 2 ? (
              <>
                Player 1 and Player 2 use their own keys. Change them in{" "}
                <button type="button" className="link" onClick={onSettings}>
                  Settings
                </button>
                .
              </>
            ) : (
              <>
                You play with your solo keys. Change them in{" "}
                <button type="button" className="link" onClick={onSettings}>
                  Settings
                </button>
                .
              </>
            )}
          </p>
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

  const nameOf = (slot) => (slot === "cpu" ? "CPU" : slot === "p1" ? "P1" : "P2");
  const levelOf = (slot, lv) => (slot === "cpu" ? lv[0].toUpperCase() + lv.slice(1) : null);
  const nameP1 = nameOf(left);
  const nameP2 = nameOf(right);
  const done = phase === "finished";

  return (
    <>
      <div className="mode-label">
        Battle · {nameP1} vs {nameP2}
      </div>
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
            label={nameP1}
            sub={levelOf(left, leftLevel)}
            result={done ? (winner === "p1" ? "Won" : "Lost") : null}
          />
          <PlayerBoard
            engineRef={engine2Ref}
            label={nameP2}
            sub={levelOf(right, rightLevel)}
            result={done ? (winner === "p2" ? "Won" : "Lost") : null}
          />
        </div>
        {phase === "countdown" && <Countdown text={countdownText} />}
        <KeyHints
          style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 24 }}
          items={[[["F"], "rematch"], [["Esc"], "exit"]]}
        />

        {done && (
          <div className="veil" style={{ alignItems: "center", textAlign: "center", background: "transparent" }}>
            <div className="k">{winner === "p1" ? `${nameP2} topped out` : `${nameP1} topped out`}</div>
            <div className="title">
              {winner === "p1" ? `${nameP1} wins` : `${nameP2} wins`}
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

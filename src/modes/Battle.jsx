import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { t } from "../i18n.js";
import { ROWS, CELL, BlockEngine } from "../game.js";
import { CPUPlayer } from "../cpu.js";
import { BotPlayer } from "../bots/player.js";
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
  { id: "max", label: "Max" },
];
// Which engine plays the CPU seat. Stacker is JBL's own simple heuristic.
const BOTS = [
  { id: "cc", label: "Cold Clear" },
  { id: "misa", label: "MisaMino" },
  { id: "stacker", label: "Stacker", note: "Simple" },
];
const botName = (id) => BOTS.find((b) => b.id === id)?.label ?? "CPU";
const makeCpu = (engine, bot, level) => (bot === "stacker" ? new CPUPlayer(engine, level === "max" ? "hard" : level) : new BotPlayer(engine, bot, level));
// Handicap: lines added to (or taken from) every attack this seat sends.
// Lines added to (+) or taken from (−) every attack this seat sends.
const HANDICAPS = [3, 2, 1, 0, -1, -2, -3].map((h) => ({ id: h, label: h === 0 ? "0" : `${h > 0 ? "+" : "−"}${Math.abs(h)}` }));
const SEAT_COLOR = { p1: "#41b6e6", p2: "#e8505b", cpu: "#8a8a8a" };

// A seat in the match: who plays it, and the CPU level when it's the CPU.
function SeatCard({ seat, seats, humans }) {
  const isCpu = seat.who === "cpu";
  const name = WHO.find((w) => w.id === seat.who).label;
  const sub = isCpu ? botName(seat.bot) : t(humans === 1 ? "Solo keys" : seat.who === "p1" ? "P1 keys" : "P2 keys");
  // Picking a player who already sits elsewhere swaps the two seats.
  const options = WHO.map((w) => {
    const takenBy = w.id !== "cpu" && seats.find((o) => o !== seat && o.who === w.id);
    return { ...w, note: takenBy ? t("Swap with seat {n}", { n: takenBy.n }) : null };
  });
  const choose = (id) => {
    const other = id !== "cpu" && seats.find((o) => o !== seat && o.who === id);
    if (other) other.setWho(seat.who);
    seat.setWho(id);
  };
  return (
    <div className="seat" style={{ "--seat": SEAT_COLOR[seat.who] }}>
      <div className="k">{t("Seat {n}", { n: seat.n })}</div>
      <div className="seat-id">
        <div className="seat-name">{t(name)}</div>
        <div className="seat-sub">{sub}</div>
      </div>
      <div className="seat-fields">
        <Dropdown label={t("Seat {n} player", { n: seat.n })} value={seat.who} options={options} onChange={choose} />
        {/* Always rendered so switching to/from CPU never shifts the layout */}
        <div className="seat-row" style={{ visibility: isCpu ? "visible" : "hidden" }}>
          <Dropdown label={t("Seat {n} bot", { n: seat.n })} value={seat.bot} options={BOTS} onChange={seat.setBot} />
          <Dropdown label={t("Seat {n} CPU level", { n: seat.n })} value={seat.level} options={LEVELS} onChange={seat.setLevel} />
        </div>
        <div className="seat-hc">
          <span className="k" title={t("Lines added to or taken from every attack")}>{t("Handicap")}</span>
          <div className="seat-hc-dd">
            <Dropdown label={t("Seat {n} handicap", { n: seat.n })} value={seat.handicap} options={HANDICAPS} onChange={seat.setHandicap} />
          </div>
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

function createEngine(settings, attackBonus = 0, seed) {
  return new BlockEngine({
    attackBonus,
    seed,
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
        <div className="k">{t("Hold")}</div>
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
        <div className="k">{t("Next")}</div>
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
  const [leftBot, setLeftBot] = useState(saved.leftBot ?? "cc");
  const [rightBot, setRightBot] = useState(saved.rightBot ?? "cc");
  const [leftHandicap, setLeftHandicap] = useState(saved.leftHandicap ?? 0);
  const [rightHandicap, setRightHandicap] = useState(saved.rightHandicap ?? 0);
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
      localStorage.setItem("jbl-battle", JSON.stringify({ left, right, leftLevel, rightLevel, leftBot, rightBot, leftHandicap, rightHandicap }));
    } catch {
      /* ignore */
    }
  }, [left, right, leftLevel, rightLevel, leftBot, rightBot, leftHandicap, rightHandicap]);

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

  // Both boards are replaced at once when a match (re)starts, so the two sides
  // always begin together; the countdown then starts them.
  const launch = useCallback(() => {
    const e1 = engine1Ref.current;
    const e2 = engine2Ref.current;
    e1.start();
    e2.start();
    seatsRef.current = [left, right];
    cpusRef.current = [
      left === "cpu" ? makeCpu(e1, leftBot, leftLevel) : null,
      right === "cpu" ? makeCpu(e2, rightBot, rightLevel) : null,
    ].filter(Boolean);
    setWinner(null);
    phaseRef.current = "playing";
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [left, right, leftLevel, rightLevel, leftBot, rightBot]);

  const runCountdown = useCallback(() => {
    if (countdownRef.current) clearTimeout(countdownRef.current);
    setPhase("countdown");
    setCountdownText("Ready");
    countdownRef.current = setTimeout(() => {
      setCountdownText("Go");
      countdownRef.current = setTimeout(launch, 500);
    }, 700);
  }, [launch]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    reloadKeys();
    // Same seed on both sides: both players get exactly the same pieces.
    const seed = Math.floor(Math.random() * 2 ** 31);
    engine1Ref.current = createEngine(settingsRef.current, leftHandicap, seed);
    engine2Ref.current = createEngine(settingsRef.current, rightHandicap, seed);
    for (const c of cpusRef.current) c.dispose?.();
    cpusRef.current = [];
    setWinner(null);
    runCountdown();
  }, [runCountdown, reloadKeys, leftHandicap, rightHandicap]);

  // Pause (Esc). A match is shared, so nothing restarts from a single key:
  // rematch and exit live in the pause menu.
  const pausedFromRef = useRef(null);
  const pause = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    pausedFromRef.current = phaseRef.current;
    // Let go of every held key so nothing keeps moving after the pause.
    for (const e of [engine1Ref.current, engine2Ref.current]) {
      if (!e) continue;
      for (const a of ["left", "right", "softdrop"]) e.onKeyUp(a);
    }
    phaseRef.current = "paused";
    setPhase("paused");
  }, []);
  const resume = useCallback(() => {
    if (pausedFromRef.current === "countdown") {
      runCountdown();
      return;
    }
    phaseRef.current = "playing";
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [runCountdown]);
  const toSetup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    setPhase("select");
  }, []);

  // Key handling for in-game.
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === "Escape" || e.key === "Escape") {
        if (phase === "playing" || phase === "countdown") pause();
        else if (phase === "paused") resume();
        else if (phase === "finished") toSetup();
        else if (phase === "select") onBack();
        return;
      }
      if (phase === "select" && (e.code === "Enter" || e.code === "NumpadEnter")) {
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
  }, [phase, onBack, startGame, pause, resume, toSetup]);

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
      { n: 1, who: left, setWho: setLeft, bot: leftBot, setBot: setLeftBot, level: leftLevel, setLevel: setLeftLevel, handicap: leftHandicap, setHandicap: setLeftHandicap },
      { n: 2, who: right, setWho: setRight, bot: rightBot, setBot: setRightBot, level: rightLevel, setLevel: setRightLevel, handicap: rightHandicap, setHandicap: setRightHandicap },
    ];
    const bothCpu = left === "cpu" && right === "cpu";
    const humans = [left, right].filter((x) => x !== "cpu").length;
    return (
      <div className="page wide" style={{ "--accent": "#e8505b" }}>
        <h1 className="title">{t("Battle")}</h1>
        <p className="lede">
          {t("First to top out loses. Line clears send garbage; clearing while garbage is queued cancels it.")}
        </p>
        <div className="opts fill">
          <div className="seats">
            {seats.map((seat, i) => (
              <Fragment key={seat.n}>
                {i > 0 && (
                  <div className="vs">
                    <button
                      type="button"
                      className="swap"
                      aria-label={t("Swap seats")}
                      title={t("Swap seats")}
                      onClick={() => {
                        const a = seats[i - 1];
                        const b = seat;
                        const [aw, al, ah, ab] = [a.who, a.level, a.handicap, a.bot];
                        a.setWho(b.who);
                        a.setLevel(b.level);
                        a.setBot(b.bot);
                        b.setBot(ab);
                        a.setHandicap(b.handicap);
                        b.setWho(aw);
                        b.setLevel(al);
                        b.setHandicap(ah);
                      }}
                    >
                      <span className="swap-vs" aria-hidden="true">vs</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 9.5h11l-2.5-2.5M17 14.5H6l2.5 2.5" />
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
                {t("Both sides are CPU, so you'll be watching.")}
              </span>
            ) : humans === 2 ? (
              <>
                {t("Player 1 and Player 2 use their own keys. Change them in")}{" "}
                <button type="button" className="link" onClick={onSettings}>
                  {t("Settings")}
                </button>
                .
              </>
            ) : (
              <>
                {t("You play with your solo keys. Change them in")}{" "}
                <button type="button" className="link" onClick={onSettings}>
                  {t("Settings")}
                </button>
                .
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={startGame}>
            {t("Start")}
          </button>
          <button className="btn ghost" onClick={onBack}>
            {t("Back")}
          </button>
        </div>
      </div>
    );
  }

  const nameOf = (slot, bot) => (slot === "cpu" ? botName(bot) : slot === "p1" ? "P1" : "P2");
  const levelOf = (slot, lv) => (slot === "cpu" ? t(lv[0].toUpperCase() + lv.slice(1)) : null);
  const nameP1 = nameOf(left, leftBot);
  const nameP2 = nameOf(right, rightBot);
  const done = phase === "finished";

  return (
    <>
      <div className="mode-label">
        {t("Battle")} · {nameP1} vs {nameP2}
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
            opacity: done || phase === "paused" ? 0.12 : 1,
            transition: "opacity 0.35s var(--out)",
          }}
        >
          <PlayerBoard
            engineRef={engine1Ref}
            label={nameP1}
            sub={levelOf(left, leftLevel)}
            result={done ? t(winner === "p1" ? "Won" : "Lost") : null}
          />
          <PlayerBoard
            engineRef={engine2Ref}
            label={nameP2}
            sub={levelOf(right, rightLevel)}
            result={done ? t(winner === "p2" ? "Won" : "Lost") : null}
          />
        </div>
        {phase === "countdown" && <Countdown text={countdownText} />}
        {phase === "paused" && (
          <div className="veil" style={{ alignItems: "center", textAlign: "center", background: "transparent" }}>
            <div className="title">{t("Paused")}</div>
            <div className="row-btns" style={{ width: 220 }}>
              <button className="btn primary" onClick={resume}>
                {t("Resume")}
              </button>
              <button className="btn" onClick={startGame}>
                {t("Rematch")}
              </button>
              <button className="btn" onClick={toSetup}>
                {t("Change setup")}
              </button>
              <button className="btn ghost" onClick={onBack}>
                {t("Menu")}
              </button>
            </div>
          </div>
        )}
        <KeyHints
          style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 24 }}
          items={[[["Esc"], phase === "paused" ? "resume" : "pause"]]}
        />

        {done && (
          <div className="veil" style={{ alignItems: "center", textAlign: "center", background: "transparent" }}>
            <div className="k">{t("{name} topped out", { name: winner === "p1" ? nameP2 : nameP1 })}</div>
            <div className="title">
              {t("{name} wins", { name: winner === "p1" ? nameP1 : nameP2 })}
            </div>
            <div className="row-btns" style={{ width: 220 }}>
              <button className="btn primary" onClick={startGame}>
                {t("Rematch")}
              </button>
              <button className="btn" onClick={() => setPhase("select")}>
                Change setup
              </button>
              <button className="btn ghost" onClick={onBack}>
                {t("Menu")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

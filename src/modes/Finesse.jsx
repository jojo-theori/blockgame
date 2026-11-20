import { useState, useEffect, useRef, useCallback } from "react";
import { ROWS, COLS, BlockEngine, formatTime } from "../game.js";
import { buildKeyMap, loadKeyBindings, keyLabel } from "../keys.js";
import { drawBoard, drawQueue, BOARD_W, BOARD_H, HOLD_W, SLOT } from "../render.js";
import { playDropSound } from "../sound.js";
import { Segmented, Stat, Countdown, KeyHints, Kbd } from "../ui.jsx";
import { useFit } from "../fit.js";
import { placements, bestPaths, sameCells } from "../finesse.js";

const ACCENT = "#5cc45c";
const PREFS_KEY = "jbl-finesse";
const GOALS = [20, 40, 100, 0]; // 0 = endless
const PIECES = [
  { id: 0, label: "All" },
  { id: 1, label: "I" },
  { id: 2, label: "T" },
  { id: 3, label: "L" },
  { id: 4, label: "J" },
  { id: 5, label: "S" },
  { id: 6, label: "Z" },
  { id: 7, label: "O" },
];
const EMPTY_HUD = { clock: 0, done: 0, faults: 0, clean: 0, last: null };

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function pickTarget(id, prevKey, allow180) {
  const all = placements(id);
  let t;
  do t = all[Math.floor(Math.random() * all.length)];
  while (all.length > 1 && t.key === prevKey);
  return { id, cells: t.cells, key: t.key, best: bestPaths(id, t.cells, { allow180 }) };
}

// Every optimal input (up to three), using the player's own bindings.
function BestInputs({ paths, bind }) {
  return (
    <div className="paths">
      {paths.slice(0, 3).map((p, i) => (
        <PathCaps key={i} path={p} bind={bind} />
      ))}
      {paths.length > 3 && <div className="note">+{paths.length - 3} more</div>}
    </div>
  );
}

// Key caps for one optimal path, using the player's own bindings.
function PathCaps({ path, bind }) {
  const cap = (a) => {
    if (a === "dasLeft") return `${keyLabel(bind.left)} hold`;
    if (a === "dasRight") return `${keyLabel(bind.right)} hold`;
    return keyLabel(bind[a]);
  };
  return (
    <span className="path">
      {path.map((a, i) => (
        <Kbd key={i}>{cap(a)}</Kbd>
      ))}
    </span>
  );
}

export default function Finesse({ settings, onBack }) {
  const zoom = useFit(700, 600);
  const prefs = loadPrefs();
  const [phase, setPhase] = useState("select"); // select | countdown | playing | done
  const [goal, setGoal] = useState(prefs.goal ?? 20);
  const [onFault, setOnFault] = useState(prefs.onFault ?? "retry"); // retry | continue
  const [piece, setPiece] = useState(prefs.piece ?? 0); // 0 = all pieces
  const [allow180, setAllow180] = useState(prefs.allow180 ?? true);
  const [countdownText, setCountdownText] = useState("");
  const [hud, setHud] = useState(EMPTY_HUD);
  const [bind, setBind] = useState(() => loadKeyBindings().solo);
  const [result, setResult] = useState(null);
  const [faultFlash, setFaultFlash] = useState(0);

  const canvasRef = useRef(null);
  const queueRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const loopRef = useRef(null);
  const lastTimeRef = useRef(0);
  const countdownRef = useRef(null);
  const settingsRef = useRef(settings);
  const bindRef = useRef(loadKeyBindings().solo);
  const keysRef = useRef(buildKeyMap(loadKeyBindings().solo));
  const run = useRef({ target: null, done: 0, faults: 0, clean: 0, keys: 0, last: null, reject: null, finished: false });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ goal, onFault, piece, allow180 }));
    } catch {
      /* ignore */
    }
  }, [goal, onFault, piece, allow180]);

  // ─── PLACEMENT CHECK ───
  const validate = useCallback(
    (cells, id, engine) => {
      const st = run.current;
      const t = st.target;
      const keys = engine.currentPieceKeys;
      const reject = () => {
        st.reject = { cells, t: performance.now() };
        setFaultFlash((n) => n + 1);
        return false;
      };
      if (!sameCells(cells, t.cells)) {
        st.faults++;
        st.last = { ok: false, spot: true, keys, best: t.best };
        return reject();
      }
      const clean = keys <= t.best.count;
      st.last = { ok: clean, keys, best: t.best };
      if (clean) st.clean++;
      else {
        st.faults++;
        if (onFault === "retry") return reject();
        setFaultFlash((n) => n + 1);
      }
      // Accepted: keep the board empty and aim the next piece.
      st.done++;
      st.keys += keys;
      for (const [r, c] of cells) if (r >= 0 && r < ROWS && c >= 0 && c < COLS) engine.matrix[r][c] = 0;
      if (goal && st.done >= goal) st.finished = true;
      else st.target = pickTarget(engine.queue[0], t.key, allow180);
      return true;
    },
    [goal, onFault, allow180],
  );

  // ─── RENDER ───
  const render = useCallback(() => {
    const engine = engineRef.current;
    const st = run.current;
    let guide = null;
    if (st.target && !st.finished) {
      guide = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
      for (const [r, c] of st.target.cells) guide[r][c] = st.target.id;
    }
    let reject = null;
    if (st.reject) {
      const age = (performance.now() - st.reject.t) / 600;
      if (age < 1) reject = { cells: st.reject.cells, alpha: 1 - age };
      else st.reject = null;
    }
    drawBoard(canvasRef.current, engine, { guide, reject });
    if (engine) drawQueue(queueRef.current, engine.queue);
  }, []);

  // ─── LOOP ───
  useEffect(() => {
    loopRef.current = (timestamp) => {
      const engine = engineRef.current;
      if (!engine) return;
      const st = run.current;
      const dt = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;
      const before = engine.placedBlocks;
      engine.update(Math.min(dt, 100), performance.now());
      if (engine.placedBlocks > before && settingsRef.current.soundEnabled) playDropSound();

      if (st.finished) {
        engine.playing = false;
        setHud({ clock: engine.clock, done: st.done, faults: st.faults, clean: st.clean, last: st.last });
        setResult({
          time: engine.clock,
          pieces: st.done,
          faults: st.faults,
          kpp: st.done ? st.keys / st.done : 0,
        });
        setPhase("done");
        render();
        return;
      }
      setHud({ clock: engine.clock, done: st.done, faults: st.faults, clean: st.clean, last: st.last });
      render();
      rafRef.current = requestAnimationFrame(loopRef.current);
    };
  }, [render]);

  useEffect(() => {
    render();
  }, [render, phase]);

  const launch = useCallback(() => {
    const s = settingsRef.current;
    const engine = new BlockEngine({
      das: s.das,
      arr: s.arr,
      sdf: s.sdf,
      sprintLines: 999999,
      sequence: piece ? new Array(5000).fill(piece) : null,
    });
    engine.validatePlacement = validate;
    engineRef.current = engine;
    engine.start();
    run.current = {
      target: pickTarget(engine.currentId, null, allow180),
      done: 0,
      faults: 0,
      clean: 0,
      keys: 0,
      last: null,
      reject: null,
      finished: false,
    };
    setResult(null);
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [validate, piece, allow180]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    bindRef.current = loadKeyBindings().solo;
    setBind(bindRef.current);
    setHud(EMPTY_HUD);
    const map = buildKeyMap(bindRef.current);
    delete map[bindRef.current.hold]; // no hold in finesse practice
    keysRef.current = map;
    engineRef.current = null;
    setPhase("countdown");
    setCountdownText("Ready");
    countdownRef.current = setTimeout(() => {
      setCountdownText("Go");
      countdownRef.current = setTimeout(launch, 350);
    }, 550);
  }, [launch]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearTimeout(countdownRef.current);
    if (engineRef.current?.playing && !goal && run.current.done) {
      // Endless: Esc ends the run and shows the result.
      run.current.finished = true;
      loopRef.current?.(performance.now());
      return;
    }
    setPhase("select");
  }, [goal]);

  // ─── KEYS ───
  useEffect(() => {
    const onDown = (e) => {
      if (phase === "select") {
        if (e.code === "Escape") return onBack();
        if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
          e.preventDefault();
          const d = e.code === "ArrowRight" ? 1 : -1;
          setGoal((g) => GOALS[(GOALS.indexOf(g) + d + GOALS.length) % GOALS.length]);
        } else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
          e.preventDefault();
          setOnFault((m) => (m === "retry" ? "continue" : "retry"));
        } else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
          e.preventDefault();
          startGame();
        }
        return;
      }
      if (e.code === "Escape") return phase === "done" ? setPhase("select") : stop();
      if (e.repeat) return;
      if (e.code === "KeyF" && phase !== "countdown") {
        e.preventDefault();
        return startGame();
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
      <div className="page" style={{ "--accent": ACCENT }}>
        <h1 className="title">Finesse</h1>
        <p className="lede">
          Drop each piece into the outlined spot with as few key presses as possible. Holding left or right to the
          wall counts as one press.
        </p>
        <div className="opts">
          <div className="opt">
            <div className="k">Pieces</div>
            <Segmented
              label="Pieces"
              options={GOALS.map((g) => ({ id: g, label: g ? String(g) : "Endless" }))}
              value={goal}
              onChange={setGoal}
            />
          </div>
          <div className="opt">
            <div className="k">Piece</div>
            <Segmented label="Piece" options={PIECES} value={piece} onChange={setPiece} />
          </div>
          <div className="opt">
            <div className="k">180 rotation</div>
            <Segmented
              label="180 rotation"
              options={[
                { id: true, label: "Use" },
                { id: false, label: "Don't use" },
              ]}
              value={allow180}
              onChange={setAllow180}
            />
          </div>
          <div className="opt">
            <div className="k">On a fault</div>
            <Segmented
              label="On a fault"
              options={[
                { id: "retry", label: "Retry piece" },
                { id: "continue", label: "Keep going" },
              ]}
              value={onFault}
              onChange={setOnFault}
            />
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={startGame}>
            Start
          </button>
          <button className="btn ghost" onClick={onBack}>
            Back
          </button>
          <KeyHints
            items={[
              [["←", "→"], "pieces"],
              [["↑", "↓"], "on a fault"],
              [["Enter"], "start"],
            ]}
          />
        </div>
      </div>
    );
  }

  // ─── PLAY ───
  const st = hud;
  const last = hud.last;
  // Accuracy: clean pieces out of every attempt that ended in a fault or a clean drop.
  const attempts = st.clean + st.faults;
  const acc = attempts ? Math.round((100 * st.clean) / attempts) : 100;

  return (
    <>
      <div className="mode-label">Finesse · {goal ? `${goal} pieces` : "Endless"}</div>
      <div className="play" style={{ zoom }}>
        <div className="side" style={{ width: 150 }}>
          <Stat k="Time" v={formatTime(hud.clock)} big />
          <Stat k="Pieces" v={goal ? `${st.done} / ${goal}` : st.done} />
          <div className="stat">
            <div className="k">Faults</div>
            <div key={faultFlash} className={"v" + (faultFlash ? " flash" : "")}>
              {st.faults}
            </div>
          </div>
          <Stat k="Accuracy" v={`${acc}%`} />
        </div>

        <div className="board-wrap">
          <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} className="board-frame" />
          {phase === "countdown" && <Countdown text={countdownText} />}
          {phase === "done" && result && (
            <div className="veil">
              <div className="k">{result.pieces} pieces</div>
              <div className="title">
                {result.faults === 0 ? "Clean" : `${result.faults} faults`}
              </div>
              <div className="grid2">
                <Stat k="Time" v={formatTime(result.time)} />
                <Stat k="Accuracy" v={`${acc}%`} />
                <Stat k="Keys / piece" v={result.kpp.toFixed(2)} />
                <Stat k="Pieces / sec" v={result.time ? (result.pieces / result.time).toFixed(2) : "0.00"} />
              </div>
              <div className="row-btns">
                <button className="btn primary" onClick={startGame}>
                  Again
                </button>
                <button className="btn ghost" onClick={() => setPhase("select")}>
                  Setup
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="side right" style={{ width: 180 }}>
          <div>
            <div className="k">Next</div>
            <canvas ref={queueRef} width={HOLD_W} height={SLOT * 5} style={{ marginTop: 8 }} />
          </div>
          <div>
            <div className="k" style={{ marginBottom: 8 }}>
              Last piece
            </div>
            {!last && <div className="note">Best input appears here after each piece.</div>}
            {last && (
              <div className={"last" + (last.ok ? " ok" : " bad")}>
                <div className="v xs">
                  {last.spot ? "Wrong spot" : last.ok ? "Clean" : `+${last.keys - last.best.count} keys`}
                </div>
                {!last.spot && (
                  <div className="note" style={{ margin: "4px 0 10px" }}>
                    {last.keys} pressed · best {last.best.count}
                  </div>
                )}
                {!last.ok && <BestInputs paths={last.best.paths} bind={bind} />}
              </div>
            )}
          </div>
          <KeyHints style={{ flexDirection: "column", alignItems: "flex-start" }} items={[[["F"], "restart"], [["Esc"], goal ? "setup" : "finish"]]} />
        </div>
      </div>
    </>
  );
}

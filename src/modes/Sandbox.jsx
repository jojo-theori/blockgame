// ─── Sandbox ───
// Build a board, set the piece order and the hold, then play it: for trying a
// setup, or showing one (a T-spin slot, a kick, an opener step) to someone.
// Edit → Play → (undo, restart, back to edit) as often as you like.
import { useState, useEffect, useRef, useCallback } from "react";
import { t } from "../i18n.js";
import { BlockEngine, COLS, ROWS, CELL, COLORS, PIECE_NAMES, getShape, buildLogText } from "../game.js";
import { buildKeyMap, loadKeyBindings, restartKey, keyLabel } from "../keys.js";
import { drawBoard, drawHold, drawQueue, cell as paintCell, BOARD_W, BOARD_H, HOLD_W, HOLD_H, SLOT } from "../render.js";
import { sfx, sfxForAction, trackSfx } from "../sound.js";
import { Stat, KeyHints, ReplayLog, KeyStrokes, PauseMenu, Dropdown, Checkbox, Segmented, ConfirmDialog, ActionMenu, PieceIcon, GarbageIcon, Swatch } from "../ui.jsx";
import { useDisplayToggles, usePause, useSettingsDialog, tune, heldActions } from "../display.js";
import { useFit } from "../fit.js";
import { ACCENT, PIECES, PAINTS, emptyBoard, EMPTY, NONE, bags, LIST, newId, blank, loadList, saveList, nextTitle, eraseCells, ERASE_MODES, ORDER_CELLS } from "./sandbox/store.js";
import { EraseIcon, Preview } from "./sandbox/parts.jsx";
import { DRAW_ICONS } from "./sandbox/drawIcons.jsx";

export default function Sandbox({ settings, onBack }) {
  useDisplayToggles(settings);
  // ─── Saved boards, and the one open ───
  const [items, setItems] = useState(loadList);
  const [currentId, setCurrentId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // item to delete
  useEffect(() => saveList(items), [items]);
  // The open board is edited as a draft: Save writes it into the list,
  // Discard changes goes back to what was saved.
  const saved = items.find((b) => b.id === currentId) || null;
  const [draft, setDraft] = useState(null);
  const field = (key) => (v) =>
    setDraft((d) => {
      if (!d) return d;
      const next = typeof v === "function" ? v(d[key]) : v;
      return next === d[key] ? d : { ...d, [key]: next };
    });
  const cur = draft || saved;
  const title = cur?.title ?? "";
  const board = cur?.board ?? EMPTY;
  const order = cur?.order ?? NONE;
  const hold = cur?.hold ?? 0;
  const randomAfter = cur?.randomAfter ?? true;
  const gravity = cur?.gravity ?? false;
  const FIELDS = ["title", "board", "order", "hold", "randomAfter", "gravity"];
  // (the board itself changes through editCells, together with its marks)
  const [setTitle, , setOrder, setHold, setRandomAfter, setGravity] = FIELDS.map(field);
  const dirty = !!(draft && saved && FIELDS.some((k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k])));
  const load = (b) => {
    setCurrentId(b.id);
    setDraft({ ...b });
  };
  const saveDraft = () => {
    if (!draft) return;
    sfx.select();
    const name = draft.title.trim() || nextTitle(items.filter((x) => x.id !== currentId));
    setDraft((d) => ({ ...d, title: name }));
    setItems((list) => list.map((x) => (x.id === currentId ? { ...x, ...draft, title: name, updatedAt: Date.now() } : x)));
  };
  const [confirmLeave, setConfirmLeave] = useState(false);
  const titleRef = useRef(null);
  // Tools: place a whole piece (turned and moved), paint single cells, or erase.
  const [tool, setTool] = useState("piece"); // piece | cell | erase
  const [stamp, setStamp] = useState(2); // piece to place (T)
  const [stampRot, setStampRot] = useState(0);
  const [paint, setPaint] = useState(8);
  const [eraseMode, setEraseMode] = useState("cell"); // cell | row | column | piece
  const [hover, setHover] = useState(null); // [row, col] under the pointer

  // list | edit | playing | paused | gameover | out
  const [phase, setPhase] = useState("list");
  // Edit and play share one layout and one scale, so the board keeps its size
  // and place when switching between them.
  const zoom = useFit(840, 600);

  // ─── EDIT: the board ───
  const editRef = useRef(null);
  // Cells the piece tool would fill at the pointer: the shape is centred on
  // the pointer and kept inside the board.
  const stampCells = useCallback(
    (at) => {
      if (!at) return null;
      // Garbage: a full row on the pointer's row, with the hole under it.
      if (stamp === 8) return Array.from({ length: COLS }, (_, c) => [at[0], c]).filter(([, c]) => c !== at[1]);
      const shape = getShape(stamp, stampRot);
      const cells = [];
      shape.forEach((row, r) => row.forEach((v, c) => v && cells.push([r, c])));
      const rs = cells.map(([r]) => r);
      const cs = cells.map(([, c]) => c);
      const midR = Math.floor((Math.min(...rs) + Math.max(...rs)) / 2);
      const midC = Math.floor((Math.min(...cs) + Math.max(...cs)) / 2);
      let dr = at[0] - midR;
      let dc = at[1] - midC;
      dr = Math.max(-Math.min(...rs), Math.min(ROWS - 1 - Math.max(...rs), dr));
      dc = Math.max(-Math.min(...cs), Math.min(COLS - 1 - Math.max(...cs), dc));
      return cells.map(([r, c]) => [r + dr, c + dc]);
    },
    [stamp, stampRot],
  );
  // Which placed piece each cell came from (0: painted cell by cell), so
  // Erase → Piece takes a whole piece away, not every cell of its colour.
  const marks = cur?.marks ?? EMPTY;
  // Change board and marks together, on copies.
  const editCells = (fn) =>
    setDraft((d) => {
      if (!d) return d;
      const b = d.board.map((row) => row.slice());
      const m = (d.marks || emptyBoard()).map((row) => row.slice());
      fn(b, m);
      return { ...d, board: b, marks: m };
    });
  const newMark = (m) => 1 + Math.max(0, ...m.flat());
  const eraseTargets = (at) => eraseCells(board, marks, eraseMode, at);
  useEffect(() => {
    if (phase !== "edit") return;
    const cv = editRef.current;
    drawBoard(cv, { matrix: board }, {});
    if (!hover || !cv) return;
    // Preview of what a click would do.
    const ctx = cv.getContext("2d");
    if (tool === "piece") {
      if (stamp === 8) {
        // Show the hole too: the row's other cells would be cleared.
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(hover[1] * CELL + 1, hover[0] * CELL + 1, CELL - 2, CELL - 2);
      }
      for (const [r, c] of stampCells(hover)) paintCell(ctx, c * CELL, r * CELL, CELL, COLORS[stamp], 0.55);
    } else if (tool === "cell") {
      paintCell(ctx, hover[1] * CELL, hover[0] * CELL, CELL, COLORS[paint], 0.55);
    } else {
      const cells = eraseCells(board, marks, eraseMode, hover);
      ctx.fillStyle = "rgba(232, 80, 91, 0.45)";
      for (const [r, c] of cells) ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    }
  }, [phase, board, marks, settings.look, hover, tool, stamp, paint, eraseMode, stampCells]);

  const stroke = useRef(null); // { value } while dragging cells
  const cellAt = (e) => {
    const r = editRef.current.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    const row = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
    return row >= 0 && row < ROWS && c >= 0 && c < COLS ? [row, c] : null;
  };
  // Paint or clear cells one by one (they belong to no piece).
  const putCells = (cells, v) => {
    if (cells.every(([r, c]) => board[r][c] === v && !marks[r][c])) return;
    editCells((b, m) => {
      for (const [r, c] of cells) {
        b[r][c] = v;
        m[r][c] = 0;
      }
    });
  };
  // A whole piece: its cells share one new mark.
  const putPiece = (cells, v) =>
    editCells((b, m) => {
      const id = newMark(m);
      for (const [r, c] of cells) {
        b[r][c] = v;
        m[r][c] = id;
      }
    });
  const onDown = (e) => {
    const at = cellAt(e);
    if (!at) return;
    e.preventDefault();
    // Right button always erases single cells (drag to erase more).
    if (e.button === 2) {
      e.currentTarget.setPointerCapture(e.pointerId);
      stroke.current = { value: 0 };
      return putCells([at], 0);
    }
    if (tool === "piece") {
      sfx.drop?.();
      if (stamp === 8) {
        // Drag up or down to lay several rows; each one's hole follows the pointer.
        e.currentTarget.setPointerCapture(e.pointerId);
        stroke.current = { garbage: new Set([at[0]]) };
        return putGarbageRow(at);
      }
      return putPiece(stampCells(at), stamp);
    }
    if (tool === "erase") {
      const cells = eraseTargets(at);
      if (cells.length) sfx.tick();
      putCells(cells, 0);
      // Every erase mode can be dragged: each cell, row, column or piece the
      // pointer passes over goes.
      e.currentTarget.setPointerCapture(e.pointerId);
      stroke.current = { erase: true };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = { value: paint };
    putCells([at], stroke.current.value);
  };
  // A garbage row is one piece too: Erase → Piece takes the whole row.
  const putGarbageRow = (at) =>
    editCells((b, m) => {
      const id = newMark(m);
      for (let c = 0; c < COLS; c++) {
        b[at[0]][c] = c === at[1] ? 0 : 8;
        m[at[0]][c] = c === at[1] ? 0 : id;
      }
    });
  const onMove = (e) => {
    const at = cellAt(e);
    setHover((h) => (h && at && h[0] === at[0] && h[1] === at[1] ? h : at));
    if (!stroke.current || !at) return;
    if (stroke.current.garbage) {
      if (stroke.current.garbage.has(at[0])) return;
      stroke.current.garbage.add(at[0]);
      return putGarbageRow(at);
    }
    if (stroke.current.erase) return putCells(eraseTargets(at), 0);
    putCells([at], stroke.current.value);
  };
  const onUp = () => {
    stroke.current = null;
  };
  const turn = useCallback((d) => {
    sfx.rotate?.();
    setStampRot((r) => (r + d + 4) % 4);
  }, []);
  // Mouse wheel turns the piece (a non-passive listener, to keep the page still).
  useEffect(() => {
    const cv = editRef.current;
    if (phase !== "edit" || !cv || tool !== "piece") return;
    const onWheel = (e) => {
      e.preventDefault();
      turn(e.deltaY > 0 ? 1 : -1);
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [phase, tool, turn]);

  const addPiece = (id) => {
    sfx.tick();
    setOrder((o) => (o.length >= 70 ? o : [...o, id]));
  };

  // ─── PLAY ───
  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const queueRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const loopRef = useRef(null);
  const countdownRef = useRef(null); // unused (no countdown), kept for usePause
  const keysRef = useRef(buildKeyMap(loadKeyBindings().solo));
  const run = useRef({ spawns: 0, history: [], seqLen: 0, random: true });
  const [hud, setHud] = useState({ pieces: 0, lines: 0, undo: 0 });
  const [action, setAction] = useState({ text: "", key: 0 });
  const actionPiece = useRef(-1);
  const [log, setLog] = useState({ events: [], total: 0 });
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const render = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    drawBoard(canvasRef.current, e, { dead: e.gameOver });
    drawHold(holdRef.current, e.hold, e.holdUsed);
    const st = run.current;
    // Without random pieces after the order, show only what is left of it.
    const left = st.random ? 5 : Math.max(0, st.seqLen - st.spawns);
    drawQueue(queueRef.current, e.queue.slice(0, left));
  }, []);

  // State the undo needs, taken just before each piece locks.
  const snap = (e) => ({
    matrix: e.matrix.map((r) => r.slice()),
    hold: e.hold,
    holdUsed: e.holdUsed,
    queue: e.queue.slice(),
    pendingSeq: e.pendingSeq ? e.pendingSeq.slice() : [],
    currentId: e.currentId,
    b2b: e.b2b,
    combo: e.combo,
    lines: e.lines,
    placedBlocks: e.placedBlocks,
    spawns: run.current.spawns,
  });

  // cfg: a saved board to play straight from the list (state isn't set yet).
  const start = (cfg) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const s = settings;
    const c = cfg && cfg.board ? cfg : { board, order, hold, randomAfter, gravity };
    const seq = c.order.length ? c.order : [];
    const random = c.randomAfter || !seq.length;
    const e = new BlockEngine({
      das: s.das,
      arr: s.arr,
      sdf: s.sdf,
      sprintLines: 1e9,
      // The order, then random 7-bags (also behind a finite order, so the
      // engine always has pieces; those are hidden and end the run).
      sequence: [...seq, ...bags(200)],
    });
    run.current = { spawns: 0, history: [], seqLen: seq.length, random };
    const spawn = e.spawn.bind(e);
    e.spawn = () => {
      run.current.spawns++;
      spawn();
    };
    e.validatePlacement = (cells, id, eng) => {
      run.current.history.push(snap(eng));
      if (run.current.history.length > 200) run.current.history.shift();
      return true;
    };
    e.start(heldActions(keysRef.current));
    e.matrix = c.board.map((row) => row.slice());
    e.hold = c.hold || null;
    if (!c.gravity) e.gravity = 1e9;
    e.respawnCurrent();
    engineRef.current = e;
    actionPiece.current = -1;
    setAction({ text: "", key: 0 });
    setHud({ pieces: 0, lines: 0, undo: 0 });
    setLog({ events: [], total: 0 });
    setPhase("playing");
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  };

  const undo = () => {
    const e = engineRef.current;
    const prev = run.current.history.pop();
    if (!e || !prev) return;
    sfx.tick();
    Object.assign(e, {
      matrix: prev.matrix,
      hold: prev.hold,
      holdUsed: prev.holdUsed,
      queue: prev.queue,
      pendingSeq: prev.pendingSeq,
      currentId: prev.currentId,
      b2b: prev.b2b,
      combo: prev.combo,
      lines: prev.lines,
      placedBlocks: prev.placedBlocks,
      lastAction: "",
      gameOver: false,
      playing: true,
    });
    run.current.spawns = prev.spawns;
    e.respawnCurrent();
    actionPiece.current = e.placedBlocks;
    setAction((a) => ({ text: "", key: a.key }));
    setHud({ pieces: e.placedBlocks, lines: e.lines, undo: run.current.history.length });
    if (phaseRef.current !== "playing") {
      setPhase("playing");
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(loopRef.current);
    }
    render();
  };

  useEffect(() => {
    loopRef.current = (ts) => {
      const e = engineRef.current;
      if (!e) return;
      trackSfx(e);
      const st = run.current;
      if (e.playing) {
        const dt = lastTimeRef.current ? ts - lastTimeRef.current : 16;
        lastTimeRef.current = ts;
        e.update(Math.min(dt, 100), performance.now());
      }
      if (e.lastAction && e.placedBlocks !== actionPiece.current) {
        actionPiece.current = e.placedBlocks;
        setAction((a) => ({ text: e.lastAction, key: a.key + 1 }));
      }
      setHud({ pieces: e.placedBlocks, lines: e.lines, undo: st.history.length });
      setLog((l) => (l.total === e.replay.length ? l : { events: e.replay.slice(-40), total: e.replay.length }));
      render();
      if (e.gameOver) {
        setPhase("gameover");
        return;
      }
      // The piece now in hand is past the order and no random pieces follow.
      if (!st.random && st.spawns > st.seqLen) {
        e.playing = false;
        setPhase("out");
        render();
        return;
      }
      rafRef.current = requestAnimationFrame(loopRef.current);
    };
  }, [render]);

  const toEdit = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("edit");
  };
  // Leaving the editor with unsaved changes asks first.
  const leave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setConfirmLeave(false);
    setDraft(null);
    setPhase("list");
  };
  const toList = () => {
    if (dirty) return setConfirmLeave(true);
    leave();
  };
  const createBoard = () => {
    sfx.select();
    const b = blank(nextTitle(items));
    setItems((list) => [b, ...list]);
    load(b);
    setPhase("edit");
  };
  const duplicate = (b) => {
    sfx.tick();
    const title = t("{title} copy", { title: b.title });
    setItems((list) => {
      const copy = { ...b, id: newId(), title, updatedAt: Date.now() };
      const i = list.findIndex((x) => x.id === b.id);
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });
  };
  const { pause, resume } = usePause({
    phase,
    setPhase,
    rafRef,
    countdownRef,
    lastTimeRef,
    loopRef,
    engineRef,
    restart: start,
  });
  const settingsOpen = !!settings.settingsOpen;
  useEffect(() => {
    render();
  }, [settings.look, render]);
  useSettingsDialog(settings, {
    pause,
    apply: () => {
      tune(engineRef.current, settings);
      keysRef.current = buildKeyMap(loadKeyBindings().solo);
    },
  });

  // The key handler reaches the open board through this, so it needn't be
  // rebound on every render.
  const editFns = useRef({});
  useEffect(() => {
    editFns.current = { setOrder, save: saveDraft, toList, start, undo };
  });

  // ─── KEYS ───
  useEffect(() => {
    if (settingsOpen) return;
    const down = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (phase === "list") {
        if (e.code === "Escape") return onBack();
        return;
      }
      if (phase === "edit") {
        if (e.code === "Escape") return editFns.current.toList();
        if ((e.metaKey || e.ctrlKey) && e.code === "KeyS") {
          e.preventDefault();
          return editFns.current.save();
        }
        if (e.code === "Enter" || e.code === "NumpadEnter") {
          e.preventDefault();
          return editFns.current.start();
        }
        // The player's own rotate keys turn the piece to place.
        const a = keysRef.current[e.code];
        if (tool === "piece" && !e.metaKey && !e.ctrlKey && (a === "rotateCW" || a === "rotateCCW" || a === "rotate180")) {
          e.preventDefault();
          return turn(a === "rotateCW" ? 1 : a === "rotateCCW" ? -1 : 2);
        }
        // Backspace takes the last piece off the order.
        if (e.code === "Backspace") {
          e.preventDefault();
          return editFns.current.setOrder((o) => o.slice(0, -1));
        }
        return;
      }
      if (e.repeat) return;
      if (e.code === "Escape") {
        if (phase === "playing") return pause();
        if (phase === "paused") return resume();
        return toEdit();
      }
      if (e.code === restartKey()) return editFns.current.start();
      if (e.code === "Backspace" || ((e.metaKey || e.ctrlKey) && e.code === "KeyZ")) {
        e.preventDefault();
        return editFns.current.undo();
      }
      const a = keysRef.current[e.code];
      if (!a || phase !== "playing") return;
      e.preventDefault();
      engineRef.current?.onKeyDown(a, performance.now());
      sfxForAction(a);
    };
    const up = (e) => {
      const a = keysRef.current[e.code];
      if (a) engineRef.current?.onKeyUp(a);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, settingsOpen, pause, resume, onBack, tool, turn]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={!!confirmDelete}
        title={t("Delete {title}?", { title: confirmDelete?.title || "" })}
        body={t("The board, its piece order and settings are removed from this browser. This can't be undone.")}
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const id = confirmDelete.id;
          setItems((list) => list.filter((b) => b.id !== id));
          setConfirmDelete(null);
          if (currentId === id) {
            setCurrentId(null);
            leave();
          }
        }}
      />
      <ConfirmDialog
        open={confirmLeave}
        title={t("Leave without saving?")}
        body={t("The changes to this board since the last save are lost.")}
        confirmLabel="Discard changes"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={leave}
      />
    </>
  );

  // ─── LIST VIEW ───
  if (phase === "list") {
    const date = (ms) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return (
      <div className="page wide" style={{ "--accent": ACCENT }}>
        <h1 className="title">{t("Sandbox")}</h1>
        <p className="lede">{t("Your boards. Build one, set its pieces, and play it.")}</p>
        {/* Fixed-height list: it scrolls, so the buttons below never move */}
        <div className="sb-list">
          {items.length === 0 && <div className="sb-none">{t("No boards yet.")}</div>}
          {items.map((b, i) => (
            <div key={b.id} className="sb-item" style={{ "--i": i }}>
              <button
                type="button"
                className="sb-item-main"
                onClick={() => {
                  sfx.select();
                  load(b);
                  setPhase("edit");
                }}
                aria-label={t("Edit {title}", { title: b.title })}
              >
                <Preview board={b.board} />
                <span className="sb-item-text">
                  <span className="sb-item-title">{b.title}</span>
                  <span className="sb-item-meta">
                    {b.order.length ? t("{n} pieces set", { n: b.order.length }) : t("Random pieces")}
                    {b.hold ? (
                      <>
                        {" · "}
                        {t("Hold")} <PieceIcon id={b.hold} size={3} />
                      </>
                    ) : null}
                  </span>
                  <span className="sb-item-meta">{date(b.updatedAt)}</span>
                </span>
              </button>
              <div className="sb-item-more">
                <ActionMenu
                  items={[
                    {
                      label: "Play",
                      onClick: () => {
                        load(b);
                        start(b);
                      },
                    },
                    { label: "Duplicate", onClick: () => duplicate(b) },
                    { label: "Delete", danger: true, onClick: () => setConfirmDelete(b) },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="actions">
          <button className="btn primary" onClick={createBoard}>
            {t("New board")}
          </button>
          <button className="btn ghost" onClick={onBack}>
            {t("Back")}
          </button>
        </div>
        {dialogs}
      </div>
    );
  }

  // ─── EDIT VIEW ───
  if (phase === "edit") {
    const filled = board.some((row) => row.some(Boolean));
    return (
      <>
        <div className="mode-label sb-title">
          <span>{t("Sandbox")} ·</span>
          <input
            ref={titleRef}
            className="sb-title-input"
            value={title}
            maxLength={40}
            aria-label={t("Title")}
            spellCheck={false}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && setTitle(nextTitle(items.filter((b) => b.id !== currentId)))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
          <button
            type="button"
            className="sb-pen"
            aria-label={t("Rename")}
            onClick={() => {
              titleRef.current?.focus();
              titleRef.current?.select();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
              <path d="M13.5 6.5l4 4" />
            </svg>
          </button>
        </div>
        {dialogs}
        <div className="play sb-stage" style={{ zoom, "--accent": ACCENT }}>
          <div className="side sb-col">
            {/* Label and dropdown on one row to save height */}
            <div className="sb-field">
              <span className="k">{t("Hold")}</span>
              <div className="sb-field-dd">
                <Dropdown
                  label={t("Hold")}
                  value={hold}
                  options={[{ id: 0, label: "–" }, ...PIECES.map((id) => ({ id, label: <PieceIcon id={id} /> }))]}
                  onChange={setHold}
                />
              </div>
            </div>
            <div className="k sb-order-k">{t("Piece order")}</div>
            <div className="sb-add">
              {PIECES.map((id) => (
                <button key={id} type="button" className="chip-btn" onClick={() => addPiece(id)} title={t("Add {p}", { p: PIECE_NAMES[id] })}>
                  <PieceIcon id={id} />
                </button>
              ))}
              {/* Clear all is the eighth chip, beside the last piece, once there is an order. */}
              <button
                type="button"
                className="chip-btn sb-wipe"
                title={t("Clear all")}
                aria-label={t("Clear all")}
                style={{ visibility: order.length ? "visible" : "hidden" }}
                onClick={(e) => {
                  e.currentTarget.blur();
                  sfx.tick();
                  setOrder([]);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            </div>
            {/* Fixed size, so a long or empty order never moves anything; with
                nothing in it, it says how it is filled. */}
            <div className={"sb-order" + (order.length ? "" : " empty")} aria-label={t("Piece order")}>
              {!order.length && <p>{t("Click a piece above to add it, and here to take it out.")}</p>}
              {/* Seven to a row (a bag), three rows. What does not fit is counted in the last cell. */}
              {(order.length > ORDER_CELLS ? order.slice(0, ORDER_CELLS - 1) : order).map((id, i) => (
                <button
                  key={i}
                  type="button"
                  className="sb-piece"
                  title={t("Remove")}
                  onClick={() => {
                    sfx.tick();
                    setOrder((o) => o.filter((_, j) => j !== i));
                  }}
                >
                  <PieceIcon id={id} size={4} />
                </button>
              ))}
              {order.length > ORDER_CELLS && (
                <span className="sb-more" title={t("{n} more", { n: order.length - ORDER_CELLS + 1 })}>
                  +{order.length - ORDER_CELLS + 1}
                </span>
              )}
            </div>
            <div className="sb-checks">
              <Checkbox checked={randomAfter} onChange={setRandomAfter} label="Random pieces after" />
              <Checkbox checked={gravity} onChange={setGravity} label="Gravity" />
            </div>
            {/* Same place as Edit / Main menu while playing (left, under the input) */}
            <div className="sb-actions row">
              <button className="btn ghost sb-back" onClick={toList} title={t("Back")} aria-label={t("Back")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
              <button className="btn primary" onClick={start}>
                {t("Play")}
              </button>
            </div>
          </div>

          <div className="board-wrap">
          <canvas
            ref={editRef}
            width={BOARD_W}
            height={BOARD_H}
            className="board-frame sb-canvas"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          </div>

          <div className="side right sb-col">
            <div className="k">{t("Draw")}</div>
            <Segmented
              label="Draw"
              options={[
                { id: "piece", title: "Piece", label: DRAW_ICONS.piece },
                { id: "cell", title: "Cells", label: DRAW_ICONS.cell },
                { id: "erase", title: "Erase", label: DRAW_ICONS.erase },
              ]}
              value={tool}
              onChange={setTool}
            />
            {/* Fixed height: switching tools never moves what is below */}
            <div className="sb-panel">
              {tool === "piece" && (
                <>
                  <div className="sb-paints four" role="radiogroup" aria-label={t("Piece")}>
                    {PIECES.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={stamp === id}
                        className={"chip-btn" + (stamp === id ? " on" : "")}
                        // A second click on the chosen piece turns it (O has only one way up).
                        onClick={(e) => {
                          e.currentTarget.blur();
                          if (id === stamp) return id !== 7 && turn(1);
                          sfx.tick();
                          setStamp(id);
                          setStampRot(0);
                        }}
                      >
                        <PieceIcon id={id} rot={id === stamp ? stampRot : 0} />
                      </button>
                    ))}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={stamp === 8}
                      className={"chip-btn" + (stamp === 8 ? " on" : "")}
                      title={t("Garbage row")}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        if (stamp !== 8) sfx.tick();
                        setStamp(8);
                        setStampRot(0);
                      }}
                    >
                      <GarbageIcon size={4} />
                    </button>
                  </div>
                </>
              )}
              {tool === "cell" && (
                <>
                  <div className="sb-paints four" role="radiogroup" aria-label={t("Colour")}>
                    {PAINTS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={paint === v}
                        className={"chip-btn" + (paint === v ? " on" : "")}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          if (v !== paint) sfx.tick();
                          setPaint(v);
                        }}
                      >
                        <Swatch color={COLORS[v]} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {tool === "erase" && (
                <>
                  <div className="sb-paints two" role="radiogroup" aria-label={t("Erase")}>
                    {ERASE_MODES.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={eraseMode === id}
                        className={"chip-btn" + (eraseMode === id ? " on" : "")}
                        title={t(label)}
                        aria-label={t(label)}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          if (id !== eraseMode) sfx.tick();
                          setEraseMode(id);
                        }}
                      >
                        <EraseIcon mode={id} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Save at the foot of the column; what wipes or removes the board is one step away, in the menu beside it. */}
            <div className="sb-board-actions">
              <button type="button" className="btn" onClick={saveDraft} disabled={!dirty}>
                {t("Save")}
              </button>
              <ActionMenu
                up
                items={[
                  {
                    label: "Clear board",
                    disabled: !filled,
                    onClick: () => {
                      sfx.tick();
                      editCells((b, m) => {
                        for (let r = 0; r < ROWS; r++) {
                          b[r].fill(0);
                          m[r].fill(0);
                        }
                      });
                    },
                  },
                  { label: "Delete board", danger: true, onClick: () => setConfirmDelete(saved) },
                ]}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── PLAY VIEW ───
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

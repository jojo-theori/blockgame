// Sandbox, editor: the board in the middle, its pieces on the left, the tools on the right.
import { t } from "../../i18n.js";
import { ROWS, COLORS, PIECE_NAMES } from "../../game.js";
import { BOARD_W, BOARD_H } from "../../render.js";
import { sfx } from "../../sound.js";
import { Dropdown, Checkbox, Segmented, ActionMenu, PieceIcon, GarbageIcon, Swatch, Chip, ChipGrid, Well, IconButton, Icon } from "../../ui.jsx";
import { ACCENT, PIECES, PAINTS, nextTitle, ERASE_MODES, ORDER_CELLS } from "./store.js";
import { EraseIcon } from "./parts.jsx";
import { DRAW_ICONS } from "./drawIcons.jsx";

export default function EditView(p) {
  const { board, titleRef, title, setTitle, items, currentId, dialogs, zoom, hold, setHold, addPiece, order, setOrder, randomAfter, setRandomAfter, gravity, setGravity, toList, start, editRef, onDown, onMove, onUp, setHover, tool, setTool, stamp, turn, setStamp, setStampRot, stampRot, paint, setPaint, eraseMode, setEraseMode, saveDraft, dirty, editCells, setConfirmDelete, saved } = p;
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
          <ChipGrid cols={4}>
            {PIECES.map((id) => (
              <Chip key={id} onClick={() => addPiece(id)} title={t("Add {p}", { p: PIECE_NAMES[id] })}>
                <PieceIcon id={id} />
              </Chip>
            ))}
            {/* Clear all is the eighth chip, beside the last piece, once there is an order. */}
            <Chip
              danger
              title={t("Clear all")}
              aria-label={t("Clear all")}
              style={{ visibility: order.length ? "visible" : "hidden" }}
              onClick={(e) => {
                e.currentTarget.blur();
                sfx.tick();
                setOrder([]);
              }}
            >
              <Icon name="trash" size={15} />
            </Chip>
          </ChipGrid>
          {/* Fixed size, so a long or empty order never moves anything; with
              nothing in it, it says how it is filled. */}
          <Well className="sb-order" aria-label={t("Piece order")} hint={!order.length && t("Click a piece above to add it, and here to take it out.")}>
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
          </Well>
          <div className="sb-checks">
            <Checkbox checked={randomAfter} onChange={setRandomAfter} label="Random pieces after" />
            <Checkbox checked={gravity} onChange={setGravity} label="Gravity" />
          </div>
          {/* Same place as Edit / Main menu while playing (left, under the input) */}
          <div className="sb-actions row">
            <IconButton icon="back" label="Back" size="m" filled onClick={toList} />
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
                <ChipGrid cols={4} role="radiogroup" aria-label={t("Piece")}>
                  {PIECES.map((id) => (
                    <Chip
                      key={id}
                                            role="radio"
                      aria-checked={stamp === id}
                      on={stamp === id}
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
                    </Chip>
                  ))}
                  <Chip
                                        role="radio"
                    aria-checked={stamp === 8}
                    on={stamp === 8}
                    title={t("Garbage row")}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      if (stamp !== 8) sfx.tick();
                      setStamp(8);
                      setStampRot(0);
                    }}
                  >
                    <GarbageIcon size={4} />
                  </Chip>
                </ChipGrid>
              </>
            )}
            {tool === "cell" && (
              <>
                <ChipGrid cols={4} role="radiogroup" aria-label={t("Colour")}>
                  {PAINTS.map((v) => (
                    <Chip
                      key={v}
                                            role="radio"
                      aria-checked={paint === v}
                      on={paint === v}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        if (v !== paint) sfx.tick();
                        setPaint(v);
                      }}
                    >
                      <Swatch color={COLORS[v]} />
                    </Chip>
                  ))}
                </ChipGrid>
              </>
            )}
            {tool === "erase" && (
              <>
                <ChipGrid cols={2} role="radiogroup" aria-label={t("Erase")}>
                  {ERASE_MODES.map(([id, label]) => (
                    <Chip
                      key={id}
                                            role="radio"
                      aria-checked={eraseMode === id}
                      on={eraseMode === id}
                      title={t(label)}
                      aria-label={t(label)}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        if (id !== eraseMode) sfx.tick();
                        setEraseMode(id);
                      }}
                    >
                      <EraseIcon mode={id} />
                    </Chip>
                  ))}
                </ChipGrid>
              </>
            )}
          </div>
          {/* Save at the foot of the column; what wipes or removes the board is one step away, in the menu beside it. */}
          <div className="sb-board-actions">
            <button type="button" className="btn" onClick={saveDraft} disabled={!dirty}>
              {t("Save")}
            </button>
            <ActionMenu
              size="m"
              filled
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

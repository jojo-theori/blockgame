// Sandbox, list: the saved boards.
import { t } from "../../i18n.js";
import { sfx } from "../../sound.js";
import { ActionMenu, PieceIcon } from "../../ui.jsx";
import { ACCENT } from "./store.js";
import { Preview } from "./parts.jsx";

export default function ListView(p) {
  const { items, load, setPhase, start, duplicate, setConfirmDelete, createBoard, onBack, dialogs } = p;
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
                size="m"
                filled
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

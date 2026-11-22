// Things that open over the page: confirm dialog, action menu.
import { useEffect, useRef, useState } from "react";
import { sfx } from "../sound.js";
import { t } from "../i18n.js";
import { tr } from "./tr.js";

// Confirm dialog for destructive actions. Esc or the backdrop cancels; Enter
// confirms. Focus starts on Cancel so a stray Enter/Space never destroys.
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="dialog-back" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
        <div id="dlg-title" className="dialog-title">
          {tr(title)}
        </div>
        {body && <p className="dialog-body">{tr(body)}</p>}
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              sfx.select();
              onConfirm();
            }}
          >
            {tr(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ⋯ menu: a round button that opens a short list of actions (right aligned).
// items: [{ label, onClick, danger?, disabled? }]
// up: opens above the button. start: the list starts at the button and runs to the right.
export function ActionMenu({ items, label = "More", up = false, start = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const down = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);
  return (
    <div ref={ref} className={"am" + (open ? " open" : "") + (up ? " up" : "") + (start ? " start" : "")}>
      <button
        type="button"
        className="am-btn"
        aria-label={t(label)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          e.currentTarget.blur();
          sfx.tick();
          setOpen((o) => !o);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18" cy="12" r="1.6" />
        </svg>
      </button>
      <ul className="am-menu" role="menu">
        {items.map((it, i) => (
          <li key={it.label} style={{ "--i": i }}>
            <button
              type="button"
              role="menuitem"
              className={it.danger ? "danger" : ""}
              disabled={it.disabled}
              tabIndex={open ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
            >
              {tr(it.label)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

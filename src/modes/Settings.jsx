import { useState, useEffect, useRef } from "react";
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  loadKeyBindings,
  saveKeyBindings,
  keyLabel,
  findConflicts,
  findCrossProfileConflicts,
  FORBIDDEN_CODES,
} from "../keys.js";

import { Segmented, KeyName } from "../ui.jsx";

const PROFILE_LIST = [
  { id: "solo", label: "Solo" },
  { id: "p1", label: "Battle P1" },
  { id: "p2", label: "Battle P2" },
];

const ACTION_NAMES = {
  left: "Move left",
  right: "Move right",
  softdrop: "Soft drop",
  harddrop: "Hard drop",
  rotateCW: "Rotate clockwise",
  rotateCCW: "Rotate counter-clockwise",
  rotate180: "Rotate 180",
  hold: "Hold",
};

export default function Settings({
  das,
  setDas,
  arr,
  setArr,
  sdf,
  setSdf,
  soundEnabled,
  setSoundEnabled,
  onBack,
}) {
  const [bindings, setBindings] = useState(() => loadKeyBindings());
  const [activeProfile, setActiveProfile] = useState("solo");
  const [recording, setRecording] = useState(null); // { profile, action }
  const [error, setError] = useState("");
  const [section, setSection] = useState("game"); // game | keys
  const recordingRef = useRef(recording);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    saveKeyBindings(bindings);
  }, [bindings]);

  // Capture-key listener
  useEffect(() => {
    const onKey = (e) => {
      const rec = recordingRef.current;
      if (!rec) return;
      // Esc cancels capture without saving
      if (e.code === "Escape" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setRecording(null);
        setError("");
        return;
      }
      if (FORBIDDEN_CODES.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        setError(`${keyLabel(e.code)} cannot be used.`);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const code = e.code;

      // Conflict checks
      const sameProfile = bindings[rec.profile];
      const localConflicts = findConflicts(sameProfile, code, rec.action);
      if (localConflicts.length > 0) {
        setError(
          `${keyLabel(code)} already used by ${ACTION_NAMES[localConflicts[0]]} in this profile.`,
        );
        setRecording(null);
        return;
      }

      // Cross-profile only matters for p1/p2 (same physical keyboard).
      if (rec.profile === "p1" || rec.profile === "p2") {
        const cross = findCrossProfileConflicts(
          bindings.p1,
          bindings.p2,
          code,
          rec.profile,
          rec.action,
        );
        if (cross.length > 0) {
          const c = cross[0];
          setError(
            `${keyLabel(code)} already used by ${c.profile.toUpperCase()} ${ACTION_NAMES[c.action].toLowerCase()}. P1/P2 cannot share keys.`,
          );
          setRecording(null);
          return;
        }
      }

      setBindings((prev) => ({
        ...prev,
        [rec.profile]: { ...prev[rec.profile], [rec.action]: code },
      }));
      setError("");
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [bindings]);

  // ESC to back when not capturing
  useEffect(() => {
    const onKey = (e) => {
      if (recording) return;
      if (e.code === "Escape" || e.key === "Escape") {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, onBack]);

  const profile = bindings[activeProfile];

  const resetProfile = () => {
    setBindings((prev) => ({
      ...prev,
      [activeProfile]: { ...DEFAULT_BINDINGS[activeProfile] },
    }));
    setError("");
  };

  return (
    <div className="page" style={{ "--accent": "#ebebeb" }}>
      <h1 className="title">Settings</h1>
      <div className="mid shrink">
      <div>
        <Segmented
          label="Section"
          options={[
            { id: "game", label: "Handling" },
            { id: "keys", label: "Keys" },
          ]}
          value={section}
          onChange={setSection}
        />
      </div>

      <div className="settings">
        {section === "game" && (
          <div className="opts">
            <div className="opt">
              <div>
                <div className="k" style={{ color: "var(--fg)" }}>DAS</div>
                <div className="k small">Delay before auto-repeat</div>
              </div>
              <SliderField value={das} setValue={setDas} min={0} max={300} def={133} unit="ms" />
            </div>
            <div className="opt">
              <div>
                <div className="k" style={{ color: "var(--fg)" }}>ARR</div>
                <div className="k small">Auto-repeat rate</div>
              </div>
              <SliderField value={arr} setValue={setArr} min={0} max={100} def={10} unit="ms" />
            </div>
            <div className="opt">
              <div>
                <div className="k" style={{ color: "var(--fg)" }}>SDF</div>
                <div className="k small">Soft drop speed</div>
              </div>
              <SliderField value={sdf} setValue={setSdf} min={1} max={100} def={30} displayValue={sdf === 100 ? "∞" : `${sdf}×`} />
            </div>
            <div className="opt">
              <div className="k" style={{ color: "var(--fg)" }}>Sound</div>
              <Segmented
                label="Sound"
                options={[
                  { id: true, label: "On" },
                  { id: false, label: "Off" },
                ]}
                value={soundEnabled}
                onChange={setSoundEnabled}
              />
            </div>
          </div>
        )}

        {section === "keys" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "nowrap" }}>
              <Segmented
                label="Profile"
                options={PROFILE_LIST}
                value={activeProfile}
                onChange={(id) => {
                  setActiveProfile(id);
                  setError("");
                }}
              />
              <button className="btn ghost compact" onClick={resetProfile}>
                Reset
              </button>
            </div>
            <p className="note">
              {activeProfile === "solo" && "Used in Sprint, Opening and Battle vs CPU."}
              {activeProfile === "p1" && "Used by P1 in Battle vs Player."}
              {activeProfile === "p2" && "Used by P2 in Battle vs Player."} Keys follow the physical key, so the
              한/영 toggle never changes them.
            </p>
            <div className="opts" style={{ marginTop: 0 }}>
              {ACTIONS.map((action) => {
                const isRecording =
                  recording && recording.profile === activeProfile && recording.action === action;
                return (
                  <div key={action} className="opt" style={{ minHeight: 44, padding: "4px 0", gridTemplateColumns: "1fr auto" }}>
                    <div className="k" style={{ color: "var(--fg)" }}>{ACTION_NAMES[action]}</div>
                    <button
                      className={"btn keybtn" + (isRecording ? " rec" : "")}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setError("");
                        setRecording({ profile: activeProfile, action });
                      }}
                    >
                      {isRecording ? "Press a key…" : <KeyName code={profile[action]} />}
                    </button>
                  </div>
                );
              })}
            </div>
            {error && <div className="err">{error}</div>}
          </div>
        )}
      </div>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

// Slider with the default marked on the track. Double-click the slider to go
// back to the default; click the number to type a value (underline only).
function SliderField({ value, setValue, min, max, def, displayValue, unit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const pct = ((def - min) / (max - min)) * 100;
  const commit = () => {
    const n = Math.round(Number(draft.replace(/[^0-9.]/g, "")));
    if (draft.trim() !== "" && Number.isFinite(n)) setValue(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };
  return (
    <div className="slider">
      <div className="slider-track">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(+e.target.value)}
          onDoubleClick={() => setValue(def)}
          title={`Double-click to reset to ${def}`}
        />
        {/* Default position (thumb is 14px, so offset to its centre) */}
        <span
          className={"slider-def" + (value === def ? " at" : "")}
          style={{ left: `calc(${pct}% + ${(0.5 - pct / 100) * 14}px)` }}
          aria-hidden="true"
        />
      </div>
      <div className="v">
        {editing ? (
          <input
            className="num-edit"
            autoFocus
            inputMode="numeric"
            value={draft}
            size={Math.max(2, draft.length)}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="num"
            title="Click to type a value"
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
          >
            {displayValue ?? value}
          </button>
        )}
        {unit && displayValue == null ? <span className="dim"> {unit}</span> : null}
      </div>
    </div>
  );
}

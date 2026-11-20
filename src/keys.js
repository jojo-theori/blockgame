// ─── KEY BINDINGS ───
// Uses e.code (physical key) instead of e.key, so 한영 toggle / IME never breaks gameplay.

export const ACTIONS = [
  "left",
  "right",
  "softdrop",
  "harddrop",
  "rotateCW",
  "rotateCCW",
  "rotate180",
  "hold",
];

export const ACTION_LABELS = {
  left: "MOVE LEFT",
  right: "MOVE RIGHT",
  softdrop: "SOFT DROP",
  harddrop: "HARD DROP",
  rotateCW: "ROTATE CW",
  rotateCCW: "ROTATE CCW",
  rotate180: "ROTATE 180",
  hold: "HOLD",
};

// Profiles:
//   solo: used in Sprint and other 1P modes, and by P1 vs CPU in Battle
//   p1:   used by P1 in Battle vs Player (player-vs-player on one keyboard)
//   p2:   used by P2 in Battle vs Player
export const DEFAULT_BINDINGS = {
  solo: {
    left: "ArrowLeft",
    right: "ArrowRight",
    softdrop: "ArrowDown",
    harddrop: "Space",
    rotateCW: "KeyX",
    rotateCCW: "KeyZ",
    rotate180: "KeyA",
    hold: "KeyC",
  },
  p1: {
    left: "KeyA",
    right: "KeyD",
    softdrop: "KeyS",
    harddrop: "KeyW",
    rotateCCW: "Digit1",
    rotate180: "Digit2",
    rotateCW: "Digit3",
    hold: "KeyQ",
  },
  p2: {
    left: "ArrowLeft",
    right: "ArrowRight",
    softdrop: "ArrowDown",
    harddrop: "ArrowUp",
    rotateCCW: "Comma",
    rotate180: "Period",
    rotateCW: "Slash",
    hold: "ShiftRight",
  },
};

const STORAGE_KEY = "jbl-keybindings";
// v3 set the solo defaults to X/Z rotate, A 180, C hold. Solo keys saved by an
// older version are dropped once so the new defaults take effect.
const VERSION = 3;

export function loadKeyBindings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if ((saved.v ?? 1) < VERSION) delete saved.solo;
    return {
      solo: { ...DEFAULT_BINDINGS.solo, ...(saved.solo || {}) },
      p1: { ...DEFAULT_BINDINGS.p1, ...(saved.p1 || {}) },
      p2: { ...DEFAULT_BINDINGS.p2, ...(saved.p2 || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }
}

export function saveKeyBindings(bindings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...bindings, v: VERSION }));
}

// Pretty label for an e.code value.
export function keyLabel(code) {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num" + code.slice(6);
  if (code.startsWith("F") && /^F\d+$/.test(code)) return code;
  switch (code) {
    case "ArrowLeft": return "←";
    case "ArrowRight": return "→";
    case "ArrowUp": return "↑";
    case "ArrowDown": return "↓";
    case "Space": return "Space";
    case "ShiftLeft": return "LShift";
    case "ShiftRight": return "RShift";
    case "ControlLeft": return "LCtrl";
    case "ControlRight": return "RCtrl";
    case "AltLeft": return "LAlt";
    case "AltRight": return "RAlt";
    case "MetaLeft": return "LMeta";
    case "MetaRight": return "RMeta";
    case "Comma": return ",";
    case "Period": return ".";
    case "Slash": return "/";
    case "Backslash": return "\\";
    case "Semicolon": return ";";
    case "Quote": return "'";
    case "BracketLeft": return "[";
    case "BracketRight": return "]";
    case "Backquote": return "`";
    case "Minus": return "-";
    case "Equal": return "=";
    case "Tab": return "Tab";
    case "Enter": return "Enter";
    case "Backspace": return "Bksp";
    case "CapsLock": return "Caps";
    default: return code;
  }
}

// Build reverse lookup: code -> action, for a given profile.
export function buildKeyMap(profile) {
  const map = {};
  for (const action of ACTIONS) {
    const code = profile[action];
    if (code) map[code] = action;
  }
  return map;
}

// Conflict detection: returns array of action names that conflict with `code`
// in `profile` (other than `excludeAction`).
export function findConflicts(profile, code, excludeAction) {
  const out = [];
  for (const action of ACTIONS) {
    if (action === excludeAction) continue;
    if (profile[action] === code) out.push(action);
  }
  return out;
}

// In Battle vs Player both keyboards share the same physical device,
// so p1 and p2 codes must be globally unique.
export function findCrossProfileConflicts(p1, p2, code, excludeProfile, excludeAction) {
  const out = [];
  for (const action of ACTIONS) {
    if (excludeProfile === "p1" && action === excludeAction) continue;
    if (p1[action] === code) out.push({ profile: "p1", action });
  }
  for (const action of ACTIONS) {
    if (excludeProfile === "p2" && action === excludeAction) continue;
    if (p2[action] === code) out.push({ profile: "p2", action });
  }
  return out;
}

// Codes we never let the user bind (they break navigation / browser).
export const FORBIDDEN_CODES = new Set([
  "Escape",
  "F5",
  "F11",
  "F12",
  "MetaLeft",
  "MetaRight",
]);

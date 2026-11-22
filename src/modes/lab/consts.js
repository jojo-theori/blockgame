// Names and numbers the replay screen shares.
import { t } from "../../i18n.js";

export const ACCENT = "#3fc8b4";

export const LETTER_ID = { I: 1, T: 2, L: 3, J: 4, S: 5, Z: 6, O: 7 };

export const SPEEDS = [0.5, 1, 2, 4];

export const PASTE_MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

// What a replay is of: "Sprint 40 lines", "Battle · P1 vs Cold Clear". Empty
// when the log does not say. tail is added after it (for the summary line).
export const MODE_NAMES = { sprint: "Sprint", battle: "Battle", opening: "Opening", finesse: "Finesse" };

export function modeName(m, tail = " · ") {
  if (!MODE_NAMES[m.mode]) return "";
  const detail = m.lines ? " " + t("{n} lines", { n: m.lines }) : m.vs ? ` · ${m.me} vs ${m.vs}${m.level ? ` (${t(m.level)})` : ""}` : "";
  return t(MODE_NAMES[m.mode]) + detail + tail;
}

export const NO_MOMENTS = [];

// Short labels on the score row (the help beside it spells them out).
export const SCORES = [
  ["macro", "MCR", "Stack planning, whatever the speed"],
  ["dexterity", "DXT", "Raw speed of the hands"],
  ["finesse", "FNS", "How few key presses each placement took"],
];

export const GRADES = { brilliant: "Brilliant", good: "Good", inaccuracy: "Inaccuracy", mistake: "Mistake", blunder: "Blunder", slow: "Slow", waste: "Wasted keys" };

export const BEAT_MS = 400; // one event per beat at 1× (so 4× shows ten a second)

export const LOAD_MS = 2200; // staged length of the analysis loading

export const STAGES = ["Reading the log…", "Weighing every placement…", "Timing the hands…", "Counting key presses…", "Picking the key moments…"];

export const stageOf = (p) => Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));

export const LINE_AHEAD = 3; // pieces of the queue the better line goes on for

export const KIND_NAMES = { macro: "Macro", dexterity: "Dexterity", finesse: "Finesse" };

export const MAX_LINES = 400; // lines of a pasted log shown on the input page

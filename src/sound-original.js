// ─── The sound kit as it first was ───
// Kept so it can be heard beside the current one (Lab → Original sounds).
// Nothing in the game plays these.
import { tone, noise } from "./sound.js";

export const sfxOriginal = {
  move: () => tone({ freq: 520, type: "triangle", dur: 0.03, vol: 0.035 }),
  rotate: () => tone({ freq: 660, type: "triangle", dur: 0.045, vol: 0.05, slide: 780 }),
  hold: () => tone({ freq: 440, type: "sine", dur: 0.09, vol: 0.07, slide: 330 }),
  drop: () => tone({ freq: 800, type: "sine", dur: 0.08, vol: 0.12 }),
  // Two notes, higher the more lines went: C D E G, each with its fifth above.
  clear: (lines) => {
    const base = [0, 523, 587, 659, 784][Math.min(lines, 4)];
    tone({ freq: base, type: "triangle", dur: 0.16, vol: 0.1 });
    tone({ freq: base * 1.5, type: "sine", dur: 0.2, vol: 0.06, delay: 0.05 });
  },
  // A stack of A, C sharp and E: one note a line.
  spin: (lines) => {
    [880, 1109, 1319].slice(0, Math.max(1, lines)).forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.14, vol: 0.08, delay: i * 0.05 }));
  },
  perfect: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.08, delay: i * 0.06 }));
  },
  miss: () => tone({ freq: 180, type: "square", dur: 0.12, vol: 0.05, slide: 120 }),
  b2b: () => {
    tone({ freq: 392, type: "square", dur: 0.09, vol: 0.035, delay: 0.1 });
    tone({ freq: 784, type: "square", dur: 0.14, vol: 0.035, delay: 0.18 });
  },
  // A semitone up with every clear in a row, from 660 Hz.
  combo: (n) => tone({ freq: 660 * 2 ** (Math.min(n, 14) / 12), type: "sine", dur: 0.09, vol: 0.07, delay: 0.12 }),
  garbage: () => noise({ dur: 0.14, vol: 0.18, freq: 300 }),
  ready: () => tone({ freq: 440, type: "sine", dur: 0.1, vol: 0.08 }),
  go: () => tone({ freq: 880, type: "sine", dur: 0.16, vol: 0.1 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.25, vol: 0.09, delay: i * 0.09 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.28, vol: 0.08, delay: i * 0.12 })),
};

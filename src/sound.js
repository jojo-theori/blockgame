// ─── SOUND ───
// Small synthesized sound kit (Web Audio, no files). Everything is short and
// quiet; a single global switch follows the Sound setting.

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = !!on;
}

// Sounds that can be switched off one by one (Settings → Sound).
const opts = { fault: true, b2b: true, combo: true };
export function setSoundOptions(o) {
  Object.assign(opts, o);
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// One oscillator note. slide: end frequency (glide). delay in seconds.
function tone({ freq, type = "sine", dur = 0.08, vol = 0.1, slide = null, delay = 0, attack = 0.004 }) {
  if (!enabled) return;
  const a = ac();
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Short filtered noise burst (thuds, garbage).
function noise({ dur = 0.12, vol = 0.12, freq = 400, delay = 0 }) {
  if (!enabled) return;
  const a = ac();
  const t = a.currentTime + delay;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

// Scales the combo note can climb, as semitones above C within one octave.
// The choice is made in Lab → Sound test and kept for the game itself.
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
// How a line clear says how many lines went. All three use the same four
// notes, C4 G4 C5 G5 (root and fifth, no third, so they sit under any combo
// scale): one note a line.
//   hits      the lines counted out on one note
//   arpeggio  the notes one after another, climbing
//   chord     the notes together: the more lines, the fuller the sound
export const CLEAR_STYLES = ["arpeggio", "chord", "hits"];
const CLEAR_NOTES = [261.63, 392, 523.25, 783.99];
const STYLE_KEY = "jbl-clear-style";
let clearStyle = "arpeggio";
try {
  const saved = localStorage.getItem(STYLE_KEY);
  if (CLEAR_STYLES.includes(saved)) clearStyle = saved;
} catch {
  // no storage: the default style
}
export const getClearStyle = () => clearStyle;
export function setClearStyle(name) {
  if (!CLEAR_STYLES.includes(name)) return;
  clearStyle = name;
  try {
    localStorage.setItem(STYLE_KEY, name);
  } catch {
    // not kept, still used for this visit
  }
}
// Seconds from the placement to the end of the clear's own notes, which is
// where the combo note comes in.
const clearSpan = (lines) => (clearStyle === "chord" ? 0.07 : Math.min(lines, 4) * CLEAR_STEP + 0.02);

const SCALE_KEY = "jbl-combo-scale";
let comboScale = "major";
try {
  const saved = localStorage.getItem(SCALE_KEY);
  if (saved && SCALES[saved]) comboScale = saved;
} catch {
  // no storage: the default scale
}
export const getComboScale = () => comboScale;
export function setComboScale(name) {
  if (!SCALES[name]) return;
  comboScale = name;
  try {
    localStorage.setItem(SCALE_KEY, name);
  } catch {
    // not kept, still used for this visit
  }
}

const SPIN_LEAD = 0.06; // length of the twist before a T-spin's notes
// One note a line: times (octave shift as a frequency multiplier), after (seconds to wait first).
function clearNotes(lines, times = 1, after = 0) {
  const n = Math.min(Math.max(lines, 1), 4);
  for (let i = 0; i < n; i++) {
    if (clearStyle === "hits") tone({ freq: 392 * times, type: "triangle", dur: 0.07, vol: 0.1, delay: after + i * CLEAR_STEP });
    else if (clearStyle === "chord") tone({ freq: CLEAR_NOTES[i] * times, type: "triangle", dur: 0.2 + 0.03 * n, vol: 0.09 - 0.012 * n, delay: after });
    else tone({ freq: CLEAR_NOTES[i] * times, type: "triangle", dur: i === n - 1 ? 0.18 : 0.08, vol: 0.09, delay: after + i * CLEAR_STEP });
  }
}

const CLEAR_STEP = 0.06; // seconds between the hits of a line clear

export const sfx = {
  // input
  move: () => tone({ freq: 520, type: "triangle", dur: 0.03, vol: 0.035 }),
  rotate: () => tone({ freq: 660, type: "triangle", dur: 0.045, vol: 0.05, slide: 780 }),
  hold: () => tone({ freq: 440, type: "sine", dur: 0.09, vol: 0.07, slide: 330 }),
  drop: () => tone({ freq: 800, type: "sine", dur: 0.08, vol: 0.12 }),
  // results of a placement
  // A line clear: one note a line, in the chosen style (see CLEAR_STYLES).
  clear: (lines) => clearNotes(lines),
  // A T-spin is the same clear said an octave up, after a quick upward
  // twist: the count reads the same way, and the twist marks the spin.
  spin: (lines) => {
    tone({ freq: 523.25, type: "sine", dur: SPIN_LEAD, vol: 0.07, slide: 1046.5 });
    clearNotes(lines, 2, SPIN_LEAD);
  },
  perfect: () => {
    [523, 659, 784, 1047, 1319, 2093].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.08, delay: i * 0.06 }));
  },
  // Fault: two falling buzzes. Kept above 200 Hz so small speakers carry it.
  miss: () => {
    if (!opts.fault) return;
    tone({ freq: 330, type: "square", dur: 0.08, vol: 0.06, slide: 294 });
    tone({ freq: 233, type: "square", dur: 0.13, vol: 0.06, slide: 196, delay: 0.09 });
  },
  // Back-to-back: a low note answered an octave up, under the clear sound.
  b2b: () => {
    if (!opts.b2b) return;
    tone({ freq: 392, type: "square", dur: 0.09, vol: 0.035, delay: 0.1 });
    tone({ freq: 784, type: "square", dur: 0.14, vol: 0.035, delay: 0.18 });
  },
  // Combo: one short note that climbs the chosen scale with every clear in a
  // row, from C5 (combo 1) up two octaves to C7, where it stays.
  // lines, spin: what was cleared, so the note lands after the clear's own notes.
  combo: (n, lines = 1, spin = false) => {
    if (!opts.combo) return;
    const scale = SCALES[comboScale];
    const step = Math.min(Math.max(n, 1), 2 * scale.length + 1) - 1;
    const semitones = 12 * Math.floor(step / scale.length) + scale[step % scale.length];
    tone({ freq: 523.25 * 2 ** (semitones / 12), type: "sine", dur: 0.1, vol: 0.07, delay: clearSpan(lines) + (spin ? SPIN_LEAD : 0) });
  },
  garbage: () => noise({ dur: 0.14, vol: 0.18, freq: 300 }),
  // flow
  ready: () => tone({ freq: 440, type: "sine", dur: 0.1, vol: 0.08 }),
  go: () => tone({ freq: 880, type: "sine", dur: 0.16, vol: 0.1 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.25, vol: 0.09, delay: i * 0.09 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.28, vol: 0.08, delay: i * 0.12 })),
  // UI
  tick: () => tone({ freq: 1200, type: "sine", dur: 0.025, vol: 0.025 }),
  select: () => tone({ freq: 900, type: "sine", dur: 0.06, vol: 0.05, slide: 1200 }),
};

// Back-compat for older call sites.
export function playDropSound() {
  sfx.drop();
}

// Plays the sound for a key action the moment it's pressed.
export function sfxForAction(action) {
  if (action === "left" || action === "right") sfx.move();
  else if (action === "rotateCW" || action === "rotateCCW" || action === "rotate180") sfx.rotate();
}

// Call once per frame with an engine: plays lock / clear / spin / perfect
// clear / hold / garbage / top-out sounds by comparing with last frame.
const seen = new WeakMap();
// fault: sound a wasted key press on the piece just placed (off where the
// mode judges finesse itself and already sounds it).
export function trackSfx(engine, { topout = true, fault = true } = {}) {
  const prev = seen.get(engine);
  const now = {
    placed: engine.placedBlocks,
    lines: engine.lines,
    hold: engine.hold,
    over: engine.gameOver,
    garbage: engine.garbageApplied || 0,
  };
  seen.set(engine, now);
  if (!prev) return;
  if (now.hold !== prev.hold) sfx.hold();
  if (now.placed > prev.placed) {
    const lines = now.lines - prev.lines;
    const action = engine.lastAction || "";
    if (/Perfect/i.test(action)) sfx.perfect();
    else if (/Spin/i.test(action) && lines > 0) sfx.spin(lines);
    else if (lines > 0) sfx.clear(lines);
    else sfx.drop();
    // The last placement in the log says how it went.
    const log = engine.replay;
    let last = log.length - 1;
    while (last >= 0 && log[last].kind !== "place") last--;
    if (fault && log[last]?.finesseFault > 0) sfx.miss();
    if (lines > 0) {
      if (log[last]?.b2b) sfx.b2b();
      if (engine.combo >= 1) sfx.combo(engine.combo, lines, /Spin/i.test(action));
    }
  }
  if (now.garbage > prev.garbage) sfx.garbage();
  if (topout && now.over && !prev.over) sfx.lose();
}

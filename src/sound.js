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

const CLEAR_STEP = 0.06; // seconds between the hits of a line clear

export const sfx = {
  // input
  move: () => tone({ freq: 520, type: "triangle", dur: 0.03, vol: 0.035 }),
  rotate: () => tone({ freq: 660, type: "triangle", dur: 0.045, vol: 0.05, slide: 780 }),
  hold: () => tone({ freq: 440, type: "sine", dur: 0.09, vol: 0.07, slide: 330 }),
  drop: () => tone({ freq: 800, type: "sine", dur: 0.08, vol: 0.12 }),
  // results of a placement
  // A line clear is counted out: one hit a line, all on the same note (G4),
  // so the pitch is left to the combo. A quad ends on a fifth above.
  clear: (lines) => {
    const n = Math.min(Math.max(lines, 1), 4);
    for (let i = 0; i < n; i++) tone({ freq: 392, type: "triangle", dur: 0.07, vol: 0.1, delay: i * CLEAR_STEP });
    if (n === 4) tone({ freq: 587, type: "sine", dur: 0.16, vol: 0.06, delay: 3 * CLEAR_STEP });
  },
  spin: (lines) => {
    [880, 1109, 1319].slice(0, Math.max(1, lines)).forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.14, vol: 0.08, delay: i * 0.05 }),
    );
  },
  perfect: () => {
    [523, 659, 784, 1047, 1319, 2093].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.08, delay: i * 0.06 }));
  },
  miss: () => opts.fault && tone({ freq: 180, type: "square", dur: 0.12, vol: 0.05, slide: 120 }),
  // Back-to-back: a low note answered an octave up, under the clear sound.
  b2b: () => {
    if (!opts.b2b) return;
    tone({ freq: 392, type: "square", dur: 0.09, vol: 0.035, delay: 0.1 });
    tone({ freq: 784, type: "square", dur: 0.14, vol: 0.035, delay: 0.18 });
  },
  // Combo: one short note that climbs the chosen scale with every clear in a
  // row, from C5 (combo 1) up two octaves to C7, where it stays.
  // lines: how many were cleared, so the note lands after the hits of the clear.
  combo: (n, lines = 1) => {
    if (!opts.combo) return;
    const scale = SCALES[comboScale];
    const step = Math.min(Math.max(n, 1), 2 * scale.length + 1) - 1;
    const semitones = 12 * Math.floor(step / scale.length) + scale[step % scale.length];
    tone({ freq: 523.25 * 2 ** (semitones / 12), type: "sine", dur: 0.1, vol: 0.07, delay: Math.min(lines, 4) * CLEAR_STEP + 0.02 });
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
export function trackSfx(engine, { topout = true } = {}) {
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
    if (lines > 0) {
      // The last placement in the log says whether the back-to-back bonus held.
      const log = engine.replay;
      let last = log.length - 1;
      while (last >= 0 && log[last].kind !== "place") last--;
      if (log[last]?.b2b) sfx.b2b();
      if (engine.combo >= 1) sfx.combo(engine.combo, lines);
    }
  }
  if (now.garbage > prev.garbage) sfx.garbage();
  if (topout && now.over && !prev.over) sfx.lose();
}

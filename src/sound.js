// ─── SOUND ───
// Small synthesized sound kit (Web Audio, no files). Everything is short and
// quiet; a single global switch follows the Sound setting.

let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = !!on;
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

export const sfx = {
  // input
  move: () => tone({ freq: 520, type: "triangle", dur: 0.03, vol: 0.035 }),
  rotate: () => tone({ freq: 660, type: "triangle", dur: 0.045, vol: 0.05, slide: 780 }),
  hold: () => tone({ freq: 440, type: "sine", dur: 0.09, vol: 0.07, slide: 330 }),
  drop: () => tone({ freq: 800, type: "sine", dur: 0.08, vol: 0.12 }),
  // results of a placement
  clear: (lines) => {
    const base = [0, 523, 587, 659, 784][Math.min(lines, 4)];
    tone({ freq: base, type: "triangle", dur: 0.16, vol: 0.1 });
    tone({ freq: base * 1.5, type: "sine", dur: 0.2, vol: 0.06, delay: 0.05 });
  },
  spin: (lines) => {
    [880, 1109, 1319].slice(0, Math.max(1, lines)).forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.14, vol: 0.08, delay: i * 0.05 }),
    );
  },
  perfect: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.08, delay: i * 0.06 }));
  },
  miss: () => tone({ freq: 180, type: "square", dur: 0.12, vol: 0.05, slide: 120 }),
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
  }
  if (now.garbage > prev.garbage) sfx.garbage();
  if (topout && now.over && !prev.over) sfx.lose();
}

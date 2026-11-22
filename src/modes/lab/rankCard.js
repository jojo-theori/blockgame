// The run's rank as a picture to keep or post: a tall card (1080 × 1350)
// drawn on a canvas and handed over as a PNG.
import { RANK_MAX } from "./rank.js";

const W = 1080;
const H = 1350;
// The seal's colours per letter (the page's own come from replay.css).
const COLORS = { SSS: ["#ff7ab6", "#ffd75e", "#6fe3a1", "#5fb8ff", "#b98cff"], SS: ["#ffe9a3", "#f6c945", "#fff6d6"], S: ["#e3bf3f"], A: ["#5cc45c"], B: ["#41b6e6"], C: ["#a66bd6"], D: ["#e8903a"], E: ["#e8505b"] };

// what: { letter, step, title, points, scores: [[label, value]], caption }
export function drawRankCard({ letter, step, title, points, scores, caption }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const font = getComputedStyle(document.body).fontFamily;
  const colors = COLORS[letter];
  const cx = W / 2;
  const cy = 430;
  const r = 210;
  const paint = () => {
    if (colors.length === 1) return colors[0];
    const g = ctx.createConicGradient(-Math.PI / 2, cx, cy);
    colors.forEach((c, i) => g.addColorStop(i / colors.length, c));
    g.addColorStop(1, colors[0]);
    return g;
  };
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, W, H);
  // A glow behind the seal, stronger the higher the rank.
  const strength = { SSS: 0.5, SS: 0.4, S: 0.3 }[letter] || 0.16;
  const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 620);
  glow.addColorStop(0, colors[0] + Math.round(strength * 255).toString(16).padStart(2, "0"));
  glow.addColorStop(1, "#0b0b0c00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // The seal: two rings, three for the S ranks.
  ctx.strokeStyle = paint();
  [[r, 10], [r + 26, 3], ...(letter.startsWith("S") ? [[r + 46, 2]] : [])].forEach(([radius, width]) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.fillStyle = paint();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = letter.length === 3 ? 150 : letter.length === 2 ? 190 : 230;
  ctx.font = `700 ${size}px ${font}`;
  const lw = ctx.measureText(letter).width;
  ctx.font = `700 ${size * 0.6}px ${font}`;
  const sw = step ? ctx.measureText(step).width + 6 : 0;
  ctx.font = `700 ${size}px ${font}`;
  ctx.fillText(letter, cx - sw / 2, cy + size * 0.04);
  if (step) {
    ctx.font = `700 ${size * 0.6}px ${font}`;
    ctx.fillText(step, cx + lw / 2 + 6, cy);
  }
  ctx.fillStyle = "#f2f2f2";
  ctx.font = `600 68px ${font}`;
  ctx.fillText(title, cx, 790);
  ctx.fillStyle = "#9a9a9a";
  ctx.font = `400 40px ${font}`;
  ctx.fillText(`${points} / ${RANK_MAX}`, cx, 868);
  scores.forEach(([label, value], i) => {
    const x = cx + (i - (scores.length - 1) / 2) * 250;
    ctx.fillStyle = "#7a7a7a";
    ctx.font = `500 30px ${font}`;
    ctx.fillText(label, x, 1000);
    ctx.fillStyle = "#f2f2f2";
    ctx.font = `600 72px ${font}`;
    ctx.fillText(String(value), x, 1070);
  });
  ctx.fillStyle = "#7a7a7a";
  ctx.font = `400 32px ${font}`;
  if (caption) ctx.fillText(caption, cx, 1200);
  ctx.fillStyle = "#f2f2f2";
  ctx.font = `700 34px ${font}`;
  ctx.fillText("JBL", cx, 1268);
  return canvas;
}

export function saveRankCard(what) {
  drawRankCard(what).toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jbl-${what.letter}${what.step === "+" ? "-plus" : what.step ? "-minus" : ""}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}

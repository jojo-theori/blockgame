// Writes public/favicon.svg from one of the arrangements in Lab → Logo, and
// marks it as the one in use:  node scripts/favicon.mjs "5×5-183" 45
// The second argument turns it that many degrees clockwise (0, 45 or -45).
import { readFileSync, writeFileSync } from "node:fs";
import { logoLayouts, markCells } from "../src/logoLayouts.js";

const code = (process.argv[2] || "").replace("x", "×");
const turn = Number(process.argv[3] || 0);
const layout = logoLayouts().find((a) => a.code === code);
if (!layout) throw new Error(`no arrangement named "${code}"`);
const groups = {};
for (const c of markCells(layout, 32, 0.16, turn)) (groups[c.color] ||= []).push(c);
const n = (v) => +v.toFixed(3);
// Turned, each square gets a hair of its own colour around it, so no line shows where two meet.
const rects = Object.entries(groups)
  .map(([color, cells]) => `    <g fill="${color}"${turn ? ` stroke="${color}" stroke-width="0.4"` : ""}>${cells.map((c) => `<rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.side)}" height="${n(c.side)}"/>`).join("")}</g>`)
  .join("\n");
writeFileSync(
  new URL("../public/favicon.svg", import.meta.url),
  `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- The three pieces of the name, S, Z and O, set down as one shape (Lab → Logo, ${code}${turn ? `, turned ${turn}°` : ""}). -->
  <rect width="32" height="32" rx="8" fill="#0a0a0a"/>
  <g ${turn ? `transform="rotate(${turn} 16 16)"` : `shape-rendering="crispEdges"`}>
${rects}
  </g>
</svg>
`,
);
const lab = new URL("../src/modes/LogoLab.jsx", import.meta.url);
writeFileSync(
  lab,
  readFileSync(lab, "utf8")
    .replace(/export const CURRENT = "[^"]*";/, `export const CURRENT = "${code}";`)
    .replace(/export const CURRENT_TURN = -?\d+;/, `export const CURRENT_TURN = ${turn};`),
);
console.log(`favicon: ${code}${turn ? ` turned ${turn}°` : ""}`);

// Writes public/favicon.svg from one of the arrangements in Lab → Logo, and
// marks it as the one in use:  node scripts/favicon.mjs "4×4-15"
import { readFileSync, writeFileSync } from "node:fs";
import { logoLayouts, markCells } from "../src/logoLayouts.js";

const code = (process.argv[2] || "").replace("x", "×");
const layout = logoLayouts().find((a) => a.code === code);
if (!layout) throw new Error(`no arrangement named "${code}"`);
const groups = {};
for (const c of markCells(layout, 32, 0.16)) (groups[c.color] ||= []).push(c);
const rects = Object.entries(groups)
  .map(([color, cells]) => `    <g fill="${color}">${cells.map((c) => `<rect x="${c.x}" y="${c.y}" width="${c.side}" height="${c.side}"/>`).join("")}</g>`)
  .join("\n");
writeFileSync(
  new URL("../public/favicon.svg", import.meta.url),
  `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- The three pieces of the name, S, Z and O, set down as one shape (Lab → Logo, ${code}). -->
  <rect width="32" height="32" rx="8" fill="#0a0a0a"/>
  <g shape-rendering="crispEdges">
${rects}
  </g>
</svg>
`,
);
const lab = new URL("../src/modes/LogoLab.jsx", import.meta.url);
writeFileSync(lab, readFileSync(lab, "utf8").replace(/export const CURRENT = "[^"]*";/, `export const CURRENT = "${code}";`));
console.log(`favicon: ${code}`);

// Keeps the one global stylesheet honest. Run with `npm run css`.
//   1. A class with a screen's prefix (sb-, lab-, …) is styled only in that
//      screen's file, so two screens cannot fight over a name.
//   2. A prefixed class used in a component has a rule somewhere (a typo, or
//      a rule that was deleted).
//   3. A prefixed class with rules is used by some component (dead rules).
// Exits with an error on 1 and 2; 3 is listed as a warning.
import fs from "fs";
import path from "path";

const HOME = { "sb-": "sandbox.css", "lab-": "replay.css", "snd-": "replay.css", "cat-": "system.css", "exp-": "replay.css" };
// The shared parts' own classes: no other sheet may use these names, even as
// one class among several on an element (".kbd.icon" once broke ".icon").
const PARTS = ["ds-btn", "ds-icon", "icon-btn", "chip-grid", "well", "well-hint", "help-tip", "help-tip-body", "help-keys", "has-tip", "tip-body"];
const prefixOf = (name) => Object.keys(HOME).find((p) => name.startsWith(p));

const defined = new Map(); // class → Set(files)
for (const f of fs.readdirSync("src/styles")) {
  const css = fs.readFileSync(path.join("src/styles", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of css.matchAll(/([^{}]+)\{/g)) {
    for (const m of rule[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) {
      if (!defined.has(m[1])) defined.set(m[1], new Set());
      defined.get(m[1]).add(f);
    }
  }
}

const used = new Set();
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f)) for (const m of fs.readFileSync(p, "utf8").matchAll(/[\w-]+/g)) used.add(m[0]);
  }
};
walk("src");

const errors = [];
const warnings = [];
for (const [name, files] of defined) {
  const prefix = prefixOf(name);
  if (!prefix) continue;
  const away = [...files].filter((f) => f !== HOME[prefix]);
  if (away.length) errors.push(`.${name} belongs in ${HOME[prefix]} but is styled in ${away.join(", ")}`);
  if (!used.has(name)) warnings.push(`.${name} has rules (${[...files].join(", ")}) but no component uses it`);
}
for (const name of PARTS) {
  const away = [...(defined.get(name) || [])].filter((f) => f !== "system.css");
  if (away.length) errors.push(`.${name} is a shared part's class (system.css) but is also styled in ${away.join(", ")}`);
}
for (const name of used) {
  // Names built at run time ("rank-" + letter) end in a hyphen here; skip them.
  if (prefixOf(name) && !name.endsWith("-") && !defined.has(name) && /^[a-z]+-[a-z][a-z-]*$/.test(name)) errors.push(`.${name} is used in a component but has no rule`);
}
for (const w of warnings) console.log("warning:", w);
for (const e of errors) console.log("error:", e);
console.log(`${defined.size} classes, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);

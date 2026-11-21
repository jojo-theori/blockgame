// Lists English UI strings that have no Korean entry in src/ko.js.
// Run with `npm run i18n` when it's time to batch-update translations.
import fs from "fs";
import path from "path";
import KO from "../src/ko.js";

const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f) && !/ko\.js$/.test(f)) files.push(p);
  }
};
walk("src");
const re = /t\("([^"]+)"|label: "([^"]+)"|\bk="([^"]+)"|label="([^"]+)"|hint="([^"]+)"|\]\], "([^"]+)"\]/g;
const missing = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(re)) {
    const key = m.slice(1).find(Boolean);
    if (!/[a-z]{2}/i.test(key) || key in KO) continue;
    if (!missing.has(key)) missing.set(key, f);
  }
}
if (!missing.size) console.log("All UI strings have Korean.");
else for (const [k, f] of missing) console.log(`${f}\t${k}`);

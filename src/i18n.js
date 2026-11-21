// ─── Language ───
// English strings are the keys; Korean comes from ko.js. t("Seat {n}", { n: 1 })
// fills {placeholders}. App sets the language before each render.
import KO from "./ko.js";

let lang = "en";
export function setLang(l) {
  lang = l === "ko" ? "ko" : "en";
  document.documentElement.lang = lang;
}
export function getLang() {
  return lang;
}
export function t(s, vars) {
  let out = lang === "ko" ? (KO[s] ?? s) : s;
  if (vars) for (const k in vars) out = out.split(`{${k}}`).join(vars[k]);
  return out;
}

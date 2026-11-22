// ─── The player's name ───
// Shown on the rank card. Kept on this device until there are accounts; until
// one is set, a stand-in that plainly is one.
const KEY = "jbl-name";
export const NAME_MAX = 10;
export const NAME_PLACEHOLDER = "NICKNAME";

export function loadName() {
  try {
    return (localStorage.getItem(KEY) || "").slice(0, NAME_MAX);
  } catch {
    return "";
  }
}

export function saveName(name) {
  const clean = (name || "").trim().slice(0, NAME_MAX);
  try {
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return clean;
}

// ─── Recently analysed runs ───
// A run sent to Replay from a result screen is kept here, newest first, so it
// can be opened again from the Replay page. On this device only (an account
// would hold them, once there are accounts).
const KEY = "jbl-replays";
const KEEP = 8;

export function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((r) => r && typeof r.text === "string") : [];
  } catch {
    return [];
  }
}

export function saveRecent(text) {
  const clean = (text || "").trim();
  if (!clean) return;
  const list = [{ text: clean, at: Date.now() }, ...loadRecent().filter((r) => r.text !== clean)].slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

// Takes one run off the list (by the time it was kept) and returns what is left.
export function removeRecent(at) {
  const list = loadRecent().filter((r) => r.at !== at);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

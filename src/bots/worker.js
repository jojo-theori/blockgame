// Web Worker: runs the bots off the main thread so the game never stutters.
import { botMove } from "./engines.js";

self.onmessage = async (e) => {
  const { id, bot, state, opts } = e.data;
  try {
    const moves = await botMove(bot, state, opts);
    self.postMessage({ id, moves });
  } catch (err) {
    self.postMessage({ id, moves: "", error: String(err) });
  }
};

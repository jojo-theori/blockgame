// ─── A sample run for the replay page ───
// Plays a 40-line Sprint on the real engine (the built-in CPU choosing the
// spots) with the slips a person makes: a placement a column or two off now
// and then, some wasted taps, a few holds, three long hesitations. Seeded, so
// it is the same run every time. Returned as the log text "Copy log" gives.
import { BlockEngine, buildLogText } from "./game.js";
import { findBestPlacement } from "./cpu.js";

function play(seed) {
  const e = new BlockEngine({ seed, sprintLines: 40 });
  e.start();
  let now = 0;
  let rnd = 777 + seed;
  const rand = () => {
    rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
    return rnd / 0x7fffffff;
  };
  for (let n = 1; e.playing && n < 400; n++) {
    const best = findBestPlacement(e.matrix, e.currentId);
    if (!best) break;
    let x = best.x;
    if (rand() < 0.07) x = Math.max(0, Math.min(7, best.x + (rand() < 0.5 ? -2 : 2)));
    if (n % 17 === 9) {
      e.onKeyDown("hold", now);
    } else {
      if (best.rot === 3) e.onKeyDown("rotateCCW", now);
      else for (let i = 0; i < best.rot; i++) e.onKeyDown("rotateCW", now);
      for (let i = 0; i < 14; i++) {
        const dx = x - e.currentX;
        if (!dx || !e.move(dx < 0 ? -1 : 1)) break;
        e.currentPieceKeys++;
      }
      if (rand() < 0.1) {
        e.onKeyDown("left", now);
        e.onKeyUp("left");
        e.onKeyDown("right", now);
        e.onKeyUp("right");
      }
      e.onKeyDown("harddrop", now);
    }
    const took = n === 22 || n === 61 || n === 88 ? 1.9 + rand() : 0.42 + rand() * 0.3;
    e.clock += took;
    now += took * 1000;
  }
  return e;
}

export function sampleLog() {
  // The first seed whose run reaches 40 lines.
  for (let seed = 20261122; seed < 20261122 + 60; seed++) {
    const e = play(seed);
    if (e.completed) return buildLogText(e, "SPRINT 40L");
  }
  return buildLogText(play(20261122), "SPRINT 40L");
}

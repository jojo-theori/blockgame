// ─── The falling piece's path ───
// The log says where each piece ended up; this keeps how it got there, so a
// replay can show the run as it was played. It watches the engine from
// outside: sample() is called around every key press and after every frame,
// and notes the piece's place whenever it has changed. Read back, the path is
// simply drawn, so nothing has to be simulated again.

// paths[n]: the path of the piece that ends in event n of the log (its lock
// or its hold), as [ms since the start, x, y, rot].
export function createTrace() {
  const paths = [];
  let last = "";
  return {
    paths,
    sample(engine) {
      if (!engine?.playing || !engine.currentId) return;
      const n = engine.replay.length;
      const at = `${n},${engine.currentX},${engine.currentY},${engine.currentRot}`;
      if (at === last) return;
      last = at;
      (paths[n] ||= []).push([Math.round(engine.clock * 1000), engine.currentX, engine.currentY, engine.currentRot]);
    },
    text: () => movesText(paths),
  };
}

// As text, to go under a log: one line per piece, numbered like the log's own
// lines. The first time is since the start, the rest since the step before.
//   MOVES
//   #03 1240:3,-1,0 48:4,-1,0 131:4,-1,1
export function movesText(paths) {
  const lines = [];
  paths.forEach((path, n) => {
    if (!path?.length) return;
    let prev = 0;
    const steps = path.map(([ms, x, y, rot]) => {
      const out = `${ms - prev}:${x},${y},${rot}`;
      prev = ms;
      return out;
    });
    lines.push(`#${String(n + 1).padStart(2, "0")} ${steps.join(" ")}`);
  });
  return lines.length ? ["MOVES", ...lines].join("\n") : "";
}

// Text → paths (as createTrace keeps them), or null when the log has none.
export function parseMoves(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const from = lines.indexOf("MOVES");
  if (from < 0) return null;
  const paths = [];
  for (const line of lines.slice(from + 1)) {
    const m = line.match(/^#(\d+)\s+(.+)$/);
    if (!m) continue;
    let ms = 0;
    paths[+m[1] - 1] = m[2]
      .split(/\s+/)
      .map((step) => step.match(/^(\d+):(-?\d+),(-?\d+),(\d)$/))
      .filter(Boolean)
      .map(([, dt, x, y, rot]) => [(ms += +dt), +x, +y, +rot]);
  }
  return paths.some((p) => p?.length) ? paths : null;
}

// Where the piece of event n was at this moment (seconds), or null before
// its first step.
export function pathAt(paths, n, seconds) {
  const path = paths?.[n];
  if (!path) return null;
  const ms = seconds * 1000;
  let at = null;
  for (const step of path) {
    if (step[0] > ms) break;
    at = step;
  }
  return at && { x: at[1], y: at[2], rot: at[3] };
}

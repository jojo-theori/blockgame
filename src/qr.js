// ─── A small QR code ───
// Enough for a link: error correction level L, versions 1 to 20 (up to 858
// bytes), mask 0. The text goes in as bytes, except a long tail made only of
// digits, capitals and " $%*+-./:", which goes in the denser alphanumeric
// mode (11 bits to two characters). Returns the modules as rows of booleans
// (true is dark), or null when the text is too long.

// Level L, by version: check bytes per block, and how many blocks.
const EC = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28];
const BLOCKS = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8];
const MAX_VERSION = 20;

// Where the alignment marks sit along each side, for this version.
function alignments(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = version * 4 + 10; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}
// All the codewords (data and check) a version holds.
function totalWords(version) {
  let bits = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const n = Math.floor(version / 7) + 2;
    bits -= (25 * n - 10) * n - 55;
    if (version >= 7) bits -= 36;
  }
  return Math.floor(bits / 8);
}
const dataWords = (version) => totalWords(version) - EC[version] * BLOCKS[version];
const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
// How long a tail has to be before a segment of its own pays for itself.
const TAIL_MIN = 24;

// GF(256) arithmetic for the Reed–Solomon check bytes (polynomial 0x11d).
const mul = (a, b) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((b >>> i) & 1) * a;
  }
  return z;
};
export function checkBytes(data, count) {
  // The generator: (x − 2^0)(x − 2^1)…, kept without its leading 1.
  const gen = new Array(count).fill(0);
  gen[count - 1] = 1;
  let root = 1;
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      gen[j] = mul(gen[j], root);
      if (j + 1 < count) gen[j] ^= gen[j + 1];
    }
    root = mul(root, 2);
  }
  const rem = new Array(count).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift();
    rem.push(0);
    gen.forEach((g, i) => (rem[i] ^= mul(g, factor)));
  }
  return rem;
}

// The 15 format bits for level L and this mask.
export function formatBits(mask) {
  const data = (1 << 3) | mask; // level L is 01
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

export function qr(text) {
  // Split off the tail that can go in alphanumeric mode.
  let cut = text.length;
  while (cut > 0 && ALNUM.includes(text[cut - 1])) cut--;
  if (text.length - cut < TAIL_MIN) cut = text.length;
  const bytes = [...new TextEncoder().encode(text.slice(0, cut))];
  const tail = text.slice(cut);
  // The bits it all takes: each segment is a mode (4), a length (longer from
  // version 10), then its contents.
  const need = (version) => (bytes.length ? 4 + (version < 10 ? 8 : 16) + bytes.length * 8 : 0) + (tail ? 4 + (version < 10 ? 9 : 11) + Math.floor(tail.length / 2) * 11 + (tail.length % 2) * 6 : 0);
  let version = 1;
  while (version <= MAX_VERSION && need(version) > dataWords(version) * 8) version++;
  if (version > MAX_VERSION) return null;
  const capacity = dataWords(version);

  const bits = [];
  const push = (value, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  if (bytes.length) {
    push(4, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach((b) => push(b, 8));
  }
  if (tail) {
    push(2, 4);
    push(tail.length, version < 10 ? 9 : 11);
    for (let i = 0; i + 1 < tail.length; i += 2) push(ALNUM.indexOf(tail[i]) * 45 + ALNUM.indexOf(tail[i + 1]), 11);
    if (tail.length % 2) push(ALNUM.indexOf(tail.at(-1)), 6);
  }
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);

  // Split into blocks (the last ones a byte longer), give each its check
  // bytes, and deal them out a byte at a time.
  const count = BLOCKS[version];
  const short = Math.floor(capacity / count);
  const longOnes = capacity % count;
  const blocks = [];
  for (let i = 0, at = 0; i < count; i++) {
    const len = short + (i >= count - longOnes ? 1 : 0);
    const part = data.slice(at, at + len);
    at += len;
    blocks.push({ part, check: checkBytes(part, EC[version]) });
  }
  const words = [];
  for (let i = 0; i <= short; i++) for (const blk of blocks) if (i < blk.part.length) words.push(blk.part[i]);
  for (let i = 0; i < EC[version]; i++) for (const blk of blocks) words.push(blk.check[i]);

  const size = 17 + 4 * version;
  const dark = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, on) => {
    dark[y][x] = on;
    fixed[y][x] = true;
  };
  // Timing lines, the three finders (with their margins), the alignment mark.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const marks = alignments(version);
  marks.forEach((cx, i) =>
    marks.forEach((cy, j) => {
      // Not where the three finders are.
      const last = marks.length - 1;
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  // From version 7 the version is written in too, twice.
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const info = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const on = ((info >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, on);
      set(b, a, on);
    }
  }
  // The format bits, twice, and the module that is always dark.
  const format = formatBits(0);
  const bit = (i) => ((format >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);

  // The codewords, in the zigzag from the bottom right; then mask 0.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (fixed[y][x] || i >= words.length * 8) continue;
        dark[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && (x + y) % 2 === 0) dark[y][x] = !dark[y][x];
  return dark;
}

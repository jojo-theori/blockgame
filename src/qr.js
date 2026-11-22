// ─── A small QR code ───
// Enough for a web address: byte mode, error correction level L, versions 1
// to 5 (up to 106 bytes), mask 0. Returns the modules as rows of booleans
// (true is dark), or null when the text is too long.

// [version]: total codewords, error-correction codewords (one block at level L).
const SPEC = [null, [26, 7], [44, 10], [70, 15], [100, 20], [134, 26]];

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
  const bytes = [...new TextEncoder().encode(text)];
  const version = SPEC.findIndex((s) => s && bytes.length <= s[0] - s[1] - 2);
  if (version < 1) return null;
  const [total, ec] = SPEC[version];
  const room = total - ec;

  // Mode (byte), length, the bytes, a terminator, then padding.
  const bits = [];
  const push = (value, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, room * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < room; pad ^= 0xec ^ 0x11) data.push(pad);
  const words = [...data, ...checkBytes(data, ec)];

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
  if (version > 1) {
    const c = size - 7;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
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

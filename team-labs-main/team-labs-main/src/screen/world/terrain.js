
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

const perm = buildPerm(1337);

export function noise2(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    const g = GRAD[perm[ii + perm[jj]] & 7];
    t0 *= t0;
    n += t0 * t0 * (g[0] * x0 + g[1] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7];
    t1 *= t1;
    n += t1 * t1 * (g[0] * x1 + g[1] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7];
    t2 *= t2;
    n += t2 * t2 * (g[0] * x2 + g[1] * y2);
  }
  return 70 * n;
}

export function fbm(x, y, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

function ridged(x, y, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise2(x * freq, y * freq));
    sum += amp * n * n;
    freq *= 2.1;
    amp *= 0.5;
  }
  return sum;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const WORLD_SIZE = 600;
export const ARENA = 19;
export const LAKE = { x: 26, z: -30, r: 15, level: -0.55 };

export function lakeFactor(x, z) {
  const dx = (x - LAKE.x) / LAKE.r;
  const dz = (z - LAKE.z) / (LAKE.r * 0.72);
  const d = Math.sqrt(dx * dx + dz * dz) + fbm(x * 0.08, z * 0.08, 2) * 0.18;
  return 1 - smoothstep(0.55, 1.05, d);
}

export function heightAt(x, z) {
  const r = Math.sqrt(x * x + z * z);
  const meadow = fbm(x * 0.045, z * 0.045, 3) * 0.35;
  const hills = (fbm(x * 0.012 + 7.3, z * 0.012 - 3.1, 5) * 0.5 + 0.5) * 14;
  const mountains = Math.pow(ridged(x * 0.0055 + 11, z * 0.0055 + 5, 6), 1.6) * 95;

  const hillMix = smoothstep(ARENA, ARENA + 32, r);
  const mountainMix = smoothstep(110, 230, r);
  let h = meadow + hills * hillMix + mountains * mountainMix;

  const lake = lakeFactor(x, z);
  h = h * (1 - lake) + (LAKE.level - 2.2) * lake;
  return h;
}

export function slopeAt(x, z) {
  const e = 0.6;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

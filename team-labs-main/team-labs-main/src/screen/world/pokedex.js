import * as THREE from 'three';
import { noise2 } from './terrain.js';
import { TAU, UP, ball, seg, cone, spike, horn, drop, spine, slab, ring, warp, fluff, grad, vgrad, axisGrad, belly, eye, chain, quad, biped, bird, wingPair, aim } from './pokekit.js';

const smooth = THREE.MathUtils.smoothstep;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const C = (h) => new THREE.Color(h);

const FIRE = [[0, '#fff6c8'], [0.3, '#ffcf3a'], [0.65, '#ff7a1a'], [1, '#e8301a']];
const BLUEFIRE = [[0, '#f2fbff'], [0.35, '#8fd8ff'], [0.75, '#3a7aff'], [1, '#2a3ad8']];

function fire(k, bone, at, r, h, o = {}) {
  const g = drop(r, h, o.sweep ?? 0.35, 10);
  if (o.dir) aim(g, o.dir, UP);
  g.translate(...at);
  const pal = grad(o.pal || FIRE);
  const [ax, ay, az] = at;
  k.add(bone, g, { color: (x, y, z, c) => pal(clamp01(Math.hypot(x - ax, y - ay, z - az) / h), c), glow: o.glow ?? 1, mottle: 0 });
}

function pointEar(w, h, out, outer, inner, tip, o = {}) {
  return (k, b, s) => {
    const paint = tip ? axisGrad([[0, outer], [o.tipAt ?? 0.66, outer], [(o.tipAt ?? 0.66) + 0.04, tip], [1, tip]], 'y', 0, h) : outer;
    k.add(b, cone(w, h, 10).scale(1, 1, o.flat ?? 0.42), { rot: [o.back ?? -0.15, 0, -s * out], color: paint });
    if (inner) k.add(b, cone(w * 0.62, h * 0.72, 8).scale(1, 1, 0.25).translate(0, h * 0.04, w * 0.16), { rot: [o.back ?? -0.15, 0, -s * out], color: inner });
  };
}

function chestPlate(top, plate, R, o = {}) {
  const a = C(top);
  const b = C(plate);
  return (x, y, z, c) => c.copy(a).lerp(b, smooth(z, R * (o.z0 ?? 0.3), R * (o.z1 ?? 0.75)) * (1 - smooth(Math.abs(x), R * (o.w0 ?? 0.45), R * (o.w1 ?? 0.8))) * (1 - smooth(y, o.y0 ?? 9, o.y1 ?? 10)));
}

function bandTail(a, b, n = 6) {
  const stops = [];
  for (let i = 0; i <= n; i++) stops.push([i / n, i % 2 ? b : a]);
  return grad(stops);
}

function fanTails(k, body, count, spread, o) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? 0 : -spread + (2 * spread * i) / (count - 1);
    out.push(chain(k, body, [Math.sin(a) * o.base, o.y, o.z], [Math.sin(a) * (o.out ?? 0.6), o.up ?? 0.6, -1], o.n ?? 4, o.len, o.radius, o.color, [o.curl ?? -1.2, 0, a * (o.twist ?? 0.5)], { fluff: o.fluff, sides: 10 }));
  }
  return out;
}

function face(k, head, w, o = {}) {
  for (const s of [1, -1]) eye(k, head, s * w * (o.x ?? 0.42), w * (o.y ?? 0.1), w * (o.z ?? 0.8), w * (o.r ?? 0.2), o.eye || {});
  if (o.mouth) k.add(head, ball(w * o.mouth, w * 0.05, w * 0.06), { at: [0, -w * (o.my ?? 0.35), w * (o.mz ?? 0.9)], color: o.mouthColor || '#3a1418', mottle: 0 });
}

function bolt(len, w) {
  const p = [[0, 0], [w * 0.6, len * 0.12], [w * 0.25, len * 0.18], [w * 1.0, len * 0.42], [w * 0.55, len * 0.47], [w * 1.6, len * 0.85], [w * 2.4, len * 0.8], [w * 1.05, len * 0.44], [w * 1.45, len * 0.4], [w * 0.75, len * 0.12], [w * 0.95, len * 0.08], [w * 0.25, -len * 0.04]];
  return slab(p, w * 0.32, w * 0.12).rotateY(Math.PI / 2);
}

function leaf(len, w) {
  return slab([[0, 0], [w * 0.8, len * 0.15], [w, len * 0.45], [w * 0.55, len * 0.8], [0, len], [-w * 0.55, len * 0.8], [-w, len * 0.45], [-w * 0.8, len * 0.15]], w * 0.08, w * 0.03);
}

function ruff(k, bone, at, r, color, n = 9, seed = 1) {
  const g = ball(r, r * 0.8, r * 0.85, 16, 12);
  fluff(g, 0.28, 9, seed);
  k.add(bone, g, { at, color });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + seed;
    const d = [Math.cos(a) * 0.9, Math.sin(a) * 0.7 - 0.3, 0.35];
    k.add(bone, drop(r * 0.32, r * 0.75, 0.2, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...d).normalize())).translate(at[0] + d[0] * r * 0.6, at[1] + d[1] * r * 0.6, at[2] + d[2] * r * 0.4), { color });
  }
}

function horseFlames(k, j, scale) {
  const hp = j.head.position.clone();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const p = hp.clone().multiplyScalar(t * 0.95 + 0.02);
    fire(k, j.neck, [0, p.y + 0.06, p.z - 0.07], 0.07 * scale * (1 - t * 0.25), 0.32 * scale * (1 - t * 0.25), { dir: [0, 0.7, -1], sweep: 0.5 });
  }
  fire(k, j.head, [0, 0.12 * scale, -0.02], 0.06 * scale, 0.26 * scale, { dir: [0, 1, -0.5], sweep: 0.4 });
  for (let i = 0; i < 4; i++) fire(k, j.body, [(i - 1.5) * 0.04, 0.2 * scale, -0.62 * scale], 0.08 * scale, 0.55 * scale, { dir: [(i - 1.5) * 0.15, 0.7, -1], sweep: 0.6 });
  for (const leg of j.legs) fire(k, leg.knee, [0, -leg.lo * 0.75, -0.02], 0.035 * scale, 0.15 * scale, { dir: [0, 1, -0.6], sweep: 0.4 });
  k.anchor('mouth', j.head, [0, -0.05, 0.3 * scale]);
}

function catStripes(base, under, dark, R, f = 26) {
  const a = C(base);
  const b = C(under);
  const d = C(dark);
  return (x, y, z, c) => {
    c.copy(a);
    if (y < -R * 0.35) return c.copy(b);
    const s = Math.sin(z * f + Math.abs(x) * 6 + noise2(x * 5, z * 5) * 1.2);
    if (s > 0.78 && y > -R * 0.15) c.copy(d);
    return c;
  };
}

function wingGrad(stops) {
  const g = grad(stops);
  return (t, z, c) => g(t, c);
}

function runnerHead(k, chest, at, dir, o) {
  const neck = chain(k, chest, at, dir, 3, o.neck, () => o.neckR, o.neckColor, o.curl || [0.6, 0, 0], { sides: 10 });
  const head = k.bone(neck[neck.length - 1], ...neck.tip.toArray());
  k.add(head, ball(o.r, o.r * 0.92, o.r * 1.05, 14, 10), { color: o.color });
  k.add(head, cone(o.r * 0.3, o.r * 1.35, 10).rotateX(Math.PI / 2 + 0.08).translate(0, -o.r * 0.12, o.r * 0.85), { color: o.beak, gloss: 0.3 });
  for (const s of [1, -1]) eye(k, head, s * o.r * 0.5, o.r * 0.25, o.r * 0.68, o.r * 0.2, { dark: true, color: '#141010', splay: 0.8, squint: o.squint ?? 1 });
  if (o.crest) for (let i = 0; i < 3; i++) k.add(head, spike(o.r * 0.12, o.r * 1.1, [0, 1, -0.7 - i * 0.2], [0, o.r * 0.8, -o.r * 0.1 * i], 6), { color: o.crest });
  return { head, neck };
}

export const DEFS = {
  vulpix: {
    size: 2.5,
    look: { rough: 0.86, sheen: 0.95, sheenColor: '#ffd4b8' },
    mo: { walk: 2.4, run: 6.8, turn: 2.6, runChance: 0.45, idleChance: 0.2, act: 'look' },
    anim: { gait: 'trot', run: 'gallop', tailWag: 0.32, tailFreq: 2.4, bounce: 0.025, earFlick: 1 },
    build(k) {
      const base = '#b8532a';
      const j = quad(k, {
        len: 0.92, r: 0.26, leg: 0.34, legR: 0.062, squash: 0.96, bodyFluff: 0.04,
        coat: belly(base, '#e9b98a', 0.26), legCoat: base, paw: '#9c4422',
        neck: 0.2, tilt: 0.45, neckR: 0.13, neckCoat: base,
        head: [0.23, 0.2, 0.22], snout: [0.085, 0.07, 0.13], sy: 0.35, sz: 0.85, headCoat: base, snoutCoat: '#c4653a',
        eye: { color: '#5a2a12', iris: 0.72 }, eyeR: 0.055, ex: 0.5, ey: 0.14, ez: 0.68,
        ears: pointEar(0.085, 0.22, 0.32, base, '#5a2416'), earY: 0.6
      });
      for (const x of [-0.07, 0, 0.07]) k.add(j.head, ring(0.06, 0.022, Math.PI * 1.6, 8, 16).rotateY(Math.PI / 2), { at: [x, 0.2, 0.05 - Math.abs(x)], color: '#e27a3a' });
      j.tails = fanTails(k, j.body, 6, 1.15, { base: 0.1, y: 0.08, z: -0.44, len: 0.55, n: 4, up: 0.85, out: 1.5, curl: -2.0, twist: 1.1, fluff: 0.12, radius: (t) => 0.035 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.1)), color: grad([[0, '#b8532a'], [0.6, '#d36a36'], [1, '#ef8a46']]) });
      k.anchor('mouth', j.head, [0, -0.07, 0.36]);
      return j;
    }
  },

  ponyta: {
    size: 3.2,
    look: { rough: 0.7, sheen: 0.5 },
    mo: { walk: 2.4, run: 7.5, turn: 1.9, runChance: 0.55, idleChance: 0.15, act: 'look' },
    anim: { gait: 'walk', run: 'canter', tailWag: 0.15, headBob: 0.08 },
    build(k) {
      const cream = '#f6e6b2';
      const j = quad(k, {
        len: 1.05, r: 0.3, leg: 0.56, legR: 0.075, squash: 1.02, hoof: '#77736f', armT: 1.45, thighT: 1.8,
        coat: belly(cream, '#fbf3da', 0.29), legCoat: cream,
        neck: 0.42, tilt: 0.5, neckR: 0.12, neckTaper: 0.72, ny: 0.5, nz: 0.42,
        head: [0.16, 0.17, 0.2], snout: [0.11, 0.1, 0.16], sy: 0.35, sz: 0.75, nose: '#c79a82',
        eye: { color: '#c7302a', iris: 0.7, splay: 0.9 }, eyeR: 0.05, ex: 0.75, ey: 0.32, ez: 0.35,
        ears: pointEar(0.045, 0.14, 0.2, cream, '#e3a88c')
      });
      horseFlames(k, j, 1.25);
      return j;
    }
  },

  eevee: {
    size: 2.3,
    look: { rough: 0.88, sheen: 1, sheenColor: '#ffe8cc' },
    mo: { walk: 2.2, run: 5.8, turn: 2.8, runChance: 0.4, idleChance: 0.35, idle: [1.2, 2.6], act: 'ears' },
    anim: { gait: 'bound', run: 'bound', bounce: 0.09, tailWag: 0.4, tailFreq: 3, earFlick: 2 },
    build(k) {
      const base = '#a86b36';
      const cream = '#f3e1bb';
      const j = quad(k, {
        len: 0.62, r: 0.2, leg: 0.24, legR: 0.052, squash: 1,
        coat: belly(base, '#b98448', 0.2), legCoat: base, paw: '#9a6230',
        neck: 0.12, tilt: 0.3, neckR: 0.12, neckCoat: cream, neckFluff: 0.3,
        head: [0.24, 0.21, 0.22], snout: [0.08, 0.06, 0.1], sy: 0.42, sz: 0.85, snoutCoat: '#b57a42',
        eye: { color: '#2a1406', iris: 0.8 }, eyeR: 0.06, ex: 0.48, ey: 0.1, ez: 0.7,
        ears: pointEar(0.12, 0.36, 0.45, base, '#7a4a24', '#5a3216', { tipAt: 0.7 }), earY: 0.55
      });
      ruff(k, j.body, [0, 0.06, 0.24], 0.17, cream, 10, 2);
      j.tails = [chain(k, j.body, [0, 0.08, -0.28], [0, 1, -0.55], 4, 0.42, (t) => 0.05 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05)), grad([[0, base], [0.55, '#b57a42'], [0.68, cream], [1, '#f8ead0']]), [-1.3, 0, 0], { fluff: 0.16, sides: 12 })];
      k.anchor('mouth', j.head, [0, -0.08, 0.32]);
      return j;
    }
  },

  doduo: {
    size: 2.7,
    look: { rough: 0.85, sheen: 0.9 },
    mo: { walk: 2.6, run: 8, turn: 3, runChance: 0.6, idleChance: 0.12, zig: 0.65, zigF: 3.2, act: 'look' },
    anim: { gait: 'run', stride: 0.9, bob: 0.06, sway: 0.06 },
    build(k) {
      const j = biped(k, {
        leg: 0.6, r: 0.3, h: 0.58, drop: 0.5, chestY: 0.32, coat: belly('#9a6236', '#b98a5a', 0.3, 0), bodyFluff: 0.1,
        prof: [0, 0.7, 0.93, 1, 1, 0.95, 0.8, 0.5, 0], deep: 1,
        legs: { r: 0.028, color: '#d8b07a', foot: '#d8b07a', footL: 2.8, footW: 1.8, footH: 0.022, thick: 1.6, x: 0.35, split: 0.48 }
      });
      const a = runnerHead(k, j.chest, [0.08, 0.02, 0.12], [0.25, 1, 0.35], { neck: 0.42, neckR: 0.035, neckColor: '#3a2a24', r: 0.11, color: '#b27a46', beak: '#e8c99c' });
      const b = runnerHead(k, j.chest, [-0.08, 0.02, 0.12], [-0.25, 1, 0.35], { neck: 0.42, neckR: 0.035, neckColor: '#3a2a24', r: 0.11, color: '#b27a46', beak: '#e8c99c' });
      for (let i = 0; i < 4; i++) k.add(j.body, spike(0.04, 0.22, [0, 0.4, -1], [(i - 1.5) * 0.06, 0.08, -0.26], 6), { color: '#3a2618' });
      j.head = a.head;
      j.heads = [a.head, b.head];
      j.necks = [a.neck, b.neck];
      k.anchor('mouth', a.head, [0, -0.01, 0.26]);
      k.anchor('head', a.head, [0, 0.1, 0]);
      return j;
    }
  },

  electabuzz: {
    size: 3.0,
    look: { rough: 0.62, sheen: 0.35 },
    mo: { walk: 1.9, run: 4.6, turn: 2, runChance: 0.3, idleChance: 0.25, act: 'flex' },
    anim: { gait: 'stomp', stride: 0.75, bob: 0.06, sway: 0.08, armSwing: 1.0, crouch: 0.25 },
    build(k) {
      const Y = C('#f2cd2c');
      const B = C('#1b1714');
      const stripe = (x, y, z, c) => (Math.sin(y * 24 + Math.sin(x * 6) * 0.8) > 0.55 && y > 0.02 ? c.copy(B) : c.copy(Y));
      const j = biped(k, {
        leg: 0.48, r: 0.3, h: 0.8, lean: 0.28, coat: stripe, wide: 1.05,
        headAt: [0, 0.32, 0.14], headR: 0.19,
        arm: { len: 0.52, r: 0.075, out: 0.38, thick: 1.4, fwd: 0.06, color: bandTailColor('#f2cd2c', '#1b1714'), hand: claws3('#f2cd2c', '#1b1714') },
        legs: { r: 0.085, thick: 1.5, color: '#f2cd2c', foot: '#f2cd2c', footL: 1.8, x: 0.55, split: 0.48, claws: '#1b1714' },
        tails: [{ dir: [0, -0.5, -1], n: 4, len: 0.5, radius: (t) => 0.06 - 0.03 * t, color: bandTail('#f2cd2c', '#1b1714', 6) }]
      });
      k.add(j.head, ball(0.19, 0.17, 0.18, 16, 12), { color: '#f2cd2c' });
      k.add(j.head, ball(0.15, 0.04, 0.08), { at: [0, 0.07, 0.12], color: '#1b1714' });
      face(k, j.head, 0.19, { x: 0.42, y: 0.05, z: 0.78, r: 0.17, eye: { squint: 0.45, color: '#2a2018', iris: 0.85 }, mouth: 0.35, my: 0.35, mz: 0.88 });
      for (const s of [1, -1]) {
        k.add(j.head, seg(0.014, 0.012, [s * 0.06, 0.14, -0.02], [s * 0.11, 0.38, -0.08], 6), { color: '#1b1714' });
        k.add(j.head, ball(0.03), { at: [s * 0.11, 0.39, -0.08], color: '#1b1714' });
      }
      k.anchor('mouth', j.head, [0, -0.05, 0.2]);
      return j;
    }
  },

  mankey: {
    size: 2.3,
    look: { rough: 0.9, sheen: 1, sheenColor: '#fff8ec' },
    mo: { walk: 2.4, run: 5.5, turn: 3.2, runChance: 0.45, idleChance: 0.25, zig: 0.5, zigF: 2.4, act: 'jump' },
    anim: { gait: 'hop', stride: 0.8, bob: 0.14, sway: 0.22, armSwing: 1.4 },
    build(k) {
      const fur = '#efe3cf';
      const brown = '#a7774f';
      const j = biped(k, {
        leg: 0.22, r: 0.36, h: 0.66, drop: 0.42, chestY: 0.4, prof: [0, 0.72, 0.95, 1, 1, 0.95, 0.78, 0.45, 0], deep: 1, coat: fur, bodyFluff: 0.14,
        headAt: [0, 0, 0],
        arm: { len: 0.38, r: 0.045, out: 0.75, thick: 1.2, color: fur, color2: brown, hand: (k2, el, fa) => k2.add(el, ball(0.07, 0.06, 0.07), { at: fa, color: brown }), y: -0.02 },
        legs: { r: 0.055, color: fur, color2: brown, foot: brown, footL: 1.8, x: 0.55 },
        tails: [{ dir: [0, 0.3, -1], n: 3, len: 0.32, radius: () => 0.022, color: fur, y: -0.1, z: 0.9 }]
      });
      k.add(j.head, ball(0.11, 0.08, 0.06), { at: [0, -0.02, 0.33], color: '#e5bea2' });
      for (const s of [1, -1]) {
        k.add(j.head, ball(0.018, 0.024, 0.01), { at: [s * 0.035, -0.01, 0.39], color: '#3a2420', mottle: 0 });
        eye(k, j.head, s * 0.1, 0.11, 0.29, 0.045, { squint: 0.6, color: '#2a1608', iris: 0.75, splay: 0.3 });
        k.add(j.head, ball(0.06, 0.015, 0.02), { at: [s * 0.1, 0.165, 0.32], rot: [0, 0, s * 0.35], color: '#c8b496' });
        k.add(j.head, ball(0.06, 0.08, 0.025), { at: [s * 0.33, 0.12, 0], rot: [0, s * 0.4, 0], color: fur });
        k.add(j.head, ball(0.038, 0.052, 0.015), { at: [s * 0.345, 0.12, 0.015], rot: [0, s * 0.4, 0], color: '#e8a8a0' });
      }
      k.add(j.head, ball(0.06, 0.012, 0.02), { at: [0, -0.1, 0.34], color: '#4a2020', mottle: 0 });
      k.anchor('mouth', j.head, [0, -0.05, 0.4]);
      k.anchor('head', j.head, [0, 0.35, 0]);
      return j;
    }
  },

  sandshrew: {
    size: 2.1,
    look: { rough: 0.7, sheen: 0.3 },
    mo: { walk: 1.6, run: 6.2, turn: 2.6, runChance: 0.4, idleChance: 0.3, act: 'sniff', roll: true },
    anim: { gait: 'walk', run: 'roll', bounce: 0.01, low: 0.04 },
    build(k) {
      const Y = C('#e3bb55');
      const D = C('#9b6c2a');
      const W = C('#f3ead4');
      const coat = (x, y, z, c) => {
        if (y < -0.07) return c.copy(W);
        c.copy(Y);
        const k1 = Math.abs(Math.sin(z * 20 + Math.abs(x) * 9));
        if (k1 > 0.88 && y > -0.02) c.copy(D);
        return c;
      };
      const j = quad(k, {
        len: 0.6, r: 0.27, leg: 0.15, legR: 0.06, squash: 1, coat, legCoat: '#e3bb55', paw: '#e3bb55', claws: '#f6f2ea',
        neck: 0.07, tilt: 0.7, neckR: 0.13, neckCoat: '#e3bb55',
        head: [0.17, 0.15, 0.17], snout: [0.075, 0.06, 0.1], sy: 0.3, sz: 0.8, snoutCoat: '#ecd9a6', headCoat: '#e3bb55',
        eye: { dark: true, color: '#141414' }, eyeR: 0.04, ex: 0.55, ey: 0.12,
        ears: pointEar(0.05, 0.1, 0.35, '#e3bb55', '#c89a3a')
      });
      j.tails = [chain(k, j.body, [0, 0.0, -0.28], [0, -0.2, -1], 2, 0.18, (t) => 0.06 - 0.03 * t, '#e3bb55')];
      return j;
    }
  },

  pikachu: {
    size: 2.2,
    look: { rough: 0.84, sheen: 0.9, sheenColor: '#fff6c0' },
    mo: { walk: 2.6, run: 6.5, turn: 3, runChance: 0.5, idleChance: 0.4, idle: [2, 3.2], act: 'wave', burst: [2.5, 4.5] },
    anim: { gait: 'bound', run: 'bound', bounce: 0.06, tailWag: 0.12, earFlick: 1.5 },
    build(k) {
      const Y = C('#f7d22e');
      const BR = C('#7a4a1c');
      const coat = (x, y, z, c) => (y > 0.13 && (Math.abs(z + 0.12) < 0.035 || Math.abs(z + 0.02) < 0.03) ? c.copy(BR) : c.copy(Y));
      const j = quad(k, {
        len: 0.5, r: 0.23, leg: 0.17, legR: 0.05, squash: 1.08, coat, legCoat: '#f7d22e', paw: '#f7d22e',
        prof: [0.05, 0.6, 0.88, 1, 1, 0.97, 0.92, 0.82, 0.55, 0.05],
        neck: 0.07, tilt: 0.25, neckR: 0.12, neckCoat: '#f7d22e',
        head: [0.25, 0.22, 0.22], snout: [0.07, 0.05, 0.06], sy: 0.35, sz: 0.88, snoutCoat: '#f7d22e', headCoat: '#f7d22e', nose: '#2a1a10',
        eye: { dark: true, color: '#141210' }, eyeR: 0.06, ex: 0.47, ey: 0.15, ez: 0.72,
        ears: pointEar(0.07, 0.42, 0.32, '#f7d22e', null, '#16120e', { tipAt: 0.68, flat: 0.5 }), earY: 0.7
      });
      for (const s of [1, -1]) k.add(j.head, ball(0.06, 0.06, 0.024), { at: [s * 0.18, -0.06, 0.15], rot: [0, s * 0.95, 0], color: '#e8362a', gloss: 0.2 });
      k.add(j.head, ball(0.03, 0.012, 0.02), { at: [0, -0.1, 0.22], color: '#4a1a18', mottle: 0 });
      const tb = k.bone(j.body, 0, 0.08, -0.24);
      const g = bolt(0.55, 0.07);
      k.add(tb, g, { color: (x, y, z, c) => (Math.hypot(y, z) < 0.09 ? c.copy(BR) : c.copy(Y)) });
      j.tails = [[tb]];
      k.anchor('cheek', j.head, [0.18, -0.06, 0.16]);
      k.anchor('mouth', j.head, [0, -0.06, 0.3]);
      return j;
    }
  },

  rhyhorn: {
    size: 3.0,
    look: { rough: 0.95, sheen: 0 },
    mo: { walk: 1.8, run: 7, turn: 1.1, runChance: 0.6, idleChance: 0.15, straight: true, act: 'paw' },
    anim: { gait: 'amble', run: 'trot', amp: 0.42, bounce: 0.03, heavy: 1 },
    build(k) {
      const G = C('#9ea3a8');
      const D = C('#7a8188');
      const L = C('#bcc0c2');
      const coat = (x, y, z, c) => {
        if (y < -0.18) return c.copy(L);
        c.copy(G);
        if (noise2(x * 7 + 3, z * 7 + y * 4) > 0.3) c.copy(D);
        return c;
      };
      const j = quad(k, {
        len: 1.12, r: 0.44, leg: 0.3, legR: 0.12, squash: 0.88, wide: 1.05, coat, legCoat: '#8e959b', paw: '#8e959b', claws: '#e6e1d6',
        neck: 0.12, tilt: 1.25, neckR: 0.26, ny: 0.1, nz: 0.46, neckCoat: '#8e959b',
        head: [0.26, 0.24, 0.34], snout: [0.2, 0.17, 0.2], sy: 0.25, sz: 0.75, nose: false, headCoat: '#9ea3a8',
        eye: { color: '#c8302a', squint: 0.6, splay: 1.2 }, eyeR: 0.034, ex: 0.78, ey: 0.15, ez: 0.32,
        ears: pointEar(0.05, 0.12, 0.6, '#9ea3a8', '#6a7076')
      });
      k.add(j.head, horn(0.08, 0.3, -0.25, 12), { at: [0, 0.08, 0.42], rot: [0.55, 0, 0], color: vgrad('#cfc9be', '#f2eee6', 0, 0.3), gloss: 0.4 });
      for (let i = 0; i < 4; i++) k.add(j.head, spike(0.05, 0.16 - i * 0.02, [0, 0.8, -1], [0, 0.18 - i * 0.03, -0.1 - i * 0.09], 6), { color: '#7a8188' });
      for (const z of [-0.35, -0.05, 0.25]) k.add(j.body, ball(0.2, 0.08, 0.2, 12, 8), { at: [0, 0.37, z], rot: [0.1, 0, 0], color: '#7a8188' });
      for (const z of [-0.2, 0.1]) for (const s of [1, -1]) k.add(j.body, ball(0.12, 0.06, 0.16, 10, 8), { at: [s * 0.3, 0.26, z], rot: [0, 0, s * 0.6], color: '#858c93' });
      j.tails = [chain(k, j.body, [0, 0.05, -0.52], [0, -0.3, -1], 2, 0.3, (t) => 0.1 - 0.05 * t, '#8e959b')];
      k.anchor('mouth', j.head, [0, 0.08, 0.7]);
      return j;
    }
  },

  slowpoke: {
    size: 2.9,
    look: { rough: 0.55, sheen: 0.2, coat: 0.15 },
    mo: { walk: 1.0, run: 1.6, turn: 1, runChance: 0, idleChance: 0.6, idle: [3, 5.5], act: 'stare', burst: [1.6, 2.6] },
    anim: { gait: 'amble', amp: 0.3, sway: 0.08, slow: 0.6, tailWag: 0.06, tailFreq: 0.6 },
    build(k) {
      const pink = '#f3a1b3';
      const j = quad(k, {
        len: 0.95, r: 0.32, leg: 0.2, legR: 0.08, squash: 0.94, coat: belly(pink, '#f6bac8', 0.32), legCoat: pink, paw: pink, claws: '#f6f0f0',
        neck: 0.12, tilt: 0.95, neckR: 0.2, ny: 0.3, nz: 0.46,
        head: [0.32, 0.27, 0.3], snout: [0.24, 0.13, 0.17], sy: 0.38, sz: 0.62, snoutCoat: '#f4ddb5', nose: false,
        eye: { color: '#16100e', iris: 0.34, pupil: 0.9, sclera: '#fffaf0', squint: 0.85, splay: 0.6 }, eyeR: 0.07, ex: 0.6, ey: 0.32, ez: 0.55,
        ears: (k2, b, s) => k2.add(b, ball(0.06, 0.07, 0.03), { rot: [0, s * 0.4, 0], color: '#e4889c' }), earY: 0.75
      });
      for (const s of [1, -1]) k.add(j.head, ball(0.012, 0.012, 0.008), { at: [s * 0.04, -0.04, 0.47], color: '#5a3a30', mottle: 0 });
      j.tails = [chain(k, j.body, [0, -0.02, -0.4], [0, -0.3, -1], 6, 1.0, (t) => 0.085 - 0.02 * t, grad([[0, pink], [0.86, pink], [0.9, '#f8eef0'], [1, '#f8eef0']]), [0.5, 0, 0.3], { sides: 12 })];
      k.anchor('mouth', j.head, [0, -0.08, 0.6]);
      return j;
    }
  },

  pidgeotto: {
    size: 2.8,
    look: { rough: 0.85, sheen: 0.8, double: true },
    mo: { fly: 6.2, alt: [5, 8.5], pattern: 'swoop', dive: 0.35 },
    anim: { flap: 8, amp: 0.85, glide: 0.5 },
    build(k) {
      const j = bird(k, {
        r: 0.22, len: 0.7, coat: belly('#a5672e', '#efdbb4', 0.22), headCoat: vgrad('#efd9b0', '#b07436', -0.05, 0.12), neckCoat: '#b07436',
        headR: 0.15, beak: '#4a4242', beakLen: 0.12, beakR: 0.04, hook: 0.45, eye: { color: '#1a1210', iris: 0.72 },
        wing: { span: 1.0, chord: 0.36, kind: 'feather', color: wingGrad([[0, '#a5672e'], [0.55, '#8a5426'], [1, '#3a2a1e']]) },
        tailCoat: '#7a4a22', tailLen: 0.42, tailW: 0.34, feet: '#d9a088'
      });
      for (let i = 0; i < 5; i++) k.add(j.head, spike(0.028, 0.34 - i * 0.03, [0, 0.35 - i * 0.05, -1], [(i % 2 ? 1 : -1) * 0.02 * i, 0.12, -0.04], 6), { color: axisGrad([[0, '#d8402a'], [0.55, '#d8402a'], [0.6, '#f2c230'], [1, '#f2c230']], 'z', -0.04, -0.4) });
      return j;
    }
  },

  spearow: {
    size: 2.1,
    look: { rough: 0.85, sheen: 0.8, double: true },
    mo: { fly: 7.4, alt: [4.5, 8], pattern: 'dart' },
    anim: { flap: 13, amp: 0.95, glide: 0.1 },
    build(k) {
      const j = bird(k, {
        r: 0.16, len: 0.48, coat: belly('#9a5634', '#d9b48a', 0.16), headCoat: '#9a5634',
        headR: 0.13, beak: '#e8a4a0', beakLen: 0.09, beakR: 0.035, hook: 0.3, eye: { color: '#2a1a10', squint: 0.65 },
        wing: { span: 0.62, chord: 0.26, kind: 'feather', color: wingGrad([[0, '#9a5634'], [0.4, '#c4442a'], [1, '#6a2a18']]) },
        tailCoat: '#7a3a20', tailLen: 0.28, tailW: 0.22, feet: '#e0a090'
      });
      for (let i = 0; i < 3; i++) k.add(j.head, spike(0.022, 0.12, [(i - 1) * 0.4, 1, -0.4], [(i - 1) * 0.03, 0.11, 0], 5), { color: '#8a4a2a' });
      return j;
    }
  },

  farfetchd: {
    size: 2.4,
    look: { rough: 0.85, sheen: 0.8 },
    mo: { walk: 1.8, run: 3.6, turn: 2, runChance: 0.15, idleChance: 0.3, act: 'swing' },
    anim: { gait: 'waddle', stride: 0.65, bob: 0.04, sway: 0.2, armSwing: 0.2 },
    build(k) {
      const br = '#a87a4c';
      const j = biped(k, {
        leg: 0.2, r: 0.25, h: 0.55, drop: 0.38, chestY: 0.55, lean: 0.22, coat: chestPlate(br, '#efe0c2', 0.25, { z0: 0.1, z1: 0.6 }), deep: 1.1, bodyFluff: 0.05,
        headAt: [0, 0.16, 0.08], headR: 0.15,
        arm: { len: 0.24, r: 0.06, out: 0.5, thick: 1.1, color: br, y: -0.08, hand: (k2, el, fa, s) => {
          k2.add(el, ball(0.06, 0.05, 0.08), { at: fa, color: br });
          if (s > 0) {
            const top = [fa[0] + 0.05, fa[1] + 0.55, fa[2] + 0.12];
            k2.add(el, seg(0.026, 0.024, [fa[0] - 0.02, fa[1] - 0.12, fa[2] - 0.03], top, 8), { color: vgrad('#f4f2e6', '#5aa040', fa[1] - 0.1, fa[1] + 0.05) });
            for (const a of [-0.4, 0, 0.4]) k2.add(el, leaf(0.22, 0.045).rotateZ(a), { at: top, color: '#4a8a32' });
            k2.anchor('leek', el, top);
          }
        } },
        legs: { r: 0.03, color: '#f0b040', foot: '#f0b040', footL: 2.6, footW: 2.2, footH: 0.02, x: 0.45 }
      });
      k.add(j.head, ball(0.15, 0.14, 0.15), { color: br });
      for (const s of [1, -1]) {
        k.add(j.head, ball(0.05, 0.022, 0.06), { at: [s * 0.09, 0.07, 0.08], rot: [0, s * 0.6, s * 0.3], color: '#1e1814' });
        eye(k, j.head, s * 0.075, 0.03, 0.115, 0.032, { color: '#1a1210', iris: 0.75 });
      }
      k.add(j.head, ball(0.065, 0.022, 0.11), { at: [0, -0.02, 0.17], color: '#f0c040', gloss: 0.3 });
      k.add(j.head, ball(0.055, 0.018, 0.09), { at: [0, -0.045, 0.16], color: '#d8a030' });
      for (let i = 0; i < 4; i++) k.add(j.body, spike(0.03, 0.16, [(i - 1.5) * 0.3, 0.6, -1], [(i - 1.5) * 0.04, 0.05, -0.22], 6), { color: '#6a4a2a' });
      k.anchor('mouth', j.head, [0, -0.02, 0.28]);
      return j;
    }
  },

  butterfree: {
    size: 2.5,
    look: { rough: 0.7, sheen: 0.6, double: true },
    mo: { fly: 3.6, alt: [2.4, 5], pattern: 'flutter' },
    anim: { flap: 9, amp: 1.0, glide: 0 },
    build(k) {
      const body = k.bone(k.root, 0, 0, 0);
      const blue = '#3f4aa6';
      k.add(body, ball(0.12, 0.12, 0.14), { color: blue });
      k.add(body, ball(0.085, 0.09, 0.17), { at: [0, -0.04, -0.2], color: '#4a56b0' });
      const head = k.bone(body, 0, 0.07, 0.15);
      k.add(head, ball(0.14, 0.13, 0.13), { color: blue });
      for (const s of [1, -1]) {
        const g = ball(0.095, 0.11, 0.09, 16, 12);
        k.add(head, g, { at: [s * 0.085, 0.02, 0.07], color: (x, y, z, c) => c.set(Math.sin(x * 120) * Math.sin(y * 120) > 0.7 ? '#a01a18' : '#d8302a'), gloss: 0.7 });
        k.add(head, seg(0.009, 0.008, [s * 0.035, 0.11, 0.05], [s * 0.08, 0.3, 0.13], 6), { color: '#16141c' });
        k.add(head, ring(0.035, 0.01, Math.PI * 1.5, 6, 12).rotateY(Math.PI / 2), { at: [s * 0.08, 0.33, 0.13], color: '#16141c' });
        for (const z of [0.06, -0.04]) k.add(body, seg(0.012, 0.01, [s * 0.06, -0.08, z], [s * 0.08, -0.22, z + 0.05], 6), { color: '#5ec6be' });
      }
      k.add(head, ball(0.04, 0.015, 0.02), { at: [0, -0.07, 0.12], color: '#e85a7a', mottle: 0 });
      const wings = [];
      const paint = (big) => (x, y, z, c) => {
        const t = Math.abs(x) / (big ? 0.62 : 0.46);
        const a = Math.atan2(z, Math.abs(x));
        c.set('#f6f6fa');
        if (t > 0.86) c.set('#1a1a1e');
        else if (Math.abs(Math.sin(a * 6)) < 0.07 && t > 0.15) c.set('#26242c');
        if (big && t > 0.68 && t < 0.8 && z < 0) c.set('#e8302a');
        return c;
      };
      for (const [s, big] of [[1, 1], [-1, 1], [1, 0], [-1, 0]]) {
        const sh = k.bone(body, s * 0.08, 0.06, big ? 0.03 : -0.1);
        const w = big ? 0.62 : 0.46;
        const g = slab(wingOutlineButterfly(w, big ? 0.52 : 0.38), 0.01, 0.004).rotateX(Math.PI / 2).rotateY(big ? -0.25 : 0.45);
        k.add(sh, g, { color: paint(big), mirror: s < 0, mottle: 0.4 });
        wings.push({ sh, el: sh, side: s, big: !!big });
      }
      k.anchor('mouth', head, [0, -0.04, 0.16]);
      k.anchor('head', head, [0, 0.12, 0]);
      k.anchor('center', body, [0, 0, 0]);
      k.anchor('back', body, [0, 0.12, 0]);
      return { plan: 'bird', body, head, wings, tails: [], R: 0.12, L: 0.4, hip: 0.1 };
    }
  },

  ninetales: {
    size: 3.4,
    look: { rough: 0.82, sheen: 1, sheenColor: '#fff6d8' },
    mo: { walk: 2.1, run: 6, turn: 1.7, runChance: 0.3, idleChance: 0.25, act: 'look' },
    anim: { gait: 'walk', run: 'gallop', amp: 0.34, tailWag: 0.18, tailFreq: 1.1, float: 0.03, headBob: 0.02 },
    build(k) {
      const cream = '#f2dda2';
      const j = quad(k, {
        len: 1.08, r: 0.26, leg: 0.5, legR: 0.06, squash: 0.95, coat: belly(cream, '#faeecc', 0.26), legCoat: cream, paw: '#ecd492',
        neck: 0.3, tilt: 0.45, neckR: 0.14, neckFluff: 0.22, neckCoat: '#f6e6b4',
        head: [0.2, 0.18, 0.22], snout: [0.09, 0.07, 0.15], sy: 0.35, sz: 0.85, headCoat: cream,
        eye: { color: '#c42a28', squint: 0.72, iris: 0.75 }, eyeR: 0.05, ex: 0.52, ey: 0.16,
        ears: pointEar(0.07, 0.22, 0.25, cream, '#e3bd72')
      });
      for (let i = 0; i < 5; i++) k.add(j.head, drop(0.05, 0.32 - i * 0.03, 0.9, 8), { at: [(i - 2) * 0.035, 0.14, 0.02 - Math.abs(i - 2) * 0.02], rot: [-0.5, 0, (i - 2) * 0.15], color: '#f8ecc4' });
      j.tails = fanTails(k, j.body, 9, 1.35, { base: 0.12, y: 0.07, z: -0.5, len: 0.95, n: 5, up: 1.0, out: 1.7, curl: -1.0, twist: 0.9, fluff: 0.1, radius: (t) => 0.035 + 0.055 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.08)), color: grad([[0, cream], [0.78, '#f6e6b4'], [0.88, '#f0a24a'], [1, '#ee8a3a']]) });
      k.anchor('mouth', j.head, [0, -0.06, 0.38]);
      return j;
    }
  },

  rapidash: {
    size: 4.0,
    look: { rough: 0.68, sheen: 0.5 },
    mo: { walk: 2.6, run: 10.5, turn: 1.6, runChance: 0.75, idleChance: 0.1, act: 'look' },
    anim: { gait: 'walk', run: 'gallop', tailWag: 0.12, headBob: 0.1 },
    build(k) {
      const cream = '#f7e7b6';
      const j = quad(k, {
        len: 1.25, r: 0.32, leg: 0.68, legR: 0.078, armT: 1.45, thighT: 1.8, squash: 1.02, hoof: '#77736f', coat: belly(cream, '#fcf4dc', 0.31), legCoat: cream,
        neck: 0.5, tilt: 0.45, neckR: 0.12, neckTaper: 0.72, ny: 0.5, nz: 0.42,
        head: [0.13, 0.15, 0.2], snout: [0.1, 0.1, 0.18], sy: 0.35, sz: 0.75, nose: '#c79a82',
        eye: { color: '#c7302a', iris: 0.7, splay: 0.9, squint: 0.85 }, eyeR: 0.042, ex: 0.75, ey: 0.32, ez: 0.35,
        ears: pointEar(0.045, 0.15, 0.2, cream, '#e3a88c')
      });
      k.add(j.head, horn(0.04, 0.38, 0.15, 10, 9), { at: [0, 0.12, 0.08], rot: [0.75, 0, 0], color: vgrad('#c8c2b8', '#f2efe8', 0, 0.3), gloss: 0.5 });
      horseFlames(k, j, 1.5);
      return j;
    }
  },

  growlithe: {
    size: 2.7,
    look: { rough: 0.85, sheen: 0.9 },
    mo: { walk: 2.4, run: 7, turn: 2.6, runChance: 0.45, idleChance: 0.3, act: 'wag' },
    anim: { gait: 'trot', run: 'gallop', tailWag: 0.5, tailFreq: 6, bounce: 0.02, earFlick: 1 },
    build(k) {
      const O = '#ee8a3a';
      const cream = '#f2e2b8';
      const j = quad(k, {
        len: 0.85, r: 0.27, leg: 0.33, legR: 0.065, squash: 1, coat: catStripes(O, cream, '#1c1410', 0.27, 30), legCoat: O, paw: O,
        neck: 0.14, tilt: 0.5, neckR: 0.15, neckCoat: cream, neckFluff: 0.32,
        head: [0.21, 0.2, 0.21], snout: [0.1, 0.08, 0.12], sy: 0.35, sz: 0.85, snoutCoat: cream, headCoat: O, nose: '#1a1210',
        eye: { color: '#2a1608', iris: 0.78 }, eyeR: 0.05, ex: 0.5, ey: 0.16,
        ears: pointEar(0.075, 0.16, 0.45, O, '#7a3a1a')
      });
      const tuft = ball(0.12, 0.08, 0.12, 14, 10);
      fluff(tuft, 0.35, 9, 3);
      k.add(j.head, tuft, { at: [0, 0.18, -0.02], color: cream });
      j.tails = [chain(k, j.body, [0, 0.12, -0.38], [0, 1, -0.6], 3, 0.3, (t) => 0.05 + 0.07 * Math.sin(Math.PI * Math.min(1, t + 0.1)), cream, [-0.6, 0, 0], { fluff: 0.22 })];
      k.anchor('mouth', j.head, [0, -0.07, 0.36]);
      return j;
    }
  },

  scyther: {
    size: 3.2,
    look: { rough: 0.45, sheen: 0.15, coat: 0.35, double: true },
    mo: { walk: 3.2, run: 9.5, turn: 3.2, runChance: 0.6, idleChance: 0.2, zig: 0.8, zigF: 4, act: 'slash' },
    anim: { gait: 'dash', stride: 1.1, bob: 0.03, crouch: 0.35, armSwing: 0.3, hover: 0.08 },
    build(k) {
      const G = '#79ba48';
      const j = biped(k, {
        leg: 0.6, r: 0.17, h: 0.7, lean: 0.38, wide: 0.9, deep: 0.8, coat: chestPlate(G, '#efe6c4', 0.17, { z0: 0.06, z1: 0.14, w0: 0.35, w1: 0.7 }), drop: 0.25,
        headAt: [0, 0.3, 0.14], headR: 0.15,
        arm: { len: 0.42, r: 0.04, out: 0.32, fwd: 0.12, color: G, hand: (k2, el, fa, s) => {
          k2.add(el, ball(0.06, 0.05, 0.06), { at: fa, color: G });
          const g = slab([[0, 0.03], [0.12, 0.06], [0.28, 0.04], [0.42, -0.04], [0.5, -0.16], [0.46, -0.18], [0.36, -0.08], [0.22, -0.03], [0.08, -0.03], [0, -0.02]], 0.022, 0.008).rotateY(-Math.PI / 2);
          k2.add(el, g, { at: [fa[0], fa[1] + 0.02, fa[2]], color: vgrad('#d4cdb8', '#f8f4ea', -0.15, 0.05), gloss: 0.6 });
          k2.anchor(s > 0 ? 'bladeL' : 'bladeR', el, [fa[0], fa[1], fa[2] + 0.4]);
        } },
        legs: { r: 0.045, thick: 1.5, color: G, foot: G, footL: 2.2, x: 0.6, claws: '#efeadc' }
      });
      k.add(j.head, ball(0.14, 0.13, 0.17), { color: G });
      k.add(j.head, ball(0.1, 0.06, 0.1), { at: [0, -0.08, 0.06], color: '#efe6c4' });
      k.add(j.head, horn(0.03, 0.24, -0.4, 8), { at: [0, 0.1, -0.02], rot: [-1.2, 0, 0], color: G });
      for (const s of [1, -1]) eye(k, j.head, s * 0.085, 0.02, 0.11, 0.045, { dark: true, color: '#101210', splay: 0.8 });
      const ab = chain(k, j.body, [0, -0.08, -0.12], [0, -0.35, -1], 3, 0.38, (t) => 0.11 - 0.05 * t, bandTail(G, '#d9e8b0', 6));
      for (const s of [1, -1]) for (const [y, w] of [[0.2, 0.42], [0.1, 0.34]]) {
        const g = slab(wingOutlineButterfly(w, 0.11), 0.006, 0.002).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - 0.35);
        k.add(j.chest, g, { at: [0.05, y - 0.15, -0.12], color: '#dff3e0', mirror: s < 0, mottle: 0.3 });
      }
      j.tails = [ab];
      k.anchor('mouth', j.head, [0, -0.05, 0.2]);
      return j;
    }
  },

  kangaskhan: {
    size: 3.6,
    look: { rough: 0.75, sheen: 0.4 },
    mo: { walk: 1.6, run: 4.2, turn: 1.5, runChance: 0.25, idleChance: 0.2, act: 'punch' },
    anim: { gait: 'stomp', stride: 0.6, bob: 0.07, sway: 0.1, armSwing: 0.4, heavy: 1 },
    build(k) {
      const B = '#8b6a48';
      const j = biped(k, {
        leg: 0.5, r: 0.42, h: 1.05, lean: 0.12, wide: 1.05, coat: chestPlate(B, '#d8c39a', 0.42, { z0: 0.25, z1: 0.6 }),
        headAt: [0, 0.42, 0.2], headR: 0.22,
        arm: { len: 0.55, r: 0.085, out: 0.3, thick: 1.3, color: B, hand: claws3(B, '#e8e0d0') },
        legs: { r: 0.12, thick: 1.6, footL: 2, color: B, claws: '#e8e0d0' },
        tails: [{ dir: [0, -0.45, -1], n: 4, len: 0.8, radius: (t) => 0.15 - 0.1 * t, color: B }]
      });
      k.add(j.head, ball(0.22, 0.2, 0.24), { color: B });
      k.add(j.head, ball(0.13, 0.1, 0.13), { at: [0, -0.06, 0.18], color: '#7a5a3c' });
      k.add(j.head, ball(0.04, 0.02, 0.02), { at: [0, -0.03, 0.31], color: '#2a1a12', mottle: 0 });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.1, 0.05, 0.16, 0.035, { squint: 0.55, color: '#2a1a10' });
        k.add(j.head, ball(0.06, 0.14, 0.035), { at: [s * 0.15, 0.2, -0.04], rot: [0, 0, -s * 0.3], color: '#7a5a3c' });
      }
      k.add(j.body, ball(0.27, 0.2, 0.13), { at: [0, 0.12, 0.33], color: '#cdb486' });
      const baby = k.bone(j.body, 0, 0.32, 0.36);
      k.add(baby, ball(0.1, 0.09, 0.1), { color: B });
      k.add(baby, ball(0.06, 0.05, 0.06), { at: [0, -0.02, 0.08], color: '#7a5a3c' });
      for (const s of [1, -1]) eye(k, baby, s * 0.045, 0.02, 0.07, 0.02, { dark: true, color: '#141010' });
      j.extra = { baby };
      k.anchor('hand', j.chest, [0.2, -0.3, 0.6]);
      return j;
    }
  },

  slowbro: {
    size: 3.3,
    look: { rough: 0.55, sheen: 0.2, coat: 0.15 },
    mo: { walk: 1.2, run: 2.2, turn: 1.1, runChance: 0, idleChance: 0.45, idle: [2.5, 4.5], act: 'stare' },
    anim: { gait: 'waddle', stride: 0.5, bob: 0.03, sway: 0.16, armSwing: 0.3, slow: 0.7 },
    build(k) {
      const pink = '#f3a1b3';
      const j = biped(k, {
        leg: 0.28, r: 0.36, h: 0.85, lean: -0.06, coat: chestPlate(pink, '#f7c6d1', 0.36), wide: 1,
        headAt: [0, 0.34, 0.08], headR: 0.26,
        arm: { len: 0.36, r: 0.07, out: 0.55, color: pink, hand: claws3(pink, '#f8f0f0') },
        legs: { r: 0.1, color: pink, footL: 1.8, claws: '#f8f0f0' }
      });
      k.add(j.head, ball(0.27, 0.23, 0.25), { color: pink });
      k.add(j.head, ball(0.2, 0.11, 0.15), { at: [0, -0.08, 0.17], color: '#f4ddb5' });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.13, 0.08, 0.19, 0.06, { color: '#16100e', iris: 0.34, pupil: 0.9, sclera: '#fffaf0', squint: 0.85, splay: 0.5 });
        k.add(j.head, ball(0.05, 0.06, 0.025), { at: [s * 0.18, 0.18, -0.02], color: '#e4889c' });
      }
      const tail = chain(k, j.body, [0, 0, -0.3], [0, -0.55, -1], 4, 0.62, (t) => 0.1 - 0.015 * t, pink, [0.6, 0, 0]);
      const sb = k.bone(tail[tail.length - 1], ...tail.tip.toArray());
      const shell = horn(0.2, 0.46, 0, 14, 11);
      aim(shell, [0, -0.2, -1], UP);
      k.add(sb, shell, { at: [0, 0.02, 0.02], color: vgrad('#7f7a92', '#a9a4bc', -0.1, 0.15), gloss: 0.3 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        k.add(sb, spike(0.03, 0.14, [Math.cos(a), Math.sin(a), -0.6], [Math.cos(a) * 0.15, Math.sin(a) * 0.15 + 0.02, -0.15], 6), { color: '#d0ccdc' });
      }
      j.tails = [tail];
      k.anchor('mouth', j.head, [0, -0.08, 0.34]);
      return j;
    }
  },

  rhydon: {
    size: 3.7,
    look: { rough: 0.92, sheen: 0 },
    mo: { walk: 1.6, run: 4.6, turn: 1.3, runChance: 0.3, idleChance: 0.2, act: 'roar' },
    anim: { gait: 'stomp', stride: 0.55, bob: 0.09, sway: 0.08, armSwing: 0.5, heavy: 1.4 },
    build(k) {
      const G = C('#a9a49b');
      const P1 = C('#dcd6ca');
      const P2 = C('#c4beb2');
      const coat = (x, y, z, c) => {
        c.copy(G);
        if (z > 0.15 && Math.abs(x) < 0.26 && y > -0.1 && y < 0.62) c.copy(Math.sin(y * 32) > 0.1 ? P1 : P2);
        else if (noise2(x * 6, y * 6 + z * 3) > 0.35) c.multiplyScalar(0.85);
        return c;
      };
      const j = biped(k, {
        leg: 0.5, r: 0.36, h: 0.95, lean: 0.22, coat, wide: 1.05,
        headAt: [0, 0.38, 0.16], headR: 0.2,
        arm: { len: 0.5, r: 0.09, out: 0.35, color: '#a9a49b', hand: claws3('#a9a49b', '#efeae0') },
        legs: { r: 0.12, thick: 1.6, footL: 1.8, color: '#a9a49b', claws: '#efeae0' },
        tails: [{ dir: [0, -0.3, -1], n: 5, len: 0.8, radius: (t) => 0.13 - 0.08 * t, color: bandTail('#a9a49b', '#8f8a82', 8) }]
      });
      k.add(j.head, ball(0.2, 0.18, 0.26), { color: '#a9a49b' });
      k.add(j.head, ball(0.15, 0.13, 0.16), { at: [0, -0.04, 0.2], color: '#b4afa6' });
      k.add(j.head, horn(0.065, 0.32, -0.1, 12, 10), { at: [0, 0.06, 0.32], rot: [1.05, 0, 0], color: vgrad('#d8d2c6', '#f4f0e8', 0, 0.3), gloss: 0.5 });
      k.add(j.head, cone(0.035, 0.1, 8), { at: [0, 0.14, 0.18], rot: [0.6, 0, 0], color: '#e6e0d4' });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.12, 0.07, 0.17, 0.03, { color: '#c8302a', squint: 0.6, splay: 0.9 });
        k.add(j.head, cone(0.04, 0.12, 6).scale(1, 1, 0.4), { at: [s * 0.15, 0.14, -0.08], rot: [-0.3, 0, -s * 0.5], color: '#a9a49b' });
      }
      for (let i = 0; i < 5; i++) k.add(j.body, spike(0.05, 0.18 - i * 0.015, [0, 0.4, -1], [0, 0.55 - i * 0.14, -0.3 + i * 0.02], 6), { color: '#8f8a82' });
      k.anchor('mouth', j.head, [0, 0.2, 0.62]);
      k.anchor('horn', j.head, [0, 0.2, 0.62]);
      return j;
    }
  },

  exeggutor: {
    size: 4.2,
    look: { rough: 0.7, sheen: 0.3, double: true },
    mo: { walk: 1.4, run: 3, turn: 1.2, runChance: 0.15, idleChance: 0.3, act: 'sway' },
    anim: { gait: 'stomp', stride: 0.5, bob: 0.05, sway: 0.14, heavy: 0.8, crownSway: 1 },
    build(k) {
      const T = C('#e6d49c');
      const D = C('#c4b07a');
      const coat = (x, y, z, c) => {
        const a = Math.atan2(x, z);
        return c.copy(Math.sin(y * 30 + a * 3) * Math.sin(y * 30 - a * 3) > 0.55 ? D : T);
      };
      const j = biped(k, {
        leg: 0.42, r: 0.26, h: 0.95, coat, prof: [0, 0.8, 0.95, 1, 0.98, 0.93, 0.85, 0.7, 0], drop: 0.18, chestY: 0.75,
        legs: { r: 0.13, thick: 1.3, color: '#e6d49c', foot: '#a87a44', footL: 1.6, footH: 0.08, claws: '#f4ecd8', x: 0.5 }
      });
      const heads = [];
      const faces = [[0, 0.24, 0.05, 0], [0.2, 0.12, 0.07, 1], [-0.2, 0.12, 0.07, 2]];
      for (const [x, y, z, mood] of faces) {
        const h = k.bone(j.chest, x, y, z);
        k.add(h, ball(0.16, 0.15, 0.16), { color: '#f2d25a' });
        for (const s of [1, -1]) {
          if (mood === 1) eye(k, h, s * 0.06, 0.03, 0.13, 0.03, { closed: true, roll: s * 0.4 });
          else eye(k, h, s * 0.06, 0.03, 0.13, 0.035, { color: '#2a1a10', squint: mood === 2 ? 0.55 : 1 });
        }
        k.add(h, ball(mood === 0 ? 0.05 : 0.04, mood === 0 ? 0.03 : 0.012, 0.02), { at: [0, -0.06, 0.145], color: '#6a2020', mottle: 0 });
        heads.push(h);
      }
      const crown = k.bone(j.chest, 0, 0.38, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const g = leaf(0.62, 0.11).rotateX(-Math.PI / 2 + 0.15);
        warp(g, (v) => (v.y -= 0.55 * v.z * v.z));
        g.rotateY(a);
        k.add(crown, g, { color: axisGrad([[0, '#3f8a2a'], [1, '#86c84e']], 'y', -0.25, 0.05) });
      }
      j.head = heads[0];
      j.heads = heads;
      j.extra = { crown };
      k.anchor('head', crown, [0, 0.1, 0]);
      k.anchor('mouth', heads[0], [0, -0.06, 0.2]);
      return j;
    }
  },

  nidoking: {
    size: 3.6,
    look: { rough: 0.7, sheen: 0.2, coat: 0.1 },
    mo: { walk: 1.8, run: 5, turn: 1.4, runChance: 0.35, idleChance: 0.2, act: 'roar' },
    anim: { gait: 'stomp', stride: 0.6, bob: 0.08, sway: 0.16, armSwing: 0.6, heavy: 1.3, wide: 0.12 },
    build(k) {
      const P = '#8b5ea6';
      const j = biped(k, {
        leg: 0.55, r: 0.36, h: 0.95, lean: 0.22, wide: 1.05, coat: chestPlate(P, '#efdcbc', 0.36, { z0: 0.2, z1: 0.55 }),
        headAt: [0, 0.38, 0.16], headR: 0.18,
        arm: { len: 0.5, r: 0.09, out: 0.38, color: P, hand: claws3(P, '#f2ece2') },
        legs: { r: 0.12, thick: 1.65, footL: 1.9, color: P, claws: '#f2ece2', x: 0.6 },
        tails: [{ dir: [0, -0.35, -1], n: 5, len: 0.9, radius: (t) => 0.14 - 0.1 * t, color: P }]
      });
      k.add(j.head, ball(0.18, 0.17, 0.22), { color: P });
      k.add(j.head, ball(0.12, 0.1, 0.14), { at: [0, -0.04, 0.17], color: '#9a6eb4' });
      k.add(j.head, horn(0.05, 0.32, -0.15, 10), { at: [0, 0.12, 0.08], rot: [0.25, 0, 0], color: vgrad('#e8e0d6', '#fbf8f2', 0, 0.3), gloss: 0.4 });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.1, 0.05, 0.15, 0.035, { color: '#c8302a', squint: 0.65 });
        k.add(j.head, cone(0.07, 0.2, 8).scale(1, 1, 0.4), { at: [s * 0.12, 0.12, -0.06], rot: [-0.3, 0, -s * 0.55], color: P });
        k.add(j.head, cone(0.04, 0.14, 6).scale(1, 1, 0.25), { at: [s * 0.125, 0.13, -0.045], rot: [-0.3, 0, -s * 0.55], color: '#2a1a2e' });
      }
      for (let i = 0; i < 7; i++) {
        const y = 0.7 - i * 0.13;
        k.add(j.body, spike(0.045, 0.16, [0, 0.35, -1], [0, y, -0.28 - (i > 3 ? 0.02 : 0)], 6), { color: '#a77ec2' });
        if (i % 2 === 0) for (const s of [1, -1]) k.add(j.body, spike(0.035, 0.12, [s * 0.5, 0.3, -1], [s * 0.12, y, -0.26], 6), { color: '#a77ec2' });
      }
      k.anchor('mouth', j.head, [0, -0.04, 0.32]);
      return j;
    }
  },

  tauros: {
    size: 3.6,
    look: { rough: 0.85, sheen: 0.6 },
    mo: { walk: 2.2, run: 9.5, turn: 1.1, runChance: 0.7, idleChance: 0.12, straight: true, act: 'paw' },
    anim: { gait: 'walk', run: 'gallop', tailWag: 0.6, tailFreq: 7, headBob: 0.06 },
    build(k) {
      const B = '#b0784a';
      const D = '#4a2e1c';
      const j = quad(k, {
        len: 1.2, r: 0.38, leg: 0.5, legR: 0.075, squash: 0.95, hoof: '#3a3230', coat: belly(B, '#c99868', 0.38), legCoat: B,
        neck: 0.16, tilt: 1.1, neckR: 0.22, neckCoat: D, neckFluff: 0.25, ny: 0.35,
        head: [0.18, 0.18, 0.24], snout: [0.14, 0.11, 0.12], sy: 0.4, sz: 0.8, headCoat: D, snoutCoat: '#b8865a', nose: '#2a1a12',
        eye: { color: '#c8302a', squint: 0.6, splay: 1 }, eyeR: 0.035, ex: 0.7, ey: 0.18, ez: 0.45,
        ears: pointEar(0.05, 0.1, 1.1, D, '#6a4a34')
      });
      const mane = ball(0.32, 0.3, 0.32, 16, 12);
      fluff(mane, 0.28, 8, 4);
      k.add(j.body, mane, { at: [0, 0.16, 0.4], color: D });
      for (const x of [-0.07, 0, 0.07]) k.add(j.head, ball(0.045), { at: [x, 0.15, 0.12], color: '#9aa0a8' });
      for (const s of [1, -1]) {
        const g = horn(0.05, 0.42, 0.45, 10);
        g.rotateZ(-s * 1.25).rotateY(s * 0.2);
        k.add(j.head, g, { at: [s * 0.13, 0.12, 0], color: vgrad('#bdb5a8', '#ece6dc', 0, 0.3), gloss: 0.3 });
      }
      j.tails = [-1, 0, 1].map((s) => {
        const t = chain(k, j.body, [s * 0.04, 0.28, -0.6], [s * 0.4, 0.15, -1], 4, 0.72, () => 0.022, '#2a1a12', [0.3, s * 0.4, 0], { sides: 6 });
        const g = ball(0.05, 0.08, 0.05, 10, 8);
        fluff(g, 0.3, 10, s);
        k.add(t[t.length - 1], g, { at: t.tip.toArray(), color: '#2a1a12' });
        return t;
      });
      k.anchor('mouth', j.head, [0, 0, 0.42]);
      return j;
    }
  },

  nidoqueen: {
    size: 3.5,
    look: { rough: 0.7, sheen: 0.2, coat: 0.1 },
    mo: { walk: 1.6, run: 4, turn: 1.3, runChance: 0.25, idleChance: 0.25, act: 'flex' },
    anim: { gait: 'stomp', stride: 0.55, bob: 0.06, sway: 0.1, armSwing: 0.5, heavy: 1.1 },
    build(k) {
      const Bl = '#5c8ab8';
      const j = biped(k, {
        leg: 0.5, r: 0.4, h: 0.95, lean: 0.12, wide: 1.05, coat: chestPlate(Bl, '#efe2c0', 0.4, { z0: 0.18, z1: 0.55 }),
        headAt: [0, 0.38, 0.16], headR: 0.18,
        arm: { len: 0.5, r: 0.1, out: 0.36, color: Bl, hand: claws3(Bl, '#f2ece2') },
        legs: { r: 0.13, thick: 1.6, footL: 1.8, color: Bl, claws: '#f2ece2' },
        tails: [{ dir: [0, -0.35, -1], n: 5, len: 0.85, radius: (t) => 0.15 - 0.1 * t, color: Bl }]
      });
      k.add(j.head, ball(0.18, 0.17, 0.2), { color: Bl });
      k.add(j.head, ball(0.13, 0.09, 0.13), { at: [0, -0.07, 0.15], color: '#efe2c0' });
      k.add(j.head, cone(0.03, 0.1, 8), { at: [0, 0.15, 0.1], rot: [0.4, 0, 0], color: '#efe8e0' });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.1, 0.06, 0.14, 0.034, { color: '#c8302a', squint: 0.65 });
        k.add(j.head, cone(0.07, 0.18, 8).scale(1, 1, 0.4), { at: [s * 0.12, 0.12, -0.06], rot: [-0.3, 0, -s * 0.6], color: Bl });
      }
      for (let i = 0; i < 6; i++) for (const s of [1, 0, -1]) k.add(j.body, spike(0.04, 0.12, [s * 0.4, 0.3, -1], [s * 0.13, 0.7 - i * 0.14, -0.33], 6), { color: '#4a76a2' });
      k.anchor('mouth', j.head, [0, -0.07, 0.3]);
      return j;
    }
  },

  flareon: {
    size: 2.6,
    look: { rough: 0.88, sheen: 1, sheenColor: '#ffe8b0' },
    mo: { walk: 2.2, run: 6.2, turn: 2.6, runChance: 0.4, idleChance: 0.25, act: 'ears' },
    anim: { gait: 'prance', run: 'bound', bounce: 0.07, tailWag: 0.25, tailFreq: 2, earFlick: 1.2 },
    build(k) {
      const R = '#e8612a';
      const cream = '#f6d58c';
      const j = quad(k, {
        len: 0.72, r: 0.23, leg: 0.3, legR: 0.058, squash: 1, coat: R, legCoat: R, paw: '#d8562a',
        neck: 0.12, tilt: 0.4, neckR: 0.15, neckCoat: cream, neckFluff: 0.4,
        head: [0.21, 0.19, 0.2], snout: [0.08, 0.065, 0.1], sy: 0.4, sz: 0.85,
        eye: { dark: true, color: '#141210' }, eyeR: 0.055, ex: 0.5, ey: 0.12,
        ears: pointEar(0.085, 0.32, 0.42, R, '#a83a1a')
      });
      ruff(k, j.body, [0, 0.08, 0.3], 0.22, cream, 12, 5);
      const tuft = ball(0.1, 0.1, 0.12, 14, 10);
      fluff(tuft, 0.35, 9, 7);
      k.add(j.head, tuft, { at: [0, 0.17, 0.04], color: cream });
      j.tails = [chain(k, j.body, [0, 0.12, -0.3], [0, 1, -0.7], 4, 0.5, (t) => 0.06 + 0.12 * Math.sin(Math.PI * Math.min(1, t + 0.08)), cream, [-1, 0, 0], { fluff: 0.26 })];
      k.anchor('mouth', j.head, [0, -0.08, 0.32]);
      return j;
    }
  },

  snorlax: {
    size: 4.0,
    look: { rough: 0.8, sheen: 0.4 },
    mo: { walk: 0.9, run: 1.4, turn: 0.9, runChance: 0, idleChance: 0.8, idle: [5, 8], act: 'sleep', burst: [1.6, 2.6] },
    anim: { gait: 'waddle', stride: 0.4, bob: 0.05, sway: 0.18, armSwing: 0.3, jiggle: 1, slow: 0.6 },
    build(k) {
      const T = C('#36677a');
      const Cr = C('#f2e2c2');
      const coat = (x, y, z, c) => c.copy(T).lerp(Cr, smooth(z, 0.12, 0.42) * (1 - smooth(Math.abs(x), 0.42, 0.62)) * (1 - smooth(y, 0.72, 0.9)));
      const j = biped(k, {
        leg: 0.26, r: 0.62, h: 1.2, prof: [0, 0.82, 0.97, 1, 0.98, 0.9, 0.74, 0.5, 0], coat, wide: 1.1, deep: 0.92, drop: 0.2, chestY: 0.6,
        headAt: [0, 0.32, 0.04], headR: 0.4,
        arm: { len: 0.48, r: 0.13, out: 0.7, thick: 1.15, color: '#36677a', y: -0.1, hand: claws3('#36677a', '#f6f0e4') },
        legs: { r: 0.18, thick: 1.2, color: '#36677a', foot: '#f2e2c2', footL: 1.5, footH: 0.12, x: 0.55 }
      });
      const head = ball(0.42, 0.36, 0.38, 20, 14);
      k.add(j.head, head, { color: (x, y, z, c) => c.copy(T).lerp(Cr, smooth(z, 0.12, 0.26) * (1 - smooth(y, 0.08, 0.18))) });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.13, 0.03, 0.34, 0.06, { closed: true, roll: s * 0.1, lid: '#2a2420' });
        k.add(j.head, cone(0.09, 0.16, 8).scale(1, 1, 0.5), { at: [s * 0.24, 0.28, -0.02], rot: [0, 0, -s * 0.3], color: '#36677a' });
      }
      k.add(j.head, ball(0.16, 0.025, 0.04), { at: [0, -0.12, 0.35], color: '#3a2420', mottle: 0 });
      for (const s of [1, -1]) k.add(j.head, cone(0.02, 0.05, 6), { at: [s * 0.1, -0.12, 0.37], color: '#f8f4ec' });
      k.anchor('mouth', j.head, [0, -0.1, 0.4]);
      k.anchor('head', j.head, [0, 0.42, 0]);
      return j;
    }
  },

  persian: {
    size: 3.1,
    look: { rough: 0.8, sheen: 1, sheenColor: '#fffaf0' },
    mo: { walk: 2.1, run: 7, turn: 2.2, runChance: 0.35, idleChance: 0.2, act: 'look' },
    anim: { gait: 'walk', run: 'gallop', amp: 0.32, low: 0.06, tailWag: 0.22, tailFreq: 1.4 },
    build(k) {
      const cr = '#f3e4c0';
      const j = quad(k, {
        len: 1.0, r: 0.22, leg: 0.48, legR: 0.055, squash: 0.95, coat: belly(cr, '#faf2dc', 0.22), legCoat: cr, paw: cr,
        neck: 0.22, tilt: 0.55, neckR: 0.12,
        head: [0.2, 0.17, 0.19], snout: [0.08, 0.06, 0.08], sy: 0.4, sz: 0.9, nose: '#d48a8a',
        eye: { color: '#c8302a', slit: true, squint: 0.55, iris: 0.85 }, eyeR: 0.045, ex: 0.52, ey: 0.16,
        ears: pointEar(0.1, 0.2, 0.55, cr, '#1a1414')
      });
      k.add(j.head, ball(0.055, 0.055, 0.03), { at: [0, 0.1, 0.17], rot: [-0.5, 0, 0], color: '#e8303a', gloss: 1, glow: 0.35 });
      for (const s of [1, -1]) for (const dy of [0.0, -0.03]) k.add(j.head, seg(0.006, 0.004, [s * 0.06, -0.06 + dy, 0.26], [s * 0.34, -0.04 + dy * 2, 0.3], 5), { color: '#fbf6ea' });
      j.tails = [chain(k, j.body, [0, 0.06, -0.44], [0, 0.4, -1], 6, 0.85, () => 0.028, cr, [-1.8, 0, 0], { sides: 8 })];
      k.anchor('gem', j.head, [0, 0.1, 0.2]);
      k.anchor('mouth', j.head, [0, 0.1, 0.22]);
      return j;
    }
  },

  jolteon: {
    size: 2.6,
    look: { rough: 0.8, sheen: 1, sheenColor: '#fffbe0' },
    mo: { walk: 2.6, run: 11, turn: 2.6, runChance: 0.7, idleChance: 0.4, idle: [1.5, 2.6], act: 'charge', burst: [1.2, 2] },
    anim: { gait: 'trot', run: 'gallop', bounce: 0.03, earFlick: 1 },
    build(k) {
      const Y = '#f4d23a';
      const j = quad(k, {
        len: 0.72, r: 0.22, leg: 0.32, legR: 0.055, squash: 1, coat: Y, legCoat: Y, paw: Y, bodyFluff: 0.08,
        neck: 0.1, tilt: 0.4, neckR: 0.13,
        head: [0.2, 0.18, 0.2], snout: [0.08, 0.065, 0.1], sy: 0.4, sz: 0.85,
        eye: { dark: true, color: '#141210' }, eyeR: 0.052, ex: 0.5, ey: 0.12,
        ears: pointEar(0.075, 0.3, 0.4, Y, '#c8a020')
      });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        k.add(j.neck, spike(0.035, 0.14, [Math.cos(a), Math.sin(a) * 0.7 - 0.2, 0.5], [Math.cos(a) * 0.1, Math.sin(a) * 0.08, 0.02], 6), { color: '#f8f6ee' });
      }
      for (let i = 0; i < 18; i++) {
        const z = -0.32 + (i / 17) * 0.5;
        const s = i % 2 ? 1 : -1;
        k.add(j.body, spike(0.035, 0.12 + (i < 6 ? 0.05 : 0), [s * 0.5, 1, -0.6], [s * 0.08, 0.17, z], 6), { color: Y });
      }
      for (let i = 0; i < 5; i++) k.add(j.body, spike(0.04, 0.16, [(i - 2) * 0.4, 0.4, -1], [(i - 2) * 0.04, 0.05, -0.36], 6), { color: Y });
      k.anchor('mouth', j.head, [0, -0.08, 0.32]);
      return j;
    }
  },

  raichu: {
    size: 2.8,
    look: { rough: 0.84, sheen: 0.9 },
    mo: { walk: 2.6, run: 6, turn: 2.6, runChance: 0.5, idleChance: 0.2, act: 'look' },
    anim: { gait: 'hop', stride: 0.9, bob: 0.2, sway: 0.05, armSwing: 0.3 },
    build(k) {
      const O = '#e9932c';
      const j = biped(k, {
        leg: 0.28, r: 0.28, h: 0.6, lean: 0.05, coat: chestPlate(O, '#f4dfb2', 0.28, { z0: 0.1, z1: 0.24 }),
        headAt: [0, 0.28, 0.06], headR: 0.23,
        arm: { len: 0.22, r: 0.045, out: 0.45, color: O },
        legs: { r: 0.07, color: O, foot: '#6a4426', footL: 2.2 }
      });
      k.add(j.head, ball(0.24, 0.21, 0.21), { color: O });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.11, 0.04, 0.15, 0.05, { dark: true, color: '#141210' });
        k.add(j.head, ball(0.055, 0.055, 0.022), { at: [s * 0.17, -0.06, 0.13], rot: [0, s * 0.95, 0], color: '#f6d040' });
        const eb = k.bone(j.head, s * 0.12, 0.16, -0.02);
        const g = cone(0.085, 0.34, 10).scale(1, 1, 0.45);
        warp(g, (v) => (v.z -= 0.6 * Math.pow(Math.max(0, v.y - 0.18), 2) * 6));
        k.add(eb, g, { rot: [-0.2, 0, -s * 0.38], color: vgrad('#6a4426', '#6a4426', 0, 1) });
        k.add(eb, cone(0.05, 0.22, 8).scale(1, 1, 0.25).translate(0, 0.02, 0.025), { rot: [-0.2, 0, -s * 0.38], color: '#f6d040' });
        (j.ears ||= []).push({ b: eb, side: s });
      }
      k.add(j.head, ball(0.02, 0.012, 0.012), { at: [0, -0.02, 0.21], color: '#2a1a10', mottle: 0 });
      const tail = chain(k, j.body, [0, 0, -0.24], [0, -0.15, -1], 6, 0.9, () => 0.018, '#2a1a10', [1.3, 0, 0], { sides: 6 });
      const tb = k.bone(tail[tail.length - 1], ...tail.tip.toArray());
      k.add(tb, bolt(0.32, 0.05), { color: '#f6d040' });
      j.tails = [tail];
      k.anchor('mouth', j.head, [0, -0.06, 0.26]);
      return j;
    }
  },

  golbat: {
    size: 3.3,
    look: { rough: 0.6, sheen: 0.3, double: true },
    mo: { fly: 6, alt: [4, 7.5], pattern: 'figure8' },
    anim: { flap: 7, amp: 0.9, glide: 0.25 },
    build(k) {
      const body = k.bone(k.root, 0, 0, 0);
      const B = '#4c84cf';
      k.add(body, ball(0.42, 0.4, 0.36, 20, 14), { color: B });
      k.add(body, ball(0.3, 0.27, 0.1, 18, 12), { at: [0, -0.07, 0.29], color: (x, y, z, c) => c.set(Math.hypot(x / 0.3, (y + 0.07) / 0.27) < 0.75 ? '#5a0e1e' : '#8a2034') });
      for (const s of [1, -1]) {
        k.add(body, cone(0.035, 0.1, 6), { at: [s * 0.12, 0.12, 0.33], rot: [Math.PI, 0, 0], color: '#f8f6f2', gloss: 0.6 });
        k.add(body, cone(0.03, 0.08, 6), { at: [s * 0.1, -0.27, 0.32], color: '#f8f6f2', gloss: 0.6 });
        eye(k, body, s * 0.13, 0.25, 0.27, 0.035, { squint: 0.35, color: '#1a1a2a', splay: 0.5 });
        k.add(body, cone(0.1, 0.24, 8).scale(1, 1, 0.45), { at: [s * 0.2, 0.3, 0], rot: [0, 0, -s * 0.35], color: B });
        k.add(body, cone(0.06, 0.16, 6).scale(1, 1, 0.2), { at: [s * 0.2, 0.32, 0.03], rot: [0, 0, -s * 0.35], color: '#a565c4' });
        k.add(body, seg(0.025, 0.02, [s * 0.12, -0.32, -0.05], [s * 0.15, -0.72, -0.12], 6), { color: B });
        k.add(body, ball(0.04, 0.02, 0.06), { at: [s * 0.15, -0.74, -0.1], color: B });
      }
      const wings = wingPair(k, body, { x: 0.33, y: 0.08, z: -0.02, span: 1.3, chord: 0.62, kind: 'bat', split: 0.4, thick: 0.02, color: (t, z, c) => c.set(t < 0.06 || z > 0.22 ? '#4c84cf' : '#a565c4') });
      k.anchor('mouth', body, [0, -0.07, 0.42]);
      k.anchor('head', body, [0, 0.4, 0]);
      k.anchor('center', body, [0, 0, 0]);
      k.anchor('back', body, [0, 0.4, 0]);
      return { plan: 'bird', body, head: body, wings, tails: [], R: 0.4, L: 0.7, hip: 0.4, noHead: true };
    }
  },

  lapras: {
    size: 3.9,
    look: { rough: 0.45, sheen: 0.2, coat: 0.35 },
    mo: { walk: 1.6, run: 3.4, turn: 1.1, runChance: 0.25, idleChance: 0.2, act: 'look', glide: true },
    anim: { gait: 'swim', paddle: 1 },
    build(k) {
      const Bl = '#5fa8e8';
      const body = k.bone(k.root, 0, 0.42, 0);
      k.add(body, spine(1.05, 0.42, [0.05, 0.6, 0.88, 1, 1, 0.97, 0.9, 0.75, 0.45, 0.05]), { scale: [1.05, 0.62, 1], color: belly(Bl, '#f2e6c8', 0.26) });
      k.add(body, ball(0.48, 0.3, 0.55, 20, 12), { at: [0, 0.12, -0.06], color: '#8a96a8' });
      for (const [x, z] of [[0, 0.1], [0, -0.25], [0.24, -0.05], [-0.24, -0.05], [0.18, -0.35], [-0.18, -0.35], [0.2, 0.25], [-0.2, 0.25]]) k.add(body, cone(0.06, 0.12, 8), { at: [x, 0.36 - Math.abs(x) * 0.5 - Math.abs(z) * 0.2, z], color: '#aab4c2' });
      const neck = chain(k, body, [0, 0.08, 0.42], [0, 1, 0.4], 4, 0.78, (t) => 0.12 - 0.035 * t, Bl, [0.55, 0, 0]);
      const head = k.bone(neck[neck.length - 1], ...neck.tip.toArray());
      k.add(head, ball(0.15, 0.13, 0.19), { color: Bl });
      k.add(head, ball(0.11, 0.06, 0.13), { at: [0, -0.06, 0.06], color: '#f2e6c8' });
      k.add(head, horn(0.025, 0.12, -0.4, 8), { at: [0, 0.11, 0.04], rot: [-0.3, 0, 0], color: '#e8eef6' });
      for (const s of [1, -1]) {
        eye(k, head, s * 0.08, 0.03, 0.12, 0.032, { color: '#1a1a2a', iris: 0.8 });
        k.add(head, ring(0.04, 0.014, Math.PI * 1.3, 6, 12).rotateY(Math.PI / 2), { at: [s * 0.1, 0.12, -0.04], color: Bl });
      }
      const fins = [];
      for (const [s, front] of [[1, 1], [-1, 1], [1, 0], [-1, 0]]) {
        const b = k.bone(body, s * 0.36, -0.08, front ? 0.25 : -0.32);
        const w = front ? 0.4 : 0.28;
        const g = slab([[0, 0.07], [w * 0.6, 0.1], [w, 0.02], [w * 0.9, -0.06], [w * 0.4, -0.08], [0, -0.06]], 0.035, 0.015).rotateX(Math.PI / 2).rotateY(front ? 0.3 : 0.6);
        k.add(b, g, { color: Bl, mirror: s < 0 });
        fins.push({ b, side: s, front: !!front });
      }
      const tail = chain(k, body, [0, -0.02, -0.5], [0, -0.1, -1], 2, 0.2, (t) => 0.06 - 0.03 * t, Bl);
      k.anchor('mouth', head, [0, -0.03, 0.22]);
      k.anchor('head', head, [0, 0.14, 0]);
      k.anchor('center', body, [0, 0, 0]);
      k.anchor('back', body, [0, 0.35, 0]);
      return { plan: 'swim', body, neck: neck[0], necks: [neck], head, fins, tails: [tail], legs: [], R: 0.42, L: 1.05, hip: 0.42 };
    }
  },

  dodrio: {
    size: 3.4,
    look: { rough: 0.85, sheen: 0.9 },
    mo: { walk: 2.8, run: 9, turn: 2.6, runChance: 0.6, idleChance: 0.12, zig: 0.35, zigF: 2.4, act: 'look' },
    anim: { gait: 'run', stride: 1.2, bob: 0.1, sway: 0.05, hopRun: 1 },
    build(k) {
      const j = biped(k, {
        leg: 0.72, r: 0.34, h: 0.62, drop: 0.5, chestY: 0.3, coat: belly('#a87648', '#c99a6a', 0.34, 0), bodyFluff: 0.1,
        prof: [0, 0.7, 0.93, 1, 1, 0.95, 0.8, 0.5, 0], deep: 1.15,
        legs: { r: 0.034, color: '#d8b07a', foot: '#d8b07a', footL: 2.8, footW: 1.8, footH: 0.026, thick: 1.6, x: 0.35, split: 0.5 }
      });
      const heads = [];
      const necks = [];
      for (const [x, dx] of [[0, 0], [0.1, 0.4], [-0.1, -0.4]]) {
        const h = runnerHead(k, j.chest, [x, 0.02, 0.14], [dx, 1, 0.3], { neck: 0.5 + (x ? 0 : 0.08), neckR: 0.04, neckColor: '#2a2222', r: 0.12, color: '#c89a64', beak: '#e8c99c', crest: '#1e1a1a', squint: 0.7 });
        heads.push(h.head);
        necks.push(h.neck);
      }
      for (let i = 0; i < 5; i++) k.add(j.body, spike(0.045, 0.3, [(i - 2) * 0.25, 0.5, -1], [(i - 2) * 0.06, 0.1, -0.3], 6), { color: '#1e1a1a' });
      j.head = heads[0];
      j.heads = heads;
      j.necks = necks;
      k.anchor('mouth', heads[0], [0, -0.01, 0.28]);
      k.anchor('head', heads[0], [0, 0.12, 0]);
      return j;
    }
  },

  fearow: {
    size: 3.6,
    look: { rough: 0.85, sheen: 0.8, double: true },
    mo: { fly: 7, alt: [6.5, 10], pattern: 'soar', dive: 0.45 },
    anim: { flap: 5, amp: 0.65, glide: 0.75 },
    build(k) {
      const j = bird(k, {
        r: 0.24, len: 0.85, coat: belly('#b07a44', '#e9cfa0', 0.24), neckCoat: '#ebb8a2', headCoat: '#b07a44', neck: 0.22, tilt: 0.55,
        headR: 0.15, beak: '#f0a68a', beakLen: 0.42, beakR: 0.045, hook: 0.08, eye: { color: '#1a1210', squint: 0.6 },
        wing: { span: 1.6, chord: 0.45, kind: 'fingers', color: wingGrad([[0, '#b07a44'], [0.55, '#8a5a30'], [1, '#4a2e1a']]) },
        tailCoat: '#8a5a30', tailLen: 0.5, tailW: 0.4, feet: '#e0a890'
      });
      const r = ball(0.2, 0.17, 0.16, 14, 10);
      fluff(r, 0.3, 10, 2);
      k.add(j.neck, r, { at: [0, 0.02, 0.02], color: '#ebb8a2' });
      for (let i = 0; i < 4; i++) k.add(j.head, spike(0.025, 0.24 - i * 0.03, [0, 0.6 - i * 0.12, -1], [0, 0.12, -0.04 - i * 0.03], 6), { color: '#d83a2a' });
      return j;
    }
  },

  aerodactyl: {
    size: 3.8,
    look: { rough: 0.7, sheen: 0.2, double: true },
    mo: { fly: 7.6, alt: [5.5, 9], pattern: 'swoop', dive: 0.5 },
    anim: { flap: 4.5, amp: 0.75, glide: 0.55 },
    build(k) {
      const L = '#aa9ebf';
      const j = bird(k, {
        r: 0.2, len: 0.8, coat: belly(L, '#c4bad4', 0.2), headCoat: L, neck: 0.18, tilt: 0.9, headR: 0.15,
        beak: L, beakLen: 0.32, beakR: 0.08, hook: 0.05, eye: { color: '#7a1a8a', squint: 0.55, iris: 0.8 }, tailFan: false,
        wing: { span: 1.7, chord: 0.6, kind: 'bat', split: 0.38, thick: 0.02, color: (t, z, c) => c.set(z > 0.22 || t < 0.05 ? '#9a8eb0' : '#8a6aa8') },
        feet: L, claw: '#e8e4f0'
      });
      for (let i = 0; i < 6; i++) for (const s of [1, -1]) k.add(j.head, cone(0.012, 0.05, 5), { at: [s * 0.045, -0.1, 0.14 + i * 0.045], rot: [Math.PI, 0, 0], color: '#f8f6f2' });
      k.add(j.head, horn(0.035, 0.22, -0.3, 8), { at: [0, 0.08, -0.08], rot: [-1.3, 0, 0], color: L });
      const tail = chain(k, j.body, [0, 0.02, -0.38], [0, -0.05, -1], 5, 0.8, (t) => 0.05 - 0.035 * t, L, [0.4, 0, 0]);
      const tb = k.bone(tail[tail.length - 1], ...tail.tip.toArray());
      k.add(tb, slab([[0, 0.1], [0.06, 0], [0, -0.1], [-0.02, 0]], 0.012, 0.005).rotateX(Math.PI / 2).rotateY(Math.PI / 2), { color: L });
      j.tails = [tail];
      return j;
    }
  },

  arcanine: {
    size: 4.6,
    look: { rough: 0.85, sheen: 1, sheenColor: '#fff2d8' },
    mo: { walk: 2.6, run: 11, turn: 1.8, runChance: 0.6, idleChance: 0.18, act: 'roar' },
    anim: { gait: 'walk', run: 'bound', amp: 0.38, tailWag: 0.25, tailFreq: 2, headBob: 0.05 },
    build(k) {
      const O = '#ee8a3a';
      const cream = '#f4e4be';
      const j = quad(k, {
        len: 1.5, r: 0.42, leg: 0.72, legR: 0.1, squash: 1, coat: catStripes(O, cream, '#1c1410', 0.42, 20), legCoat: O, paw: cream,
        neck: 0.3, tilt: 0.55, neckR: 0.24, neckCoat: cream, neckFluff: 0.35, ny: 0.45,
        head: [0.28, 0.26, 0.3], snout: [0.14, 0.11, 0.18], sy: 0.35, sz: 0.85, snoutCoat: cream, headCoat: O, nose: '#1a1210',
        eye: { color: '#2a1608', iris: 0.78, squint: 0.85 }, eyeR: 0.055, ex: 0.55, ey: 0.16,
        ears: pointEar(0.09, 0.2, 0.5, O, '#7a3a1a')
      });
      ruff(k, j.body, [0, 0.12, 0.62], 0.42, cream, 14, 6);
      const mane = ball(0.22, 0.14, 0.26, 16, 12);
      fluff(mane, 0.35, 8, 8);
      k.add(j.head, mane, { at: [0, 0.22, -0.06], color: cream });
      for (let i = 0; i < 4; i++) k.add(j.head, drop(0.07, 0.32, 0.8, 8), { at: [(i - 1.5) * 0.06, 0.26, -0.15], rot: [-0.8, 0, (i - 1.5) * 0.2], color: cream });
      for (const leg of j.legs) {
        const g = ball(0.13, 0.16, 0.12, 12, 10);
        fluff(g, 0.35, 10, leg.side);
        k.add(leg.knee, g, { at: [0, -0.08, -0.06], color: cream });
      }
      j.tails = [chain(k, j.body, [0, 0.2, -0.65], [0, 0.8, -1], 4, 0.65, (t) => 0.08 + 0.12 * Math.sin(Math.PI * Math.min(1, t + 0.1)), cream, [-0.4, 0, 0], { fluff: 0.25 })];
      k.anchor('mouth', j.head, [0, -0.08, 0.5]);
      return j;
    }
  },

  charizard: {
    size: 4.8,
    look: { rough: 0.55, sheen: 0.25, coat: 0.2, double: true },
    mo: { walk: 1.9, run: 5, turn: 1.4, runChance: 0.3, idleChance: 0.2, act: 'roar', takeoff: true },
    anim: { gait: 'stomp', stride: 0.6, bob: 0.06, sway: 0.1, armSwing: 0.4, heavy: 1, flap: 4.5 },
    build(k) {
      const O = '#ee8a33';
      const j = biped(k, {
        leg: 0.55, r: 0.34, h: 0.95, lean: 0.16, coat: chestPlate(O, '#f6e1a4', 0.34, { z0: 0.14, z1: 0.5 }),
        headAt: [0, 0.48, 0.14], headR: 0.18,
        arm: { len: 0.42, r: 0.065, out: 0.35, color: O, hand: claws3(O, '#f6f2ea') },
        legs: { r: 0.11, thick: 1.6, footL: 1.8, color: O, claws: '#f6f2ea' }
      });
      k.add(j.chest, seg(0.13, 0.1, [0, -0.05, 0], [0, 0.42, 0.12], 12), { color: chestPlate(O, '#f6e1a4', 0.13, { z0: 0.03, z1: 0.12 }) });
      k.add(j.head, ball(0.17, 0.15, 0.22), { color: O });
      k.add(j.head, ball(0.12, 0.09, 0.14), { at: [0, -0.04, 0.17], color: '#f08f3a' });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.1, 0.05, 0.13, 0.036, { color: '#2a7fb8', squint: 0.75, iris: 0.75 });
        k.add(j.head, horn(0.03, 0.2, -0.3, 8), { at: [s * 0.07, 0.1, -0.12], rot: [-1.25, 0, s * 0.25], color: O });
        k.add(j.head, ball(0.012, 0.008, 0.006), { at: [s * 0.03, 0.0, 0.31], color: '#3a1a10', mottle: 0 });
      }
      const wings = wingPair(k, j.chest, { x: 0.16, y: 0.12, z: -0.2, span: 1.35, chord: 0.62, kind: 'bat', split: 0.4, thick: 0.02, color: (t, z, c) => c.set(z > 0.2 || t < 0.05 ? O : '#2b7d96') });
      for (const w of wings) w.sh.rotation.set(0, w.side * 0.9, w.side * 0.55);
      const tail = chain(k, j.body, [0, 0.02, -0.28], [0, -0.3, -1], 5, 0.85, (t) => 0.13 - 0.08 * t, O, [1.1, 0, 0]);
      const tb = k.bone(tail[tail.length - 1], ...tail.tip.toArray());
      fire(k, tb, [0, 0, 0], 0.09, 0.42, { dir: [0, 1, -0.2], sweep: 0.2 });
      fire(k, tb, [0.03, 0, 0.02], 0.06, 0.3, { dir: [0.3, 1, 0.1], sweep: 0.2 });
      j.tails = [tail];
      j.wings = wings;
      k.anchor('mouth', j.head, [0, -0.04, 0.34]);
      return j;
    }
  },

  mew: {
    size: 2.2,
    look: { rough: 0.6, sheen: 0.8, sheenColor: '#ffe6f2' },
    mo: { walk: 2.4, run: 4.8, turn: 2.6, runChance: 0.35, idleChance: 0.35, act: 'flip', hover: 1.6 },
    anim: { gait: 'float', bob: 0.12 },
    build(k) {
      const P = '#f6a8c8';
      const j = biped(k, {
        leg: 0.18, r: 0.16, h: 0.32, drop: 0.3, coat: P, chestY: 0.6,
        headAt: [0, 0.2, 0.02], headR: 0.2,
        arm: { len: 0.14, r: 0.03, out: 0.6, color: P },
        legs: { r: 0.045, color: P, footL: 2.2, footH: 0.03, x: 0.6 }
      });
      k.add(j.head, ball(0.2, 0.18, 0.18), { color: P });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.085, 0.02, 0.13, 0.06, { color: '#2f6fd0', iris: 0.86, squint: 1.15, splay: 0.35 });
        k.add(j.head, cone(0.06, 0.1, 8).scale(1, 1, 0.5), { at: [s * 0.1, 0.13, -0.02], rot: [-0.1, 0, -s * 0.45], color: P });
      }
      k.add(j.head, ball(0.025, 0.01, 0.01), { at: [0, -0.07, 0.17], color: '#a0405a', mottle: 0 });
      const tail = chain(k, j.body, [0, -0.02, -0.12], [0, 0.15, -1], 8, 0.85, () => 0.018, P, [-2.2, 0.4, 0.8], { sides: 6 });
      k.add(tail[tail.length - 1], ball(0.045, 0.045, 0.07), { at: tail.tip.toArray(), color: P });
      j.tails = [tail];
      k.anchor('mouth', j.head, [0, 0, 0.22]);
      k.anchor('hand', j.chest, [0, -0.05, 0.25]);
      return j;
    }
  },

  articuno: {
    size: 4.8,
    look: { rough: 0.6, sheen: 0.9, sheenColor: '#e8f8ff', double: true },
    mo: { fly: 4.6, alt: [6.5, 9.5], pattern: 'royal' },
    anim: { flap: 3.4, amp: 0.7, glide: 0.4 },
    build(k) {
      const j = bird(k, {
        r: 0.24, len: 0.8, coat: belly('#5aaee4', '#a8dcf8', 0.24), headCoat: '#5aaee4', neck: 0.24, tilt: 0.5,
        headR: 0.15, beak: '#9a9aa8', beakLen: 0.12, eye: { color: '#c8302a', squint: 0.7 }, tailFan: false,
        wing: { span: 1.7, chord: 0.5, kind: 'fingers', color: wingGrad([[0, '#5aaee4'], [0.6, '#3a86d0'], [1, '#2a5aa8']]) },
        feet: '#7a8aa0'
      });
      for (let i = 0; i < 3; i++) k.add(j.head, drop(0.03, 0.3, 0.6, 8), { at: [(i - 1) * 0.03, 0.12, -0.02], rot: [-0.9, 0, (i - 1) * 0.2], color: '#2a5aa8' });
      const tail = chain(k, j.body, [0, 0.05, -0.36], [0, 0.05, -1], 7, 1.5, (t) => 0.05 - 0.025 * t, grad([[0, '#5aaee4'], [0.7, '#7cc8f2'], [1, '#d8f4ff']]), [-0.6, 0, 0], { sides: 8, glow: (t) => (t > 0.7 ? 0.25 : 0) });
      j.tails = [tail];
      return j;
    }
  },

  blastoise: {
    size: 3.9,
    look: { rough: 0.5, sheen: 0.15, coat: 0.3 },
    mo: { walk: 1.5, run: 3.6, turn: 1.1, runChance: 0.2, idleChance: 0.25, act: 'aim' },
    anim: { gait: 'stomp', stride: 0.5, bob: 0.05, sway: 0.08, armSwing: 0.35, heavy: 1.5 },
    build(k) {
      const Bl = '#5a8fd0';
      const j = biped(k, {
        leg: 0.42, r: 0.42, h: 0.95, lean: 0.06, wide: 1.05, coat: chestPlate(Bl, '#efe0c0', 0.42, { z0: 0.22, z1: 0.55 }),
        headAt: [0, 0.4, 0.14], headR: 0.2,
        arm: { len: 0.45, r: 0.1, out: 0.42, color: Bl, hand: claws3(Bl, '#f2ece2') },
        legs: { r: 0.14, thick: 1.4, footL: 1.6, color: Bl, claws: '#f2ece2', x: 0.55 }
      });
      k.add(j.body, ball(0.52, 0.6, 0.34, 20, 14), { at: [0, 0.36, -0.2], color: vgrad('#7a4a2a', '#9a6a40', 0, 0.8) });
      k.add(j.body, ring(0.5, 0.06, TAU, 8, 28).scale(1, 1.15, 1), { at: [0, 0.38, -0.08], color: '#efe0c2' });
      for (const s of [1, -1]) {
        k.add(j.chest, seg(0.075, 0.07, [s * 0.3, 0.1, -0.2], [s * 0.31, 0.2, 0.34], 12), { color: '#a8acb4', gloss: 0.6 });
        k.add(j.chest, ring(0.07, 0.022, TAU, 6, 14), { at: [s * 0.31, 0.2, 0.35], color: '#6a6e78', gloss: 0.6 });
        k.anchor(s > 0 ? 'cannonL' : 'cannonR', j.chest, [s * 0.31, 0.2, 0.42]);
      }
      k.add(j.head, ball(0.2, 0.18, 0.21), { color: Bl });
      k.add(j.head, ball(0.13, 0.09, 0.12), { at: [0, -0.06, 0.13], color: '#efe0c0' });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.1, 0.05, 0.15, 0.035, { color: '#3a2414', squint: 0.65 });
        k.add(j.head, cone(0.05, 0.1, 8).scale(1, 1, 0.5), { at: [s * 0.15, 0.13, -0.04], rot: [0, 0, -s * 0.5], color: Bl });
      }
      k.anchor('mouth', j.head, [0, -0.05, 0.3]);
      return j;
    }
  },

  machamp: {
    size: 4.2,
    look: { rough: 0.6, sheen: 0.2, coat: 0.1 },
    mo: { walk: 1.8, run: 4.6, turn: 1.6, runChance: 0.3, idleChance: 0.3, act: 'flex' },
    anim: { gait: 'strut', stride: 0.6, bob: 0.05, sway: 0.08, armSwing: 0.55, heavy: 0.8 },
    build(k) {
      const G = C('#8ea4bc');
      const K = C('#1c1c22');
      const Au = C('#f0c040');
      const coat = (x, y, z, c) => (y < 0.06 ? c.copy(K) : y < 0.14 ? c.copy(Au) : c.copy(G));
      const j = biped(k, {
        leg: 0.6, r: 0.34, h: 0.95, coat, wide: 1.12, prof: [0, 0.75, 0.88, 0.9, 0.95, 1.05, 1.08, 0.7, 0], drop: 0.15,
        headAt: [0, 0.36, 0.06], headR: 0.17,
        arm: { len: 0.55, r: 0.1, out: 0.45, thick: 1.45, color: '#8ea4bc', pairs: [[0.06, 1.02], [-0.28, 0.9]], hand: (k2, el, fa) => k2.add(el, ball(0.12, 0.11, 0.12), { at: fa, color: '#8ea4bc' }) },
        legs: { r: 0.13, thick: 1.55, footL: 1.7, color: '#8ea4bc', x: 0.5 }
      });
      k.add(j.head, ball(0.17, 0.18, 0.17), { color: '#8ea4bc' });
      for (let i = -1; i <= 1; i++) k.add(j.head, slab([[0, 0], [0.04, 0.12], [0.16, 0.1], [0.12, 0]], 0.025, 0.01).rotateY(Math.PI / 2).rotateZ(i * 0.35), { at: [i * 0.05, 0.13, 0.04], color: '#8ea4bc' });
      k.add(j.head, ball(0.08, 0.035, 0.05), { at: [0, -0.07, 0.14], color: '#d8c8a8' });
      for (const s of [1, -1]) eye(k, j.head, s * 0.075, 0.04, 0.13, 0.03, { color: '#c8302a', squint: 0.55 });
      k.anchor('hand', j.chest, [0, -0.2, 0.7]);
      return j;
    }
  },

  zapdos: {
    size: 4.8,
    look: { rough: 0.7, sheen: 0.8, double: true },
    mo: { fly: 7.6, alt: [6, 9.5], pattern: 'zig' },
    anim: { flap: 7, amp: 0.8, glide: 0.2, jitter: 1 },
    build(k) {
      const Y = '#f2d22a';
      const j = bird(k, {
        r: 0.26, len: 0.85, coat: Y, headCoat: Y, neck: 0.22, tilt: 0.55, bodyFluff: 0.08,
        headR: 0.15, beak: '#f08a2a', beakLen: 0.22, beakR: 0.05, hook: 0.12, eye: { dark: true, color: '#141210' },
        wing: { span: 1.8, chord: 0.5, kind: 'fingers', color: wingGrad([[0, Y], [0.85, '#f2c82a'], [1, '#2a2420']]), extra: (k2, sh, el, s, wi, wo) => {
          for (let i = 0; i < 7; i++) k2.add(el, spike(0.035, 0.24, [0.35, 0, -1], [s * wo * (0.12 + i * 0.12), 0, -0.12], 6), { color: Y });
          for (let i = 0; i < 4; i++) k2.add(sh, spike(0.035, 0.2, [0, 0, -1], [s * wi * (0.2 + i * 0.22), 0, -0.2], 6), { color: Y });
        } },
        feet: '#1a1a1a', tailCoat: Y, tailLen: 0.6, tailW: 0.5
      });
      for (let i = 0; i < 6; i++) k.add(j.head, spike(0.03, 0.2, [(i % 3 - 1) * 0.4, 0.8, -0.8], [(i % 3 - 1) * 0.04, 0.1, -0.02 - Math.floor(i / 3) * 0.06], 6), { color: Y });
      for (let i = 0; i < 8; i++) k.add(j.body, spike(0.04, 0.2, [(i % 2 ? 1 : -1) * 0.6, 0.7, -0.6], [(i % 2 ? 1 : -1) * 0.12, 0.15, -0.3 + i * 0.07], 6), { color: Y });
      return j;
    }
  },

  moltres: {
    size: 4.9,
    look: { rough: 0.7, sheen: 0.8, double: true },
    mo: { fly: 5.4, alt: [6, 9.5], pattern: 'dance' },
    anim: { flap: 4, amp: 0.85, glide: 0.35 },
    build(k) {
      const j = bird(k, {
        r: 0.24, len: 0.85, coat: belly('#f2b23a', '#f8d070', 0.24), headCoat: '#f2b23a', neck: 0.26, tilt: 0.45,
        headR: 0.14, beak: '#e8c28a', beakLen: 0.16, eye: { dark: true, color: '#141210' }, tailFan: false,
        wing: { span: 1.8, chord: 0.5, kind: 'fingers', color: (t, z, c) => grad([[0, '#f2b23a'], [0.35, '#ffb02a'], [0.6, '#ff7a1a'], [1, '#e8401a']])(t, c), glowOuter: 0.85, glowInner: 0.25, extra: (k2, sh, el, s, wi, wo) => {
          for (let i = 0; i < 6; i++) fire(k2, el, [s * wo * (0.1 + i * 0.15), 0.02, -0.05], 0.06, 0.32 - i * 0.02, { dir: [s * 0.3, 0.6, -1], sweep: 0.3 });
        } },
        feet: '#8a6a4a'
      });
      for (let i = 0; i < 4; i++) fire(k, j.head, [(i - 1.5) * 0.03, 0.12, -0.02], 0.05, 0.36, { dir: [(i - 1.5) * 0.2, 1, -0.6], sweep: 0.5 });
      const tb = k.bone(j.body, 0, 0.06, -0.42);
      for (let i = 0; i < 5; i++) fire(k, tb, [(i - 2) * 0.04, 0, 0], 0.08, 0.75, { dir: [(i - 2) * 0.25, 0.15, -1], sweep: -0.2 });
      j.tails = [[tb]];
      return j;
    }
  },

  mewtwo: {
    size: 4.4,
    look: { rough: 0.5, sheen: 0.5, sheenColor: '#f2e8ff', coat: 0.2 },
    mo: { walk: 2.2, run: 5.5, turn: 2.2, runChance: 0.3, idleChance: 0.3, act: 'psy', hover: 1.1, teleport: true },
    anim: { gait: 'float', bob: 0.08, folded: 1 },
    build(k) {
      const G = C('#d9d4e2');
      const P = C('#8b5bb0');
      const coat = (x, y, z, c) => (y < 0.2 && y > -0.2 ? c.copy(P) : c.copy(G));
      const j = biped(k, {
        leg: 0.6, r: 0.24, h: 0.72, coat, prof: [0, 0.8, 0.98, 1, 0.9, 0.85, 0.85, 0.6, 0], drop: 0.2,
        headAt: [0, 0.38, 0.05], headR: 0.15,
        arm: { len: 0.42, r: 0.045, out: 0.25, color: '#d9d4e2', hand: (k2, el, fa) => {
          k2.add(el, ball(0.055, 0.05, 0.06), { at: fa, color: '#d9d4e2' });
          for (let i = 0; i < 3; i++) k2.add(el, ball(0.02, 0.02, 0.04), { at: [fa[0] + (i - 1) * 0.025, fa[1] - 0.04, fa[2] + 0.05], color: '#d9d4e2' });
        } },
        legs: { r: 0.075, thick: 1.8, footL: 1.6, footH: 0.05, color: '#d9d4e2', x: 0.5 }
      });
      k.add(j.chest, seg(0.08, 0.07, [0, 0, 0], [0, 0.3, 0.03], 10), { color: '#d9d4e2' });
      k.add(j.head, ball(0.14, 0.15, 0.15), { color: '#d9d4e2' });
      for (const s of [1, -1]) {
        eye(k, j.head, s * 0.065, 0.02, 0.11, 0.035, { color: '#8a3ac8', squint: 0.62, iris: 0.8 });
        k.add(j.head, cone(0.035, 0.12, 8), { at: [s * 0.08, 0.11, -0.03], rot: [-0.2, 0, -s * 0.25], color: '#d9d4e2' });
      }
      k.add(j.head, seg(0.03, 0.03, [0, 0.0, -0.12], [0, -0.3, -0.1], 8), { color: '#d9d4e2' });
      const tail = chain(k, j.body, [0, -0.1, -0.18], [0, -0.45, -1], 6, 1.0, (t) => 0.085 - 0.04 * t, '#8b5bb0', [1.6, 0, 0.5]);
      j.tails = [tail];
      k.anchor('hand', j.chest, [0, -0.1, 0.4]);
      k.anchor('mouth', j.head, [0, 0, 0.2]);
      return j;
    }
  }
};

function wingOutlineButterfly(w, c) {
  const p = [];
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * TAU;
    const r = 1 + 0.16 * Math.cos(a * 2) - 0.1 * Math.cos(a * 3);
    p.push([w * 0.5 + Math.cos(a) * w * 0.5 * r, Math.sin(a) * c * 0.5 * r]);
  }
  return p;
}

function bandTailColor(a, b) {
  const A = C(a);
  const B = C(b);
  return (x, y, z, c) => c.copy(Math.sin(y * 30) > 0.6 ? B : A);
}

function claws3(skin, claw) {
  return (k, el, fa) => {
    k.add(el, ball(0.07, 0.065, 0.075), { at: fa, color: skin });
    for (const cx of [-0.035, 0, 0.035]) k.add(el, spike(0.012, 0.05, [0, -0.4, 1], [fa[0] + cx, fa[1] - 0.03, fa[2] + 0.06], 5), { color: claw, gloss: 0.5 });
  };
}

export const KEYS = Object.keys(DEFS);


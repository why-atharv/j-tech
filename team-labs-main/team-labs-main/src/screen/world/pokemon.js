import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Kit, pokeMaterial, pokeClock, TAU } from './pokekit.js';
import { DEFS, KEYS } from './pokedex.js';

export { pokeClock };
export const POKE_KEYS = KEYS;
export const POKE_DEFS = DEFS;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
let lite = false;

export function setPokeLite(v) {
  lite = !!v;
}

const templates = new Map();

function template(key) {
  let t = templates.get(key);
  if (t) return t;
  const def = DEFS[key];
  const k = new Kit();
  const j = def.build(k);
  const { mesh, anchors } = k.build(pokeMaterial(def.look, lite));
  const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
  const dims = box.getSize(new THREE.Vector3());
  t = { def, j, mesh, anchors, box, extent: Math.max(dims.x, dims.y, dims.z) || 1 };
  templates.set(key, t);
  return t;
}

export function preparePokemon(key) {
  template(key);
}

function remap(x, map) {
  if (x instanceof THREE.Object3D) return map.get(x) || x;
  if (Array.isArray(x)) return x.map((y) => remap(y, map));
  if (x && x.constructor === Object) return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, remap(y, map)]));
  return x;
}

export function instancePokemon(key) {
  const t = template(key);
  const mesh = cloneSkinned(t.mesh);
  const map = new Map();
  t.mesh.skeleton.bones.forEach((b, i) => {
    const c = mesh.skeleton.bones[i];
    c.userData = { rest: b.userData.rest };
    map.set(b, c);
  });
  const material = pokeMaterial(t.def.look, lite);
  mesh.material = material;
  const box = t.box;
  return {
    key,
    def: t.def,
    plan: t.j.plan,
    mesh,
    material,
    j: remap(t.j, map),
    anchors: t.anchors,
    box,
    extent: t.extent,
    height: box.max.y - Math.min(0, box.min.y)
  };
}

export function pokeSize(key) {
  return DEFS[key]?.size || 3;
}

const rs = (b) => b.userData.rest;

function rot(b, x = 0, y = 0, z = 0) {
  const r = rs(b).rot;
  b.rotation.set(r.x + x, r.y + y, r.z + z);
}

function place(b, dx = 0, dy = 0, dz = 0) {
  const p = rs(b).pos;
  b.position.set(p.x + dx, p.y + dy, p.z + dz);
}

function scl(b, s) {
  const r = rs(b).scale;
  if (typeof s === 'number') b.scale.set(r.x * s, r.y * s, r.z * s);
  else b.scale.set(r.x * s[0], r.y * s[1], r.z * s[2]);
}

const GAITS = {
  walk: [0.25, 0.75, 0, 0.5],
  amble: [0.25, 0.75, 0, 0.5],
  trot: [0, 0.5, 0.5, 0],
  prance: [0, 0.5, 0.5, 0],
  gallop: [0.58, 0.68, 0, 0.1],
  canter: [0.55, 0.25, 0.25, 0],
  bound: [0.5, 0.55, 0, 0.05]
};

function animTails(j, a, st, extra = 0) {
  const wag = (a.tailWag ?? 0.15) * (1 + extra);
  const f = (a.tailFreq ?? 1.6) * (1 + extra * 1.5);
  (j.tails || []).forEach((tail, ti) => {
    tail.forEach((b, i) => {
      const lag = i * 0.55 + ti * 0.9;
      rot(b, Math.sin(st.time * 1.1 - lag) * 0.05 - (i === 0 ? st.blend * 0.12 : 0), Math.sin(st.time * f - lag) * wag * (0.5 + i * 0.3), Math.sin(st.time * f * 0.7 - lag) * wag * 0.25);
    });
  });
}

function animEars(j, a, st) {
  (j.ears || []).forEach(({ b, side }) => {
    const flick = Math.max(0, Math.sin(st.time * (0.9 + (a.earFlick ?? 0.5)) + side * 1.7) - 0.9) * 2.5;
    rot(b, 0, 0, side * flick * 0.6 + (st.act === 'ears' ? side * Math.sin(st.actT * 10) * 0.3 * st.actW : 0));
  });
}

function animQuad(r, st) {
  const { j, def } = r;
  const a = def.anim || {};
  const w = st.blend;
  const style = st.run ? a.run || 'gallop' : a.gait || 'walk';
  const roll = st.rollW || 0;
  const off = GAITS[style] || GAITS.walk;
  const amp = (a.amp ?? 0.42) * (st.run ? 1.35 : 1) * (style === 'amble' ? 0.8 : 1);
  const act = st.act;
  const aw = st.actW || 0;

  j.legs.forEach((leg, i) => {
    const s = TAU * (st.phase + off[i]);
    let swing = Math.sin(s) * amp * w;
    const lift = Math.max(0, Math.cos(s)) * w;
    let knee = leg.front ? lift * (st.run ? 0.95 : 0.6) : lift * (st.run ? 0.7 : 0.45);
    if (act === 'wave') {
      if (leg.front) {
        swing += leg.side > 0 ? (-2.1 + Math.sin(st.time * 14) * 0.35) * aw : -0.7 * aw;
        knee += leg.side > 0 ? -0.2 * aw : 0.5 * aw;
      } else swing += 0.95 * aw;
    } else if (act === 'wag' && !leg.front) {
      swing += -0.9 * aw;
      knee += 1.2 * aw;
    } else if (act === 'paw' && leg.front && leg.side > 0) {
      swing += (-0.5 + Math.sin(st.actT * 9) * 0.45) * aw;
    }
    rot(leg.hip, swing, 0, 0);
    rot(leg.knee, knee, 0, 0);
    scl(leg.hip, 1 - roll * 0.97);
  });

  const stride = TAU * st.phase;
  const bounce = (a.bounce ?? 0.02) * (st.run ? 2.2 : 1);
  const heavy = a.heavy ?? 0;
  const bob = bounce * Math.abs(Math.sin(stride * (style === 'bound' || style === 'gallop' ? 1 : 2))) * w;
  const breathe = Math.sin(st.time * 2.1) * 0.012 * (1 - w * 0.6);
  let bx = 0;
  let by = bob - (a.low ?? 0) * w + (a.float ?? 0) * Math.sin(st.time * 1.3);
  if (st.run && (style === 'gallop' || style === 'bound' || style === 'canter')) bx += Math.sin(stride) * 0.09 * w;
  if (act === 'wave') {
    bx -= 0.95 * aw;
    by += r.j.R * 0.6 * aw;
  } else if (act === 'wag') {
    bx -= 0.38 * aw;
    by -= r.j.R * 0.25 * aw;
  } else if (act === 'charge') {
    by += Math.sin(st.actT * 40) * 0.006 * aw;
  }
  if (roll > 0) {
    by = by * (1 - roll) + (r.j.R * 1.05 - rs(j.body).pos.y) * roll;
    bx = bx * (1 - roll) + (st.rollA || 0) * roll;
  }
  place(j.body, 0, by - heavy * 0.01 * Math.abs(Math.cos(stride)) * w, 0);
  rot(j.body, bx, 0, -st.turn * 0.05 * w);
  scl(j.body, roll > 0 ? [1 + 0.15 * roll, 1 + 0.18 * roll + breathe, 1 - 0.1 * roll] : [1 + breathe, 1 + breathe * 1.2, 1]);
  if (act === 'charge') scl(j.body, 1 + Math.sin(st.actT * 37) * 0.025 * aw);

  let nx = Math.sin(stride * 2) * (a.headBob ?? 0.04) * w + Math.sin(st.time * 0.5) * 0.04 * (1 - w);
  let ny = st.look * 0.5 * (1 - w) + st.turn * 0.25;
  if (act === 'stare') {
    ny += 2.1 * aw;
    nx += 0.25 * aw;
  } else if (act === 'sniff') nx += (0.55 + Math.sin(st.actT * 6) * 0.08) * aw;
  else if (act === 'roar') nx -= 0.55 * aw;
  else if (act === 'wave') nx += 0.6 * aw;
  else if (act === 'charge') nx += 0.25 * aw;
  else if (act === 'paw') nx += 0.35 * aw;
  rot(j.neck, nx, ny, 0);
  rot(j.head, -nx * 0.5 + (act === 'wave' ? 0.35 * aw : 0), st.look * 0.5 * (1 - w), act === 'look' ? Math.sin(st.actT * 2) * 0.25 * aw : 0);
  scl(j.neck, 1 - roll * 0.6);
  animTails(j, a, st, act === 'wag' ? 2 * aw : 0);
  (j.tails || []).forEach((tail) => tail[0] && scl(tail[0], 1 - roll * 0.9));
  animEars(j, a, st);
}

function animBiped(r, st) {
  const { j, def } = r;
  const a = def.anim || {};
  if (a.gait === 'float') return animFloat(r, st);
  const w = st.blend;
  const act = st.act;
  const aw = st.actW || 0;
  const ph = TAU * st.phase;
  const amp = (a.stride ?? 0.6) * (st.run ? 1.25 : 1);
  const hop = a.gait === 'hop' || (a.hopRun && st.run);
  const fly = st.fly || 0;

  j.legs.forEach((leg) => {
    const s = hop ? ph : ph + (leg.side > 0 ? 0 : Math.PI);
    const swing = Math.sin(s) * amp * w * (1 - fly);
    const knee = Math.max(0, -Math.cos(s)) * amp * 1.2 * w * (1 - fly) + fly * 0.6;
    let x = swing + fly * 0.5;
    let z = leg.side * ((a.wide ?? 0) + (a.gait === 'waddle' ? 0.08 : 0));
    if (act === 'sleep') x -= 1.2 * aw;
    rot(leg.hip, x, 0, z);
    rot(leg.knee, knee + (act === 'sleep' ? 0.2 * aw : 0), 0, 0);
  });

  const bobAmt = a.bob ?? 0.05;
  let by = hop ? Math.abs(Math.sin(ph)) * bobAmt * 2 * w : Math.abs(Math.sin(ph)) * bobAmt * w - (a.heavy ? Math.pow(Math.abs(Math.cos(ph)), 6) * 0.02 * a.heavy * w : 0);
  by -= (a.crouch ?? 0) * 0.1 * w;
  by += (a.hover ?? 0) * (0.5 + Math.sin(st.time * 3) * 0.5);
  let bx = 0;
  let bz = Math.sin(ph) * (a.sway ?? 0.06) * w;
  if (act === 'sleep') {
    bx -= 1.0 * aw;
    by -= r.j.hip * 0.35 * aw;
  } else if (act === 'jump') {
    by += Math.abs(Math.sin(st.actT * 7)) * 0.3 * aw;
  }
  if (a.jiggle) by += Math.sin(st.time * 9) * 0.008 * w;
  by += fly * r.j.hip * 0.2;
  place(j.body, 0, by, 0);
  rot(j.body, bx - fly * 0.6, Math.sin(ph) * 0.08 * w, bz - st.turn * 0.04 * w);

  let cx = (a.crouch ?? 0) * 0.25 * w;
  let cy = -Math.sin(ph) * 0.1 * w;
  if (act === 'roar') cx -= 0.3 * aw;
  if (act === 'aim') cx += 0.15 * aw;
  if (act === 'sleep') cx -= 0.2 * aw;
  rot(j.chest, cx + Math.sin(st.time * 1.8) * 0.015, cy, 0);
  if (a.jiggle) scl(j.chest, 1 + Math.sin(st.time * 9) * 0.01 * w);

  const swingA = a.armSwing ?? 0.5;
  (j.arms || []).forEach((arm, i) => {
    const s = ph + (arm.side > 0 ? Math.PI : 0) + (arm.pair ? Math.PI : 0);
    let x = Math.sin(s) * swingA * 0.6 * w;
    let y = 0;
    let z = 0;
    let ex = -0.25 - Math.max(0, Math.sin(s)) * 0.35 * w;
    let ez = 0;
    if (a.gait === 'strut') ez += arm.side * 0.25 * Math.max(0, Math.sin(st.time * 2 + i)) * w;
    if (act === 'flex') {
      z += arm.side * (arm.pair ? 0.6 : 1.45) * aw;
      ex -= (arm.pair ? 0.6 : 1.5) * aw;
    } else if (act === 'roar') {
      z += arm.side * 0.6 * aw;
      x -= 0.4 * aw;
    } else if (act === 'swing' && arm.side > 0) {
      x += (-1.6 + Math.sin(st.actT * 10) * 0.9) * aw;
    } else if (act === 'slash') {
      x += (-1.3 + Math.sin(st.actT * 12 + (arm.side > 0 ? 0 : Math.PI)) * 0.6) * aw;
      z -= arm.side * 0.3 * aw;
    } else if (act === 'punch') {
      const p = Math.max(0, Math.sin(st.actT * 8 + (arm.side > 0 ? 0 : Math.PI)));
      x += -1.4 * p * aw;
      ex += 0.25 * p * aw;
    } else if (act === 'jump') {
      z += arm.side * 1.9 * aw;
    } else if (act === 'sleep') {
      z += arm.side * 0.5 * aw;
      x -= 0.3 * aw;
    } else if (act === 'aim') {
      x -= 0.4 * aw;
    }
    if (fly) z += arm.side * 0.2 * fly;
    rot(arm.sh, x, y, z);
    rot(arm.el, ex, 0, ez);
  });

  let hx = Math.sin(ph * 2) * 0.03 * w;
  let hy = st.look * 0.6 * (1 - w) + st.turn * 0.2;
  if (act === 'roar') hx -= 0.5 * aw;
  if (act === 'stare') hy += 1.2 * aw;
  if (act === 'sleep') hx += 0.25 * aw;
  if (j.head !== j.chest) rot(j.head, hx, hy, Math.sin(st.time * 0.7) * 0.04);
  (j.necks || []).forEach((neck, i) => {
    const s = ph * (hop ? 1 : 2) + i * 2.1;
    neck.forEach((b, k) => rot(b, Math.sin(s - k * 0.4) * 0.16 * w + Math.sin(st.time * 0.8 + i) * 0.06, Math.sin(st.time * 0.6 + i * 1.7) * 0.25 * (1 - w), 0));
  });
  if (j.heads && !j.necks) j.heads.forEach((h, i) => h !== j.head && rot(h, Math.sin(st.time * 1.3 + i * 2) * 0.12, Math.sin(st.time * 0.9 + i) * 0.3, 0));
  if (j.extra?.crown) rot(j.extra.crown, Math.sin(st.time * 1.1) * 0.08 + Math.sin(ph) * 0.06 * w, 0, Math.sin(st.time * 0.8) * 0.1 * (a.crownSway ?? 0));
  if (j.extra?.baby) rot(j.extra.baby, Math.sin(st.time * 2.6) * 0.15, Math.sin(st.time * 1.2) * 0.5, 0);
  (j.wings || []).forEach(({ sh, el, side }) => {
    const f = a.flap ?? 4.5;
    const s = Math.sin(st.time * f);
    rot(sh, 0, -side * 0.7 * fly, side * (s * 0.75 * fly + Math.sin(st.time * 1.5) * 0.04 * (1 - fly) - 0.5 * fly));
    rot(el, 0, 0, side * Math.sin(st.time * f - 0.8) * 0.5 * fly);
  });
  animTails(j, a, st);
  animEars(j, a, st);
}

function animFloat(r, st) {
  const { j, def } = r;
  const a = def.anim || {};
  const w = st.blend;
  const act = st.act;
  const aw = st.actW || 0;
  const t = st.time;
  let flip = 0;
  if (act === 'flip') flip = -ease(clamp01(st.actT / 1.3)) * TAU * (st.actT < 1.4 ? 1 : 0);
  place(j.body, 0, Math.sin(t * 2) * (a.bob ?? 0.08), 0);
  rot(j.body, flip + w * 0.25, Math.sin(t * 0.7) * 0.15, Math.sin(t * 1.3) * 0.06 - st.turn * 0.08);
  j.legs.forEach((leg) => {
    rot(leg.hip, 0.25 + Math.sin(t * 1.6 + leg.side) * 0.12 + w * 0.3, 0, leg.side * 0.05);
    rot(leg.knee, 0.35 + Math.sin(t * 1.6 + leg.side + 0.6) * 0.1, 0, 0);
  });
  (j.arms || []).forEach((arm) => {
    if (a.folded && act !== 'psy') {
      rot(arm.sh, -0.55, 0, -arm.side * 0.25);
      rot(arm.el, -1.35, -arm.side * 0.85, 0);
    } else if (act === 'psy') {
      rot(arm.sh, -1.35 * aw - 0.55 * (1 - aw), 0, arm.side * 0.25 * aw);
      rot(arm.el, -0.2 * aw - 1.35 * (1 - aw), -arm.side * 0.85 * (1 - aw), 0);
    } else rot(arm.sh, Math.sin(t * 2.4 + arm.side) * 0.4, 0, arm.side * (0.3 + Math.sin(t * 2.4) * 0.2));
  });
  rot(j.chest, Math.sin(t * 1.4) * 0.03, 0, 0);
  rot(j.head, Math.sin(t * 0.9) * 0.1, st.look * 0.6 + Math.sin(t * 0.5) * 0.2, Math.sin(t * 1.1) * 0.08);
  (j.tails || []).forEach((tail) => tail.forEach((b, i) => rot(b, Math.sin(t * 1.8 - i * 0.5) * 0.12, Math.sin(t * 1.3 - i * 0.6) * 0.18, 0)));
}

function animBird(r, st) {
  const { j, def } = r;
  const a = def.anim || {};
  const t = st.time;
  const f = a.flap ?? 7;
  const glide = (a.glide ?? 0) * clamp01(Math.sin(t * 0.45 + (st.seed || 0)) * 1.6);
  const flapping = Math.max(0.12, 1 - glide) * (st.dive ? 0.35 : 1);
  const amp = a.amp ?? 0.8;
  const s = Math.sin(t * f);
  j.wings.forEach(({ sh, el, side, big }) => {
    const ph = big === false ? 0.35 : 0;
    const ss = Math.sin(t * f - ph);
    rot(sh, 0, 0, side * (ss * amp * flapping + 0.08 + glide * 0.05 - (st.dive || 0) * 0.5));
    if (el !== sh) rot(el, 0, 0, side * Math.sin(t * f - 0.8) * amp * 0.55 * flapping);
  });
  place(j.body, 0, -s * 0.04 * amp * flapping, 0);
  rot(j.body, s * 0.03 * amp + (st.dive || 0) * 0.5, 0, a.jitter ? Math.sin(t * 23) * 0.03 : 0);
  if (j.head !== j.body) rot(j.head, Math.sin(t * 2.1) * 0.05, Math.sin(t * 0.6) * 0.25, 0);
  (j.tails || []).forEach((tail) => tail.forEach((b, i) => rot(b, Math.sin(t * 1.3 - i * 0.5) * 0.08 + glide * 0.02, Math.sin(t * 0.9 - i * 0.5) * 0.1, 0)));
}

function animSwim(r, st) {
  const { j } = r;
  const t = st.time;
  const w = st.blend;
  place(j.body, 0, Math.sin(t * 1.4) * 0.03, 0);
  rot(j.body, Math.sin(t * 1.4 + 0.6) * 0.03, 0, Math.sin(t * 0.9) * 0.03 - st.turn * 0.06);
  j.fins.forEach(({ b, side, front }) => {
    const s = Math.sin(t * (1.6 + w * 2) + (front ? 0 : 1.4));
    rot(b, 0, side * s * 0.45 * (0.4 + w), side * s * 0.2);
  });
  (j.necks || []).forEach((neck) => neck.forEach((b, i) => rot(b, Math.sin(t * 0.8 - i * 0.4) * 0.05, (st.look * 0.4 + Math.sin(t * 0.5) * 0.15) * (i ? 0.5 : 1), Math.sin(t * 0.7 - i * 0.5) * 0.04)));
  rot(j.head, Math.sin(t * 1.1) * 0.05, 0, 0);
  animTails(j, r.def.anim || {}, st);
}

export function animatePokemon(r, st) {
  if (r.plan === 'quad') animQuad(r, st);
  else if (r.plan === 'biped') animBiped(r, st);
  else if (r.plan === 'bird') animBird(r, st);
  else if (r.plan === 'swim') animSwim(r, st);
}

export function anchorOf(r, name) {
  return r.anchors[name] || r.anchors.mouth || r.anchors.center || new THREE.Vector3();
}

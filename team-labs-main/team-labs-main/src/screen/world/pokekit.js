import * as THREE from 'three';
import { noise2 } from './terrain.js';

export const TAU = Math.PI * 2;
const smooth = THREE.MathUtils.smoothstep;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const pokeClock = { value: 0 };

export function lathe(profile, seg = 18) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    seg
  );
}

export function ball(rx, ry = rx, rz = rx, w = 16, h = 12) {
  return new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
}

export function limb(r1, r2, len, seg = 12) {
  const p = [];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    p.push([Math.cos(a) * r2, -len + Math.sin(a) * r2]);
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    p.push([Math.cos(a) * r1, Math.sin(a) * r1]);
  }
  return lathe(p, seg);
}

export const DOWN = new THREE.Vector3(0, -1, 0);
export const UP = new THREE.Vector3(0, 1, 0);

export function aim(geo, dir, base = DOWN) {
  const d = new THREE.Vector3(...dir).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(base, d));
  return geo;
}

export function seg(r1, r2, from, to, sides = 12) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b) || 0.001;
  const g = limb(r1, r2, len, sides);
  aim(g, b.clone().sub(a).toArray());
  return g.translate(a.x, a.y, a.z);
}

export function cone(r, h, sides = 10) {
  return new THREE.ConeGeometry(r, h, sides).translate(0, h / 2, 0);
}

export function spike(r, h, dir, at = [0, 0, 0], sides = 8) {
  const g = cone(r, h, sides);
  aim(g, dir, UP);
  return g.translate(...at);
}

export function horn(r, h, bend = 0, sides = 10, twist = 0) {
  const g = lathe([[0, 0], [r, 0.0001], [r * 0.9, h * 0.25], [r * 0.62, h * 0.6], [r * 0.26, h * 0.88], [0, h]], sides);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    let x = p.getX(i);
    let z = p.getZ(i);
    if (twist) {
      const a = t * twist;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r0 = Math.hypot(x, z);
      const ripple = r0 > 0 ? 1 + Math.sin(Math.atan2(z, x) * 3 + t * 14) * 0.12 * (1 - t) : 1;
      const ox = x;
      x = (ox * c - z * s) * ripple;
      z = (ox * s + z * c) * ripple;
    }
    p.setXYZ(i, x, p.getY(i), z + bend * h * t * t);
  }
  return g;
}

export function drop(r, h, sweep = 0, sides = 12) {
  const g = lathe([[0, 0], [r * 0.75, h * 0.07], [r, h * 0.22], [r * 0.85, h * 0.45], [r * 0.5, h * 0.72], [r * 0.16, h * 0.92], [0, h]], sides);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setZ(i, p.getZ(i) - sweep * h * t * t);
  }
  return g;
}

export function egg(r, h, prof = [0, 0.72, 0.94, 1, 0.97, 0.86, 0.66, 0.36, 0], sides = 20) {
  const n = prof.length - 1;
  return lathe(prof.map((m, i) => [r * m, (i / n) * h]), sides);
}

export function spine(len, r, prof = [0.04, 0.6, 0.86, 0.97, 1, 0.97, 0.92, 0.82, 0.55, 0.04], sides = 20) {
  const n = prof.length - 1;
  return lathe(prof.map((m, i) => [r * m, -len / 2 + (i / n) * len]), sides).rotateX(Math.PI / 2);
}

export function slab(pts, depth, bevel = depth * 0.4) {
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
  g.deleteAttribute('uv');
  return g.translate(0, 0, -depth / 2);
}

export function ring(R, r, arc = TAU, rs = 8, ts = 24) {
  return new THREE.TorusGeometry(R, r, rs, ts, arc);
}

export function mirrorX(geo) {
  geo.scale(-1, 1, 1);
  if (geo.index) {
    const a = geo.index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    geo.index.needsUpdate = true;
  } else {
    const n = geo.attributes.position.count;
    const idx = [];
    for (let i = 0; i < n; i += 3) idx.push(i, i + 2, i + 1);
    geo.setIndex(idx);
  }
  return geo;
}

export function warp(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

export function fluff(geo, amount, freq = 7, seed = 0) {
  return warp(geo, (v) => {
    const n = noise2(v.x * freq + seed, v.y * freq + v.z * freq * 0.7 - seed);
    const m = noise2(v.z * freq * 1.3 - seed, v.x * freq * 0.6 + v.y * 1.1 + seed);
    v.multiplyScalar(1 + (n * 0.6 + m * 0.4) * amount);
  });
}

export function grad(stops) {
  const cols = stops.map(([t, h]) => [t, new THREE.Color(h)]);
  return (t, c) => {
    if (t <= cols[0][0]) return c.copy(cols[0][1]);
    for (let i = 1; i < cols.length; i++) {
      if (t <= cols[i][0]) {
        const [t0, c0] = cols[i - 1];
        const [t1, c1] = cols[i];
        return c.copy(c0).lerp(c1, (t - t0) / (t1 - t0 || 1));
      }
    }
    return c.copy(cols[cols.length - 1][1]);
  };
}

export function vgrad(lo, hi, y0, y1) {
  const a = new THREE.Color(lo);
  const b = new THREE.Color(hi);
  return (x, y, z, c) => c.copy(a).lerp(b, smooth(y, y0, y1));
}

export function axisGrad(stops, axis, from, to) {
  const g = grad(stops);
  return (x, y, z, c) => g(clamp01(((axis === 'x' ? Math.abs(x) : axis === 'y' ? y : z) - from) / (to - from)), c);
}

export function belly(top, under, R, offset = 0) {
  const a = new THREE.Color(top);
  const b = new THREE.Color(under);
  return (x, y, z, c) => c.copy(a).lerp(b, smooth(-(y - offset), R * 0.05, R * 0.7) * (1 - smooth(Math.abs(x), R * 0.5, R * 0.95)));
}

export class Kit {
  constructor() {
    this.bones = [];
    this.parts = [];
    this.anchorDefs = {};
    this.root = this.bone(null, 0, 0, 0);
  }

  bone(parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    this.bones.push(b);
    return b;
  }

  add(bone, geo, o = {}) {
    if (o.scale) geo.scale(...(Array.isArray(o.scale) ? o.scale : [o.scale, o.scale, o.scale]));
    if (o.rot) geo.rotateX(o.rot[0]).rotateY(o.rot[1]).rotateZ(o.rot[2]);
    if (o.at) geo.translate(...o.at);
    if (o.mirror) mirrorX(geo);
    const color = typeof o.color === 'function' ? o.color : new THREE.Color(o.color || '#ffffff');
    this.parts.push({ bone, geo, color, glow: o.glow || 0, gloss: o.gloss || 0, flat: !!o.flat, mottle: o.mottle ?? 1 });
    return geo;
  }

  both(bone, make, o = {}) {
    for (const s of [1, -1]) {
      const opts = typeof o === 'function' ? o(s) : o;
      this.add(bone, make(), { ...opts, mirror: s < 0 });
    }
  }

  anchor(name, bone, at) {
    this.anchorDefs[name] = { bone, at: new THREE.Vector3(...at) };
  }

  build(material) {
    this.root.updateMatrixWorld(true);
    const index = new Map(this.bones.map((b, i) => [b, i]));
    const positions = [];
    const normals = [];
    const colors = [];
    const fx = [];
    const skinIndex = [];
    const skinWeight = [];
    const indices = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const c = new THREE.Color();
    let offset = 0;
    for (const part of this.parts) {
      const g = part.geo;
      if (!part.flat) g.computeVertexNormals();
      else if (!g.attributes.normal) g.computeVertexNormals();
      const m = part.bone.matrixWorld;
      const nm = new THREE.Matrix3().getNormalMatrix(m);
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      const bi = index.get(part.bone);
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const ly = pos.getY(i);
        const lz = pos.getZ(i);
        v.set(lx, ly, lz).applyMatrix4(m);
        n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        positions.push(v.x, v.y, v.z);
        normals.push(n.x, n.y, n.z);
        if (typeof part.color === 'function') part.color(lx, ly, lz, c);
        else c.copy(part.color);
        if (!part.glow && part.mottle) {
          const k = noise2(v.x * 9.1 + v.z * 3.3, v.y * 8.7 - v.z * 5.1) * 0.5 + noise2(v.x * 23 + 4, v.y * 21 + v.z * 19) * 0.5;
          c.multiplyScalar(1 + k * 0.07 * part.mottle);
        }
        colors.push(c.r, c.g, c.b);
        fx.push(part.glow, part.gloss);
        skinIndex.push(bi, 0, 0, 0);
        skinWeight.push(1, 0, 0, 0);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(g.index.getX(i) + offset);
      else for (let i = 0; i < pos.count; i++) indices.push(i + offset);
      offset += pos.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('fx', new THREE.Float32BufferAttribute(fx, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    geo.setIndex(indices.length > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.add(this.root);
    mesh.bind(new THREE.Skeleton(this.bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    for (const b of this.bones) b.userData.rest = { rot: b.rotation.clone(), pos: b.position.clone(), scale: b.scale.clone() };
    const anchors = {};
    for (const [name, a] of Object.entries(this.anchorDefs)) anchors[name] = a.bone.localToWorld(a.at.clone());
    return { mesh, anchors };
  }
}

const injectVertex = (src) =>
  src
    .replace('#include <common>', '#include <common>\nattribute vec2 fx;\nvarying vec2 vFx;\nuniform float uTime;')
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvFx = fx;\nif (fx.x > 0.6) { float w = sin(uTime * 13.0 + position.y * 23.0 + position.x * 11.0 + position.z * 7.0); transformed += objectNormal * w * 0.02 * fx.x; transformed.y += max(0.0, w) * 0.012 * fx.x; }'
    );

const injectFragment = (src) =>
  src
    .replace('#include <common>', '#include <common>\nvarying vec2 vFx;\nuniform float uTime;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.1, vFx.y);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFx.x * (1.7 + 0.55 * sin(uTime * 10.0 + vFx.x * 31.0));');

function patch(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = pokeClock;
    shader.vertexShader = injectVertex(shader.vertexShader);
    shader.fragmentShader = injectFragment(shader.fragmentShader);
  };
  mat.customProgramCacheKey = () => 'poke-v1';
  return mat;
}

export function pokeMaterial(look = {}, lite = false) {
  const base = {
    vertexColors: true,
    roughness: look.rough ?? 0.78,
    metalness: look.metal ?? 0,
    side: look.double ? THREE.DoubleSide : THREE.FrontSide
  };
  if (lite) return patch(new THREE.MeshStandardMaterial(base));
  return patch(
    new THREE.MeshPhysicalMaterial({
      ...base,
      sheen: look.sheen ?? 0.7,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(look.sheenColor || '#ffffff'),
      clearcoat: look.coat ?? 0,
      clearcoatRoughness: 0.35
    })
  );
}

export function eye(k, bone, x, y, z, r, o = {}) {
  const s = Math.sign(x) || 1;
  const n = new THREE.Vector3(s * (o.splay ?? 0.4), o.tilt ?? 0.05, 1).normalize();
  const yaw = Math.atan2(n.x, n.z);
  const pitch = -Math.asin(n.y);
  const at = (d, up = 0, side = 0) => [x + n.x * d * r + side * r, y + n.y * d * r + up * r, z + n.z * d * r];
  const sq = o.squint ?? 1;
  if (o.closed) {
    k.add(bone, ball(r * 1.05, r * 0.16, r * 0.6), { at: [x, y, z], rot: [0, yaw, o.roll ?? 0], color: o.lid || '#22161a', mottle: 0 });
    return;
  }
  if (!o.dark) k.add(bone, ball(r, r * sq, r * 0.85, 14, 10), { at: [x, y, z], rot: [pitch, yaw, o.roll ?? 0], color: o.sclera || '#f6f4ee', gloss: 1, mottle: 0 });
  const ir = r * (o.dark ? 1 : o.iris ?? 0.64);
  k.add(bone, ball(ir, ir * sq, ir * (o.dark ? 0.8 : 0.45), 14, 10), { at: o.dark ? [x, y, z] : at(0.74), rot: [pitch, yaw, o.roll ?? 0], color: o.color || '#3a2414', gloss: 1, mottle: 0 });
  if (!o.dark) {
    const pr = ir * (o.pupil ?? 0.52);
    k.add(bone, ball(o.slit ? pr * 0.35 : pr, pr * (o.slit ? 1.6 : 1) * sq, pr * 0.3, 10, 8), { at: at(0.95), rot: [pitch, yaw, 0], color: '#060406', gloss: 1, mottle: 0 });
  }
  k.add(bone, ball(r * 0.17, r * 0.17, r * 0.1, 8, 6), { at: at(o.dark ? 0.82 : 1.04, 0.32 * sq, -s * 0.18), rot: [pitch, yaw, 0], color: '#ffffff', glow: 0.45, mottle: 0 });
}

export function chain(k, parent, at, dir, n, len, radius, color, curl = [0, 0, 0], o = {}) {
  const bones = [];
  const d = new THREE.Vector3(...dir).normalize();
  const step = len / n;
  const e = new THREE.Euler(curl[0] / n, curl[1] / n, curl[2] / n);
  let b = k.bone(parent, ...at);
  const paint = typeof color === 'function' && color.length === 2 ? color : null;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const dd = d.clone();
    const end = dd.clone().multiplyScalar(step);
    const fn = paint
      ? (x, y, z, c) => paint(clamp01(t0 + clamp01((x * dd.x + y * dd.y + z * dd.z) / step) / n), c)
      : color;
    const g = seg(radius(t0), radius((i + 1) / n), [0, 0, 0], end.toArray(), o.sides ?? 12);
    if (o.fluff) fluff(g, o.fluff, o.fluffFreq ?? 9, i * 3.7);
    k.add(b, g, { color: fn, glow: o.glow ? o.glow(t0) : 0 });
    bones.push(b);
    if (i < n - 1) {
      b = k.bone(b, ...end.toArray());
      d.applyEuler(e);
    } else {
      bones.tip = end.clone();
    }
  }
  return bones;
}

export function quad(k, o) {
  const L = o.len;
  const R = o.r;
  const lr = o.legR;
  const sq = o.squash ?? 0.92;
  const top = o.leg + R * sq * 0.72;
  const body = k.bone(k.root, 0, top, 0);
  const coat = o.coat;
  const bodyGeo = spine(L, R, o.prof);
  if (o.bodyFluff) fluff(bodyGeo, o.bodyFluff, 6, 1.3);
  k.add(body, bodyGeo, { scale: [o.wide ?? 1, sq, 1], color: coat });
  const legs = [];
  const hipY = -R * sq * 0.4;
  const hy = top + hipY;
  for (const [front, s] of [[1, 1], [1, -1], [0, 1], [0, -1]]) {
    const z = front ? L * (o.fz ?? 0.3) : -L * (o.bz ?? 0.3);
    const hip = k.bone(body, s * R * (o.hx ?? 0.55) * (o.wide ?? 1), hipY, z);
    const up = hy * (o.split ?? 0.5);
    const pawH = o.hoof ? lr * 0.55 : lr * 0.7;
    const lo = Math.max(0.01, hy - up - pawH);
    const thick = front ? o.armT ?? 1.6 : o.thighT ?? 1.9;
    const legColor = o.legCoat || coat;
    k.add(hip, limb(lr * thick, lr * 1.05, up), { at: [0, 0, 0], color: legColor });
    const knee = k.bone(hip, 0, -up, 0);
    k.add(knee, limb(lr * 1.05, lr * 0.85, lo), { color: legColor });
    if (o.hoof) k.add(knee, ball(lr * 0.95, pawH, lr * 1.1, 12, 8), { at: [0, -lo, lr * 0.15], color: o.hoof });
    else {
      k.add(knee, ball(lr * 1.15, pawH, lr * 1.55, 12, 8), { at: [0, -lo, lr * 0.45], color: o.paw || legColor });
      if (o.claws) for (const cx of [-0.6, 0, 0.6]) k.add(knee, spike(lr * 0.18, lr * 0.55, [0, -0.5, 1], [cx * lr, -lo - pawH * 0.3, lr * 1.7], 6), { color: o.claws, gloss: 0.5 });
    }
    legs.push({ hip, knee, side: s, front: !!front, lo, up });
  }
  const neck = k.bone(body, 0, R * sq * (o.ny ?? 0.35), L * (o.nz ?? 0.4));
  const nl = o.neck ?? 0.2;
  const tilt = o.tilt ?? 0.6;
  const hp = [0, nl * Math.cos(tilt), nl * Math.sin(tilt)];
  const nr = o.neckR ?? R * 0.5;
  const neckGeo = seg(nr, nr * (o.neckTaper ?? 0.8), [0, -nr * 0.4, -nr * 0.3], hp, 14);
  if (o.neckFluff) fluff(neckGeo, o.neckFluff, 8, 2.2);
  k.add(neck, neckGeo, { color: o.neckCoat || coat });
  const head = k.bone(neck, ...hp);
  const [hw, hh, hl] = o.head;
  k.add(head, ball(hw, hh, hl, 18, 14), { color: o.headCoat || coat });
  let nose = [0, 0, hl];
  if (o.snout) {
    const [sw, sh, sl] = o.snout;
    const sy = -hh * (o.sy ?? 0.3);
    const sz = hl * (o.sz ?? 0.7);
    k.add(head, ball(sw, sh, sl, 14, 10), { at: [0, sy, sz], color: o.snoutCoat || o.headCoat || coat });
    nose = [0, sy + sh * 0.45, sz + sl * 0.92];
    if (o.nose !== false) k.add(head, ball(sw * 0.34, sh * 0.26, sw * 0.24, 10, 8), { at: nose, color: o.nose || '#1a1214', gloss: 0.8, mottle: 0 });
  }
  const er = o.eyeR ?? hw * 0.2;
  for (const s of [1, -1]) eye(k, head, s * hw * (o.ex ?? 0.55), hh * (o.ey ?? 0.2), hl * (o.ez ?? 0.62), er, { ...(o.eye || {}) });
  const ears = [];
  if (o.ears) {
    for (const s of [1, -1]) {
      const eb = k.bone(head, s * hw * (o.earX ?? 0.55), hh * (o.earY ?? 0.7), -hl * (o.earZ ?? 0.1));
      o.ears(k, eb, s);
      ears.push({ b: eb, side: s });
    }
  }
  const tails = [];
  for (const t of o.tails || []) tails.push(chain(k, body, [t.x ?? 0, R * sq * (t.y ?? 0.3), -L * (t.z ?? 0.47)], t.dir, t.n ?? 4, t.len, t.radius, t.color, t.curl, t));
  k.anchor('mouth', head, nose);
  k.anchor('head', head, [0, hh, 0]);
  k.anchor('center', body, [0, 0, 0]);
  k.anchor('back', body, [0, R * sq, 0]);
  k.anchor('tail', body, [0, R * 0.5, -L * 0.6]);
  return { plan: 'quad', body, neck, head, legs, ears, tails, R, L, hip: hy, top };
}

export function biped(k, o) {
  const hy = o.leg;
  const tr = o.r;
  const th = o.h;
  const lean = o.lean ?? 0;
  const body = k.bone(k.root, 0, hy, o.hz ?? 0);
  const torso = egg(tr, th, o.prof);
  if (o.bodyFluff) fluff(torso, o.bodyFluff, 6, 0.7);
  torso.scale(o.wide ?? 1, 1, o.deep ?? 0.85);
  torso.translate(0, -th * (o.drop ?? 0.22), 0);
  torso.rotateX(lean);
  k.add(body, torso, { color: o.coat });
  const cy = th * (o.chestY ?? 0.62);
  const chest = k.bone(body, 0, cy * Math.cos(lean), cy * Math.sin(lean));
  const headAt = o.headAt || [0, th * 0.42, tr * 0.12];
  const head = k.bone(chest, ...headAt);
  const arms = [];
  if (o.arm) {
    const a = o.arm;
    const pairs = a.pairs || [[a.y ?? 0, a.x ?? 0.92]];
    for (const [py, px] of pairs) {
      for (const s of [1, -1]) {
        const sh = k.bone(chest, s * tr * px * (o.wide ?? 1), py, a.z ?? 0);
        const ua = [s * a.out * a.len * 0.5, -a.len * 0.5, a.fwd ?? 0.05];
        k.add(sh, seg(a.r * (a.thick ?? 1.25), a.r, [0, 0, 0], ua), { color: a.color || o.coat });
        const el = k.bone(sh, ...ua);
        const fa = [s * (a.out2 ?? 0.1) * a.len * 0.5, -a.len * 0.48, a.fwd2 ?? a.len * 0.2];
        k.add(el, seg(a.r, a.r * (a.taper ?? 0.85), [0, 0, 0], fa), { color: a.color2 || a.color || o.coat });
        if (a.hand) a.hand(k, el, fa, s);
        else k.add(el, ball(a.r * 1.2, a.r * 1.1, a.r * 1.2, 12, 8), { at: fa, color: a.color2 || a.color || o.coat });
        arms.push({ sh, el, side: s, hand: fa, pair: pairs.findIndex((p) => p[0] === py) });
      }
    }
  }
  const legs = [];
  const lg = o.legs || {};
  for (const s of [1, -1]) {
    const hip = k.bone(body, s * tr * (lg.x ?? 0.48) * (o.wide ?? 1), lg.y ?? 0, lg.z ?? 0);
    const up = hy * (lg.split ?? 0.5);
    const fh = lg.footH ?? lg.r * 0.8;
    const knee = [s * (lg.out ?? 0.04), -up, lg.kz ?? 0.04];
    k.add(hip, seg(lg.r * (lg.thick ?? 1.45), lg.r, [0, 0, 0], knee), { color: lg.color || o.coat });
    const kb = k.bone(hip, ...knee);
    const ankle = [0, -(hy - up - fh), -(lg.kz ?? 0.04)];
    k.add(kb, seg(lg.r, lg.r * (lg.taper ?? 0.85), [0, 0, 0], ankle), { color: lg.color2 || lg.color || o.coat });
    const foot = [0, ankle[1], lg.footZ ?? lg.r * 0.7];
    k.add(kb, ball(lg.r * (lg.footW ?? 1.25), fh, lg.r * (lg.footL ?? 2), 12, 8), { at: foot, color: lg.foot || lg.color2 || lg.color || o.coat });
    if (lg.claws) for (const cx of [-0.7, 0, 0.7]) k.add(kb, spike(lg.r * 0.2, lg.r * 0.6, [0, -0.3, 1], [foot[0] + cx * lg.r, foot[1] - fh * 0.3, foot[2] + lg.r * (lg.footL ?? 2) * 0.9], 6), { color: lg.claws, gloss: 0.5 });
    legs.push({ hip, knee: kb, side: s, front: false, lo: hy - up });
  }
  const tails = [];
  for (const t of o.tails || []) tails.push(chain(k, body, [t.x ?? 0, th * (t.y ?? 0.02), -tr * (t.z ?? 0.75)], t.dir, t.n ?? 5, t.len, t.radius, t.color, t.curl, t));
  k.anchor('head', head, [0, o.headR ?? 0.3, 0]);
  k.anchor('mouth', head, [0, 0, o.headR ?? 0.3]);
  k.anchor('center', chest, [0, 0, 0]);
  k.anchor('back', chest, [0, 0, -tr]);
  k.anchor('hand', chest, [0, -th * 0.2, tr * 1.4]);
  return { plan: 'biped', body, chest, head, arms, legs, tails, hip: hy, R: tr, H: th };
}

export function wingOutline(kind, w, c) {
  if (kind === 'inner') return [[0, c * 0.42], [w, c * 0.4], [w, -c * 0.62], [w * 0.5, -c * 0.7], [0, -c * 0.6]];
  if (kind === 'bat') {
    const p = [[0, c * 0.4], [w * 0.55, c * 0.5], [w, c * 0.1], [w * 0.92, -c * 0.4]];
    const f = 3;
    for (let i = 0; i < f; i++) {
      const x0 = w * (0.92 - (i / f) * 0.9);
      const x1 = w * (0.92 - ((i + 1) / f) * 0.9);
      p.push([(x0 + x1) / 2, -c * (0.12 + i * 0.05)], [x1, -c * (0.6 + (i === f - 1 ? 0.1 : 0))]);
    }
    p.push([0, -c * 0.55]);
    return p;
  }
  if (kind === 'butterfly') {
    const p = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * TAU;
      const r = 1 + 0.18 * Math.cos(a * 2) - 0.12 * Math.cos(a * 3);
      p.push([w * 0.5 + Math.cos(a) * w * 0.5 * r, Math.sin(a) * c * 0.5 * r]);
    }
    return p;
  }
  const p = [[0, c * 0.4], [w * 0.45, c * 0.36], [w * 0.8, c * 0.16], [w, -c * 0.06]];
  const f = kind === 'fingers' ? 6 : 5;
  for (let i = 0; i < f; i++) {
    const x = w * (0.97 - (i / f) * 0.75);
    const xn = w * (0.97 - ((i + 1) / f) * 0.75);
    p.push([x - w * 0.02, -c * (0.32 + i * 0.07)], [xn + w * 0.03, -c * (0.18 + i * 0.07)]);
  }
  p.push([w * 0.15, -c * 0.62], [0, -c * 0.6]);
  return p;
}

export function wingPair(k, body, o) {
  const wings = [];
  for (const s of [1, -1]) {
    const sh = k.bone(body, s * o.x, o.y, o.z ?? 0);
    const wi = o.span * (o.split ?? 0.42);
    const wo = o.span - wi;
    const thick = o.thick ?? 0.025;
    const inner = slab(wingOutline(o.innerKind || 'inner', wi * 1.04, o.chord), thick, thick * 0.4).rotateX(Math.PI / 2);
    const outer = slab(wingOutline(o.kind || 'feather', wo, o.chord * (o.outerChord ?? 1)), thick * 0.8, thick * 0.3).rotateX(Math.PI / 2);
    if (o.droop) {
      warp(inner, (v) => (v.y -= o.droop * v.x * v.x));
      warp(outer, (v) => (v.y -= o.droop * 0.6 * v.x * v.x));
    }
    const ci = o.color ? (x, y, z, c) => o.color(Math.abs(x) / o.span, z, c) : o.colorFlat || '#888888';
    const co = o.color ? (x, y, z, c) => o.color((Math.abs(x) + wi) / o.span, z, c) : o.colorFlat || '#888888';
    k.add(sh, inner, { color: ci, mirror: s < 0, glow: o.glowInner || 0, mottle: o.mottle ?? 1 });
    const el = k.bone(sh, s * wi, 0, 0);
    k.add(el, outer, { color: co, mirror: s < 0, glow: o.glowOuter || 0, mottle: o.mottle ?? 1 });
    if (o.extra) o.extra(k, sh, el, s, wi, wo);
    wings.push({ sh, el, side: s });
  }
  return wings;
}

export function bird(k, o) {
  const body = k.bone(k.root, 0, o.alt ?? 0, 0);
  const R = o.r;
  const L = o.len;
  const bodyGeo = spine(L, R, o.prof || [0.05, 0.55, 0.85, 1, 1, 0.96, 0.85, 0.65, 0.3]);
  if (o.bodyFluff) fluff(bodyGeo, o.bodyFluff, 7, 0.4);
  k.add(body, bodyGeo, { scale: [1, o.squash ?? 0.95, 1], color: o.coat });
  const neck = k.bone(body, 0, R * 0.45, L * 0.38);
  const nl = o.neck ?? R * 0.5;
  const hp = [0, nl * Math.cos(o.tilt ?? 0.7), nl * Math.sin(o.tilt ?? 0.7)];
  k.add(neck, seg(R * 0.52, R * 0.42, [0, -R * 0.3, -R * 0.2], hp, 12), { color: o.neckCoat || o.headCoat || o.coat });
  const head = k.bone(neck, ...hp);
  const hr = o.headR ?? R * 0.55;
  k.add(head, ball(hr, hr * 0.95, hr * 1.1, 16, 12), { color: o.headCoat || o.coat });
  const bl = o.beakLen ?? hr * 0.9;
  k.add(head, cone(o.beakR ?? hr * 0.32, bl, 10).rotateX(Math.PI / 2 + (o.hook ?? 0.15)).translate(0, -hr * 0.15, hr * 0.85), { color: o.beak || '#3a3434', gloss: 0.4 });
  for (const s of [1, -1]) eye(k, head, s * hr * 0.55, hr * 0.25, hr * 0.62, hr * (o.eyeR ?? 0.24), { splay: 0.9, ...(o.eye || {}) });
  const wings = wingPair(k, body, { x: R * 0.75, y: R * 0.35, z: L * 0.12, ...o.wing });
  const tail = k.bone(body, 0, R * 0.15, -L * 0.45);
  if (o.tailFan !== false) {
    const tl = o.tailLen ?? L * 0.55;
    const tw = o.tailW ?? R * 1.2;
    const fan = slab([[-tw * 0.25, 0], [tw * 0.25, 0], [tw * 0.6, -tl * 0.8], [tw * 0.3, -tl], [0, -tl * 0.9], [-tw * 0.3, -tl], [-tw * 0.6, -tl * 0.8]], 0.02, 0.008).rotateX(-Math.PI / 2);
    k.add(tail, fan, { color: o.tailCoat || o.coat });
  }
  for (const s of [1, -1]) {
    k.add(body, seg(R * 0.09, R * 0.07, [s * R * 0.3, -R * 0.6, -L * 0.05], [s * R * 0.32, -R * 1.05, -L * 0.25], 8), { color: o.feet || '#c98a6a' });
    for (const a of [-0.4, 0, 0.4]) k.add(body, spike(R * 0.04, R * 0.22, [Math.sin(a), -0.6, -1], [s * R * 0.32, -R * 1.05, -L * 0.25], 5), { color: o.claw || '#2a2420' });
  }
  k.anchor('mouth', head, [0, -hr * 0.15, hr * 0.85 + bl]);
  k.anchor('head', head, [0, hr, 0]);
  k.anchor('center', body, [0, 0, 0]);
  k.anchor('back', body, [0, R, 0]);
  k.anchor('tail', body, [0, 0, -L * 0.8]);
  return { plan: 'bird', body, neck, head, wings, tails: [[tail]], R, L, hip: R };
}

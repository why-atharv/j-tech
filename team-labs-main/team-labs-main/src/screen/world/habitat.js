import * as THREE from 'three';
import { ARENA_RADIUS } from '../../shared/engine.js';
import { runtime } from './atmosphere.js';

export const DOME_CAMERA = new THREE.Vector3(0, 3.4, 24);
const DOME_ARC = THREE.MathUtils.degToRad(72);
const DOME_NEAR = 7;
const DOME_FAR = 24;
const MIN_GAP = THREE.MathUtils.degToRad(4);
const LANE = 2.2;
const DEPTH_GAP = 3.5;
const SPACING = 3.2;
const SKY_SPACING = 10;
const ROAM_MIN = 7;
const ROAM_MAX = 26;
const recent = [];
const goal = { x: 0, z: 0 };

export const habitat = {
  mode: 'dome',
  fovH: 160,

  randomPoint(rng, out = new THREE.Vector2()) {
    if (this.mode === 'dome') {
      const arc = Math.min(DOME_ARC, THREE.MathUtils.degToRad(this.fovH / 2 - 8));
      const a = (rng() * 2 - 1) * arc;
      const d = DOME_NEAR + Math.sqrt(rng()) * (DOME_FAR - DOME_NEAR);
      return out.set(DOME_CAMERA.x + Math.sin(a) * d, DOME_CAMERA.z - Math.cos(a) * d);
    }
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * ARENA_RADIUS;
    return out.set(Math.cos(a) * r, Math.sin(a) * r);
  },

  arc() {
    return Math.min(DOME_ARC, THREE.MathUtils.degToRad(this.fovH / 2 - 8));
  },

  polar(x, z) {
    const ox = x - DOME_CAMERA.x;
    const oz = z - DOME_CAMERA.z;
    return { a: Math.atan2(ox, -oz), d: Math.hypot(ox, oz) };
  },

  fromPolar(a, d, out) {
    return out.set(DOME_CAMERA.x + Math.sin(a) * d, DOME_CAMERA.z - Math.cos(a) * d);
  },

  crowd(x, z, self) {
    const p = this.polar(x, z);
    let score = Infinity;
    const check = (id, m) => {
      if (id === self) return;
      const q = this.polar(m.x, m.z);
      const gap = Math.max(MIN_GAP, LANE / Math.min(p.d, q.d));
      const s = Math.max(Math.hypot((p.a - q.a) / gap, (p.d - q.d) / DEPTH_GAP), Math.hypot(x - m.x, z - m.z) / SPACING);
      if (s < score) score = s;
    };
    for (const [id, m] of runtime.movers) if (m.w > 0) check(id, m);
    for (const r of recent) check(r.id, r);
    for (const [id, g] of runtime.goals) {
      goal.x = g.x;
      goal.z = g.y;
      check(id, goal);
    }
    return score;
  },

  spawnPoint(rng, out = new THREE.Vector2(), self) {
    if (this.mode !== 'dome') return this.randomPoint(rng, out);
    const arc = this.arc() - 0.04;
    const now = performance.now();
    while (recent.length && now - recent[0].t > 4000) recent.shift();
    const probe = new THREE.Vector2();
    let best = -1;
    for (let i = 0; i < 48; i++) {
      const a = (rng() * 2 - 1) * arc;
      const d = DOME_NEAR + 1.4 + rng() * (DOME_FAR - DOME_NEAR - 2.8);
      this.fromPolar(a, d, probe);
      const score = this.crowd(probe.x, probe.y, self);
      if (score > best) {
        best = score;
        out.copy(probe);
      }
      if (score >= 1.15) break;
    }
    recent.push({ id: self, x: out.x, z: out.y, t: now });
    return out;
  },

  roamPoint(rng, x, z, out = new THREE.Vector2(), self) {
    if (this.mode !== 'dome') return this.randomPoint(rng, out);
    const arc = this.arc() - 0.04;
    const probe = new THREE.Vector2();
    let best = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (rng() * 2 - 1) * arc;
      const d = DOME_NEAR + 1.4 + rng() * (DOME_FAR - DOME_NEAR - 2.8);
      this.fromPolar(a, d, probe);
      const far = Math.hypot(probe.x - x, probe.y - z);
      if (far < ROAM_MIN || far > ROAM_MAX) continue;
      const score = Math.min(this.crowd(probe.x, probe.y, self), 2) + rng() * 0.4;
      if (score > best) {
        best = score;
        out.copy(probe);
      }
      if (score >= 1.4) break;
    }
    if (best === -Infinity) this.spawnPoint(rng, out, self);
    return out;
  },

  skyPoint(rng, out = new THREE.Vector2(), self) {
    const probe = new THREE.Vector2();
    let best = -1;
    for (let i = 0; i < 24; i++) {
      this.randomPoint(rng, probe);
      if (this.mode === 'dome' && Math.hypot(probe.x - DOME_CAMERA.x, probe.y - DOME_CAMERA.z) < 15) continue;
      let score = Infinity;
      for (const [id, c] of runtime.skies) if (id !== self) score = Math.min(score, Math.hypot(probe.x - c.x, probe.y - c.y));
      if (score > best) {
        best = score;
        out.copy(probe);
      }
      if (score >= SKY_SPACING) break;
    }
    if (best < 0) this.randomPoint(rng, out);
    return out;
  },

  edgeForce(x, z, out = new THREE.Vector2()) {
    out.set(0, 0);
    if (this.mode === 'dome') {
      const ox = x - DOME_CAMERA.x;
      const oz = z - DOME_CAMERA.z;
      const d = Math.hypot(ox, oz) || 1e-3;
      const a = Math.atan2(ox, -oz);
      const arc = Math.min(DOME_ARC, THREE.MathUtils.degToRad(this.fovH / 2 - 8));
      const near = DOME_NEAR + 1.5;
      const far = DOME_FAR - 1.5;
      if (d < near) out.set(ox / d, oz / d).multiplyScalar(near - d);
      if (d > far) out.set(ox / d, oz / d).multiplyScalar(far - d);
      const excess = Math.abs(a) - (arc - 0.08);
      if (excess > 0) {
        const s = -Math.sign(a) * excess * d;
        out.x += Math.cos(a) * s;
        out.y += Math.sin(a) * s;
      }
      return out;
    }
    const r = Math.hypot(x, z);
    if (r > ARENA_RADIUS - 1.5) out.set(-x, -z).normalize().multiplyScalar(r - (ARENA_RADIUS - 1.5));
    return out;
  }
};

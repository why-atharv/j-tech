import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const fxConfig = { px: 300, scale: 1 };

const GEO = {};
const geo = (k, make) => (GEO[k] ||= make());

function unitDir(mode, dir, spread) {
  if (mode === 'sphere') return V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
  if (mode === 'ring') {
    const a = Math.random() * Math.PI * 2;
    return V(Math.cos(a), rnd(-0.08, 0.15), Math.sin(a)).normalize();
  }
  const d = (dir || V(0, 1, 0)).clone().normalize();
  const s = spread ?? 0.3;
  const t = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(s);
  return d.add(t).normalize();
}

const PVERT = `
uniform float uT; uniform float uLife; uniform float uSize; uniform float uPx; uniform float uDrag; uniform vec3 uG; uniform float uSwirl; uniform vec3 uAxis;
attribute vec3 aVel; attribute vec2 aSeed; varying float vA; varying float vT;
void main() {
  float t = uT - aSeed.x;
  if (t < 0.0 || t > uLife) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vT = 0.0; return; }
  float d = max(uDrag, 0.001);
  vec3 p = position + aVel * (1.0 - exp(-d * t)) / d + 0.5 * uG * t * t;
  if (uSwirl != 0.0) { vec3 q = p - uAxis; float a = uSwirl * t * (0.7 + aSeed.y * 0.6); float c = cos(a); float s = sin(a); q.xz = mat2(c, -s, s, c) * q.xz; p = q + uAxis; }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vT = t / uLife;
  vA = 1.0 - vT;
  gl_PointSize = uSize * uPx * (0.35 + 0.65 * vA) * (0.6 + aSeed.y * 0.8) / max(0.05, -mv.z);
}`;

const PFRAG = `
uniform vec3 uC0; uniform vec3 uC1; uniform float uBright; varying float vA; varying float vT;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA;
  vec3 col = mix(uC0, uC1, vT);
  gl_FragColor = vec4(mix(col, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.6) * uBright * a, a);
}`;

function particles(o) {
  const n = Math.max(1, Math.round(o.count * fxConfig.scale));
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const seed = new Float32Array(n * 2);
  const from = o.from || V();
  const froms = o.froms;
  for (let i = 0; i < n; i++) {
    const f = froms ? froms[i % froms.length] : from;
    const j = o.jitter ? V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(o.jitter) : V();
    let p = f.clone().add(j);
    let d = unitDir(o.mode, o.dirs ? o.dirs[i % o.dirs.length] : o.dir, o.spread);
    if (o.mode === 'ring' && o.radius) {
      p = f.clone().add(V(d.x, 0, d.z).normalize().multiplyScalar(o.radius)).add(j);
      if (o.tangent) d = V(-d.z, rnd(0.1, 0.6), d.x).normalize();
    }
    if (o.mode === 'line') {
      const t = Math.random();
      p = f.clone().lerp(o.to, t).add(j);
      d = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
    }
    const sp = rnd(o.speed[0], o.speed[1]);
    pos.set([p.x, p.y, p.z], i * 3);
    vel.set([d.x * sp, d.y * sp, d.z * sp], i * 3);
    seed[i * 2] = (o.delay || 0) + (o.stream ? Math.random() * o.stream : Math.random() * 0.06);
    seed[i * 2 + 1] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uT: { value: 0 },
      uLife: { value: o.life || 1 },
      uSize: { value: o.size || 0.1 },
      uPx: { value: fxConfig.px },
      uDrag: { value: o.drag ?? 1.2 },
      uG: { value: o.gravity || V(0, -0.5, 0) },
      uSwirl: { value: o.swirl || 0 },
      uAxis: { value: o.axis || from.clone() },
      uC0: { value: new THREE.Color(o.c0 || '#ffffff') },
      uC1: { value: new THREE.Color(o.c1 || o.c0 || '#ffffff') },
      uBright: { value: o.bright ?? 3 }
    },
    vertexShader: PVERT,
    fragmentShader: PFRAG
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  const end = (o.delay || 0) + (o.stream || 0) + (o.life || 1) + 0.1;
  return {
    obj: pts,
    end,
    update(t) {
      m.uniforms.uT.value = t;
      m.uniforms.uPx.value = fxConfig.px;
    },
    dispose() {
      g.dispose();
      m.dispose();
    }
  };
}

function basic(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
}

function shock(o) {
  const mesh = new THREE.Mesh(geo('ring', () => new THREE.RingGeometry(0.82, 1, 48)), basic(o.color, 0));
  if (o.normal) mesh.quaternion.setFromUnitVectors(V(0, 0, 1), o.normal.clone().normalize());
  else mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(o.at || V());
  const dur = o.dur || 0.9;
  const delay = o.delay || 0;
  return {
    obj: mesh,
    end: delay + dur,
    update(t) {
      const k = clamp01((t - delay) / dur);
      mesh.visible = t >= delay && k < 1;
      const e = 1 - Math.pow(1 - k, 3);
      mesh.scale.setScalar((o.r0 ?? 0.1) + e * (o.r1 - (o.r0 ?? 0.1)));
      mesh.material.opacity = (1 - k) * (o.alpha ?? 0.9);
    },
    dispose() {
      mesh.material.dispose();
    }
  };
}

const GLOW_V = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const GLOW_F = `uniform vec3 uColor; uniform float uA; uniform float uCore; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float a = (f + uCore) * uA; gl_FragColor = vec4(uColor * 2.6 * a, a); }`;

function orb(o) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(o.color) }, uA: { value: 0 }, uCore: { value: o.core ?? 0.25 } },
    vertexShader: GLOW_V,
    fragmentShader: GLOW_F
  });
  const mesh = new THREE.Mesh(geo('sphere', () => new THREE.SphereGeometry(1, 24, 16)), m);
  const delay = o.delay || 0;
  const dur = o.dur || 1.2;
  return {
    obj: mesh,
    end: delay + dur,
    update(t) {
      const k = clamp01((t - delay) / dur);
      mesh.visible = t >= delay && k < 1;
      const grow = o.grow ? 1 - Math.pow(1 - clamp01(k / 0.3), 3) : 1;
      const pulse = 1 + Math.sin(t * (o.pulse || 10)) * 0.08;
      mesh.scale.setScalar(o.r * grow * pulse * (o.expand ? 1 + k * o.expand : 1));
      const p = o.path ? o.path(k) : o.at || V();
      mesh.position.copy(p);
      m.uniforms.uA.value = (k < 0.15 ? k / 0.15 : 1) * (1 - smoothEnd(k, o.fade ?? 0.7)) * (o.alpha ?? 1);
    },
    dispose() {
      m.dispose();
    }
  };
}

const smoothEnd = (k, from) => (k < from ? 0 : (k - from) / (1 - from));

const BEAM_F = `uniform vec3 uColor; uniform float uA; uniform float uT; varying vec2 vUv; void main(){ float edge = 0.6 + 0.4 * sin(vUv.x * 6.2831); float streak = 0.7 + 0.3 * sin(vUv.y * 40.0 - uT * 30.0); float a = uA * streak * edge; gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * 3.0 * a, a); }`;

function beam(o) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(o.color) }, uA: { value: 0 }, uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: BEAM_F
  });
  const mesh = new THREE.Mesh(geo('beam', () => new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0)), m);
  mesh.position.copy(o.from);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), o.dir.clone().normalize());
  const delay = o.delay || 0;
  const dur = o.dur || 1.2;
  return {
    obj: mesh,
    end: delay + dur,
    update(t) {
      const k = clamp01((t - delay) / dur);
      mesh.visible = t >= delay && k < 1;
      const grow = clamp01(k / 0.25);
      const w = o.r * (1 + Math.sin(t * 40) * 0.12) * (1 - smoothEnd(k, 0.75));
      mesh.scale.set(Math.max(0.0001, w), o.len * grow, Math.max(0.0001, w));
      m.uniforms.uT.value = t;
      m.uniforms.uA.value = (1 - smoothEnd(k, 0.7)) * (o.alpha ?? 0.9);
    },
    dispose() {
      m.dispose();
    }
  };
}

function bolts(o) {
  const segs = o.segs || 8;
  const lines = o.lines;
  const count = lines.length * segs;
  const m = basic(o.color, 0.95);
  const mesh = new THREE.InstancedMesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m, count);
  mesh.frustumCulled = false;
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = V();
  const delay = o.delay || 0;
  const dur = o.dur || 1;
  let last = -1;
  const regen = () => {
    let idx = 0;
    for (const [a, b] of lines) {
      const pts = [a.clone()];
      const len = a.distanceTo(b);
      for (let i = 1; i < segs; i++) {
        const p = a.clone().lerp(b, i / segs);
        p.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(len * (o.jag ?? 0.12)));
        pts.push(p);
      }
      pts.push(b.clone());
      for (let i = 0; i < segs; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const d = p1.clone().sub(p0);
        const l = d.length() || 0.0001;
        q.setFromUnitVectors(V(0, 1, 0), d.normalize());
        s.set(o.thick, l, o.thick);
        mat.compose(p0.clone().lerp(p1, 0.5), q, s);
        mesh.setMatrixAt(idx++, mat);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  regen();
  return {
    obj: mesh,
    end: delay + dur,
    update(t) {
      const k = (t - delay) / dur;
      mesh.visible = t >= delay && k < 1 && Math.random() > 0.12;
      if (!mesh.visible) return;
      if (t - last > 0.05) {
        last = t;
        regen();
      }
      m.opacity = 1 - clamp01((k - 0.6) / 0.4);
    },
    dispose() {
      m.dispose();
      mesh.dispose();
    }
  };
}

function arc(o) {
  const angle = o.angle || 2.4;
  const key = `arc${angle.toFixed(2)}`;
  const mesh = new THREE.Mesh(geo(key, () => new THREE.TorusGeometry(1, 0.06, 6, 36, angle)), basic(o.color, 0));
  const holder = new THREE.Group();
  holder.add(mesh);
  holder.position.copy(o.at);
  if (o.normal) holder.quaternion.setFromUnitVectors(V(0, 0, 1), o.normal.clone().normalize());
  if (o.roll) holder.rotateZ(o.roll);
  const delay = o.delay || 0;
  const dur = o.dur || 0.5;
  return {
    obj: holder,
    end: delay + dur,
    update(t) {
      const k = clamp01((t - delay) / dur);
      holder.visible = t >= delay && k < 1;
      mesh.rotation.z = -angle / 2 + (k - 0.5) * (o.sweep ?? 1.4);
      holder.scale.setScalar(o.r * (0.8 + k * 0.4));
      if (o.travel) holder.position.copy(o.at).addScaledVector(o.travel, k);
      mesh.material.opacity = (1 - k) * 0.95;
    },
    dispose() {
      mesh.material.dispose();
    }
  };
}

function rocks(o) {
  const n = o.count || 6;
  const m = new THREE.MeshStandardMaterial({ color: o.color || '#8a7a6a', emissive: o.glow || '#ffd080', emissiveIntensity: 0.6, roughness: 0.9, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), m, n);
  mesh.frustumCulled = false;
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const seeds = Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2, s: rnd(0.7, 1.3), r: rnd(0, 6) }));
  const delay = o.delay || 0;
  const dur = o.dur || 2;
  return {
    obj: mesh,
    end: delay + dur,
    update(t) {
      const k = clamp01((t - delay) / dur);
      mesh.visible = t >= delay && k < 1;
      seeds.forEach((sd, i) => {
        const orbit = k < 0.6;
        const a = sd.a + t * 3;
        let p;
        if (orbit) p = o.center.clone().add(V(Math.cos(a) * o.radius, (k / 0.6) * o.rise, Math.sin(a) * o.radius));
        else {
          const f = (k - 0.6) / 0.4;
          p = o.center.clone().add(V(Math.cos(sd.a) * o.radius, o.rise, Math.sin(sd.a) * o.radius)).addScaledVector(o.throwDir || V(0, 0, 1), f * o.throwLen);
        }
        e.set(t * 3 + sd.r, t * 2 + sd.r, 0);
        q.setFromEuler(e);
        mat.compose(p, q, V(1, 1, 1).multiplyScalar(o.size * sd.s * (1 - clamp01((k - 0.85) / 0.15))));
        mesh.setMatrixAt(i, mat);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      m.dispose();
      mesh.dispose();
    }
  };
}

function drill(o) {
  const mesh = new THREE.Mesh(geo('drill', () => new THREE.ConeGeometry(1, 2.4, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.2)), basic(o.color, 0));
  mesh.position.copy(o.at);
  if (o.dir) mesh.quaternion.setFromUnitVectors(V(0, 0, 1), o.dir.clone().normalize());
  const holder = new THREE.Group();
  holder.add(mesh);
  const delay = o.delay || 0;
  const dur = o.dur || 1.4;
  return {
    obj: holder,
    end: delay + dur,
    update(t) {
      const k = clamp01((t - delay) / dur);
      mesh.visible = t >= delay && k < 1;
      mesh.rotateOnAxis(V(0, 0, 1), 0.6);
      mesh.scale.setScalar(o.r * clamp01(k * 4));
      mesh.material.opacity = (1 - smoothEnd(k, 0.7)) * 0.75;
    },
    dispose() {
      mesh.material.dispose();
    }
  };
}

let zTex = null;
function zzzTexture() {
  if (zTex) return zTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.font = 'bold 100px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#7fd0ff';
  g.shadowBlur = 16;
  g.fillText('Z', 64, 68);
  zTex = new THREE.CanvasTexture(c);
  return zTex;
}

function zzz(o) {
  const group = new THREE.Group();
  const sprites = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
    group.add(s);
    return { s, d: i * 0.9 };
  });
  const dur = o.dur || 3;
  return {
    obj: group,
    end: dur,
    update(t) {
      for (const { s, d } of sprites) {
        const k = ((t - d) % 2.6) / 2.6;
        const on = t >= d;
        s.visible = on;
        s.position.copy(o.at).add(V(Math.sin(k * 6) * o.size * 0.4 + k * o.size, k * o.size * 3, 0));
        s.scale.setScalar(o.size * (0.5 + k * 0.8));
        s.material.opacity = on ? Math.sin(k * Math.PI) : 0;
      }
    },
    dispose() {
      sprites.forEach(({ s }) => s.material.dispose());
    }
  };
}

const FIRE0 = '#fff1a0';
const FIRE1 = '#ff3a0a';

function A(r, name, fallback = 'mouth') {
  return (r.anchors[name] || r.anchors[fallback] || r.anchors.center || V()).clone();
}

const RECIPES = {
  ember: (r, H) => {
    const m = A(r, 'mouth');
    return [particles({ from: m, dir: V(0, 0.15, 1), spread: 0.35, speed: [1.4 * H, 2.6 * H], count: 70, stream: 0.9, life: 0.75, size: 0.09 * H, c0: FIRE0, c1: FIRE1, gravity: V(0, 0.8 * H, 0), drag: 1.5 }), orb({ at: m, r: 0.1 * H, color: '#ff8a2a', dur: 1.1 })];
  },
  flamewheel: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, mode: 'ring', radius: 0.6 * H, tangent: true, speed: [0.2 * H, 0.4 * H], count: 160, stream: 1.4, life: 0.7, size: 0.12 * H, c0: FIRE0, c1: FIRE1, swirl: 7, axis: c, gravity: V(0, 0.5 * H, 0) }), shock({ at: V(0, 0.05, 0), r1: 1.2 * H, color: '#ff7a2a', dur: 1.1 })];
  },
  quick: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, dir: V(0, 0, -1), spread: 0.15, jitter: 0.2 * H, speed: [2 * H, 3.4 * H], count: 90, stream: 1, life: 0.6, size: 0.08 * H, c0: '#ffffff', c1: '#9ad8ff', gravity: V(), drag: 0.5 }), shock({ at: c, normal: V(0, 0, 1), r1: 0.8 * H, color: '#ffffff', dur: 0.5 })];
  },
  peck: (r, H) => {
    const m = A(r, 'mouth');
    const out = [];
    for (let i = 0; i < 6; i++) {
      const p = m.clone().add(V(rnd(-0.15, 0.15) * H, rnd(-0.1, 0.1) * H, 0.25 * H));
      out.push(particles({ from: p, mode: 'sphere', speed: [0.6 * H, 1.2 * H], count: 10, delay: i * 0.14, life: 0.3, size: 0.07 * H, c0: '#ffffff', c1: '#ffe080', gravity: V() }));
      out.push(shock({ at: p, normal: V(0, 0, 1), r1: 0.25 * H, color: '#fff3c0', dur: 0.25, delay: i * 0.14 }));
    }
    return out;
  },
  shock: (r, H) => {
    const c = A(r, 'center');
    const lines = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      lines.push([c.clone().add(V(Math.cos(a) * 0.2 * H, rnd(-0.2, 0.3) * H, Math.sin(a) * 0.2 * H)), c.clone().add(V(Math.cos(a) * 0.7 * H, rnd(-0.3, 0.5) * H, Math.sin(a) * 0.7 * H))]);
    }
    return [bolts({ lines, thick: 0.02 * H, color: '#fff27a', dur: 1.3 }), particles({ from: c, mode: 'sphere', jitter: 0.3 * H, speed: [0.5 * H, 1.5 * H], count: 60, stream: 1, life: 0.4, size: 0.06 * H, c0: '#ffffff', c1: '#ffd400', gravity: V() }), orb({ at: c, r: 0.65 * H, color: '#ffe23a', dur: 1.3, core: 0, alpha: 0.6 })];
  },
  chop: (r, H) => {
    const h = A(r, 'mouth');
    const p = h.add(V(0, 0.1 * H, 0.35 * H));
    return [arc({ at: p, normal: V(1, 0, 0), r: 0.45 * H, color: '#ffb36a', dur: 0.45, angle: 2.2 }), shock({ at: p, normal: V(0, 0, 1), r1: 0.6 * H, color: '#ffffff', dur: 0.4, delay: 0.2 }), particles({ from: p, mode: 'sphere', speed: [1 * H, 2 * H], count: 40, delay: 0.2, life: 0.4, size: 0.07 * H, c0: '#ffffff', c1: '#ff9a3a' })];
  },
  curl: (r, H) => [particles({ from: V(0, 0.05, 0), mode: 'ring', radius: 0.3 * H, speed: [0.8 * H, 1.6 * H], count: 70, stream: 0.8, life: 0.9, size: 0.12 * H, c0: '#e8d0a0', c1: '#8a6a40', gravity: V(0, 0.3 * H, 0), bright: 0.9 }), shock({ at: V(0, 0.04, 0), r1: 1.1 * H, color: '#f0d890', dur: 0.8 })],
  thunderbolt: (r, H) => {
    const ch = A(r, 'cheek');
    const ch2 = ch.clone();
    ch2.x *= -1;
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const from = i % 2 ? ch : ch2;
      lines.push([from, from.clone().add(V(rnd(-1, 1) * 0.9 * H, rnd(0.2, 1.4) * H, rnd(0.3, 1.4) * H))]);
    }
    return [bolts({ lines, thick: 0.025 * H, color: '#fff36a', dur: 1.5, segs: 10, jag: 0.15 }), orb({ at: ch, r: 0.16 * H, color: '#ffd400', dur: 1.5 }), orb({ at: ch2, r: 0.16 * H, color: '#ffd400', dur: 1.5 }), particles({ from: A(r, 'center'), mode: 'sphere', jitter: 0.4 * H, speed: [0.6 * H, 1.6 * H], count: 70, stream: 1.2, life: 0.35, size: 0.07 * H, c0: '#ffffff', c1: '#ffe000', gravity: V() })];
  },
  horn: (r, H) => {
    const m = A(r, 'mouth');
    return [particles({ from: V(0, 0.05, -0.2 * H), dir: V(0, 0.6, -1), spread: 0.6, jitter: 0.3 * H, speed: [0.6 * H, 1.4 * H], count: 70, stream: 1, life: 1, size: 0.14 * H, c0: '#d8c49a', c1: '#7a6a50', bright: 0.8, gravity: V(0, -0.2, 0) }), orb({ at: m, r: 0.15 * H, color: '#ffffff', dur: 1, pulse: 20 }), shock({ at: m, normal: V(0, 0, 1), r1: 0.7 * H, color: '#ffffff', dur: 0.6, delay: 0.5 })];
  },
  watergun: (r, H) => {
    const m = A(r, 'mouth');
    return [particles({ from: m, dir: V(0, 0.35, 1), spread: 0.08, speed: [2.6 * H, 3 * H], count: 150, stream: 1.3, life: 0.9, size: 0.09 * H, c0: '#e0f6ff', c1: '#2a8aff', gravity: V(0, -3.5 * H, 0), drag: 0.2, bright: 2.2 }), shock({ at: V(0, 0.05, 1.9 * H), r1: 0.7 * H, color: '#6ac8ff', dur: 0.6, delay: 0.6 }), shock({ at: V(0, 0.05, 1.9 * H), r1: 0.5 * H, color: '#bfeaff', dur: 0.6, delay: 1.1 })];
  },
  gust: (r, H) => {
    const base = V(0, 0.05, 1.2 * H);
    return [particles({ from: base, mode: 'ring', radius: 0.35 * H, tangent: true, speed: [0.3 * H, 0.6 * H], count: 160, stream: 1.6, life: 1, size: 0.08 * H, c0: '#ffffff', c1: '#b8f0d8', swirl: 9, axis: base, gravity: V(0, 2.2 * H, 0), drag: 0.5, bright: 1.6 }), shock({ at: base, r1: 1 * H, color: '#d8fff0', dur: 1.2 })];
  },
  peckfast: (r, H) => RECIPES.peck(r, H),
  slash: (r, H) => {
    const p = A(r, 'leek', 'mouth').add(V(0, 0, 0.3 * H));
    return [arc({ at: p, normal: V(1, 0.3, 0), r: 0.6 * H, color: '#7cff6a', dur: 0.5, angle: 2.6 }), arc({ at: p, normal: V(1, -0.3, 0), r: 0.55 * H, color: '#b8ffa0', dur: 0.5, delay: 0.35, angle: 2.4 }), particles({ from: p, mode: 'sphere', speed: [0.8 * H, 1.6 * H], count: 40, delay: 0.2, life: 0.5, size: 0.06 * H, c0: '#ffffff', c1: '#5aff5a' })];
  },
  silverwind: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, mode: 'sphere', jitter: 0.4 * H, speed: [0.4 * H, 1.2 * H], count: 160, stream: 1.5, life: 1.6, size: 0.06 * H, c0: '#ffffff', c1: '#a8c8ff', swirl: 2.5, axis: c, gravity: V(0, -0.3 * H, 0), drag: 0.8, bright: 2.4 })];
  },
  wisp: (r, H) => {
    const c = A(r, 'center');
    const out = [];
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2;
      const path = (k) => c.clone().add(V(Math.cos(a0 + k * 9) * 0.75 * H, 0.2 * H + Math.sin(k * 12 + i) * 0.15 * H, Math.sin(a0 + k * 9) * 0.75 * H));
      out.push(orb({ r: 0.13 * H, color: '#4aa8ff', dur: 2.4, path, core: 0.6, pulse: 14 }));
    }
    out.push(particles({ from: c, mode: 'ring', radius: 0.75 * H, tangent: true, speed: [0.1 * H, 0.3 * H], count: 110, stream: 2.2, life: 0.6, size: 0.08 * H, c0: '#e8f8ff', c1: '#2a5aff', swirl: 9, axis: c, gravity: V(0, 0.8 * H, 0) }));
    return out;
  },
  firespin: (r, H) => {
    const c = V(0, 0.05, 0);
    return [particles({ from: c, mode: 'ring', radius: 0.8 * H, tangent: true, speed: [0.2 * H, 0.5 * H], count: 220, stream: 1.6, life: 0.9, size: 0.14 * H, c0: FIRE0, c1: FIRE1, swirl: 8, axis: c, gravity: V(0, 1.8 * H, 0), drag: 0.6 }), shock({ at: c, r1: 1.5 * H, color: '#ff8a2a', dur: 1.3 })];
  },
  flameburst: (r, H) => {
    const m = A(r, 'mouth');
    const end = m.clone().add(V(0, 0.2 * H, 2 * H));
    return [orb({ r: 0.18 * H, color: '#ff8a1a', dur: 0.7, path: (k) => m.clone().lerp(end, k), core: 0.8, fade: 0.95 }), particles({ from: end, mode: 'sphere', speed: [1.2 * H, 2.4 * H], count: 110, delay: 0.65, life: 0.7, size: 0.12 * H, c0: FIRE0, c1: FIRE1, gravity: V(0, 0.6 * H, 0) }), shock({ at: end, normal: V(0, 0, 1), r1: 0.9 * H, color: '#ffb03a', dur: 0.5, delay: 0.65 })];
  },
  xscissor: (r, H) => {
    const p = A(r, 'center').add(V(0, 0.15 * H, 0.6 * H));
    return [arc({ at: p, normal: V(0, 0, 1), roll: 0.8, r: 0.6 * H, color: '#8aff4a', dur: 0.55, angle: 1.4, sweep: 0.6 }), arc({ at: p, normal: V(0, 0, 1), roll: -0.8 + Math.PI, r: 0.6 * H, color: '#8aff4a', dur: 0.55, angle: 1.4, sweep: 0.6, delay: 0.1 }), shock({ at: p, normal: V(0, 0, 1), r1: 0.8 * H, color: '#d8ffb0', dur: 0.4, delay: 0.3 }), particles({ from: p, mode: 'sphere', speed: [1 * H, 2 * H], count: 50, delay: 0.3, life: 0.4, size: 0.06 * H, c0: '#ffffff', c1: '#7aff3a' })];
  },
  megapunch: (r, H) => {
    const p = A(r, 'hand').add(V(0, 0, 0.2 * H));
    return [orb({ at: p, r: 0.22 * H, color: '#ffd080', dur: 0.6, core: 0.8, grow: true }), shock({ at: p, normal: V(0, 0, 1), r1: 0.9 * H, color: '#ffffff', dur: 0.45, delay: 0.3 }), shock({ at: V(0, 0.05, 0.4 * H), r1: 1.3 * H, color: '#ffc060', dur: 0.8, delay: 0.3 }), particles({ from: p, mode: 'sphere', speed: [1.2 * H, 2.4 * H], count: 60, delay: 0.3, life: 0.45, size: 0.08 * H, c0: '#ffffff', c1: '#ff8a3a' })];
  },
  waterpulse: (r, H) => {
    const c = A(r, 'center');
    return [0, 0.35, 0.7].map((d) => shock({ at: V(0, c.y * 0.6, 0), r1: 1.6 * H, color: '#4ab8ff', dur: 1, delay: d })).concat([orb({ at: c, r: 0.5 * H, color: '#5ac8ff', dur: 1.4, core: 0.1, expand: 0.8 }), particles({ from: c, mode: 'ring', speed: [1 * H, 1.8 * H], count: 80, stream: 0.8, life: 0.8, size: 0.08 * H, c0: '#ffffff', c1: '#2a8aff', gravity: V(0, -1.5 * H, 0) })]);
  },
  horndrill: (r, H) => {
    const h = A(r, 'horn', 'mouth');
    return [drill({ at: h, dir: V(0, 0.4, 1), r: 0.12 * H, color: '#ffffff', dur: 1.5 }), particles({ from: h, mode: 'sphere', speed: [0.8 * H, 1.8 * H], count: 90, stream: 1.3, life: 0.35, size: 0.06 * H, c0: '#ffffff', c1: '#ffcc6a', gravity: V(0, -1 * H, 0) })];
  },
  eggbomb: (r, H) => {
    const top = A(r, 'head').add(V(0, 0.6 * H, 0.6 * H));
    return [particles({ from: top, mode: 'sphere', jitter: 0.6 * H, speed: [0.2 * H, 0.5 * H], count: 60, stream: 1, life: 1.2, size: 0.16 * H, c0: '#fff6a0', c1: '#7aff5a', gravity: V(0, -2.4 * H, 0), drag: 0.3 }), shock({ at: V(0, 0.05, 0.8 * H), r1: 1.1 * H, color: '#c8ff6a', dur: 0.6, delay: 0.9 }), shock({ at: V(0.4 * H, 0.05, 0.5 * H), r1: 0.8 * H, color: '#fff08a', dur: 0.6, delay: 1.2 })];
  },
  earthquake: (r, H) => [shock({ at: V(0, 0.05, 0), r1: 2.6 * H, color: '#d8a060', dur: 1.2, alpha: 1 }), shock({ at: V(0, 0.05, 0), r1: 1.8 * H, color: '#ffcf8a', dur: 1, delay: 0.25 }), particles({ from: V(0, 0.05, 0), mode: 'ring', radius: 0.5 * H, speed: [1 * H, 2.2 * H], count: 120, stream: 0.5, life: 1.1, size: 0.14 * H, c0: '#c8a070', c1: '#5a4630', gravity: V(0, -2 * H, 0), bright: 0.9 }), rocks({ center: V(0, 0, 0), radius: 0.9 * H, rise: 0.6 * H, throwDir: V(0, 1, 0), throwLen: 0.4 * H, size: 0.08 * H, count: 8, dur: 1.4, color: '#7a6a5a', glow: '#3a2a1a' })],
  takedown: (r, H) => [particles({ from: V(0, 0.1, -0.3 * H), dir: V(0, 0.5, -1), spread: 0.7, jitter: 0.4 * H, speed: [0.6 * H, 1.4 * H], count: 90, stream: 1.2, life: 1, size: 0.16 * H, c0: '#e8d0a8', c1: '#7a6a50', bright: 0.8 }), shock({ at: A(r, 'mouth').add(V(0, 0, 0.3 * H)), normal: V(0, 0, 1), r1: 1.1 * H, color: '#ffffff', dur: 0.5, delay: 0.7 })],
  superpower: (r, H) => {
    const c = A(r, 'center');
    return [orb({ at: c, r: 0.8 * H, color: '#4a8aff', dur: 1.6, core: 0.05, alpha: 0.8, grow: true }), shock({ at: V(0, 0.05, 0.5 * H), r1: 1.6 * H, color: '#6aa8ff', dur: 0.8, delay: 0.9 }), particles({ from: c, mode: 'sphere', jitter: 0.5 * H, speed: [0.2 * H, 0.6 * H], count: 80, stream: 1.2, life: 0.7, size: 0.07 * H, c0: '#ffffff', c1: '#3a6aff', gravity: V(0, 1 * H, 0) })];
  },
  lavaplume: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, mode: 'ring', speed: [1.6 * H, 2.6 * H], count: 200, stream: 0.7, life: 0.8, size: 0.15 * H, c0: FIRE0, c1: '#ff2a00', gravity: V(0, 0.6 * H, 0), drag: 1.6 }), shock({ at: V(0, 0.05, 0), r1: 1.8 * H, color: '#ff6a1a', dur: 1 })];
  },
  bodyslam: (r, H) => [shock({ at: V(0, 0.05, 0), r1: 2.2 * H, color: '#ffffff', dur: 0.9 }), particles({ from: V(0, 0.05, 0), mode: 'ring', radius: 0.4 * H, speed: [1 * H, 2 * H], count: 100, stream: 0.4, life: 1, size: 0.16 * H, c0: '#efe0c0', c1: '#8a7a60', gravity: V(0, -1 * H, 0), bright: 0.8 })],
  powergem: (r, H) => {
    const g = A(r, 'gem', 'mouth');
    return [orb({ at: g, r: 0.1 * H, color: '#ff3a4a', dur: 1.4, core: 1, pulse: 18 }), beam({ from: g, dir: V(0, 0.15, 1), len: 2.8 * H, r: 0.05 * H, color: '#ff4a6a', dur: 1.2, delay: 0.3 }), particles({ from: g, mode: 'sphere', speed: [0.3 * H, 0.8 * H], count: 50, stream: 1.2, life: 0.5, size: 0.05 * H, c0: '#ffffff', c1: '#ff5a8a', gravity: V() })];
  },
  discharge: (r, H) => {
    const c = A(r, 'center');
    const lines = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      lines.push([c, c.clone().add(V(Math.cos(a) * 1.4 * H, rnd(-0.2, 0.9) * H, Math.sin(a) * 1.4 * H))]);
    }
    return [bolts({ lines, thick: 0.025 * H, color: '#fff36a', dur: 1.4, segs: 9, jag: 0.14 }), orb({ at: c, r: 0.55 * H, color: '#ffe23a', dur: 1.4, core: 0.2 }), shock({ at: V(0, 0.05, 0), r1: 1.8 * H, color: '#fff27a', dur: 0.8 })];
  },
  volttackle: (r, H) => {
    const c = A(r, 'center');
    const lines = [];
    for (let i = 0; i < 6; i++) lines.push([c.clone().add(V(rnd(-0.5, 0.5) * H, rnd(-0.3, 0.5) * H, rnd(-0.5, 0.5) * H)), c.clone().add(V(rnd(-0.8, 0.8) * H, rnd(-0.4, 0.8) * H, rnd(-0.8, 0.8) * H))]);
    return [orb({ at: c, r: 0.75 * H, color: '#ffd23a', dur: 1.6, core: 0.15, alpha: 0.9 }), bolts({ lines, thick: 0.02 * H, color: '#ffffff', dur: 1.6 }), particles({ from: c, dir: V(0, 0.2, -1), spread: 0.4, jitter: 0.3 * H, speed: [1 * H, 2 * H], count: 80, stream: 1.4, life: 0.4, size: 0.07 * H, c0: '#ffffff', c1: '#ffcc00', gravity: V() })];
  },
  aircutter: (r, H) => {
    const c = A(r, 'center');
    return [0, 0.18, 0.36].map((d, i) => arc({ at: c.clone().add(V((i - 1) * 0.4 * H, 0, 0.3 * H)), normal: V(0, 1, 0.2), r: 0.4 * H, color: '#bff4ff', dur: 0.7, delay: d, angle: 2, sweep: 0, travel: V(0, -0.2 * H, 2.4 * H) }));
  },
  icebeam: (r, H) => {
    const m = A(r, 'mouth');
    const end = m.clone().add(V(0, -0.1 * H, 3 * H));
    return [beam({ from: m, dir: end.clone().sub(m), len: m.distanceTo(end), r: 0.06 * H, color: '#9af0ff', dur: 1.5 }), bolts({ lines: [[m, end]], thick: 0.02 * H, color: '#ffffff', dur: 1.4, segs: 12, jag: 0.06 }), particles({ from: m, to: end, mode: 'line', speed: [0.1 * H, 0.4 * H], count: 120, stream: 1.2, life: 0.8, size: 0.07 * H, c0: '#ffffff', c1: '#6ad8ff', gravity: V(0, -0.3 * H, 0) }), shock({ at: end, normal: V(0, 0, 1), r1: 0.7 * H, color: '#c8f8ff', dur: 0.6, delay: 0.4 })];
  },
  triattack: (r, H) => {
    const m = A(r, 'mouth');
    const target = m.clone().add(V(0, 0, 2.6 * H));
    const out = [];
    [['#ff6a2a', -0.35], ['#7af0ff', 0], ['#fff04a', 0.35]].forEach(([col, dx], i) => {
      const from = m.clone().add(V(dx * H, 0.05 * H * i, 0));
      out.push(beam({ from, dir: target.clone().sub(from), len: from.distanceTo(target), r: 0.04 * H, color: col, dur: 1.1, delay: i * 0.12 }));
    });
    out.push(orb({ at: target, r: 0.3 * H, color: '#ffffff', dur: 0.8, delay: 0.5, core: 0.6, grow: true }), shock({ at: target, normal: V(0, 0, 1), r1: 1 * H, color: '#ffffff', dur: 0.5, delay: 0.7 }));
    return out;
  },
  drillpeck: (r, H) => {
    const m = A(r, 'mouth');
    return [drill({ at: m, dir: V(0, -0.1, 1), r: 0.1 * H, color: '#fff0d0', dur: 1.2 }), particles({ from: m, dir: V(0, 0, 1), spread: 0.1, speed: [1.5 * H, 2.5 * H], count: 90, stream: 1.1, life: 0.5, size: 0.06 * H, c0: '#ffffff', c1: '#ffb07a', swirl: 14, axis: m, gravity: V() })];
  },
  ancientpower: (r, H) => {
    const c = A(r, 'center');
    return [rocks({ center: c.clone().add(V(0, -0.3 * H, 0)), radius: 0.9 * H, rise: 0.6 * H, throwDir: V(0, -0.1, 1), throwLen: 2.4 * H, size: 0.1 * H, count: 7, dur: 2, color: '#9a8a70', glow: '#ffd080' }), orb({ at: c, r: 0.7 * H, color: '#ffcf6a', dur: 1.4, core: 0, alpha: 0.5 })];
  },
  extremespeed: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, dir: V(0, 0.1, -1), spread: 0.15, jitter: 0.35 * H, speed: [2.5 * H, 4 * H], count: 150, stream: 1.2, life: 0.55, size: 0.12 * H, c0: '#fff6c0', c1: '#ff5a0a', gravity: V(0, 0.6 * H, 0), drag: 0.4 }), orb({ at: c, r: 0.7 * H, color: '#ffb03a', dur: 1.2, core: 0.05, alpha: 0.7 }), shock({ at: c.clone().add(V(0, 0, 0.6 * H)), normal: V(0, 0, 1), r1: 1.1 * H, color: '#ffffff', dur: 0.45 })];
  },
  fireblast: (r, H) => {
    const m = A(r, 'mouth');
    const at = m.clone().add(V(0, 0.4 * H, 1.8 * H));
    const dirs = [V(0, 1, 0), V(-1, 0.1, 0), V(1, 0.1, 0), V(-0.7, -0.8, 0), V(0.7, -0.8, 0)];
    return [orb({ r: 0.2 * H, color: '#ff8a1a', dur: 0.55, path: (k) => m.clone().lerp(at, k), core: 0.9, fade: 0.95 }), particles({ from: at, dirs, spread: 0.08, speed: [1.6 * H, 2.4 * H], count: 260, delay: 0.5, stream: 0.4, life: 0.9, size: 0.16 * H, c0: FIRE0, c1: FIRE1, gravity: V(0, 0.4 * H, 0), drag: 1 }), orb({ at, r: 0.5 * H, color: '#ffb03a', dur: 1.1, delay: 0.5, core: 0.6, grow: true })];
  },
  psychic: (r, H) => {
    const c = A(r, 'center');
    return [orb({ at: c, r: 0.65 * H, color: '#ff7ad8', dur: 1.8, core: 0.15, expand: 0.5 }), shock({ at: c, normal: V(0, 0, 1), r1: 1.4 * H, color: '#ffb0f0', dur: 1, delay: 0.3 }), shock({ at: c, normal: V(1, 0, 0), r1: 1.2 * H, color: '#ff8ae8', dur: 1, delay: 0.6 }), particles({ from: c, mode: 'sphere', jitter: 0.3 * H, speed: [0.3 * H, 0.9 * H], count: 90, stream: 1.4, life: 0.9, size: 0.07 * H, c0: '#ffffff', c1: '#ff6ad0', swirl: 4, axis: c, gravity: V() })];
  },
  blizzard: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, mode: 'sphere', jitter: 1.4 * H, speed: [0.5 * H, 1.5 * H], count: 280, stream: 2, life: 1.4, size: 0.09 * H, c0: '#ffffff', c1: '#8ad8ff', swirl: 3, axis: c, gravity: V(0, -1.2 * H, 0), drag: 0.6, bright: 2.4 }), shock({ at: c, normal: V(0, 1, 0), r1: 2 * H, color: '#c8f4ff', dur: 1.4 }), orb({ at: c, r: 0.9 * H, color: '#9ae4ff', dur: 2, core: 0.02, alpha: 0.5 })];
  },
  hydropump: (r, H) => {
    const a = A(r, 'cannonL', 'mouth');
    const b = A(r, 'cannonR', 'mouth');
    return [a, b].flatMap((p) => [
      beam({ from: p, dir: V(0, 0.05, 1), len: 2.6 * H, r: 0.06 * H, color: '#5ab8ff', dur: 1.5 }),
      particles({ from: p, dir: V(0, 0.08, 1), spread: 0.06, speed: [3 * H, 3.6 * H], count: 110, stream: 1.3, life: 0.7, size: 0.08 * H, c0: '#ffffff', c1: '#2a7aff', gravity: V(0, -1.6 * H, 0), drag: 0.2, bright: 2.2 })
    ]);
  },
  dynamicpunch: (r, H) => {
    const c = A(r, 'hand');
    const out = [];
    for (let i = 0; i < 4; i++) {
      const p = c.clone().add(V((i % 2 ? 1 : -1) * 0.25 * H, (i < 2 ? 0.15 : -0.15) * H, 0.25 * H));
      out.push(orb({ at: p, r: 0.14 * H, color: '#ffb46a', dur: 0.35, delay: i * 0.18, core: 0.8 }));
      out.push(shock({ at: p, normal: V(0, 0, 1), r1: 0.7 * H, color: '#ffffff', dur: 0.4, delay: i * 0.18 }));
    }
    out.push(shock({ at: V(0, 0.05, 0.5 * H), r1: 1.8 * H, color: '#ffc070', dur: 0.9, delay: 0.6 }));
    return out;
  },
  thunder: (r, H) => {
    const c = A(r, 'center');
    const top = c.clone().add(V(0, 6 * H, 0));
    return [bolts({ lines: [[top, c], [top.clone().add(V(0.6 * H, 0, 0)), c.clone().add(V(0.5 * H, -0.2 * H, 0))]], thick: 0.06 * H, color: '#fffbe0', dur: 1.2, segs: 12, jag: 0.06 }), orb({ at: c, r: 0.9 * H, color: '#fff27a', dur: 1, core: 0.4, grow: true }), shock({ at: c, normal: V(0, 1, 0), r1: 2 * H, color: '#fff6a0', dur: 0.8 })];
  },
  skyattack: (r, H) => {
    const c = A(r, 'center');
    return [particles({ from: c, dirs: [V(1, 0.3, -0.3), V(-1, 0.3, -0.3)], spread: 0.35, speed: [2 * H, 3 * H], count: 260, stream: 1.2, life: 0.9, size: 0.16 * H, c0: '#fff6c0', c1: '#ff5a0a', gravity: V(0, 0.4 * H, 0), drag: 1 }), orb({ at: c, r: 1 * H, color: '#ffc03a', dur: 1.8, core: 0.1, alpha: 0.8, grow: true }), shock({ at: c, normal: V(0, 1, 0), r1: 2.2 * H, color: '#ffd06a', dur: 1, delay: 0.4 })];
  },
  psystrike: (r, H) => {
    const p = A(r, 'hand').add(V(0, 0, 0.15 * H));
    const out = [orb({ at: p, r: 0.28 * H, color: '#8a2aff', dur: 2.2, core: 0.9, grow: true, pulse: 8 }), orb({ at: p, r: 0.45 * H, color: '#d07aff', dur: 2.2, core: 0, alpha: 0.6 })];
    for (let i = 0; i < 3; i++) out.push(shock({ at: p, normal: V(Math.sin(i * 2.1), Math.cos(i * 2.1), 0.5), r0: 0.5 * H, r1: 1.6 * H, color: '#c060ff', dur: 1.2, delay: 0.4 + i * 0.35 }));
    out.push(particles({ from: p, mode: 'sphere', jitter: 0.6 * H, speed: [-0.8 * H, -0.3 * H], count: 120, stream: 1.6, life: 0.6, size: 0.06 * H, c0: '#ffffff', c1: '#a040ff', gravity: V(), drag: 0.5 }));
    return out;
  },
  zzz: (r, H) => [zzz({ at: A(r, 'head').add(V(0.1 * H, 0.1 * H, 0.1 * H)), size: 0.25 * H, dur: 4 })],
  charge: (r, H) => RECIPES.shock(r, H)
};

export const MOVE_KEYS = Object.keys(RECIPES);

export function createMove(fx, rig, H) {
  const recipe = RECIPES[fx] || RECIPES.psychic;
  const parts = recipe(rig, H);
  const group = new THREE.Group();
  parts.forEach((p) => group.add(p.obj));
  const end = Math.max(...parts.map((p) => p.end));
  let t = 0;
  return {
    group,
    end,
    update(dt) {
      t += dt;
      for (const p of parts) p.update(t);
      return t < end;
    },
    dispose() {
      group.removeFromParent();
      parts.forEach((p) => p.dispose());
    }
  };
}

export function warmMoves() {
  const group = new THREE.Group();
  const all = [
    particles({ count: 4, speed: [0, 1], life: 1, c0: '#fff' }),
    shock({ r1: 1, color: '#fff' }),
    orb({ r: 1, color: '#fff' }),
    beam({ from: V(), dir: V(0, 0, 1), len: 1, r: 0.1, color: '#fff' }),
    bolts({ lines: [[V(), V(0, 1, 0)]], thick: 0.05, color: '#fff' }),
    arc({ at: V(), r: 1, color: '#fff' }),
    rocks({ center: V(), radius: 1, rise: 1, throwLen: 1, size: 0.1 }),
    drill({ at: V(), r: 0.2, color: '#fff' }),
    zzz({ at: V(), size: 0.3 })
  ];
  all.forEach((p) => {
    p.update(0.05);
    p.obj.visible = true;
    group.add(p.obj);
  });
  return { group, dispose: () => all.forEach((p) => p.dispose()) };
}

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt, mulberry32, fbm } from './terrain.js';
import { PRESETS, sunDirection } from './atmosphere.js';

function cloudTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size - 0.5;
      const v = y / size - 0.5;
      const r = Math.sqrt(u * u * 1.2 + v * v * 2.4);
      const n = fbm(x * 0.022 + 3, y * 0.022 - 7, 5) * 0.5 + 0.5;
      const a = Math.max(0, Math.min(1, (0.5 - r) * 2.4 + (n - 0.5) * 1.2)) * Math.max(0, 1 - r * 2);
      const i = (y * size + x) * 4;
      const shade = 210 + n * 45 - Math.max(0, v) * 70;
      img.data[i] = img.data[i + 1] = shade;
      img.data[i + 2] = Math.min(255, shade + 10);
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shaftTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,240,210,0)');
  g.addColorStop(0.25, 'rgba(255,236,200,0.9)');
  g.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

function Clouds({ preset }) {
  const { mesh, mat } = useMemo(() => {
    const rng = mulberry32(99);
    const count = 34;
    const mat = new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.92 });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, count);
    mesh.userData.items = Array.from({ length: count }, () => ({
      a: rng() * Math.PI * 2,
      r: 170 + rng() * 260,
      y: 75 + rng() * 70,
      w: 90 + rng() * 120,
      speed: (0.004 + rng() * 0.006) * (rng() < 0.5 ? 1 : -1)
    }));
    mesh.frustumCulled = false;
    return { mesh, mat };
  }, []);

  const tint = useMemo(() => new THREE.Color(), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((state, dt) => {
    const pr = PRESETS[preset];
    tint.set(pr.sun).lerp(new THREE.Color('#ffffff'), preset === 'day' ? 0.85 : 0.5);
    mat.color.lerp(tint, 0.05);
    for (const [i, c] of mesh.userData.items.entries()) {
      c.a += c.speed * Math.min(dt, 0.1);
      p.set(Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r);
      q.setFromAxisAngle(up, Math.atan2(-p.x, -p.z) + Math.PI);
      s.set(c.w, c.w * 0.42, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}

function LightShafts({ preset }) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const tex = shaftTexture();
    const rng = mulberry32(4);
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      const a = -0.9 + (i / 8) * 1.8 + (rng() - 0.5) * 0.15;
      const r = 40 + rng() * 14;
      mesh.position.set(Math.sin(a) * r, 0, 24 - Math.cos(a) * r);
      mesh.userData = { w: 5 + rng() * 6, h: 34 + rng() * 14, phase: rng() * 10 };
      g.add(mesh);
    }
    return g;
  }, []);

  useFrame((state) => {
    const pr = PRESETS[preset];
    const dir = sunDirection(pr);
    const strength = preset === 'day' ? 0.05 : preset === 'dusk' ? 0.09 : 0.14;
    const tilt = Math.atan2(Math.hypot(dir.x, dir.z), Math.max(0.15, dir.y));
    for (const m of group.children) {
      const { w, h, phase } = m.userData;
      m.scale.set(w, h, 1);
      m.position.y = heightAt(m.position.x, m.position.z) + h * 0.45;
      m.rotation.set(0, Math.atan2(dir.x, dir.z), Math.min(0.9, tilt * 0.5));
      m.lookAt(state.camera.position.x, m.position.y, state.camera.position.z);
      m.rotateZ(-Math.min(0.6, tilt * 0.35) * Math.sign(dir.x || 1));
      m.material.color.set(pr.sun);
      m.material.opacity = strength * (0.6 + 0.4 * Math.sin(state.clock.elapsedTime * 0.3 + phase));
    }
  });

  return <primitive object={group} />;
}

const flapMaterial = (dark) => {
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false, color: dark ? '#1e1a18' : '#ffffff' });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float seed = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.11;
        #else
        float seed = 0.0;
        #endif
        float flap = sin(uTime * ${dark ? '9.0' : '22.0'} + seed * 6.28) * ${dark ? '0.9' : '1.1'};
        float side = sign(position.x);
        float ang = flap * side;
        float ax = abs(position.x);
        transformed.x = side * ax * cos(ang);
        transformed.y = position.y + ax * sin(abs(ang));`
      );
  };
  return mat;
};

function wingGeometry(span, chord) {
  const g = new THREE.BufferGeometry();
  const v = [0, 0, chord * 0.5, span, 0, chord * 0.2, span * 0.8, 0, -chord * 0.6, 0, 0, -chord * 0.4];
  const pos = [];
  for (const s of [1, -1]) {
    const p = (i) => [v[i * 3] * s, v[i * 3 + 1], v[i * 3 + 2]];
    pos.push(...p(0), ...p(1), ...p(2), ...p(0), ...p(2), ...p(3));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function Butterflies({ count = 48 }) {
  const { mesh, items, mat } = useMemo(() => {
    const rng = mulberry32(21);
    const mat = flapMaterial(false);
    const mesh = new THREE.InstancedMesh(wingGeometry(0.16, 0.18), mat, count);
    const colors = ['#ffcf3d', '#ff8a3d', '#ffffff', '#7cc9ff', '#c98bff', '#ff6fa8'].map((c) => new THREE.Color(c));
    const items = Array.from({ length: count }, (_, i) => {
      mesh.setColorAt(i, colors[i % colors.length]);
      const a = rng() * Math.PI * 2;
      const r = 3 + rng() * 26;
      return { cx: Math.cos(a) * r, cz: Math.sin(a) * r + 6, r: 0.6 + rng() * 2, sp: 0.4 + rng() * 0.7, ph: rng() * 10, h: 0.5 + rng() * 1.8 };
    });
    mesh.frustumCulled = false;
    return { mesh, items, mat };
  }, [count]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mat.userData.uTime) mat.userData.uTime.value = t;
    items.forEach((b, i) => {
      const k = t * b.sp + b.ph;
      const x = b.cx + Math.sin(k) * b.r + Math.sin(k * 2.3) * 0.4;
      const z = b.cz + Math.cos(k * 0.8) * b.r;
      const y = heightAt(x, z) + b.h + Math.sin(k * 3.1) * 0.3;
      p.set(x, y, z);
      e.set(0, Math.atan2(Math.cos(k) * b.r, -Math.sin(k * 0.8) * b.r * 0.8), 0);
      q.setFromEuler(e);
      m.compose(p, q, one);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

function Flocks() {
  const { mesh, birds, mat } = useMemo(() => {
    const rng = mulberry32(77);
    const mat = flapMaterial(true);
    const per = 9;
    const flocks = Array.from({ length: 4 }, () => ({ a: rng() * Math.PI * 2, r: 110 + rng() * 120, y: 38 + rng() * 26, sp: (0.012 + rng() * 0.01) * (rng() < 0.5 ? 1 : -1) }));
    const mesh = new THREE.InstancedMesh(wingGeometry(1.1, 0.7), mat, flocks.length * per);
    const birds = [];
    flocks.forEach((f) => {
      for (let i = 0; i < per; i++) {
        const row = Math.ceil(i / 2);
        const side = i === 0 ? 0 : i % 2 ? 1 : -1;
        birds.push({ f, dx: side * row * 2.4, dz: -row * 2.2, bob: rng() * 6 });
      }
    });
    mesh.frustumCulled = false;
    return { mesh, birds, mat };
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const off = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (mat.userData.uTime) mat.userData.uTime.value = t;
    const seen = new Set();
    birds.forEach((b, i) => {
      const f = b.f;
      if (!seen.has(f)) {
        f.a += f.sp * Math.min(dt, 0.1);
        seen.add(f);
      }
      const heading = f.a + (f.sp > 0 ? Math.PI / 2 : -Math.PI / 2);
      q.setFromAxisAngle(up, Math.atan2(Math.cos(heading), Math.sin(heading)) + Math.PI / 2);
      off.set(b.dx, Math.sin(t * 1.3 + b.bob) * 0.5, b.dz).applyQuaternion(q);
      p.set(Math.cos(f.a) * f.r, f.y, Math.sin(f.a) * f.r).add(off);
      m.compose(p, q, one);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

export function Ambience({ preset, butterflies = 56 }) {
  return (
    <>
      <Clouds preset={preset} />
      <LightShafts preset={preset} />
      <Butterflies count={butterflies} />
      <Flocks />
    </>
  );
}

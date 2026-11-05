import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, lakeFactor, mulberry32, noise2 } from './terrain.js';
import { DOME_CAMERA } from './habitat.js';
import { pokeClock } from './pokekit.js';

function tint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

function pokeballGeometry() {
  const top = tint(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2 - 0.06), '#d8202a');
  const bottom = tint(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2 + 0.06, Math.PI / 2 - 0.06), '#f4f2ee');
  const band = tint(new THREE.CylinderGeometry(0.985, 0.985, 0.13, 40, 1, true), '#141416');
  const button = tint(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 32).rotateX(Math.PI / 2).translate(0, 0, 0.93), '#141416');
  const inner = tint(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 32).rotateX(Math.PI / 2).translate(0, 0, 0.96), '#f8f8f4');
  const glint = tint(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 24).rotateX(Math.PI / 2).translate(0, 0, 0.97), '#ffffff');
  return mergeGeometries([top, bottom, band, button, inner, glint]);
}

function crystalGeometry(rng) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.6 + rng() * 1.1;
    const g = new THREE.OctahedronGeometry(0.22 + rng() * 0.12, 0);
    g.scale(1, h * 2.2, 1);
    g.rotateZ((rng() - 0.5) * 0.9);
    g.rotateX((rng() - 0.5) * 0.9);
    g.translate((rng() - 0.5) * 0.6, h * 0.5, (rng() - 0.5) * 0.6);
    parts.push(g.toNonIndexed());
  }
  const m = mergeGeometries(parts);
  m.computeVertexNormals();
  return m;
}

function bushGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    v.multiplyScalar(1 + noise2(v.x * 2 + seed, v.z * 2 + v.y) * 0.22);
    v.y *= 0.7;
    p.setXYZ(i, v.x, v.y + 0.45, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function flowerGeometry() {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.09, 6, 4).scale(1, 0.25, 0.55).translate(0, 0, 0.09).rotateY(a);
    petals.push(g.toNonIndexed());
  }
  const center = new THREE.SphereGeometry(0.05, 6, 4).toNonIndexed();
  center.translate(0, 0.02, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4).translate(0, -0.15, 0).toNonIndexed();
  const g = mergeGeometries([...petals, center, stem]);
  g.translate(0, 0.3, 0);
  g.deleteAttribute('uv');
  return g;
}

function placeOnArc(rng, minD, maxD, arc, avoid) {
  for (let i = 0; i < 40; i++) {
    const a = (rng() * 2 - 1) * arc;
    const d = minD + rng() * (maxD - minD);
    const x = DOME_CAMERA.x + Math.sin(a) * d;
    const z = DOME_CAMERA.z - Math.cos(a) * d;
    if (lakeFactor(x, z) > 0.01) continue;
    if (avoid.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r)) continue;
    return { x, z };
  }
  return null;
}

export function Pokeland({ quality = 'high' }) {
  const lite = quality === 'low';
  const shimmer = useMemo(() => ({ uTime: pokeClock }), []);

  const meshes = useMemo(() => {
    const rng = mulberry32(151);
    const out = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const avoid = [];

    const ballMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05, clearcoat: lite ? 0 : 0.8, clearcoatRoughness: 0.15 });
    const balls = [];
    const spots = [[27, 0.55], [30, -0.35], [33, 0.05], [25, -0.9], [29, 0.95], [36, -0.7], [38, 0.45]];
    for (const [d, a] of spots) {
      const x = DOME_CAMERA.x + Math.sin(a) * d;
      const z = DOME_CAMERA.z - Math.cos(a) * d;
      if (lakeFactor(x, z) > 0.01) continue;
      const s = 1.1 + rng() * 1.1;
      balls.push({ x, z, s, yaw: Math.atan2(DOME_CAMERA.x - x, DOME_CAMERA.z - z) + (rng() - 0.5) * 0.8, tilt: (rng() - 0.5) * 0.5 });
      avoid.push({ x, z, r: s + 1.5 });
    }
    const ball = new THREE.InstancedMesh(pokeballGeometry(), ballMat, balls.length);
    balls.forEach((b, i) => {
      e.set(b.tilt, b.yaw, (rng() - 0.5) * 0.3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(b.x, heightAt(b.x, b.z) + b.s * 0.62, b.z), q, new THREE.Vector3(b.s, b.s, b.s));
      ball.setMatrixAt(i, m);
    });
    ball.castShadow = !lite;
    ball.receiveShadow = true;
    ball.computeBoundingSphere();
    out.push(ball);

    const stones = [
      ['#ff7a2a', '#ff5a10'],
      ['#7aff5a', '#e8ff3a'],
      ['#3aa8ff', '#2a6aff'],
      ['#d8a8ff', '#a060ff']
    ];
    const crystalGeo = crystalGeometry(rng);
    stones.forEach(([color, glow], si) => {
      const mat = new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = shimmer.uTime;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.75 + 0.45 * sin(uTime * 1.7 + vViewPosition.x * 0.3);');
      };
      const n = lite ? 2 : 4;
      const inst = new THREE.InstancedMesh(crystalGeo, mat, n);
      for (let i = 0; i < n; i++) {
        const p = placeOnArc(rng, 30, 46, 1.3, avoid) || { x: 30, z: -10 };
        avoid.push({ ...p, r: 1.5 });
        e.set(0, rng() * Math.PI * 2, 0);
        q.setFromEuler(e);
        const s = 0.5 + rng() * 0.5;
        m.compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) - 0.1, p.z), q, new THREE.Vector3(s, s, s));
        inst.setMatrixAt(i, m);
      }
      inst.computeBoundingSphere();
      inst.userData.stone = si;
      out.push(inst);
    });

    const bushMat = new THREE.MeshStandardMaterial({ color: '#3f8a34', roughness: 0.9 });
    const bushGeo = bushGeometry(3.3);
    const berryGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const berryColors = ['#2a6aff', '#ff6ab4', '#e8202a', '#ffcf2a'];
    const nb = lite ? 14 : 30;
    const bush = new THREE.InstancedMesh(bushGeo, bushMat, nb);
    const berries = berryColors.map((c) => ({ mesh: new THREE.InstancedMesh(berryGeo, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: lite ? 0 : 1, emissive: c, emissiveIntensity: 0.12 }), nb * 7), n: 0 }));
    for (let i = 0; i < nb; i++) {
      const p = placeOnArc(rng, 24, 46, 1.3, avoid) || { x: -30, z: -20 };
      avoid.push({ ...p, r: 1.4 });
      const s = 0.7 + rng() * 0.7;
      const y = heightAt(p.x, p.z) - 0.05;
      e.set(0, rng() * 6, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(s * 1.2, s, s * 1.2));
      bush.setMatrixAt(i, m);
      const kind = berries[i % berries.length];
      for (let k = 0; k < 7; k++) {
        const a = rng() * Math.PI * 2;
        const h = 0.2 + rng() * 0.6;
        const r = Math.sqrt(Math.max(0, 1 - (h - 0.45) ** 2 / 0.5)) * s * 1.18;
        m.makeTranslation(p.x + Math.cos(a) * r, y + (h + 0.2) * s, p.z + Math.sin(a) * r);
        kind.mesh.setMatrixAt(kind.n++, m);
      }
    }
    bush.castShadow = !lite;
    bush.receiveShadow = true;
    bush.computeBoundingSphere();
    out.push(bush);
    for (const b of berries) {
      b.mesh.count = b.n;
      b.mesh.computeBoundingSphere();
      out.push(b.mesh);
    }

    const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.7, vertexColors: false });
    const nf = lite ? 260 : 700;
    const flowers = new THREE.InstancedMesh(flowerGeometry(), flowerMat, nf);
    const palette = ['#ffffff', '#ffd23a', '#ff7ab4', '#b48aff', '#ff5a3a', '#7ad8ff'].map((c) => new THREE.Color(c));
    let fi = 0;
    for (let i = 0; i < nf * 4 && fi < nf; i++) {
      const p = placeOnArc(rng, 5, 34, 1.35, []);
      if (!p) continue;
      if (noise2(p.x * 0.12 + 4, p.z * 0.12 - 2) < 0.15) continue;
      e.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
      q.setFromEuler(e);
      const s = 0.8 + rng() * 0.8;
      m.compose(new THREE.Vector3(p.x, heightAt(p.x, p.z), p.z), q, new THREE.Vector3(s, s, s));
      flowers.setMatrixAt(fi, m);
      flowers.setColorAt(fi, palette[Math.floor(noise2(p.x * 0.05, p.z * 0.05) * 3 + 3 + rng() * 1.5) % palette.length]);
      fi++;
    }
    flowers.count = fi;
    flowers.computeBoundingSphere();
    flowers.receiveShadow = true;
    out.push(flowers);
    return out;
  }, [lite, shimmer]);

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
}

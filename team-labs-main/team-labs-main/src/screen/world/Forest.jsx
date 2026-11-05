import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, slopeAt, lakeFactor, mulberry32, noise2, ARENA } from './terrain.js';

const CLEAR_R = 38;

function paint(geo, color, jitter = 0, rng = Math.random) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  const hsl = {};
  c.getHSL(hsl);
  for (let i = 0; i < n; i += 3) {
    const v = new THREE.Color().setHSL(hsl.h + (rng() - 0.5) * jitter * 0.08, hsl.s, hsl.l * (1 + (rng() - 0.5) * jitter));
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = v.r;
      colors[(i + k) * 3 + 1] = v.g;
      colors[(i + k) * 3 + 2] = v.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function wobble(geo, amount, freq, seed) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = noise2(x * freq + seed, z * freq + y * 0.7 - seed);
    const len = Math.hypot(x, z) || 1;
    pos.setXYZ(i, x + (x / len) * n * amount, y + n * amount * 0.3, z + (z / len) * n * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

function pineGeometry(rng) {
  const parts = [paint(new THREE.CylinderGeometry(0.12, 0.22, 2.2, 7).translate(0, 1.1, 0), '#4a3423', 0.2, rng)];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = 1.9 * (1 - t * 0.78);
    const cone = new THREE.ConeGeometry(r, 2.6 - t * 0.9, 10, 2);
    cone.translate(0, 1.7 + i * 1.25 + 1.2, 0);
    wobble(cone, 0.22, 1.3, i * 3.1);
    parts.push(paint(cone, i % 2 ? '#24452a' : '#2d5531', 0.35, rng));
  }
  return mergeGeometries(parts);
}

function oakGeometry(rng) {
  const parts = [paint(new THREE.CylinderGeometry(0.2, 0.35, 3.2, 8).translate(0, 1.6, 0), '#5a4130', 0.2, rng)];
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rng();
    const rr = i === 0 ? 0 : 1.1 + rng() * 0.6;
    const s = 1.5 + rng() * 0.9;
    const blob = new THREE.IcosahedronGeometry(s, 2);
    wobble(blob, 0.35, 0.9, i * 7.7);
    blob.translate(Math.cos(a) * rr, 4.2 + rng() * 1.4 + (i === 0 ? 0.9 : 0), Math.sin(a) * rr);
    parts.push(paint(blob, ['#4f7a2c', '#5d8a33', '#43692a', '#6c8f35'][i % 4], 0.3, rng));
  }
  return mergeGeometries(parts);
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = noise2(v.x * 1.3 + seed, v.y * 1.3 + v.z) * 0.28 + noise2(v.x * 3.1, v.z * 3.1 + seed) * 0.08;
    v.multiplyScalar(1 + n);
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return paint(g, '#7b766e', 0.25);
}

function swayMaterial(uniforms, roughness = 0.85) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 iw = instanceMatrix[3].xyz;
        float sway = max(0.0, position.y - 2.0) * 0.018;
        transformed.x += sin(uTime * 1.1 + iw.x * 0.21 + iw.z * 0.13) * sway;
        transformed.z += cos(uTime * 0.9 + iw.z * 0.17) * sway * 0.6;
        #endif`
      );
  };
  return mat;
}

function scatter({ rng, count, minR, maxR, maxSlope = 0.8, maxH = 40, clusterFreq = 0.035, clusterCut = -0.1, avoid = [] }) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const r = minR + (maxR - minR) * Math.pow(rng(), 0.8);
    const a = rng() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (noise2(x * clusterFreq + 13, z * clusterFreq - 7) < clusterCut) continue;
    if (lakeFactor(x, z) > 0.01) continue;
    if (slopeAt(x, z) > maxSlope) continue;
    const h = heightAt(x, z);
    if (h > maxH) continue;
    if (avoid.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r)) continue;
    out.push({ x, z, h, rot: rng() * Math.PI * 2, s: rng() });
  }
  return out;
}

export function Forest() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const meshes = useMemo(() => {
    const rng = mulberry32(7);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const result = [];

    const SECTORS = 12;
    const NEAR_R = 70;
    const build = (geometry, material, points, scaleFn) => {
      const chunks = new Map();
      for (const p of points) {
        const sector = Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / (Math.PI * 2)) * SECTORS) % SECTORS;
        const near = Math.hypot(p.x, p.z) < NEAR_R;
        const key = `${sector}:${near}`;
        if (!chunks.has(key)) chunks.set(key, { near, points: [] });
        chunks.get(key).points.push(p);
      }
      for (const { near, points: list } of chunks.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        list.forEach((p, i) => {
          q.setFromAxisAngle(up, p.rot);
          m.compose(new THREE.Vector3(p.x, p.h - 0.15, p.z), q, scaleFn(p));
          mesh.setMatrixAt(i, m);
        });
        mesh.castShadow = near;
        mesh.receiveShadow = true;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        result.push(mesh);
      }
    };

    const canopy = swayMaterial(uniforms);
    const pines = scatter({ rng, count: 1300, minR: CLEAR_R + 2, maxR: 190, maxH: 48, clusterCut: -0.25 });
    const oaks = scatter({ rng, count: 420, minR: CLEAR_R, maxR: 110, maxH: 22, clusterFreq: 0.05, clusterCut: 0.05, avoid: pines.slice(0, 200).map((p) => ({ ...p, r: 2.5 })) });
    const rocks = scatter({ rng, count: 260, minR: ARENA - 1, maxR: 160, maxSlope: 2, maxH: 80, clusterCut: -0.6 });

    const pineGeos = [pineGeometry(rng), pineGeometry(rng)];
    const oakGeos = [oakGeometry(rng), oakGeometry(rng)];
    [0, 1].forEach((k) => {
      build(pineGeos[k], canopy, pines.filter((_, i) => i % 2 === k), (p) => new THREE.Vector3().setScalar(0.85 + p.s * 1.25));
      build(oakGeos[k], canopy, oaks.filter((_, i) => i % 2 === k), (p) => new THREE.Vector3().setScalar(0.8 + p.s * 0.8));
    });
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    [0, 1, 2].forEach((k) => {
      build(rockGeometry(k * 11.3), rockMat, rocks.filter((_, i) => i % 3 === k), (p) => {
        const big = Math.hypot(p.x, p.z) > CLEAR_R ? 3.2 : 0.9;
        return new THREE.Vector3(1, 0.8 + p.s * 0.6, 1).multiplyScalar(0.5 + p.s * p.s * big);
      });
    });
    return result;
  }, [uniforms]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
}

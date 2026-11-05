import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt, slopeAt, lakeFactor, mulberry32, fbm } from './terrain.js';
import { runtime } from './atmosphere.js';

const MAX_MOVERS = 10;

function bladeGeometry() {
  const segs = 5;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.055 * (1 - t * 0.92);
    const bend = t * t * 0.18;
    positions.push(-w, t, bend, w, t, bend);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function windMaterial({ uniforms, tipLight = true }) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec4 uMovers[${MAX_MOVERS}];
        varying float vH;`
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace(
        '#include <project_vertex>',
        `vH = position.y;
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wp = modelMatrix * mvPosition;
        float k = vH * vH;
        float gust = sin(uTime * 0.6 + wp.x * 0.05) * 0.5 + 0.5;
        float wave = sin(uTime * 1.9 + wp.x * 0.42 + wp.z * 0.31) * 0.55
                   + sin(uTime * 3.3 + wp.x * 1.3 - wp.z * 0.7) * 0.18;
        vec2 windDir = normalize(vec2(1.0, 0.35));
        wp.xz += windDir * (wave * 0.12 + gust * 0.2) * k;
        for (int i = 0; i < ${MAX_MOVERS}; i++) {
          vec4 m = uMovers[i];
          if (m.w <= 0.0) continue;
          vec2 d = wp.xz - m.xz;
          float dist = length(d);
          float f = 1.0 - smoothstep(0.0, m.w, dist);
          wp.xz += (d / max(dist, 0.001)) * f * k * 0.55;
          wp.y -= f * k * 0.35;
        }
        mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(0.32, ${tipLight ? '1.25' : '1.0'}, smoothstep(0.0, 1.0, vH));`
      );
  };
  return mat;
}

export function Grass({ count = 90000, radius = 38 }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMovers: { value: Array.from({ length: MAX_MOVERS }, () => new THREE.Vector4(0, 0, 0, 0)) }
    }),
    []
  );

  const { meshes, flowers } = useMemo(() => {
    const rng = mulberry32(42);
    const geo = bladeGeometry();
    const mat = windMaterial({ uniforms });
    const SECTORS = 16;
    const RINGS = [10, 22, 1e9];
    const buckets = new Map();
    const bucket = (x, z) => {
      const sector = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * SECTORS) % SECTORS;
      const r = Math.hypot(x, z);
      const ring = RINGS.findIndex((edge) => r < edge);
      const key = ring === 0 ? `c${Math.floor(sector / 4)}` : `${sector}:${ring}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { matrices: [], colors: [] }));
      return b;
    };
    const flowerGeo = new THREE.IcosahedronGeometry(0.05, 0);
    flowerGeo.translate(0, 0.45, 0);
    const flowerCount = Math.floor(count / 45);
    const flowerMesh = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), flowerCount);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const greens = ['#5c8a2c', '#6f9a34', '#86a83f', '#4b7426', '#9aa848'].map((c) => new THREE.Color(c));
    const dry = new THREE.Color('#b9a75d');
    const petals = ['#ffffff', '#ffe066', '#c9a2ff', '#ff8fb1', '#ffb347'].map((c) => new THREE.Color(c));

    let placed = 0;
    let flowersPlaced = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 6) {
      const r = radius * Math.pow(rng(), 0.62);
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (lakeFactor(x, z) > 0.05 || slopeAt(x, z) > 0.7) continue;
      const patch = fbm(x * 0.09, z * 0.09, 2);
      if (patch < -0.38 && rng() < 0.85) continue;

      const h = heightAt(x, z);
      const height = (0.45 + rng() * 0.55) * (0.75 + Math.max(0, patch) * 0.9);
      p.set(x, h - 0.02, z);
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      s.set(0.8 + rng() * 0.6, height, 1);
      m.compose(p, q, s);
      col.copy(greens[Math.floor(rng() * greens.length)]).lerp(dry, Math.max(0, patch) * 0.6 + rng() * 0.12);
      const b = bucket(x, z);
      b.matrices.push(...m.elements);
      b.colors.push(col.r, col.g, col.b);
      placed++;

      if (flowersPlaced < flowerCount && rng() < 0.04) {
        s.setScalar(0.7 + rng() * 0.8);
        p.y = h + (rng() - 0.5) * 0.1;
        m.compose(p, q, s);
        flowerMesh.setMatrixAt(flowersPlaced, m);
        flowerMesh.setColorAt(flowersPlaced, petals[Math.floor(rng() * petals.length)]);
        flowersPlaced++;
      }
    }
    const meshes = [];
    for (const b of buckets.values()) {
      const n = b.colors.length / 3;
      const grass = new THREE.InstancedMesh(geo, mat, n);
      grass.instanceMatrix.array.set(b.matrices);
      grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(b.colors), 3);
      grass.receiveShadow = true;
      grass.instanceMatrix.needsUpdate = true;
      grass.computeBoundingSphere();
      grass.boundingSphere.radius += 0.6;
      meshes.push(grass);
    }
    flowerMesh.count = flowersPlaced;
    flowerMesh.castShadow = false;
    flowerMesh.receiveShadow = true;
    flowerMesh.instanceMatrix.needsUpdate = true;
    flowerMesh.computeBoundingSphere();
    return { meshes, flowers: flowerMesh };
  }, [count, radius, uniforms]);

  const ref = useRef();
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    let i = 0;
    for (const pos of runtime.movers.values()) {
      if (i >= MAX_MOVERS) break;
      uniforms.uMovers.value[i++].set(pos.x, pos.y, pos.z, pos.w ?? 1.4);
    }
    for (; i < MAX_MOVERS; i++) uniforms.uMovers.value[i].w = 0;
  });

  return (
    <group ref={ref}>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      <primitive object={flowers} />
    </group>
  );
}

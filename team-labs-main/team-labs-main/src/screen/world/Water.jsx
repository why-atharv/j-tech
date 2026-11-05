import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LAKE } from './terrain.js';

function rippleNormalMap(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const waves = Array.from({ length: 14 }, (_, i) => ({
    kx: Math.round((Math.random() - 0.5) * 12) || 1,
    ky: Math.round((Math.random() - 0.5) * 12) || 1,
    amp: 1 / (1 + i * 0.35),
    ph: Math.random() * Math.PI * 2
  }));
  const height = (x, y) =>
    waves.reduce((h, w) => h + w.amp * Math.sin(((w.kx * x + w.ky * y) / size) * Math.PI * 2 + w.ph), 0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export function Water() {
  const { normalA, normalB } = useMemo(() => {
    const a = rippleNormalMap();
    const b = a.clone();
    b.repeat.set(11, 11);
    return { normalA: a, normalB: b };
  }, []);

  useFrame((_, dt) => {
    normalA.offset.x += dt * 0.012;
    normalA.offset.y += dt * 0.006;
    normalB.offset.x -= dt * 0.008;
    normalB.offset.y += dt * 0.011;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[LAKE.x, LAKE.level, LAKE.z]} receiveShadow>
      <circleGeometry args={[LAKE.r * 1.25, 64]} />
      <meshPhysicalMaterial
        color="#0d3a40"
        roughness={0.06}
        metalness={0.05}
        normalMap={normalA}
        normalScale={[0.35, 0.35]}
        clearcoat={1}
        clearcoatRoughness={0.04}
        clearcoatNormalMap={normalB}
        clearcoatNormalScale={[0.25, 0.25]}
        envMapIntensity={1.6}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

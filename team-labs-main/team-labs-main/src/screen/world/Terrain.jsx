import { useMemo } from 'react';
import * as THREE from 'three';
import { heightAt, slopeAt, fbm, WORLD_SIZE, LAKE } from './terrain.js';

const SEGMENTS = 340;

function detailTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n =
        fbm(Math.cos(u * Math.PI * 2) * 3 + 10, Math.sin(v * Math.PI * 2) * 3 + Math.sin(u * Math.PI * 2) * 3, 4) * 0.5 +
        (Math.random() - 0.5) * 0.25;
      const c = Math.max(0, Math.min(255, 200 + n * 90));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(WORLD_SIZE / 6, WORLD_SIZE / 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const C = {
  grassA: new THREE.Color('#4f7a2a'),
  grassB: new THREE.Color('#7d9a3a'),
  dry: new THREE.Color('#a59a55'),
  dirt: new THREE.Color('#6b5638'),
  rock: new THREE.Color('#6f6a63'),
  rockDark: new THREE.Color('#47443f'),
  snow: new THREE.Color('#f2f5f8'),
  sand: new THREE.Color('#c2ae80'),
  lakeBed: new THREE.Color('#3b4a3a')
};

export function Terrain() {
  const { geometry, map } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);

      const slope = slopeAt(x, z);
      const n = fbm(x * 0.03, z * 0.03, 3) * 0.5 + 0.5;
      const n2 = fbm(x * 0.11 + 40, z * 0.11, 2) * 0.5 + 0.5;

      c.copy(C.grassA).lerp(C.grassB, n);
      c.lerp(C.dry, Math.max(0, n2 - 0.55) * 1.6);
      if (n2 < 0.28) c.lerp(C.dirt, (0.28 - n2) * 2.5);

      const rockMix = THREE.MathUtils.smoothstep(slope, 0.55, 1.1) + THREE.MathUtils.smoothstep(h, 28, 45);
      if (rockMix > 0) c.lerp(tmp.copy(C.rock).lerp(C.rockDark, n2), Math.min(1, rockMix));

      const snow = THREE.MathUtils.smoothstep(h + n * 10, 62, 74) * (1 - THREE.MathUtils.smoothstep(slope, 1.4, 2.2));
      if (snow > 0) c.lerp(C.snow, snow);

      if (h < LAKE.level + 0.6) {
        const beach = THREE.MathUtils.smoothstep(LAKE.level + 0.6 - h, 0, 0.6);
        c.lerp(C.sand, beach);
        if (h < LAKE.level - 0.3) c.lerp(C.lakeBed, THREE.MathUtils.smoothstep(LAKE.level - 0.3 - h, 0, 1.2));
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return { geometry: geo, map: detailTexture() };
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors map={map} roughness={0.96} metalness={0} />
    </mesh>
  );
}

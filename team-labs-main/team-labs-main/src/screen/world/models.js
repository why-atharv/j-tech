import * as THREE from 'three';
import { POKE_DEFS } from './pokemon.js';

export const MODELS = {};
export const GAITS = { air: { fly: 6 } };

for (const [key, def] of Object.entries(POKE_DEFS)) {
  MODELS[key] = { procedural: true, size: def.size };
  const mo = def.mo || {};
  GAITS[key] = typeof mo.fly === 'number' ? { fly: mo.fly } : { walk: mo.walk ?? 2, run: mo.run ?? 6, turn: mo.turn ?? 2, idle: true };
}

let overrides = null;

export function loadModelOverrides() {
  overrides ??= fetch('/models/models.json')
    .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : {}))
    .catch(() => ({}))
    .then((list) => {
      for (const [key, m] of Object.entries(list || {})) {
        if (!m?.file) continue;
        MODELS[key] = { url: `/models/${m.file}`, size: m.size || MODELS[key]?.size || 4, yaw: m.yaw || 0, clips: m.clips || { walk: 0 } };
      }
      return list;
    });
  return overrides;
}

const fitCache = new WeakMap();

export function fitModel(scene, size) {
  let fit = fitCache.get(scene);
  if (!fit) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      part.setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld);
      box.union(part);
    });
    const extent = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) || 1;
    fit = { unit: 1 / extent, minY: box.min.y, height: box.max.y - box.min.y };
    fitCache.set(scene, fit);
  }
  const scale = fit.unit * size;
  return { scale, offsetY: -fit.minY * scale, height: fit.height * scale };
}

export function getClip(animations, ref) {
  if (typeof ref === 'number') return animations[ref];
  return animations.find((a) => a.name === ref) || animations.find((a) => a.name.toLowerCase().includes(String(ref).toLowerCase())) || animations[0];
}

export function variantMaterial(source) {
  const mat = source.clone();
  mat.transparent = true;
  mat.opacity = 1;
  return mat;
}

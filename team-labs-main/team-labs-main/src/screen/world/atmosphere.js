import * as THREE from 'three';

export const PRESETS = {
  golden: {
    label: 'Golden hour',
    elevation: 9,
    azimuth: 235,
    sun: '#ffcf9c',
    sunIntensity: 3.4,
    sky: { turbidity: 7, rayleigh: 2.4, mieCoefficient: 0.006, mieDirectionalG: 0.86 },
    hemiSky: '#ffe0bd',
    hemiGround: '#3b4a26',
    hemiIntensity: 0.55,
    fog: '#d9b892',
    fogDensity: 0.0042,
    env: 0.75,
    fireflies: 0.35,
    exposure: 1.0
  },
  day: {
    label: 'Midday',
    elevation: 52,
    azimuth: 200,
    sun: '#fff6e8',
    sunIntensity: 3.1,
    sky: { turbidity: 4, rayleigh: 1.1, mieCoefficient: 0.004, mieDirectionalG: 0.8 },
    hemiSky: '#cfe8ff',
    hemiGround: '#45562c',
    hemiIntensity: 0.7,
    fog: '#b8d3ea',
    fogDensity: 0.0032,
    env: 0.9,
    fireflies: 0.1,
    exposure: 1.0
  },
  dusk: {
    label: 'Dusk',
    elevation: 1.6,
    azimuth: 250,
    sun: '#ff8b5e',
    sunIntensity: 2.6,
    sky: { turbidity: 10, rayleigh: 3.6, mieCoefficient: 0.008, mieDirectionalG: 0.9 },
    hemiSky: '#a08cc4',
    hemiGround: '#1f2a1a',
    hemiIntensity: 1.0,
    fog: '#7a6782',
    fogDensity: 0.0055,
    env: 0.9,
    fireflies: 1,
    exposure: 1.35
  }
};

export const PRESET_ORDER = ['golden', 'day', 'dusk'];

export function sunDirection(preset) {
  const phi = THREE.MathUtils.degToRad(90 - preset.elevation);
  const theta = THREE.MathUtils.degToRad(preset.azimuth);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

export const runtime = {
  movers: new Map(),
  anchors: new Map(),
  skies: new Map(),
  goals: new Map(),
  tagEls: new Map(),
  tagLayout: new Map(),
  targets: new Map(),
  aims: [],
  shots: [],
  popups: [],
  hitTest: null,
  shake: 0,
  focus: null,
  perf: { gpu: '', gpuClass: 'unknown', fps: 0, ms: 0, worst: 0, calls: 0, tris: 0, face: 0, level: 0, width: 0, height: 0 }
};

if (import.meta.env?.DEV) window.__runtime = runtime;
window.__perf = runtime.perf;

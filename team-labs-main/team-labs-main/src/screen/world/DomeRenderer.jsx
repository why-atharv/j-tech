import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { runtime } from './atmosphere.js';
import { tierOf } from './quality.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, SMAAEffect } from 'postprocessing';

export function domeDirection(px, py, halfH, tanV, out = new THREE.Vector3()) {
  const theta = px * halfH;
  return out.set(Math.sin(theta), py * tanV, -Math.cos(theta)).normalize();
}

export function domeProject(v, halfH, tanV, out = { x: 0, y: 0 }) {
  const horiz = Math.hypot(v.x, v.z);
  const theta = Math.atan2(v.x, -v.z);
  if (Math.abs(theta) > halfH * 1.05 || horiz < 1e-4) return null;
  out.x = theta / halfH;
  out.y = v.y / horiz / tanV;
  return out;
}

export function domeTanV(fovHdeg, width, height) {
  return (height * THREE.MathUtils.degToRad(fovHdeg)) / (2 * width);
}

const VIEWS = 3;
const MARGIN = THREE.MathUtils.degToRad(1.5);

function viewGeometry(fovH, width, height) {
  const halfH = THREE.MathUtils.degToRad(fovH / 2);
  const seg = (halfH * 2) / VIEWS;
  const half = seg / 2 + MARGIN;
  const tanV = domeTanV(fovH, width, height);
  const tanX = Math.tan(half);
  const tanY = (tanV / Math.cos(half)) * 1.01;
  const yaws = Array.from({ length: VIEWS }, (_, i) => -halfH + seg * (i + 0.5));
  return { halfH, tanV, tanX, tanY, yaws };
}

const remapMaterial = () =>
  new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      t0: { value: null },
      t1: { value: null },
      t2: { value: null },
      uHalfH: { value: 1.4 },
      uTanV: { value: 0.8 },
      uTanX: { value: 0.5 },
      uTanY: { value: 0.9 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2;
      uniform float uHalfH; uniform float uTanV; uniform float uTanX; uniform float uTanY;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float theta = p.x * uHalfH;
        float seg = 2.0 * uHalfH / 3.0;
        float k = clamp(floor((theta + uHalfH) / seg), 0.0, 2.0);
        float local = theta - (-uHalfH + seg * (k + 0.5));
        float c = cos(local);
        vec2 uv = vec2(0.5 + 0.5 * tan(local) / uTanX, 0.5 + 0.5 * (p.y * uTanV / c) / uTanY);
        vec4 col;
        if (k < 0.5) col = texture2D(t0, uv);
        else if (k < 1.5) col = texture2D(t1, uv);
        else col = texture2D(t2, uv);
        gl_FragColor = col;
      }`
  });

export function DomeRenderer({ fovH = 160, quality = 'high' }) {
  const { gl, scene, camera, size } = useThree();

  const LEVELS = [1, 0.85, 0.7, 0.55];
  const [level, setLevel] = useState(0);
  const perf = useRef({ avg: 1 / 60, slow: 0, fast: 0 });

  const geom = useMemo(() => viewGeometry(fovH, size.width, size.height), [fovH, size.width, size.height]);

  const viewSize = useMemo(() => {
    const ratio = gl.getPixelRatio() * LEVELS[level];
    const pxPerRad = (size.width * ratio) / THREE.MathUtils.degToRad(fovH);
    const w = 2 * geom.tanX * pxPerRad;
    const h = (size.height * ratio * geom.tanY) / geom.tanV;
    const cap = tierOf(quality).faceCap * 1.1;
    const s = Math.min(1, cap / Math.max(w, h));
    return { w: Math.max(256, Math.round(w * s)), h: Math.max(256, Math.round(h * s)) };
  }, [size.width, size.height, gl, fovH, quality, level, geom]);

  const rig = useMemo(() => {
    const holder = new THREE.Object3D();
    const views = geom.yaws.map((yaw) => {
      const target = new THREE.WebGLRenderTarget(viewSize.w, viewSize.h, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false });
      const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2 * Math.atan(geom.tanY)), geom.tanX / geom.tanY, camera.near, camera.far);
      cam.rotation.y = -yaw;
      cam.layers.mask = camera.layers.mask;
      holder.add(cam);
      return { target, cam };
    });
    return { holder, views };
  }, [viewSize, geom, camera.near, camera.far, camera.layers]);

  const pipeline = useMemo(() => {
    const quadScene = new THREE.Scene();
    const material = remapMaterial();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    quadScene.add(quad);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(quadScene, ortho));
    composer.addPass(
      new EffectPass(
        ortho,
        new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1, luminanceSmoothing: 0.2, intensity: 0.7, radius: 0.75 }),
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
        new VignetteEffect({ offset: 0.32, darkness: 0.45 }),
        new SMAAEffect()
      )
    );
    return { composer, material };
  }, [gl]);

  useEffect(() => {
    pipeline.composer.setSize(size.width, size.height);
  }, [pipeline, size]);

  useEffect(() => () => rig.views.forEach((v) => v.target.dispose()), [rig]);

  useEffect(
    () => () => {
      pipeline.composer.dispose();
      pipeline.material.dispose();
      gl.shadowMap.autoUpdate = true;
    },
    [pipeline, gl]
  );

  useFrame((_, dt) => {
    const p = perf.current;
    p.avg += (Math.min(dt, 0.25) - p.avg) * 0.05;
    if (p.avg > 1 / 40) (p.slow += dt), (p.fast = 0);
    else if (p.avg < 1 / 57) (p.fast += dt), (p.slow = 0);
    else p.slow = p.fast = 0;
    if (p.slow > 2 && level < LEVELS.length - 1) {
      p.slow = 0;
      setLevel(level + 1);
    } else if (p.fast > 6 && level > 0) {
      p.fast = 0;
      setLevel(level - 1);
    }

    runtime.perf.face = viewSize.w;
    runtime.perf.faceH = viewSize.h;
    runtime.perf.level = level;
    runtime.perf.faces = VIEWS;

    camera.updateMatrixWorld();
    rig.holder.position.copy(camera.position);
    rig.holder.quaternion.copy(camera.quaternion);
    rig.holder.updateMatrixWorld(true);

    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    const prevTarget = gl.getRenderTarget();
    const autoMatrix = scene.matrixWorldAutoUpdate;
    scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
    rig.views.forEach((v, i) => {
      if (i > 0) gl.info.render.frame -= 1;
      gl.setRenderTarget(v.target);
      gl.clear();
      gl.render(scene, v.cam);
      gl.shadowMap.needsUpdate = false;
    });
    scene.matrixWorldAutoUpdate = autoMatrix;
    gl.setRenderTarget(prevTarget);

    const u = pipeline.material.uniforms;
    u.t0.value = rig.views[0].target.texture;
    u.t1.value = rig.views[1].target.texture;
    u.t2.value = rig.views[2].target.texture;
    u.uHalfH.value = geom.halfH;
    u.uTanV.value = geom.tanV;
    u.uTanX.value = geom.tanX;
    u.uTanY.value = geom.tanY;
    pipeline.composer.render(dt);
  }, 1);

  return null;
}

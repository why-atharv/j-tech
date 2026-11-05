import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from './terrain.js';

export function Fireflies({ count = 700, radius = 34, intensity = 0.5 }) {
  const { geometry, material } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos[i * 3] = x;
      pos[i * 3 + 1] = heightAt(x, z) + 0.3 + Math.random() * 3.5;
      pos[i * 3 + 2] = z;
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader:  `
        uniform float uTime; uniform float uPixelRatio;
        attribute float aSeed; varying float vBlink;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.35 + aSeed) * 1.2;
          p.z += cos(uTime * 0.29 + aSeed * 1.7) * 1.2;
          p.y += sin(uTime * 0.8 + aSeed * 3.1) * 0.45;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vBlink = pow(0.5 + 0.5 * sin(uTime * (1.4 + fract(aSeed) * 2.2) + aSeed * 6.0), 3.0);
          gl_PointSize = (160.0 + 120.0 * vBlink) * uPixelRatio / -mv.z;
        }`,
      fragmentShader:  `
        uniform float uIntensity; varying float vBlink;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          a = a * a * (0.25 + vBlink) * uIntensity;
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.45) * 3.0 * a, a);
        }`
    });
    return { geometry: geo, material: mat };
  }, [count, radius]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uIntensity.value = THREE.MathUtils.lerp(material.uniforms.uIntensity.value, intensity, 0.03);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

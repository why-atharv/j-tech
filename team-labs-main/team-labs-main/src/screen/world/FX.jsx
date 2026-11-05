import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Burst({ color = '#ffffff', count = 160, speed = 4, up = 1, life = 1.8, size = 0.22, spin = 0 }) {
  const t0 = useRef(null);
  const { geometry, material } = useMemo(() => {
    const vel = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 0.9 + 0.1;
      const s = speed * (0.35 + Math.random() * 0.65);
      vel[i * 3] = Math.cos(a) * s * (1 - e * 0.6);
      vel[i * 3 + 1] = e * s * up + Math.random() * up * 1.5;
      vel[i * 3 + 2] = Math.sin(a) * s * (1 - e * 0.6);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uLife: { value: life }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uSpin: { value: spin } },
      vertexShader:  `
        uniform float uT; uniform float uLife; uniform float uSize; uniform float uSpin;
        attribute vec3 aVel; attribute float aSeed; varying float vA;
        void main() {
          float t = uT * (0.7 + aSeed * 0.6);
          float drag = 1.0 - exp(-t * 1.6);
          vec3 p = aVel * drag / 1.6;
          float ang = uSpin * t * (1.0 + aSeed);
          p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
          p.y -= 0.6 * t * t * (1.0 - step(0.5, uSpin));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = clamp(1.0 - t / uLife, 0.0, 1.0);
          gl_PointSize = uSize * 300.0 * (0.4 + vA) / -mv.z;
        }`,
      fragmentShader:  `
        uniform vec3 uColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(mix(uColor, vec3(1.0), smoothstep(0.25, 0.0, d)) * 4.0 * a, a);
        }`
    });
    return { geometry: geo, material: mat };
  }, [color, count, speed, up, life, size, spin]);

  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    material.uniforms.uT.value = state.clock.elapsedTime - t0.current;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

export function ShockRing({ color = '#ffffff', radius = 4, duration = 1.2 }) {
  const mesh = useRef();
  const t0 = useRef(null);
  useFrame((state) => {
    if (!mesh.current) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - t0.current) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    mesh.current.scale.setScalar(0.2 + e * radius);
    mesh.current.material.opacity = (1 - t) * 0.9;
    mesh.current.visible = t < 1;
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position-y={0.08}>
      <ringGeometry args={[0.82, 1, 64]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

export function Beam({ color = '#7cffb2', height = 60, duration = 2.6 }) {
  const mesh = useRef();
  const t0 = useRef(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 0 }, uT: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader:  `
          uniform vec3 uColor; uniform float uA; uniform float uT; varying vec2 vUv;
          void main() {
            float edge = 0.55;
            float fade = pow(1.0 - vUv.y, 1.6);
            float streak = 0.75 + 0.25 * sin(vUv.y * 40.0 - uT * 12.0);
            float a = edge * fade * streak * uA;
            gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * 3.0 * a, a);
          }`
      }),
    [color]
  );
  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = (state.clock.elapsedTime - t0.current) / duration;
    material.uniforms.uT.value = state.clock.elapsedTime;
    material.uniforms.uA.value = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88);
    if (mesh.current) mesh.current.scale.x = mesh.current.scale.z = 1 + t * 0.6;
  });
  return (
    <mesh ref={mesh} position-y={height / 2} material={material}>
      <cylinderGeometry args={[1.1, 1.6, height, 32, 1, true]} />
    </mesh>
  );
}

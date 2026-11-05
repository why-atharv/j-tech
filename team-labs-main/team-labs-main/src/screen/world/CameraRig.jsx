import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { runtime } from './atmosphere.js';
import { DOME_CAMERA } from './habitat.js';

const DOME_PITCH = THREE.MathUtils.degToRad(-7);

export function CameraRig({ free, view }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 2.4, 0));
  const angle = useRef(0.6);
  const tmp = useRef({ goal: new THREE.Vector3(), pos: new THREE.Vector3(), euler: new THREE.Euler(0, 0, 0, 'YXZ') });

  useFrame((state, rawDt) => {
    if (free) return;
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    const { goal, pos, euler } = tmp.current;
    runtime.shake *= Math.exp(-dt * 3);

    if (view === 'dome') {
      pos.set(DOME_CAMERA.x + Math.sin(t * 0.05) * 0.25, DOME_CAMERA.y + Math.sin(t * 0.08) * 0.08, DOME_CAMERA.z);
      camera.position.lerp(pos, 1 - Math.exp(-dt * 2));
      const s = runtime.shake * 0.006;
      euler.set(DOME_PITCH + Math.sin(t * 31) * s, Math.sin(t * 0.04) * 0.012 + Math.sin(t * 27) * s, 0);
      camera.quaternion.setFromEuler(euler);
      return;
    }

    angle.current += dt * 0.04;
    const focus = runtime.focus && performance.now() < runtime.focus.until ? runtime.focus.position : null;
    if (focus) goal.set(focus.x * 0.6, Math.min(focus.y, 6) * 0.5 + 1.5, focus.z * 0.6);
    else goal.set(0, 2.4, 0);
    look.current.lerp(goal, 1 - Math.exp(-dt * 0.6));

    const radius = 29 + Math.sin(t * 0.05) * 3;
    const x = Math.cos(angle.current) * radius;
    const z = Math.sin(angle.current) * radius;
    const y = Math.max(heightAt(x, z) + 3, 7 + Math.sin(t * 0.07) * 1.6);
    camera.position.lerp(pos.set(x, y, z), 1 - Math.exp(-dt * 1.5));

    const s = runtime.shake * 0.25;
    camera.lookAt(look.current.x + Math.sin(t * 37) * s, look.current.y + Math.sin(t * 41 + 1) * s, look.current.z + Math.cos(t * 33) * s);
  });

  return free ? <OrbitControls makeDefault target={[0, 1.5, 0]} maxPolarAngle={Math.PI * 0.48} minDistance={6} maxDistance={120} enableDamping /> : null;
}

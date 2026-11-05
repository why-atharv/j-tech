import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { POKE_KEYS, POKE_DEFS, instancePokemon, preparePokemon } from './pokemon.js';
import { warmMoves } from './moves.js';
import { Burst, ShockRing, Beam } from './FX.jsx';

const noop = () => {};

function WarmRigs() {
  const rigs = useMemo(() => {
    const quad = POKE_KEYS.find((k) => POKE_DEFS[k].mo?.fly === undefined);
    const bird = POKE_KEYS.find((k) => typeof POKE_DEFS[k].mo?.fly === 'number');
    return [quad, bird, quad, bird].filter(Boolean).map((k, i) => {
      const rig = instancePokemon(k);
      if (i > 1) rig.material.transparent = true;
      return rig;
    });
  }, []);
  useEffect(() => () => rigs.forEach((r) => r.material.dispose()), [rigs]);
  return rigs.map((r) => <primitive key={r.mesh.uuid} object={r.mesh} />);
}

function WarmMoves() {
  const fx = useMemo(() => warmMoves(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  return <primitive object={fx.group} />;
}

export function Warmup() {
  const { gl, scene, camera } = useThree();
  const [stage, setStage] = useState('wait');
  const born = useRef(performance.now());
  const frames = useRef(0);

  useEffect(() => {
    let i = 0;
    let timer;
    const step = () => {
      if (i >= POKE_KEYS.length) return;
      preparePokemon(POKE_KEYS[i++]);
      timer = setTimeout(step, 30);
    };
    timer = setTimeout(step, 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (stage !== 'fx') return;
    let alive = true;
    const t = setTimeout(() => {
      const compile = () => (gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera)));
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      const offscreen = compile();
      gl.setRenderTarget(prev);
      const onscreen = compile();
      Promise.all([offscreen, onscreen])
        .catch(noop)
        .finally(() => rt.dispose())
        .finally(() => alive && setStage('render'));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [stage, gl, scene, camera]);

  useFrame(() => {
    if (stage === 'wait' && scene.environment && performance.now() - born.current > 2500) setStage('fx');
    if (stage === 'render' && ++frames.current > 30) setStage('done');
  });

  if (stage === 'wait' || stage === 'done') return null;
  return (
    <group position={[0, -40, 0]}>
      <WarmRigs />
      <WarmMoves />
      <Sparkles count={12} scale={3} size={5} color="#ffd36b" />
      <Burst color="#ffd36b" count={40} />
      <ShockRing color="#ffd36b" />
      <Beam color="#ffd36b" height={10} />
    </group>
  );
}

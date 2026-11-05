import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Sky } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, SMAA, ToneMapping, Vignette, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { PRESETS, runtime, sunDirection } from './atmosphere.js';
import { tierOf } from './quality.js';
import { Warmup } from './Warmup.jsx';
import { Terrain } from './Terrain.jsx';
import { Grass } from './Grass.jsx';
import { Forest } from './Forest.jsx';
import { Water } from './Water.jsx';
import { Fireflies } from './Fireflies.jsx';
import { Animal } from './Animal.jsx';
import { CameraRig } from './CameraRig.jsx';
import { TagProjector } from '../hud/TagLayer.jsx';
import { Ambience } from './Ambience.jsx';
import { DomeRenderer } from './DomeRenderer.jsx';
import { Zoo } from './Zoo.jsx';
import { Pokeland } from './Pokeland.jsx';
import { pokeClock } from './pokekit.js';
import { fxConfig } from './moves.js';

const zoo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('zoo') : null;

const Lighting = memo(function Lighting({ preset, tier }) {
  const p = PRESETS[preset];
  const sun = useRef();
  const dir = useMemo(() => sunDirection(p), [p]);
  const skyAt = useMemo(() => dir.clone().multiplyScalar(100), [dir]);
  const envSky = useMemo(() => <Sky distance={4500} sunPosition={skyAt} {...p.sky} />, [skyAt, p]);
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
    return () => {
      scene.fog = null;
    };
  }, [scene, p]);

  useEffect(() => {
    if (!sun.current) return;
    sun.current.target.position.set(0, 0, 0);
    sun.current.target.updateMatrixWorld();
  }, []);

  const sunPos = dir.clone().multiplyScalar(80);
  if (sunPos.y < 18) sunPos.y = 18;

  return (
    <>
      <Sky distance={4500} sunPosition={skyAt} {...p.sky} />
      <Environment resolution={256} frames={1} environmentIntensity={p.env} key={preset}>
        {envSky}
      </Environment>
      <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
      <directionalLight
        key={tier.shadowMap}
        ref={sun}
        position={sunPos}
        color={p.sun}
        intensity={p.sunIntensity}
        castShadow={tier.shadows}
        shadow-mapSize={[tier.shadowMap, tier.shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
      />
    </>
  );
});

function PokeClock() {
  useFrame((state) => {
    pokeClock.value = state.clock.elapsedTime;
  });
  return null;
}

function Exposure({ value }) {
  const { gl } = useThree();
  useFrame(() => {
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, value, 0.05);
  });
  return null;
}

function useStaggered(list) {
  const admitted = useRef(new Set());
  const listRef = useRef(list);
  listRef.current = list;
  const [, bump] = useState(0);
  const pending = list.some((a) => a.state === 'alive' && !admitted.current.has(a.id));
  useEffect(() => {
    if (!pending) return;
    const step = () => {
      let n = 0;
      for (const a of listRef.current) {
        if (a.state !== 'alive' || admitted.current.has(a.id)) continue;
        admitted.current.add(a.id);
        if (++n >= 2) break;
      }
      bump((x) => x + 1);
      return n;
    };
    step();
    const id = setInterval(() => step() === 0 && clearInterval(id), 90);
    return () => clearInterval(id);
  }, [pending]);
  const live = new Set(list.map((a) => a.id));
  for (const id of admitted.current) if (!live.has(id)) admitted.current.delete(id);
  return list.filter((a) => admitted.current.has(a.id));
}

const MOOD = { lobby: 0.85, intro: 0.5, playing: 1, results: 0.72 };

export function World({ animals, timeOffset, preset, freeCam, quality, view, fovH, phase = 'playing' }) {
  const p = PRESETS[preset];
  runtime.quality = quality;
  const tier = tierOf(quality);
  fxConfig.scale = quality === 'low' ? 0.5 : quality === 'balanced' ? 0.75 : 1;
  const high = quality === 'high';
  const dome = view === 'dome';
  const shown = useStaggered(animals);
  const scenery = useMemo(
    () => (
      <>
        <Terrain />
        <Water />
        <Forest />
        {zoo === null && <Pokeland quality={quality} />}
        {zoo === null && <Grass count={dome ? tier.grass : tier.flatGrass} radius={dome ? 40 : high ? 42 : 34} />}
        <Fireflies intensity={p.fireflies} />
        <TagProjector view={view} fovH={fovH} />
        <Ambience preset={preset} butterflies={tier.butterflies} />
        <Warmup />
      </>
    ),
    [dome, tier, high, p, view, fovH, preset, quality]
  );
  return (
    <>
      <Lighting preset={preset} tier={tier} />
      <PokeClock />
      <Exposure value={p.exposure * (MOOD[phase] ?? 1)} />
      {zoo === null ? <CameraRig free={freeCam} view={view} /> : <Zoo run={zoo.startsWith('run')} page={Number(zoo.replace(/\D/g, '')) || 0} />}

      {scenery}

      {zoo === null && shown.map((a) => (
        <Animal key={a.id} data={a} timeOffset={timeOffset} />
      ))}

      {dome ? (
        <DomeRenderer key={`dome-${quality}`} fovH={fovH} quality={quality} />
      ) : high ? (
        <EffectComposer key="high" multisampling={0} enableNormalPass={false}>
          <N8AO halfRes aoRadius={1.6} intensity={2.4} distanceFalloff={0.8} quality="medium" />
          <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.75} radius={0.75} />
          <HueSaturation saturation={0.1} />
          <BrightnessContrast contrast={0.07} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.28} darkness={0.55} />
          <SMAA />
        </EffectComposer>
      ) : (
        <EffectComposer key="low" multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.6} radius={0.7} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.28} darkness={0.5} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

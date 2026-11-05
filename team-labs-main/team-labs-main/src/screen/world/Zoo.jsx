import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SPECIES } from '../../shared/species.js';
import { MODELS } from './models.js';
import { PokemonView } from './Animal.jsx';

function Exhibit({ species, x, run, fx, yaw }) {
  const motion = useRef({ key: species.key, gait: run ? 'run' : 'walk', speed: run ? 6 : run === false ? 0 : 2.2, animRate: 1, setGait: () => {}, fx: [], act: null });
  const next = useRef(1 + Math.random());
  const onReady = useMemo(() => () => {}, []);
  useFrame((state) => {
    if (fx && state.clock.elapsedTime > next.current) {
      motion.current.fx.push(species.fx);
      next.current = state.clock.elapsedTime + 4;
    }
  });
  return (
    <group position={[x, species.kind === 'air' ? 1.6 : 0, 0]} rotation-y={yaw}>
      <PokemonView species={species} motion={motion} onReady={onReady} />
    </group>
  );
}

export function Zoo({ run, page = 0 }) {
  const params = new URLSearchParams(window.location.search);
  const [view, setView] = useState(() => ({
    only: params.get('only'),
    page,
    yaw: Number(params.get('yaw') ?? Math.PI / 2),
    dist: Number(params.get('dist') ?? 0.62),
    fx: params.has('fx'),
    idle: params.has('idle'),
    act: null
  }));
  useEffect(() => {
    window.__zoo = (patch) => setView((v) => ({ ...v, ...patch }));
    return () => delete window.__zoo;
  }, []);
  const list = view.only ? view.only.split(',').map((k) => SPECIES.find((s) => s.key === k)).filter(Boolean) : SPECIES.filter((s) => MODELS[s.model]?.procedural).slice(view.page * 4, view.page * 4 + 4);
  const span = list.reduce((a, s) => a + MODELS[s.model].size + 0.6, 0);
  const { camera } = useThree();
  useFrame(() => {
    camera.position.set(0, 2.0, span * view.dist + 1.5);
    camera.lookAt(0, 1.3, 0);
  });
  let x = -span / 2;
  return list.map((s) => {
    const at = x + MODELS[s.model].size / 2;
    x += MODELS[s.model].size + 0.6;
    return <Exhibit key={`${s.key}${view.yaw}${view.idle}`} species={s} x={at} run={view.idle ? false : run} fx={view.fx} yaw={view.yaw} />;
  });
}

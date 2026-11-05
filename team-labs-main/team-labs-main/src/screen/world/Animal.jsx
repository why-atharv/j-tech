import { Component, Suspense, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { SPECIES_BY_KEY, RARITY } from '../../shared/species.js';
import { MODELS, GAITS, fitModel, getClip, variantMaterial } from './models.js';
import { instancePokemon, animatePokemon, POKE_DEFS } from './pokemon.js';
import { createMove } from './moves.js';
import { tierOf } from './quality.js';
import { heightAt, mulberry32 } from './terrain.js';
import { runtime } from './atmosphere.js';
import { habitat } from './habitat.js';
import { Burst, ShockRing, Beam } from './FX.jsx';
import { sound } from '../audio.js';

Object.values(MODELS).forEach((m) => m.url && useGLTF.preload(m.url));

const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const SHAKERS = new Set(['earthquake', 'bodyslam', 'thunder', 'fireblast']);

function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function ModelView({ species, motion, onReady }) {
  const cfg = MODELS[species.model];
  const gltf = useGLTF(cfg.url);

  const { object, mixer, actions, materials, fit } = useMemo(() => {
    const object = cloneSkinned(gltf.scene);
    const materials = [];
    const cache = new Map();
    object.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const swap = (m) => {
        if (!cache.has(m)) {
          const v = variantMaterial(m);
          cache.set(m, v);
          materials.push(v);
        }
        return cache.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    const mixer = new THREE.AnimationMixer(object);
    const actions = {};
    for (const [name, ref] of Object.entries(cfg.clips)) {
      const clip = getClip(gltf.animations, ref);
      if (clip) actions[name] = mixer.clipAction(clip);
    }
    return { object, mixer, actions, materials, fit: fitModel(gltf.scene, cfg.size) };
  }, [gltf, cfg]);

  useEffect(() => {
    onReady({ materials, height: fit.height });
    const first = actions[motion.current.gait] || Object.values(actions)[0];
    first?.reset().play();
    if (first) first.time = Math.random() * first.getClip().duration;
    let current = first;
    motion.current.setGait = (gait) => {
      const next = actions[gait];
      if (!next || next === current) return;
      next.reset().fadeIn(0.35).play();
      current?.fadeOut(0.35);
      current = next;
    };
    return () => {
      mixer.stopAllAction();
      materials.forEach((m) => m.dispose());
    };
  }, [actions, materials, mixer, fit, motion, onReady]);

  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1) * (motion.current.animRate || 1)));

  return (
    <group rotation-y={cfg.yaw} scale={fit.scale} position-y={fit.offsetY}>
      <primitive object={object} />
    </group>
  );
}

export function PokemonView({ species, motion, onReady }) {
  const cfg = MODELS[species.model];
  const { rig, scale, height } = useMemo(() => {
    const rig = instancePokemon(species.model);
    const scale = cfg.size / rig.extent;
    return { rig, scale, height: rig.height * scale };
  }, [species, cfg]);
  const holder = useRef();
  const moves = useRef([]);
  const state = useRef({ phase: Math.random(), blend: 0, look: 0, lookGoal: 0, turn: 0, time: 0, act: null, actT: 0, actW: 0, rollW: 0, rollA: 0, fly: 0, dive: 0, seed: Math.random() * 20 });

  useEffect(() => {
    onReady({ materials: [rig.material], height, glowScale: 0 });
    motion.current.setGait = () => {};
    const list = moves.current;
    return () => {
      rig.material.dispose();
      list.forEach((m) => m.dispose());
      list.length = 0;
    };
  }, [rig, height, motion, onReady]);

  useFrame((frame, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const m = motion.current;
    const st = state.current;
    const k = (rate) => 1 - Math.exp(-dt * rate);
    st.time = frame.clock.elapsedTime + st.seed;
    const speed = Math.max(0, m.speed || 0) / scale;
    st.run = m.gait === 'run';
    const stride = Math.max(0.08, (rig.j.hip || 0.5) * (st.run ? 3.4 : 2.1));
    st.phase = (st.phase + (speed * dt) / stride) % 1;
    st.blend += (Math.min(1, (m.speed || 0) / 0.4) - st.blend) * k(6);
    st.turn += ((m.turn || 0) - st.turn) * k(4);
    if (Math.random() < dt * 0.4) st.lookGoal = (Math.random() - 0.5) * 1.1;
    st.look += (st.lookGoal - st.look) * k(2);
    if (m.act && m.act !== st.act) {
      st.act = m.act;
      st.actT = 0;
    }
    st.actT += dt;
    st.actW += ((m.act ? 1 : 0) - st.actW) * k(5);
    if (!m.act && st.actW < 0.02) st.act = null;
    st.rollW += ((m.roll ? 1 : 0) - st.rollW) * k(6);
    if (st.rollW > 0.01) st.rollA += (speed * dt) / Math.max(0.1, rig.j.R || 0.3);
    st.fly += ((m.fly ? 1 : 0) - st.fly) * k(2.5);
    st.dive += ((m.dive ? 1 : 0) - st.dive) * k(3);
    animatePokemon(rig, st);

    while (m.fx?.length) {
      const mv = createMove(m.fx.shift(), rig, rig.height);
      holder.current?.add(mv.group);
      moves.current.push(mv);
    }
    if (moves.current.length) {
      moves.current = moves.current.filter((mv) => {
        if (mv.update(dt)) return true;
        mv.dispose();
        return false;
      });
    }
  });

  return (
    <group scale={scale} ref={holder}>
      <primitive object={rig.mesh} />
    </group>
  );
}

function FallbackView({ species, onReady }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: species.accent, roughness: 0.6, transparent: true }), [species]);
  useEffect(() => onReady({ materials: [material], height: 1.6 }), [material, onReady]);
  return (
    <mesh material={material} castShadow position-y={0.8}>
      <sphereGeometry args={[0.8, 20, 14]} />
    </mesh>
  );
}

class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('[POKEMONS WORLD] model failed, using fallback:', err?.message || err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const Animal = memo(AnimalView, (a, b) => a.data.id === b.data.id && a.data.state === b.data.state && a.timeOffset === b.timeOffset);

function AnimalView({ data, timeOffset = 0 }) {
  const species = SPECIES_BY_KEY[data.species];
  const def = POKE_DEFS[species.model];
  const mo = def?.mo || {};
  const rarity = RARITY[species.rarity];
  const air = species.kind === 'air';
  const isLegendary = species.rarity === 'legendary' || species.rarity === 'mythic';
  const gaits = GAITS[species.model] || (air ? GAITS.air : { walk: 2, run: 6, turn: 2, idle: true });
  const sizeMul = species.prize ? 0.82 : isLegendary ? 0.85 : 0.7;
  const speedMul = Math.pow(sizeMul, 0.6);

  const root = useRef();
  const rendered = useRef({ materials: [], height: 1.5 });
  const [tagY, setTagY] = useState(air ? 2 : 3);
  const motion = useRef({ key: species.key, gait: air ? 'fly' : 'walk', animRate: 1, setGait: () => {}, fx: [], act: null, roll: false, fly: false, dive: false, speed: 0, turn: 0 });

  const sim = useMemo(() => {
    const rng = mulberry32(data.seed);
    const start = habitat.mode === 'dome' ? (air ? habitat.randomPoint(rng) : habitat.spawnPoint(rng, undefined, data.id)) : new THREE.Vector2(data.x, data.z);
    const pat = mo.pattern || 'orbit';
    const alt = mo.alt || [5.8, 9];
    const bornAt = performance.now() / 1000 - Math.max(0, (Date.now() + timeOffset - data.bornAt) / 1000);
    const s = {
      rng,
      seedA: rng() * 100,
      pos: new THREE.Vector3(start.x, heightAt(start.x, start.y), start.y),
      heading: rng() * Math.PI * 2,
      turnVel: 0,
      speed: 0,
      lean: 0,
      target: new THREE.Vector2(),
      steer: new THREE.Vector2(),
      edge: new THREE.Vector2(),
      idleUntil: 0,
      moveUntil: 0,
      nextGait: null,
      flyH: 0,
      flyUntil: 0,
      center: air ? habitat.skyPoint(rng, undefined, data.id) : new THREE.Vector2(),
      centerGoal: new THREE.Vector2(),
      orbitR: pat === 'flutter' ? 3 + rng() * 2 : pat === 'soar' || pat === 'royal' ? 7.5 + rng() * 4 : pat === 'figure8' ? 6 + rng() * 2 : 5 + rng() * 5,
      orbitA: rng() * Math.PI * 2,
      orbitDir: rng() < 0.5 ? 1 : -1,
      altitude: alt[0] + rng() * (alt[1] - alt[0]),
      roll: 0,
      mover: new THREE.Vector4(),
      phase: data.state,
      phaseAt: performance.now() / 1000,
      bornAt,
      nextMove: bornAt + 1.4 + rng() * 1.8,
      nextTp: bornAt + 5 + rng() * 5,
      tp: null,
      lift: 0,
      spin: 0
    };
    s.pickTarget = () => {
      habitat.roamPoint(rng, s.pos.x, s.pos.z, s.target, data.id);
      s.closest = Infinity;
    };
    s.pickTarget();
    if (!air) runtime.goals.set(data.id, s.target);
    if (air) {
      s.centerGoal.copy(s.center);
      runtime.skies.set(data.id, s.centerGoal);
      s.pos.set(s.center.x + Math.cos(s.orbitA) * s.orbitR, s.altitude, s.center.y + Math.sin(s.orbitA) * s.orbitR);
    }
    return s;
  }, [data.id]);

  useEffect(() => {
    if (sim.phase !== data.state) {
      sim.phase = data.state;
      sim.phaseAt = performance.now() / 1000;
      if (data.state === 'captured') {
        runtime.shake = Math.max(runtime.shake, isLegendary ? 1 : 0.45);
        motion.current.fx.push(species.fx);
        sound.cry(species.key, 1);
      }
      if (data.state !== 'alive') {
        root.current?.traverse((o) => (o.castShadow = false));
        runtime.goals.delete(data.id);
        runtime.skies.delete(data.id);
      }
    }
  }, [data.state, sim, isLegendary, species]);

  useEffect(() => {
    if (isLegendary && data.state === 'alive') runtime.focus = { position: sim.pos, until: performance.now() + 7000 };
    return () => {
      runtime.movers.delete(data.id);
      runtime.skies.delete(data.id);
      runtime.goals.delete(data.id);
      runtime.anchors.delete(data.id);
      runtime.targets.delete(data.id);
      if (runtime.focus?.position === sim.pos) runtime.focus = null;
    };
  }, [data.id]);

  const onReady = useMemo(
    () => (info) => {
      rendered.current = info;
      setTagY(info.height * sizeMul + (air ? 1.2 : 0.9) + (mo.hover || 0) * sizeMul);
    },
    [air, sizeMul, mo.hover]
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = state.clock.elapsedTime;
    const t = performance.now() / 1000;
    const g = root.current;
    if (!g) return;
    const ease = (rate) => 1 - Math.exp(-dt * rate);
    const m = motion.current;

    let fade = 1;
    if (sim.phase === 'alive') {
      if (air) stepFlight(sim, gaits, dt, now, speedMul, data.id, mo, m);
      else stepGround(sim, gaits, dt, now, data.id, m, mo, ease, sizeMul, speedMul);
      if (t > sim.nextMove && t - sim.bornAt > 1.2) {
        m.fx.push(species.fx);
        if (SHAKERS.has(species.fx)) runtime.shake = Math.max(runtime.shake, 0.3);
        sound.move(species.fx, sim.pos);
        sim.nextMove = t + (isLegendary ? 7 + sim.rng() * 5 : 11 + sim.rng() * 9);
      }
      if (mo.teleport) {
        if (!sim.tp && t > sim.nextTp) {
          sim.tp = { t0: t, moved: false };
          m.fx.push('psychic');
        }
        if (sim.tp) {
          const k = (t - sim.tp.t0) / 0.8;
          fade = 1 - Math.sin(Math.min(1, k) * Math.PI);
          if (k > 0.5 && !sim.tp.moved) {
            sim.tp.moved = true;
            habitat.roamPoint(sim.rng, sim.pos.x, sim.pos.z, sim.target, data.id);
            sim.pos.x = sim.target.x;
            sim.pos.z = sim.target.y;
            sim.pickTarget();
          }
          if (k >= 1) {
            sim.tp = null;
            sim.nextTp = t + 6 + sim.rng() * 6;
          }
        }
      }
    }

    const age = t - sim.bornAt;
    let scale = easeOutBack(clamp01(age / 1.1)) * sizeMul * (0.35 + 0.65 * fade);
    let opacity = fade;
    let glow = 0;
    const pt = t - sim.phaseAt;
    if (sim.phase === 'captured') {
      const e = clamp01(pt / 2.6);
      sim.lift = e * e * 3.5;
      sim.spin += dt * (2 + e * 10);
      scale *= 1 - THREE.MathUtils.smoothstep(e, 0.55, 1);
      glow = Math.min(1, pt * 2);
      m.animRate = 2;
    } else if (sim.phase === 'leaving') {
      const e = clamp01(pt / 1.8);
      opacity = 1 - e;
      scale *= 1 - e * 0.4;
    }

    g.position.set(sim.pos.x, sim.pos.y + sim.lift, sim.pos.z);
    g.rotation.set(0, sim.heading + sim.spin, 0);
    g.rotateZ(air ? sim.roll : sim.lean);
    g.scale.setScalar(Math.max(0.0001, scale));

    for (const mat of rendered.current.materials) {
      const clear = opacity < 0.999 || !!mat.userData.alwaysTransparent;
      if (mat.transparent !== clear || !mat.forceSinglePass) {
        mat.transparent = clear;
        mat.forceSinglePass = true;
        mat.needsUpdate = true;
      }
      mat.opacity = opacity;
      mat.depthWrite = opacity > 0.98;
      if (mat.emissive) {
        const pulse = species.glow ? (0.18 + Math.sin(now * 3) * 0.1) * (rendered.current.glowScale ?? 1) : 0;
        mat.emissive.set(species.glow || '#ffffff');
        mat.emissiveIntensity = pulse + glow * 2.2;
      }
    }

    sim.mover.set(sim.pos.x, sim.pos.y, sim.pos.z, air || sim.phase !== 'alive' ? 0 : 2.2 * sizeMul);
    runtime.movers.set(data.id, sim.mover);
    if (sim.phase === 'alive' && fade > 0.4) {
      sim.anchor ??= new THREE.Vector3();
      sim.anchor.set(g.position.x, g.position.y + tagY * Math.min(1, scale / sizeMul), g.position.z);
      runtime.anchors.set(data.id, sim.anchor);
      sim.hitbox ??= { center: new THREE.Vector3(), radius: 1 };
      const h = rendered.current.height * scale;
      sim.hitbox.center.set(g.position.x, g.position.y + (air ? 0 : h * 0.5), g.position.z);
      sim.hitbox.radius = Math.max(h * 0.6, (MODELS[species.model].size || 3) * 0.42 * scale);
      runtime.targets.set(data.id, sim.hitbox);
    } else {
      runtime.anchors.delete(data.id);
      runtime.targets.delete(data.id);
    }
  });

  const fallback = <FallbackView species={species} onReady={onReady} />;
  const sparkles = species.glow ? tierOf(runtime.quality).sparkles : 0;

  return (
    <>
      <group ref={root}>
        <ModelBoundary fallback={fallback}>
          <Suspense fallback={null}>{MODELS[species.model].procedural ? <PokemonView species={species} motion={motion} onReady={onReady} /> : <ModelView species={species} motion={motion} onReady={onReady} />}</Suspense>
        </ModelBoundary>
        {sparkles > 0 && <Sparkles count={sparkles} scale={[2.6, 3.4, 2.6]} position-y={1.4 + (mo.hover || 0)} size={4} speed={0.6} color={species.glow} noise={1} />}
      </group>
      <PhaseFX data={data} species={species} rarity={rarity} sim={sim} timeOffset={timeOffset} />
    </>
  );
}

const PERSONAL = 2.6;

function stepGround(sim, gaits, dt, now, id, motion, mo, ease, sizeMul = 1, speedMul = 1) {
  let wantSpeed = 0;
  const range = (r, d) => (r ? r[0] + sim.rng() * (r[1] - r[0]) : d);

  if (now < sim.idleUntil) {
    sim.turnVel += (0 - sim.turnVel) * ease(6);
  } else {
    if (motion.act) motion.act = null;
    if (sim.nextGait) {
      motion.gait = sim.nextGait;
      sim.nextGait = null;
    }
    const dx = sim.target.x - sim.pos.x;
    const dz = sim.target.y - sim.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < sim.closest - 0.5) {
      sim.closest = dist;
      sim.progressAt = now;
    }
    const tired = mo.burst && sim.moveUntil && now > sim.moveUntil;
    if (dist < 1.4 || now - sim.progressAt > 3.5 || tired) {
      sim.pickTarget();
      sim.progressAt = now;
      const gait = sim.rng() < (mo.runChance ?? 0.35) ? 'run' : 'walk';
      if (tired || sim.rng() < (mo.idleChance ?? 0.2)) {
        sim.idleUntil = now + range(mo.idle, 2 + sim.rng() * 2);
        sim.progressAt = sim.idleUntil;
        motion.act = mo.act || 'look';
        if (mo.act === 'sleep') motion.fx.push('zzz');
        if (mo.act === 'charge') motion.fx.push('charge');
        if (mo.act === 'psy') motion.fx.push('psystrike');
        if (mo.act === 'wave' || mo.act === 'roar' || mo.act === 'flex' || mo.act === 'jump') sound.cry(motion.key, 0.55);
        sim.nextGait = gait;
        sim.moveUntil = mo.burst ? sim.idleUntil + range(mo.burst, 3) : 0;
      } else {
        motion.gait = gait;
        if (mo.burst && !sim.moveUntil) sim.moveUntil = now + range(mo.burst, 3);
        if (mo.takeoff && !motion.fly && sim.rng() < 0.4) {
          motion.fly = true;
          sim.flyUntil = now + 5 + sim.rng() * 3;
        }
      }
    }
    if (motion.fly && now > sim.flyUntil) motion.fly = false;

    sim.steer.set(dx, dz).normalize();
    for (const [otherId, o] of runtime.movers) {
      if (otherId === id || o.w <= 0) continue;
      const ax = sim.pos.x - o.x;
      const az = sim.pos.z - o.z;
      const d = Math.hypot(ax, az);
      if (d < 4.5 && d > 1e-3) sim.steer.addScaledVector(sim.edge.set(ax / d, az / d), ((4.5 - d) / 4.5) * 3);
    }
    if (now > (sim.retarget || 0) && habitat.crowd(sim.target.x, sim.target.y, id) < 0.6) {
      sim.retarget = now + 2.5;
      sim.pickTarget();
      sim.progressAt = now;
    }
    habitat.edgeForce(sim.pos.x, sim.pos.z, sim.edge);
    sim.steer.addScaledVector(sim.edge, 0.8);

    let desired = Math.atan2(sim.steer.x, sim.steer.y);
    if (mo.zig && sim.speed > 0.5) desired += Math.sin(now * (mo.zigF ?? 3) + sim.seedA) * mo.zig;
    const diff = angleDelta(sim.heading, desired);
    const goalTurn = THREE.MathUtils.clamp(diff * 2.2, -gaits.turn, gaits.turn);
    sim.turnVel += (goalTurn - sim.turnVel) * ease(mo.zig ? 8 : 5);
    wantSpeed = (gaits[motion.gait] || gaits.run || gaits.walk) * speedMul * (1 - Math.min(0.5, Math.abs(diff) / Math.PI)) * (motion.fly ? 1.7 : 1);
  }

  sim.heading += sim.turnVel * dt;
  sim.speed += (wantSpeed - sim.speed) * ease(wantSpeed > sim.speed ? (mo.straight ? 1.2 : 1.8) : 3);
  sim.pos.x += Math.sin(sim.heading) * sim.speed * dt;
  sim.pos.z += Math.cos(sim.heading) * sim.speed * dt;
  for (const [otherId, o] of runtime.movers) {
    if (otherId === id || o.w <= 0) continue;
    const ax = sim.pos.x - o.x;
    const az = sim.pos.z - o.z;
    const d = Math.hypot(ax, az);
    if (d < PERSONAL && d > 1e-3) {
      const push = (PERSONAL - d) * ease(5);
      sim.pos.x += (ax / d) * push;
      sim.pos.z += (az / d) * push;
    }
  }
  sim.flyH += ((motion.fly ? 3.4 : 0) - sim.flyH) * ease(1.6);
  const ground = heightAt(sim.pos.x, sim.pos.z) + (mo.hover || 0) * sizeMul + sim.flyH;
  sim.pos.y += (ground - sim.pos.y) * ease(10);
  sim.lean += (-sim.turnVel * sim.speed * 0.012 - sim.lean) * ease(4);
  motion.roll = !!mo.roll && motion.gait === 'run' && sim.speed > 0.6;
  motion.speed = sim.speed / sizeMul;
  motion.turn = sim.turnVel;
}

function stepFlight(sim, gaits, dt, now, speedMul, id, mo, motion) {
  const pat = mo.pattern || 'orbit';
  if (sim.center.distanceTo(sim.centerGoal) < 2.5) habitat.skyPoint(sim.rng, sim.centerGoal, id);
  sim.center.lerp(sim.centerGoal, 1 - Math.exp(-dt * 0.2));
  let speed = gaits.fly * speedMul;
  if (pat === 'dart') {
    if (now > (sim.dartAt || 0)) {
      sim.dartAt = now + 0.45 + sim.rng() * 0.9;
      if (sim.rng() < 0.45) sim.orbitDir *= -1;
      sim.dartK = 0.6 + sim.rng() * 0.9;
    }
    speed *= sim.dartK || 1;
  }
  let hovering = false;
  if (pat === 'zig') {
    hovering = (now + sim.seedA) % 3.2 > 2.2;
    speed *= hovering ? 0.04 : 1.3;
  }
  if (pat === 'royal') speed *= 0.8;
  sim.orbitA += (speed / sim.orbitR) * dt * sim.orbitDir;
  const a = sim.orbitA;
  let x;
  let z;
  if (pat === 'figure8') {
    x = Math.sin(a) * sim.orbitR;
    z = Math.sin(a) * Math.cos(a) * sim.orbitR;
  } else {
    const rr = sim.orbitR * (pat === 'zig' ? 1 + Math.sin(a * 7) * 0.14 : 1);
    x = Math.cos(a) * rr;
    z = Math.sin(a) * rr;
  }
  let alt = sim.altitude;
  if (pat === 'flutter') alt += Math.sin(now * 1.7 + sim.seedA) * 0.6 + Math.sin(now * 0.4) * 0.5;
  else if (pat === 'dance') alt += Math.sin(a * 2) * 1.4;
  else alt += Math.sin(now * 0.6 + sim.orbitR) * 0.8;
  if (pat === 'zig' || pat === 'dart') alt += Math.sin(now * 9 + sim.seedA) * (hovering ? 0.06 : 0.15);
  let dip = 0;
  if (mo.dive) {
    if (!sim.diveAt) sim.diveAt = now + 4 + sim.rng() * 6;
    if (now > sim.diveAt) {
      sim.diving = now;
      sim.diveAt = now + 9 + sim.rng() * 8;
    }
    if (sim.diving) {
      const k = clamp01((now - sim.diving) / 3.2);
      dip = Math.sin(k * Math.PI);
      if (k >= 1) sim.diving = 0;
    }
    alt += (1.6 - alt) * dip;
  }
  motion.dive = dip > 0.25;
  const nx = sim.center.x + x;
  const nz = sim.center.y + z;
  const dx = nx - sim.pos.x;
  const dz = nz - sim.pos.z;
  let rate = 0;
  if (dx * dx + dz * dz > 1e-7) {
    const d = angleDelta(sim.heading, Math.atan2(dx, dz));
    const step = d * (1 - Math.exp(-dt * 8));
    sim.heading += step;
    rate = step / Math.max(dt, 1e-3);
  }
  sim.pos.set(nx, alt, nz);
  sim.roll += (THREE.MathUtils.clamp(-rate * 0.25, -0.65, 0.65) - sim.roll) * (1 - Math.exp(-dt * 3));
}

function PhaseFX({ data, species, rarity, sim, timeOffset }) {
  const [spawnAt] = useState(() => sim.pos.clone());
  const fresh = Date.now() + timeOffset - data.bornAt < 4000;
  const color = species.glow || species.accent || rarity.color;
  const big = species.rarity === 'legendary' || species.rarity === 'mythic';
  const at = sim.pos.clone();
  const lowFx = tierOf(runtime.quality).sparkles === 0;
  return (
    <>
      {fresh && data.state === 'alive' && (
        <group position={[spawnAt.x, heightAt(spawnAt.x, spawnAt.z), spawnAt.z]}>
          <ShockRing color={color} radius={big ? 9 : 5} />
          <Burst color={color} count={(big ? 260 : 120) * (lowFx ? 0.5 : 1)} speed={3.5} up={1.2} />
        </group>
      )}
      {data.state === 'captured' && (
        <group position={[at.x, heightAt(at.x, at.z), at.z]}>
          <Beam color={color} height={big ? 60 : 22} duration={big ? 2.6 : 1.4} />
          <ShockRing color={color} radius={big ? 10 : 4} duration={big ? 1.6 : 1} />
          <Burst color={color} count={(big ? 380 : 90) * (lowFx ? 0.5 : 1)} speed={big ? 7 : 4} up={2.2} spin={1.5} life={big ? 2.6 : 1.4} size={big ? 0.3 : 0.18} />
        </group>
      )}
      {data.state === 'leaving' && (
        <group position={[at.x, at.y, at.z]}>
          <Burst color="#d8f3ff" count={90} speed={1.5} up={1.5} life={1.8} />
        </group>
      )}
    </>
  );
}

import * as THREE from 'three';
import { instancePokemon, animatePokemon, setPokeLite, pokeClock, POKE_DEFS } from '../screen/world/pokemon.js';
import { createMove, fxConfig } from '../screen/world/moves.js';

export function startReveal(canvas, key, { lite = false, fx, color = '#c77dff' } = {}) {
  setPokeLite(lite);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: lite ? 'low-power' : 'default' });
  const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  scene.add(new THREE.HemisphereLight('#fff4e6', '#40305a', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(2.5, 4, 3.5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(color, 2.2);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  const rig = instancePokemon(key);
  const def = POKE_DEFS[key];
  const air = typeof def.mo?.fly === 'number';
  const S = 2.3 / rig.extent;
  const holder = new THREE.Group();
  holder.scale.setScalar(S);
  holder.add(rig.mesh);
  const stage = new THREE.Group();
  stage.add(holder);
  scene.add(stage);
  const h = rig.height * S;
  const lift = air ? 0.9 : (def.mo?.hover || 0) * 0.4;
  holder.position.y = lift;

  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  scene.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.36, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  const fit = () => {
    const w = canvas.clientWidth || 300;
    const hh = canvas.clientHeight || 300;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    const top = Math.max(h + lift, 1.4);
    const dist = Math.max(top / (2 * Math.tan(THREE.MathUtils.degToRad(17))) * 1.25, 2.6 / camera.aspect * 1.1);
    camera.position.set(0, top * 0.55 + 0.3, dist);
    camera.lookAt(0, top * 0.45, 0);
    camera.updateProjectionMatrix();
    fxConfig.px = renderer.domElement.height * 0.42;
  };
  fit();
  window.addEventListener('resize', fit);
  fxConfig.scale = lite ? 0.45 : 0.85;

  const st = { phase: 0, blend: 0, look: 0, turn: 0, time: 0, act: null, actT: 0, actW: 0, rollW: 0, rollA: 0, fly: 0, dive: 0, run: false, seed: 0 };
  const moves = [];
  const cues = [0.5, 2.7];
  let raf = 0;
  let last = performance.now();
  let t = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    pokeClock.value = t;
    st.time = t;
    st.phase = (st.phase + dt * 0.7) % 1;
    st.blend = 0.35;
    st.look = Math.sin(t * 0.8) * 0.4;
    if (def.mo?.act && t > 1.6 && t < 3.6) {
      st.act = def.mo.act;
      st.actT += dt;
      st.actW = Math.min(1, st.actW + dt * 3);
    } else st.actW = Math.max(0, st.actW - dt * 3);
    animatePokemon(rig, st);
    stage.rotation.y = Math.sin(t * 0.55) * 0.6 + 0.35;
    ring.scale.setScalar(1 + Math.sin(t * 3) * 0.04);
    while (cues.length && t > cues[0]) {
      cues.shift();
      const mv = createMove(fx || 'psychic', rig, rig.height);
      holder.add(mv.group);
      moves.push(mv);
    }
    for (let i = moves.length - 1; i >= 0; i--) {
      if (!moves[i].update(dt)) {
        moves[i].dispose();
        moves.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', fit);
    moves.forEach((m) => m.dispose());
    rig.material.dispose();
    disc.geometry.dispose();
    disc.material.dispose();
    ring.geometry.dispose();
    ring.material.dispose();
    renderer.dispose();
    fxConfig.px = 300;
    fxConfig.scale = 1;
  };
}

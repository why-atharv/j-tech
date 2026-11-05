import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, scannerUrlFor } from './useGame.js';
import { sound } from './audio.js';
import { narrator } from './narrator.js';
import { World } from './world/World.jsx';
import { PRESET_ORDER, runtime } from './world/atmosphere.js';
import { Reticles } from './hud/Reticles.jsx';
import { Partners, TopBar, Leaderboard, Banner, Help, Loader } from './hud/Hud.jsx';
import { LobbyPanel, JoinCorner, CalibrationMark, RoundTimer, IntroTimer, ResultsPanel, Subtitles } from './hud/Phases.jsx';
import { SPECIES_BY_KEY, PRIZE_KEY } from '../shared/species.js';
import { INTRO, LINES } from '../shared/narration.js';
import { comboMultiplier } from '../shared/engine.js';
import { habitat } from './world/habitat.js';
import { loadModelOverrides } from './world/models.js';
import { PerfProbe } from './world/Perf.jsx';
import { PerfOverlay } from './hud/PerfOverlay.jsx';
import { TIER_ORDER, TIERS, recommendedTier, tierOf } from './world/quality.js';

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(`pokeworld:${k}`)) ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(`pokeworld:${k}`, JSON.stringify(v));
  } catch (err) {
    void err;
  }
};

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [preset, setPreset] = useState(() => load('preset', 'golden'));
  const [quality, setQuality] = useState(() => (TIERS[load('quality', 'high')] ? load('quality', 'high') : 'high'));
  const [autoQuality, setAutoQuality] = useState(() => load('autoQuality', true));
  const [perfOpen, setPerfOpen] = useState(() => params.has('perf'));
  const autoRef = useRef(autoQuality);
  autoRef.current = autoQuality;
  const [view, setView] = useState(() => params.get('view') || load('view', 'dome'));
  const [fovH, setFovH] = useState(() => Number(params.get('fov')) || load('fov', 160));
  const [labelScale, setLabelScale] = useState(() => load('labels', 1));
  const [freeCam, setFreeCam] = useState(false);
  habitat.mode = view;
  habitat.fovH = fovH;
  const [hud, setHud] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => sound.prepare(), 800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    loadModelOverrides().finally(() => setModelsReady(true));
  }, []);
  const [muted, setMuted] = useState(() => load('muted', false));
  const [soundOn, setSoundOn] = useState(false);
  const [banner, setBanner] = useState(null);
  const bannerTimer = useRef();
  const keyRef = useRef(0);
  const operatorRef = useRef(() => {});
  const phaseRef = useRef('lobby');
  const snapRef = useRef(null);

  const showBanner = useCallback((b, ms) => {
    clearTimeout(bannerTimer.current);
    setBanner({ ...b, key: ++keyRef.current });
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  const onEvent = useCallback(
    (ev) => {
      if (ev.type === 'phase') {
        if (ev.phase === 'intro') {
          narrator.say(INTRO, { interrupt: true }).then(() => setTimeout(() => phaseRef.current === 'intro' && operatorRef.current('skip'), 1500));
        } else if (ev.phase === 'playing') {
          if (narrator.lastKey !== 'intro6') narrator.say('intro6', { interrupt: true });
        } else if (ev.phase === 'lobby') {
          setTimeout(() => narrator.say('lobby', { interrupt: true }), 2500);
        } else if (ev.phase === 'results') {
          narrator.say(['end', 'results'], { interrupt: true });
          setTimeout(() => narrator.say('goodbye'), 26000);
        }
        return;
      }
      if (ev.type === 'call') {
        narrator.say(ev.line, { interrupt: ev.line === 'countdown' || ev.line === 'emblem' });
        if (ev.line === 'frenzy') showBanner({ kind: 'frenzy' }, 4500);
        return;
      }
      const s = SPECIES_BY_KEY[ev.animal?.species];
      if (!s) return;
      if (ev.type === 'spawn') {
        sound.spawn(s.rarity);
        if (s.rarity !== 'common') setTimeout(() => sound.cry(s.key, s.rarity === 'rare' ? 0.6 : 1), 600);
        if (s.rarity === 'mythic') {
          showBanner({ kind: 'mythic', species: s.key }, 7000);
        } else if (s.rarity === 'legendary') {
          showBanner({ kind: 'legendary', species: s.key }, 5000);
          if (phaseRef.current === 'playing' && !narrator.playing) narrator.say('legendary');
        }
      } else if (ev.type === 'capture') {
        sound.capture(s.rarity);
        const big = s.rarity === 'legendary' || s.rarity === 'mythic';
        if (ev.aim) {
          const mult = comboMultiplier(ev.combo || 1);
          runtime.popups.push({
            x: ev.aim.x,
            y: ev.aim.y,
            color: ev.ranger?.color,
            big,
            text: `+${ev.points.toLocaleString()}`,
            sub: `${ev.ranger?.name}${mult > 1 ? ` · ×${mult}` : ''}${ev.frenzy ? ' · 2×' : ''}`
          });
        }
        if (ev.prize) {
          showBanner({ kind: 'prize', species: s.key, ranger: ev.ranger?.name, points: ev.points }, 7000);
        } else if (big) {
          showBanner({ kind: 'capture', species: s.key, ranger: ev.ranger?.name, points: ev.points }, 2400);
        }
      }
    },
    [showBanner]
  );

  const { snapshot, mode, info, timeOffset, spawn, operator } = useGame(onEvent);
  operatorRef.current = operator;
  const scannerUrl = scannerUrlFor(mode === 'live' ? info : null);
  const phase = snapshot.phase || 'lobby';
  phaseRef.current = phase;
  snapRef.current = snapshot;

  useEffect(() => save('preset', preset), [preset]);
  useEffect(() => save('quality', quality), [quality]);
  useEffect(() => save('autoQuality', autoQuality), [autoQuality]);

  const onGpu = useCallback((gpuClass, name) => {
    console.info('[POKEMONS WORLD] GPU:', name, '(' + gpuClass + ')');
    if (autoRef.current) setQuality(recommendedTier(gpuClass));
  }, []);

  useEffect(() => {
    let bad = 0;
    const id = setInterval(() => {
      const p = runtime.perf;
      if (!autoRef.current || !p.fps) return;
      const between = phaseRef.current === 'lobby' || phaseRef.current === 'results';
      bad = p.fps < 42 && (p.face === 0 || p.level >= 2) ? bad + 1 : 0;
      if (bad >= 3 && between) {
        bad = 0;
        setQuality((q) => TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(q) + 1)]);
      }
    }, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let lock = null;
    const grab = () => {
      if (document.visibilityState !== 'visible' || lock) return;
      navigator.wakeLock?.request('screen').then((l) => {
        lock = l;
        l.addEventListener('release', () => (lock = null));
      }).catch(() => {});
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    window.addEventListener('pointerdown', grab);
    return () => {
      document.removeEventListener('visibilitychange', grab);
      window.removeEventListener('pointerdown', grab);
      lock?.release().catch(() => {});
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const alive = (snapRef.current?.animals || []).filter((a) => a.state === 'alive');
      if (!alive.length || narrator.playing) return;
      const pick = alive[Math.floor(Math.random() * alive.length)];
      sound.cry(pick.species, 0.35);
    }, 5200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => save('labels', labelScale), [labelScale]);
  useEffect(() => save('view', view), [view]);
  useEffect(() => save('fov', fovH), [fovH]);
  useEffect(() => {
    habitat.mode = view;
    habitat.fovH = fovH;
  }, [view, fovH]);
  useEffect(() => {
    save('muted', muted);
    sound.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    let woke = false;
    const unlock = () => {
      if (woke && sound.ready) return;
      woke = true;
      sound.unlock();
      sound.setMuted(load('muted', false));
      narrator.preload(Object.keys(LINES));
      setSoundOn(true);
    };
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      unlock();
      if (e.key === 'F2') {
        e.preventDefault();
        setPerfOpen((v) => !v);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        operatorRef.current(phaseRef.current === 'lobby' ? 'start' : phaseRef.current === 'intro' ? 'skip' : phaseRef.current === 'results' ? 'lobby' : 'noop');
      } else if (k === 'n') operatorRef.current('skip');
      else if (k === 'e') operatorRef.current('end');
      else if (k === 'r') operatorRef.current('lobby');
      else if (k === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (k === 'h') setHud((v) => !v);
      else if (k === 't') setPreset((p) => PRESET_ORDER[(PRESET_ORDER.indexOf(p) + 1) % PRESET_ORDER.length]);
      else if (k === 'o') setFreeCam((v) => !v);
      else if (k === 'd') setView((v) => (v === 'dome' ? 'flat' : 'dome'));
      else if (k === '[') setFovH((f) => Math.max(90, f - 10));
      else if (k === ']') setFovH((f) => Math.min(200, f + 10));
      else if (k === 'q') {
        setAutoQuality(false);
        setQuality((q) => TIER_ORDER[(TIER_ORDER.indexOf(q) + 1) % TIER_ORDER.length]);
      } else if (k === 'a') setAutoQuality((v) => !v);
      else if (k === 'm') setMuted((m) => !m);
      else if (k === 'l') spawn('legendary');
      else if (k === 'k') spawn(PRIZE_KEY);
      else if (k === '+' || k === '=') setLabelScale((s) => Math.min(2, +(s + 0.1).toFixed(1)));
      else if (k === '-' || k === '_') setLabelScale((s) => Math.max(0.6, +(s - 0.1).toFixed(1)));
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', onKey);
    };
  }, [spawn]);

  return (
    <div className={`app phase-${phase}`} style={{ '--label': labelScale }}>
      <Canvas
        className="canvas"
        flat
        shadows={{ type: tierOf(quality).ao ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap }}
        dpr={view === 'dome' ? 1 : [1, 1.5]}
        camera={{ position: [28, 12, 14], fov: 48, near: 0.3, far: 1600 }}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        onCreated={(state) => {
          if (import.meta.env.DEV) window.__r3f = state;
        }}
      >
        <PerfProbe onGpu={onGpu} />
        <Suspense fallback={null}>
          {modelsReady && <World animals={snapshot.animals || []} timeOffset={timeOffset} preset={preset} freeCam={freeCam} quality={quality} view={view} fovH={fovH} phase={phase} />}
        </Suspense>
      </Canvas>

      <div className="phase-veil" />
      <Reticles active={phase === 'playing' || phase === 'intro'} hidden={phase === 'results'} />
      {phase === 'intro' && <CalibrationMark />}

      {hud && (
        <div className="hud">
          <TopBar mode={mode} snapshot={snapshot} />
          <Partners />
          {phase === 'lobby' && <LobbyPanel url={scannerUrl} snapshot={snapshot} />}
          {phase === 'intro' && (
            <>
              <IntroTimer snapshot={snapshot} timeOffset={timeOffset} />
              <JoinCorner url={scannerUrl} snapshot={snapshot} />
            </>
          )}
          {phase === 'playing' && (
            <>
              <RoundTimer snapshot={snapshot} timeOffset={timeOffset} />
              <Leaderboard rows={snapshot.leaderboard} />
            </>
          )}
          {phase === 'results' && <ResultsPanel snapshot={snapshot} timeOffset={timeOffset} />}
          <Help preset={preset} quality={quality} freeCam={freeCam} view={view} fovH={fovH} phase={phase} />
          {!soundOn && <div className="sound-hint">🔈 Click once to wake the narrator</div>}
        </div>
      )}
      <Subtitles />
      <Banner banner={banner} />
      <Loader />
      <PerfOverlay open={perfOpen} quality={quality} auto={autoQuality} />
    </div>
  );
}

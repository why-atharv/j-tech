import { memo, useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SPECIES_BY_KEY } from '../shared/species.js';
import { SHOT_COOLDOWN_MS, FRENZY_MS, MISS_PENALTY, comboMultiplier } from '../shared/engine.js';
import { motionSupported, requestMotion, watchMotion, angleDiff } from './motion.js';
import { sfx, unlockAudio } from './sfx.js';
import { haptic, lowEnd } from './device.js';

const FOV_H = (160 * Math.PI) / 180;
const FOV_V = (70 * Math.PI) / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const edgeCurve = (d) => d * (1 + 0.6 * Math.min(1, Math.abs(d)));
const seenTips = () => {
  try {
    return sessionStorage.getItem('pokeworld:tips') === '1';
  } catch {
    return false;
  }
};
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const Clock = memo(function Clock({ endsAt, offset, className }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return <div className={className}>{clock(endsAt - (now + offset))}</div>;
});

function useCountUp(target) {
  const [shown, setShown] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    if (lowEnd) {
      ref.current = target;
      setShown(target);
      return undefined;
    }
    const from = ref.current;
    const start = performance.now();
    let raf = 0;
    const step = (t) => {
      const k = Math.min(1, (t - start) / 400);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      ref.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

function Burst({ color }) {
  const n = lowEnd ? 5 : 10;
  return (
    <div className="burst" style={{ '--c': color }}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ '--a': `${(i / n) * 360}deg`, '--d': `${60 + (i % 3) * 22}px` }} />
      ))}
    </div>
  );
}

export function Controller({ ctl }) {
  const { me, snapshot, offset, aim, shoot, findMe, result } = ctl;
  const phase = snapshot?.phase || 'lobby';
  const endsAt = snapshot?.phaseEndsAt || 0;
  const pos = useRef({ x: 0.5, y: 0.5 });
  const cross = useRef(null);
  const dome = useRef(null);
  const domeSize = useRef({ w: 300, h: 200 });
  const [motion, setMotion] = useState(false);
  const [needsCenter, setNeedsCenter] = useState(true);
  const zero = useRef(null);
  const pose = useRef(null);
  const nudge = useRef({ x: 0, y: 0 });
  const drag = useRef(null);
  const rect = useRef(null);
  const [cooling, setCooling] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [prize, setPrize] = useState(null);
  const [count, setCount] = useState(null);
  const [rankDelta, setRankDelta] = useState(0);
  const [tips, setTips] = useState(() => !seenTips() && phase !== 'playing');
  const [pinging, setPinging] = useState(false);
  const [frenzy, setFrenzy] = useState(false);
  const [final, setFinal] = useState(false);
  const lastTap = useRef(0);
  const lastSecond = useRef(0);
  const pad = useRef(null);
  const lastPhase = useRef(phase);
  const lastRank = useRef(0);
  const score = useCountUp(me?.score || 0);

  const board = snapshot?.leaderboard || [];
  const ranked = [...(snapshot?.players || [])].sort((a, b) => b.score - a.score || b.hits - a.hits || a.seat - b.seat);
  const rank = ranked.findIndex((p) => p.id === me?.id) + 1;
  const emblemOut = !!snapshot?.emblemOut;
  const combo = phase === 'playing' ? me?.combo || 0 : 0;
  const ahead = rank > 1 ? ranked[rank - 2] : null;
  const behind = rank === 1 ? ranked[1] : null;
  const gap = ahead ? ahead.score - (me?.score || 0) : behind ? (me?.score || 0) - behind.score : 0;
  const locked = phase !== 'playing';

  useEffect(() => {
    if (phase !== 'playing') {
      setFrenzy(false);
      setFinal(false);
      return undefined;
    }
    const t = setInterval(() => {
      const left = endsAt - (Date.now() + offset);
      setFrenzy(left <= FRENZY_MS);
      const fin = left > 0 && left <= 10000;
      setFinal(fin);
      if (fin) {
        const sec = Math.ceil(left / 1000);
        if (sec !== lastSecond.current) {
          lastSecond.current = sec;
          haptic(sec <= 3 ? 60 : 25);
        }
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase, endsAt, offset]);

  const closeTips = useCallback(() => {
    setTips(false);
    try {
      sessionStorage.setItem('pokeworld:tips', '1');
    } catch (err) {
      void err;
    }
  }, []);

  useEffect(() => {
    if (phase === 'playing' && tips) {
      const t = setTimeout(closeTips, 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, tips, closeTips]);

  const ping = () => {
    unlockAudio();
    findMe?.();
    setPinging(true);
    haptic(30);
    setTimeout(() => setPinging(false), 1600);
  };

  useEffect(() => {
    if (rank && lastRank.current && rank !== lastRank.current) {
      setRankDelta(lastRank.current - rank);
      const t = setTimeout(() => setRankDelta(0), 1600);
      lastRank.current = rank;
      return () => clearTimeout(t);
    }
    lastRank.current = rank;
    return undefined;
  }, [rank]);

  useEffect(() => {
    if (lastPhase.current !== 'playing' && phase === 'playing') {
      const steps = ['3', '2', '1', 'GO!'];
      const timers = steps.map((s, i) =>
        setTimeout(() => {
          setCount(s);
          if (s === 'GO!') sfx.go();
          else sfx.tick();
        }, i * 650)
      );
      timers.push(setTimeout(() => setCount(null), steps.length * 650 + 300));
      lastPhase.current = phase;
      return () => timers.forEach(clearTimeout);
    }
    lastPhase.current = phase;
    return undefined;
  }, [phase]);

  useEffect(() => {
    if (emblemOut) haptic([80, 60, 80]);
  }, [emblemOut]);

  const publish = useCallback(
    (x, y) => {
      pos.current = { x: clamp01(x), y: clamp01(y) };
      const el = cross.current;
      if (el) el.style.transform = `translate3d(${(pos.current.x * domeSize.current.w).toFixed(1)}px, ${(pos.current.y * domeSize.current.h).toFixed(1)}px, 0)`;
      aim(pos.current.x, pos.current.y);
    },
    [aim]
  );

  useEffect(() => {
    if (!motion) return undefined;
    let smooth = null;
    let raf = 0;
    let fresh = false;
    const tick = () => {
      raf = 0;
      if (!fresh || !zero.current || !pose.current) return;
      fresh = false;
      const p = pose.current;
      const tx = 0.5 + edgeCurve((angleDiff(p.yaw, zero.current.yaw) / FOV_H) * 2) / 2 + nudge.current.x;
      const ty = 0.5 - edgeCurve(((p.pitch - zero.current.pitch) / FOV_V) * 2) / 2 + nudge.current.y;
      const k = lowEnd ? 0.55 : 0.42;
      smooth = smooth ? { x: smooth.x + (tx - smooth.x) * k, y: smooth.y + (ty - smooth.y) * k } : { x: tx, y: ty };
      publish(smooth.x, smooth.y);
    };
    const stop = watchMotion((p) => {
      pose.current = p;
      fresh = true;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    return () => {
      stop();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [motion, publish]);

  useEffect(() => {
    const el = dome.current;
    const measure = () => {
      if (!el) return;
      domeSize.current = { w: el.clientWidth, h: el.clientHeight };
      publish(pos.current.x, pos.current.y);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, [publish]);

  useEffect(() => {
    publish(pos.current.x, pos.current.y);
    const t = setInterval(() => aim(pos.current.x, pos.current.y), 1000);
    return () => clearInterval(t);
  }, [aim, publish]);

  const center = () => {
    unlockAudio();
    nudge.current = { x: 0, y: 0 };
    if (motion && pose.current) zero.current = { ...pose.current };
    publish(0.5, 0.5);
    setNeedsCenter(false);
    haptic(20);
    findMe?.();
  };

  const enableMotion = async () => {
    unlockAudio();
    const ok = await requestMotion();
    if (!ok) {
      setFeedback({ kind: 'info', text: 'Motion blocked — pad use karo', at: Date.now() });
      return;
    }
    setMotion(true);
    setTimeout(() => {
      if (pose.current) zero.current = { ...pose.current };
      nudge.current = { x: 0, y: 0 };
      setNeedsCenter(true);
    }, 300);
  };

  const onPointerDown = (e) => {
    unlockAudio();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    rect.current = pad.current.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY };
    const t = performance.now();
    if (t - lastTap.current < 320) {
      lastTap.current = 0;
      center();
      setFeedback({ kind: 'info', text: 'Re-centered', at: Date.now() });
      return;
    }
    lastTap.current = t;
  };
  const onPointerMove = (e) => {
    if (!drag.current || !rect.current) return;
    const r = rect.current;
    const k = motion ? 0.35 : 1.15;
    const dx = ((e.clientX - drag.current.x) / r.width) * k;
    const dy = ((e.clientY - drag.current.y) / r.height) * k;
    drag.current = { x: e.clientX, y: e.clientY };
    if (motion) nudge.current = { x: nudge.current.x + dx, y: nudge.current.y + dy };
    publish(pos.current.x + dx, pos.current.y + dy);
  };
  const onPointerUp = () => (drag.current = null);

  const snap = async () => {
    unlockAudio();
    if (cooling) return;
    if (locked) {
      sfx.locked();
      setFeedback({ kind: 'info', text: phase === 'intro' ? '🔒 Instructions chal rahe hain — abhi SNAP band hai' : '🔒 Hunt shuru hone do — tab tak aim practise karo', at: Date.now() });
      return;
    }
    setCooling(true);
    setTimeout(() => setCooling(false), SHOT_COOLDOWN_MS);
    sfx.shutter();
    const res = await shoot(pos.current.x, pos.current.y);
    if (!res?.ok && res?.reason !== 'cooldown') setFeedback({ kind: 'info', text: res?.reason === 'not_playing' ? '🔒 Abhi SNAP band hai' : 'Hold on…', at: Date.now() });
  };

  useEffect(() => {
    if (!result) return;
    if (result.ok) {
      const s = SPECIES_BY_KEY[result.animal.species];
      sfx.success(s.rarity);
      setTimeout(() => sfx.cry(s.key, 0.8), 180);
      setFeedback({ kind: 'hit', at: result.at, species: s, points: result.points, combo: result.combo, frenzy: result.frenzy });
      if (result.prize && !result.prize.already) {
        setPrize(result.prize);
        confetti({ particleCount: lowEnd ? 60 : 200, spread: 140, origin: { y: 0.35 }, colors: ['#c77dff', '#ffffff', '#ffd700'], disableForReducedMotion: true });
      } else if (!lowEnd && (s.rarity === 'legendary' || s.rarity === 'mythic')) {
        confetti({ particleCount: 90, spread: 90, origin: { y: 0.45 }, colors: [s.accent, '#ffffff'], disableForReducedMotion: true });
      }
    } else {
      sfx.fail();
      setFeedback({ kind: result.reason === 'taken' ? 'taken' : 'miss', at: result.at, penalty: result.penalty || 0, by: result.takenBy });
    }
  }, [result]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback((f) => (f === feedback ? null : f)), feedback.kind === 'hit' ? 1500 : 1300);
    return () => clearTimeout(t);
  }, [feedback]);

  const color = me?.color || '#7cffb2';
  const ring = Math.min(1, combo / 5);

  return (
    <div className={`ctl phase-${phase} ${final ? 'is-final' : ''} ${frenzy ? 'is-frenzy' : ''} ${feedback?.kind === 'miss' ? 'is-shake' : ''}`} style={{ '--me': color }}>
      <div className="orbs" aria-hidden="true" />

      <header className="ctl__top">
        <button className={`ctl__seat ctl__seat--${me?.shape || 'circle'} ${pinging ? 'is-ping' : ''}`} onClick={ping} aria-label="Find my cursor">
          <span>{me?.seat}</span>
        </button>
        <div className="ctl__who">
          <b>{me?.name}</b>
          <em className="ctl__look">
            {me?.colorName || 'Your'} {me?.shape || 'circle'} #{me?.seat} on the dome
          </em>
          <small>
            {phase === 'playing' ? (
              <span className={`rank ${rankDelta > 0 ? 'is-up' : rankDelta < 0 ? 'is-down' : ''}`}>
                {rank > 0 ? `Rank #${rank} of ${ranked.length}` : 'Hunting!'}
                {rankDelta > 0 ? ' ▲' : rankDelta < 0 ? ' ▼' : ''}
                {ahead && gap > 0 ? ` · ${gap} pts behind ${ahead.name}` : behind && gap > 0 ? ` · leading by ${gap}` : ''}
              </span>
            ) : phase === 'intro' ? (
              'Dome ki baat suno… 🎧'
            ) : (
              'Seat mil gayi · aim practise karo'
            )}
          </small>
        </div>
        <div className="ctl__score">
          <b key={me?.score}>{score.toLocaleString()}</b>
          {combo > 1 && <span>×{comboMultiplier(combo)}</span>}
        </div>
        {(phase === 'playing' || phase === 'intro') && <Clock endsAt={endsAt} offset={offset} className={`ctl__timer ${frenzy ? 'is-frenzy' : ''} ${final ? 'is-urgent' : ''}`} />}
      </header>

      {phase === 'playing' && board.length > 0 && (
        <div className="ticker">
          {board.slice(0, 3).map((p, i) => (
            <span key={p.id} className={p.id === me?.id ? 'is-me' : ''} style={{ '--c': p.color }}>
              {['🥇', '🥈', '🥉'][i]} {p.name} <b>{p.score}</b>
            </span>
          ))}
        </div>
      )}

      {emblemOut && phase === 'playing' && (
        <div className="emblem-alert">
          <i className="pokeball pokeball--sm" />
          <span>MEWTWO dome par hai — jaldi SNAP karo!</span>
        </div>
      )}
      {frenzy && <div className="frenzy-chip">✦ Golden hour · double points ✦</div>}
      {phase === 'intro' && <div className="lock-chip">🔒 Instructions ke time SNAP band hai</div>}

      <div ref={pad} className={`ctl__pad ${motion ? 'is-motion' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="ctl__dome" ref={dome}>
          <div className="ctl__dome-arc" />
          <div ref={cross} className="ctl__cross">
            <div className={`ctl__crosshair ctl__crosshair--${me?.shape || 'circle'}`}>{feedback?.kind === 'hit' && <Burst key={feedback.at} color={color} />}</div>
          </div>
        </div>
        <button className={`ctl__find ${pinging ? 'is-on' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={ping}>
          📍 Find me
        </button>
        <div className="ctl__hint">{motion ? (needsCenter ? 'Chamakte nishaan ki taraf point karo, phir CENTER' : 'Phone ghuma kar aim karo · double-tap = re-center') : 'Yahan drag karke crosshair chalao'}</div>
        {feedback && (
          <div key={feedback.at} className={`fb fb--${feedback.kind}`}>
            {feedback.kind === 'hit' && (
              <>
                <b>+{feedback.points}</b>
                <span>
                  {feedback.species.emoji} {feedback.species.name}
                  {feedback.combo > 1 ? ` · ×${comboMultiplier(feedback.combo)}` : ''}
                  {feedback.frenzy ? ' · 2×' : ''}
                </span>
              </>
            )}
            {feedback.kind === 'miss' && (
              <>
                <b>Kuch nahi mila!</b>
                {feedback.penalty > 0 && <span className="fb__penalty">−{feedback.penalty} points · Pokémon par aim karo</span>}
              </>
            )}
            {feedback.kind === 'taken' && (
              <>
                <b>Too slow!</b>
                <span>{feedback.by ? `${feedback.by} ne pehle pakad liya` : 'Kisi ne pehle pakad liya'}</span>
              </>
            )}
            {feedback.kind === 'info' && <span>{feedback.text}</span>}
          </div>
        )}
        {count && (
          <div key={count} className={`countdown ${count === 'GO!' ? 'is-go' : ''}`}>
            {count}
          </div>
        )}
      </div>

      <footer className="ctl__bar">
        <button className={`ctl__small ${needsCenter && motion ? 'is-glow' : ''}`} onClick={center}>
          <span>◎</span>
          Center
        </button>
        <button className={`ctl__snap ${cooling ? 'is-cooling' : ''} ${locked ? 'is-idle is-locked' : ''}`} onClick={snap} aria-label="Snap">
          <svg className="combo-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="47" />
            <circle cx="50" cy="50" r="47" style={{ strokeDashoffset: 295 * (1 - ring) }} />
          </svg>
          <i />
          <span>{locked ? '🔒' : 'SNAP'}</span>
          {combo >= 3 && <em>🔥</em>}
        </button>
        {motionSupported() ? (
          <button className={`ctl__small ${motion ? 'is-on' : ''}`} onClick={() => (motion ? setMotion(false) : enableMotion())}>
            <span>{motion ? '📱' : '🎯'}</span>
            {motion ? 'Motion on' : 'Motion aim'}
          </button>
        ) : (
          <div className="ctl__small is-empty" />
        )}
      </footer>

      {tips && (
        <div className="tips" onClick={closeTips}>
          <div className="tips__card">
            <b>Kaise khelna hai</b>
            <ol>
              <li>
                <i>1</i>
                <em>Motion aim</em> dabao, dome ke chamakte nishaan ki taraf point karo, <em>Center</em> dabao
              </li>
              <li>
                <i>2</i>Apna{' '}
                <em style={{ color }}>
                  {me?.colorName} {me?.shape} #{me?.seat}
                </em>{' '}
                dhoondo — kho jaaye toh <em>📍 Find me</em>
              </li>
              <li>
                <i>3</i>Pokémon par rakho aur <em>SNAP</em>. Khaali snap = −{MISS_PENALTY} points
              </li>
            </ol>
            <small>Tap karke shuru karo</small>
          </div>
        </div>
      )}

      {prize && (
        <div className="prize-cover" onClick={() => setPrize(null)}>
          <div className="prize-card">
            <i className="pokeball" />
            <div className="prize-card__title">Mewtwo snapped! IDEAS 4.0 goodies aapke!</div>
            <div className="prize-card__code">{prize.code}</div>
            <div className="prize-card__note">Round ke baad yeh code IDEAS 4.0 desk par dikhao. Tap karke hunt continue karo.</div>
          </div>
        </div>
      )}
    </div>
  );
}

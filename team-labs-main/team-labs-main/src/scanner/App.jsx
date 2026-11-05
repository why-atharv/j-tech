import { useEffect, useMemo, useRef, useState } from 'react';
import { useController } from './useController.js';
import { Controller } from './Controller.jsx';
import { sfx, unlockAudio } from './sfx.js';
import { lowEnd, keepAwake } from './device.js';
import { SPECIES, SPECIES_BY_KEY, RARITY } from '../shared/species.js';
import { suggestNames } from '../shared/engine.js';

const REVEAL_MS = 5000;
let revealModule = null;
const loadReveal = () => (revealModule ??= import('./reveal3d.js'));

function Onboarding({ onDone, initial, taken, suggestions, again }) {
  const [value, setValue] = useState(again ? '' : initial || '');
  const [ideas, setIdeas] = useState(() => suggestNames(new Set(), again ? initial : '', 4));
  const placeholder = ideas[0] || 'PikaMaster';
  const icons = useMemo(() => SPECIES.map((s) => s.emoji), []);
  const submit = (name) => {
    unlockAudio();
    const n = (name ?? value).trim() || placeholder;
    if (n) onDone(n);
  };
  return (
    <div className="onboard">
      <div className="ob-ideas">
        <img src="/brand/ideas.png" alt="IDEAS 4.0" />
      </div>
      <div className="ob-logo">
        <i className="pokeball" />
        <h1 className="onboard__title">POKEMONS WORLD</h1>
      </div>
      <div className="ob-org">
        <img className="ob-org__coe" src="/brand/coe.jpg" alt="Centre of Excellence — AI" />
        <span className="ob-nvidia">Powered by NVIDIA</span>
      </div>
      <p className="onboard__sub">{again ? 'Naya trainer? Apna naam likho ya neeche se koi cool naam chuno.' : 'Aapka phone ab Poké camera hai. Dome par Pokémon ko aim karo aur sabse pehle SNAP karo. Har miss par −5 points!'}</p>
      <form
        className="onboard__form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="ranger-name">Your hunter name</label>
        <div className="name-row">
          <input id="ranger-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={16} placeholder={placeholder} autoComplete="off" autoCapitalize="words" />
          <button type="button" className="dice" aria-label="Suggest names" onClick={() => setIdeas(suggestNames(new Set(), value, 4))}>
            🎲
          </button>
        </div>
        <div className="name-ideas">
          {ideas.map((s) => (
            <button type="button" key={s} onClick={() => setValue(s)}>
              {s}
            </button>
          ))}
        </div>
        {taken && (
          <div className="taken">
            <b>“{initial}” already dome mein hai.</b> Inmein se chuno:
            <div className="taken__chips">
              {suggestions.map((s) => (
                <button type="button" key={s} onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="btn btn--wide">{value.trim() ? `Play as ${value.trim()}` : `Play as ${placeholder}`}</button>
      </form>
      <div className="ob-prize">
        <div className="ob-prize__crest">
          <i className="pokeball" />
        </div>
        <p>
          Mythic <b>MEWTWO</b> ko sabse pehle snap karo aur jeeto <b>IDEAS 4.0 goodies!</b>
        </p>
      </div>
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[...icons, ...icons].map((e, i) => (
            <span key={i}>{e}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Wait({ icon, title, text, action }) {
  return (
    <div className="wait">
      <div className="wait__icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

function Reveal({ me, onDone }) {
  const canvas = useRef(null);
  const show = me?.showcase || { key: 'pikachu', own: false };
  const s = SPECIES_BY_KEY[show.key] || SPECIES_BY_KEY.pikachu;
  const r = RARITY[s.rarity];
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = null;
    let alive = true;
    loadReveal()
      .then((m) => {
        if (!alive || !canvas.current) return;
        stop = m.startReveal(canvas.current, s.key, { lite: lowEnd, fx: s.fx, color: s.glow || s.accent });
        setReady(true);
      })
      .catch(() => setFailed(true));
    const cry = setTimeout(() => sfx.cry(s.key, 1), 300);
    const move = setTimeout(() => sfx.move(s.fx, 0.9), 700);
    const done = setTimeout(onDone, REVEAL_MS);
    return () => {
      alive = false;
      clearTimeout(cry);
      clearTimeout(move);
      clearTimeout(done);
      stop?.();
    };
  }, [s.key, s.fx, s.glow, s.accent, onDone]);

  return (
    <div className={`reveal reveal--${s.rarity}`} style={{ '--accent': s.glow || s.accent, '--d': `${REVEAL_MS}ms` }}>
      <div className="reveal__kicker">{show.own ? 'Aapka best catch!' : 'Aapka lucky Pokémon!'}</div>
      <h1 className="reveal__name">{s.name}</h1>
      <div className="reveal__chips">
        <span className="reveal__rarity">{r.label}</span>
        <span>#{String(s.dex).padStart(3, '0')}</span>
        {show.own && show.count > 0 && <span>×{show.count} snapped</span>}
      </div>
      <div className="reveal__stage">
        <canvas ref={canvas} className="reveal__canvas" />
        {!ready && !failed && <div className="reveal__loading"><i className="pokeball" /></div>}
        {failed && <div className="reveal__emoji">{s.emoji}</div>}
      </div>
      <div className="reveal__move">
        <b>{s.move}</b>
        <span>{s.moveText}</span>
      </div>
      {!show.own && <p className="reveal__note">Agli baar isko zaroor pakadna! 😉</p>}
      <div className="reveal__bar">
        <i />
      </div>
    </div>
  );
}

function Results({ ctl }) {
  const { me, snapshot } = ctl;
  const all = [...(snapshot?.players || [])].sort((a, b) => b.score - a.score || b.hits - a.hits || a.seat - b.seat);
  const rank = all.findIndex((p) => p.id === me?.id) + 1;
  const accuracy = me?.shots ? Math.round((me.hits / me.shots) * 100) : 0;
  const mine = useRef(null);
  useEffect(() => {
    mine.current?.scrollIntoView?.({ block: 'center' });
  }, []);
  return (
    <div className="final" style={{ '--me': me?.color }}>
      <div className="final__kicker">Round complete · Leaderboard</div>
      <div className="final__rank">{rank > 0 ? `#${rank}` : '—'}</div>
      <div className="final__of">of {all.length} trainers</div>
      <div className="final__score">{(me?.score || 0).toLocaleString()} pts</div>
      <div className="final__stats">
        <div>
          <b>{me?.hits || 0}</b>
          <small>snaps</small>
        </div>
        <div>
          <b>{accuracy}%</b>
          <small>accuracy</small>
        </div>
        <div>
          <b>×{me?.best || 0}</b>
          <small>best combo</small>
        </div>
      </div>
      <ol className="lb">
        {all.map((p, i) => (
          <li key={p.id} ref={p.id === me?.id ? mine : null} className={p.id === me?.id ? 'is-me' : ''} style={{ '--c': p.color }}>
            <span className="lb__rank">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
            <span className="lb__name">
              {p.name}
              {p.showcase && <em>{SPECIES_BY_KEY[p.showcase.key]?.emoji}</em>}
            </span>
            <b>{p.score.toLocaleString()}</b>
          </li>
        ))}
      </ol>
      <p className="final__note">Dome par champions dekho! 🏆</p>
    </div>
  );
}

function ResultsFlow({ ctl }) {
  const round = ctl.snapshot?.round;
  const [seen, setSeen] = useState(null);
  const done = useMemo(() => () => setSeen(round), [round]);
  if (seen !== round && ctl.me?.showcase) return <Reveal me={ctl.me} onDone={done} />;
  return <Results ctl={ctl} />;
}

export default function App() {
  const ctl = useController();
  const [editing, setEditing] = useState(false);
  const [again, setAgain] = useState(false);
  const phase = ctl.snapshot?.phase;

  useEffect(() => {
    document.documentElement.classList.toggle('lite', lowEnd);
  }, []);

  useEffect(() => {
    keepAwake(ctl.status === 'in' && (phase === 'intro' || phase === 'playing' || phase === 'results'));
  }, [ctl.status, phase]);

  useEffect(() => {
    if (ctl.status !== 'in' || (phase !== 'lobby' && phase !== 'intro')) return undefined;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const id = idle(() => loadReveal().catch(() => {}));
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, [ctl.status, phase]);

  useEffect(() => {
    if (ctl.status === 'over') setAgain(true);
  }, [ctl.status]);

  if (!ctl.name || editing || again || ctl.status === 'name_taken') {
    return (
      <Onboarding
        key={ctl.status === 'name_taken' ? `taken-${ctl.name}` : again ? 'again' : 'fresh'}
        initial={ctl.name}
        taken={ctl.status === 'name_taken'}
        again={again && !editing}
        suggestions={ctl.suggestions}
        onDone={(n) => {
          ctl.setName(n);
          setEditing(false);
          setAgain(false);
        }}
      />
    );
  }

  if (ctl.link === 'offline') {
    return <Wait icon="📡" title="Dome tak nahi pahunch paaye" text="Dome computer wale Wi-Fi (ya hotspot) se judo, phir reload karo." action={<button className="btn" onClick={() => location.reload()}>Try again</button>} />;
  }
  if (ctl.status === 'full') {
    return <Wait icon="🪑" title="Dome full hai" text="Saari 30 seats bhar gayi. Agla round khulte hi aapko seat mil jaayegi." action={<button className="btn btn--ghost" onClick={() => setEditing(true)}>Change name</button>} />;
  }
  if (ctl.status === 'closed') {
    return <Wait icon="⏳" title="Hunt chal raha hai" text="Yeh round shuru ho chuka hai. Paas raho — agla round khulte hi seat mil jaayegi." action={<button className="btn btn--ghost" onClick={() => setEditing(true)}>Change name</button>} />;
  }
  if (ctl.status !== 'in' || !ctl.me) {
    return <Wait icon={<i className="pokeball" />} title="Seat dhoondh rahe hain…" text="Dome se connect ho raha hai." />;
  }
  if (phase === 'results') return <ResultsFlow ctl={ctl} />;
  return (
    <>
      <Controller ctl={ctl} />
      {phase === 'lobby' && (
        <button className="rename" onClick={() => setEditing(true)}>
          ✎ Change name
        </button>
      )}
    </>
  );
}

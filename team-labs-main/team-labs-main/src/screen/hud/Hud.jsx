import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { SPECIES, SPECIES_BY_KEY, RARITY } from '../../shared/species.js';
import { useQr } from './QrTag.jsx';
import { narrator } from '../narrator.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export function TopBar({ mode, snapshot }) {
  const alive = (snapshot.animals || []).filter((a) => a.state === 'alive').length;
  const modeLabel = { live: 'LIVE', solo: 'SOLO', connecting: 'CONNECTING' }[mode];
  return (
    <header className="topbar">
      <div className="brand" data-tag-avoid>
        <div className="ideas">
          <img src="/brand/ideas.png" alt="IDEAS 4.0" />
        </div>
        <div className="brand__divider" />
        <div>
          <div className="brand__name">POKEMONS WORLD</div>
          <div className="brand__sub">
            Centre of Excellence · AI <span className="nvidia">Powered by NVIDIA</span>
          </div>
        </div>
      </div>
      <div className="stats" data-tag-avoid>
        <Stat label="In the wild" value={alive} />
        <Stat label="Hunters" value={`${snapshot.seats?.used ?? 0}/${snapshot.seats?.max ?? 30}`} />
        <Stat label="Snapped" value={snapshot.totalCaught} />
        <div className={`pill pill--${mode}`} title={mode === 'solo' ? 'No server found — running locally in this browser' : ''}>
          <span className="pill__dot" />
          {modeLabel}
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function Partners() {
  return (
    <div className="partners" data-tag-avoid>
      <div className="partners__coe">
        <img src="/brand/coe.jpg" alt="Centre of Excellence — Artificial Intelligence" />
      </div>
      <div className="partners__prize" title="Snap Mewtwo to win goodies">
        <div className="partners__ring" />
        <i className="pokeball" />
        <span className="partners__tag">Mewtwo = Gift</span>
      </div>
    </div>
  );
}

export function SpeciesIcon({ species, className = '' }) {
  return species.image ? <img className={`species-img ${className}`} src={species.image} alt="" /> : <>{species.emoji}</>;
}

export function Leaderboard({ rows }) {
  return (
    <section className="panel board" data-tag-avoid>
      <h3 className="panel__title">Top Trainers</h3>
      {rows.length === 0 ? (
        <p className="board__empty">No catches yet — be the first!</p>
      ) : (
        <ol className="board__list">
          {rows.slice(0, 8).map((r, i) => (
            <li key={r.id} className="board__row">
              <span className="board__rank">{MEDALS[i] || i + 1}</span>
              <span className="board__name">
                <i className={`mark mark--${r.shape || 'circle'}`} style={{ '--c': r.color }}>{r.seat}</i>
                {r.name}
              </span>
              <span className="board__meta">{r.hits} ◓</span>
              <span className="board__score">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function JoinCard({ url, mode }) {
  const src = useQr(url);
  return (
    <section className="panel join" data-tag-avoid>
      <div className="join__qr">{src && <img src={src} alt="Join" />}</div>
      <div className="join__text">
        <div className="join__title">Join the hunt</div>
        <div className="join__sub">Scan with your phone camera, pick a trainer name, then snap the Pokémon on the dome.</div>
        <div className="join__url">{url.replace(/^https?:\/\//, '')}</div>
        {mode === 'solo' && <div className="join__warn">Solo mode: start the server (npm start) for multiplayer.</div>}
        {mode === 'live' && !url.includes('trycloudflare') && (
          <div className="join__tip">Can't open it? Campus Wi-Fi blocks phones from reaching this PC — use the laptop's hotspot or <code>npm run tunnel</code>.</div>
        )}
      </div>
    </section>
  );
}

export function Banner({ banner }) {
  if (!banner) return null;
  if (banner.kind === 'frenzy') {
    return (
      <div key={banner.key} className="banner banner--frenzy" style={{ '--accent': '#ffb547' }}>
        <div className="banner__kicker">✦ The golden hour ✦</div>
        <div className="banner__title">Double points</div>
        <div className="banner__sub">Thirty seconds left — every snap counts twice!</div>
      </div>
    );
  }
  const s = SPECIES_BY_KEY[banner.species];
  const r = RARITY[s.rarity];
  return (
    <div key={banner.key} className={`banner banner--${banner.kind}`} style={{ '--accent': s.glow || r.color }}>
      {banner.kind === 'mythic' ? (
        <>
          <div className="banner__kicker">✦ Mythic Mewtwo has appeared ✦</div>
          <div className="banner__title">
            <SpeciesIcon species={s} className="banner__img" /> {s.name}
          </div>
          <div className="banner__sub">Snap it first to win IDEAS 4.0 goodies + {r.points.toLocaleString()} points!</div>
        </>
      ) : banner.kind === 'prize' ? (
        <>
          <div className="banner__kicker">🎁 We have a winner 🎁</div>
          <div className="banner__title">
            <SpeciesIcon species={s} className="banner__img" /> {banner.ranger} wins goodies!
          </div>
          <div className="banner__sub">Collect your prize at the IDEAS 4.0 desk · +{banner.points.toLocaleString()} points</div>
        </>
      ) : banner.kind === 'legendary' ? (
        <>
          <div className="banner__kicker">⚠ Legendary sighting</div>
          <div className="banner__title">
            {s.emoji} {s.name}
          </div>
          <div className="banner__sub">{s.move} · worth {r.points.toLocaleString()} points — snap it before it vanishes!</div>
        </>
      ) : (
        <>
          <div className="banner__kicker">Caught!</div>
          <div className="banner__title">
            {banner.ranger} · <SpeciesIcon species={s} className="banner__img" /> {s.name}
          </div>
          <div className="banner__sub">+{banner.points.toLocaleString()} points</div>
        </>
      )}
    </div>
  );
}

export function SpeciesStrip({ snapshot }) {
  const present = new Set((snapshot.animals || []).filter((a) => a.state === 'alive').map((a) => a.species));
  return (
    <div className="strip" data-tag-avoid>
      {SPECIES.map((s) => (
        <span key={s.key} className={`strip__item ${present.has(s.key) ? 'is-on' : ''} strip__item--${s.rarity}`} title={s.name}>
          <SpeciesIcon species={s} />
        </span>
      ))}
    </div>
  );
}

const HOST_KEY = { lobby: 'start round', intro: 'skip intro', results: 'next group', playing: '' };

export function Help({ preset, quality, freeCam, view, fovH, phase }) {
  return (
    <footer className="help">
      {HOST_KEY[phase] && (
        <>
          <kbd>SPACE</kbd> {HOST_KEY[phase]}{' '}
        </>
      )}
      {phase === 'playing' && (
        <>
          <kbd>E</kbd> end round{' '}
        </>
      )}
      <kbd>F</kbd> fullscreen <kbd>H</kbd> hide HUD <kbd>D</kbd> {view === 'dome' ? `dome ${fovH}°` : 'flat'} {view === 'dome' && <><kbd>[ ]</kbd> angle</>} <kbd>T</kbd> {preset} <kbd>O</kbd> {freeCam ? 'free cam' : 'cinematic'} <kbd>Q</kbd> {quality} <kbd>+/-</kbd> labels <kbd>M</kbd> mute <kbd>L</kbd> spawn legendary <kbd>K</kbd> Mewtwo <span className="help__voice">🎙 {narrator.voiceName}</span>
    </footer>
  );
}

export function Loader() {
  const { progress, active, total } = useProgress();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const [gone, setGone] = useState(false);
  const done = settled && !active && (progress >= 100 || total === 0);
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, [done]);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 20000);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className={`loader ${done ? 'is-done' : ''}`}>
      <div className="ideas ideas--big">
        <img src="/brand/ideas.png" alt="IDEAS 4.0" />
      </div>
      <div className="loader__presents">presents</div>
      <div className="loader__name">POKEMONS WORLD</div>
      <div className="loader__logos">
        <img className="loader__coe" src="/brand/coe.jpg" alt="Centre of Excellence — AI" />
      </div>
      <div className="nvidia nvidia--big">Powered by NVIDIA</div>
      <div className="loader__bar">
        <i style={{ width: `${Math.max(4, progress)}%` }} />
      </div>
      <div className="loader__sub">Pokémon aa rahe hain…</div>
    </div>
  );
}

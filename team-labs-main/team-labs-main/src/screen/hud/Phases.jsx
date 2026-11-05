import { useEffect, useState } from 'react';
import { SPECIES_BY_KEY } from '../../shared/species.js';
import { useQr } from './QrTag.jsx';
import { narrator } from '../narrator.js';
import { FRENZY_MS } from '../../shared/engine.js';

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function LobbyPanel({ url, snapshot }) {
  const src = useQr(url);
  const { used, max } = snapshot.seats || { used: 0, max: 30 };
  const seats = Array.from({ length: max }, (_, i) => snapshot.players?.find((p) => p.seat === i + 1));
  return (
    <section className="lobby" data-tag-avoid>
      <div className="lobby__qr">{src && <img src={src} alt="Join" />}</div>
      <div className="lobby__body">
        <div className="lobby__kicker">Round {snapshot.round || 1} · The dome is open</div>
        <h1 className="lobby__title">Take your seat</h1>
        <p className="lobby__sub">Scan the code, pick a trainer name, then sit down and look up. Your phone becomes your Poké camera.</p>
        <div className="lobby__url">{url.replace(/^https?:\/\//, '')}</div>
        <div className="lobby__count">
          <b>{used}</b>
          <span>/ {max} trainers seated</span>
        </div>
        <div className="seats">
          {seats.map((p, i) => (
            <div key={i} className={`seat ${p ? 'is-taken' : ''} ${p && !p.online ? 'is-away' : ''}`} style={p ? { '--c': p.color } : undefined}>
              <i>{i + 1}</i>
              <span>{p ? p.name : ''}</span>
            </div>
          ))}
        </div>
        <div className="lobby__host">
          Host: press <kbd>SPACE</kbd> to dim the lights and begin
        </div>
      </div>
    </section>
  );
}

export function JoinCorner({ url, snapshot }) {
  const src = useQr(url);
  return (
    <section className="join-corner" data-tag-avoid>
      <div className="join-corner__qr">{src && <img src={src} alt="Join" />}</div>
      <div>
        <b>Late? Join now</b>
        <span>
          {snapshot.seats?.used || 0}/{snapshot.seats?.max || 30} seats
        </span>
      </div>
    </section>
  );
}

export function CalibrationMark() {
  return (
    <div className="calib">
      <div className="calib__ring calib__ring--a" />
      <div className="calib__ring calib__ring--b" />
      <div className="calib__core" />
      <div className="calib__text">Point your phone here · tap CENTER</div>
    </div>
  );
}

export function RoundTimer({ snapshot, timeOffset }) {
  const now = useNow(200) + timeOffset;
  const left = (snapshot.phaseEndsAt || 0) - now;
  const frenzy = left <= FRENZY_MS;
  const urgent = left <= 10_500;
  return (
    <div className={`timer ${frenzy ? 'is-frenzy' : ''} ${urgent ? 'is-urgent' : ''}`} data-tag-avoid>
      <div className="timer__value">{clock(left)}</div>
      <div className="timer__label">{frenzy ? '✦ Golden hour · double points ✦' : 'Hunt time remaining'}</div>
    </div>
  );
}

export function IntroTimer({ snapshot, timeOffset }) {
  const now = useNow(500) + timeOffset;
  return (
    <div className="intro-chip" data-tag-avoid>
      The hunt begins in <b>{clock((snapshot.phaseEndsAt || 0) - now)}</b>
    </div>
  );
}

const PODIUM = [1, 0, 2];

export function ResultsPanel({ snapshot, timeOffset }) {
  const now = useNow(500) + timeOffset;
  const top = snapshot.leaderboard || [];
  const rest = top.slice(3, 10);
  return (
    <section className="results">
      <div className="results__kicker">Round {snapshot.round} · Pokémon Masters</div>
      <div className="podium">
        {PODIUM.map((i) => {
          const p = top[i];
          return (
            <div key={i} className={`podium__step podium__step--${i + 1}`} style={p ? { '--c': p.color } : undefined}>
              <div className="podium__medal">{['🥇', '🥈', '🥉'][i]}</div>
              <div className="podium__name">{p ? p.name : '—'}</div>
              <div className="podium__score">{p ? p.score.toLocaleString() : ''}</div>
              <div className="podium__meta">{p ? `${p.hits} snaps · best ×${p.best || 0} combo${p.showcase ? ` · ${SPECIES_BY_KEY[p.showcase.key]?.emoji || ''}` : ''}` : ''}</div>
              <div className="podium__block">{i + 1}</div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <ol className="results__rest" start={4}>
          {rest.map((p) => (
            <li key={p.id} style={{ '--c': p.color }}>
              <span>{p.name}</span>
              <b>{p.score.toLocaleString()}</b>
            </li>
          ))}
        </ol>
      )}
      <div className="results__next">Next group in {clock((snapshot.phaseEndsAt || 0) - now)} · please make way for the next trainers</div>
    </section>
  );
}

export function Subtitles() {
  const [line, setLine] = useState(null);
  useEffect(() => narrator.onLine(setLine), []);
  if (!line) return null;
  return (
    <div key={line.key} className="subtitle" style={{ '--d': `${line.duration}s` }}>
      <span>{line.text}</span>
    </div>
  );
}

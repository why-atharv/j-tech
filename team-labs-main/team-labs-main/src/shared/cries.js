const CRY = {
  vulpix: [720, 2, 0.22, 1.25, 'triangle', 0, 2600],
  ponyta: [380, 3, 0.18, 1.5, 'sawtooth', 0.15, 2200],
  eevee: [880, 2, 0.16, 1.35, 'triangle', 0, 3400],
  doduo: [620, 4, 0.08, 0.8, 'square', 0.1, 2400],
  electabuzz: [210, 2, 0.28, 1.4, 'sawtooth', 0.35, 1800],
  mankey: [560, 5, 0.07, 1.3, 'square', 0.2, 2600],
  sandshrew: [480, 2, 0.14, 0.75, 'triangle', 0.1, 2000],
  pikachu: [930, 3, 0.13, 1.3, 'square', 0, 3600],
  rhyhorn: [120, 1, 0.75, 0.7, 'sawtooth', 0.7, 900],
  slowpoke: [260, 1, 0.9, 0.85, 'sine', 0, 1200],
  pidgeotto: [1250, 3, 0.12, 0.7, 'triangle', 0, 4200],
  spearow: [1500, 4, 0.07, 0.8, 'square', 0.1, 4800],
  farfetchd: [640, 2, 0.14, 0.9, 'square', 0.1, 2400],
  butterfree: [1700, 3, 0.16, 1.15, 'sine', 0, 5000],
  ninetales: [520, 1, 0.8, 1.35, 'triangle', 0.05, 2600],
  rapidash: [300, 3, 0.2, 1.6, 'sawtooth', 0.2, 2400],
  growlithe: [430, 3, 0.11, 0.85, 'sawtooth', 0.25, 2000],
  scyther: [700, 2, 0.12, 1.6, 'sawtooth', 0.3, 3200],
  kangaskhan: [170, 2, 0.4, 0.8, 'sawtooth', 0.5, 1100],
  slowbro: [220, 1, 1.0, 0.8, 'sine', 0.05, 1100],
  rhydon: [100, 1, 1.0, 0.75, 'sawtooth', 0.8, 800],
  exeggutor: [300, 3, 0.2, 1.1, 'triangle', 0.1, 1600],
  nidoking: [110, 2, 0.55, 0.7, 'sawtooth', 0.75, 900],
  tauros: [140, 1, 0.9, 0.7, 'sawtooth', 0.65, 1000],
  nidoqueen: [150, 2, 0.5, 0.78, 'sawtooth', 0.6, 1000],
  flareon: [600, 2, 0.24, 1.3, 'sawtooth', 0.1, 2600],
  snorlax: [80, 1, 1.3, 0.8, 'sine', 0.3, 600],
  persian: [540, 2, 0.32, 1.4, 'triangle', 0.2, 2400],
  jolteon: [820, 3, 0.1, 1.4, 'square', 0.15, 3600],
  raichu: [700, 3, 0.14, 1.25, 'square', 0.1, 3000],
  golbat: [1900, 4, 0.06, 1.2, 'square', 0.2, 5200],
  lapras: [420, 1, 1.2, 1.12, 'sine', 0, 1800],
  dodrio: [700, 6, 0.06, 0.85, 'square', 0.15, 2800],
  fearow: [1100, 2, 0.32, 0.65, 'sawtooth', 0.25, 3600],
  aerodactyl: [520, 1, 0.8, 0.55, 'sawtooth', 0.5, 2400],
  arcanine: [160, 1, 1.0, 0.75, 'sawtooth', 0.7, 1200],
  charizard: [95, 1, 1.4, 0.7, 'sawtooth', 0.85, 900],
  mew: [1200, 2, 0.35, 1.5, 'sine', 0, 5000],
  articuno: [1400, 1, 1.1, 1.25, 'triangle', 0.05, 4400],
  blastoise: [130, 1, 1.0, 0.8, 'sawtooth', 0.6, 900],
  machamp: [150, 3, 0.25, 0.8, 'sawtooth', 0.5, 1100],
  zapdos: [900, 1, 1.0, 0.7, 'sawtooth', 0.4, 3800],
  moltres: [1000, 1, 1.1, 1.3, 'sawtooth', 0.3, 3600],
  mewtwo: [180, 1, 1.6, 1.6, 'sine', 0.2, 1400]
};

const MOVE_KIND = {
  ember: 'fire', flamewheel: 'fire', firespin: 'fire', flameburst: 'fire', lavaplume: 'fire', extremespeed: 'fire', fireblast: 'blast', skyattack: 'blast', wisp: 'psychic',
  shock: 'zap', thunderbolt: 'zap', discharge: 'zap', volttackle: 'zap', thunder: 'thunder', charge: 'zap', triattack: 'beam',
  watergun: 'water', waterpulse: 'water', hydropump: 'water',
  icebeam: 'ice', blizzard: 'ice',
  psychic: 'psychic', psystrike: 'psychic', powergem: 'beam',
  gust: 'wind', aircutter: 'wind', silverwind: 'sparkle', quick: 'wind',
  peck: 'peck', peckfast: 'peck', drillpeck: 'drill', horndrill: 'drill', slash: 'slash', xscissor: 'slash',
  chop: 'hit', megapunch: 'hit', dynamicpunch: 'hit', horn: 'hit', takedown: 'hit',
  earthquake: 'rumble', bodyslam: 'rumble', curl: 'rumble', ancientpower: 'rumble', superpower: 'rumble',
  eggbomb: 'sparkle', zzz: 'snore'
};

let noiseBuf = null;

function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function env(ctx, g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function osc(ctx, dest, { type = 'sine', f0, f1 = f0, t, dur, vol = 0.2, a = 0.01, vib = 0, vibRate = 6 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vib) {
    const l = ctx.createOscillator();
    const lg = ctx.createGain();
    l.frequency.value = vibRate;
    lg.gain.value = f0 * vib;
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(t + dur + 0.05);
  }
  env(ctx, g, t, a, vol, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(ctx, dest, { t, dur, vol = 0.2, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, a = 0.01 }) {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  env(ctx, g, t, a, vol, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

export function playCry(ctx, dest, key, vol = 1, pitch = 1) {
  const c = CRY[key];
  if (!ctx || !c) return 0;
  const [f, n, d, glide, wave, growl, bright] = c;
  const t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = 0.55 * vol;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = bright;
  lp.Q.value = 2.2;
  const pk = ctx.createBiquadFilter();
  pk.type = 'peaking';
  pk.frequency.value = bright * 0.55;
  pk.Q.value = 1.4;
  pk.gain.value = 6;
  out.connect(lp).connect(pk).connect(dest);
  let t = t0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const sd = d * (last && n > 1 ? 1.6 : 1);
    const base = f * pitch * (1 + (i % 2 ? 0.12 : 0) - (last && n > 2 ? 0.08 : 0));
    osc(ctx, out, { type: wave, f0: base, f1: base * (last ? glide : Math.sqrt(glide)), t, dur: sd, vol: 0.32, a: 0.012, vib: 0.03 + growl * 0.08, vibRate: 7 + growl * 25 });
    osc(ctx, out, { type: 'sine', f0: base * 2.01, f1: base * 2.01 * glide, t, dur: sd * 0.9, vol: 0.08 });
    if (growl > 0) hiss(ctx, out, { t, dur: sd, vol: growl * 0.22, f0: base * 3, f1: base * 2, q: 0.8 });
    t += sd * 0.92 + 0.03;
  }
  if (key === 'mewtwo' || key === 'mew') osc(ctx, out, { type: 'sine', f0: f * 3, f1: f * 6, t: t0, dur: 1.2, vol: 0.1, vib: 0.05, vibRate: 4 });
  return t - t0;
}

export function playMove(ctx, dest, fx, vol = 1) {
  const kind = MOVE_KIND[fx] || 'sparkle';
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(dest);
  if (kind === 'fire') {
    hiss(ctx, out, { t, dur: 1.1, vol: 0.4, type: 'lowpass', f0: 500, f1: 2400, q: 0.7, a: 0.08 });
    for (let i = 0; i < 6; i++) hiss(ctx, out, { t: t + Math.random() * 0.9, dur: 0.05, vol: 0.25, f0: 3000 + Math.random() * 3000, q: 4 });
  } else if (kind === 'blast') {
    hiss(ctx, out, { t, dur: 1.6, vol: 0.55, type: 'lowpass', f0: 300, f1: 3000, q: 0.6, a: 0.25 });
    osc(ctx, out, { type: 'sawtooth', f0: 70, f1: 40, t: t + 0.4, dur: 1, vol: 0.25 });
  } else if (kind === 'zap' || kind === 'thunder') {
    for (let i = 0; i < (kind === 'thunder' ? 3 : 7); i++) {
      const s = t + i * 0.09 + Math.random() * 0.05;
      osc(ctx, out, { type: 'sawtooth', f0: 2000 + Math.random() * 2500, f1: 300, t: s, dur: 0.09, vol: 0.18 });
      hiss(ctx, out, { t: s, dur: 0.08, vol: 0.2, type: 'highpass', f0: 2500, q: 0.5 });
    }
    if (kind === 'thunder') {
      hiss(ctx, out, { t: t + 0.15, dur: 2, vol: 0.6, type: 'lowpass', f0: 1200, f1: 80, q: 0.5 });
      osc(ctx, out, { type: 'sine', f0: 60, f1: 30, t: t + 0.15, dur: 1.6, vol: 0.4 });
    }
  } else if (kind === 'water') {
    hiss(ctx, out, { t, dur: 1.2, vol: 0.35, f0: 900, f1: 600, q: 1.2, a: 0.05 });
    for (let i = 0; i < 8; i++) osc(ctx, out, { type: 'sine', f0: 400 + Math.random() * 500, f1: 1200 + Math.random() * 600, t: t + Math.random() * 1, dur: 0.07, vol: 0.12 });
  } else if (kind === 'ice') {
    [1568, 2093, 2637, 3136, 2349].forEach((fr, i) => osc(ctx, out, { type: 'sine', f0: fr, t: t + i * 0.08, dur: 0.9, vol: 0.09 }));
    hiss(ctx, out, { t, dur: 1.3, vol: 0.18, type: 'highpass', f0: 5000, q: 0.5 });
  } else if (kind === 'psychic') {
    [330, 415, 494, 659].forEach((fr, i) => osc(ctx, out, { type: 'sine', f0: fr, f1: fr * 1.5, t: t + i * 0.05, dur: 1.4, vol: 0.09, vib: 0.04, vibRate: 5 + i }));
    osc(ctx, out, { type: 'triangle', f0: 110, f1: 55, t, dur: 1.2, vol: 0.18, vib: 0.1, vibRate: 3 });
  } else if (kind === 'wind') {
    hiss(ctx, out, { t, dur: 1.2, vol: 0.35, f0: 400, f1: 2400, q: 3, a: 0.2 });
  } else if (kind === 'sparkle') {
    [1047, 1319, 1568, 2093, 2637].forEach((fr, i) => osc(ctx, out, { type: 'triangle', f0: fr, t: t + i * 0.07, dur: 0.5, vol: 0.08 }));
  } else if (kind === 'peck') {
    for (let i = 0; i < 6; i++) hiss(ctx, out, { t: t + i * 0.13, dur: 0.05, vol: 0.35, f0: 2500, q: 3 });
  } else if (kind === 'drill') {
    osc(ctx, out, { type: 'sawtooth', f0: 180, f1: 420, t, dur: 1.3, vol: 0.2, vib: 0.2, vibRate: 40 });
    hiss(ctx, out, { t, dur: 1.3, vol: 0.2, f0: 1800, q: 2 });
  } else if (kind === 'slash') {
    hiss(ctx, out, { t, dur: 0.25, vol: 0.45, type: 'highpass', f0: 1200, f1: 6000, q: 0.7 });
    hiss(ctx, out, { t: t + 0.3, dur: 0.25, vol: 0.4, type: 'highpass', f0: 1500, f1: 7000, q: 0.7 });
  } else if (kind === 'hit') {
    osc(ctx, out, { type: 'sine', f0: 140, f1: 45, t: t + 0.25, dur: 0.4, vol: 0.55 });
    hiss(ctx, out, { t: t + 0.25, dur: 0.25, vol: 0.35, type: 'lowpass', f0: 2000, f1: 300, q: 0.5 });
  } else if (kind === 'rumble') {
    osc(ctx, out, { type: 'sine', f0: 55, f1: 32, t, dur: 1.4, vol: 0.55, vib: 0.2, vibRate: 11 });
    hiss(ctx, out, { t, dur: 1.4, vol: 0.4, type: 'lowpass', f0: 500, f1: 120, q: 0.4 });
  } else if (kind === 'beam') {
    osc(ctx, out, { type: 'square', f0: 600, f1: 1800, t, dur: 1, vol: 0.08, vib: 0.03, vibRate: 30 });
    osc(ctx, out, { type: 'sine', f0: 1200, f1: 2400, t, dur: 1, vol: 0.08 });
  } else if (kind === 'snore') {
    osc(ctx, out, { type: 'sawtooth', f0: 70, f1: 90, t, dur: 1.2, vol: 0.12, vib: 0.2, vibRate: 22 });
  }
}

export const CRY_KEYS = Object.keys(CRY);

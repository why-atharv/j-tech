import { RARITY, SPECIES, SPECIES_BY_KEY, PRIZE_KEY, pickSpecies } from './species.js';

export const ARENA_RADIUS = 15;
export const MAX_PLAYERS = 30;
export const ROUND_MS = 2 * 60 * 1000;
export const INTRO_MS = 85 * 1000;
export const RESULTS_MS = 40 * 1000;
export const FRENZY_MS = 30 * 1000;
export const SHOT_COOLDOWN_MS = 650;
export const MISS_PENALTY = 5;
const CAPTURE_HOLD_MS = 3200;
const LEAVE_HOLD_MS = 2200;
const COMBO_WINDOW_MS = 9000;
const NAME_MAX = 16;
export const RESPAWN_MS = 8000;
const HERD = 30;

const rand = (a, b) => a + Math.random() * (b - a);

export function cleanName(name) {
  const text = String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
  return text || 'Trainer';
}

const POKE = ['Pika', 'Char', 'Mew', 'Eevee', 'Zapdos', 'Snorlax', 'Arcan', 'Lapras', 'Vulpix', 'Jolt', 'Flare', 'Raichu', 'Gengar', 'Moltres', 'Blasto', 'Dodrio', 'Scyther', 'Ninetal', 'Rapid', 'Psyduck'];
const ADJ = ['Shiny', 'Mega', 'Ultra', 'Turbo', 'Thunder', 'Blaze', 'Frost', 'Shadow', 'Cosmic', 'Psychic', 'Hyper', 'Royal', 'Neon', 'Savage', 'Mystic', 'Golden', 'Storm', 'Crimson', 'Rapid', 'Legend'];
const TITLE = ['Master', 'Trainer', 'Ace', 'Champ', 'Hunter', 'Ranger', 'Boss', 'King', 'Queen', 'Ninja', 'Snapper', 'Rider', 'Tamer', 'Pro', 'Slayer', 'Wizard'];
const TAGS = ['X', 'Z', 'EX', 'GX', 'Max', 'Prime', 'V'];

const nameKey = (n) => cleanName(n).toLowerCase().replace(/\s+/g, ' ');
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
const fits = (s) => s.length <= NAME_MAX;

const PATTERNS = [
  () => `${pickOf(ADJ)}${pickOf(POKE)}`,
  () => `${pickOf(POKE)} ${pickOf(TITLE)}`,
  () => `${pickOf(ADJ)} ${pickOf(TITLE)}`,
  () => `${pickOf(POKE)}${pickOf(TITLE)}${Math.floor(Math.random() * 90) + 10}`,
  () => `Team ${pickOf(POKE)}`,
  () => `${pickOf(POKE)} ${pickOf(TAGS)}`,
  () => `Mega${pickOf(POKE)} ${pickOf(TAGS)}`,
  () => `${pickOf(ADJ)}${pickOf(TITLE)}`,
  () => `Lord ${pickOf(POKE)}`,
  () => `${pickOf(POKE)}${pickOf(POKE).toLowerCase()}`
];

export function suggestNames(taken = new Set(), base = '', count = 3) {
  const out = new Set();
  const first = cleanName(base).split(' ')[0].replace(/[^\p{L}\p{N}]/gu, '').slice(0, 9);
  const root = base.trim() ? first.charAt(0).toUpperCase() + first.slice(1) : '';
  const own = root
    ? [() => `${root} ${pickOf(TITLE)}`, () => `${pickOf(ADJ)} ${root}`, () => `${root}${pickOf(POKE)}`, () => `${root} the ${pickOf(POKE)}`, () => `${root} ${pickOf(TAGS)}`, () => `${root}${Math.floor(Math.random() * 90) + 10}`]
    : [];
  let guard = 0;
  while (out.size < count && guard++ < 400) {
    const pool = own.length && guard % 3 !== 0 ? own : PATTERNS;
    const name = pickOf(pool)();
    if (!fits(name)) continue;
    if (!taken.has(nameKey(name)) && !out.has(name)) out.add(name);
  }
  return [...out];
}

export const PALETTE = [
  ['#ff2d2d', 'Red'],
  ['#ffe500', 'Yellow'],
  ['#2d6bff', 'Blue'],
  ['#2ee05a', 'Green'],
  ['#ff8c00', 'Orange'],
  ['#b04dff', 'Purple'],
  ['#00e1ff', 'Cyan'],
  ['#ff3fb4', 'Pink'],
  ['#ffffff', 'White'],
  ['#b8742a', 'Brown']
];
export const SHAPES = ['circle', 'square', 'diamond'];

export function playerLook(seat) {
  const i = Math.max(0, seat - 1);
  const [color, colorName] = PALETTE[i % PALETTE.length];
  const shape = SHAPES[Math.floor(i / PALETTE.length) % SHAPES.length];
  return { color, colorName, shape };
}

export function playerColor(seat) {
  return playerLook(seat).color;
}

export function comboMultiplier(combo) {
  return 1 + Math.min(Math.max(combo - 1, 0), 4) * 0.5;
}

export class GameEngine {
  constructor({
    onChange = () => {},
    onEvent = () => {},
    goodies = 10,
    prizesGiven = [],
    emblemsPerRound = 1,
    roundMs = ROUND_MS,
    introMs = INTRO_MS,
    resultsMs = RESULTS_MS
  } = {}) {
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.goodies = goodies;
    this.prizes = [...prizesGiven];
    this.emblemsPerRound = emblemsPerRound;
    this.roundMs = roundMs;
    this.introMs = introMs;
    this.resultsMs = resultsMs;
    this.animals = new Map();
    this.players = new Map();
    this.shots = new Map();
    this.recent = new Map();
    this.phase = 'lobby';
    this.phaseEndsAt = 0;
    this.round = 1;
    this.totalCaught = 0;
    this.emblemPlan = [];
    this.calls = new Set();
    this.timer = null;
    this.lastSpawn = 0;
    this.changeQueued = false;
    this.shotSeq = 0;
    this.respawns = [];
  }

  get goodiesLeft() {
    return Math.max(0, this.goodies - this.prizes.length);
  }

  start() {
    if (this.timer) return;
    this.fillAmbient();
    this.timer = setInterval(() => this.tick(), 250);
    this.changed();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  setPhase(phase, duration = 0) {
    this.phase = phase;
    this.phaseEndsAt = duration ? Date.now() + duration : 0;
    this.onEvent({ type: 'phase', phase, endsAt: this.phaseEndsAt, round: this.round });
    this.changed();
  }

  startRound() {
    if (this.phase !== 'lobby') return false;
    this.setPhase('intro', this.introMs);
    return true;
  }

  beginHunt() {
    if (this.phase !== 'intro' && this.phase !== 'lobby') return false;
    for (const p of this.players.values()) Object.assign(p, { score: 0, hits: 0, shots: 0, combo: 0, best: 0, lastHit: 0, misses: 0, catches: {}, showcase: null });
    this.respawns = [];
    const herd = [...this.animals.values()].filter((a) => a.state === 'alive' && a.species !== PRIZE_KEY).length;
    for (let i = herd; i < HERD; i++) this.spawn(undefined, { quiet: true });
    const count = this.goodiesLeft > 0 ? this.emblemsPerRound : 0;
    this.emblemPlan = Array.from({ length: count }, (_, i) => {
      const slot = (this.roundMs * 0.4) / Math.max(1, count);
      return Date.now() + this.roundMs * 0.28 + slot * i + rand(0, slot * 0.8);
    });
    this.calls.clear();
    this.setPhase('playing', this.roundMs);
    return true;
  }

  endRound() {
    if (this.phase !== 'playing') return false;
    this.emblemPlan = [];
    this.respawns = [];
    for (const a of this.animals.values()) {
      if (a.species === PRIZE_KEY && a.state === 'alive') this.retire(a, 'leaving');
    }
    this.assignShowcase();
    this.setPhase('results', this.resultsMs);
    this.onEvent({ type: 'results', leaderboard: this.leaderboard(10) });
    return true;
  }

  assignShowcase() {
    const order = this.leaderboard(MAX_PLAYERS).map((r) => [...this.players.values()].find((p) => p.pid === r.id)).filter(Boolean);
    const used = new Set();
    const rank = (k) => RARITY[SPECIES_BY_KEY[k].rarity].points;
    const spare = SPECIES.filter((s) => !s.prize).map((s) => s.key).sort(() => Math.random() - 0.5);
    for (const p of order) {
      const caught = Object.entries(p.catches || {}).sort((a, b) => rank(b[0]) - rank(a[0]) || b[1] - a[1]).map(([k]) => k);
      let key = caught.find((k) => !used.has(k));
      const own = !!key;
      if (!key) key = spare.find((k) => !used.has(k)) || caught[0] || spare[0];
      used.add(key);
      p.showcase = { key, own: own || caught[0] === key, count: p.catches?.[key] || 0 };
    }
  }

  resetLobby() {
    this.players.clear();
    this.shots.clear();
    this.round += 1;
    this.setPhase('lobby');
  }

  fillAmbient() {
    while ([...this.animals.values()].filter((a) => a.state === 'alive').length < 10) this.spawn(undefined, { quiet: true });
  }

  newId() {
    let id;
    do id = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    while (this.animals.has(id));
    return id;
  }

  spawn(force, { quiet = false } = {}) {
    const species = SPECIES_BY_KEY[force] || pickSpecies(force);
    if (species.prize) {
      const existing = [...this.animals.values()].find((x) => x.species === species.key && x.state === 'alive');
      if (existing) return existing;
    }
    const rarity = RARITY[species.rarity];
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(rand(0.05, 1)) * ARENA_RADIUS;
    const now = Date.now();
    const ttl = species.prize ? 24 : rand(rarity.ttl[0], rarity.ttl[1]) * (this.phase === 'playing' ? 0.7 : 1);
    const animal = {
      id: this.newId(),
      species: species.key,
      rarity: species.rarity,
      x: +(Math.cos(angle) * r).toFixed(2),
      z: +(Math.sin(angle) * r).toFixed(2),
      seed: Math.floor(Math.random() * 1e9),
      bornAt: now,
      expiresAt: now + ttl * 1000,
      state: 'alive',
      by: null
    };
    this.animals.set(animal.id, animal);
    this.lastSpawn = now;
    if (!quiet) this.onEvent({ type: 'spawn', animal });
    this.changed();
    return animal;
  }

  retire(a, state) {
    a.state = state;
    a.removeAt = Date.now() + (state === 'captured' ? CAPTURE_HOLD_MS : LEAVE_HOLD_MS);
    if (this.phase === 'playing' && a.species !== PRIZE_KEY) this.respawns.push(Date.now() + RESPAWN_MS);
    if (state === 'leaving') this.onEvent({ type: 'leave', animal: a });
    this.changed();
  }

  tick() {
    const now = Date.now();
    for (const a of this.animals.values()) {
      if (a.state === 'alive' && now >= a.expiresAt) this.retire(a, 'leaving');
      else if (a.state !== 'alive' && now >= a.removeAt) {
        if (a.state === 'captured') this.recent.set(a.id, { by: a.by, at: now });
        this.animals.delete(a.id);
        this.changed();
      }
    }
    for (const [id, r] of this.recent) if (now - r.at > 120_000) this.recent.delete(id);
    for (const [id, s] of this.shots) if (now - s.at > 5000) this.shots.delete(id);

    if (this.phaseEndsAt && now >= this.phaseEndsAt) {
      if (this.phase === 'intro') this.beginHunt();
      else if (this.phase === 'playing') this.endRound();
      else if (this.phase === 'results') this.resetLobby();
    }

    if (this.phase === 'playing') {
      const left = this.phaseEndsAt - now;
      for (const [key, at] of [['oneMin', 60_000], ['frenzy', FRENZY_MS], ['countdown', 9_900]]) {
        if (left <= at && !this.calls.has(key)) {
          this.calls.add(key);
          this.onEvent({ type: 'call', line: key });
        }
      }
      if (this.emblemPlan.length && now >= this.emblemPlan[0] && left > 25_000) {
        this.emblemPlan.shift();
        if (this.goodiesLeft > 0) {
          this.spawn(PRIZE_KEY);
          this.onEvent({ type: 'call', line: 'emblem' });
        }
      }
    }

    let alive = [...this.animals.values()].filter((a) => a.state === 'alive' && a.species !== PRIZE_KEY).length;
    if (this.phase === 'playing') {
      while (this.respawns.length && this.respawns[0] <= now) {
        this.respawns.shift();
        if (alive < HERD) {
          this.spawn();
          alive += 1;
        }
      }
      if (alive + this.respawns.length < HERD) this.respawns.push(now + RESPAWN_MS);
    } else if (alive < 10 || (alive < 12 && now - this.lastSpawn > 4000)) this.spawn();
  }

  join(rangerId, name) {
    if (!rangerId) return { ok: false, reason: 'invalid' };
    let p = this.players.get(rangerId);
    if (!p) {
      if (this.phase !== 'lobby' && this.phase !== 'intro') return { ok: false, reason: 'closed' };
      const taken = new Set([...this.players.values()].map((x) => nameKey(x.name)));
      if (taken.has(nameKey(name))) return { ok: false, reason: 'name_taken', suggestions: suggestNames(taken, name) };
      if (this.players.size >= MAX_PLAYERS) return { ok: false, reason: 'full' };
      const used = new Set([...this.players.values()].map((x) => x.seat));
      let seat = 1;
      while (used.has(seat)) seat++;
      p = {
        id: rangerId,
        pid: Math.random().toString(36).slice(2, 10),
        name: cleanName(name),
        seat,
        ...playerLook(seat),
        score: 0,
        hits: 0,
        shots: 0,
        combo: 0,
        best: 0,
        misses: 0,
        catches: {},
        showcase: null,
        lastShot: 0,
        lastHit: 0,
        online: 0
      };
      this.players.set(rangerId, p);
    } else if (name && nameKey(name) !== nameKey(p.name)) {
      const taken = new Set([...this.players.values()].filter((x) => x !== p).map((x) => nameKey(x.name)));
      if (taken.has(nameKey(name))) return { ok: false, reason: 'name_taken', suggestions: suggestNames(taken, name) };
      p.name = cleanName(name);
    }
    p.online += 1;
    this.changed();
    return { ok: true, player: publicPlayer(p) };
  }

  leave(rangerId) {
    const p = this.players.get(rangerId);
    if (!p) return;
    p.online = Math.max(0, p.online - 1);
    if (p.online === 0 && this.phase === 'lobby') {
      setTimeout(() => {
        const q = this.players.get(rangerId);
        if (q && q.online === 0 && this.phase === 'lobby') {
          this.players.delete(rangerId);
          this.changed();
        }
      }, 8000);
    }
    this.changed();
  }

  forget(rangerId) {
    const p = this.players.get(rangerId);
    if (!p || p.online > 0 || p.score > 0 || (this.phase !== 'lobby' && this.phase !== 'intro')) return;
    this.players.delete(rangerId);
    this.changed();
  }

  shoot(rangerId, aim) {
    const p = this.players.get(rangerId);
    if (!p) return { ok: false, reason: 'not_joined' };
    if (this.phase !== 'playing') return { ok: false, reason: 'not_playing' };
    const now = Date.now();
    if (now - p.lastShot < SHOT_COOLDOWN_MS) return { ok: false, reason: 'cooldown' };
    p.lastShot = now;
    p.shots += 1;
    const shotId = `${++this.shotSeq}`;
    this.shots.set(shotId, { rangerId, at: now, aim });
    this.onEvent({ type: 'shot', shotId, player: publicPlayer(p), aim });
    return { ok: true, shotId };
  }

  resolveShot(shotId, animalId) {
    const shot = this.shots.get(shotId);
    if (!shot) return null;
    this.shots.delete(shotId);
    const p = this.players.get(shot.rangerId);
    if (!p) return null;
    const now = Date.now();
    const animal = animalId ? this.animals.get(animalId) : null;

    if (!animal || animal.state !== 'alive') {
      const reason = animal || this.recent.has(animalId) ? 'taken' : 'miss';
      p.combo = 0;
      const grace = false;
      const penalty = reason === 'miss' ? Math.min(MISS_PENALTY, p.score) : 0;
      const takenBy = reason === 'taken' ? animal?.by?.name || this.recent.get(animalId)?.by?.name || null : null;
      p.score -= penalty;
      p.misses = (p.misses || 0) + (reason === 'miss' ? 1 : 0);
      this.changed();
      return { rangerId: p.id, ok: false, reason, penalty, grace, takenBy, aim: shot.aim, player: publicPlayer(p) };
    }

    const species = SPECIES_BY_KEY[animal.species];
    p.combo = now - p.lastHit < COMBO_WINDOW_MS ? p.combo + 1 : 1;
    p.best = Math.max(p.best, p.combo);
    p.lastHit = now;
    p.hits += 1;
    p.catches = p.catches || {};
    p.catches[species.key] = (p.catches[species.key] || 0) + 1;
    const multiplier = comboMultiplier(p.combo);
    const frenzy = this.phaseEndsAt - now <= FRENZY_MS;
    const points = Math.round(RARITY[species.rarity].points * multiplier * (frenzy ? 2 : 1));
    p.score += points;
    this.totalCaught += 1;

    let prize = null;
    if (species.prize) {
      const already = this.prizes.find((x) => x.rangerId === p.id);
      if (already) prize = { code: already.code, already: true };
      else if (this.goodiesLeft > 0) {
        const code = `POKE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        this.prizes.push({ code, rangerId: p.id, name: p.name, at: now });
        prize = { code, already: false };
      }
    }

    animal.by = { id: p.pid, name: p.name, color: p.color };
    this.retire(animal, 'captured');
    const rank = this.leaderboard(MAX_PLAYERS).findIndex((r) => r.id === p.pid) + 1;
    this.onEvent({ type: 'capture', animal, ranger: publicPlayer(p), points, combo: p.combo, frenzy, aim: shot.aim, prize: prize && !prize.already ? prize.code : null });
    if (species.prize) this.onEvent({ type: 'call', line: 'emblemWon' });

    return { rangerId: p.id, ok: true, animal, points, combo: p.combo, multiplier, frenzy, prize, rank, player: publicPlayer(p) };
  }

  leaderboard(limit = 10) {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score || b.hits - a.hits || a.seat - b.seat)
      .slice(0, limit)
      .map(publicPlayer);
  }

  snapshot() {
    return {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      round: this.round,
      seats: { used: this.players.size, max: MAX_PLAYERS },
      players: [...this.players.values()].sort((a, b) => a.seat - b.seat).map(publicPlayer),
      animals: [...this.animals.values()],
      leaderboard: this.leaderboard(10),
      rangersOnline: [...this.players.values()].filter((p) => p.online > 0).length,
      totalCaught: this.totalCaught,
      goodiesLeft: this.goodiesLeft,
      serverNow: Date.now()
    };
  }

  changed() {
    if (this.changeQueued) return;
    this.changeQueued = true;
    queueMicrotask(() => {
      this.changeQueued = false;
      this.onChange(this.snapshot());
    });
  }
}

export function publicPlayer(p) {
  return { id: p.pid, name: p.name, seat: p.seat, color: p.color, shape: p.shape, colorName: p.colorName, score: p.score, hits: p.hits, shots: p.shots, combo: p.combo, best: p.best, online: p.online > 0, showcase: p.showcase || null };
}

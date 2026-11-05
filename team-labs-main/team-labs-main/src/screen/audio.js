import { playCry, playMove } from '../shared/cries.js';

class SoundScape {
  ctx = null;
  master = null;
  muted = false;
  birdTimer = null;

  unlock() {
    if (!this.ctx) this.prepare();
    this.ctx?.resume().catch(() => {});
  }

  prepare() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.startWind();
    this.scheduleBird();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.2);
  }

  noiseBuffer(seconds = 2) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2) * 0.6;
    }
    return buf;
  }

  startWind() {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();
  }

  scheduleBird() {
    clearTimeout(this.birdTimer);
    this.birdTimer = setTimeout(() => {
      this.bird();
      this.scheduleBird();
    }, 1800 + Math.random() * 5200);
  }

  bird() {
    if (!this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.master);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const s = t + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.5), s + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.8, s + 0.08);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.035, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 0.1);
    }
  }

  tone(freq, start, dur, { type = 'sine', vol = 0.15, attack = 0.01 } = {}) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  spawn(rarity) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (rarity === 'legendary' || rarity === 'mythic') {
      [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(f, t + i * 0.12, 2.4, { type: 'triangle', vol: 0.09, attack: 0.2 }));
      this.tone(130.8, t, 3, { type: 'sawtooth', vol: 0.04, attack: 0.5 });
    } else {
      [880, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.8, { vol: 0.06 }));
    }
  }

  capture(rarity) {
    if (!this.ready) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    const scale = rarity === 'legendary' || rarity === 'mythic' ? [523.3, 659.3, 784, 1046.5, 1318.5, 1568] : [659.3, 784, 1046.5, 1318.5];
    scale.forEach((fr, i) => this.tone(fr, t + 0.5 + i * 0.07, 0.6, { type: 'triangle', vol: 0.08 }));
  }

  cry(key, vol = 0.7) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastCry || 0) < 0.35 && vol < 1) return;
    this.lastCry = now;
    playCry(this.ctx, this.master, key, vol);
  }

  move(fx, pos) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastMove || 0) < 1.6) return;
    this.lastMove = now;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = pos ? Math.max(-0.9, Math.min(0.9, pos.x / 22)) : 0;
    pan.connect(this.master);
    playMove(this.ctx, pan, fx, 0.45);
  }

  leave() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(660, t, 0.5, { vol: 0.03 });
    this.tone(440, t + 0.1, 0.6, { vol: 0.03 });
  }
}

export const sound = new SoundScape();

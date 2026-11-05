import { LINES } from '../shared/narration.js';
import { sound } from './audio.js';

const PITCH = 1;
const VOICE_MODE = new URLSearchParams(window.location.search).get('voice') || 'file';
const NATURAL = [/Swara/i, /hi-IN.*(Natural|Online)/i, /Neerja/i, /en-IN.*(Natural|Online)/i];
const FEMALE = /Swara|Neerja|Kalpana|Heera|Ananya|Aarti|Female/i;

let naturalBroken = false;

function findNaturalVoice() {
  if (VOICE_MODE === 'wav' || VOICE_MODE === 'file' || naturalBroken || typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  for (const re of NATURAL) {
    const v = voices.find((x) => re.test(`${x.name} ${x.lang}`) && FEMALE.test(x.name) && (VOICE_MODE === 'natural' || !x.localService));
    if (v) return v;
  }
  return null;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
}

class Narrator {
  buffers = new Map();
  queue = [];
  waiters = [];
  playing = null;
  listeners = new Set();
  chain = null;
  drone = null;

  onLine(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(key, text, duration) {
    for (const fn of this.listeners) fn(key ? { key, text, duration } : null);
  }

  get ctx() {
    return sound.ctx;
  }

  buildChain() {
    const ctx = this.ctx;
    if (!ctx || this.chain) return this.chain;
    const input = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 220;
    low.gain.value = 1.5;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2600;
    presence.Q.value = 0.8;
    presence.gain.value = 3;
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 11000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.ratio.value = 4;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(3.8, 2.6);
    const predelay = ctx.createDelay(0.2);
    predelay.delayTime.value = 0.045;
    input.connect(low).connect(presence).connect(air).connect(comp);
    comp.connect(dry).connect(sound.master);
    comp.connect(predelay).connect(reverb).connect(wet).connect(sound.master);
    this.chain = input;
    return input;
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  startDrone() {
    const ctx = this.ctx;
    if (!ctx || this.drone) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const notes = [55, 82.4, 110.2, 164.8];
    for (const [i, f] of notes.entries()) {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 7;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.18;
      o.connect(g).connect(filter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    filter.connect(gain).connect(sound.master);
    this.drone = gain;
  }

  setDrone(level, seconds = 2) {
    if (!this.drone) return;
    this.drone.gain.setTargetAtTime(level, this.ctx.currentTime, seconds / 3);
  }

  async load(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const promise = fetch(`/voice/${key}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((b) => this.ctx.decodeAudioData(b))
      .catch(() => null);
    this.buffers.set(key, promise);
    return promise;
  }

  preload(keys) {
    if (!this.ctx) return;
    keys.forEach((k) => this.load(k));
  }

  say(keys, { interrupt = false } = {}) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (interrupt) this.stop();
    this.queue.push(...list);
    const finished = new Promise((resolve) => this.waiters.push(resolve));
    if (!this.playing) this.next();
    return finished;
  }

  stop() {
    this.queue = [];
    if (this.playing?.source) {
      try {
        this.playing.source.stop();
      } catch (err) {
        void err;
      }
    }
    clearTimeout(this.playing?.timer);
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.playing = null;
    this.emit(null);
    this.flush();
  }

  get voiceName() {
    return findNaturalVoice()?.name || 'Swara · Poke Queen';
  }

  speakNatural(voice, key, token) {
    const line = LINES[key];
    let u;
    try {
      u = new SpeechSynthesisUtterance(line.say.replace(/\.\.\./g, '…'));
      u.voice = voice;
    } catch {
      naturalBroken = true;
      return false;
    }
    u.lang = voice.lang || 'hi-IN';
    u.rate = 0.97;
    u.pitch = 1.16;
    u.volume = 1;
    const duration = Math.max(2.5, line.sub.length * 0.068);
    this.emit(key, line.sub, duration);
    this.startDrone();
    this.setDrone(0.12, 1.5);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (this.playing === token) token.timer = setTimeout(() => this.next(), 450);
    };
    u.onend = finish;
    u.onerror = finish;
    token.timer = setTimeout(finish, duration * 1000 * 1.8 + 3000);
    try {
      speechSynthesis.speak(u);
    } catch {
      naturalBroken = true;
      clearTimeout(token.timer);
      return false;
    }
    return true;
  }

  flush() {
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((r) => r());
  }

  async next() {
    const key = this.queue.shift();
    if (!key) {
      this.playing = null;
      this.emit(null);
      this.setDrone(0.05, 4);
      this.flush();
      return;
    }
    this.lastKey = key;
    const text = LINES[key]?.sub || '';
    const token = {};
    this.playing = token;
    const ctx = this.ctx;
    const natural = ctx && ctx.state === 'running' ? findNaturalVoice() : null;
    if (natural && this.speakNatural(natural, key, token)) return;
    const buffer = ctx && ctx.state === 'running' ? await this.load(key) : null;
    if (this.playing !== token) return;

    if (buffer) {
      this.startDrone();
      this.setDrone(0.16, 1.5);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = PITCH;
      source.connect(this.buildChain());
      token.source = source;
      const duration = buffer.duration / PITCH;
      this.emit(key, text, duration);
      source.onended = () => {
        if (this.playing === token) token.timer = setTimeout(() => this.next(), 500);
      };
      source.start();
    } else {
      const duration = Math.max(2.5, text.length * 0.075);
      this.emit(key, text, duration);
      token.timer = setTimeout(() => this.playing === token && this.next(), duration * 1000 + 400);
    }
  }
}

export const narrator = new Narrator();

import { haptic } from './device.js';
import { playCry, playMove } from '../shared/cries.js';

let ctx = null;

export function unlockAudio() {
  if (ctx) return ctx.resume();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) ctx = new AC();
}

function tone(freq, at, dur, type = 'sine', vol = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const buzz = (pattern) => haptic(pattern);

let bus = null;
function out() {
  if (!ctx) return null;
  if (!bus) {
    bus = ctx.createDynamicsCompressor();
    bus.connect(ctx.destination);
  }
  return bus;
}

export const sfx = {
  cry(key, vol = 0.9) {
    if (ctx) playCry(ctx, out(), key, vol);
  },
  move(fx, vol = 0.8) {
    if (ctx) playMove(ctx, out(), fx, vol);
  },
  locked() {
    tone(330, 0, 0.12, 'triangle', 0.08);
    tone(247, 0.1, 0.18, 'triangle', 0.08);
    buzz([20, 40, 20]);
  },
  shutter() {
    tone(2400, 0, 0.03, 'square', 0.05);
    tone(900, 0.03, 0.06, 'square', 0.04);
    buzz(15);
  },
  tick() {
    tone(1800, 0, 0.04, 'sine', 0.05);
  },
  go() {
    [523, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.12));
    buzz([30, 40, 80]);
  },
  lock() {
    tone(1400, 0, 0.08, 'square', 0.06);
    buzz(30);
  },
  success(rarity) {
    const notes = rarity === 'legendary' || rarity === 'mythic' ? [523, 659, 784, 1047, 1319, 1568] : rarity === 'rare' ? [587, 740, 880, 1175] : [659, 880, 1319];
    notes.forEach((f, i) => tone(f, i * 0.08, 0.5, 'triangle', 0.14));
    buzz(rarity === 'legendary' || rarity === 'mythic' ? [60, 40, 60, 40, 200] : [40, 30, 90]);
  },
  fail() {
    tone(220, 0, 0.25, 'sawtooth', 0.08);
    tone(165, 0.12, 0.35, 'sawtooth', 0.08);
    buzz([120, 60, 120]);
  }
};

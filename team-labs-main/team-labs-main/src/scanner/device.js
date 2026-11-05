const nav = typeof navigator !== 'undefined' ? navigator : {};

export const isIOS = /iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

export const lowEnd = (() => {
  if (typeof window === 'undefined') return false;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const forced = new URLSearchParams(window.location.search).get('lite');
  if (forced !== null) return forced !== '0';
  return reduce || cores <= 4 || memory <= 2;
})();

let iosSwitch = null;

function ensureIosSwitch() {
  if (iosSwitch || typeof document === 'undefined') return iosSwitch;
  const label = document.createElement('label');
  label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = label;
  return label;
}

export function haptic(pattern = 20) {
  if (nav.vibrate) {
    nav.vibrate(pattern);
    return;
  }
  if (isIOS) {
    const pulses = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1;
    const label = ensureIosSwitch();
    for (let i = 0; i < pulses; i++) setTimeout(() => label?.click(), i * 90);
  }
}

let wakeLock = null;

export async function keepAwake(on) {
  try {
    if (on && !wakeLock && nav.wakeLock) {
      wakeLock = await nav.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

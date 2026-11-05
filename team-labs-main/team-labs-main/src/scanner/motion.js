const DEG = Math.PI / 180;

export function motionSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export async function requestMotion() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      return (await DOE.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return motionSupported();
}

export function pointing(alpha, beta, gamma) {
  const a = (alpha || 0) * DEG;
  const b = (beta || 0) * DEG;
  const g = (gamma || 0) * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cg = Math.cos(g);
  const sg = Math.sin(g);
  const x = -ca * sg - sa * sb * cg;
  const y = -sa * sg + ca * sb * cg;
  const z = -cb * cg;
  return { yaw: Math.atan2(x, y), pitch: Math.asin(Math.max(-1, Math.min(1, z))) };
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function watchMotion(onPose) {
  const handler = (e) => {
    if (e.alpha == null && e.beta == null) return;
    onPose(pointing(e.alpha, e.beta, e.gamma));
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}

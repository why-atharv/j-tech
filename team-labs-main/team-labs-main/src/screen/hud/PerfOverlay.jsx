import { useEffect, useState } from 'react';
import { runtime } from '../world/atmosphere.js';
import { tierOf } from '../world/quality.js';

const shortGpu = (name) =>
  name
    .replace(/^ANGLE \(/, '')
    .replace(/\)$/, '')
    .replace(/Direct3D11 vs_5_0 ps_5_0, D3D11/, 'D3D11')
    .replace(/\(0x[0-9A-F]+\)/gi, '')
    .replace(/\s+,/g, ',')
    .trim();

export function PerfOverlay({ open, quality, auto }) {
  const [, tick] = useState(0);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    const t = setTimeout(() => setBoot(false), 20000);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, []);

  const p = runtime.perf;
  const weak = p.gpuClass === 'software' || p.gpuClass === 'integrated';
  if (!open && !(weak && boot)) return null;

  const fpsClass = p.fps >= 55 ? 'good' : p.fps >= 40 ? 'ok' : 'bad';
  return (
    <div className={`perf ${weak ? 'perf--warn' : ''}`}>
      <div className="perf__gpu">
        <span className={`perf__badge perf__badge--${p.gpuClass}`}>{p.gpuClass === 'discrete' ? 'GPU' : p.gpuClass === 'software' ? 'CPU!' : p.gpuClass === 'integrated' ? 'iGPU' : '?'}</span>
        {shortGpu(p.gpu || 'detecting…')}
      </div>
      {weak && (
        <div className="perf__alert">
          {p.gpuClass === 'software' ? 'Rendering on the CPU. ' : 'Using the integrated GPU, not NVIDIA. '}
          Windows Settings → System → Display → Graphics → add Edge → High performance, then restart Edge. Check edge://gpu.
        </div>
      )}
      <div className="perf__grid">
        <span>FPS</span>
        <b className={`perf__fps perf__fps--${fpsClass}`}>{p.fps}</b>
        <span>Frame</span>
        <b>{p.ms} ms</b>
        <span>Worst</span>
        <b>{p.worst} ms</b>
        <span>Draws</span>
        <b>{p.calls}</b>
        <span>Tris</span>
        <b>{(p.tris / 1e6).toFixed(2)} M</b>
        <span>Output</span>
        <b>
          {p.width}×{p.height}
        </b>
        {p.face > 0 && (
          <>
            <span>Dome</span>
            <b>
              {p.faces} views · {p.face}×{p.faceH} · L{p.level}
            </b>
          </>
        )}
        <span>Quality</span>
        <b>
          {tierOf(quality).label}
          {auto ? ' (auto)' : ''}
        </b>
      </div>
      <div className="perf__keys">F2 hide · Q quality · A auto</div>
    </div>
  );
}

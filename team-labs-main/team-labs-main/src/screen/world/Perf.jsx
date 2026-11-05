import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { runtime } from './atmosphere.js';
import { classifyGpu, readGpuName } from './quality.js';

export function PerfProbe({ onGpu }) {
  const { gl } = useThree();
  const acc = useRef({ t: 0, n: 0, worst: 0, calls: 0, tris: 0 });

  useEffect(() => {
    const name = readGpuName(gl);
    runtime.perf.gpu = name;
    runtime.perf.gpuClass = classifyGpu(name);
    gl.info.autoReset = false;
    onGpu?.(runtime.perf.gpuClass, name);
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_, dt) => {
    const a = acc.current;
    const p = runtime.perf;
    a.t += dt;
    a.n += 1;
    a.worst = Math.max(a.worst, dt);
    a.calls = gl.info.render.calls;
    a.tris = gl.info.render.triangles;
    gl.info.reset();
    if (a.t >= 1) {
      p.fps = Math.round(a.n / a.t);
      p.ms = +((a.t / a.n) * 1000).toFixed(1);
      p.worst = Math.round(a.worst * 1000);
      p.calls = a.calls;
      p.tris = a.tris;
      p.width = gl.domElement.width;
      p.height = gl.domElement.height;
      a.t = 0;
      a.n = 0;
      a.worst = 0;
    }
  }, -100);

  return null;
}

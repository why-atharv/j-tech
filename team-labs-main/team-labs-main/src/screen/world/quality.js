export const TIERS = {
  high: { label: 'High', grass: 70000, flatGrass: 110000, shadows: true, shadowMap: 2048, faceCap: 1536, butterflies: 56, sparkles: 28, ao: true },
  balanced: { label: 'Balanced', grass: 40000, flatGrass: 50000, shadows: true, shadowMap: 1024, faceCap: 1152, butterflies: 28, sparkles: 18, ao: false },
  low: { label: 'Low', grass: 18000, flatGrass: 22000, shadows: false, shadowMap: 1024, faceCap: 896, butterflies: 12, sparkles: 0, ao: false }
};

export const TIER_ORDER = ['high', 'balanced', 'low'];

export const tierOf = (q) => TIERS[q] || TIERS.high;

export function classifyGpu(name = '') {
  if (/SwiftShader|llvmpipe|softpipe|Basic Render|Microsoft Basic/i.test(name)) return 'software';
  if (/NVIDIA|GeForce|RTX|GTX|Quadro|Radeon RX|Radeon Pro|Arc\(TM\) A|Arc A\d/i.test(name)) return 'discrete';
  if (/Intel|Iris|UHD|HD Graphics|Radeon\(TM\)|Vega|Adreno|Mali|Apple/i.test(name)) return 'integrated';
  return 'unknown';
}

export function recommendedTier(gpuClass) {
  if (gpuClass === 'software') return 'low';
  if (gpuClass === 'integrated') return 'balanced';
  return 'high';
}

export function readGpuName(gl) {
  try {
    const ctx = gl.getContext();
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  } catch {
    return 'unknown';
  }
}

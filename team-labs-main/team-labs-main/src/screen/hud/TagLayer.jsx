import { memo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SPECIES_BY_KEY, RARITY } from '../../shared/species.js';
import { runtime } from '../world/atmosphere.js';
import { domeProject, domeTanV } from '../world/DomeRenderer.jsx';

const AnimalLabel = memo(function AnimalLabel({ species, rarity, data, timeOffset }) {
  const total = Math.max(1, (data.expiresAt - data.bornAt) / 1000);
  const elapsed = Math.max(0, (Date.now() + timeOffset - data.bornAt) / 1000);
  return (
    <div className={`label label--${species.rarity}`} style={{ '--accent': species.glow || rarity.color }}>
      <div className="label__chip">
        <span className="label__icon">{species.image ? <img className="species-img" src={species.image} alt="" /> : species.emoji}</span>
        <span className="label__name">{species.name}</span>
        <span className="label__pts">{species.prize ? '🎁' : `+${rarity.points}`}</span>
      </div>
      <div className="label__timer">
        <i style={{ animationDuration: `${total}s`, animationDelay: `-${elapsed}s` }} />
      </div>
    </div>
  );
});

export function TagLayer({ animals, timeOffset, show }) {
  return (
    <div className={`tags ${show ? '' : 'tags--hidden'}`}>
      {animals
        .filter((a) => a.state === 'alive')
        .map((a) => {
          const species = SPECIES_BY_KEY[a.species];
          return (
            <div key={a.id} className="tags__slot" ref={(el) => (el ? runtime.tagEls.set(a.id, el) : runtime.tagEls.delete(a.id))}>
              <AnimalLabel species={species} rarity={RARITY[species.rarity]} data={a} timeOffset={timeOffset} />
            </div>
          );
        })}
    </div>
  );
}

const v = new THREE.Vector3();
const proj = { x: 0, y: 0 };
const MARGIN = 6;

export function TagProjector({ view, fovH }) {
  const { camera, size } = useThree();
  const layout = runtime.tagLayout;
  const hud = useRef({ at: 0, rects: [] });

  const project = (point, out) => {
    if (view === 'dome') {
      const halfH = THREE.MathUtils.degToRad(fovH / 2);
      const tanV = domeTanV(fovH, size.width, size.height);
      v.copy(point).applyMatrix4(camera.matrixWorldInverse);
      const dist = v.length();
      const p = domeProject(v, halfH, tanV, proj);
      if (!p) return null;
      out.x = (p.x * 0.5 + 0.5) * size.width;
      out.y = (-p.y * 0.5 + 0.5) * size.height;
      out.scale = size.width / THREE.MathUtils.degToRad(fovH) / Math.max(0.5, dist);
      return out;
    }
    v.copy(point).applyMatrix4(camera.matrixWorldInverse);
    const depth = -v.z;
    if (depth <= 0.1) return null;
    v.copy(point).project(camera);
    out.x = (v.x * 0.5 + 0.5) * size.width;
    out.y = (-v.y * 0.5 + 0.5) * size.height;
    out.scale = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / depth;
    return out;
  };

  runtime.hitTest = (aim) => {
    const ax = aim.x * size.width;
    const ay = aim.y * size.height;
    const p = {};
    let best = null;
    let bestScore = Infinity;
    for (const [id, t] of runtime.targets) {
      if (!project(t.center, p)) continue;
      const r = t.radius * p.scale + 8;
      const d = Math.hypot(p.x - ax, p.y - ay);
      if (d < r && d < bestScore) {
        bestScore = d;
        best = id;
      }
    }
    return best;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    camera.updateMatrixWorld();
    const now = performance.now();
    if (now - hud.current.at > 500) {
      hud.current.at = now;
      hud.current.rects = [...document.querySelectorAll('[data-tag-avoid]')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
    }

    const items = [];
    for (const [id, el] of runtime.tagEls) {
      const anchor = runtime.anchors.get(id);
      const p = {};
      const visible = !!anchor && !!project(anchor, p);
      const w = el.offsetWidth || 100;
      const h = el.offsetHeight || 30;
      let l = layout.get(id);
      if (!l && visible) {
        l = { x: p.x, y: p.y - h / 2 - 8 };
        layout.set(id, l);
      }
      items.push({ el, l, w, h, visible: visible && !!l, ax: p.x, ay: p.y, x: 0, y: 0 });
    }

    const pull = 1 - Math.exp(-dt * 8);
    for (const it of items) {
      if (!it.visible) continue;
      it.x = it.l.x + (it.ax - it.l.x) * pull;
      it.y = it.l.y + (it.ay - it.h / 2 - 8 - it.l.y) * pull;
    }
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        if (!a.visible) continue;
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j];
          if (!b.visible) continue;
          const ox = (a.w + b.w) / 2 + MARGIN - Math.abs(a.x - b.x);
          const oy = (a.h + b.h) / 2 + MARGIN - Math.abs(a.y - b.y);
          if (ox <= 0 || oy <= 0) continue;
          if (ox < oy) {
            const s = (a.x <= b.x ? -1 : 1) * ox * 0.5;
            a.x += s;
            b.x -= s;
          } else {
            const s = (a.y <= b.y ? -1 : 1) * oy * 0.5;
            a.y += s;
            b.y -= s;
          }
        }
      }
      for (const it of items) {
        if (!it.visible) continue;
        for (const r of hud.current.rects) {
          const ox = Math.min(it.x + it.w / 2 + MARGIN, r.right) - Math.max(it.x - it.w / 2 - MARGIN, r.left);
          const oy = Math.min(it.y + it.h / 2 + MARGIN, r.bottom) - Math.max(it.y - it.h / 2 - MARGIN, r.top);
          if (ox <= 0 || oy <= 0) continue;
          if (ox < oy) it.x += it.x < (r.left + r.right) / 2 ? -ox : ox;
          else it.y += it.y < (r.top + r.bottom) / 2 ? -oy : oy;
        }
        it.x = THREE.MathUtils.clamp(it.x, it.w / 2 + 6, size.width - it.w / 2 - 6);
        it.y = THREE.MathUtils.clamp(it.y, it.h / 2 + 6, size.height - it.h / 2 - 6);
      }
    }

    for (const it of items) {
      it.el.style.opacity = it.visible ? '1' : '0';
      if (!it.visible) continue;
      it.l.x = it.x;
      it.l.y = it.y;
      it.el.style.transform = `translate3d(${(it.x - it.w / 2).toFixed(1)}px, ${(it.y - it.h / 2).toFixed(1)}px, 0)`;
    }
    for (const id of layout.keys()) if (!runtime.tagEls.has(id)) layout.delete(id);
  });
  return null;
}

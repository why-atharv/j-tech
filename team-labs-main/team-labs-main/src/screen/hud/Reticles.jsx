import { useEffect, useRef } from 'react';
import { runtime } from '../world/atmosphere.js';

export function Reticles({ active, hidden }) {
  const layer = useRef(null);

  useEffect(() => {
    const root = layer.current;
    if (!root) return undefined;
    const pool = new Map();
    const flashes = [];
    const popups = [];
    let raf = 0;
    let last = performance.now();
    let W = root.clientWidth;
    let H = root.clientHeight;
    const resize = new ResizeObserver(() => {
      W = root.clientWidth;
      H = root.clientHeight;
    });
    resize.observe(root);

    const make = (a) => {
      const el = document.createElement('div');
      el.className = 'reticle';
      el.innerHTML = '<div class="reticle__ring"></div><div class="reticle__dot"></div><div class="reticle__tag"><b></b><span></span></div>';
      root.appendChild(el);
      return { el, x: a.x, y: a.y, seen: 0, name: '', seat: 0, color: '', shape: '', ping: false, namedUntil: 0 };
    };

    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ease = 1 - Math.exp(-dt * 14);

      for (const a of runtime.aims || []) {
        let r = pool.get(a.id);
        if (!r) {
          r = make(a);
          pool.set(a.id, r);
        }
        r.seen = now;
        r.tx = a.x;
        r.ty = a.y;
        if (r.color !== a.c) {
          r.color = a.c;
          r.el.style.setProperty('--c', a.c);
        }
        const shape = a.h || 'circle';
        if (r.shape !== shape) {
          r.el.classList.remove(`reticle--${r.shape}`);
          r.shape = shape;
          r.el.classList.add(`reticle--${shape}`);
        }
        const ping = !!a.f;
        if (r.ping !== ping) {
          r.ping = ping;
          r.el.classList.toggle('is-ping', ping);
        }
        if (r.name !== a.n || r.seat !== a.s) {
          r.name = a.n;
          r.seat = a.s;
          r.el.querySelector('b').textContent = a.s;
          r.el.querySelector('span').textContent = a.n;
        }
      }
      for (const [id, r] of pool) {
        if (now - r.seen > 1500) {
          r.el.remove();
          pool.delete(id);
          continue;
        }
        if (r.namedUntil && now > r.namedUntil) {
          r.namedUntil = 0;
          r.el.classList.remove('is-named');
        }
        r.x += (r.tx - r.x) * ease;
        r.y += (r.ty - r.y) * ease;
        r.el.style.transform = `translate3d(${(r.x * W).toFixed(1)}px, ${(r.y * H).toFixed(1)}px, 0)`;
      }

      while (runtime.shots.length) {
        const s = runtime.shots.shift();
        const el = document.createElement('div');
        el.className = 'shutter';
        el.style.setProperty('--c', s.color);
        el.style.transform = `translate3d(${s.x * W}px, ${s.y * H}px, 0)`;
        root.appendChild(el);
        flashes.push({ el, at: now });
        const shooter = pool.get(s.id);
        if (shooter) {
          shooter.el.classList.remove('is-firing');
          requestAnimationFrame(() => shooter.el.classList.add('is-firing'));
          shooter.namedUntil = now + 1400;
          shooter.el.classList.add('is-named');
        }
      }
      while (flashes.length && now - flashes[0].at > 700) flashes.shift().el.remove();

      while (runtime.popups.length) {
        const p = runtime.popups.shift();
        const el = document.createElement('div');
        el.className = `popup ${p.big ? 'popup--big' : ''}`;
        el.style.setProperty('--c', p.color);
        el.style.transform = `translate3d(${p.x * W}px, ${p.y * H}px, 0)`;
        el.innerHTML = `<b></b><span></span>`;
        el.querySelector('b').textContent = p.text;
        el.querySelector('span').textContent = p.sub || '';
        root.appendChild(el);
        popups.push({ el, at: now });
      }
      while (popups.length && now - popups[0].at > 1800) popups.shift().el.remove();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      root.innerHTML = '';
    };
  }, []);

  return <div ref={layer} className={`reticles ${active ? '' : 'reticles--idle'} ${hidden ? 'reticles--hidden' : ''}`} />;
}

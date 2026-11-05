import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { GameEngine } from '../src/shared/engine.js';
import { RARITY, SPECIES_BY_KEY, PRIZE_KEY } from '../src/shared/species.js';
import { getLanIps, loadCertificate } from './network.js';
import { findCloudflared, startTunnel } from './tunnel.js';

const HTTP_PORT = Number(process.env.WILDSCAN_PORT) || 3000;
const HTTPS_PORT = Number(process.env.WILDSCAN_HTTPS_PORT) || 3443;
const GOODIES = Number(process.env.WILDSCAN_GOODIES ?? 10);
const EMBLEMS_PER_ROUND = Number(process.env.WILDSCAN_EMBLEMS_PER_ROUND ?? 1);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const hasBuild = fs.existsSync(path.join(distDir, 'index.html'));

const wantTunnel = process.argv.includes('--tunnel') || process.env.WILDSCAN_TUNNEL === '1';
const lanIps = getLanIps();
const info = {
  lanIp: lanIps[0]?.address || 'localhost',
  lanIps: lanIps.map((i) => i.address),
  httpPort: HTTP_PORT,
  httpsPort: HTTPS_PORT,
  publicUrl: null
};

const app = express();
app.get('/api/info', (_req, res) => res.json(info));
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

if (hasBuild) {
  app.use(
    express.static(distDir, {
      setHeaders: (res, file) =>
        res.setHeader('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable')
    })
  );
  app.get('/scanner', (_req, res) => res.redirect(301, '/scanner/'));
}

const httpServer = http.createServer(app);
const cert = loadCertificate(path.join(root, '.certs'), info.lanIps);
const httpsServer = https.createServer(cert, app);

const io = new Server({ cors: { origin: '*' }, pingInterval: 20000, pingTimeout: 30000 });
io.attach(httpServer);
io.attach(httpsServer);

const winnersFile = path.join(root, 'winners.json');
const loadWinners = () => {
  try {
    return JSON.parse(fs.readFileSync(winnersFile, 'utf8'));
  } catch {
    return [];
  }
};

const screens = [];
const primary = () => screens[0];
const pendingShots = new Map();
const aims = new Map();

function deliverShot(result) {
  if (!result) return;
  const { rangerId, ...payload } = result;
  for (const [, s] of io.of('/').sockets) if (s.data.rangerId === rangerId) s.emit('shot_result', payload);
}

const slim = ({ animals, ...rest }) => ({ ...rest, emblemOut: animals.some((a) => a.species === PRIZE_KEY && a.state === 'alive') });
const phoneFeed = { timer: null, last: 0, phase: null, next: null };
function flushPhones() {
  clearTimeout(phoneFeed.timer);
  phoneFeed.timer = null;
  phoneFeed.last = Date.now();
  phoneFeed.phase = phoneFeed.next.phase;
  io.except('screens').emit('snapshot', slim(phoneFeed.next));
}
function queuePhones(snapshot) {
  phoneFeed.next = snapshot;
  if (snapshot.phase !== phoneFeed.phase) flushPhones();
  else if (!phoneFeed.timer) phoneFeed.timer = setTimeout(flushPhones, Math.max(0, 250 - (Date.now() - phoneFeed.last)));
}

const engine = new GameEngine({
  goodies: GOODIES,
  emblemsPerRound: EMBLEMS_PER_ROUND,
  roundMs: (Number(process.env.WILDSCAN_ROUND_SEC) || 120) * 1000,
  introMs: (Number(process.env.WILDSCAN_INTRO_SEC) || 85) * 1000,
  resultsMs: (Number(process.env.WILDSCAN_RESULTS_SEC) || 40) * 1000,
  prizesGiven: loadWinners().map((w) => ({ code: w.code, rangerId: w.rangerId, name: w.name, at: Date.parse(w.at) })),
  onChange: (snapshot) => {
    io.to('screens').emit('snapshot', snapshot);
    queuePhones(snapshot);
  },
  onEvent: (event) => {
    if (event.type === 'shot') {
      const screen = primary();
      if (screen) screen.emit('shot', event);
      const timer = setTimeout(() => {
        pendingShots.delete(event.shotId);
        deliverShot(engine.resolveShot(event.shotId, null));
      }, 1500);
      pendingShots.set(event.shotId, timer);
      return;
    }
    io.emit('event', event);
    if (event.type === 'capture' && event.prize) {
      const winners = loadWinners();
      const prize = engine.prizes.find((p) => p.code === event.prize);
      winners.push({ name: event.ranger.name, code: event.prize, at: new Date().toISOString(), rangerId: prize?.rangerId });
      fs.writeFileSync(winnersFile, JSON.stringify(winners, null, 2));
      console.log(`\n  🔮 MEWTWO GOODIES WINNER  ${event.ranger.name}  —  claim code ${event.prize}  (${engine.goodiesLeft} goodies left)\n`);
    }
    if (event.type === 'phase') console.log(`  ▸ Round ${event.round}: ${event.phase}`);
  }
});

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
app.get('/api/winners', (req, res) => {
  if (!isLocal(req)) return res.status(403).json({ error: 'Open this on the host computer.' });
  res.json({ goodiesLeft: engine.goodiesLeft, winners: loadWinners().map(({ rangerId, ...w }) => w) });
});

setInterval(() => {
  if (!screens.length) return;
  const now = Date.now();
  const list = [];
  for (const [rangerId, a] of aims) {
    const p = engine.players.get(rangerId);
    if (!p || now - a.t > 4000 || now - a.moved > 8000) continue;
    list.push({ id: p.pid, x: a.x, y: a.y, c: p.color, n: p.name, s: p.seat, h: p.shape, f: now - a.ping < 1600 ? 1 : 0 });
  }
  for (const s of screens) s.volatile.emit('aims', list);
}, 50);

const num01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

io.on('connection', (socket) => {
  socket.on('hello', (msg = {}, ack) => {
    if (typeof ack !== 'function') return;
    if (msg.role === 'screen') {
      socket.data.role = 'screen';
      socket.join('screens');
      if (!screens.includes(socket)) screens.push(socket);
      return ack({ snapshot: engine.snapshot(), info, primary: primary() === socket });
    }
    const rangerId = typeof msg.rangerId === 'string' ? msg.rangerId.slice(0, 64) : '';
    if (!rangerId) return ack({ error: 'invalid' });
    const previous = socket.data.rangerId;
    if (previous && previous !== rangerId) {
      engine.leave(previous);
      engine.forget(previous);
      aims.delete(previous);
    }
    const joined = engine.join(rangerId, msg.name);
    if (!joined.ok) return ack({ error: joined.reason, suggestions: joined.suggestions, snapshot: slim(engine.snapshot()), info });
    if (socket.data.rangerId !== rangerId) socket.data.rangerId = rangerId;
    else engine.leave(rangerId);
    socket.data.role = 'ranger';
    ack({ me: joined.player, snapshot: slim(engine.snapshot()), info });
  });

  socket.on('aim', (msg = {}) => {
    if (!socket.data.rangerId) return;
    const now = Date.now();
    const prev = aims.get(socket.data.rangerId);
    const x = num01(msg.x);
    const y = num01(msg.y);
    const moved = !prev || Math.abs(prev.x - x) > 0.004 || Math.abs(prev.y - y) > 0.004 ? now : prev.moved;
    aims.set(socket.data.rangerId, { x, y, t: now, moved, ping: prev?.ping || 0 });
  });

  socket.on('find_me', () => {
    if (!socket.data.rangerId) return;
    const now = Date.now();
    const prev = aims.get(socket.data.rangerId) || { x: 0.5, y: 0.5 };
    aims.set(socket.data.rangerId, { ...prev, t: now, moved: now, ping: now });
  });

  socket.on('shoot', (msg = {}, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.rangerId) return reply({ ok: false, reason: 'not_joined' });
    const aim = { x: num01(msg.x), y: num01(msg.y) };
    aims.set(socket.data.rangerId, { ...aim, t: Date.now(), moved: Date.now(), ping: aims.get(socket.data.rangerId)?.ping || 0 });
    reply(engine.shoot(socket.data.rangerId, aim));
  });

  socket.on('hit', (msg = {}) => {
    if (socket !== primary()) return;
    const timer = pendingShots.get(msg.shotId);
    if (!timer) return;
    clearTimeout(timer);
    pendingShots.delete(msg.shotId);
    deliverShot(engine.resolveShot(msg.shotId, typeof msg.animalId === 'string' ? msg.animalId : null));
  });

  socket.on('operator', (msg = {}) => {
    if (socket.data.role !== 'screen') return;
    if (msg.cmd === 'start') engine.startRound();
    else if (msg.cmd === 'skip' && engine.phase === 'intro') engine.beginHunt();
    else if (msg.cmd === 'end') engine.endRound();
    else if (msg.cmd === 'lobby' && engine.phase === 'results') engine.resetLobby();
    else if (msg.cmd === 'spawn') engine.spawn(RARITY[msg.arg] || SPECIES_BY_KEY[msg.arg] ? msg.arg : 'legendary');
  });

  socket.on('disconnect', () => {
    const i = screens.indexOf(socket);
    if (i >= 0) {
      screens.splice(i, 1);
      if (i === 0 && screens[0]) screens[0].emit('primary', true);
    }
    if (socket.data.rangerId) {
      engine.leave(socket.data.rangerId);
      aims.delete(socket.data.rangerId);
    }
  });
});

engine.start();

const phoneUrl = () => (info.publicUrl ? `${info.publicUrl}/scanner/` : `http://${info.lanIp}:${HTTP_PORT}/scanner/`);

setInterval(() => {
  const ips = getLanIps().map((i) => i.address);
  if (ips.join() !== info.lanIps.join()) {
    info.lanIps = ips;
    info.lanIp = ips[0] || 'localhost';
    io.emit('info', info);
    console.log(`  Network changed — phones now join via ${phoneUrl()}`);
  }
}, 5000);

if (wantTunnel) {
  startTunnel({
    binary: findCloudflared(root),
    port: HTTP_PORT,
    onUrl: (url) => {
      if (info.publicUrl === url) return;
      info.publicUrl = url;
      io.emit('info', info);
      console.log(`\n  Public tunnel  ${url}/scanner/  (works on any network, no certificate warning)\n`);
    },
    onExit: (err) => {
      info.publicUrl = null;
      io.emit('info', info);
      if (err?.code === 'ENOENT') {
        console.log('\n  Tunnel unavailable: cloudflared is not installed.');
        console.log('  Install it from https://github.com/cloudflare/cloudflared/releases');
        console.log('  (or put cloudflared.exe in ./bin/) and run again.\n');
      } else {
        console.log(`\n  Tunnel stopped: ${err?.message || 'unknown error'}\n`);
      }
    }
  });
}

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('\n  POKEMONS WORLD · IDEAS 4.0 dome server');
    console.log('  ─────────────────────────────────────────────');
    if (hasBuild) {
      console.log(`  Dome screen    http://localhost:${HTTP_PORT}`);
      console.log(`  Phones         ${phoneUrl()}`);
    } else {
      console.log('  API + sockets only (no dist/ build). In dev, open Vite on :5199;');
      console.log('  run `npm run serve` to build and serve everything from this server.');
    }
    if (info.lanIps.length > 1) console.log(`  Other LAN IPs  ${info.lanIps.slice(1).join(', ')}`);
    console.log(`  Goodies left   ${engine.goodiesLeft} of ${GOODIES}  ·  Mewtwo per round: ${EMBLEMS_PER_ROUND}`);
    console.log('  Host keys on the dome screen: SPACE start · N skip intro · E end round · K Mewtwo');
    console.log("  Phones can't reach this PC? Use the laptop's Mobile Hotspot or `npm run tunnel`.\n");
  });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    engine.stop();
    io.close();
    process.exit(0);
  });
}

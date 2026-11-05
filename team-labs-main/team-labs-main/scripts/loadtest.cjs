const { io } = require('socket.io-client');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const SERVER = args.url || 'http://localhost:3000';
const BOTS = Number(args.bots) || 30;
const ROUNDS = Number(args.rounds) || 1;
const START = args.start !== 'no';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toTimeString().slice(0, 8);
const log = (...a) => console.log(stamp(), ...a);

const stats = { snapshots: 0, snapshotBytes: 0, shots: 0, hits: 0, misses: 0, timeouts: 0, rtt: [], disconnects: 0, errors: 0 };

function bot(i) {
  const s = io(SERVER, { transports: ['websocket'], reconnectionDelayMax: 6000 });
  const b = { s, i, seated: false, phase: 'lobby', name: `Bot${String(i).padStart(2, '0')}` };
  const hello = () =>
    s.emit('hello', { role: 'ranger', rangerId: `loadtest-${i}`, name: b.name }, (res) => {
      if (res?.error === 'name_taken') b.name = res.suggestions?.[0] || `${b.name}x`;
      b.seated = !!res?.me;
      if (res?.snapshot) b.phase = res.snapshot.phase;
    });
  s.on('connect', hello);
  s.on('disconnect', () => stats.disconnects++);
  s.on('connect_error', () => stats.errors++);
  s.on('snapshot', (snap) => {
    stats.snapshots++;
    stats.snapshotBytes += JSON.stringify(snap).length;
    if (snap.phase === 'lobby' && b.phase !== 'lobby' && !b.seated) hello();
    b.phase = snap.phase;
  });
  s.on('shot_result', (res) => {
    if (res?.ok) stats.hits++;
    else stats.misses++;
  });
  b.aim = { x: Math.random(), y: 0.35 + Math.random() * 0.4 };
  b.aimTimer = setInterval(() => {
    b.aim.x = Math.min(1, Math.max(0, b.aim.x + (Math.random() - 0.5) * 0.04));
    b.aim.y = Math.min(0.9, Math.max(0.2, b.aim.y + (Math.random() - 0.5) * 0.03));
    s.volatile.emit('aim', b.aim);
  }, 66);
  const shoot = () => {
    b.shotTimer = setTimeout(shoot, 1400 + Math.random() * 2200);
    if (b.phase !== 'playing') return;
    const t0 = Date.now();
    stats.shots++;
    let done = false;
    const guard = setTimeout(() => {
      if (!done) stats.timeouts++;
      done = true;
    }, 4000);
    s.emit('shoot', { ...b.aim }, () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      stats.rtt.push(Date.now() - t0);
    });
  };
  b.shotTimer = setTimeout(shoot, Math.random() * 2000);
  b.stop = () => {
    clearInterval(b.aimTimer);
    clearTimeout(b.shotTimer);
    s.close();
  };
  return b;
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

(async () => {
  log(`load test: ${BOTS} bots → ${SERVER}, ${ROUNDS} round(s)`);
  const op = io(SERVER, { transports: ['websocket'] });
  await new Promise((r, j) => {
    op.on('connect', r);
    op.on('connect_error', () => j(new Error(`cannot reach ${SERVER} — is the server running?`)));
  });
  const snapNow = () => new Promise((r) => op.emit('hello', { role: 'screen' }, (res) => r(res.snapshot)));
  const bots = [];
  for (let i = 0; i < BOTS; i++) {
    bots.push(bot(i));
    await wait(40);
  }
  await wait(1500);
  let snap = await snapNow();
  log(`seated ${snap.seats.used}/${snap.seats.max}, phase ${snap.phase}`);

  for (let r = 0; r < ROUNDS; r++) {
    snap = await snapNow();
    if (START && snap.phase === 'lobby') op.emit('operator', { cmd: 'start' });
    await wait(1000);
    snap = await snapNow();
    if (snap.phase === 'intro') op.emit('operator', { cmd: 'skip' });
    log(`round ${r + 1}: hunting…`);
    while ((await snapNow()).phase !== 'results') {
      await wait(5000);
      const p50 = pct(stats.rtt, 50);
      const p95 = pct(stats.rtt, 95);
      log(`shots ${stats.shots} · hits ${stats.hits} · misses ${stats.misses} · timeouts ${stats.timeouts} · ack p50 ${p50}ms p95 ${p95}ms · drops ${stats.disconnects}`);
    }
    snap = await snapNow();
    const top = snap.leaderboard.slice(0, 3).map((p) => `${p.name} ${p.score}`).join(', ');
    log(`round ${r + 1} results — top: ${top}`);
    if (r < ROUNDS - 1) {
      op.emit('operator', { cmd: 'lobby' });
      await wait(3000);
    }
  }

  const perPhone = stats.snapshots / BOTS;
  console.log('\n===== summary =====');
  console.log(`bots ${BOTS}, snapshots per phone ${perPhone.toFixed(0)}, avg size ${(stats.snapshotBytes / Math.max(1, stats.snapshots) / 1024).toFixed(1)} KB`);
  console.log(`shots ${stats.shots}, hits ${stats.hits}, misses ${stats.misses}, lost acks ${stats.timeouts}`);
  console.log(`shot ack latency p50 ${pct(stats.rtt, 50)}ms, p95 ${pct(stats.rtt, 95)}ms, max ${pct(stats.rtt, 100)}ms`);
  console.log(`disconnects ${stats.disconnects}, connect errors ${stats.errors}`);
  const ok = stats.timeouts === 0 && stats.disconnects === 0 && pct(stats.rtt, 95) < 300;
  console.log(ok ? 'RESULT: PASS' : 'RESULT: CHECK — see numbers above');
  bots.forEach((b) => b.stop());
  op.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

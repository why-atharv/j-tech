import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { GameEngine } from '../shared/engine.js';
import { runtime } from './world/atmosphere.js';

export const CHANNEL = 'wildscan';
const SOLO_AFTER_MS = 3500;

const EMPTY = { phase: 'lobby', animals: [], leaderboard: [], players: [], seats: { used: 0, max: 30 }, rangersOnline: 0, totalCaught: 0 };

function resolveLocally(aim) {
  return runtime.hitTest ? runtime.hitTest(aim) : null;
}

export function useGame(onEvent) {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [mode, setMode] = useState('connecting');
  const [info, setInfo] = useState(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const socketRef = useRef(null);
  const engineRef = useRef(null);
  const primaryRef = useRef(false);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;

  const apply = useCallback((snap) => {
    if (snap.serverNow) setTimeOffset(snap.serverNow - Date.now());
    setSnapshot(snap);
  }, []);

  useEffect(() => {
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    const soloAims = new Map();

    const flashShot = (ev) => {
      runtime.shots.push({ id: ev.player.id, x: ev.aim.x, y: ev.aim.y, color: ev.player.color, at: performance.now() });
    };

    const startSolo = () => {
      if (engineRef.current) return;
      const engine = new GameEngine({
        onChange: (snap) => {
          apply(snap);
          channel?.postMessage({ type: 'snapshot', snapshot: snap });
        },
        onEvent: (ev) => {
          if (ev.type === 'shot') {
            flashShot(ev);
            const result = engine.resolveShot(ev.shotId, resolveLocally(ev.aim));
            if (result) {
              const { rangerId, ...payload } = result;
              channel?.postMessage({ type: 'shot_result', rangerId, result: payload });
            }
            return;
          }
          eventRef.current?.(ev);
          channel?.postMessage({ type: 'event', event: ev });
        }
      });
      engineRef.current = engine;
      engine.start();
      primaryRef.current = true;
      setMode('solo');
    };

    const stopSolo = () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };

    const soloTimer = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const now = Date.now();
      runtime.aims = [...soloAims]
        .filter(([, a]) => now - a.t < 4000)
        .map(([rangerId, a]) => {
          const p = engine.players.get(rangerId);
          return p && { id: p.pid, x: a.x, y: a.y, c: p.color, n: p.name, s: p.seat, h: p.shape };
        })
        .filter(Boolean);
    }, 50);

    if (channel) {
      channel.onmessage = ({ data: msg }) => {
        const engine = engineRef.current;
        if (!engine || !msg) return;
        if (msg.type === 'aim') {
          soloAims.set(msg.rangerId, { x: msg.x, y: msg.y, t: Date.now() });
          return;
        }
        if (msg.type === 'bye') {
          engine.leave(msg.rangerId);
          return;
        }
        if (!msg.reqId) return;
        let reply;
        if (msg.type === 'hello') {
          if (msg.previous && msg.previous !== msg.rangerId) engine.forget(msg.previous);
          const joined = engine.join(msg.rangerId, msg.name);
          reply = joined.ok ? { me: joined.player, snapshot: engine.snapshot() } : { error: joined.reason, suggestions: joined.suggestions, snapshot: engine.snapshot() };
        } else if (msg.type === 'shoot') {
          soloAims.set(msg.rangerId, { x: msg.x, y: msg.y, t: Date.now() });
          reply = engine.shoot(msg.rangerId, { x: msg.x, y: msg.y });
        }
        if (reply) channel.postMessage({ type: 'reply', reqId: msg.reqId, reply });
      };
    }

    const socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 8000, timeout: 4000 });
    socketRef.current = socket;
    const soloStart = setTimeout(() => !socket.connected && startSolo(), SOLO_AFTER_MS);

    socket.on('connect', () => {
      socket.emit('hello', { role: 'screen' }, (res) => {
        stopSolo();
        primaryRef.current = !!res.primary;
        setInfo(res.info);
        apply(res.snapshot);
        setMode('live');
      });
    });
    socket.on('disconnect', () => setMode((m) => (m === 'live' ? 'connecting' : m)));
    socket.on('snapshot', (snap) => Array.isArray(snap?.animals) && apply(snap));
    socket.on('info', setInfo);
    socket.on('primary', () => (primaryRef.current = true));
    socket.on('event', (ev) => eventRef.current?.(ev));
    socket.on('aims', (list) => (runtime.aims = list));
    socket.on('shot', (ev) => {
      flashShot(ev);
      if (primaryRef.current) socket.emit('hit', { shotId: ev.shotId, animalId: resolveLocally(ev.aim) });
    });

    return () => {
      clearTimeout(soloStart);
      clearInterval(soloTimer);
      socket.close();
      stopSolo();
      channel?.close();
    };
  }, [apply]);

  const operator = useCallback((cmd, arg) => {
    const engine = engineRef.current;
    if (engine) {
      if (cmd === 'start') engine.startRound();
      else if (cmd === 'skip' && engine.phase === 'intro') engine.beginHunt();
      else if (cmd === 'end') engine.endRound();
      else if (cmd === 'lobby' && engine.phase === 'results') engine.resetLobby();
      else if (cmd === 'spawn') engine.spawn(arg);
    } else {
      socketRef.current?.emit('operator', { cmd, arg });
    }
  }, []);

  const spawn = useCallback((arg = 'legendary') => operator('spawn', arg), [operator]);

  return { snapshot, mode, info, timeOffset, spawn, operator };
}

export function scannerUrlFor(info) {
  const { protocol, hostname, port, origin } = window.location;
  if (info?.publicUrl) return `${info.publicUrl}/scanner/`;
  if (!info?.lanIp) return `${origin}/scanner/`;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const host = isLocal ? info.lanIp : hostname;
  if (String(port) === String(info.httpPort) || String(port) === String(info.httpsPort)) {
    return `http://${host}:${info.httpPort}/scanner/`;
  }
  return `${protocol === 'https:' ? 'https' : 'http'}://${host}${port ? `:${port}` : ''}/scanner/`;
}

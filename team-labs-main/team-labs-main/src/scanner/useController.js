import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const CHANNEL = 'wildscan';
const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(`pokeworld:${k}`)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`pokeworld:${k}`, JSON.stringify(v));
    } catch (err) {
      void err;
    }
  }
};

const makeId = () => (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '');

function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const idFor = (device, name) => `${device}.${hash(name.trim().toLowerCase().replace(/\s+/g, ' '))}`;

export function useController() {
  const [deviceId] = useState(() => {
    const id = store.get('device', null) || makeId();
    store.set('device', id);
    return id;
  });
  const [name, setNameState] = useState(() => store.get('name', ''));
  const [link, setLink] = useState('connecting');
  const [status, setStatus] = useState('idle');
  const [me, setMe] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [result, setResult] = useState(null);
  const [offset, setOffset] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const socketRef = useRef(null);
  const channelRef = useRef(null);
  const pending = useRef(new Map());
  const joinedRound = useRef(null);
  const nameRef = useRef(name);
  const idRef = useRef(name ? idFor(deviceId, name) : '');
  const previousRef = useRef('');
  const wantJoin = useRef(!!name);
  const lastAim = useRef(0);

  const applySnapshot = useCallback((snap) => {
    if (snap?.serverNow) setOffset(snap.serverNow - Date.now());
    setSnapshot(snap);
  }, []);

  const request = useCallback(
    (type, payload = {}, timeout = 1500) =>
      new Promise((resolve, reject) => {
        const channel = channelRef.current;
        if (!channel) return reject(new Error('no channel'));
        const reqId = makeId();
        const timer = setTimeout(() => {
          pending.current.delete(reqId);
          reject(new Error('timeout'));
        }, timeout);
        pending.current.set(reqId, (reply) => {
          clearTimeout(timer);
          resolve(reply);
        });
        channel.postMessage({ type, reqId, rangerId: idRef.current, previous: previousRef.current, name: nameRef.current, ...payload });
      }),
    []
  );

  const handleHello = useCallback(
    (res) => {
      if (!res) return;
      if (res.snapshot) applySnapshot(res.snapshot);
      if (res.error) {
        if (res.error === 'name_taken') {
          wantJoin.current = false;
          setSuggestions(res.suggestions || []);
          setStatus('name_taken');
          return;
        }
        setStatus(res.error === 'full' ? 'full' : res.error === 'closed' ? 'closed' : 'error');
        return;
      }
      previousRef.current = '';
      setSuggestions([]);
      setMe(res.me);
      joinedRound.current = res.snapshot?.round;
      setStatus('in');
    },
    [applySnapshot]
  );

  const hello = useCallback(() => ({ role: 'ranger', rangerId: idRef.current, previous: previousRef.current, name: nameRef.current }), []);

  const join = useCallback(() => {
    if (!nameRef.current) return;
    wantJoin.current = true;
    setStatus('joining');
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('hello', hello(), handleHello);
    else request('hello').then(handleHello).catch(() => setStatus('offline'));
  }, [request, handleHello, hello]);

  useEffect(() => {
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = ({ data: msg }) => {
        if (socketRef.current?.connected) return;
        if (msg?.type === 'reply') {
          pending.current.get(msg.reqId)?.(msg.reply);
          pending.current.delete(msg.reqId);
        } else if (msg?.type === 'snapshot') applySnapshot(msg.snapshot);
        else if (msg?.type === 'shot_result' && msg.rangerId === idRef.current) setResult({ ...msg.result, at: Date.now() });
      };
    }
    const socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 6000, timeout: 4000 });
    socketRef.current = socket;
    socket.on('connect', () => {
      setLink('live');
      if (nameRef.current && wantJoin.current) socket.emit('hello', hello(), handleHello);
    });
    socket.on('disconnect', () => setLink('connecting'));
    socket.on('snapshot', applySnapshot);
    socket.on('shot_result', (r) => setResult({ ...r, at: Date.now() }));
    const probe = setTimeout(() => {
      if (socket.connected) return;
      request('hello')
        .then((r) => {
          if (socket.connected) return;
          setLink('local');
          if (nameRef.current && wantJoin.current) handleHello(r);
        })
        .catch(() => !socket.connected && setLink('offline'));
    }, 3000);
    const bye = () => channel?.postMessage({ type: 'bye', rangerId: idRef.current });
    window.addEventListener('pagehide', bye);
    return () => {
      clearTimeout(probe);
      window.removeEventListener('pagehide', bye);
      socket.close();
      channel?.close();
    };
  }, [request, applySnapshot, handleHello, hello]);

  useEffect(() => {
    if (!snapshot || !me) return;
    const row = snapshot.players?.find((p) => p.id === me.id);
    if (row) {
      if (row.score !== me.score || row.combo !== me.combo || row.hits !== me.hits || row.showcase?.key !== me.showcase?.key) setMe(row);
    } else if (status === 'in' && snapshot.phase === 'lobby' && snapshot.round !== joinedRound.current) {
      wantJoin.current = false;
      setStatus('over');
    }
  }, [snapshot, me, status]);

  useEffect(() => {
    if ((status === 'full' || status === 'closed') && snapshot?.phase === 'lobby') {
      const t = setTimeout(join, 1500 + Math.random() * 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, snapshot?.phase, join]);

  const setName = useCallback(
    (n) => {
      const clean = n.replace(/[<>]/g, '').trim().slice(0, 16);
      const next = idFor(deviceId, clean);
      if (idRef.current && idRef.current !== next) previousRef.current = idRef.current;
      idRef.current = next;
      store.set('name', clean);
      nameRef.current = clean;
      setNameState(clean);
      setMe(null);
      join();
    },
    [join, deviceId]
  );

  const aim = useCallback((x, y) => {
    const now = performance.now();
    if (now - lastAim.current < 60) return;
    lastAim.current = now;
    const socket = socketRef.current;
    if (socket?.connected) socket.volatile.emit('aim', { x, y });
    else channelRef.current?.postMessage({ type: 'aim', rangerId: idRef.current, x, y });
  }, []);

  const shoot = useCallback(
    (x, y) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (socket?.connected) socket.timeout(4000).emit('shoot', { x, y }, (err, res) => resolve(err ? { ok: false, reason: 'timeout' } : res));
        else request('shoot', { x, y }).then(resolve).catch(() => resolve({ ok: false, reason: 'offline' }));
      }),
    [request]
  );

  const findMe = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('find_me');
  }, []);

  return { name, setName, link, status, me, snapshot, offset, aim, shoot, findMe, result, join, suggestions };
}

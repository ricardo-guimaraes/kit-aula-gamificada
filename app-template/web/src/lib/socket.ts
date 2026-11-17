import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack } from '../../../shared/types.ts';

export const socket: Socket = io({
  transports: ['websocket', 'polling'],
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

/** Emite com ack e timeout, devolvendo sempre um Ack (nunca lança). */
export function emitAck<T = object>(event: string, payload: unknown, timeoutMs = 6000): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (err: unknown, res: Ack<T>) => {
      if (err) resolve({ ok: false, error: 'Sem resposta do servidor. Verifique a conexão.', code: 'timeout' });
      else resolve(res);
    });
  });
}

export function useConnected(): boolean {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    return () => {
      socket.off('connect', on);
      socket.off('disconnect', off);
    };
  }, []);
  return connected;
}

/** Roda `fn` agora (se conectado) e a cada reconexão. */
export function onEveryConnect(fn: () => void): () => void {
  if (socket.connected) fn();
  socket.on('connect', fn);
  return () => {
    socket.off('connect', fn);
  };
}

// --- relógio do servidor -----------------------------------------------------

let offset = 0; // serverNow - Date.now()
let bestRtt = Infinity;

async function syncClock() {
  for (let i = 0; i < 4; i++) {
    const t0 = Date.now();
    const res = await emitAck<{ serverNow: number }>('time:ping', {}, 3000);
    const t1 = Date.now();
    if (!res.ok) continue;
    const rtt = t1 - t0;
    if (rtt <= bestRtt) {
      bestRtt = rtt;
      offset = res.serverNow + rtt / 2 - t1;
    }
  }
}

socket.on('connect', () => {
  bestRtt = Infinity;
  void syncClock();
});

/** Usado antes do primeiro ping: o estado traz serverNow. */
export function hintServerNow(serverNow: number) {
  if (bestRtt === Infinity) offset = serverNow - Date.now();
}

export const serverNow = () => Date.now() + offset;

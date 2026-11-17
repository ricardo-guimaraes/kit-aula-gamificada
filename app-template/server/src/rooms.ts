// Liga a lógica pura (game.ts) ao Socket.IO: salas em memória, timers e envio de estado.
import type { Server, Socket } from 'socket.io';
import type { Ack, HostAction } from '../../shared/types.ts';
import {
  answerOffer,
  createRoom,
  findByToken,
  hostCommand,
  joinPlayer,
  nextDeadline,
  placeBid,
  privateState,
  publicState,
  tick,
  type Room,
} from './game.ts';

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'; // sem vogais: nada de palavrão por acaso
const HOST_ACTIONS: HostAction[] = ['next', 'back', 'pause', 'resume', 'togglePause', 'addTime', 'skip', 'lock', 'kick', 'restart'];

export const rooms = new Map<string, Room>();
const timers = new Map<string, NodeJS.Timeout>();
const socketCounts = new Map<string, number>(); // `${code}:${playerId}` -> sockets abertos

const playerChannel = (code: string, playerId: string) => `${code}:p:${playerId}`;
const normCode = (raw: unknown) => String(raw ?? '').trim().toUpperCase();

function newCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
    if (!rooms.has(code)) return code;
  }
}

type AckFn = (res: Ack<Record<string, unknown>>) => void;
const safeAck = (ack: unknown): AckFn => (typeof ack === 'function' ? (ack as AckFn) : () => {});

let latestCode: string | null = null;

/** Sala mais recente criada pelo professor (é para onde a raiz "/" manda os alunos). */
export function currentRoomCode(): string | null {
  return latestCode && rooms.has(latestCode) ? latestCode : null;
}

export function registerHandlers(
  io: Server,
  opts: { isAdmin: (key: unknown) => boolean; deckPath?: string } = { isAdmin: () => true },
) {
  function broadcast(room: Room, privates = true) {
    io.to(room.code).emit('room:state', publicState(room));
    if (!privates) return;
    for (const p of room.players.values()) {
      io.to(playerChannel(room.code, p.id)).emit('player:private', privateState(room, p));
    }
  }

  function schedule(room: Room) {
    const old = timers.get(room.code);
    if (old) clearTimeout(old);
    timers.delete(room.code);
    const deadline = nextDeadline(room);
    if (deadline === null) return;
    const t = setTimeout(
      () => {
        timers.delete(room.code);
        if (!rooms.has(room.code)) return;
        if (tick(room, Date.now())) broadcast(room);
        schedule(room);
      },
      Math.max(0, deadline - Date.now()) + 5,
    );
    timers.set(room.code, t);
  }

  function getRoom(code: unknown): Room | undefined {
    return rooms.get(normCode(code));
  }

  function handle(socket: Socket, event: string, fn: (payload: any, ack: AckFn) => void) {
    socket.on(event, (payload: unknown, ack: unknown) => {
      const reply = safeAck(ack);
      try {
        fn(payload ?? {}, reply);
      } catch (e) {
        console.error(`[${event}]`, e);
        reply({ ok: false, error: 'Erro inesperado. Tente de novo.' });
      }
    });
  }

  io.on('connection', (socket) => {
    handle(socket, 'host:create', (payload, ack) => {
      if (!opts.isAdmin(payload.adminKey)) return ack({ ok: false, error: 'Chave do professor inválida.', code: 'forbidden' });
      const room = createRoom(newCode(), { short: !!payload.short });
      rooms.set(room.code, room);
      latestCode = room.code;
      socket.join(room.code);
      console.log(`[sala ${room.code}] criada (${room.lots.length} lotes)`);
      ack({ ok: true, code: room.code, secret: room.hostSecret });
    });

    // Telão (com ou sem segredo) passa a receber o estado da sala.
    handle(socket, 'room:watch', (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) return ack({ ok: false, error: 'Sala não encontrada.', code: 'noroom' });
      socket.join(room.code);
      room.lastActivity = Date.now();
      const isHost = payload.secret === room.hostSecret;
      // Só o professor (com o segredo da sala) recebe o caminho secreto da apresentação.
      ack({ ok: true, isHost, deckPath: isHost ? opts.deckPath : undefined, state: publicState(room) });
    });

    handle(socket, 'host:command', (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) return ack({ ok: false, error: 'Sala não encontrada.', code: 'noroom' });
      if (payload.secret !== room.hostSecret) return ack({ ok: false, error: 'Sem permissão.', code: 'forbidden' });
      if (!HOST_ACTIONS.includes(payload.action)) return ack({ ok: false, error: 'Comando inválido.' });
      const res = hostCommand(room, payload.action, Date.now(), payload.arg);
      if (res.ok) {
        if (payload.action === 'kick') {
          const channel = playerChannel(room.code, String(payload.arg));
          io.to(channel).emit('player:kicked');
          io.in(channel).socketsLeave([channel, room.code]);
        }
        schedule(room);
        broadcast(room);
      }
      ack(res);
    });

    handle(socket, 'player:join', (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) return ack({ ok: false, error: 'Sala não encontrada. Confira o código.', code: 'noroom' });
      const res = joinPlayer(room, payload);
      if (!res.ok) return ack(res);
      const { player } = res;
      const prev = socket.data.playerKey as string | undefined;
      if (prev !== `${room.code}:${player.id}`) {
        socket.data.playerKey = `${room.code}:${player.id}`;
        socketCounts.set(socket.data.playerKey, (socketCounts.get(socket.data.playerKey) ?? 0) + 1);
      }
      player.connected = true;
      socket.join([room.code, playerChannel(room.code, player.id)]);
      ack({ ok: true, playerId: player.id, token: player.token, name: player.name, reconnected: res.reconnected });
      if (!res.reconnected) console.log(`[sala ${room.code}] entrou ${player.name} (${room.players.size})`);
      broadcast(room);
    });

    handle(socket, 'player:bid', (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) return ack({ ok: false, error: 'Sala não encontrada.', code: 'noroom' });
      const player = findByToken(room, payload.token);
      if (!player) return ack({ ok: false, error: 'Entre na sala de novo.', code: 'player' });
      const res = placeBid(room, player.id, payload.increment, payload.base, Date.now());
      ack(res);
      if (res.ok) {
        schedule(room);
        broadcast(room, false);
      }
    });

    handle(socket, 'player:offer', (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) return ack({ ok: false, error: 'Sala não encontrada.', code: 'noroom' });
      const player = findByToken(room, payload.token);
      if (!player) return ack({ ok: false, error: 'Entre na sala de novo.', code: 'player' });
      const res = answerOffer(room, player.id, payload.accept, Date.now());
      ack(res);
      if (res.ok) {
        schedule(room);
        broadcast(room);
      }
    });

    // Usado pelo celular para medir a diferença de relógio com mais precisão.
    handle(socket, 'time:ping', (_payload, ack) => ack({ ok: true, serverNow: Date.now() }));

    socket.on('disconnect', () => {
      const key = socket.data.playerKey as string | undefined;
      if (!key) return;
      const n = (socketCounts.get(key) ?? 1) - 1;
      if (n > 0) return void socketCounts.set(key, n);
      socketCounts.delete(key);
      const [code, playerId] = key.split(':');
      const room = rooms.get(code);
      const player = room?.players.get(playerId);
      if (room && player) {
        player.connected = false;
        io.to(room.code).emit('room:state', publicState(room));
      }
    });
  });

  // Limpeza: salas paradas há mais de 2 h saem da memória.
  setInterval(
    () => {
      const now = Date.now();
      for (const [code, room] of rooms) {
        if (now - room.lastActivity > ROOM_TTL_MS) {
          clearTimeout(timers.get(code));
          timers.delete(code);
          rooms.delete(code);
          console.log(`[sala ${code}] removida por inatividade`);
        }
      }
    },
    10 * 60 * 1000,
  ).unref();
}

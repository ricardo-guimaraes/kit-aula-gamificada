// Lógica pura do leilão: sem Socket.IO e sem timers. Toda função recebe `now`
// para poder ser testada com relógio falso. Quem agenda os timers é rooms.ts.
//
// Cada lote tem `units` unidades. Os `units` maiores lances levam uma unidade
// cada e cada vencedor paga o próprio lance. Com 1 unidade, é um leilão comum.
import { randomBytes } from 'node:crypto';
import {
  INCREMENTS,
  INTRO_STEPS,
  NAME_MAX,
  START_BUDGET,
  unitsFor,
  type Ack,
  type AckError,
  type Awards,
  type HostAction,
  type Phase,
  type PrivateState,
  type PublicResult,
  type RevealedCard,
  type RoomState,
  type Standing,
  type WinningBid,
} from '../../shared/types.ts';
import { lotsFor, toPublic, type LotDef } from './lots.ts';
import { isProfane } from './words.ts';

export const BID_MS = 15_000;
export const EXTEND_MS = 5_000;
export const HARD_CAP_MS = 30_000;
export const SOLD_MS = 6_000;
export const OFFER_MS = 10_000;
export const ADD_TIME_MS = 10_000;
export const MAX_BIDS_PER_SEC = 5;
export const MAX_PLAYERS = 150;

export type Player = {
  id: string;
  token: string;
  name: string;
  budget: number;
  connected: boolean;
  bidTimes: number[];
};

export type WinnerResult = { playerId: string; name: string; price: number; reorganized: boolean };

export type LotResult = {
  lotIndex: number;
  winners: WinnerResult[];
  skipped: boolean;
};

type Bid = { amount: number; at: number; seq: number };

export type Room = {
  code: string;
  hostSecret: string;
  phase: Phase;
  locked: boolean;
  short: boolean;
  lots: LotDef[];
  introStep: number;
  /** 0 até o leilão começar; depois fica fixo. */
  units: number;
  lotIndex: number;
  bids: Map<string, Bid>;
  bidSeq: number;
  endsAt: number;
  hardCapAt: number;
  paused: boolean;
  remainingMs: number;
  hardCapRemainingMs: number;
  bidFeed: { name: string; amount: number; at: number }[];
  players: Map<string, Player>;
  results: LotResult[];
  revealIndex: number;
  /** Arrematantes da gaveta que ainda não responderam à proposta. */
  offerPending: Set<string>;
  /** Todos os que receberam a proposta (responderam ou não). */
  offerEligible: Set<string>;
  lastActivity: number;
};

const err = (error: string, code?: string, suggestion?: string): AckError => ({ ok: false, error, code, suggestion });
const rid = (bytes: number) => randomBytes(bytes).toString('base64url');

export function createRoom(code: string, opts: { short?: boolean; hostSecret?: string } = {}, now = Date.now()): Room {
  const short = !!opts.short;
  return {
    code,
    hostSecret: opts.hostSecret ?? rid(12),
    phase: 'lobby',
    locked: false,
    short,
    lots: lotsFor(short),
    introStep: 0,
    units: 0,
    lotIndex: 0,
    bids: new Map(),
    bidSeq: 0,
    endsAt: 0,
    hardCapAt: 0,
    paused: false,
    remainingMs: 0,
    hardCapRemainingMs: 0,
    bidFeed: [],
    players: new Map(),
    results: [],
    revealIndex: 0,
    offerPending: new Set(),
    offerEligible: new Set(),
    lastActivity: now,
  };
}

/** Unidades por lote: calculado ao vivo até o leilão começar, depois fixo. */
export function currentUnits(room: Room): number {
  return room.units || unitsFor(room.players.size, room.lots.length);
}

// ---------------------------------------------------------------- jogadores

const nameKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function cleanName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findByToken(room: Room, token: unknown): Player | undefined {
  if (typeof token !== 'string' || !token) return undefined;
  for (const p of room.players.values()) if (p.token === token) return p;
  return undefined;
}

export function joinPlayer(
  room: Room,
  input: { name?: unknown; token?: unknown },
  now = Date.now(),
): Ack<{ player: Player; reconnected: boolean }> {
  const existing = findByToken(room, input.token);
  if (existing) {
    room.lastActivity = now;
    return { ok: true, player: existing, reconnected: true };
  }
  if (room.locked) return err('A sala está trancada para novos jogadores.', 'locked');
  if (room.players.size >= MAX_PLAYERS) return err('A sala está cheia.', 'full');

  const name = cleanName(input.name);
  if (!name) return err('Digite seu nome.', 'name');
  if (name.length > NAME_MAX) return err(`Use até ${NAME_MAX} caracteres.`, 'name');
  if (isProfane(name)) return err('Escolha outro nome, por favor.', 'profane');

  const taken = new Set([...room.players.values()].map((p) => nameKey(p.name)));
  if (taken.has(nameKey(name))) {
    let n = 2;
    let suggestion = '';
    do {
      const suffix = ` ${n}`;
      suggestion = name.slice(0, NAME_MAX - suffix.length).trimEnd() + suffix;
      n++;
    } while (taken.has(nameKey(suggestion)));
    return err(`Já tem "${name}" na sala. Que tal "${suggestion}"?`, 'dup', suggestion);
  }

  const player: Player = { id: rid(8), token: rid(18), name, budget: START_BUDGET, connected: true, bidTimes: [] };
  room.players.set(player.id, player);
  room.lastActivity = now;
  return { ok: true, player, reconnected: false };
}

// ------------------------------------------------------------------- lances

/** Lances que estão levando uma unidade agora: maiores primeiro; no empate, quem deu antes. */
export function winningBids(room: Room): WinningBid[] {
  return [...room.bids.entries()]
    .filter(([id]) => room.players.has(id))
    .sort(([, a], [, b]) => b.amount - a.amount || a.seq - b.seq)
    .slice(0, currentUnits(room))
    .map(([playerId, b]) => ({ playerId, name: room.players.get(playerId)!.name, amount: b.amount }));
}

/** Base dos botões: 0 se ainda há unidade sem lance, senão o menor lance vencedor. */
export function cutoffOf(room: Room, winning = winningBids(room)): number {
  return winning.length < currentUnits(room) ? 0 : winning[winning.length - 1].amount;
}

export function openLot(room: Room, index: number, now: number) {
  room.phase = 'bidding';
  room.lotIndex = index;
  room.bids = new Map();
  room.bidFeed = [];
  room.endsAt = now + BID_MS;
  room.hardCapAt = now + HARD_CAP_MS;
  room.paused = false;
  room.offerPending = new Set();
  room.offerEligible = new Set();
}

export function placeBid(
  room: Room,
  playerId: string,
  increment: unknown,
  base: unknown,
  now = Date.now(),
): Ack<{ amount: number }> {
  const player = room.players.get(playerId);
  if (!player) return err('Jogador não encontrado.', 'player');
  if (room.phase !== 'bidding') return err('Os lances estão fechados.', 'closed');
  if (room.paused) return err('Relógio pausado. Aguarde o professor.', 'paused');
  if (now >= room.endsAt) return err('Tempo esgotado.', 'closed');
  if (!INCREMENTS.includes(increment as never)) return err('Lance inválido.', 'invalid');

  player.bidTimes = player.bidTimes.filter((t) => now - t < 1000);
  if (player.bidTimes.length >= MAX_BIDS_PER_SEC) return err('Calma! Muitos lances seguidos.', 'rate');
  player.bidTimes.push(now);

  const winning = winningBids(room);
  if (winning.some((w) => w.playerId === playerId)) return err('Você já está levando uma unidade!', 'leader');
  const cutoff = cutoffOf(room, winning);
  if (typeof base === 'number' && base !== cutoff)
    return err(cutoff ? `Alguém foi mais rápido! Agora o menor lance que leva é R$ ${cutoff} mi.` : 'Alguém foi mais rápido!', 'stale');

  const amount = cutoff + (increment as number);
  if (amount > player.budget) return err('Saldo insuficiente para esse lance.', 'budget');

  room.bids.set(playerId, { amount, at: now, seq: ++room.bidSeq });
  room.bidFeed = [{ name: player.name, amount, at: now }, ...room.bidFeed].slice(0, 5);
  if (room.endsAt - now < EXTEND_MS) {
    room.endsAt = Math.max(room.endsAt, Math.min(now + EXTEND_MS, room.hardCapAt));
  }
  room.lastActivity = now;
  return { ok: true, amount };
}

function closeLot(room: Room, now: number, skipped = false) {
  const winners: WinnerResult[] = skipped
    ? []
    : winningBids(room).map((w) => ({ playerId: w.playerId, name: w.name, price: w.amount, reorganized: false }));
  for (const w of winners) room.players.get(w.playerId)!.budget -= w.price;
  room.results[room.lotIndex] = { lotIndex: room.lotIndex, winners, skipped };
  room.phase = 'sold';
  room.paused = false;
  room.endsAt = now + SOLD_MS;
}

/** Sai do "Vendido!": proposta secreta da gaveta, próximo lote ou revelação. */
function afterSold(room: Room, now: number) {
  const cost = room.lots[room.lotIndex].secret.reorgCost;
  const res = room.results[room.lotIndex];
  if (cost && res) {
    const eligible = res.winners.filter((w) => (room.players.get(w.playerId)?.budget ?? 0) >= cost).map((w) => w.playerId);
    if (eligible.length) {
      room.phase = 'offer';
      room.offerPending = new Set(eligible);
      room.offerEligible = new Set(eligible);
      room.endsAt = now + OFFER_MS;
      room.paused = false;
      return;
    }
  }
  advanceLot(room, now);
}

function advanceLot(room: Room, now: number) {
  room.offerPending = new Set();
  if (room.lotIndex + 1 < room.lots.length) {
    openLot(room, room.lotIndex + 1, now);
  } else {
    room.phase = 'reveal';
    room.revealIndex = 0;
    room.paused = false;
  }
}

export function answerOffer(room: Room, playerId: string, accept: unknown, now = Date.now()): Ack {
  if (room.phase !== 'offer') return err('A proposta expirou.', 'closed');
  if (!room.offerPending.has(playerId)) return err('Essa proposta não é sua.', 'forbidden');
  const cost = room.lots[room.lotIndex].secret.reorgCost ?? 0;
  const player = room.players.get(playerId);
  const win = room.results[room.lotIndex].winners.find((w) => w.playerId === playerId);
  if (accept === true && player && win && player.budget >= cost) {
    player.budget -= cost;
    win.reorganized = true;
  }
  room.offerPending.delete(playerId);
  room.lastActivity = now;
  if (room.offerPending.size === 0) advanceLot(room, now);
  return { ok: true };
}

// --------------------------------------------------------------------- tempo

/** Próximo instante em que `tick` precisa rodar, ou null se nada está correndo. */
export function nextDeadline(room: Room): number | null {
  if (room.paused) return null;
  if (room.phase === 'bidding' || room.phase === 'sold' || room.phase === 'offer') return room.endsAt;
  return null;
}

/** Avança a fase se o prazo venceu. Devolve true se algo mudou. */
export function tick(room: Room, now = Date.now()): boolean {
  const deadline = nextDeadline(room);
  if (deadline === null || now < deadline) return false;
  if (room.phase === 'bidding') closeLot(room, now);
  else if (room.phase === 'sold') afterSold(room, now);
  else if (room.phase === 'offer') advanceLot(room, now); // sem resposta = não
  return true;
}

// ---------------------------------------------------------------- comandos

function startAuction(room: Room, now: number) {
  room.units = unitsFor(room.players.size, room.lots.length);
  openLot(room, 0, now);
}

export function hostCommand(room: Room, action: HostAction, now = Date.now(), arg?: unknown): Ack {
  room.lastActivity = now;
  const timed = room.phase === 'bidding' || room.phase === 'sold' || room.phase === 'offer';
  switch (action) {
    case 'next':
      switch (room.phase) {
        case 'lobby':
          room.phase = 'intro';
          room.introStep = 0;
          return { ok: true };
        case 'intro':
          if (room.introStep + 1 < INTRO_STEPS) room.introStep++;
          else startAuction(room, now);
          return { ok: true };
        case 'sold':
          afterSold(room, now);
          return { ok: true };
        case 'reveal':
          if (room.revealIndex < room.lots.length) room.revealIndex++;
          else room.phase = 'podium';
          return { ok: true };
        case 'bidding':
          return err('Os lances fecham sozinhos. Use "Pular lote" para encerrar.', 'phase');
        default:
          return err('Nada para avançar agora.', 'phase');
      }
    case 'back':
      if (room.phase === 'intro') {
        if (room.introStep > 0) room.introStep--;
        else room.phase = 'lobby';
        return { ok: true };
      }
      if (room.phase === 'reveal' && room.revealIndex > 0) {
        room.revealIndex--;
        return { ok: true };
      }
      return err('Nada para voltar agora.', 'phase');
    case 'togglePause':
      return hostCommand(room, room.paused ? 'resume' : 'pause', now);
    case 'pause':
      if (!timed || room.paused) return err('Nada para pausar.', 'phase');
      room.paused = true;
      room.remainingMs = Math.max(0, room.endsAt - now);
      room.hardCapRemainingMs = Math.max(0, room.hardCapAt - now);
      return { ok: true };
    case 'resume':
      if (!room.paused) return err('O relógio não está pausado.', 'phase');
      room.paused = false;
      room.endsAt = now + room.remainingMs;
      room.hardCapAt = now + room.hardCapRemainingMs;
      return { ok: true };
    case 'addTime':
      if (room.phase !== 'bidding') return err('Só dá para dar mais tempo durante os lances.', 'phase');
      if (room.paused) {
        room.remainingMs += ADD_TIME_MS;
        room.hardCapRemainingMs = Math.max(room.hardCapRemainingMs, room.remainingMs);
      } else {
        room.endsAt += ADD_TIME_MS;
        room.hardCapAt = Math.max(room.hardCapAt, room.endsAt);
      }
      return { ok: true };
    case 'skip':
      if (room.phase !== 'bidding') return err('Só dá para pular durante os lances.', 'phase');
      closeLot(room, now, true);
      return { ok: true };
    case 'lock':
      room.locked = !room.locked;
      return { ok: true };
    case 'kick': {
      const id = String(arg ?? '');
      if (!room.players.has(id)) return err('Jogador não encontrado.', 'player');
      if (room.phase === 'bidding' && winningBids(room).some((w) => w.playerId === id))
        return err('Esse jogador está levando uma unidade. Espere o lote fechar.', 'leader');
      room.bids.delete(id);
      room.players.delete(id);
      if (room.phase === 'offer' && room.offerPending.delete(id) && room.offerPending.size === 0) advanceLot(room, now);
      return { ok: true };
    }
    case 'restart':
      for (const p of room.players.values()) {
        p.budget = START_BUDGET;
        p.bidTimes = [];
      }
      Object.assign(room, {
        phase: 'lobby',
        introStep: 0,
        units: 0,
        lotIndex: 0,
        bids: new Map(),
        endsAt: 0,
        hardCapAt: 0,
        paused: false,
        bidFeed: [],
        results: [],
        revealIndex: 0,
        offerPending: new Set(),
        offerEligible: new Set(),
      } satisfies Partial<Room>);
      return { ok: true };
    default:
      return err('Comando desconhecido.', 'invalid');
  }
}

// ---------------------------------------------------------------- pontuação

export function pointsFor(lot: LotDef, w: WinnerResult): number {
  return w.reorganized ? (lot.secret.reorgPoints ?? lot.secret.points) : lot.secret.points;
}

function spentOn(lot: LotDef, w: WinnerResult): number {
  return w.price + (w.reorganized ? (lot.secret.reorgCost ?? 0) : 0);
}

/** Ranking considerando só as primeiras `revealed` cartas (todas, por padrão). */
export function computeStandings(room: Room, revealed = room.lots.length): Standing[] {
  const rows = new Map<string, Standing>();
  for (const p of room.players.values()) {
    rows.set(p.id, { playerId: p.id, name: p.name, points: 0, budget: p.budget, spent: 0, rank: 0 });
  }
  room.results.forEach((res, i) => {
    for (const w of res?.winners ?? []) {
      const row = rows.get(w.playerId);
      if (!row) continue;
      row.spent += spentOn(room.lots[i], w);
      if (i < revealed) row.points += pointsFor(room.lots[i], w);
    }
  });
  const list = [...rows.values()];
  list.sort((a, b) => b.points - a.points || b.budget - a.budget || a.name.localeCompare(b.name, 'pt-BR'));
  list.forEach((r, i) => {
    const prev = list[i - 1];
    r.rank = prev && prev.points === r.points && prev.budget === r.budget ? prev.rank : i + 1;
  });
  return list;
}

export function computeAwards(room: Room): Awards {
  let bestDeal: Awards['bestDeal'] = null;
  for (const s of computeStandings(room)) {
    if (s.points < 1 || s.spent <= 0) continue;
    const ratio = s.points / s.spent;
    if (!bestDeal || ratio > bestDeal.ratio || (ratio === bestDeal.ratio && s.points > bestDeal.points))
      bestDeal = { playerId: s.playerId, name: s.name, points: s.points, spent: s.spent, ratio };
  }
  const flop = new Map<string, number>();
  room.results.forEach((res, i) => {
    for (const w of res?.winners ?? []) {
      if (room.players.has(w.playerId) && pointsFor(room.lots[i], w) <= 0)
        flop.set(w.playerId, (flop.get(w.playerId) ?? 0) + spentOn(room.lots[i], w));
    }
  });
  let biggestFlop: Awards['biggestFlop'] = null;
  for (const [id, spent] of flop) {
    if (spent > 0 && (!biggestFlop || spent > biggestFlop.spent)) biggestFlop = { playerId: id, name: room.players.get(id)!.name, spent };
  }
  return { bestDeal, biggestFlop };
}

// ----------------------------------------------------------- estado público

function publicResult(room: Room, res: LotResult): PublicResult {
  return {
    lotIndex: res.lotIndex,
    lot: toPublic(room.lots[res.lotIndex]),
    winners: res.winners.map(({ playerId, name, price }) => ({ playerId, name, price })),
    skipped: res.skipped,
  };
}

function revealedCount(room: Room): number {
  if (room.phase === 'podium') return room.lots.length;
  if (room.phase === 'reveal') return room.revealIndex;
  return 0;
}

export function publicState(room: Room, now = Date.now()): RoomState {
  const showLot = room.phase === 'bidding' || room.phase === 'sold' || room.phase === 'offer';
  const nRevealed = revealedCount(room);
  const revealed: RevealedCard[] = [];
  for (let i = 0; i < nRevealed; i++) {
    const res = room.results[i];
    if (!res) continue;
    const lot = room.lots[i];
    revealed.push({
      lotIndex: i,
      lot: toPublic(lot),
      skipped: res.skipped,
      secret: { ...lot.secret },
      winners: res.winners.map((w) => ({ ...w, points: pointsFor(lot, w) })),
    });
  }
  const winning = room.phase === 'bidding' ? winningBids(room) : [];
  const afterAuction = room.phase === 'reveal' || room.phase === 'podium';
  return {
    code: room.code,
    phase: room.phase,
    locked: room.locked,
    introStep: room.introStep,
    lotCount: room.lots.length,
    units: currentUnits(room),
    lotIndex: room.lotIndex,
    lot: showLot ? toPublic(room.lots[room.lotIndex]) : null,
    winning,
    cutoff: room.phase === 'bidding' ? cutoffOf(room, winning) : 0,
    endsAt: room.endsAt,
    serverNow: now,
    paused: room.paused,
    remainingMs: room.paused ? room.remainingMs : Math.max(0, room.endsAt - now),
    bidFeed: room.bidFeed,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
    results: room.results.filter(Boolean).map((r) => publicResult(room, r)),
    offerCount: room.phase === 'offer' ? room.offerEligible.size : 0,
    revealIndex: nRevealed,
    revealed,
    standings: afterAuction ? computeStandings(room, nRevealed) : null,
    awards: room.phase === 'podium' ? computeAwards(room) : null,
  };
}

export function privateState(room: Room, player: Player): PrivateState {
  const nRevealed = revealedCount(room);
  let points = 0;
  let spent = 0;
  const myLots: PrivateState['myLots'] = [];
  room.results.forEach((res, i) => {
    const w = res?.winners.find((x) => x.playerId === player.id);
    if (!w) return;
    const lot = room.lots[i];
    spent += spentOn(lot, w);
    const base = { lotIndex: i, lot: toPublic(lot), price: w.price, reorganized: w.reorganized };
    if (i >= nRevealed) return void myLots.push(base);
    const pts = pointsFor(lot, w);
    points += pts;
    myLots.push({ ...base, secret: { ...lot.secret }, points: pts });
  });

  // Quem não teve saldo para a proposta nem fica sabendo que ela existe.
  const offer: PrivateState['offer'] =
    room.phase === 'offer' && room.offerEligible.has(player.id)
      ? { endsAt: room.endsAt, cost: room.lots[room.lotIndex].secret.reorgCost ?? 0, answered: !room.offerPending.has(player.id) }
      : null;

  const final = room.phase === 'podium' ? computeStandings(room).find((s) => s.playerId === player.id) : undefined;
  return {
    playerId: player.id,
    name: player.name,
    budget: player.budget,
    spent,
    myLots,
    offer,
    points,
    finalRank: final?.rank ?? null,
    totalPlayers: room.players.size,
  };
}

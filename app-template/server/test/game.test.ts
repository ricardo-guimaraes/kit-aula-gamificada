import { describe, expect, it } from 'vitest';
import { INTRO_STEPS, unitsFor } from '../../shared/types.ts';
import {
  BID_MS,
  HARD_CAP_MS,
  OFFER_MS,
  SOLD_MS,
  answerOffer,
  computeAwards,
  computeStandings,
  createRoom,
  cutoffOf,
  hostCommand,
  joinPlayer,
  placeBid,
  privateState,
  publicState,
  tick,
  winningBids,
  type Room,
} from '../src/game.ts';
import { isProfane } from '../src/words.ts';

const T0 = 1_000_000;

/** Cria sala com jogadores e abre o lote 1. `units` força o nº de unidades por lote. */
function setup(names = ['Ana', 'Bia', 'Caio'], units = 1, short = false) {
  const room = createRoom('BCDF', { short }, T0);
  const ids = names.map((name) => {
    const r = joinPlayer(room, { name }, T0);
    if (!r.ok) throw new Error(r.error);
    return r.player.id;
  });
  hostCommand(room, 'next', T0); // lobby -> intro
  for (let i = 0; i < INTRO_STEPS; i++) hostCommand(room, 'next', T0); // intro -> lote 1
  room.units = units;
  return { room, ids };
}

/** Fecha o lote atual e passa pelo "Vendido!" (e pela proposta, se houver). */
function finishLot(room: Room, now: number): number {
  let t = Math.max(now, room.endsAt);
  tick(room, t);
  t += SOLD_MS;
  tick(room, t);
  if (room.phase === 'offer') {
    t += OFFER_MS;
    tick(room, t);
  }
  return t;
}

/** Joga lote a lote: `plan[i]` = lista de [jogador, valor do lance] (um lance de +5 por item). */
function playAll(room: Room, ids: string[], plan: [number, number][][], accept = false) {
  let now = T0;
  for (const bids of plan) {
    for (const [who, amount] of bids) {
      room.bids.set(ids[who], { amount, at: now, seq: ++room.bidSeq });
    }
    tick(room, room.endsAt);
    now = room.endsAt;
    if (room.phase === 'sold') {
      now += SOLD_MS;
      tick(room, now);
    }
    if (room.phase === 'offer') for (const id of [...room.offerPending]) answerOffer(room, id, accept, now);
  }
  return now;
}

describe('unidades por lote', () => {
  it('cresce com a turma: ~80% dos jogadores compram algo', () => {
    expect(unitsFor(1, 10)).toBe(1);
    expect(unitsFor(12, 10)).toBe(1);
    expect(unitsFor(20, 10)).toBe(2);
    expect(unitsFor(30, 10)).toBe(2);
    expect(unitsFor(50, 10)).toBe(4);
    expect(unitsFor(50, 8)).toBe(5);
    expect(unitsFor(150, 10)).toBe(6); // teto
  });

  it('fica fixo quando o leilão começa, mesmo com gente entrando depois', () => {
    const room = createRoom('BCDF', {}, T0);
    for (let i = 0; i < 50; i++) joinPlayer(room, { name: `P${i}` }, T0);
    expect(publicState(room).units).toBe(4);
    hostCommand(room, 'next', T0);
    for (let i = 0; i < INTRO_STEPS; i++) hostCommand(room, 'next', T0);
    expect(room.phase).toBe('bidding');
    expect(room.units).toBe(4);
    for (let i = 0; i < 30; i++) joinPlayer(room, { name: `Q${i}` }, T0);
    expect(publicState(room).units).toBe(4);
  });
});

describe('entrada', () => {
  it('cria jogador com R$ 100 mi e reconecta pelo token', () => {
    const room = createRoom('BCDF');
    const a = joinPlayer(room, { name: 'Ana' });
    expect(a.ok && a.player.budget).toBe(100);
    const again = joinPlayer(room, { name: 'qualquer', token: a.ok ? a.player.token : '' });
    expect(again.ok && again.reconnected).toBe(true);
    expect(room.players.size).toBe(1);
  });

  it('recusa nome repetido e sugere "Ana 2"', () => {
    const room = createRoom('BCDF');
    joinPlayer(room, { name: 'Ana' });
    const r = joinPlayer(room, { name: 'ána ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.suggestion).toBe('ána 2');
  });

  it('recusa nome longo, vazio, impróprio e sala trancada', () => {
    const room = createRoom('BCDF');
    expect(joinPlayer(room, { name: 'x'.repeat(17) }).ok).toBe(false);
    expect(joinPlayer(room, { name: '   ' }).ok).toBe(false);
    expect(joinPlayer(room, { name: 'P0rra' }).ok).toBe(false);
    hostCommand(room, 'lock');
    expect(joinPlayer(room, { name: 'Ana' }).ok).toBe(false);
  });

  it('filtro de palavrões não pega nomes comuns', () => {
    for (const ok of ['Rolando', 'Carolina', 'Computação', 'Pinto', 'Cunha', 'Grupo 3', 'Ana Paula']) expect(isProfane(ok)).toBe(false);
    for (const bad of ['caralho', 'vai tnc', 'cu', 'f.d.p']) expect(isProfane(bad)).toBe(true);
  });

  it('aluno entra no meio do leilão com R$ 100 mi', () => {
    const { room } = setup();
    const late = joinPlayer(room, { name: 'Davi' }, T0 + 1000);
    expect(late.ok && late.player.budget).toBe(100);
  });
});

describe('introdução', () => {
  it('passa pelas etapas do case e volta com "back"', () => {
    const room = createRoom('BCDF');
    hostCommand(room, 'next');
    expect(room.phase).toBe('intro');
    hostCommand(room, 'next');
    expect(room.introStep).toBe(1);
    hostCommand(room, 'back');
    hostCommand(room, 'back');
    expect(room.phase).toBe('lobby');
  });
});

describe('lances com 1 unidade', () => {
  it('primeiro lance é o incremento; os seguintes somam ao menor lance vencedor', () => {
    const { room, ids } = setup();
    expect(placeBid(room, ids[0], 5, 0, T0 + 100)).toMatchObject({ ok: true, amount: 5 });
    expect(placeBid(room, ids[1], 20, 5, T0 + 200)).toMatchObject({ ok: true, amount: 25 });
    expect(winningBids(room)).toEqual([{ playerId: ids[1], name: 'Bia', amount: 25 }]);
    expect(room.bidFeed[0]).toMatchObject({ name: 'Bia', amount: 25 });
  });

  it('recusa lance acima do saldo, incremento inválido e lance de quem já está levando', () => {
    const { room, ids } = setup();
    room.bids.set(ids[2], { amount: 90, at: T0, seq: 1 });
    expect(placeBid(room, ids[0], 20, 90, T0)).toMatchObject({ ok: false, code: 'budget' });
    expect(placeBid(room, ids[0], 7, 90, T0)).toMatchObject({ ok: false, code: 'invalid' });
    expect(placeBid(room, ids[0], 10, 90, T0).ok).toBe(true);
    expect(placeBid(room, ids[0], 5, 100, T0)).toMatchObject({ ok: false, code: 'leader' });
  });

  it('lance simultâneo: o segundo recebe "Alguém foi mais rápido"', () => {
    const { room, ids } = setup();
    expect(placeBid(room, ids[0], 5, 0, T0).ok).toBe(true);
    expect(placeBid(room, ids[1], 5, 0, T0)).toMatchObject({ ok: false, code: 'stale' });
    expect(cutoffOf(room)).toBe(5);
  });

  it('recusa lance fora da fase, depois do relógio e com o relógio pausado', () => {
    const room = createRoom('BCDF');
    const a = joinPlayer(room, { name: 'Ana' });
    const id = a.ok ? a.player.id : '';
    expect(placeBid(room, id, 5, 0, T0)).toMatchObject({ ok: false, code: 'closed' });
    hostCommand(room, 'next', T0);
    for (let i = 0; i < INTRO_STEPS; i++) hostCommand(room, 'next', T0);
    expect(placeBid(room, id, 5, 0, T0 + BID_MS)).toMatchObject({ ok: false, code: 'closed' });
    hostCommand(room, 'pause', T0 + 1000);
    expect(placeBid(room, id, 5, 0, T0 + 1000)).toMatchObject({ ok: false, code: 'paused' });
  });

  it('limita a 5 lances por segundo por jogador', () => {
    const { room, ids } = setup();
    for (let i = 0; i < 5; i++) placeBid(room, ids[0], 5, undefined, T0 + i);
    expect(placeBid(room, ids[0], 5, undefined, T0 + 10)).toMatchObject({ ok: false, code: 'rate' });
    expect(placeBid(room, ids[0], 5, undefined, T0 + 1500)).toMatchObject({ ok: false, code: 'leader' });
  });
});

describe('lances com várias unidades', () => {
  it('os N maiores lances levam; enquanto há vaga, o lance parte do zero', () => {
    const { room, ids } = setup(['Ana', 'Bia', 'Caio', 'Davi'], 3);
    expect(placeBid(room, ids[0], 5, 0, T0)).toMatchObject({ ok: true, amount: 5 });
    expect(placeBid(room, ids[1], 10, 0, T0)).toMatchObject({ ok: true, amount: 10 });
    expect(cutoffOf(room)).toBe(0); // ainda sobra 1 unidade
    expect(placeBid(room, ids[2], 5, 0, T0)).toMatchObject({ ok: true, amount: 5 });
    // agora as 3 unidades têm lance; o menor vencedor é 5 (Ana, que deu antes)
    expect(cutoffOf(room)).toBe(5);
    expect(winningBids(room).map((w) => w.name)).toEqual(['Bia', 'Ana', 'Caio']);
    // Davi entra com 5 + 10 = 15 e empurra Caio (5, deu depois de Ana) para fora
    expect(placeBid(room, ids[3], 10, 5, T0)).toMatchObject({ ok: true, amount: 15 });
    expect(winningBids(room).map((w) => w.name)).toEqual(['Davi', 'Bia', 'Ana']);
    // Caio, fora, pode dar lance de novo a partir do novo corte (5)
    expect(placeBid(room, ids[2], 5, 5, T0)).toMatchObject({ ok: true, amount: 10 });
    expect(winningBids(room).map((w) => w.name)).toEqual(['Davi', 'Bia', 'Caio']);
  });

  it('cada vencedor paga o próprio lance', () => {
    const { room, ids } = setup(['Ana', 'Bia', 'Caio'], 2);
    placeBid(room, ids[0], 20, 0, T0);
    placeBid(room, ids[1], 5, 0, T0);
    placeBid(room, ids[2], 5, 5, T0); // 10: tira Bia
    tick(room, room.endsAt);
    expect(room.results[0].winners.map((w) => [w.name, w.price])).toEqual([
      ['Ana', 20],
      ['Caio', 10],
    ]);
    expect(room.players.get(ids[0])!.budget).toBe(80);
    expect(room.players.get(ids[1])!.budget).toBe(100);
    expect(room.players.get(ids[2])!.budget).toBe(90);
  });
});

describe('relógio', () => {
  it('lance nos últimos 5 s volta o relógio para 5 s', () => {
    const { room, ids } = setup();
    placeBid(room, ids[0], 5, 0, T0 + 12_000);
    expect(room.endsAt).toBe(T0 + 17_000);
    placeBid(room, ids[1], 5, 5, T0 + 8_000);
    expect(room.endsAt).toBe(T0 + 17_000);
  });

  it('respeita o teto de 30 s desde a abertura', () => {
    const { room, ids } = setup();
    let t = T0;
    let who = 0;
    while (t < T0 + HARD_CAP_MS - 1000) {
      t = room.endsAt - 1000;
      placeBid(room, ids[who], 5, undefined, t);
      who = 1 - who;
    }
    expect(room.endsAt).toBeLessThanOrEqual(T0 + HARD_CAP_MS);
    expect(tick(room, T0 + HARD_CAP_MS)).toBe(true);
    expect(room.phase).toBe('sold');
  });

  it('pausa congela o tempo e "+" dá mais 10 s', () => {
    const { room } = setup();
    hostCommand(room, 'pause', T0 + 5_000);
    expect(tick(room, T0 + 60_000)).toBe(false);
    hostCommand(room, 'resume', T0 + 60_000);
    expect(room.endsAt).toBe(T0 + 70_000);
    hostCommand(room, 'addTime', T0 + 60_000);
    expect(room.endsAt).toBe(T0 + 80_000);
  });
});

describe('fechamento', () => {
  it('com lance: desconta o preço e abre o próximo lote depois de 6 s', () => {
    const { room, ids } = setup();
    placeBid(room, ids[0], 20, 0, T0 + 100);
    tick(room, T0 + BID_MS);
    expect(room.phase).toBe('sold');
    expect(room.players.get(ids[0])!.budget).toBe(80);
    tick(room, T0 + BID_MS + SOLD_MS);
    expect(room.phase).toBe('bidding');
    expect(room.lotIndex).toBe(1);
  });

  it('sem lance: encalha', () => {
    const { room } = setup();
    tick(room, T0 + BID_MS);
    expect(room.results[0].winners).toHaveLength(0);
    expect(publicState(room).results[0].winners).toEqual([]);
  });

  it('pular lote encerra sem vencedor', () => {
    const { room, ids } = setup();
    placeBid(room, ids[0], 5, 0, T0);
    hostCommand(room, 'skip', T0 + 1000);
    expect(room.results[0]).toMatchObject({ winners: [], skipped: true });
    expect(room.players.get(ids[0])!.budget).toBe(100);
  });

  it('segredos não aparecem no estado antes da revelação', () => {
    const { room, ids } = setup();
    placeBid(room, ids[0], 5, 0, T0);
    const json = JSON.stringify(publicState(room)) + JSON.stringify(privateState(room, room.players.get(ids[0])!));
    expect(json).not.toContain('Sustentável');
    expect(json).not.toContain('revealText');
  });
});

describe('lote 9: a gaveta', () => {
  function toDrawer(room: Room) {
    let now = T0;
    while (room.lots[room.lotIndex].secret.reorgCost === undefined) now = finishLot(room, now);
    return now;
  }

  it('todos os vencedores com saldo recebem a proposta; aceitar custa 20 e vale 3', () => {
    const { room, ids } = setup(['Ana', 'Bia', 'Caio'], 2);
    const now = toDrawer(room);
    expect(room.lotIndex).toBe(8);
    placeBid(room, ids[0], 10, 0, now);
    placeBid(room, ids[1], 5, 0, now);
    tick(room, room.endsAt);
    tick(room, room.endsAt);
    expect(room.phase).toBe('offer');
    expect(privateState(room, room.players.get(ids[0])!).offer).toMatchObject({ cost: 20, answered: false });
    expect(privateState(room, room.players.get(ids[2])!).offer).toBeNull();
    expect(answerOffer(room, ids[2], true).ok).toBe(false);

    expect(answerOffer(room, ids[0], true, now).ok).toBe(true);
    expect(room.phase).toBe('offer'); // Bia ainda não respondeu
    expect(privateState(room, room.players.get(ids[0])!).offer).toMatchObject({ answered: true });
    expect(answerOffer(room, ids[1], false, now).ok).toBe(true);
    expect(room.phase).toBe('bidding');
    expect(room.lotIndex).toBe(9);
    expect(room.players.get(ids[0])!.budget).toBe(70);
    expect(room.players.get(ids[1])!.budget).toBe(95);
    expect(room.results[8].winners.map((w) => w.reorganized)).toEqual([true, false]);
  });

  it('sem resposta em 10 s conta como não', () => {
    const { room, ids } = setup();
    const now = toDrawer(room);
    placeBid(room, ids[0], 10, 0, now);
    tick(room, room.endsAt);
    tick(room, room.endsAt);
    expect(room.phase).toBe('offer');
    tick(room, room.endsAt);
    expect(room.results[8].winners[0].reorganized).toBe(false);
    expect(room.players.get(ids[0])!.budget).toBe(90);
    expect(room.phase).toBe('bidding');
  });

  it('sem saldo para a reorganização, a proposta nem aparece', () => {
    const { room, ids } = setup();
    const now = toDrawer(room);
    room.players.get(ids[0])!.budget = 25;
    placeBid(room, ids[0], 10, 0, now);
    tick(room, room.endsAt);
    tick(room, room.endsAt);
    expect(room.phase).toBe('bidding');
  });
});

describe('pontuação e prêmios', () => {
  // Lotes: 1 S3, 2 P0, 3 T1, 4 P0, 5 S3, 6 T1, 7 S3, 8 P0, 9 gaveta, 10 D-2
  it('soma pontos de vários vencedores, considera a reorganização e desempata por saldo', () => {
    const { room, ids } = setup(['Ana', 'Bia', 'Caio'], 2);
    playAll(
      room,
      ids,
      [
        [[0, 30], [1, 10]], // dados (3): Ana 30, Bia 10
        [[1, 40]], // CDN (0): Bia -> mico
        [[2, 10]], // série (1): Caio
        [],
        [[1, 20]], // comunidade (3): Bia
        [],
        [[2, 15]], // estúdio (3): Caio
        [],
        [[0, 10]], // gaveta + reorganização (3): Ana
        [[2, 50]], // locadoras (-2): Caio -> mico
      ],
      true,
    );
    expect(room.phase).toBe('reveal');
    const s = computeStandings(room);
    const byName = Object.fromEntries(s.map((r) => [r.name, r]));
    expect(byName.Ana).toMatchObject({ points: 6, budget: 40, spent: 60 });
    expect(byName.Bia).toMatchObject({ points: 6, budget: 30, spent: 70 });
    expect(byName.Caio).toMatchObject({ points: 2, budget: 25, spent: 75 });
    expect(s.map((r) => r.name)).toEqual(['Ana', 'Bia', 'Caio']); // Ana e Bia empatam em pontos: saldo decide

    const awards = computeAwards(room);
    expect(awards.bestDeal?.name).toBe('Ana'); // 6/60
    expect(awards.biggestFlop).toMatchObject({ name: 'Caio', spent: 50 });
  });

  it('ranking da revelação só conta as cartas já viradas', () => {
    const { room, ids } = setup();
    playAll(room, ids, [[[0, 5]], [[1, 5]], [[2, 5]], [], [], [], [], [], [], []]);
    expect(room.phase).toBe('reveal');
    expect(publicState(room).standings!.every((s) => s.points === 0)).toBe(true);
    hostCommand(room, 'next');
    const st = publicState(room);
    expect(st.revealed).toHaveLength(1);
    expect(st.revealed[0].winners[0]).toMatchObject({ name: 'Ana', points: 3 });
    expect(st.standings![0]).toMatchObject({ name: 'Ana', points: 3 });
    for (let i = 0; i < 10; i++) hostCommand(room, 'next');
    expect(room.phase).toBe('podium');
    expect(publicState(room).awards).not.toBeNull();
  });

  it('sem pontos ninguém leva "Melhor negócio"; sem gasto em mico, ninguém leva "Maior mico"', () => {
    const { room } = setup();
    playAll(room, [], Array.from({ length: 10 }, () => []));
    const a = computeAwards(room);
    expect(a.bestDeal).toBeNull();
    expect(a.biggestFlop).toBeNull();
  });
});

describe('host', () => {
  it('versão curta tem 8 lotes, sem a retrospectiva e o pacote de filmes', () => {
    const room = createRoom('BCDF', { short: true });
    expect(room.lots.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 7, 9, 10]);
  });

  it('reiniciar mantém jogadores e zera saldo, resultados e unidades', () => {
    const { room, ids } = setup();
    placeBid(room, ids[0], 20, 0, T0);
    tick(room, T0 + BID_MS);
    hostCommand(room, 'restart');
    expect(room.phase).toBe('lobby');
    expect(room.results).toHaveLength(0);
    expect(room.units).toBe(0);
    expect(room.players.size).toBe(3);
    expect(room.players.get(ids[0])!.budget).toBe(100);
  });

  it('não remove quem está levando uma unidade', () => {
    const { room, ids } = setup();
    placeBid(room, ids[0], 5, 0, T0);
    expect(hostCommand(room, 'kick', T0, ids[0]).ok).toBe(false);
    expect(hostCommand(room, 'kick', T0, ids[1]).ok).toBe(true);
    expect(room.players.size).toBe(2);
  });
});

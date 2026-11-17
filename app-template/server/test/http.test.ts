import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/http.ts';
import { clearMission, normKey, submitText, viewOf } from '../src/missions.ts';

const ADMIN = 'chave-de-teste';
let base = '';
let close: () => Promise<void>;

beforeAll(async () => {
  const { httpServer, io } = buildServer({ deckPath: '/aula-k7x2', adminKey: ADMIN });
  await new Promise<void>((r) => httpServer.listen(0, r));
  base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  close = () => new Promise((r) => io.close(() => r()));
});
afterAll(() => close());

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('missão: normalização e agrupamento', () => {
  it('agrupa sem diferenciar maiúsculas, acentos e espaços', () => {
    expect(normKey('  Nubánk ')).toBe('nubank');
    clearMission('1');
    submitText('1', 'tokenAAAA1', 'Nubank', 0);
    submitText('1', 'tokenBBBB1', 'nubank', 0);
    submitText('1', 'tokenCCCC1', 'NUBÁNK', 0);
    submitText('1', 'tokenDDDD1', 'Apple', 0);
    const v = viewOf('1')!;
    // três grafias empatadas com 1 cada: vale a que chegou primeiro
    expect('words' in v && v.words).toEqual([
      { text: 'Nubank', count: 3 },
      { text: 'Apple', count: 1 },
    ]);
    expect(v.total).toBe(4);
  });

  it('exibe a grafia mais frequente do grupo', () => {
    clearMission('1');
    submitText('1', 'tokenAAAA2', 'nubank', 0);
    submitText('1', 'tokenBBBB2', 'Nubank', 0);
    submitText('1', 'tokenCCCC2', 'Nubank', 0);
    const v = viewOf('1')!;
    expect('words' in v && v.words[0]).toEqual({ text: 'Nubank', count: 3 });
  });
});

describe('missão: limites por token', () => {
  it('no máximo 3 respostas por token e 1 a cada 3 s', () => {
    clearMission('1');
    expect(submitText('1', 'tokenLIMIT', 'Apple', 0)).toMatchObject({ ok: true, remaining: 2 });
    expect(submitText('1', 'tokenLIMIT', 'Disney', 1000)).toMatchObject({ ok: false, code: 'rate' });
    expect(submitText('1', 'tokenLIMIT', 'Disney', 3000)).toMatchObject({ ok: true, remaining: 1 });
    expect(submitText('1', 'tokenLIMIT', 'Nike', 6000)).toMatchObject({ ok: true, remaining: 0 });
    expect(submitText('1', 'tokenLIMIT', 'Lego', 9000)).toMatchObject({ ok: false, code: 'limit' });
  });

  it('valida tamanho, token e palavrão', () => {
    expect(submitText('1', 'tokenVALID', 'A', 0)).toMatchObject({ ok: false, code: 'short' });
    expect(submitText('1', 'tokenVALID', 'x'.repeat(25), 0)).toMatchObject({ ok: false, code: 'long' });
    expect(submitText('1', 'curto', 'Apple', 0)).toMatchObject({ ok: false, code: 'token' });
    expect(submitText('1', 'tokenVALID', 'porra', 0)).toMatchObject({ ok: false, code: 'profane' });
  });
});

describe('rotas HTTP', () => {
  it('GET /api/missao/1 devolve { question, total, words } com CORS e sem cache', async () => {
    clearMission('1');
    const sent = await post('/api/missao/1', { token: 'tokenHTTP01', text: 'Lego' });
    expect(sent.status).toBe(200);
    const r = await fetch(base + '/api/missao/1');
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(r.headers.get('cache-control')).toBe('no-store');
    const body = await r.json();
    expect(Object.keys(body).sort()).toEqual(['question', 'total', 'words']);
    expect(body).toEqual({ question: 'Qual marca você usa e acha impossível de copiar?', total: 1, words: [{ text: 'Lego', count: 1 }] });
  });

  it('missão de votação conta votos por item e permite trocar o voto', async () => {
    clearMission('2');
    await post('/api/missao/2', { token: 'tokenVOTE01', item: 1, option: 0 });
    await new Promise((r) => setTimeout(r, 350));
    await post('/api/missao/2', { token: 'tokenVOTE01', item: 1, option: 1 });
    const body = await (await fetch(base + '/api/missao/2?token=tokenVOTE01')).json();
    expect(body.kind).toBe('votacao');
    expect(body.total).toBe(1);
    expect(body.items[1].options.map((o: { count: number }) => o.count)).toEqual([0, 1]);
    expect(body.mine.votes).toEqual([null, 1, null, null]);
  });

  it('zerar e ocultar exigem a chave do professor', async () => {
    clearMission('1');
    await post('/api/missao/1', { token: 'tokenHIDE01', text: 'Palavra feia' });
    expect((await post('/api/missao/1/ocultar?k=errada', { text: 'palavra feia' })).status).toBe(403);
    expect((await post(`/api/missao/1/ocultar?k=${ADMIN}`, { text: 'PALAVRA FEIA' })).status).toBe(200);
    expect((await (await fetch(base + '/api/missao/1')).json()).words).toEqual([]);
    expect((await post(`/api/missao/1/limpar?k=${ADMIN}`, {})).status).toBe(200);
    expect((await fetch(base + '/api/missao/99')).status).toBe(404);
  });

  it('DECK_PATH devolve o HTML do deck com 200, sem CSP e com no-cache', async () => {
    const r = await fetch(base + '/aula-k7x2', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(r.headers.get('content-security-policy')).toBeNull();
    expect(r.headers.get('cache-control')).toBe('no-cache');
    expect(r.headers.get('content-encoding')).toMatch(/gzip|br/);
    const html = await r.text();
    expect(html).toContain('<section class="slide');
    expect(html).toContain('cdnjs.cloudflare.com/ajax/libs/qrcodejs');
  });

  it('sem a chave, ninguém cria sala; a raiz informa a sala atual', async () => {
    const admin = await (await fetch(base + '/api/admin?k=errada')).json();
    expect(admin).toEqual({ required: true, valid: false });
    const sala = await (await fetch(base + '/api/sala-atual')).json();
    expect(sala).toHaveProperty('code');
  });
});

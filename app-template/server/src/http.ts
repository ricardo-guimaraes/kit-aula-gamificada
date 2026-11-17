// Monta o app: jogo (Socket.IO), apresentação da aula (DECK_PATH) e modo Missão.
// Separado de index.ts para os testes subirem o servidor numa porta livre.
import compression from 'compression';
import express, { type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { clearMission, getDef, hideWord, mineOf, missionList, submitText, submitVote, viewOf } from './missions.ts';
import { currentRoomCode, registerHandlers, rooms } from './rooms.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export type AppOptions = {
  /** Caminho difícil de adivinhar onde a apresentação é servida (ex.: /aula-k7x2). */
  deckPath: string;
  /** Chave do professor: cria salas e zera/oculta missões. Vazia = sem proteção (só em dev). */
  adminKey: string;
  deckFile?: string;
  webDist?: string;
};

export function optionsFromEnv(env = process.env): AppOptions {
  const prod = env.NODE_ENV === 'production';
  let deckPath = (env.DECK_PATH ?? '').trim();
  if (!deckPath) {
    deckPath = prod ? `/aula-${Math.random().toString(36).slice(2, 8)}` : '/aula';
    if (prod) console.warn(`[aviso] DECK_PATH não definido: a apresentação ficou em ${deckPath} até o próximo reinício.`);
  }
  if (!deckPath.startsWith('/')) deckPath = `/${deckPath}`;
  const adminKey = (env.ADMIN_KEY ?? '').trim();
  if (!adminKey) console.warn('[aviso] ADMIN_KEY não definido: qualquer pessoa pode criar salas e zerar missões.');
  return { deckPath: deckPath.replace(/\/+$/, ''), adminKey };
}

export function buildServer(opts: AppOptions): { app: express.Express; httpServer: HttpServer; io: Server } {
  const deckFile = opts.deckFile ?? path.resolve(here, '../deck/aula-vrio.html');
  const webDist = opts.webDist ?? path.resolve(here, '../../web/dist');
  const isAdmin = (k: unknown) => !opts.adminKey || k === opts.adminKey;

  const app = express();
  app.disable('x-powered-by');
  app.use(compression()); // gzip/brotli: o deck tem ~3,7 MB
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    // Wi-Fi de faculdade costuma ser instável: tolera mais antes de dar a conexão por perdida.
    pingInterval: 10_000,
    pingTimeout: 20_000,
  });

  registerHandlers(io, { isAdmin, deckPath: opts.deckPath });

  // --------------------------------------------------------------- missões
  const missionChannel = (id: string) => `missao:${id}`;
  const pending = new Map<string, NodeJS.Timeout>();
  /** Avisa as telas da missão, no máximo 4 vezes por segundo. */
  function notifyMission(id: string) {
    if (pending.has(id)) return;
    pending.set(
      id,
      setTimeout(() => {
        pending.delete(id);
        io.to(missionChannel(id)).emit('missao:state', { id, view: viewOf(id) });
      }, 250),
    );
  }
  io.on('connection', (socket) => {
    socket.on('missao:watch', (payload: { id?: unknown } | undefined, ack: unknown) => {
      const id = String(payload?.id ?? '');
      if (!getDef(id)) return typeof ack === 'function' && ack({ ok: false, error: 'Missão não encontrada.' });
      socket.join(missionChannel(id));
      if (typeof ack === 'function') ack({ ok: true, view: viewOf(id) });
    });
  });

  const api = express.Router();
  api.use(express.json({ limit: '4kb' }));
  api.use((_req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' });
    next();
  });
  api.options('*', (_req, res) => res.set('Access-Control-Allow-Methods', 'GET, POST').sendStatus(204));

  api.get('/missoes', (_req, res) => res.json({ missions: missionList() }));

  api.get('/missao/:id', (req: Request, res: Response) => {
    const view = viewOf(req.params.id);
    if (!view) return res.status(404).json({ error: 'Missão não encontrada.' });
    const token = req.query.token;
    // Sem token: exatamente o formato que o deck lê ({ question, total, words }).
    res.json(token ? { ...view, mine: mineOf(req.params.id, token) } : view);
  });

  api.post('/missao/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const def = getDef(id);
    if (!def) return res.status(404).json({ ok: false, error: 'Missão não encontrada.' });
    const b = req.body ?? {};
    const result = def.kind === 'nuvem' ? submitText(id, b.token, b.text) : submitVote(id, b.token, b.item, b.option);
    if (!result.ok) return res.status(result.code === 'rate' || result.code === 'limit' ? 429 : 400).json(result);
    notifyMission(id);
    res.json(result);
  });

  const requireAdmin = (req: Request, res: Response) => {
    if (isAdmin(req.query.k)) return true;
    res.status(403).json({ ok: false, error: 'Chave do professor inválida.' });
    return false;
  };

  api.post('/missao/:id/limpar', (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!clearMission(req.params.id)) return res.status(404).json({ ok: false, error: 'Missão não encontrada.' });
    notifyMission(req.params.id);
    res.json({ ok: true });
  });

  api.post('/missao/:id/ocultar', (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!hideWord(req.params.id, req.body?.text)) return res.status(400).json({ ok: false, error: 'Não deu para ocultar.' });
    notifyMission(req.params.id);
    res.json({ ok: true });
  });

  // --------------------------------------------------------- sala e admin

  /** A raiz "/" leva os alunos para a sala mais recente do professor. */
  api.get('/sala-atual', (_req, res) => res.json({ code: currentRoomCode() }));
  api.get('/admin', (req, res) => res.json({ required: !!opts.adminKey, valid: isAdmin(req.query.k) }));

  app.use('/api', api);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, sockets: io.engine.clientsCount });
  });

  // --------------------------------------------------------- apresentação
  app.get([opts.deckPath, `${opts.deckPath}/`], (_req, res) => {
    if (!existsSync(deckFile)) return res.status(404).type('text').send('Apresentação não encontrada no servidor.');
    res.set({ 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    res.sendFile(deckFile);
  });

  // --------------------------------------------------------------- front
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    // SPA: /, /professor, /host/ABCD, /ABCD, /m/1 e /m/1/tela devolvem o mesmo index.html.
    app.get('*', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(webDist, 'index.html')));
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('Servidor do Leilão VRIO no ar. Em dev, abra o front em http://localhost:5173'),
    );
  }

  return { app, httpServer, io };
}

// Teste de carga: conecta N jogadores falsos que dão lances aleatórios.
//
//   npm run bots -- --url=https://seu-app.onrender.com --code=BCDF --n=40
//
// Com --create, o script cria a própria sala e conduz a partida inteira sozinho
// (útil para testar sem ninguém no telão). Se o servidor tiver ADMIN_KEY, passe --key:
//
//   npm run bots -- --url=http://localhost:3001 --create --n=40 --key=SUA_CHAVE
import { io, type Socket } from 'socket.io-client';
import type { Ack, PrivateState, RoomState } from '../../shared/types.ts';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const URL = args.url ?? 'http://localhost:3001';
const N = Number(args.n ?? 40);
const CREATE = args.create === 'true';
let code = (args.code ?? '').toUpperCase();
let secret = args.secret ?? '';

const errors = new Map<string, number>();
let bidsOk = 0;
let bidsSent = 0;
const countErr = (c = 'unknown') => errors.set(c, (errors.get(c) ?? 0) + 1);

function ack<T>(s: Socket, event: string, payload: unknown): Promise<Ack<T>> {
  return new Promise((resolve) =>
    s.timeout(8000).emit(event, payload, (err: unknown, res: Ack<T>) =>
      resolve(err ? { ok: false, error: 'timeout', code: 'timeout' } : res),
    ),
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

class Bot {
  s: Socket;
  token = '';
  room: RoomState | null = null;
  me: PrivateState | null = null;
  maxForLot = 0;
  lastLot = -1;
  answered = false;

  constructor(public name: string) {
    this.s = io(URL, { transports: ['websocket'], forceNew: true });
    this.s.on('room:state', (st: RoomState) => {
      this.room = st;
      if (st.lotIndex !== this.lastLot) {
        this.lastLot = st.lotIndex;
        this.maxForLot = Math.random() < 0.3 ? 0 : 5 + Math.floor(Math.random() * 55);
      }
    });
    this.s.on('player:private', (p: PrivateState) => {
      this.me = p;
      if (p.offer && !this.answered) {
        this.answered = true;
        setTimeout(() => ack(this.s, 'player:offer', { code, token: this.token, accept: Math.random() < 0.5 }), 500 + Math.random() * 3000);
      }
    });
    this.s.on('connect_error', (e) => countErr(`connect: ${e.message}`));
  }

  async join() {
    const res = await ack<{ token: string }>(this.s, 'player:join', { code, name: this.name });
    if (!res.ok) {
      countErr(`join: ${res.code}`);
      return false;
    }
    this.token = res.token;
    void this.loop();
    return true;
  }

  async loop() {
    while (this.s.connected || this.s.active) {
      await sleep(300 + Math.random() * 1200);
      const st = this.room;
      const me = this.me;
      if (!st || !me || st.phase !== 'bidding' || st.paused || st.winning.some((w) => w.playerId === me.playerId)) continue;
      const inc = pick([5, 10, 20] as const);
      const amount = st.cutoff + inc;
      if (amount > me.budget || amount > this.maxForLot || Math.random() > 0.35) continue;
      bidsSent++;
      const res = await ack(this.s, 'player:bid', { code, token: this.token, increment: inc, base: st.cutoff });
      if (res.ok) bidsOk++;
      else countErr(`bid: ${res.code}`);
    }
  }
}

async function main() {
  console.log(`Conectando em ${URL}…`);
  let host: Socket | null = null;
  if (CREATE) {
    host = io(URL, { transports: ['websocket'] });
    const res = await ack<{ code: string; secret: string }>(host, 'host:create', { short: args.short === 'true', adminKey: args.key });
    if (!res.ok) throw new Error(res.error);
    code = res.code;
    secret = res.secret;
    console.log(`Sala criada: ${code}  telão: ${URL}/host/${code}?k=${secret}`);
  }
  if (!code) {
    console.error('Use --code=ABCD (ou --create).');
    process.exit(1);
  }

  const bots = Array.from({ length: N }, (_, i) => new Bot(`Bot ${String(i + 1).padStart(2, '0')}`));
  const joined = (await Promise.all(bots.map((b) => b.join()))).filter(Boolean).length;
  console.log(`${joined}/${N} bots entraram na sala ${code}.`);

  // Observa a sala (e conduz, se tiver o segredo).
  const watcher = host ?? io(URL, { transports: ['websocket'] });
  const drive = !!secret && (CREATE || args.drive === 'true');
  let last = '';
  const started = Date.now();

  await new Promise<void>((resolve) => {
    const onState = async (st: RoomState) => {
      const tag = `${st.phase}:${st.lotIndex}:${st.revealIndex}:${st.introStep}`;
      if (tag !== last) {
        last = tag;
        const t = ((Date.now() - started) / 1000).toFixed(0).padStart(4);
        if (st.phase === 'sold') {
          const r = st.results.find((x) => x.lotIndex === st.lotIndex);
          const ws = r?.winners.map((w) => `${w.name} R$ ${w.price}`).join(', ');
          console.log(`${t}s  lote ${st.lotIndex + 1} (${st.units} un.): ${ws || 'encalhou'}`);
        } else if (st.phase !== 'bidding' && st.phase !== 'reveal') console.log(`${t}s  fase ${st.phase}`);
        if (drive && ['lobby', 'intro', 'reveal'].includes(st.phase)) {
          await sleep(st.phase === 'reveal' ? 150 : 1000);
          await ack(watcher, 'host:command', { code, secret, action: 'next' });
        }
      }
      if (st.phase === 'podium') {
        console.log('\nPódio:');
        st.standings?.slice(0, 5).forEach((s) => console.log(`  ${s.rank}º ${s.name}  ${s.points} pts  sobrou R$ ${s.budget} mi`));
        console.log(`  Melhor negócio: ${st.awards?.bestDeal?.name ?? '—'}   Maior mico: ${st.awards?.biggestFlop?.name ?? '—'}`);
        resolve();
      }
    };
    watcher.on('room:state', onState);
    void ack<{ state: RoomState }>(watcher, 'room:watch', { code, secret }).then((res) => {
      if (res.ok) void onState(res.state);
    });
    if (!drive) console.log('Aguardando o professor conduzir a partida pelo telão… (Ctrl+C para sair)');
  });

  console.log(`\nLances: ${bidsOk} aceitos de ${bidsSent} enviados.`);
  if (errors.size) console.log('Recusas/erros:', Object.fromEntries(errors));
  const fatal = [...errors.keys()].filter((k) => k.startsWith('connect') || k.startsWith('join') || k.includes('timeout'));
  bots.forEach((b) => b.s.disconnect());
  watcher.disconnect();
  process.exit(fatal.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

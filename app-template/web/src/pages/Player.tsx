import { useEffect, useRef, useState } from 'react';
import { CASE } from '../../../shared/case.ts';
import { INCREMENTS, INTRO_STEPS, NAME_MAX, type Increment, type Label, type PrivateState, type RoomState } from '../../../shared/types.ts';
import { LabelBadge, Mascot, Spinner, VrioStrip } from '../components/ui.tsx';
import { LABEL_STYLE, mi, remainingMs, signed, useTicker } from '../lib/hooks.ts';
import { emitAck, hintServerNow, onEveryConnect, socket, useConnected } from '../lib/socket.ts';

type Saved = { token: string; name: string };
type Stage = 'checking' | 'join' | 'in' | 'kicked' | 'noroom';

const storeKey = (code: string) => `vrio:player:${code}`;
function loadSaved(code: string): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(storeKey(code)) ?? 'null');
  } catch {
    return null;
  }
}
function save(code: string, s: Saved | null) {
  try {
    if (s) localStorage.setItem(storeKey(code), JSON.stringify(s));
    else localStorage.removeItem(storeKey(code));
  } catch {
    /* modo privado: segue sem reconexão automática */
  }
}

/** Mantém a tela do celular acesa durante a partida. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
      } catch {
        /* sem permissão: tudo bem */
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

export default function Player({ code }: { code: string }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [saved, setSaved] = useState<Saved | null>(() => loadSaved(code));
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<PrivateState | null>(null);
  const connected = useConnected();
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useWakeLock(stage === 'in');

  useEffect(() => {
    const onState = (s: RoomState) => {
      hintServerNow(s.serverNow);
      setRoom(s);
    };
    const onPrivate = (p: PrivateState) => setMe(p);
    const onKicked = () => {
      save(code, null);
      setSaved(null);
      setStage('kicked');
    };
    socket.on('room:state', onState);
    socket.on('player:private', onPrivate);
    socket.on('player:kicked', onKicked);

    // Reconecta pelo token salvo, agora e a cada queda de conexão.
    const off = onEveryConnect(async () => {
      const s = savedRef.current;
      if (!s) {
        setStage((st) => (st === 'checking' ? 'join' : st));
        return;
      }
      const res = await emitAck<{ playerId: string; token: string; name: string }>('player:join', { code, token: s.token, name: s.name });
      if (res.ok) {
        setStage('in');
        return;
      }
      if (res.code === 'noroom') return setStage('noroom');
      // token não vale mais (ex.: servidor reiniciou): volta para a entrada com o nome preenchido
      save(code, null);
      setSaved(null);
      setStage('join');
    });
    return () => {
      socket.off('room:state', onState);
      socket.off('player:private', onPrivate);
      socket.off('player:kicked', onKicked);
      off();
    };
  }, [code]);

  const onJoined = (s: Saved) => {
    save(code, s);
    setSaved(s);
    setStage('in');
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {!connected && stage !== 'checking' && (
        <div className="sticky top-0 z-50 bg-alert py-1.5 text-center text-sm font-semibold">Reconectando…</div>
      )}
      {stage === 'checking' && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
      {stage === 'join' && <JoinForm code={code} onJoined={onJoined} onNoRoom={() => setStage('noroom')} />}
      {stage === 'noroom' && (
        <Center>
          <p className="text-6xl">🤔</p>
          <h1 className="mt-4 font-display text-3xl font-bold">Sala {code} não encontrada</h1>
          <p className="mt-2 text-white/60">Confira o código no telão.</p>
          <a href="/" className="mt-6 rounded-2xl bg-violet px-6 py-3 font-semibold">
            Digitar outro código
          </a>
        </Center>
      )}
      {stage === 'kicked' && (
        <Center>
          <p className="text-6xl">🚪</p>
          <h1 className="mt-4 font-display text-3xl font-bold">Você saiu da sala</h1>
          <p className="mt-2 text-white/60">O professor removeu este nome.</p>
          <button onClick={() => setStage('join')} className="mt-6 rounded-2xl bg-violet px-6 py-3 font-semibold">
            Entrar de novo
          </button>
        </Center>
      )}
      {stage === 'in' && room && me && <Game code={code} token={saved?.token ?? ''} room={room} me={me} />}
      {stage === 'in' && (!room || !me) && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  );
}

function Center({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-1 flex-col items-center justify-center px-6 py-10 text-center ${className}`}>{children}</div>;
}

// -------------------------------------------------------------------- entrada

function JoinForm({ code, onJoined, onNoRoom }: { code: string; onJoined: (s: Saved) => void; onNoRoom: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [busy, setBusy] = useState(false);

  async function join(n = name) {
    if (!n.trim() || busy) return;
    setBusy(true);
    setError('');
    setSuggestion('');
    const res = await emitAck<{ token: string; name: string }>('player:join', { code, name: n });
    setBusy(false);
    if (res.ok) return onJoined({ token: res.token, name: res.name });
    if (res.code === 'noroom') return onNoRoom();
    setError(res.error);
    if (res.suggestion) setSuggestion(res.suggestion);
  }

  return (
    <div className="glow-bg flex flex-1 flex-col px-6 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-bold">
          🔨 Leilão <span className="text-gold">VRIO</span>
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 font-display font-bold tracking-widest">{code}</span>
      </div>
      <div className="relative mx-auto mt-2 h-56 w-56">
        <Mascot pose="moeda" className="h-full w-full object-contain" />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
        className="mt-2 flex flex-col"
      >
        <label htmlFor="name" className="font-display text-3xl font-bold">
          Qual é o seu nome?
        </label>
        <p className="mt-1 text-white/60">É assim que você vai aparecer no telão.</p>
        <input
          id="name"
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome ou do grupo"
          className="mt-5 rounded-2xl bg-white/10 px-5 py-4 text-2xl font-semibold ring-2 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-violet"
        />
        <p className="mt-1 text-right text-xs text-white/40 tnum">
          {name.length}/{NAME_MAX}
        </p>
        {error && <p className="mt-2 rounded-xl bg-alert/15 px-4 py-3 text-alert">{error}</p>}
        {suggestion && (
          <button type="button" onClick={() => void join(suggestion)} className="mt-2 rounded-xl bg-white/10 px-4 py-3 font-semibold">
            Entrar como “{suggestion}”
          </button>
        )}
        <button
          disabled={!name.trim() || busy}
          className="mt-5 rounded-2xl bg-gold py-5 font-display text-2xl font-bold text-ink shadow-[0_8px_30px_rgb(255_200_61/0.3)] active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Entrando…' : 'Entrar no leilão'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------- jogo

function Game({ code, token, room, me }: { code: string; token: string; room: RoomState; me: PrivateState }) {
  const leading = room.phase === 'bidding' && room.winning.some((w) => w.playerId === me.playerId);
  return (
    <div className={`flex flex-1 flex-col transition-colors duration-300 ${leading ? 'bg-[#0b3d2a]' : 'glow-bg'}`}>
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <span className="min-w-0 truncate font-display text-lg font-bold">{me.name}</span>
        <span className="flex-none rounded-full bg-black/30 px-3 py-1.5 text-sm ring-1 ring-white/10">
          Saldo <b className="font-display text-base text-gold tnum">{mi(me.budget)}</b>
        </span>
      </header>
      {(room.phase === 'lobby' || room.phase === 'intro') && <Waiting room={room} me={me} />}
      {room.phase === 'bidding' && <Bidding code={code} token={token} room={room} me={me} />}
      {room.phase === 'sold' && <Sold room={room} me={me} />}
      {room.phase === 'offer' && <Offer code={code} token={token} room={room} me={me} />}
      {room.phase === 'reveal' && <MyReveal room={room} me={me} />}
      {room.phase === 'podium' && <MyPodium room={room} me={me} />}
    </div>
  );
}

const SCALE_LABELS: Label[] = ['Sustentável', 'Temporária', 'Paridade', 'Desvantagem'];

function Waiting({ room, me }: { room: RoomState; me: PrivateState }) {
  if (room.phase === 'intro') {
    const step = room.introStep;
    const k = room.units;
    return (
      <div key={step} className="animate-pop flex flex-1 flex-col px-5 pb-8 pt-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-2">
          {step + 1}/{INTRO_STEPS} · {['O case', 'A missão', 'O leilão'][step]}
        </p>
        {step === 0 && (
          <>
            <h2 className="mt-1 font-display text-3xl font-bold">
              A guerra do <span className="text-gold">streaming</span> 🎬
            </h2>
            <div className="mt-3 space-y-3 text-[17px] leading-snug text-white/85">
              {CASE.story.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <p className="mt-5 rounded-2xl bg-gold/15 p-4 font-display text-xl font-bold text-gold ring-1 ring-gold/50">{CASE.question}</p>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="mt-1 font-display text-3xl font-bold">{CASE.mission.title}</h2>
            <p className="mt-2 text-lg text-white/85">{CASE.mission.lead}</p>
            <ul className="mt-4 space-y-2.5">
              {CASE.mission.scale.map((row, i) => {
                const st = LABEL_STYLE[SCALE_LABELS[i]];
                return (
                  <li key={row.label} className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-12 rounded-xl py-1 text-center font-display text-xl font-bold ${st.bg} ${st.text}`}>{row.points}</span>
                      <span className="font-display font-bold">{row.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/60">{row.hint}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-white/60">{CASE.mission.footer}</p>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="mt-1 font-display text-3xl font-bold">Como funciona o leilão</h2>
            <ul className="mt-4 space-y-3 text-lg">
              <li className="rounded-2xl bg-white/5 p-4">
                📦 <b className="text-gold">{k === 1 ? '1 unidade por lote' : `${k} unidades por lote`}</b>:{' '}
                {k === 1 ? 'o maior lance leva.' : `os ${k} maiores lances levam e cada um paga o próprio lance.`}
              </li>
              <li className="rounded-2xl bg-white/5 p-4">
                👆 Toque em <b>+5</b>, <b>+10</b> ou <b>+20</b> para entrar entre os vencedores. Se alguém passar você, o celular vibra.
              </li>
              <li className="rounded-2xl bg-white/5 p-4">⏱️ 15 s por lote. Lance no fim volta o relógio para 5 s.</li>
              <li className="rounded-2xl bg-white/5 p-4">
                💰 <b className="text-gold">{mi(me.budget)}</b> para os {room.lotCount} lotes. Gastou, acabou.
              </li>
            </ul>
          </>
        )}
        <p className="mt-auto pt-6 text-center text-white/50">O professor avança pelo telão 👀</p>
      </div>
    );
  }
  return (
    <Center>
      <Mascot pose="moeda" className="h-56 w-56 object-contain" />
      <h1 className="mt-2 font-display text-4xl font-bold">Você está dentro, {me.name}! 🎉</h1>
      <p className="mt-3 text-lg text-white/70">
        Seu orçamento: <b className="text-gold">{mi(me.budget)}</b>
      </p>
      <p className="mt-8 text-white/50">Mantenha esta tela aberta. O leilão começa pelo telão.</p>
    </Center>
  );
}

// ---------------------------------------------------------------------- lances

function Bidding({ code, token, room, me }: { code: string; token: string; room: RoomState; me: PrivateState }) {
  useTicker(100);
  const ms = remainingMs(room);
  const secs = Math.ceil(ms / 1000);
  const urgent = ms <= 5000;
  const k = room.units;
  const myPos = room.winning.findIndex((w) => w.playerId === me.playerId);
  const inside = myPos >= 0;
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'bad' | 'info' } | null>(null);
  const [outbid, setOutbid] = useState(0);

  // Vibra quando alguém me tira das vagas vencedoras.
  const prevInside = useRef(inside);
  const prevLot = useRef(room.lotIndex);
  useEffect(() => {
    if (prevLot.current === room.lotIndex && prevInside.current && !inside) {
      navigator.vibrate?.([90, 50, 90]);
      setOutbid((n) => n + 1);
      setToast({ text: 'Passaram o seu lance! Dê outro para voltar.', tone: 'bad' });
    }
    prevInside.current = inside;
    prevLot.current = room.lotIndex;
  }, [inside, room.lotIndex]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  async function bid(increment: Increment) {
    if (pending) return;
    setPending(true);
    navigator.vibrate?.(15);
    const res = await emitAck('player:bid', { code, token, increment, base: room.cutoff });
    setPending(false);
    if (!res.ok && res.code !== 'closed' && res.code !== 'leader') {
      setToast({ text: res.code === 'stale' ? 'Alguém foi mais rápido! Veja o novo valor.' : res.error, tone: res.code === 'stale' ? 'info' : 'bad' });
    }
  }

  const lot = room.lot!;
  const cantAfford = !inside && room.cutoff + INCREMENTS[0] > me.budget;
  const blocked = inside || room.paused || ms <= 0;
  const freeSlots = k - room.winning.length;

  return (
    <div key={outbid} className={`flex flex-1 flex-col px-5 pb-5 ${outbid ? 'animate-flash-red' : ''}`}>
      {/* relógio */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white/60">
          Lote {room.lotIndex + 1}/{room.lotCount}
        </span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${room.paused ? 'bg-muted' : urgent ? 'bg-alert' : 'bg-violet'}`}
            style={{ width: `${Math.min(100, (ms / 15000) * 100)}%` }}
          />
        </div>
        <span className={`w-12 text-right font-display text-3xl font-bold tnum ${urgent && !room.paused ? 'text-alert' : ''}`}>
          {room.paused ? '⏸' : `${secs}s`}
        </span>
      </div>

      {/* lote */}
      <div className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="flex items-center gap-4">
          <span className="text-5xl leading-none">{lot.icon}</span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-tight">{lot.name}</h2>
            <p className="mt-1 text-sm leading-snug text-white/60">{lot.pitch}</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-gold">
          📦 {k === 1 ? '1 unidade: o maior lance leva' : `${k} unidades: os ${k} maiores lances levam`}
        </p>
      </div>

      {/* situação */}
      <div className="flex flex-1 flex-col items-center justify-center py-3 text-center">
        {inside ? (
          <>
            <p className="animate-pop font-display text-3xl font-bold text-neon">VOCÊ ESTÁ LEVANDO!</p>
            <p className="mt-1 font-display text-5xl font-bold tnum">{mi(room.winning[myPos].amount)}</p>
            <p className="mt-2 text-white/75">
              {k > 1 ? `${myPos + 1}º de ${k} vagas. ` : ''}Se alguém passar você, o celular vibra.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm uppercase tracking-widest text-white/50">{room.cutoff ? 'Para entrar' : freeSlots === k ? 'Seja o primeiro!' : 'Ainda tem vaga!'}</p>
            <p key={room.cutoff} className="animate-bump font-display text-5xl font-bold text-gold tnum">
              {mi(room.cutoff + INCREMENTS[0])}
            </p>
            <p className="mt-1 text-white/60">{room.cutoff ? `É preciso passar ${mi(room.cutoff)}` : 'Lance mínimo'}</p>
          </>
        )}
        {room.winning.length > 0 && (
          <div className="mt-3 flex max-w-full flex-wrap justify-center gap-1.5">
            {room.winning.map((w) => (
              <span
                key={w.playerId}
                className={`max-w-[10rem] truncate rounded-full px-2.5 py-1 text-xs font-semibold ${w.playerId === me.playerId ? 'bg-neon text-ink' : 'bg-white/10 text-white/80'}`}
              >
                {w.name} · {w.amount}
              </span>
            ))}
            {Array.from({ length: freeSlots }, (_, i) => (
              <span key={i} className="rounded-full border border-dashed border-white/25 px-2.5 py-1 text-xs text-white/40">
                vaga
              </span>
            ))}
          </div>
        )}
        {room.paused && <p className="mt-3 rounded-full bg-gold px-4 py-1 font-semibold text-ink">Pausado pelo professor</p>}
        {cantAfford && <p className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/70">Seu saldo não cobre este lote. Guarde para o próximo!</p>}
      </div>

      {toast && (
        <div className={`animate-pop mb-3 rounded-2xl px-4 py-3 text-center font-semibold ${toast.tone === 'bad' ? 'bg-alert' : 'bg-violet'}`}>{toast.text}</div>
      )}

      {/* botões */}
      <div className="grid grid-cols-3 gap-3">
        {INCREMENTS.map((inc) => {
          const amount = room.cutoff + inc;
          const disabled = blocked || amount > me.budget;
          return (
            <button
              key={inc}
              onClick={() => void bid(inc)}
              disabled={disabled}
              className={`flex h-28 flex-col items-center justify-center rounded-3xl font-display transition active:scale-95 ${
                disabled ? 'bg-white/5 text-white/25' : 'bg-violet text-white shadow-[0_8px_24px_rgb(124_58_237/0.45)]'
              } ${pending && !disabled ? 'opacity-70' : ''}`}
            >
              <span className="text-4xl font-bold leading-none">+{inc}</span>
              <span className={`mt-2 text-sm font-semibold ${disabled ? '' : 'text-white/80'}`}>{mi(amount)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- vendido

function Sold({ room, me }: { room: RoomState; me: PrivateState }) {
  const res = room.results.find((r) => r.lotIndex === room.lotIndex);
  const winners = res?.winners ?? [];
  const mine = winners.find((w) => w.playerId === me.playerId);
  if (res && mine)
    return (
      <Center>
        <p className="animate-pop text-7xl">🎉</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-neon">É seu!</h1>
        <p className="mt-3 text-xl">
          Você comprou <b>{res.lot.icon} {res.lot.name}</b> por <b className="text-gold">{mi(mine.price)}</b>
        </p>
        <p className="mt-6 text-white/60">Saldo agora: {mi(me.budget)}</p>
      </Center>
    );
  return (
    <Center>
      <p className="text-6xl">{res?.lot.icon ?? '🔨'}</p>
      {winners.length ? (
        <>
          <h1 className="mt-4 font-display text-3xl font-bold">{winners.length === 1 ? `${winners[0].name} levou` : 'Quem levou'}</h1>
          {winners.length === 1 ? (
            <p className="mt-2 text-xl text-white/70">por {mi(winners[0].price)}</p>
          ) : (
            <ul className="mt-3 w-full max-w-xs space-y-1.5 text-left">
              {winners.map((w) => (
                <li key={w.playerId} className="flex justify-between gap-3 rounded-xl bg-white/5 px-4 py-2">
                  <span className="truncate font-semibold">{w.name}</span>
                  <span className="tnum text-white/70">{mi(w.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <h1 className="mt-4 font-display text-3xl font-bold">{res?.skipped ? 'Lote pulado' : 'Encalhou: ninguém deu lance'}</h1>
      )}
      <p className="mt-8 text-white/50">Próximo lote em instantes…</p>
    </Center>
  );
}

// ---------------------------------------------------------- oferta secreta

function Offer({ code, token, room, me }: { code: string; token: string; room: RoomState; me: PrivateState }) {
  useTicker(200);
  const [sent, setSent] = useState(false);
  if (!me.offer)
    return (
      <Center>
        <p className="text-6xl">🤫</p>
        <h1 className="mt-4 font-display text-3xl font-bold">Negociação secreta</h1>
        <p className="mt-2 text-white/60">Quem comprou o último lote está decidindo algo. Aguarde…</p>
      </Center>
    );
  if (me.offer.answered)
    return (
      <Center>
        <p className="text-6xl">✅</p>
        <h1 className="mt-4 font-display text-3xl font-bold">Decisão registrada</h1>
        <p className="mt-2 text-white/60">Guarde segredo. O leilão continua em instantes.</p>
      </Center>
    );
  const secs = Math.ceil(remainingMs(room) / 1000);
  const answer = async (accept: boolean) => {
    setSent(true);
    navigator.vibrate?.(20);
    const res = await emitAck('player:offer', { code, token, accept });
    if (!res.ok) setSent(false);
  };
  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-violet/40 to-transparent px-6 pb-6 pt-4">
      <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-violet-2">Só você está vendo isto</p>
      <p className="mt-6 text-center text-7xl">🤫</p>
      <h1 className="mt-4 text-center font-display text-3xl font-bold">Proposta secreta</h1>
      <p className="mt-4 text-center text-2xl leading-snug">
        Investir mais <b className="text-gold">{mi(me.offer.cost)}</b> em reorganização?
      </p>
      <p className="mt-2 text-center text-white/60">Montar time, processos e orçamento para finalmente lançar a tecnologia.</p>
      <p className="mt-6 text-center font-display text-6xl font-bold tnum">{room.paused ? '⏸' : secs}</p>
      <p className="text-center text-sm text-white/50">Sem resposta = não</p>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        <button disabled={sent} onClick={() => void answer(false)} className="h-24 rounded-3xl bg-white/10 font-display text-3xl font-bold disabled:opacity-40">
          Não
        </button>
        <button
          disabled={sent}
          onClick={() => void answer(true)}
          className="h-24 rounded-3xl bg-neon font-display text-3xl font-bold text-ink shadow-[0_8px_24px_rgb(34_229_132/0.35)] disabled:opacity-40"
        >
          Sim
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ revelação e fim

function MyLots({ me }: { me: PrivateState }) {
  if (me.myLots.length === 0)
    return (
      <div className="rounded-3xl bg-white/5 p-5 text-center text-white/70">
        Você não comprou nada. Às vezes guardar o dinheiro também é estratégia.
      </div>
    );
  return (
    <ul className="space-y-3">
      {me.myLots.map((l) => (
        <li key={l.lotIndex} className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{l.lot.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold">{l.lot.name}</p>
              <p className="text-sm text-white/60">
                Pagou {mi(l.price)}
                {l.reorganized && ' + reorganização'}
              </p>
            </div>
            <span className={`font-display text-3xl font-bold tnum ${l.points === undefined ? 'text-white/30' : l.points > 0 ? 'text-neon' : l.points < 0 ? 'text-alert' : 'text-white/70'}`}>
              {l.points === undefined ? '?' : signed(l.points)}
            </span>
          </div>
          {l.secret && (
            <div className="mt-3 space-y-2">
              <LabelBadge label={l.secret.label} size="sm" />
              <VrioStrip label={l.secret.label} reorganized={l.reorganized} />
              <p className="text-sm text-white/70">{l.secret.revealText}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function MyReveal({ room, me }: { room: RoomState; me: PrivateState }) {
  const standing = room.standings?.find((s) => s.playerId === me.playerId);
  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-2">
      <h1 className="font-display text-3xl font-bold">Hora da verdade 👀</h1>
      <p className="text-white/60">
        {room.revealIndex}/{room.lotCount} cartas viradas no telão
      </p>
      <div className="my-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-sm text-white/50">Seus pontos</p>
          <p className="font-display text-4xl font-bold tnum">{me.points}</p>
        </div>
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-sm text-white/50">Posição agora</p>
          <p className="font-display text-4xl font-bold tnum">
            {standing ? `${standing.rank}º` : '—'}
            <span className="text-base text-white/40"> de {room.players.length}</span>
          </p>
        </div>
      </div>
      <MyLots me={me} />
    </div>
  );
}

function MyPodium({ room, me }: { room: RoomState; me: PrivateState }) {
  const rank = me.finalRank;
  const best = room.awards?.bestDeal?.playerId === me.playerId;
  const flop = room.awards?.biggestFlop?.playerId === me.playerId;
  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-2">
      <div className="py-4 text-center">
        <p className="text-6xl">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏁'}</p>
        <p className="mt-2 text-white/60">Você ficou em</p>
        <p className="font-display text-7xl font-bold text-gold tnum">{rank ? `${rank}º` : '—'}</p>
        <p className="text-white/60">de {me.totalPlayers} jogadores</p>
        <div className="mt-4 flex justify-center gap-3">
          <span className="rounded-full bg-white/10 px-4 py-2 font-semibold">{me.points} pontos</span>
          <span className="rounded-full bg-white/10 px-4 py-2 font-semibold">sobrou {mi(me.budget)}</span>
        </div>
        {best && <p className="mt-4 rounded-2xl bg-neon/15 px-4 py-3 font-semibold text-neon">💎 Você levou o prêmio Melhor negócio!</p>}
        {flop && <p className="mt-4 rounded-2xl bg-alert/15 px-4 py-3 font-semibold text-alert">🙈 Você levou o prêmio Maior mico!</p>}
      </div>
      <MyLots me={me} />
    </div>
  );
}

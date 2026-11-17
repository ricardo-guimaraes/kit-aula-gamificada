import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { HostAction, RoomState } from '../../../shared/types.ts';
import { BiddingView, IntroView, LobbyView, OfferView, PodiumView, RevealView, SoldView } from '../components/host.tsx';
import { insideDeck } from '../components/BackToDeck.tsx';
import { MissionsPanel } from '../components/missionsPanel.tsx';
import { Spinner } from '../components/ui.tsx';
import { emitAck, hintServerNow, onEveryConnect, socket, useConnected } from '../lib/socket.ts';
import { playBid, playFanfare, playFlip, playGavel, setSound, unlockAudio } from '../lib/sound.ts';

const W = 1600;
const H = 900;

/** Palco 16:9 de 1600×900 que escala para caber em qualquer projetor. */
function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <div className="glow-bg relative flex-none overflow-hidden" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function readSecret(code: string): string {
  const k = new URLSearchParams(window.location.search).get('k');
  try {
    if (k) localStorage.setItem(`vrio:host:${code}`, k);
    return k ?? localStorage.getItem(`vrio:host:${code}`) ?? '';
  } catch {
    return k ?? '';
  }
}

export default function Host({ code }: { code: string }) {
  const [secret] = useState(() => readSecret(code));
  const [state, setState] = useState<RoomState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [showMissions, setShowMissions] = useState(false);
  const [deckPath, setDeckPath] = useState('');
  const connected = useConnected();

  useEffect(() => {
    const onState = (s: RoomState) => {
      hintServerNow(s.serverNow);
      setState(s);
    };
    socket.on('room:state', onState);
    const off = onEveryConnect(async () => {
      const res = await emitAck<{ isHost: boolean; deckPath?: string; state: RoomState }>('room:watch', { code, secret });
      if (!res.ok) return setNotFound(res.code === 'noroom');
      setNotFound(false);
      setIsHost(res.isHost);
      if (res.isHost) {
        setDeckPath(res.deckPath ?? '');
        // A apresentação (tecla J) abre este telão pelo link guardado aqui.
        try {
          localStorage.setItem('vrio:lastHost', `/host/${code}?k=${encodeURIComponent(secret)}`);
        } catch {
          /* modo privado */
        }
      }
      onState(res.state);
    });
    return () => {
      socket.off('room:state', onState);
      off();
    };
  }, [code, secret]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const command = useCallback(
    async (action: HostAction, arg?: unknown) => {
      unlockAudio();
      const res = await emitAck('host:command', { code, secret, action, arg });
      if (!res.ok) setToast(res.error);
    },
    [code, secret],
  );

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const toggleSound = () => {
    setSoundOn((on) => {
      setSound(!on);
      return !on;
    });
  };

  const restart = () => {
    if (window.confirm('Reiniciar a partida com os mesmos jogadores? Saldos e lances voltam ao zero.')) void command('restart');
  };

  // Atalhos de teclado (funcionam com passador de slides).
  useEffect(() => {
    if (!isHost || showMissions) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      unlockAudio();
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowright' || k === 'pagedown' || k === 'enter') {
        e.preventDefault();
        void command('next');
      } else if (k === 'arrowleft' || k === 'pageup') {
        e.preventDefault();
        void command('back');
      } else if (k === 'p' || k === 'b' || k === '.') void command('togglePause');
      else if (k === '+' || k === '=') void command('addTime');
      else if (k === 's') void command('skip');
      else if (k === 'l') void command('lock');
      else if (k === 'f') toggleFullscreen();
      else if (k === 'm') toggleSound();
      // dentro do deck, quem cuida do A é o BackToDeck; fora dele, abre a aula em outra aba
      else if (k === 'a' && !insideDeck && deckPath) window.open(deckPath, 'vrio-aula');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost, command, showMissions, deckPath]);

  // Efeitos sonoros a partir das mudanças de estado.
  const prev = useRef<RoomState | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!state || !p) return;
    if (state.phase === 'sold' && p.phase !== 'sold') {
      const res = state.results.find((r) => r.lotIndex === state.lotIndex);
      if (res?.winners.length) playGavel();
    }
    if (state.phase === 'bidding' && state.lotIndex === p.lotIndex && state.bidFeed[0] && state.bidFeed[0].at !== p.bidFeed[0]?.at) playBid();
    if (state.phase === 'reveal' && state.revealIndex > p.revealIndex) playFlip();
    if (state.phase === 'podium' && p.phase !== 'podium') playFanfare();
  }, [state]);

  if (notFound)
    return (
      <div className="glow-bg flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-4xl font-bold">Sala {code} não encontrada</p>
        <p className="text-white/60">Ela pode ter expirado (salas paradas há 2 h são apagadas) ou o servidor reiniciou.</p>
        <a href="/professor" className="rounded-2xl bg-gold px-6 py-3 font-display text-xl font-bold text-ink">
          Criar nova sala
        </a>
      </div>
    );

  if (!state)
    return (
      <div className="glow-bg flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  const joinUrl = `${window.location.host}/${code}`;
  const fullJoinUrl = `${window.location.origin}/${code}`;

  return (
    <Stage>
      {/* Barra do topo */}
      <header className="absolute inset-x-0 top-0 z-20 flex h-[72px] items-center justify-between px-10">
        <div className="flex items-center gap-3 font-display text-2xl font-bold">
          <span>🔨</span>
          <span>
            Leilão <span className="text-gold">VRIO</span>
          </span>
          {state.paused && <span className="ml-4 rounded-full bg-gold px-4 py-1 text-lg text-ink">⏸ PAUSADO</span>}
          {!connected && <span className="ml-4 rounded-full bg-alert px-4 py-1 text-lg">Reconectando…</span>}
        </div>
        {state.phase !== 'lobby' && (
          <div className="flex items-center gap-5 text-xl text-white/70">
            <span>
              👥 <b className="text-white tnum">{state.players.length}</b>
            </span>
            {!state.locked ? (
              <span>
                Entre em <b className="font-display text-white">{joinUrl}</b>
              </span>
            ) : (
              <span>🔒 Sala trancada</span>
            )}
          </div>
        )}
      </header>

      <main className={`absolute inset-x-0 top-[72px] ${isHost ? 'bottom-[76px]' : 'bottom-0'}`}>
        {state.phase === 'lobby' && <LobbyView state={state} joinUrl={joinUrl} fullJoinUrl={fullJoinUrl} isHost={isHost} onKick={(id) => command('kick', id)} />}
        {state.phase === 'intro' && <IntroView state={state} />}
        {state.phase === 'bidding' && <BiddingView state={state} />}
        {state.phase === 'sold' && <SoldView state={state} />}
        {state.phase === 'offer' && <OfferView state={state} />}
        {state.phase === 'reveal' && <RevealView state={state} />}
        {state.phase === 'podium' && <PodiumView state={state} />}
      </main>

      {toast && (
        <div className="animate-pop absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-2xl bg-ink-3 px-6 py-3 text-xl shadow-2xl ring-1 ring-line">{toast}</div>
      )}

      {isHost && (
        <HostControls
          state={state}
          command={command}
          soundOn={soundOn}
          onSound={toggleSound}
          onFullscreen={toggleFullscreen}
          onRestart={restart}
          onMissions={() => setShowMissions(true)}
          onDeck={
            insideDeck
              ? () => window.parent.postMessage('vrio:aula', '*')
              : deckPath
                ? () => window.open(deckPath, 'vrio-aula')
                : undefined
          }
        />
      )}
      {isHost && showMissions && <MissionsPanel onClose={() => setShowMissions(false)} />}
    </Stage>
  );
}

function primaryLabel(s: RoomState): { text: string; enabled: boolean } {
  switch (s.phase) {
    case 'lobby':
      return { text: 'Apresentar o case', enabled: true };
    case 'intro':
      return s.introStep === 0
        ? { text: 'A missão', enabled: true }
        : s.introStep === 1
          ? { text: 'Como funciona', enabled: true }
          : { text: 'Começar o leilão', enabled: true };
    case 'bidding':
      return { text: 'Lances abertos…', enabled: false };
    case 'sold':
      return { text: s.lotIndex + 1 < s.lotCount ? 'Próximo lote' : 'Ir para a revelação', enabled: true };
    case 'offer':
      return { text: 'Aguardando decisão…', enabled: false };
    case 'reveal':
      if (s.revealIndex === 0) return { text: 'Virar a 1ª carta', enabled: true };
      if (s.revealIndex < s.lotCount) return { text: `Virar carta ${s.revealIndex + 1}`, enabled: true };
      return { text: 'Ver o pódio', enabled: true };
    case 'podium':
      return { text: 'Fim de jogo 🎉', enabled: false };
  }
}

function HostControls(props: {
  state: RoomState;
  command: (a: HostAction) => void;
  soundOn: boolean;
  onSound: () => void;
  onFullscreen: () => void;
  onRestart: () => void;
  onMissions: () => void;
  onDeck?: () => void;
}) {
  const { state, command } = props;
  const primary = primaryLabel(state);
  const timed = state.phase === 'bidding' || state.phase === 'sold' || state.phase === 'offer';
  const btn = 'flex items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-semibold transition disabled:opacity-30 bg-white/8 hover:bg-white/15 ring-1 ring-white/10';
  const kbd = 'rounded bg-black/40 px-1.5 text-sm font-mono text-white/60';
  const canBack = state.phase === 'intro' || (state.phase === 'reveal' && state.revealIndex > 0);
  return (
    <footer className="absolute inset-x-0 bottom-0 z-20 flex h-[76px] items-center justify-between gap-3 border-t border-white/10 bg-ink/85 px-8 backdrop-blur">
      <div className="flex items-center gap-2">
      {canBack && (
        <button className={btn} onClick={() => command('back')} title="Voltar (seta ←)">
          ←
        </button>
      )}
      <button
        onClick={() => command('next')}
        disabled={!primary.enabled}
        className="flex items-center gap-3 rounded-xl bg-gold px-6 py-2.5 font-display text-xl font-bold text-ink shadow-[0_6px_24px_rgb(255_200_61/0.3)] transition hover:brightness-105 disabled:bg-white/10 disabled:text-white/50 disabled:shadow-none"
      >
        {primary.text} {primary.enabled && <span>→</span>}
        {primary.enabled && <span className="rounded bg-ink/15 px-1.5 font-mono text-sm">espaço</span>}
      </button>
      </div>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={!timed} onClick={() => command('togglePause')}>
          {state.paused ? '▶ Retomar' : '⏸ Pausar'} <span className={kbd}>P</span>
        </button>
        <button className={btn} disabled={state.phase !== 'bidding'} onClick={() => command('addTime')}>
          +10 s <span className={kbd}>+</span>
        </button>
        <button className={btn} disabled={state.phase !== 'bidding'} onClick={() => command('skip')}>
          ⏭ Pular lote <span className={kbd}>S</span>
        </button>
        <button className={btn} onClick={() => command('lock')}>
          {state.locked ? '🔒 Trancada' : '🔓 Aberta'} <span className={kbd}>L</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {props.onDeck && (
          <button className={btn} onClick={props.onDeck} title="Voltar para a apresentação (tecla A)">
            📖 Aula <span className={kbd}>A</span>
          </button>
        )}
        <button className={btn} onClick={props.onMissions} title="Nuvens e votações da aula">
          🗳️ Missões
        </button>
        <button className={btn} onClick={props.onSound} title="Som (M)">
          {props.soundOn ? '🔊' : '🔇'}
        </button>
        <button className={btn} onClick={props.onFullscreen} title="Tela cheia (F)">
          ⛶
        </button>
        <button className={btn} onClick={props.onRestart} title="Reiniciar com os mesmos jogadores">
          ↺ Reiniciar
        </button>
      </div>
    </footer>
  );
}

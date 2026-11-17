import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef } from 'react';
import { CASE } from '../../../shared/case.ts';
import { INTRO_STEPS, START_BUDGET, type Label, type RevealedCard, type RoomState } from '../../../shared/types.ts';
import { LABEL_STYLE, mi, remainingMs, signed, useTicker } from '../lib/hooks.ts';
import { playTick } from '../lib/sound.ts';
import { CountdownRing, LabelBadge, Mascot, VrioStrip } from './ui.tsx';

type P = { state: RoomState };

const unitsText = (k: number) => (k === 1 ? '1 unidade' : `${k} unidades`);

// ------------------------------------------------------------------- lobby

export function LobbyView({
  state,
  joinUrl,
  fullJoinUrl,
  isHost,
  onKick,
}: P & { joinUrl: string; fullJoinUrl: string; isHost: boolean; onKick: (id: string) => void }) {
  const n = state.players.length;
  const nameSize = n > 45 ? 'text-lg px-3 py-1' : n > 24 ? 'text-xl px-4 py-1.5' : 'text-2xl px-5 py-2';
  return (
    <div className="flex h-full items-stretch gap-8 px-10 pb-8 pt-2">
      <div className="relative w-[300px] flex-none">
        <Mascot pose="moeda" className="absolute -left-16 bottom-[-40px] w-[440px] max-w-none drop-shadow-[0_20px_50px_rgb(124_58_237/0.45)]" />
      </div>

      <div className="flex w-[500px] flex-none flex-col items-center justify-center">
        <p className="mb-4 font-display text-3xl font-bold">Aponte a câmera 📱</p>
        <div className="rounded-[28px] bg-white p-6 shadow-[0_0_80px_rgb(124_58_237/0.45)]">
          <QRCodeSVG value={fullJoinUrl} size={380} level="M" marginSize={0} />
        </div>
        <p className="mt-5 text-2xl text-white/70">
          ou entre em <b className="font-display text-white">{joinUrl}</b>
        </p>
        <p className="mt-2 font-display text-[88px] font-bold leading-none tracking-[0.18em] text-gold">{state.code}</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col pt-6">
        <p className="font-display text-xl font-semibold uppercase tracking-[0.25em] text-violet-2">Case: {CASE.title}</p>
        <div className="mt-2 flex items-baseline gap-4">
          <span className="font-display text-[96px] font-bold leading-none tnum">{n}</span>
          <span className="text-3xl text-white/70">{n === 1 ? 'CEO na sala' : 'CEOs na sala'}</span>
        </div>
        <p className="mt-2 text-xl text-white/60">
          {n > 0 ? (
            <>
              Com essa turma: <b className="text-gold">{unitsText(state.units)} por lote</b> · {state.lotCount} lotes
            </>
          ) : (
            'Quanto mais gente, mais unidades de cada recurso vão a leilão.'
          )}
        </p>
        {state.locked && <p className="mt-2 text-xl text-gold">🔒 Sala trancada para novos jogadores</p>}
        <div className="mt-5 flex flex-1 flex-wrap content-start gap-2.5 overflow-hidden">
          <AnimatePresence>
            {state.players.map((p) => (
              <motion.button
                key={p.id}
                layout
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: p.connected ? 1 : 0.4 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                onClick={() => isHost && window.confirm(`Remover "${p.name}" da sala?`) && onKick(p.id)}
                title={isHost ? 'Clique para remover' : undefined}
                className={`rounded-full bg-violet/25 font-semibold ring-1 ring-violet/60 ${nameSize} ${isHost ? 'hover:bg-alert/40 hover:ring-alert' : 'cursor-default'}`}
              >
                {p.name}
              </motion.button>
            ))}
          </AnimatePresence>
          {n === 0 && <p className="text-2xl text-white/40">Esperando a turma entrar…</p>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- introdução

function StepDots({ step }: { step: number }) {
  const labels = ['O case', 'A missão', 'O leilão'];
  return (
    <div className="flex items-center gap-3">
      {labels.slice(0, INTRO_STEPS).map((l, i) => (
        <span
          key={l}
          className={`rounded-full px-4 py-1.5 text-lg font-semibold transition ${i === step ? 'bg-gold text-ink' : i < step ? 'bg-violet/40 text-white/80' : 'bg-white/8 text-white/40'}`}
        >
          {i + 1}. {l}
        </span>
      ))}
    </div>
  );
}

const SCALE_LABELS: Label[] = ['Sustentável', 'Temporária', 'Paridade', 'Desvantagem'];

export function IntroView({ state }: P) {
  const step = state.introStep;
  return (
    <div className="flex h-full flex-col px-14 pb-6 pt-1">
      <StepDots step={step} />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
          className="relative mt-4 min-h-0 flex-1"
        >
          {step === 0 && <CaseStep />}
          {step === 1 && <MissionStep />}
          {step === 2 && <DynamicsStep state={state} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CaseStep() {
  return (
    <div className="flex h-full items-center gap-10">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[80px] font-bold leading-none">
          A guerra do <span className="text-gold">streaming</span>
        </h2>
        <div className="mt-6 space-y-3">
          {CASE.story.map((p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.25 }}
              className="text-[30px] leading-snug text-white/85"
            >
              {p}
            </motion.p>
          ))}
        </div>
        <motion.p
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-7 rounded-3xl bg-gold/15 px-8 py-5 font-display text-[36px] font-bold leading-tight text-gold ring-2 ring-gold/50"
        >
          {CASE.question}
        </motion.p>
      </div>
      <div className="relative h-full w-[380px] flex-none">
        <Mascot pose="podio" className="absolute bottom-0 right-0 h-[700px] max-w-none drop-shadow-[0_20px_50px_rgb(124_58_237/0.45)]" />
      </div>
    </div>
  );
}

function MissionStep() {
  return (
    <div className="flex h-full flex-col justify-center">
      <h2 className="font-display text-7xl font-bold">{CASE.mission.title}</h2>
      <p className="mt-3 text-[36px] text-white/85">
        Vence quem construir <b className="text-gold">vantagem competitiva</b>, não quem gastar mais.
      </p>
      <p className="mt-2 text-2xl text-white/60">
        Antes de cada lance, pergunte: é <b className="text-white">V</b>alioso? <b className="text-white">R</b>aro? Difícil de{' '}
        <b className="text-white">I</b>mitar? A empresa está <b className="text-white">O</b>rganizada para explorar?
      </p>
      <div className="mt-7 space-y-3">
        {CASE.mission.scale.map((row, i) => {
          const st = LABEL_STYLE[SCALE_LABELS[i]];
          return (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12 }}
              className="flex items-center gap-6 rounded-3xl bg-white/5 px-6 py-3.5 ring-1 ring-white/10"
            >
              <span className={`w-28 flex-none rounded-2xl py-2 text-center font-display text-5xl font-bold ${st.bg} ${st.text}`}>{row.points}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-3xl font-bold">{row.label}</p>
                <p className="text-xl text-white/60">{row.hint}</p>
              </div>
              <div className="w-[300px] flex-none">
                <VrioStrip label={SCALE_LABELS[i]} />
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-6 text-2xl text-white/60">🤫 {CASE.mission.footer}</p>
    </div>
  );
}

function DynamicsStep({ state }: P) {
  const k = state.units;
  const cards = [
    {
      icon: '📦',
      title: `${unitsText(k)} por lote`,
      text: k === 1 ? 'O maior lance leva.' : `Os ${k} maiores lances levam, uma unidade cada. Cada um paga o próprio lance.`,
    },
    { icon: '👆', title: '+5, +10 ou +20', text: 'Toque no celular para entrar entre os vencedores. Se alguém passar você, o celular vibra.' },
    { icon: '⏱️', title: '15 segundos por lote', text: 'Lance nos últimos 5 segundos volta o relógio para 5.' },
    { icon: '💰', title: `${mi(START_BUDGET)} no total`, text: `É para os ${state.lotCount} lotes. Gastou, acabou: escolha onde investir.` },
  ];
  return (
    <div className="flex h-full items-center gap-8">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-7xl font-bold">Como funciona o leilão</h2>
        <div className="mt-8 grid grid-cols-2 gap-5">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.12 }}
              className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10"
            >
              <span className="text-6xl">{c.icon}</span>
              <p className="mt-3 font-display text-4xl font-bold text-gold">{c.title}</p>
              <p className="mt-2 text-2xl leading-snug text-white/75">{c.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="relative h-full w-[340px] flex-none">
        <Mascot pose="moeda" className="absolute bottom-[-30px] right-[-40px] w-[420px] max-w-none drop-shadow-[0_20px_50px_rgb(124_58_237/0.45)]" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- lances

function LotHeader({ state }: P) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: state.lotCount }, (_, i) => (
        <span
          key={i}
          className={`h-3 rounded-full transition-all ${i < state.lotIndex ? 'w-8 bg-violet' : i === state.lotIndex ? 'w-16 bg-gold' : 'w-8 bg-white/15'}`}
        />
      ))}
      <span className="ml-3 font-display text-2xl font-bold text-white/80">
        Lote {state.lotIndex + 1} de {state.lotCount}
      </span>
    </div>
  );
}

function BigLotCard({ state, dim = false }: P & { dim?: boolean }) {
  const lot = state.lot;
  if (!lot) return null;
  return (
    <div
      key={lot.id}
      className={`animate-pop flex h-full flex-col justify-center rounded-[40px] bg-gradient-to-br from-ink-3 to-ink-2 px-14 py-10 ring-1 ring-white/10 shadow-[0_30px_80px_rgb(0_0_0/0.5)] ${dim ? 'opacity-40' : ''}`}
    >
      <span className="text-[140px] leading-none">{lot.icon}</span>
      <h2 className="mt-6 font-display text-[64px] font-bold leading-[1.02]">{lot.name}</h2>
      <p className="mt-5 text-[32px] leading-snug text-white/70">{lot.pitch}</p>
      <p className="mt-8 inline-flex w-fit rounded-full bg-gold/15 px-5 py-2 text-2xl font-semibold text-gold ring-1 ring-gold/40">
        📦 {unitsText(state.units)} à venda
      </p>
    </div>
  );
}

export function BiddingView({ state }: P) {
  useTicker(100);
  const ms = remainingMs(state);
  const secs = Math.ceil(ms / 1000);
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!state.paused && secs <= 5 && secs > 0 && secs !== lastTick.current) playTick(secs <= 3);
    lastTick.current = secs;
  }, [secs, state.paused]);
  const urgent = ms <= 5000 && !state.paused;
  const k = state.units;
  const rowH = k > 4 ? 'py-2 text-[28px]' : 'py-3 text-[34px]';

  return (
    <div className={`flex h-full flex-col px-10 pb-8 pt-2 ${urgent ? 'animate-flash-red' : ''}`}>
      <LotHeader state={state} />
      <div className="mt-5 flex min-h-0 flex-1 gap-8">
        <div className="min-w-0 flex-[1.15]">
          <BigLotCard state={state} />
        </div>
        <div className="flex flex-1 flex-col rounded-[40px] bg-black/25 px-8 py-6 ring-1 ring-white/10">
          <div className="flex items-center gap-7">
            <CountdownRing ms={ms} totalMs={Math.max(15000, ms)} size={170} stroke={14} paused={state.paused} />
            <div>
              <p className="text-xl uppercase tracking-widest text-white/50">Para entrar</p>
              <p key={state.cutoff} className="animate-bump font-display text-[76px] font-bold leading-none text-gold tnum">
                {mi(state.cutoff + 5)}
              </p>
              <p className="mt-1 text-xl text-white/60">{state.cutoff ? `mais que ${mi(state.cutoff)}` : 'ainda tem vaga: lance mínimo'}</p>
            </div>
          </div>
          <p className="mt-5 text-xl uppercase tracking-widest text-white/50">
            {k === 1 ? 'Está levando' : `Levando agora · ${unitsText(k)}`}
          </p>
          <ol className="mt-2 flex-1 space-y-2 overflow-hidden">
            {Array.from({ length: k }, (_, i) => {
              const w = state.winning[i];
              return w ? (
                <motion.li
                  key={w.playerId}
                  layout
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className={`flex items-center gap-4 rounded-2xl bg-neon/10 px-5 ring-1 ring-neon/40 ${rowH}`}
                >
                  <span className="w-10 font-display font-bold text-neon/80">{i + 1}º</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
                  <span className="font-display font-bold tnum">{mi(w.amount)}</span>
                </motion.li>
              ) : (
                <li key={`empty-${i}`} className={`flex items-center gap-4 rounded-2xl border-2 border-dashed border-white/15 px-5 text-white/35 ${rowH}`}>
                  <span className="w-10 font-display font-bold">{i + 1}º</span>
                  <span>vaga livre</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ vendido

export function SoldView({ state }: P) {
  useTicker(250);
  const res = state.results.find((r) => r.lotIndex === state.lotIndex);
  const winners = res?.winners ?? [];
  const sold = winners.length > 0;
  const isLast = state.lotIndex + 1 >= state.lotCount;
  const secs = Math.ceil(remainingMs(state) / 1000);
  const big = winners.length <= 2;
  return (
    <div className="flex h-full flex-col px-10 pb-8 pt-2">
      <LotHeader state={state} />
      <div className="relative mt-5 flex min-h-0 flex-1 gap-8">
        <div className="relative min-w-0 flex-[1.15]">
          <BigLotCard state={state} dim />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`animate-stamp rounded-3xl border-[10px] px-12 py-4 font-display text-[112px] font-bold leading-none tracking-wider ${sold ? 'border-alert text-alert' : 'border-white/60 text-white/70'}`}
              style={{ backgroundColor: 'rgba(14, 14, 26, 0.92)' }}
            >
              {res?.skipped ? 'PULADO' : sold ? 'VENDIDO!' : 'ENCALHOU'}
            </div>
          </div>
        </div>
        <div className="relative flex flex-1 flex-col justify-center">
          {sold && !big && <Mascot pose="martelada" className="mx-auto mb-2 h-[200px] w-auto" />}
          {sold ? (
            <div className="relative z-10 animate-pop">
              <p className="text-3xl text-white/60">{winners.length === 1 ? 'Arrematado por' : `${winners.length} unidades arrematadas`}</p>
              <ul className="mt-3 space-y-2">
                {winners.map((w) => (
                  <li key={w.playerId} className={`flex items-baseline justify-between gap-4 ${big ? 'text-[56px]' : 'text-[34px]'}`}>
                    <span className="min-w-0 truncate font-display font-bold">{w.name}</span>
                    <span className="font-display font-bold text-gold tnum">{mi(w.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="relative z-10 animate-pop">
              <p className="font-display text-6xl font-bold">{res?.skipped ? 'Lote pulado' : 'Ninguém quis'}</p>
              <p className="mt-3 text-3xl text-white/60">{res?.skipped ? 'O lote saiu do jogo.' : 'O lote encalhou e sai do jogo.'}</p>
            </div>
          )}
          <p className="relative z-10 mt-8 text-2xl text-white/50">
            {state.paused ? 'Pausado' : isLast ? `Fim do leilão! A revelação começa em ${secs} s…` : `Próximo lote em ${secs} s…`}
          </p>
          {sold && big && <Mascot pose="martelada" className="absolute -bottom-10 -right-12 w-[380px] max-w-none" />}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ oferta secreta

export function OfferView({ state }: P) {
  useTicker(250);
  const secs = Math.ceil(remainingMs(state) / 1000);
  const n = state.offerCount;
  return (
    <div className="flex h-full flex-col items-center justify-center px-20 text-center">
      <span className="text-[140px] leading-none">🤫</span>
      <h2 className="mt-6 font-display text-7xl font-bold">Negociação confidencial</h2>
      <p className="mt-6 max-w-4xl text-4xl leading-snug text-white/75">
        {n === 1 ? 'Um arrematante acaba' : `${n} arrematantes acabam`} de receber uma proposta secreta no celular.
      </p>
      <p className="mt-10 font-display text-6xl font-bold tnum text-white/60">{state.paused ? '⏸' : `${secs} s`}</p>
    </div>
  );
}

// ---------------------------------------------------------------- revelação

function RevealDetail({ card }: { card: RevealedCard }) {
  const s = LABEL_STYLE[card.secret.label];
  const reorg = card.secret.reorgCost;
  return (
    <div className="flip-scene h-full">
      <div key={card.lotIndex} className="flip-card h-full">
        <div className={`flex h-full flex-col rounded-[36px] bg-gradient-to-br from-ink-3 to-ink-2 p-8 ring-4 ${s.ring} shadow-[0_30px_80px_rgb(0_0_0/0.5)]`}>
          <div className="flex items-start gap-6">
            <span className="text-[88px] leading-none">{card.lot.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xl text-white/50">Lote {card.lotIndex + 1}</p>
              <h3 className="font-display text-[44px] font-bold leading-tight">{card.lot.name}</h3>
              <div className="mt-2">
                <LabelBadge label={card.secret.label} size="md" />
              </div>
            </div>
            <div className={`flex-none rounded-3xl px-6 py-3 text-center ${s.bg} ${s.text}`}>
              <span className="block font-display text-[68px] font-bold leading-none tnum">{signed(card.secret.points)}</span>
              <span className="text-lg font-semibold">{reorg ? `ou +${card.secret.reorgPoints} reorganizando` : Math.abs(card.secret.points) === 1 ? 'ponto' : 'pontos'}</span>
            </div>
          </div>
          <div className="mt-5">
            <VrioStrip label={card.secret.label} size="lg" />
          </div>
          <p className="mt-5 text-[34px] font-medium leading-snug">{card.secret.revealText}</p>
          <div className="mt-auto pt-3 text-2xl text-white/65">
            {card.winners.length === 0 ? (
              card.skipped ? 'Lote pulado' : 'Encalhou: ninguém comprou'
            ) : (
              <p className="line-clamp-2">
                <span className="text-white/45">Compraram: </span>
                {card.winners.map((w, i) => (
                  <span key={w.playerId}>
                    {i > 0 && ', '}
                    <b className="text-white">{w.name}</b> ({mi(w.price)}
                    {reorg ? (w.reorganized ? ' + reorganizou ✓' : ', não reorganizou') : ''})
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RevealView({ state }: P) {
  const current = state.revealed[state.revealed.length - 1];
  const standings = state.standings ?? [];

  if (!current)
    return (
      <div className="flex h-full items-center gap-6 px-16">
        <div className="relative h-full w-[560px] flex-none">
          <Mascot pose="replay" className="absolute -bottom-6 left-0 w-[600px] max-w-none drop-shadow-[0_20px_50px_rgb(124_58_237/0.45)]" />
        </div>
        <div>
          <p className="font-display text-3xl font-semibold uppercase tracking-[0.3em] text-violet-2">Fim do leilão</p>
          <h2 className="mt-4 font-display text-[120px] font-bold leading-[0.95]">
            Hora da <span className="text-gold">verdade</span>
          </h2>
          <p className="mt-8 max-w-2xl text-4xl leading-snug text-white/75">Vamos virar as cartas e ver o que cada recurso valia pelo VRIO.</p>
        </div>
      </div>
    );

  return (
    <div className="flex h-full gap-7 px-10 pb-7 pt-1">
      <div className="flex min-w-0 flex-[1.55] flex-col gap-5">
        <div className="min-h-0 flex-1">
          <RevealDetail card={current} />
        </div>
        <div className="grid flex-none gap-2.5" style={{ gridTemplateColumns: `repeat(${state.lotCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: state.lotCount }, (_, i) => {
            const c = state.revealed[i];
            const res = state.results[i];
            const st = c ? LABEL_STYLE[c.secret.label] : null;
            return (
              <div
                key={i}
                className={`flex h-[100px] flex-col items-center justify-center rounded-2xl ring-2 transition ${c ? `${st!.ring} bg-ink-3` : 'bg-white/5 ring-white/10'} ${i === state.revealed.length - 1 ? 'scale-105' : ''}`}
              >
                <span className={`text-4xl leading-none ${c ? '' : 'opacity-50 grayscale'}`}>{res?.lot.icon ?? '❔'}</span>
                <span className={`mt-1.5 font-display text-2xl font-bold tnum ${c ? '' : 'text-white/30'}`}>
                  {c ? (c.secret.reorgCost ? `0/+${c.secret.reorgPoints}` : signed(c.secret.points)) : '?'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex w-[480px] flex-none flex-col rounded-[36px] bg-black/25 p-6 ring-1 ring-white/10">
        <h3 className="mb-4 font-display text-3xl font-bold">Ranking</h3>
        <ol className="relative flex-1 space-y-1.5 overflow-hidden">
          {standings.slice(0, 10).map((s, i) => (
            <motion.li
              key={s.playerId}
              layout
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-[7px] ${i === 0 ? 'bg-gold/20 ring-1 ring-gold/60' : 'bg-white/5'}`}
            >
              <span className="w-10 font-display text-2xl font-bold text-white/50 tnum">{s.rank}º</span>
              <span className="min-w-0 flex-1 truncate text-2xl font-semibold">{s.name}</span>
              <span className="text-lg text-white/40 tnum">{mi(s.budget)}</span>
              <span className="w-16 text-right font-display text-3xl font-bold tnum">{s.points}</span>
            </motion.li>
          ))}
        </ol>
        {standings.length > 10 && <p className="mt-2 text-center text-lg text-white/40">+ {standings.length - 10} jogadores</p>}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- pódio

export function PodiumView({ state }: P) {
  const top = (state.standings ?? []).slice(0, 3);
  const awards = state.awards;

  useEffect(() => {
    const colors = ['#7C3AED', '#FFC83D', '#22E584', '#ffffff'];
    const shoot = () => {
      confetti({ particleCount: 140, spread: 90, origin: { x: 0.2, y: 0.7 }, colors });
      confetti({ particleCount: 140, spread: 90, origin: { x: 0.8, y: 0.7 }, colors });
    };
    shoot();
    const t1 = setTimeout(shoot, 900);
    const t2 = setTimeout(() => confetti({ particleCount: 200, spread: 140, origin: { y: 0.4 }, colors }), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      confetti.reset();
    };
  }, []);

  const order = [top[1], top[0], top[2]];
  const heights = [250, 330, 200];
  const medals = ['🥈', '🥇', '🥉'];

  return (
    <div className="flex h-full gap-6 px-12 pb-6">
      <div className="flex flex-1 flex-col">
        <h2 className="text-center font-display text-6xl font-bold">
          Pódio da <span className="text-gold">guerra do streaming</span>
        </h2>
        <div className="mt-auto flex items-end justify-center gap-5">
          {order.map((s, i) =>
            s ? (
              <motion.div
                key={s.playerId}
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: [0.5, 1.0, 0.2][i], type: 'spring', stiffness: 160, damping: 16 }}
                className="flex w-[290px] flex-col items-center"
              >
                <span className="text-7xl">{medals[i]}</span>
                <p className="mt-2 max-w-full truncate font-display text-4xl font-bold">{s.name}</p>
                <p className="mt-1 text-2xl text-white/70">
                  <b className="text-white">{s.points}</b> {Math.abs(s.points) === 1 ? 'ponto' : 'pontos'} · sobrou {mi(s.budget)}
                </p>
                <div
                  className={`mt-4 flex w-full items-start justify-center rounded-t-3xl pt-5 font-display text-7xl font-bold ${i === 1 ? 'bg-gold text-ink' : 'bg-violet/70'}`}
                  style={{ height: heights[i] }}
                >
                  {[2, 1, 3][i]}º
                </div>
              </motion.div>
            ) : (
              <div key={i} className="w-[290px]" />
            ),
          )}
        </div>
      </div>
      <div className="flex w-[470px] flex-none flex-col justify-center gap-5">
        <AwardCard
          icon="💎"
          title="Melhor negócio"
          who={awards?.bestDeal?.name}
          detail={awards?.bestDeal ? `${awards.bestDeal.points} pontos com ${mi(awards.bestDeal.spent)}` : 'Ninguém fez pontos'}
          tone="neon"
        />
        <AwardCard
          icon="🙈"
          title="Maior mico"
          who={awards?.biggestFlop?.name}
          detail={awards?.biggestFlop ? `${mi(awards.biggestFlop.spent)} em recursos sem vantagem` : 'Ninguém caiu em armadilha'}
          tone="alert"
        />
        <p className="text-center text-xl text-white/50">Recurso caro não é recurso estratégico.</p>
      </div>
    </div>
  );
}

function AwardCard({ icon, title, who, detail, tone }: { icon: string; title: string; who?: string; detail: string; tone: 'neon' | 'alert' }) {
  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 1.6, duration: 0.4 }}
      className={`rounded-3xl bg-white/5 p-6 ring-2 ${tone === 'neon' ? 'ring-neon/60' : 'ring-alert/60'}`}
    >
      <p className={`font-display text-2xl font-bold ${tone === 'neon' ? 'text-neon' : 'text-alert'}`}>
        {icon} {title}
      </p>
      <p className="mt-2 truncate font-display text-5xl font-bold">{who ?? '—'}</p>
      <p className="mt-1 text-xl text-white/60">{detail}</p>
    </motion.div>
  );
}

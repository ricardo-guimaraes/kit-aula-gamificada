import { useEffect, useState } from 'react';
import { Spinner } from '../components/ui.tsx';
import { deviceToken, fetchMission, isVote, sendMission, type Mine, type MissionView } from '../lib/api.ts';
import { TEXT_LIMITS } from '../lib/missionLimits.ts';

/** Celular do aluno no modo Missão: /m/:id. */
export default function Mission({ id }: { id: string }) {
  const [token] = useState(deviceToken);
  const [view, setView] = useState<MissionView | null>(null);
  const [mine, setMine] = useState<Mine>({});
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    void fetchMission(id, token).then((r) => {
      if (stop) return;
      if (!r) return setMissing(true);
      const { mine, ...v } = r;
      setView(v as MissionView);
      setMine(mine ?? {});
    });
    return () => {
      stop = true;
    };
  }, [id, token]);

  return (
    <main className="glow-bg flex min-h-[100dvh] flex-col px-6 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold">
          🔨 Leilão <span className="text-gold">VRIO</span>
        </span>
        <span className="rounded-full bg-violet/30 px-3 py-1 text-sm font-semibold ring-1 ring-violet/60">Missão {id}</span>
      </div>
      {missing && <p className="mt-16 text-center text-xl">Missão não encontrada. Confira o QR no telão.</p>}
      {!missing && !view && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
      {view && !isVote(view) && <CloudForm id={id} token={token} question={view.question} remaining={mine.remaining ?? TEXT_LIMITS.perToken} />}
      {view && isVote(view) && <VoteForm id={id} token={token} view={view} initial={mine.votes ?? view.items.map(() => null)} />}
    </main>
  );
}

function CloudForm({ id, token, question, remaining: initial }: { id: string; token: string; question: string; remaining: number }) {
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || text.trim().length < TEXT_LIMITS.min) return;
    setBusy(true);
    setError('');
    const res = await sendMission(id, { token, text });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Não deu para enviar.');
    setRemaining(res.remaining ?? remaining - 1);
    setSent(true);
    setText('');
    navigator.vibrate?.(20);
  }

  return (
    <div className="mt-8 flex flex-1 flex-col">
      <h1 className="font-display text-3xl font-bold leading-tight">{question}</h1>
      {sent && (
        <div className="animate-pop mt-6 rounded-2xl bg-neon/15 p-4 text-neon ring-1 ring-neon/40">
          <p className="font-display text-xl font-bold">Valeu! Fica de olho no telão 👀</p>
          <p className="mt-1 text-sm text-white/75">
            {remaining > 0 ? `Você ainda pode mandar ${remaining} ${remaining === 1 ? 'resposta' : 'respostas'}.` : 'Você já mandou todas as suas respostas.'}
          </p>
        </div>
      )}
      {remaining > 0 ? (
        <form onSubmit={submit} className="mt-6 flex flex-col">
          <input
            autoFocus={!sent}
            value={text}
            maxLength={TEXT_LIMITS.max}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="send"
            placeholder="Sua resposta"
            className="rounded-2xl bg-white/10 px-5 py-4 text-2xl font-semibold ring-2 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-violet"
          />
          <div className="mt-1 flex justify-between text-xs text-white/40">
            <span>
              {remaining} de {TEXT_LIMITS.perToken} {remaining === 1 ? 'resposta restante' : 'respostas restantes'}
            </span>
            <span className="tnum">
              {text.length}/{TEXT_LIMITS.max}
            </span>
          </div>
          {error && <p className="mt-3 rounded-xl bg-alert/15 px-4 py-3 text-alert">{error}</p>}
          <button
            disabled={busy || text.trim().length < TEXT_LIMITS.min}
            className="mt-5 rounded-2xl bg-gold py-5 font-display text-2xl font-bold text-ink active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      ) : (
        !sent && <p className="mt-6 rounded-2xl bg-white/5 p-4 text-white/70">Você já mandou suas {TEXT_LIMITS.perToken} respostas. Obrigado!</p>
      )}
    </div>
  );
}

function VoteForm({ id, token, view, initial }: { id: string; token: string; view: Extract<MissionView, { kind: 'votacao' }>; initial: (number | null)[] }) {
  const [votes, setVotes] = useState(initial);
  const [error, setError] = useState('');

  async function vote(item: number, option: number) {
    setError('');
    const prev = votes;
    setVotes((v) => v.map((x, i) => (i === item ? option : x)));
    navigator.vibrate?.(15);
    const res = await sendMission(id, { token, item, option });
    if (!res.ok) {
      setVotes(prev);
      setError(res.error ?? 'Não deu para votar.');
    }
  }

  const done = votes.every((v) => v !== null);
  return (
    <div className="mt-6 flex flex-1 flex-col">
      <h1 className="font-display text-3xl font-bold leading-tight">{view.question}</h1>
      <div className="mt-5 space-y-4">
        {view.items.map((item, i) => (
          <div key={i} className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            {view.items.length > 1 && (
              <p className="text-lg font-semibold leading-snug">
                <span className="text-white/40">{i + 1}.</span> {item.text}
              </p>
            )}
            <div className={`mt-3 grid gap-2 ${item.options.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {item.options.map((o, k) => (
                <button
                  key={k}
                  onClick={() => void vote(i, k)}
                  className={`rounded-2xl px-4 py-3.5 font-display text-xl font-bold transition active:scale-95 ${
                    votes[i] === k ? 'bg-violet text-white ring-2 ring-white/70' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {votes[i] === k && '✓ '}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 rounded-xl bg-alert/15 px-4 py-3 text-alert">{error}</p>}
      <p className={`mt-5 text-center ${done ? 'text-neon' : 'text-white/50'}`}>
        {done ? 'Votos registrados! Dá para mudar até o professor revelar.' : 'Toque em uma opção para votar.'}
      </p>
    </div>
  );
}

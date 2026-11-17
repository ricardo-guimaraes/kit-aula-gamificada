import { useEffect, useState } from 'react';
import { adminMission, getAdminKey, isVote, listMissions, setAdminKey, type MissionView } from '../lib/api.ts';
import { emitAck, socket } from '../lib/socket.ts';
import { VoteBars } from './mission.tsx';

type Item = { id: string; kind: 'nuvem' | 'votacao'; question: string };

/** Painel do professor no telão: acompanha as missões, oculta palavras e zera antes da aula. */
export function MissionsPanel({ onClose }: { onClose: () => void }) {
  const [missions, setMissions] = useState<Item[]>([]);
  const [id, setId] = useState('1');
  const [view, setView] = useState<MissionView | null>(null);
  const [msg, setMsg] = useState('');
  const [askKey, setAskKey] = useState(false);
  const [key, setKey] = useState(getAdminKey);

  useEffect(() => {
    void listMissions().then(setMissions);
  }, []);

  useEffect(() => {
    setView(null);
    const onState = (p: { id: string; view: MissionView }) => p.id === id && setView(p.view);
    socket.on('missao:state', onState);
    void emitAck<{ view: MissionView }>('missao:watch', { id }).then((r) => r.ok && setView(r.view));
    return () => {
      socket.off('missao:state', onState);
    };
  }, [id]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  async function admin(action: 'limpar' | 'ocultar', target: string, text?: string) {
    const r = await adminMission(target, action, text);
    if (r.status === 403) {
      setAskKey(true);
      return setMsg('Digite a chave do professor (ADMIN_KEY).');
    }
    setMsg(r.ok ? (action === 'limpar' ? `Missão ${target} zerada.` : `"${text}" oculta.`) : (r.error ?? 'Não deu certo.'));
  }

  async function clearAll() {
    if (!window.confirm('Zerar TODAS as missões? As respostas somem.')) return;
    for (const m of missions) await admin('limpar', m.id);
    setMsg('Todas as missões foram zeradas.');
  }

  const tab = 'rounded-xl px-4 py-2 text-lg font-semibold transition';
  const btn = 'rounded-xl bg-white/10 px-4 py-2 text-lg font-semibold ring-1 ring-white/10 hover:bg-white/15';

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[760px] w-[1240px] flex-col rounded-[32px] bg-ink-2 p-8 shadow-2xl ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-4xl font-bold">🗳️ Missões ao vivo</h2>
          <button className={btn} onClick={onClose}>
            Fechar ✕
          </button>
        </div>
        <div className="mt-5 flex gap-2">
          {missions.map((m) => (
            <button key={m.id} className={`${tab} ${m.id === id ? 'bg-violet text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`} onClick={() => setId(m.id)}>
              Missão {m.id} · {m.kind === 'nuvem' ? 'nuvem' : 'votação'}
            </button>
          ))}
        </div>
        <p className="mt-4 text-2xl text-white/80">{missions.find((m) => m.id === id)?.question}</p>
        <p className="text-lg text-white/50">
          {view ? `${view.total} ${isVote(view) ? 'pessoas votaram' : 'respostas'}` : 'Carregando…'} · celular: {window.location.host}/m/{id}
        </p>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-black/25 p-5 ring-1 ring-white/10">
          {view && isVote(view) && <VoteBars view={view} scale={1.15} />}
          {view && !isVote(view) && (
            <ul className="grid grid-cols-3 gap-2">
              {view.words.map((w) => (
                <li key={w.text} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xl font-semibold">{w.text}</span>
                  <span className="text-lg text-white/50 tnum">{w.count}</span>
                  <button className="rounded-lg bg-alert/20 px-2 py-1 text-sm font-semibold text-alert hover:bg-alert/40" onClick={() => admin('ocultar', id, w.text)}>
                    Ocultar
                  </button>
                </li>
              ))}
              {view.words.length === 0 && <li className="col-span-3 text-xl text-white/40">Nenhuma resposta ainda.</li>}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            className="rounded-xl bg-alert px-5 py-2.5 text-lg font-bold"
            onClick={() => window.confirm(`Zerar a missão ${id}?`) && void admin('limpar', id)}
          >
            Zerar missão {id}
          </button>
          <button className={btn} onClick={() => void clearAll()}>
            Zerar todas (antes da aula)
          </button>
          <a className={btn} href={`/m/${id}/tela`} target="_blank" rel="noreferrer">
            Tela cheia ↗
          </a>
          {askKey && (
            <form
              className="ml-auto flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setAdminKey(key);
                setAskKey(false);
                setMsg('Chave salva. Tente de novo.');
              }}
            >
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="ADMIN_KEY"
                className="w-56 rounded-xl bg-white/10 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-violet"
              />
              <button className={btn}>Salvar</button>
            </form>
          )}
          {msg && !askKey && <span className="ml-auto text-lg text-gold">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Mascot } from '../components/ui.tsx';
import { adminStatus, getAdminKey, setAdminKey } from '../lib/api.ts';
import { emitAck } from '../lib/socket.ts';

/** /professor: cria a sala. Com ADMIN_KEY no servidor, pede a chave uma vez e guarda no navegador. */
export default function Home() {
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [key, setKey] = useState(getAdminKey);
  const [needKey, setNeedKey] = useState(false);

  useEffect(() => {
    void adminStatus().then((s) => setNeedKey(s.required && !s.valid));
  }, []);

  async function create() {
    setBusy(true);
    setError('');
    if (needKey) {
      const s = await adminStatus(key);
      if (!s.valid) {
        setBusy(false);
        return setError('Chave do professor inválida.');
      }
      setAdminKey(key);
      setNeedKey(false);
    }
    const res = await emitAck<{ code: string; secret: string }>('host:create', { short, adminKey: key });
    if (!res.ok) {
      setBusy(false);
      if (res.code === 'forbidden') setNeedKey(true);
      return setError(res.error);
    }
    try {
      localStorage.setItem(`vrio:host:${res.code}`, res.secret);
    } catch {
      /* modo privado */
    }
    window.location.href = `/host/${res.code}?k=${encodeURIComponent(res.secret)}`;
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(c)) window.location.href = `/${c}`;
  }

  return (
    <main className="glow-bg min-h-full overflow-hidden">
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-6 px-5 py-10 md:grid-cols-[1fr_420px]">
        <section>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-violet-2">Aula de estratégia · modelo VRIO</p>
          <h1 className="mt-3 font-display text-6xl font-bold leading-[0.95] md:text-8xl">
            Leilão <span className="text-gold">VRIO</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-white/75">
            Case: a guerra do streaming. Cada aluno é CEO de uma startup e disputa recursos pelo celular sem saber quanto cada um vale. No fim, o
            VRIO revela quem montou vantagem de verdade. As unidades de cada lote crescem com o tamanho da turma.
          </p>

          <div className="mt-8 max-w-lg rounded-3xl bg-ink-2/80 p-5 ring-1 ring-line backdrop-blur">
            <p className="mb-3 text-sm font-semibold text-white/60">Duração da partida</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: false, t: 'Completa', d: '10 lotes · ~13 min' },
                { v: true, t: 'Curta', d: '8 lotes · ~10 min' },
              ].map((o) => (
                <button
                  key={o.t}
                  onClick={() => setShort(o.v)}
                  className={`rounded-2xl px-4 py-3 text-left ring-2 transition ${short === o.v ? 'bg-violet/20 ring-violet' : 'bg-white/5 ring-transparent hover:bg-white/10'}`}
                >
                  <span className="block font-display text-lg font-bold">{o.t}</span>
                  <span className="text-sm text-white/60">{o.d}</span>
                </button>
              ))}
            </div>
            {needKey && (
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Chave do professor (ADMIN_KEY)"
                aria-label="Chave do professor"
                className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-lg ring-2 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-violet"
              />
            )}
            <button
              onClick={create}
              disabled={busy || (needKey && !key)}
              className="mt-4 w-full rounded-2xl bg-gold py-4 font-display text-2xl font-bold text-ink shadow-[0_8px_30px_rgb(255_200_61/0.35)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? 'Criando…' : 'Criar sala 🔨'}
            </button>
            {error && <p className="mt-3 text-sm text-alert">{error}</p>}
            <p className="mt-3 text-xs text-white/50">Abre o telão para o projetor. Guarde o link: só ele controla a partida.</p>
          </div>

          <form onSubmit={join} className="mt-6 flex max-w-lg items-center gap-3">
            <span className="text-sm text-white/60">É aluno?</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase())}
              placeholder="CÓDIGO"
              aria-label="Código da sala"
              className="w-32 rounded-xl bg-white/10 px-3 py-2 text-center font-display text-xl font-bold tracking-[0.3em] placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet"
            />
            <button disabled={code.length !== 4} className="rounded-xl bg-violet px-4 py-2 font-semibold disabled:opacity-40">
              Entrar
            </button>
          </form>
        </section>

        <div className="relative hidden justify-center md:flex">
          <Mascot pose="podio" alt="Professor leiloeiro" className="animate-float max-h-[78vh] w-auto drop-shadow-[0_20px_60px_rgb(124_58_237/0.5)]" />
        </div>
      </div>
    </main>
  );
}

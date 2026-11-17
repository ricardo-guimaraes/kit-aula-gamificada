import { useEffect, useState } from 'react';
import { Mascot } from '../components/ui.tsx';

/** Raiz "/": é para onde o QR do deck aponta. Leva o aluno direto para a sala do professor. */
export default function Entry() {
  const [waiting, setWaiting] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const { code } = await (await fetch('/api/sala-atual', { cache: 'no-store' })).json();
        if (code && !stop) return window.location.replace(`/${code}`);
      } catch {
        /* sem rede: tenta de novo */
      }
      if (stop) return;
      setWaiting(true);
      timer = setTimeout(check, 3000);
    };
    void check();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (/^[A-Z]{4}$/.test(code)) window.location.href = `/${code}`;
  }

  return (
    <main className="glow-bg flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 text-center">
      <span className="font-display text-xl font-bold">
        🔨 Leilão <span className="text-gold">VRIO</span>
      </span>
      <Mascot pose="moeda" className="mt-4 h-56 w-56 object-contain" />
      {waiting ? (
        <>
          <h1 className="mt-2 font-display text-3xl font-bold">O leilão ainda não abriu</h1>
          <p className="mt-2 max-w-xs text-white/70">Deixe esta tela aberta: ela entra sozinha quando o professor abrir a sala.</p>
          <form onSubmit={join} className="mt-8 flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase())}
              placeholder="CÓDIGO"
              aria-label="Código da sala"
              className="w-36 rounded-xl bg-white/10 px-3 py-3 text-center font-display text-xl font-bold tracking-[0.3em] placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet"
            />
            <button disabled={code.length !== 4} className="rounded-xl bg-violet px-5 py-3 font-semibold disabled:opacity-40">
              Entrar
            </button>
          </form>
          <p className="mt-2 text-sm text-white/40">Ou digite o código que aparece no telão.</p>
        </>
      ) : (
        <p className="mt-4 text-white/60">Procurando a sala…</p>
      )}
    </main>
  );
}

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { CloudWords, VoteBars } from '../components/mission.tsx';
import { isVote, type MissionView } from '../lib/api.ts';
import { emitAck, onEveryConnect, socket, useConnected } from '../lib/socket.ts';

/** Tela cheia de reserva da missão (/m/:id/tela), atualizada via Socket.IO. */
export default function MissionScreen({ id }: { id: string }) {
  const [view, setView] = useState<MissionView | null>(null);
  const [missing, setMissing] = useState(false);
  const connected = useConnected();

  useEffect(() => {
    const onState = (p: { id: string; view: MissionView }) => p.id === id && setView(p.view);
    socket.on('missao:state', onState);
    const off = onEveryConnect(async () => {
      const res = await emitAck<{ view: MissionView }>('missao:watch', { id });
      if (res.ok) setView(res.view);
      else setMissing(true);
    });
    return () => {
      socket.off('missao:state', onState);
      off();
    };
  }, [id]);

  const url = `${window.location.origin}/m/${id}`;
  if (missing) return <p className="glow-bg flex h-full items-center justify-center text-3xl">Missão {id} não encontrada.</p>;

  return (
    <main className="glow-bg flex h-full flex-col gap-6 p-[3vw]">
      <header className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="font-display text-[1.6vw] font-semibold uppercase tracking-[0.3em] text-violet-2">Missão {id} · ao vivo</p>
          <h1 className="mt-2 font-display text-[3.4vw] font-bold leading-tight">{view?.question ?? '…'}</h1>
          <p className="mt-2 text-[1.5vw] text-white/60">
            {view ? `${view.total} ${isVote(view) ? (view.total === 1 ? 'pessoa votou' : 'pessoas votaram') : view.total === 1 ? 'resposta' : 'respostas'}` : ''}
            {!connected && <span className="ml-4 text-alert">Reconectando…</span>}
          </p>
        </div>
        <div className="flex flex-none flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={url} size={Math.round(window.innerWidth * 0.11)} marginSize={0} />
          </div>
          <span className="font-display text-[1.2vw] font-bold">{url.replace(/^https?:\/\//, '')}</span>
        </div>
      </header>
      <section className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2vw] bg-black/25 p-[2vw] ring-1 ring-white/10">
        {view && (isVote(view) ? <div className="w-full max-w-[70vw]"><VoteBars view={view} scale={window.innerWidth / 900} /></div> : <CloudWords view={view} scale={window.innerWidth / 1100} />)}
      </section>
    </main>
  );
}

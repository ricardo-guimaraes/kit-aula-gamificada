import { motion } from 'motion/react';
import type { CloudView, VoteView } from '../lib/api.ts';

const COLORS = ['#a78bfa', '#ffc83d', '#22e584', '#60a5fa', '#ffffff', '#ff8a8a'];

/** Nuvem de palavras: tamanho proporcional às respostas. */
export function CloudWords({ view, scale = 1 }: { view: CloudView; scale?: number }) {
  if (!view.words.length)
    return <p className="text-center text-white/40" style={{ fontSize: 22 * scale }}>As respostas aparecem aqui assim que a turma começar a mandar.</p>;
  const max = Math.max(...view.words.map((w) => w.count));
  // alterna as maiores no centro e as menores nas pontas
  const order = view.words.map((w, i) => ({ w, i })).sort((a, b) => (a.i % 2) - (b.i % 2) || a.i - b.i);
  return (
    <div className="flex flex-wrap content-center items-center justify-center gap-x-6 gap-y-2">
      {order.map(({ w, i }) => (
        <motion.span
          key={w.text}
          layout
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="font-display font-bold leading-tight"
          style={{ color: COLORS[i % COLORS.length], fontSize: Math.round((22 + (w.count / max) * 58) * scale) }}
          title={`${w.count}x`}
        >
          {w.text}
        </motion.span>
      ))}
    </div>
  );
}

/** Barras de votação, uma linha por opção. */
export function VoteBars({ view, scale = 1 }: { view: VoteView; scale?: number }) {
  return (
    <div className="flex flex-col" style={{ gap: 22 * scale }}>
      {view.items.map((item, i) => {
        const total = item.options.reduce((a, o) => a + o.count, 0);
        return (
          <div key={i}>
            {view.items.length > 1 && (
              <p className="mb-1.5 font-semibold text-white/85" style={{ fontSize: 18 * scale }}>
                {i + 1}. {item.text}
              </p>
            )}
            <div className="flex flex-col" style={{ gap: 6 * scale }}>
              {item.options.map((o, k) => {
                const pct = total ? Math.round((o.count / total) * 100) : 0;
                return (
                  <div key={k} className="flex items-center" style={{ gap: 12 * scale, fontSize: 18 * scale }}>
                    <span className="w-[30%] flex-none truncate font-display font-bold">{o.label}</span>
                    <span className="h-[1.1em] flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.i
                        className="block h-full rounded-full"
                        style={{ background: COLORS[k % COLORS.length] }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </span>
                    <span className="w-[4ch] flex-none text-right font-display font-bold tnum">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-white/50" style={{ fontSize: 16 * scale }}>
        {view.total} {view.total === 1 ? 'pessoa votou' : 'pessoas votaram'}
      </p>
    </div>
  );
}

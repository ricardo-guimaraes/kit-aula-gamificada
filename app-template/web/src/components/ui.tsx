import type { Label } from '../../../shared/types.ts';
import { LABEL_STYLE, vrioAnswers } from '../lib/hooks.ts';

export type MascotPose = 'moeda' | 'podio' | 'martelada' | 'replay';

export function Mascot({ pose, className = '', alt = '' }: { pose: MascotPose; className?: string; alt?: string }) {
  return <img src={`/mascote/${pose}.webp`} alt={alt} draggable={false} className={`pointer-events-none select-none ${className}`} />;
}

export function LabelBadge({ label, size = 'md' }: { label: Label; size?: 'sm' | 'md' | 'lg' }) {
  const s = LABEL_STYLE[label];
  const sz = size === 'lg' ? 'text-3xl px-6 py-2' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-base px-3 py-1';
  return <span className={`inline-block rounded-full font-display font-bold ${s.bg} ${s.text} ${sz}`}>{s.short}</span>;
}

const VRIO = [
  ['V', 'Valioso?'],
  ['R', 'Raro?'],
  ['I', 'Difícil de imitar?'],
  ['O', 'Organizado para explorar?'],
] as const;

export function VrioStrip({ label, reorganized = false, size = 'md' }: { label: Label; reorganized?: boolean; size?: 'md' | 'lg' }) {
  const answers = vrioAnswers(label, reorganized);
  const big = size === 'lg';
  return (
    <div className={`flex ${big ? 'gap-3' : 'gap-1.5'}`}>
      {VRIO.map(([letter, q], i) => {
        const a = answers[i];
        const cls = a === true ? 'bg-neon/15 text-neon ring-neon/50' : a === false ? 'bg-alert/15 text-alert ring-alert/60' : 'bg-white/5 text-white/25 ring-white/10';
        return (
          <div key={letter} className={`flex flex-1 flex-col items-center rounded-xl ring-1 ${cls} ${big ? 'px-3 py-2' : 'px-1.5 py-1'}`}>
            <span className={`font-display font-bold ${big ? 'text-4xl' : 'text-lg'}`}>
              {letter}
              <span className={big ? 'ml-1 text-2xl' : 'ml-0.5 text-sm'}>{a === true ? '✓' : a === false ? '✗' : '–'}</span>
            </span>
            {big && <span className="mt-0.5 text-center text-sm leading-tight text-white/70">{q}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Anel de contagem regressiva em SVG. */
export function CountdownRing({ ms, totalMs, size = 220, stroke = 16, paused = false }: { ms: number; totalMs: number; size?: number; stroke?: number; paused?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, ms / totalMs));
  const secs = Math.ceil(ms / 1000);
  const urgent = ms <= 5000;
  const color = paused ? '#9a9ab8' : urgent ? '#FF4D4F' : '#7C3AED';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#2e2e4d" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display font-bold tnum leading-none ${urgent && !paused ? 'text-alert' : 'text-white'}`} style={{ fontSize: size * 0.38 }}>
          {paused ? '⏸' : secs}
        </span>
        {!paused && <span className="text-muted" style={{ fontSize: size * 0.08 }}>segundos</span>}
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/15 border-t-violet" />;
}

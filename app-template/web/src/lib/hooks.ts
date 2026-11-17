import { useEffect, useState } from 'react';
import type { Label, RoomState } from '../../../shared/types.ts';
import { serverNow } from './socket.ts';

/** Re-renderiza a cada `ms` milissegundos. */
export function useTicker(ms = 100) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Milissegundos restantes na fase cronometrada atual. */
export function remainingMs(state: Pick<RoomState, 'paused' | 'remainingMs' | 'endsAt'>): number {
  if (state.paused) return state.remainingMs;
  return Math.max(0, state.endsAt - serverNow());
}

export const mi = (n: number) => `R$ ${n.toLocaleString('pt-BR')} mi`;

export const LABEL_STYLE: Record<Label, { bg: string; text: string; ring: string; short: string }> = {
  Sustentável: { bg: 'bg-neon', text: 'text-ink', ring: 'ring-neon', short: 'Vantagem sustentável' },
  Temporária: { bg: 'bg-gold', text: 'text-ink', ring: 'ring-gold', short: 'Vantagem temporária' },
  Paridade: { bg: 'bg-slate-400', text: 'text-ink', ring: 'ring-slate-400', short: 'Paridade competitiva' },
  Desvantagem: { bg: 'bg-alert', text: 'text-white', ring: 'ring-alert', short: 'Desvantagem competitiva' },
  'Não explorada': { bg: 'bg-violet', text: 'text-white', ring: 'ring-violet', short: 'Vantagem não explorada' },
};

/** As 4 perguntas do VRIO para cada classificação: true = sim, false = não, null = nem chega a perguntar. */
export function vrioAnswers(label: Label, reorganized = false): (boolean | null)[] {
  switch (label) {
    case 'Sustentável':
      return [true, true, true, true];
    case 'Temporária':
      return [true, true, false, null];
    case 'Paridade':
      return [true, false, null, null];
    case 'Desvantagem':
      return [false, null, null, null];
    case 'Não explorada':
      return [true, true, true, reorganized];
  }
}

export const ordinal = (n: number) => `${n}º`;

export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

// Tipos compartilhados entre servidor e front. Nada aqui é secreto:
// a classificação e os pontos dos lotes ficam só em server/src/lots.ts.

export type Phase = 'lobby' | 'intro' | 'bidding' | 'sold' | 'offer' | 'reveal' | 'podium';

export type Label = 'Sustentável' | 'Temporária' | 'Paridade' | 'Desvantagem' | 'Não explorada';

export const INCREMENTS = [5, 10, 20] as const;
export type Increment = (typeof INCREMENTS)[number];

export const START_BUDGET = 100;
export const NAME_MAX = 16;

/** Etapas da introdução no telão: case, missão e dinâmica. */
export const INTRO_STEPS = 3;

/** Unidades à venda por lote: ~80% dos jogadores conseguem comprar algo ao longo do jogo. */
export const UNITS_MIN = 1;
export const UNITS_MAX = 6;
export function unitsFor(players: number, lotCount: number): number {
  const k = Math.round((players * 0.8) / Math.max(1, lotCount));
  return Math.min(UNITS_MAX, Math.max(UNITS_MIN, k));
}

export type PublicLot = { id: number; icon: string; name: string; pitch: string };

export type SecretInfo = {
  label: Label;
  points: number;
  revealText: string;
  reorgCost?: number;
  reorgPoints?: number;
};

export type PublicPlayer = { id: string; name: string; connected: boolean };

/** Um dos lances que está levando uma unidade agora. */
export type WinningBid = { playerId: string; name: string; amount: number };

export type Winner = { playerId: string; name: string; price: number };

export type PublicResult = {
  lotIndex: number;
  lot: PublicLot;
  winners: Winner[];
  skipped: boolean;
};

export type RevealedWinner = Winner & { reorganized: boolean; points: number };

/** Carta já revelada: só existe no estado a partir da revelação. */
export type RevealedCard = Omit<PublicResult, 'winners'> & {
  winners: RevealedWinner[];
  secret: SecretInfo;
};

export type Standing = {
  playerId: string;
  name: string;
  points: number;
  budget: number;
  spent: number;
  rank: number;
};

export type Awards = {
  bestDeal: { playerId: string; name: string; points: number; spent: number; ratio: number } | null;
  biggestFlop: { playerId: string; name: string; spent: number } | null;
};

export type BidFeedItem = { name: string; amount: number; at: number };

export type RoomState = {
  code: string;
  phase: Phase;
  locked: boolean;
  introStep: number;
  lotCount: number;
  /** Unidades à venda em cada lote (calculado pelo nº de jogadores até o leilão começar). */
  units: number;
  /** Índice (0-based) do lote em leilão ou do último lote leiloado. */
  lotIndex: number;
  lot: PublicLot | null;
  /** Lances que estão levando uma unidade agora, do maior para o menor. */
  winning: WinningBid[];
  /** Base dos botões +5/+10/+20: 0 se ainda há vaga, senão o menor lance vencedor. */
  cutoff: number;
  /** Fim da fase cronometrada atual (bidding, sold, offer), no relógio do servidor. */
  endsAt: number;
  serverNow: number;
  paused: boolean;
  remainingMs: number;
  bidFeed: BidFeedItem[];
  players: PublicPlayer[];
  results: PublicResult[];
  /** Quantos arrematantes receberam a proposta secreta. */
  offerCount: number;
  /** Quantas cartas já foram reveladas. */
  revealIndex: number;
  revealed: RevealedCard[];
  standings: Standing[] | null;
  awards: Awards | null;
};

export type MyLot = {
  lotIndex: number;
  lot: PublicLot;
  price: number;
  reorganized: boolean;
  /** Só presentes depois que a carta foi revelada. */
  secret?: SecretInfo;
  points?: number;
};

export type PrivateState = {
  playerId: string;
  name: string;
  budget: number;
  spent: number;
  myLots: MyLot[];
  offer: { endsAt: number; cost: number; answered: boolean } | null;
  /** Pontos já revelados. */
  points: number;
  finalRank: number | null;
  totalPlayers: number;
};

export type HostAction =
  | 'next'
  | 'back'
  | 'pause'
  | 'resume'
  | 'togglePause'
  | 'addTime'
  | 'skip'
  | 'lock'
  | 'kick'
  | 'restart';

export type AckError = { ok: false; error: string; code?: string; suggestion?: string };
export type Ack<T = object> = ({ ok: true } & T) | AckError;

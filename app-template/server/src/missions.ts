// Modo Missão: nuvem de palavras e votação ao vivo, sem login, substituindo o
// Mentimeter. Lógica pura e em memória, separada do leilão (reiniciar um não
// afeta o outro). Quem expõe as rotas é http.ts.
import type { AckError } from '../../shared/types.ts';
import { isProfane } from './words.ts';

export const TEXT_MIN = 2;
export const TEXT_MAX = 24;
export const MAX_PER_TOKEN = 3;
export const COOLDOWN_MS = 3000;
export const MAX_WORDS = 40;

export type CloudDef = { kind: 'nuvem'; question: string };
export type VoteDef = { kind: 'votacao'; question: string; items: { text: string; options: string[] }[] };
export type MissionDef = CloudDef | VoteDef;

/** Perguntas das missões. A ordem segue o deck (aula-vrio.html). */
export const MISSIONS: Record<string, MissionDef> = {
  '1': { kind: 'nuvem', question: 'Qual marca você usa e acha impossível de copiar?' },
  '2': {
    kind: 'votacao',
    question: 'Quiz relâmpago: item ou skill?',
    items: [
      { text: '2,35 bilhões de aparelhos Apple ativos', options: ['Item', 'Skill'] },
      { text: 'Transformar dados de escuta no Wrapped que vira trend todo ano', options: ['Item', 'Skill'] },
      { text: 'O caixa de uma empresa', options: ['Item', 'Skill'] },
      { text: 'O jeito como a Starbucks treina baristas', options: ['Item', 'Skill'] },
    ],
  },
  '3': { kind: 'nuvem', question: 'De qual compra você se arrepende, ou qual lote deveria ter comprado?' },
  '4': {
    kind: 'votacao',
    question: 'Na sua ficha de personagem, qual letra você mais precisa subir?',
    items: [{ text: 'Qual letra você precisa subir?', options: ['V · Valor', 'R · Raridade', 'I · Imitabilidade', 'O · Organização'] }],
  },
};

type Group = { count: number; spellings: Map<string, number>; firstAt: number };
type CloudState = { kind: 'nuvem'; groups: Map<string, Group>; hidden: Set<string>; tokens: Map<string, { count: number; last: number }> };
type VoteState = { kind: 'votacao'; votes: Map<string, (number | null)[]>; last: Map<string, number> };
type State = CloudState | VoteState;

export type CloudView = { question: string; total: number; words: { text: string; count: number }[] };
export type VoteView = {
  kind: 'votacao';
  question: string;
  /** Pessoas que votaram em pelo menos um item. */
  total: number;
  items: { text: string; options: { label: string; count: number }[] }[];
};
export type MissionView = CloudView | VoteView;

const states = new Map<string, State>();

const err = (error: string, code?: string): AckError => ({ ok: false, error, code });

/** Chave de agrupamento: ignora maiúsculas, acentos e espaços nas pontas. */
export function normKey(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

const cleanText = (raw: unknown) =>
  String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const validToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(t);

export function getDef(id: string): MissionDef | undefined {
  return Object.hasOwn(MISSIONS, id) ? MISSIONS[id] : undefined;
}

function stateOf(id: string, def: MissionDef): State {
  let st = states.get(id);
  if (!st) {
    st =
      def.kind === 'nuvem'
        ? { kind: 'nuvem', groups: new Map(), hidden: new Set(), tokens: new Map() }
        : { kind: 'votacao', votes: new Map(), last: new Map() };
    states.set(id, st);
  }
  return st;
}

export function submitText(id: string, token: unknown, rawText: unknown, now = Date.now()): { ok: true; remaining: number } | AckError {
  const def = getDef(id);
  if (!def) return err('Missão não encontrada.', 'nomission');
  if (def.kind !== 'nuvem') return err('Esta missão é de votação.', 'kind');
  if (!validToken(token)) return err('Recarregue a página e tente de novo.', 'token');
  const text = cleanText(rawText);
  if (text.length < TEXT_MIN) return err(`Escreva pelo menos ${TEXT_MIN} letras.`, 'short');
  if (text.length > TEXT_MAX) return err(`Use até ${TEXT_MAX} caracteres.`, 'long');
  if (isProfane(text)) return err('Escolha outra resposta, por favor.', 'profane');

  const st = stateOf(id, def) as CloudState;
  const mine = st.tokens.get(token) ?? { count: 0, last: -Infinity };
  if (mine.count >= MAX_PER_TOKEN) return err(`Você já mandou ${MAX_PER_TOKEN} respostas.`, 'limit');
  if (now - mine.last < COOLDOWN_MS) return err('Calma! Espere uns segundos para mandar outra.', 'rate');

  const key = normKey(text);
  const g = st.groups.get(key) ?? { count: 0, spellings: new Map(), firstAt: now };
  g.count++;
  g.spellings.set(text, (g.spellings.get(text) ?? 0) + 1);
  st.groups.set(key, g);
  st.tokens.set(token, { count: mine.count + 1, last: now });
  return { ok: true, remaining: MAX_PER_TOKEN - mine.count - 1 };
}

export function submitVote(
  id: string,
  token: unknown,
  item: unknown,
  option: unknown,
  now = Date.now(),
): { ok: true; votes: (number | null)[] } | AckError {
  const def = getDef(id);
  if (!def) return err('Missão não encontrada.', 'nomission');
  if (def.kind !== 'votacao') return err('Esta missão é de texto.', 'kind');
  if (!validToken(token)) return err('Recarregue a página e tente de novo.', 'token');
  const i = Number(item);
  const o = Number(option);
  if (!Number.isInteger(i) || i < 0 || i >= def.items.length) return err('Item inválido.', 'invalid');
  if (!Number.isInteger(o) || o < 0 || o >= def.items[i].options.length) return err('Opção inválida.', 'invalid');

  const st = stateOf(id, def) as VoteState;
  // Trocar de voto é permitido; só barramos cliques em rajada.
  if (now - (st.last.get(token) ?? -Infinity) < 300) return err('Calma!', 'rate');
  const votes = st.votes.get(token) ?? def.items.map(() => null);
  votes[i] = o;
  st.votes.set(token, votes);
  st.last.set(token, now);
  return { ok: true, votes: [...votes] };
}

function displayText(g: Group): string {
  let best = '';
  let bestN = -1;
  for (const [t, n] of g.spellings) if (n > bestN) [best, bestN] = [t, n]; // empate: a grafia que chegou primeiro
  return best;
}

export function viewOf(id: string): MissionView | undefined {
  const def = getDef(id);
  if (!def) return undefined;
  const st = stateOf(id, def);
  if (st.kind === 'nuvem') {
    const visible = [...st.groups.entries()].filter(([k]) => !st.hidden.has(k));
    const words = visible
      .sort(([, a], [, b]) => b.count - a.count || a.firstAt - b.firstAt)
      .slice(0, MAX_WORDS)
      .map(([, g]) => ({ text: displayText(g), count: g.count }));
    return { question: def.question, total: visible.reduce((a, [, g]) => a + g.count, 0), words };
  }
  const d = def as VoteDef;
  const items = d.items.map((it, i) => ({
    text: it.text,
    options: it.options.map((label, o) => ({ label, count: [...st.votes.values()].filter((v) => v[i] === o).length })),
  }));
  return { kind: 'votacao', question: d.question, total: st.votes.size, items };
}

/** O que o celular desse token já fez (respostas restantes ou votos dados). */
export function mineOf(id: string, token: unknown): { remaining?: number; votes?: (number | null)[] } {
  const def = getDef(id);
  if (!def || !validToken(token)) return {};
  const st = stateOf(id, def);
  if (st.kind === 'nuvem') return { remaining: MAX_PER_TOKEN - (st.tokens.get(token)?.count ?? 0) };
  return { votes: st.votes.get(token) ?? (def as VoteDef).items.map(() => null) };
}

export function clearMission(id: string): boolean {
  if (!getDef(id)) return false;
  states.delete(id);
  return true;
}

/** Esconde da nuvem todas as grafias equivalentes a `text`. */
export function hideWord(id: string, text: unknown): boolean {
  const def = getDef(id);
  if (!def || def.kind !== 'nuvem') return false;
  const st = stateOf(id, def) as CloudState;
  const key = normKey(cleanText(text));
  if (!key) return false;
  st.hidden.add(key);
  return true;
}

export function missionList() {
  return Object.entries(MISSIONS).map(([id, d]) => ({ id, kind: d.kind, question: d.question }));
}

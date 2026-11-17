// Chamadas HTTP do modo Missão e da área do professor.

export type CloudView = { question: string; total: number; words: { text: string; count: number }[] };
export type VoteView = { kind: 'votacao'; question: string; total: number; items: { text: string; options: { label: string; count: number }[] }[] };
export type MissionView = CloudView | VoteView;
export type Mine = { remaining?: number; votes?: (number | null)[] };

export const isVote = (v: MissionView): v is VoteView => 'items' in v;

function store(key: string, value?: string | null): string {
  try {
    if (value === null) localStorage.removeItem(key);
    else if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key) ?? '';
  } catch {
    return value ?? '';
  }
}

export const getAdminKey = () => store('vrio:adminKey');
export const setAdminKey = (k: string) => store('vrio:adminKey', k || null);

/** Um token por aparelho, guardado no localStorage (sem login). */
export function deviceToken(): string {
  let t = store('vrio:missao-token');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(t)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    t = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    store('vrio:missao-token', t);
  }
  return t;
}

async function json<T>(res: Response): Promise<T & { ok?: boolean; error?: string }> {
  try {
    return await res.json();
  } catch {
    return { ok: false, error: 'Resposta inválida do servidor.' } as T & { ok: boolean; error: string };
  }
}

export async function fetchMission(id: string, token?: string) {
  const res = await fetch(`/api/missao/${encodeURIComponent(id)}${token ? `?token=${token}` : ''}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return json<MissionView & { mine?: Mine }>(res);
}

export async function sendMission(id: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`/api/missao/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return json<{ ok: boolean; error?: string; remaining?: number; votes?: (number | null)[] }>(res);
  } catch {
    return { ok: false, error: 'Sem conexão. Tente de novo.' };
  }
}

export async function adminMission(id: string, action: 'limpar' | 'ocultar', text?: string) {
  const res = await fetch(`/api/missao/${encodeURIComponent(id)}/${action}?k=${encodeURIComponent(getAdminKey())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return { status: res.status, ...(await json<{ ok: boolean; error?: string }>(res)) };
}

export async function adminStatus(key = getAdminKey()): Promise<{ required: boolean; valid: boolean }> {
  try {
    return await (await fetch(`/api/admin?k=${encodeURIComponent(key)}`)).json();
  } catch {
    return { required: false, valid: true };
  }
}

export async function listMissions(): Promise<{ id: string; kind: 'nuvem' | 'votacao'; question: string }[]> {
  try {
    return (await (await fetch('/api/missoes')).json()).missions;
  } catch {
    return [];
  }
}

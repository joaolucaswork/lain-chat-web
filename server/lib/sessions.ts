/**
 * Sessões do chat: memória (L1) + Supabase (`chat_sessions`) quando configurado,
 * disco (`SESSIONS_DIR`) como fallback (dev sem secret, testes).
 * A tabela é a fonte única — localhost e VPS leem o mesmo lugar, por isso
 * as conversas sincronizam. Upsert é last-write-wins por (owner, id).
 * O dono (`owner`) é o hash da tenant key (`k-<sha256>`) ou 'owner' (modo legado).
 * Isolamento: getSession/findSession/deleteSession sempre recebem o owner —
 * um visitante nunca abre a sessão de outro (404) nem lista (filtro por dono).
 */
import { readFileSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, chmodSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { DEFAULT_MODEL, SESSIONS_DIR, SYSTEM_PROMPT } from '../config.ts';
import { dropSessionClients } from './sse.ts';
import { OWNER } from './tenant.ts';
import { dbDeleteOwnerSessions, dbDeleteSession, dbFetchSession, dbListSessions, dbUpsertSession, isSessionDbConfigured } from './session-store.ts';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string | null;
}

export interface Session {
  id: string;
  messages: ChatMsg[];
  createdAt: number;
  model: string;
  title?: string;
  favorite?: boolean;
  favoritedAt?: number;
  /** Dono da sessão (hash da tenant key ou 'owner'). Não vai para a UI. */
  owner: string;
}

/** Map por `owner/id` — o mesmo uuid em donos diferentes nunca colide. */
export const sessions = new Map<string, Session>();
export const abortCtrls = new Map<string, AbortController>();

export function sessionKey(owner: string, id: string): string {
  return `${owner}/${id}`;
}

/** Chave do stream SSE (isolamento por dono). */
export function streamKey(session: Pick<Session, 'id' | 'owner'>): string {
  return sessionKey(session.owner, session.id);
}

export function isSafeSessionId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function isSafeOwner(owner: string): boolean {
  if (owner === OWNER) return true;
  if (/^k-[0-9a-f]{16}$/.test(owner)) return true; // legado (pré-slug)
  return /^t-[a-z0-9-]{2,40}$/.test(owner);
}

export function sessionDir(owner: string): string {
  if (owner === OWNER) return SESSIONS_DIR;
  return join(SESSIONS_DIR, owner);
}

export function sessionFile(id: string, owner: string = OWNER): string {
  return join(sessionDir(owner), `${basename(id)}.json`);
}

export function persistSessionDisk(s: Session): void {
  if (!isSafeSessionId(s.id) || !isSafeOwner(s.owner)) return;
  try {
    const dir = sessionDir(s.owner);
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
    const target = sessionFile(s.id, s.owner);
    const temp = `${target}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(s), { encoding: 'utf-8', mode: 0o600 });
    chmodSync(temp, 0o600);
    renameSync(temp, target);
    chmodSync(target, 0o600);
  } catch (err) {
    console.error('[bff] persist session failed:', err instanceof Error ? err.message : err);
  }
}

/** Write-through: memória + Supabase (quando configurado) ou disco. Nunca throw. */
export async function persistSession(s: Session): Promise<void> {
  if (!isSafeSessionId(s.id) || !isSafeOwner(s.owner)) return;
  sessions.set(sessionKey(s.owner, s.id), s);
  if (isSessionDbConfigured()) {
    try {
      await dbUpsertSession(s);
    } catch (err) {
      console.error('[bff] session db upsert failed:', err instanceof Error ? err.message : err);
    }
    return;
  }
  persistSessionDisk(s);
}

function readSessionFile(dir: string, f: string, owner: string): void {
  const id = basename(f, '.json');
  if (!isSafeSessionId(id)) return;
  try {
    const raw = readFileSync(join(dir, f), 'utf-8');
    const s = JSON.parse(raw) as Session;
    if (!s || s.id !== id || !Array.isArray(s.messages)) return;
    const msgs = s.messages.filter(
      (m): m is ChatMsg =>
        !!m && (m.role === 'system' || m.role === 'user' || m.role === 'assistant') &&
        (typeof m.content === 'string' || m.content === null),
    );
    // Refresh prompt antigo: sessões salvas carregam o system congelado.
    if (msgs.length > 0 && msgs[0].role === 'system' && typeof msgs[0].content === 'string' &&
      msgs[0].content.startsWith('You are Lain, a personal assistant')) {
      msgs[0] = { role: 'system', content: SYSTEM_PROMPT };
    }
    sessions.set(sessionKey(owner, id), {
      id,
      messages: msgs,
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
      model: typeof s.model === 'string' && s.model ? s.model : DEFAULT_MODEL,
      title: typeof (s as Partial<Session>).title === 'string' ? ((s as Partial<Session>).title as string).slice(0, 80) || undefined : undefined,
      favorite: (s as Partial<Session>).favorite === true ? true : undefined,
      favoritedAt: typeof (s as Partial<Session>).favoritedAt === 'number' ? (s as Partial<Session>).favoritedAt as number : undefined,
      owner,
    });
  } catch {
    console.error(`[bff] ignoring corrupt session file: ${f}`);
  }
}

export function loadSessionsFromDisk(): void {
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch { return; }
  let loaded = 0;
  // Owner legado (arquivos na raiz).
  try {
    const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    for (const f of files) { readSessionFile(SESSIONS_DIR, f, OWNER); loaded++; }
  } catch (err) {
    console.error('[bff] load sessions failed:', err instanceof Error ? err.message : err);
    return;
  }
  // Visitantes (um subdir por owner).
  try {
    const entries = readdirSync(SESSIONS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || !isSafeOwner(e.name)) continue;
      const dir = join(SESSIONS_DIR, e.name);
      for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        readSessionFile(dir, f, e.name); loaded++;
      }
    }
  } catch { /* sem subdirs = sem visitantes */ }
  // Limpa sessões vazias antigas (só system, sem nenhuma mensagem) — eram as
  // entradas "New conversation" criadas antes do getSession parar de persistir.
  let purged = 0;
  for (const [key, s] of sessions) {
    if (isEmptySession(s)) {
      sessions.delete(key);
      try { unlinkSync(sessionFile(s.id, s.owner)); } catch { /* arquivo pode não existir */ }
      purged++;
    }
  }
  if (loaded > 0) console.log(`[bff] loaded ${loaded} session(s) from ${SESSIONS_DIR}${purged ? ` (purged ${purged} empty)` : ''}`);
}

/** Lê do disco sem tocar no Map (fallback quando o DB não está configurado). */
function readDiskSession(id: string, owner: string): Session | undefined {
  if (!isSafeSessionId(id) || !isSafeOwner(owner)) return undefined;
  try {
    const raw = readFileSync(sessionFile(id, owner), 'utf-8');
    const parsed = JSON.parse(raw) as Session;
    if (!parsed || parsed.id !== id || !Array.isArray(parsed.messages)) return undefined;
    return { ...parsed, owner };
  } catch {
    return undefined;
  }
}

function blankSession(id: string, owner: string): Session {
  return {
    id,
    messages: [{
      role: 'system',
      content: SYSTEM_PROMPT,
    }],
    createdAt: Date.now(),
    model: DEFAULT_MODEL,
    owner,
  };
}

/** Abre (ou cria) a sessão DESTE dono. Nunca retorna sessão alheia. */
export async function getSession(id: string, owner: string = OWNER): Promise<Session> {
  const key = sessionKey(owner, id);
  const hit = sessions.get(key);
  if (hit) return hit;
  if (isSessionDbConfigured()) {
    try {
      const s = await dbFetchSession(owner, id);
      if (s) {
        sessions.set(key, s);
        return s;
      }
    } catch (err) {
      console.error('[bff] session db fetch failed:', err instanceof Error ? err.message : err);
    }
  } else {
    const disk = readDiskSession(id, owner);
    if (disk) {
      sessions.set(key, disk);
      return disk;
    }
  }
  const blank = blankSession(id, owner);
  sessions.set(key, blank);
  // Sessão nova só é persistida na primeira mensagem (POST /api/chat).
  // Persistir aqui criava entradas "New conversation" vazias no histórico
  // só de abrir o app ou clicar no lápis (o SSE/history chamam o get).
  return blank;
}

/** Busca sem criar (SSE/history/retry/patch): null = 404, nunca alheia. */
export async function findSession(id: string, owner: string = OWNER): Promise<Session | undefined> {
  const key = sessionKey(owner, id);
  const s = sessions.get(key);
  if (s) return s;
  if (isSessionDbConfigured()) {
    try {
      const row = await dbFetchSession(owner, id);
      if (row) {
        sessions.set(key, row);
        return row;
      }
    } catch (err) {
      console.error('[bff] session db fetch failed:', err instanceof Error ? err.message : err);
    }
    return undefined;
  }
  // Recarrega do disco do PRÓPRIO dono (restart perdeu o mapa).
  const disk = readDiskSession(id, owner);
  if (disk) sessions.set(key, disk);
  return disk;
}

/** Lista as sessões NÃO vazias deste dono, mais recentes primeiro. */
export async function listSessions(owner: string = OWNER): Promise<Session[]> {
  if (isSessionDbConfigured()) {
    try {
      const rows = await dbListSessions(owner);
      const out = rows.filter((s) => !isEmptySession(s));
      for (const s of out) sessions.set(sessionKey(owner, s.id), s);
      return out.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.error('[bff] session db list failed:', err instanceof Error ? err.message : err);
      return [...sessions.values()].filter((s) => s.owner === owner && !isEmptySession(s))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  }
  return [...sessions.values()].filter((s) => s.owner === owner && !isEmptySession(s))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Sessão sem nenhuma mensagem de usuário/assistente — não aparece na lista. */
export function isEmptySession(s: Session): boolean {
  return !s.messages.some(m => m.role !== 'system' && m.content?.trim());
}

/** Apaga TODAS as sessões de um dono (wipe LGPD: transcripts saem junto). */
export async function deleteOwnerSessions(owner: string): Promise<number> {
  if (!isSafeOwner(owner)) return 0;
  if (isSessionDbConfigured()) {
    for (const [key, s] of sessions) {
      if (s.owner !== owner) continue;
      sessions.delete(key);
      const stream = sessionKey(owner, s.id);
      abortCtrls.get(stream)?.abort();
      abortCtrls.delete(stream);
      dropSessionClients(stream);
    }
    try {
      return await dbDeleteOwnerSessions(owner);
    } catch (err) {
      console.error('[bff] session db wipe failed:', err instanceof Error ? err.message : err);
      return 0;
    }
  }
  let n = 0;
  for (const [key, s] of sessions) {
    if (s.owner !== owner) continue;
    sessions.delete(key);
    const stream = sessionKey(owner, s.id);
    abortCtrls.get(stream)?.abort();
    abortCtrls.delete(stream);
    dropSessionClients(stream);
    try { unlinkSync(sessionFile(s.id, s.owner)); } catch { /* já sumiu */ }
    n++;
  }
  return n;
}

export async function deleteSession(id: string, owner: string = OWNER): Promise<boolean> {
  if (!isSafeSessionId(id) || !isSafeOwner(owner)) return false;
  const existed = sessions.delete(sessionKey(owner, id));
  const stream = sessionKey(owner, id);
  abortCtrls.get(stream)?.abort();
  abortCtrls.delete(stream);
  dropSessionClients(stream);
  if (isSessionDbConfigured()) {
    try {
      // Outro BFF pode ter a sessão em memória: o delete no DB vale mesmo
      // com cache local frio (conversa apagada no celular some no desktop).
      return (await dbDeleteSession(owner, id)) || existed;
    } catch (err) {
      console.error('[bff] session db delete failed:', err instanceof Error ? err.message : err);
      return existed;
    }
  }
  try { unlinkSync(sessionFile(id, owner)); } catch { /* arquivo pode não existir */ }
  return existed;
}

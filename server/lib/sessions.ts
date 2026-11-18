/**
 * Sessões do chat: estado em memória + persistência em disco.
 * Um JSON por sessão em SESSIONS_DIR (owner) ou SESSIONS_DIR/<owner>/ (visitantes).
 * O dono (`owner`) é o hash da tenant key (`k-<sha256>`) ou 'owner' (modo legado).
 * Isolamento: getSession/findSession/deleteSession sempre recebem o owner —
 * um visitante nunca abre a sessão de outro (404) nem lista (filtro por dir).
 * Escrita síncrona (arquivos pequenos, baixo volume) para não perder
 * a mensagem do usuário se o processo cair no meio do stream.
 */
import { readFileSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, chmodSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { DEFAULT_MODEL, SESSIONS_DIR, SYSTEM_PROMPT } from '../config.ts';
import { dropSessionClients } from './sse.ts';
import { OWNER } from './tenant.ts';

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

export function persistSession(s: Session): void {
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
export function getSession(id: string, owner: string = OWNER): Session {
  const key = sessionKey(owner, id);
  let s = sessions.get(key);
  if (!s) {
    s = blankSession(id, owner);
    sessions.set(key, s);
    // Sessão nova só é persistida na primeira mensagem (POST /api/chat).
    // Persistir aqui criava entradas "New conversation" vazias no histórico
    // só de abrir o app ou clicar no lápis (o SSE/history chamam o get).
  }
  return s;
}

/** Busca sem criar (SSE/history/retry/patch): null = 404, nunca alheia. */
export function findSession(id: string, owner: string = OWNER): Session | undefined {
  const key = sessionKey(owner, id);
  const s = sessions.get(key);
  if (s) return s;
  // Recarrega do disco do PRÓPRIO dono (restart perdeu o mapa).
  try {
    const raw = readFileSync(sessionFile(id, owner), 'utf-8');
    const parsed = JSON.parse(raw) as Session;
    if (!parsed || parsed.id !== id || !Array.isArray(parsed.messages)) return undefined;
    const full: Session = { ...parsed, owner };
    sessions.set(key, full);
    return full;
  } catch {
    return undefined;
  }
}

/** Sessão sem nenhuma mensagem de usuário/assistente — não aparece na lista. */
export function isEmptySession(s: Session): boolean {
  return !s.messages.some(m => m.role !== 'system' && m.content?.trim());
}

/** Apaga TODAS as sessões de um dono (wipe LGPD: transcripts saem junto). */
export function deleteOwnerSessions(owner: string): number {
  if (!isSafeOwner(owner)) return 0;
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

export function deleteSession(id: string, owner: string = OWNER): boolean {
  if (!isSafeSessionId(id) || !isSafeOwner(owner)) return false;
  const existed = sessions.delete(sessionKey(owner, id));
  const stream = sessionKey(owner, id);
  abortCtrls.get(stream)?.abort();
  abortCtrls.delete(stream);
  dropSessionClients(stream);
  try { unlinkSync(sessionFile(id, owner)); } catch { /* arquivo pode não existir */ }
  return existed;
}

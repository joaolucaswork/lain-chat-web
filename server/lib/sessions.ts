/**
 * Sessões do chat: estado em memória + persistência em disco.
 * Um JSON por sessão em SESSIONS_DIR — sobrevive a restart do BFF.
 * Escrita síncrona (arquivos pequenos, baixo volume) para não perder
 * a mensagem do usuário se o processo cair no meio do stream.
 */
import { readFileSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, chmodSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { DEFAULT_MODEL, SESSIONS_DIR, SYSTEM_PROMPT } from '../config.ts';
import { dropSessionClients } from './sse.ts';

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
}

export const sessions = new Map<string, Session>();
export const abortCtrls = new Map<string, AbortController>();

export function isSafeSessionId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function sessionFile(id: string): string {
  return join(SESSIONS_DIR, `${basename(id)}.json`);
}

export function persistSession(s: Session): void {
  if (!isSafeSessionId(s.id)) return;
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    chmodSync(SESSIONS_DIR, 0o700);
    const target = sessionFile(s.id);
    const temp = `${target}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(s), { encoding: 'utf-8', mode: 0o600 });
    chmodSync(temp, 0o600);
    renameSync(temp, target);
    chmodSync(target, 0o600);
  } catch (err) {
    console.error('[bff] persist session failed:', err instanceof Error ? err.message : err);
  }
}

export function loadSessionsFromDisk(): void {
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch { return; }
  let files: string[] = [];
  try {
    files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
  } catch (err) {
    console.error('[bff] load sessions failed:', err instanceof Error ? err.message : err);
    return;
  }
  let loaded = 0;
  for (const f of files) {
    const id = basename(f, '.json');
    if (!isSafeSessionId(id)) continue;
    try {
      const raw = readFileSync(join(SESSIONS_DIR, f), 'utf-8');
      const s = JSON.parse(raw) as Session;
      if (!s || s.id !== id || !Array.isArray(s.messages)) continue;
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
      sessions.set(id, {
        id,
        messages: msgs,
        createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
        model: typeof s.model === 'string' && s.model ? s.model : DEFAULT_MODEL,
        title: typeof (s as Partial<Session>).title === 'string' ? ((s as Partial<Session>).title as string).slice(0, 80) || undefined : undefined,
        favorite: (s as Partial<Session>).favorite === true ? true : undefined,
        favoritedAt: typeof (s as Partial<Session>).favoritedAt === 'number' ? (s as Partial<Session>).favoritedAt as number : undefined,
      });
      loaded++;
    } catch {
      console.error(`[bff] ignoring corrupt session file: ${f}`);
    }
  }
  // Limpa sessões vazias antigas (só system, sem nenhuma mensagem) — eram as
  // entradas "New conversation" criadas antes do getSession parar de persistir.
  let purged = 0;
  for (const [id, s] of sessions) {
    if (isEmptySession(s)) {
      sessions.delete(id);
      try { unlinkSync(sessionFile(id)); } catch { /* arquivo pode não existir */ }
      purged++;
    }
  }
  if (loaded > 0) console.log(`[bff] loaded ${loaded} session(s) from ${SESSIONS_DIR}${purged ? ` (purged ${purged} empty)` : ''}`);
}

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = {
      id,
      messages: [{
        role: 'system',
        content: SYSTEM_PROMPT,
      }],
      createdAt: Date.now(),
      model: DEFAULT_MODEL,
    };
    sessions.set(id, s);
    // Sessão nova só é persistida na primeira mensagem (POST /api/chat).
    // Persistir aqui criava entradas "New conversation" vazias no histórico
    // só de abrir o app ou clicar no lápis (o SSE/history chamam getSession).
  }
  return s;
}

/** Sessão sem nenhuma mensagem de usuário/assistente — não aparece na lista. */
export function isEmptySession(s: Session): boolean {
  return !s.messages.some(m => m.role !== 'system' && m.content?.trim());
}

export function deleteSession(id: string): boolean {
  if (!isSafeSessionId(id)) return false;
  const existed = sessions.delete(id);
  abortCtrls.get(id)?.abort();
  abortCtrls.delete(id);
  dropSessionClients(id);
  try { unlinkSync(sessionFile(id)); } catch { /* arquivo pode não existir */ }
  return existed;
}

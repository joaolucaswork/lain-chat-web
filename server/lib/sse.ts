/** Registro de clientes SSE por sessão + broadcast. */
import { sseMsg } from './http.ts';

const sseClients = new Map<string, Set<ReadableStreamDefaultController<string>>>();

export function addSseClient(sessionId: string, ctrl: ReadableStreamDefaultController<string>): void {
  let set = sseClients.get(sessionId);
  if (!set) { set = new Set(); sseClients.set(sessionId, set); }
  set.add(ctrl);
}

export function removeSseClient(sessionId: string, ctrl: ReadableStreamDefaultController<string>): void {
  const set = sseClients.get(sessionId);
  if (!set) return;
  set.delete(ctrl);
  if (set.size === 0) sseClients.delete(sessionId);
}

/** Remove todos os clientes da sessão (ao deletar a sessão). */
export function dropSessionClients(sessionId: string): void {
  sseClients.delete(sessionId);
}

export function broadcast(sessionId: string, event: string, data: unknown): void {
  const clients = sseClients.get(sessionId);
  if (!clients) return;
  const msg = sseMsg(event, data);
  for (const c of clients) {
    try { c.enqueue(msg); } catch { /* closed */ }
  }
}

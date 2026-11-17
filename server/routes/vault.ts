/** Rotas do vault: memórias e grafo via lain-memory (proxy + formato da UI). Key por request. */
import { MEMORY_URL } from '../config.ts';
import { json } from '../lib/http.ts';
import { fetchJson, listVaultMemories, memGetHeaders } from '../lib/memory.ts';
import { memoryKeyForRequest } from '../lib/tenant.ts';

export async function handleVault(req: Request, path: string): Promise<Response | null> {
  const key = memoryKeyForRequest(req);
  // ── Vault: memórias (via lain-memory) ──
  if (req.method === 'GET' && path === '/api/vault/memories') {
    try {
      return json(await listVaultMemories(key));
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  if (req.method === 'GET' && path.startsWith('/api/vault/memory/')) {
    const id = decodeURIComponent(path.slice('/api/vault/memory/'.length));
    try {
      const all = await listVaultMemories(key);
      const found = all.find(m => m.id === id);
      if (!found) return json({ error: 'not found' }, 404);
      const scope = found.project === 'global' ? {} : { project: found.project };
      const full = await fetchJson(`${MEMORY_URL}/api/memory/list`, { ...scope, limit: 500 }, 5000, key)
        .then((d: any[]) => (Array.isArray(d) ? d : []).find((m: any) => m.id === id))
        .catch(() => null);
      const { ...rest } = found;
      return json({ ...rest, file: '', tags: [], body: full?.memory ?? found.preview });
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Vault: feedback (✓/🕐) — proxy para lain-memory ──
  if (req.method === 'POST' && path.startsWith('/api/vault/memory/') && path.endsWith('/feedback')) {
    const id = decodeURIComponent(path.slice('/api/vault/memory/'.length, -'/feedback'.length));
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const action = body.action;
    if (action !== 'confirm' && action !== 'archive' && action !== 'unarchive') {
      return json({ error: 'action must be confirm|archive|unarchive' }, 400);
    }
    const kind = body.kind === 'state' || body.kind === 'fact' ? body.kind : undefined;
    try {
      const found = (await listVaultMemories(key)).find(m => m.id === id);
      if (!found) return json({ error: 'not found' }, 404);
      const fb = await fetchJson(`${MEMORY_URL}/api/memory/feedback`, {
        id,
        project: found.project || 'global',
        action,
        ...(kind ? { kind } : {}),
      }, 10_000, key);
      return json(fb);
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Vault: forget (✕) — trash + blocklist, retorna trashId para undo ──
  if (req.method === 'DELETE' && path.startsWith('/api/vault/memory/')) {
    const id = decodeURIComponent(path.slice('/api/vault/memory/'.length));
    try {
      const all = await listVaultMemories(key);
      const found = all.find(m => m.id === id);
      if (!found) return json({ error: 'not found' }, 404);
      const res = await fetchJson(`${MEMORY_URL}/api/memory/forget`, {
        memory_id: id,
        project: found.project || 'global',
      }, 10_000, key);
      return json(res);
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Vault: restore (undo do ✕, 7d) ──
  if (req.method === 'POST' && path === '/api/vault/restore') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (typeof body.trash_id !== 'string' || !body.trash_id) {
      return json({ error: 'trash_id required' }, 400);
    }
    try {
      const project = typeof body.project === 'string' && body.project.trim() ? body.project.trim() : undefined;
      const res = await fetchJson(`${MEMORY_URL}/api/memory/restore`, {
        memory_id: body.trash_id,
        ...(project ? { project } : {}),
      }, 10_000, key);
      return json(res);
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Vault: grafo (via lain-memory) ──
  if (req.method === 'GET' && path === '/api/vault/graph') {
    try {
      const res = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(key), signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`graph/nodes → ${res.status}`);
      const nodes = (await res.json()) as Array<{ id: string; type: string; mentions: number; edgeCount: number }>;
      return json(nodes.map(n => ({ key: n.id, type: n.type, file: `graph:${n.id}` })));
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  if (req.method === 'GET' && path.startsWith('/api/vault/graph/')) {
    const kid = decodeURIComponent(path.slice('/api/vault/graph/'.length));
    try {
      const res = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(key), signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`graph/nodes → ${res.status}`);
      const nodes = (await res.json()) as Array<{ id: string; type: string; mentions: number; edgeCount: number }>;
      const n = nodes.find(x => x.id === kid);
      if (!n) return json({ error: 'not found' }, 404);
      return json({ key: n.id, type: n.type, file: `graph:${n.id}`, body: `Tipo: ${n.type}\nMenções: ${n.mentions}\nArestas: ${n.edgeCount}` });
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  return null;
}

/** Rotas do vault: memórias e grafo via lain-memory (proxy + formato da UI). */
import { MEMORY_URL } from '../config.ts';
import { json } from '../lib/http.ts';
import { fetchJson, listVaultMemories, memGetHeaders } from '../lib/memory.ts';

export async function handleVault(req: Request, path: string): Promise<Response | null> {
  // ── Vault: memórias (via lain-memory) ──
  if (req.method === 'GET' && path === '/api/vault/memories') {
    try {
      return json(await listVaultMemories());
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  if (req.method === 'GET' && path.startsWith('/api/vault/memory/')) {
    const id = decodeURIComponent(path.slice('/api/vault/memory/'.length));
    try {
      const all = await listVaultMemories();
      const found = all.find(m => m.id === id);
      if (!found) return json({ error: 'not found' }, 404);
      const scope = found.project === 'global' ? {} : { project: found.project };
      const full = await fetchJson(`${MEMORY_URL}/api/memory/list`, { ...scope, limit: 500 })
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
      const found = (await listVaultMemories()).find(m => m.id === id);
      if (!found) return json({ error: 'not found' }, 404);
      const fb = await fetchJson(`${MEMORY_URL}/api/memory/feedback`, {
        id,
        project: found.project || 'global',
        action,
        ...(kind ? { kind } : {}),
      }, 10_000);
      return json(fb);
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Vault: forget (✕) — trash + blocklist, retorna trashId para undo ──
  if (req.method === 'DELETE' && path.startsWith('/api/vault/memory/')) {
    const id = decodeURIComponent(path.slice('/api/vault/memory/'.length));
    try {
      const all = await listVaultMemories();
      const found = all.find(m => m.id === id);
      if (!found) return json({ error: 'not found' }, 404);
      const res = await fetchJson(`${MEMORY_URL}/api/memory/forget`, {
        memory_id: id,
        project: found.project || 'global',
      }, 10_000);
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
      }, 10_000);
      return json(res);
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Vault: grafo (via lain-memory) ──
  if (req.method === 'GET' && path === '/api/vault/graph') {
    try {
      const res = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(), signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`graph/nodes → ${res.status}`);
      const nodes = (await res.json()) as Array<{ id: string; type: string; mentions: number; edgeCount: number }>;
      return json(nodes.map(n => ({ key: n.id, type: n.type, file: `graph:${n.id}` })));
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  if (req.method === 'GET' && path.startsWith('/api/vault/graph/')) {
    const key = decodeURIComponent(path.slice('/api/vault/graph/'.length));
    try {
      const res = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(), signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`graph/nodes → ${res.status}`);
      const nodes = (await res.json()) as Array<{ id: string; type: string; mentions: number; edgeCount: number }>;
      const n = nodes.find(x => x.id === key);
      if (!n) return json({ error: 'not found' }, 404);
      return json({ key: n.id, type: n.type, file: `graph:${n.id}`, body: `Tipo: ${n.type}\nMenções: ${n.mentions}\nArestas: ${n.edgeCount}` });
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  return null;
}

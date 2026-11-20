/** Rotas de sessões: lista, delete e patch (título/favorito). Tudo filtrado por dono. */
import { unlinkSync } from 'node:fs';
import { deleteSession, findSession, isEmptySession, isSafeSessionId, listSessions, persistSession, sessionFile } from '../lib/sessions.ts';
import { resolveOwner } from '../lib/tenant.ts';
import { json } from '../lib/http.ts';

export async function handleSessions(req: Request, path: string, params: URLSearchParams): Promise<Response | null> {
  const owner = await resolveOwner(req);
  // ── Sessions ──
  // Sessões vazias (só system, nenhuma mensagem) ficam de fora — clicar no
  // lápis só abre a caixa vazia, sem criar entrada no histórico.
  if (req.method === 'GET' && path === '/api/sessions') {
    const all = await listSessions(owner);
    const list = all
      .filter((s) => !isEmptySession(s))
      .map((s) => ({
      id: s.id, createdAt: s.createdAt, model: s.model,
      messageCount: s.messages.filter(m => m.role !== 'system').length,
      preview: s.messages.find(m => m.role === 'user')?.content?.slice(0, 100) || '',
      title: s.title || '',
      favorite: s.favorite === true,
      favoritedAt: typeof s.favoritedAt === 'number' ? s.favoritedAt : undefined,
    })).sort((a, b) => b.createdAt - a.createdAt);
    return json({ sessions: list });
  }

  // ── Delete session ──
  // DELETE /api/sessions/:id  (também aceita ?sessionId= por conveniência)
  if (req.method === 'DELETE' && (path === '/api/sessions' || path.startsWith('/api/sessions/'))) {
    const idFromPath = path.startsWith('/api/sessions/')
      ? decodeURIComponent(path.slice('/api/sessions/'.length))
      : '';
    const sessionId = idFromPath || params.get('sessionId') || '';
    if (!sessionId) return json({ error: 'sessionId required' }, 400);
    if (!isSafeSessionId(sessionId)) return json({ error: 'invalid sessionId' }, 400);
    const existed = await deleteSession(sessionId, owner);
    if (!existed) {
      // Arquivo pode ter sido removido mas id inválido em memória — tenta remover arquivo mesmo assim
      try { unlinkSync(sessionFile(sessionId, owner)); } catch { /* ignore */ }
      return json({ error: 'session not found' }, 404);
    }
    return json({ ok: true });
  }

  // ── Patch session ──
  // PATCH /api/sessions/:id  body: { title?: string, favorite?: boolean }
  if (req.method === 'PATCH' && path.startsWith('/api/sessions/')) {
    const sessionId = decodeURIComponent(path.slice('/api/sessions/'.length));
    if (!isSafeSessionId(sessionId)) return json({ error: 'invalid sessionId' }, 400);
    const s = await findSession(sessionId, owner);
    if (!s) return json({ error: 'session not found' }, 404);
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (typeof body.title === 'string') {
      const t = body.title.trim().slice(0, 80);
      if (t) s.title = t;
      else delete s.title;
    }
    if (typeof body.favorite === 'boolean') {
      if (body.favorite) {
        s.favorite = true;
        s.favoritedAt = Date.now();
      } else {
        delete s.favorite;
        delete s.favoritedAt;
      }
    }
    await persistSession(s);
    return json({
      ok: true,
      session: {
        id: s.id, title: s.title || '',
        favorite: s.favorite === true, favoritedAt: s.favoritedAt,
      },
    });
  }

  return null;
}

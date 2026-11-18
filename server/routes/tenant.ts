/**
 * Rotas de tenant (demo MVP): quem o visitante é e como ele sai.
 *
 * POST /api/tenant/signup {name} → cria o tenant no lain-memory, grava a key
 *   num cookie HttpOnly e devolve {tenant}. Nome duplicado → 409 (a UI pede outro).
 * POST /api/tenant/logout → limpa o cookie (sessões ficam órfãs no disco do dono).
 * DELETE /api/tenant/data → wipe total no lain-memory (LGPD) + limpa o cookie.
 * POST /api/tenant/mcp-token → emite um token MCP dedicado (upstream minta e
 *   gira o anel; a sessão cookie continua válida). Devolve {apiKey} UMA vez —
 *   o frontend mostra para copiar no client MCP (opencode/Claude Desktop).
 * GET /api/me → {mode:'owner'} | {mode:'demo'} | {mode:'tenant', tenant}.
 */
import { MEMORY_URL } from '../config.ts';
import { json } from '../lib/http.ts';
import { isDemoMode, isTenantRequest, proxyTenantSignup, resolveOwner, tenantCookieClear, tenantCookieSet, tenantKeyFromCookie } from '../lib/tenant.ts';

export async function handleTenant(req: Request, path: string): Promise<Response | null> {
  // ── Quem sou eu (o frontend decide: app normal, gate ou app de visitante) ──
  if (req.method === 'GET' && path === '/api/me') {
    if (isTenantRequest(req)) {
      // O slug não é resolvido aqui (evita round-trip): o frontend guarda o
      // nome digitado no signup em localStorage só para exibição.
      return json({ mode: 'tenant' });
    }
    return json({ mode: isDemoMode() ? 'demo' : 'owner' });
  }

  // ── Signup do visitante (demo) ──
  if (req.method === 'POST' && path === '/api/tenant/signup') {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
    if (name.length < 2) return json({ error: 'Informe um nome (mín. 2 letras)' }, 400);
    try {
      const created = await proxyTenantSignup(name);
      const res = json({ ok: true, tenant: created.tenant });
      res.headers.set('Set-Cookie', tenantCookieSet(created.apiKey));
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.includes('already taken') ? 409 : 502;
      return json({ error: msg }, status);
    }
  }

  // ── Token MCP dedicado (remoto por conta: opencode/Claude → /mcp) ──
  if (req.method === 'POST' && path === '/api/tenant/mcp-token') {
    const key = tenantKeyFromCookie(req);
    if (!key) return json({ error: 'no tenant session' }, 401);
    try {
      const res = await fetch(`${MEMORY_URL}/api/tenant/mcp-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: (data as { error?: string }).error ?? 'mint failed' }, res.status);
      return json({ ok: true, ...(data as object) });
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Logout (só limpa o cookie; os dados ficam até o wipe) ──
  if (req.method === 'POST' && path === '/api/tenant/logout') {
    const res = json({ ok: true });
    res.headers.set('Set-Cookie', tenantCookieClear());
    return res;
  }

  // ── Wipe total (LGPD): memórias + grafo + blocklist do tenant + transcripts ──
  if (req.method === 'DELETE' && path === '/api/tenant/data') {
    const key = tenantKeyFromCookie(req);
    if (!key) return json({ error: 'no tenant session' }, 401);
    try {
      const res = await fetch(`${MEMORY_URL}/api/tenant/data`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: 'wipe failed' }, 502);
      // Transcripts saem junto (mesmo dono estável) — sem órfãos no disco.
      const { deleteOwnerSessions } = await import('../lib/sessions.ts');
      const wipedSessions = deleteOwnerSessions(await resolveOwner(req));
      const out = json({ ok: true, ...data, wipedSessions });
      out.headers.set('Set-Cookie', tenantCookieClear());
      return out;
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  return null;
}

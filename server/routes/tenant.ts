/**
 * Rotas de tenant (demo MVP): quem o visitante é e como ele sai.
 *
 * POST /api/tenant/signup {name} → cria o tenant no lain-memory, grava a key
 *   num cookie HttpOnly e devolve {tenant}. Nome duplicado → 409 (a UI pede outro).
 * POST /api/tenant/logout → limpa o cookie (sessões ficam órfãs no disco do dono).
 * DELETE /api/tenant/account → exclusão total (LGPD): dados + registro do
 *   tenant no upstream, usuário no Supabase Auth, sessões/profile locais.
 *   O nome é liberado e o cookie é limpo. Sem undo.
 * POST /api/tenant/mcp-token → emite um token MCP dedicado (upstream minta e
 *   gira o anel; a sessão cookie continua válida). Devolve {apiKey} UMA vez —
 *   o frontend mostra para copiar no client MCP (opencode/Claude Desktop).
 * GET /api/tenant/profile → {name} (nome atual do visitante, null = sem perfil).
 * POST /api/tenant/profile {name} → valida, salva no BFF e espelha no
 *   upstream (best-effort); devolve {name}. Nunca troca o slug.
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
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: '{}', // o upstream exige body JSON em todo POST
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: (data as { error?: string }).error ?? 'mint failed' }, res.status);
      return json({ ok: true, ...(data as object) });
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  // ── Perfil do visitante (nome que o agente usa; tema fica no frontend) ──
  if (req.method === 'GET' && path === '/api/tenant/profile') {
    const key = tenantKeyFromCookie(req);
    if (!key) return json({ error: 'no tenant session' }, 401);
    const { readTenantProfile } = await import('../lib/profile.ts');
    const owner = await resolveOwner(req);
    let name = readTenantProfile(owner);
    if (name === null) {
      // Conta anterior ao perfil local: o upstream tem o nome do signup —
      // importa uma vez (best-effort) para o agente já chamar pelo nome.
      try {
        const res = await fetch(`${MEMORY_URL}/api/tenant/profile`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as { name?: unknown } | null;
          const { writeTenantProfile } = await import('../lib/profile.ts');
          if (typeof data?.name === 'string' && writeTenantProfile(owner, data.name).ok) {
            name = readTenantProfile(owner);
          }
        }
      } catch { /* sem upstream = sem nome (chat segue normal) */ }
    }
    return json({ ok: true, name });
  }

  if (req.method === 'POST' && path === '/api/tenant/profile') {
    const key = tenantKeyFromCookie(req);
    if (!key) return json({ error: 'no tenant session' }, 401);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { writeTenantProfile } = await import('../lib/profile.ts');
    const owner = await resolveOwner(req);
    const saved = writeTenantProfile(owner, body.name);
    if (!saved.ok) return json({ error: saved.error }, 400);
    // Espelha no canônico upstream (best-effort: perfil local já vale).
    try {
      await fetch(`${MEMORY_URL}/api/tenant/profile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saved.name }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch { /* upstream fora = sync fica para a próxima leitura */ }
    return json({ ok: true, name: saved.name });
  }

  // ── Logout (só limpa o cookie; os dados ficam até o wipe) ──
  if (req.method === 'POST' && path === '/api/tenant/logout') {
    const res = json({ ok: true });
    res.headers.set('Set-Cookie', tenantCookieClear());
    return res;
  }

  // ── Exclusão total da conta (LGPD): dados + registro no upstream, usuário
  // no Supabase Auth, sessões + perfil locais. O nome é liberado (um novo
  // signup pode reutilizá-lo) e o cookie é limpo. Sem undo.
  if (req.method === 'DELETE' && path === '/api/tenant/account') {
    const key = tenantKeyFromCookie(req);
    if (!key) return json({ error: 'no tenant session' }, 401);
    try {
      const res = await fetch(`${MEMORY_URL}/api/tenant/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(60_000),
      });
      const data = (await res.json().catch(() => null)) as { sub?: unknown } | null;
      if (!res.ok) return json({ error: 'account delete failed' }, 502);
      // O registro foi purgado e a key morreu — o sub veio no corpo, é a
      // única chance de excluir o usuário no Auth. Falha aqui não reverte
      // os dados (já eliminados): loga e segue — um re-login criaria um
      // tenant zerado, estado final equivalente à exclusão total.
      const sub = typeof data?.sub === 'string' ? data.sub : '';
      if (sub) {
        try {
          const { deleteSupabaseUser } = await import('../lib/supabase.ts');
          await deleteSupabaseUser(sub);
        } catch (err) {
          console.error('[bff] supabase user delete failed:', err instanceof Error ? err.message : err);
        }
      }
      // Transcripts saem junto (mesmo dono estável) — sem órfãos no disco.
      const { deleteOwnerSessions } = await import('../lib/sessions.ts');
      const wipedSessions = await deleteOwnerSessions(await resolveOwner(req));
      // Perfil (nome) é PII: sai junto na exclusão.
      const { deleteTenantProfile } = await import('../lib/profile.ts');
      deleteTenantProfile(await resolveOwner(req));
      const out = json({ ok: true, wipedSessions });
      out.headers.set('Set-Cookie', tenantCookieClear());
      return out;
    } catch {
      return json({ error: 'lain-memory unavailable' }, 502);
    }
  }

  return null;
}

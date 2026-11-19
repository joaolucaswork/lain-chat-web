/**
 * Troca de sessão Supabase → sessão de tenant (Bloco 2).
 *
 * POST /api/auth/exchange {access_token} → valida o token no Supabase
 * (server-side, secret key), vincula o `sub` a um tenant interno via
 * /api/tenant/link (master) e grava o cookie HttpOnly `lain_tk`.
 * O browser nunca vê a `lm_` key; o display name vai para o localStorage
 * como antes (só exibição).
 */
import { MEMORY_KEY, MEMORY_URL } from '../config.ts';
import { json } from '../lib/http.ts';
import { cacheSlugForKey, tenantCookieSet } from '../lib/tenant.ts';
import { findUserIdByEmail, getSupabaseUser, isSupabaseConfigured } from '../lib/supabase.ts';

// Anti-enumeração do check-email: 10/h por IP (revela se o email tem conta).
const _checkBudget = new Map<string, { count: number; resetAt: number }>();
function checkCheckAllowed(ip: string): boolean {
  const now = Date.now();
  const cur = _checkBudget.get(ip);
  if (!cur || now > cur.resetAt) {
    _checkBudget.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (cur.count >= 10) return false;
  cur.count++;
  return true;
}

// Anti-abuso do exchange: 20/h por IP (login legítimo raramente repete).
const _exchangeBudget = new Map<string, { count: number; resetAt: number }>();
function checkExchangeAllowed(ip: string): boolean {
  const now = Date.now();
  const cur = _exchangeBudget.get(ip);
  if (!cur || now > cur.resetAt) {
    _exchangeBudget.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (cur.count >= 20) return false;
  cur.count++;
  return true;
}

function clientIpOf(req: Request): string {
  for (const h of ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip']) {
    const v = req.headers.get(h);
    if (v) return v.split(',')[0].trim().slice(0, 80);
  }
  return 'unknown';
}

export async function handleAuth(req: Request, path: string): Promise<Response | null> {
  if (req.method === 'POST' && path === '/api/auth/check-email') {
    if (!isSupabaseConfigured()) return json({ error: 'auth not configured' }, 500);
    const ip = clientIpOf(req);
    if (!checkCheckAllowed(ip)) return json({ error: 'too many attempts — try again later' }, 429);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid email' }, 400);
    try {
      const id = await findUserIdByEmail(email);
      return json({ exists: id !== null });
    } catch (err) {
      console.error('[bff] check-email failed:', err instanceof Error ? err.message : err);
      return json({ error: 'could not check email — try again' }, 502);
    }
  }

  if (req.method !== 'POST' || path !== '/api/auth/exchange') return null;
  if (!isSupabaseConfigured()) return json({ error: 'auth not configured' }, 500);
  if (!MEMORY_KEY) return json({ error: 'memory backend not configured' }, 500);

  const ip = clientIpOf(req);
  if (!checkExchangeAllowed(ip)) return json({ error: 'too many attempts — try again later' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
  if (!accessToken) return json({ error: 'access_token is required' }, 400);

  let sub: string;
  let email: string | undefined;
  try {
    const user = await getSupabaseUser(accessToken);
    sub = user.id;
    email = user.email;
  } catch {
    return json({ error: 'invalid or expired session — sign in again' }, 401);
  }

  const displayName =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 40)
      : (email ?? 'user').split('@')[0].slice(0, 40);

  let linked: { tenant?: string; apiKey?: string; error?: string };
  try {
    const res = await fetch(`${MEMORY_URL}/api/tenant/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MEMORY_KEY}` },
      body: JSON.stringify({ sub, email, name: displayName }),
      signal: AbortSignal.timeout(15_000),
    });
    linked = (await res.json().catch(() => null)) as typeof linked;
    if (!res.ok || !linked?.tenant || !linked?.apiKey) {
      throw new Error(typeof linked?.error === 'string' ? linked.error : `link → ${res.status}`);
    }
  } catch (err) {
    console.error('[bff] tenant link failed:', err instanceof Error ? err.message : err);
    return json({ error: 'could not open your memory space — try again' }, 502);
  }

  const out = json({ ok: true, tenant: linked.tenant });
  out.headers.set('Set-Cookie', tenantCookieSet(linked.apiKey));
  // Pré-aquece o roteamento de sessões: primeiro chat já cai no dir estável.
  cacheSlugForKey(linked.apiKey, linked.tenant);
  return out;
}

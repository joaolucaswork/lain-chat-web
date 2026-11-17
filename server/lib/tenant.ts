/**
 * Multitenant no BFF (demo MVP).
 *
 * Cada visitante recebe uma tenant key do lain-memory (via POST
 * /api/tenant/signup) guardada num cookie HttpOnly (`lain_tk`) — nunca em
 * localStorage, nunca na URL (o EventSource não manda headers, mas manda
 * cookies). Sem cookie = modo owner (chave do env, comportamento legado).
 *
 * A key resolve duas coisas por request: a bearer do upstream
 * (lain-memory) e o dono das sessões (hash da key → subdiretório).
 */
import { createHash } from 'node:crypto';
import { MEMORY_KEY, MEMORY_URL, DEFAULT_MODEL } from '../config.ts';

export const TENANT_COOKIE = 'lain_tk';
export const OWNER = 'owner';

/** basename seguro para subdiretório de sessões (hash, sem PII). */
export function ownerHashFor(memoryKey: string): string {
  if (!memoryKey || memoryKey === MEMORY_KEY) return OWNER;
  return `k-${createHash('sha256').update(memoryKey).digest('hex').slice(0, 16)}`;
}

/** Bearer do upstream para este request (cookie do visitante ou env). */
export function memoryKeyForRequest(req: Request): string {
  return tenantKeyFromCookie(req) ?? MEMORY_KEY;
}

/** Dono das sessões para este request. */
export function ownerForRequest(req: Request): string {
  return ownerHashFor(memoryKeyForRequest(req));
}

/** Visitante (cookie) ou owner? */
export function isTenantRequest(req: Request): boolean {
  return tenantKeyFromCookie(req) !== null;
}

export function tenantKeyFromCookie(req: Request): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === TENANT_COOKIE) {
      const v = decodeURIComponent(part.slice(eq + 1).trim());
      // Sanity: tenant keys têm formato lm_<hex>; qualquer outro valor é lixo.
      if (/^lm_[0-9a-f]{16,128}$/.test(v)) return v;
      return null;
    }
  }
  return null;
}

function cookieAttrs(maxAge: number | null): string {
  // HttpOnly: JS nunca lê a key. SameSite=Lax: navegação topo manda o cookie.
  // Secure só em HTTPS (demo); localhost é http.
  const secure = process.env.LAIN_DEMO_SECURE_COOKIE === '1' ? '; Secure' : '';
  const age = maxAge === null ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : `; Max-Age=${maxAge}`;
  return `Path=/; HttpOnly; SameSite=Lax${secure}${age}`;
}

export function tenantCookieSet(key: string): string {
  return `${TENANT_COOKIE}=${encodeURIComponent(key)}; ${cookieAttrs(60 * 60 * 24 * 365)}`;
}

export function tenantCookieClear(): string {
  return `${TENANT_COOKIE}=; ${cookieAttrs(null)}`;
}

/** Proxy de signup: cria o tenant no lain-memory (rota aberta, rate-limit lá). */
export async function proxyTenantSignup(name: string): Promise<{ tenant: string; apiKey: string }> {
  const res = await fetch(`${MEMORY_URL}/api/tenant/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as { tenant?: string; apiKey?: string; error?: string } | null;
  if (!res.ok || !data?.tenant || !data?.apiKey) {
    throw new Error(typeof data?.error === 'string' ? data.error : `signup → ${res.status}`);
  }
  return { tenant: data.tenant, apiKey: data.apiKey };
}

/** Modelo efetivo: visitante usa sempre o barato (trava T7 também no server). */
export function effectiveModel(requested: unknown, req: Request): string {
  if (isTenantRequest(req)) return DEFAULT_MODEL;
  return typeof requested === 'string' && requested ? requested : DEFAULT_MODEL;
}

/** Demo mode: BFF público mostra o gate quando não há cookie. */
export function isDemoMode(): boolean {
  return (process.env.LAIN_DEMO_MODE ?? '').toLowerCase() === 'on';
}

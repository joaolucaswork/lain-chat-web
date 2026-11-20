/**
 * Multitenant BFF (Fase 1 T6/T7): cookie → key → dono, trava de modelo.
 * Puros + disco isolado em tmp (SESSIONS_DIR via env + import dinâmico).
 */
import { describe, expect, test } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';

// Hermético: preload (server/test-env.ts) fixa a key do owner antes de
// qualquer import; o ??= abaixo protege execução direta do arquivo.
process.env.LAIN_MEMORY_API_KEY ??= 'test-owner-master-key-0123456789abcdef';

const tenant = await import('./tenant.ts');
const sessions = await import('./sessions.ts');
const config = await import('../config.ts');
// NOTA: config.ts congela SESSIONS_DIR/MEMORY_KEY no primeiro import do
// processo — os testes usam os valores importados, nunca os do env.
const TEST_KEY = config.MEMORY_KEY || 'owner-env-key';

function reqWithCookie(cookie: string | null): Request {
  return new Request('http://x/api/me', cookie ? { headers: { cookie } } : {});
}

describe('tenant cookie', () => {
  test('sem cookie = owner (modo legado)', () => {
    expect(tenant.tenantKeyFromCookie(reqWithCookie(null))).toBeNull();
    expect(tenant.ownerForRequest(reqWithCookie(null))).toBe('owner');
    expect(tenant.isTenantRequest(reqWithCookie(null))).toBe(false);
    expect(tenant.memoryKeyForRequest(reqWithCookie(null))).toBe(TEST_KEY);
  });

  test('cookie válido resolve key e dono estável', () => {
    const key = 'lm_' + 'a'.repeat(48);
    const req = reqWithCookie(`${tenant.TENANT_COOKIE}=${key}`);
    expect(tenant.tenantKeyFromCookie(req)).toBe(key);
    expect(tenant.isTenantRequest(req)).toBe(true);
    expect(tenant.memoryKeyForRequest(req)).toBe(key);
    const o1 = tenant.ownerForRequest(req);
    const o2 = tenant.ownerForRequest(req);
    expect(o1).toBe(o2);
    expect(o1).toMatch(/^k-[0-9a-f]{16}$/);
    expect(o1).not.toBe('owner');
  });

  test('cookie lixo = owner (fail fechado)', () => {
    for (const bad of ['x=1', `${tenant.TENANT_COOKIE}=`, `${tenant.TENANT_COOKIE}=Bearer xyz`, `${tenant.TENANT_COOKIE}=<script>`]) {
      expect(tenant.tenantKeyFromCookie(reqWithCookie(bad))).toBeNull();
    }
  });

  test('keys diferentes = donos diferentes', () => {
    const a = tenant.ownerHashFor('lm_' + 'a'.repeat(48));
    const b = tenant.ownerHashFor('lm_' + 'b'.repeat(48));
    expect(a).not.toBe(b);
    expect(tenant.ownerHashFor(TEST_KEY)).toBe('owner');
  });
});

describe('trava de modelo (T7)', () => {
  test('visitante usa sempre o default, mesmo pedindo outro', async () => {
    const { DEFAULT_MODEL } = await import('../config.ts');
    const t = reqWithCookie(`${tenant.TENANT_COOKIE}=${'lm_' + 'c'.repeat(48)}`);
    expect(tenant.effectiveModel('anthropic/claude-opus', t)).toBe(DEFAULT_MODEL);
    expect(tenant.effectiveModel(undefined, t)).toBe(DEFAULT_MODEL);
  });

  test('owner mantém o modelo pedido', async () => {
    const { DEFAULT_MODEL } = await import('../config.ts');
    const o = reqWithCookie(null);
    expect(tenant.effectiveModel('x/y', o)).toBe('x/y');
    expect(tenant.effectiveModel(undefined, o)).toBe(DEFAULT_MODEL);
  });
});

describe('sessões por dono (T6)', () => {
  test('mesmo id, donos diferentes = sessões distintas', async () => {
    const a = await sessions.getSession('abc', 'owner');
    const b = await sessions.getSession('abc', 'k-0123456789abcdef');
    expect(a).not.toBe(b);
    expect(a.owner).toBe('owner');
    expect(b.owner).toBe('k-0123456789abcdef');
  });

  test('findSession nunca retorna sessão alheia', async () => {
    await sessions.getSession('segredo', 'owner');
    expect(await sessions.findSession('segredo', 'k-0123456789abcdef')).toBeUndefined();
    expect((await sessions.findSession('segredo', 'owner'))?.id).toBe('segredo');
  });

  test('deleteSession de outro dono não apaga', async () => {
    await sessions.getSession('keep', 'owner');
    expect(await sessions.deleteSession('keep', 'k-0123456789abcdef')).toBe(false);
    expect((await sessions.findSession('keep', 'owner'))?.id).toBe('keep');
    expect(await sessions.deleteSession('keep', 'owner')).toBe(true);
  });

  test('persist usa o diretório do dono (limpa o resíduo)', async () => {
    const s = await sessions.getSession('dircheck', 'k-aaaaaaaaaaaaaaaa');
    s.messages.push({ role: 'user', content: 'oi' });
    await sessions.persistSession(s);
    expect(existsSync(sessions.sessionFile('dircheck', 'k-aaaaaaaaaaaaaaaa'))).toBe(true);
    expect(existsSync(sessions.sessionFile('dircheck', 'owner'))).toBe(false);
    await sessions.deleteSession('dircheck', 'k-aaaaaaaaaaaaaaaa');
    // O teste usa o SESSIONS_DIR real do processo: remove o subdir vazio.
    try { rmSync(sessions.sessionDir('k-aaaaaaaaaaaaaaaa'), { recursive: true }); } catch {}
  });

  test('isSafeOwner barra traversal', () => {
    expect(sessions.isSafeOwner('../x')).toBe(false);
    expect(sessions.isSafeOwner('owner')).toBe(true);
    expect(sessions.isSafeOwner('k-0123456789abcdef')).toBe(true);
    expect(sessions.isSafeOwner('t-ana-maria')).toBe(true);
    expect(sessions.isSafeOwner('t-../x')).toBe(false);
    expect(sessions.isSafeOwner('t-a')).toBe(false);
  });
});

describe('resolveOwner (slug estável)', () => {
  test('usa o slug cacheado sem rede', async () => {
    const key = 'lm_' + 'd'.repeat(48);
    tenant.cacheSlugForKey(key, 'ana');
    const req = reqWithCookie(`${tenant.TENANT_COOKIE}=${key}`);
    expect(await tenant.resolveOwner(req)).toBe('t-ana');
  });

  test('sem rede cai no hash legado (sessões offline acessíveis)', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('down'))) as typeof fetch;
    try {
      const key = 'lm_' + 'e'.repeat(48);
      const req = reqWithCookie(`${tenant.TENANT_COOKIE}=${key}`);
      expect(await tenant.resolveOwner(req)).toBe(tenant.ownerHashFor(key));
    } finally {
      globalThis.fetch = orig;
    }
  });

  test('sem cookie e master continuam owner', async () => {
    expect(await tenant.resolveOwner(reqWithCookie(null))).toBe('owner');
  });

  test('isTenantSlug valida formato', () => {
    expect(tenant.isTenantSlug('ana-maria')).toBe(true);
    expect(tenant.isTenantSlug('../x')).toBe(false);
    expect(tenant.isTenantSlug('a')).toBe(false);
    expect(tenant.isTenantSlug('LUCAS')).toBe(false);
  });
});

/**
 * Perfil do visitante: sanitização, cache-only (fonte única no upstream) e
 * contexto passivo do prompt. Usa base temporária só para o legado em disco —
 * nenhum profile.json novo é escrito.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  __setProfileBaseForTests,
  cacheTenantProfile,
  invalidateTenantProfile,
  personContext,
  resolveTenantProfile,
  sanitizeDisplayName,
  PROFILE_HIT_TTL,
  PROFILE_MISS_TTL,
} from './profile.ts';

let BASE = '';

function tempBase(): string {
  return join(tmpdir(), `lain-profile-test-${randomBytes(6).toString('hex')}`);
}

const OWNER_A = 't-ana-test';
const OWNER_B = 't-beto-test';

function okFetch(name: string, counter?: { n: number }): typeof fetch {
  return (async () => {
    if (counter) counter.n++;
    return { ok: true, json: async () => ({ name }) } as unknown as Response;
  }) as unknown as typeof fetch;
}

function failFetch(counter?: { n: number }): typeof fetch {
  return (async () => {
    if (counter) counter.n++;
    return { ok: false, status: 500, json: async () => ({ error: 'boom' }) } as unknown as Response;
  }) as unknown as typeof fetch;
}

let realNow: () => number;

beforeEach(() => {
  BASE = tempBase();
  __setProfileBaseForTests(BASE);
  realNow = Date.now;
});

afterEach(() => {
  Date.now = realNow;
  __setProfileBaseForTests(null);
});

describe('sanitizeDisplayName', () => {
  it('aceita nome normal e corta espaços', () => {
    expect(sanitizeDisplayName('  Ana Maria  ')).toEqual({ ok: true, name: 'Ana Maria' });
  });

  it('rejeita curto, vazio e não-string', () => {
    expect(sanitizeDisplayName('a').ok).toBe(false);
    expect(sanitizeDisplayName('   ').ok).toBe(false);
    expect(sanitizeDisplayName(123).ok).toBe(false);
    expect(sanitizeDisplayName(null).ok).toBe(false);
  });

  it('corta em 40 chars e remove controles/aspas (anti-quebra de prompt)', () => {
    const long = sanitizeDisplayName('x'.repeat(50));
    expect(long.ok && (long as { name: string }).name.length).toBe(40);
    expect(sanitizeDisplayName('Ana\n"admin"\u0000')).toEqual({ ok: true, name: 'Ana admin' });
  });

  it('rejeita tentativa de injeção disfarçada de nome curto', () => {
    expect(sanitizeDisplayName('\n').ok).toBe(false);
  });
});

describe('personContext (passivo)', () => {
  it('null sem perfil (prompt intacto)', () => {
    expect(personContext(null)).toBeNull();
  });

  it('emite só metadado passivo, sem comando imperativo', () => {
    expect(personContext('Ana')).toBe('[USER PROFILE]\nname: "Ana"');
  });

  it('não contém instrução de tratamento', () => {
    const ctx = personContext('Ana')!;
    expect(ctx).toContain('"Ana"');
    expect(ctx).not.toMatch(/Trate-a|quando soar|primeiro nome/i);
    expect(ctx).not.toMatch(/ignore|system prompt/i);
  });
});

describe('cache-only resolve', () => {
  it('cache hit retorna sem I/O nem rede (5 min)', async () => {
    cacheTenantProfile(OWNER_A, 'Ana');
    const counter = { n: 0 };
    const name = await resolveTenantProfile(OWNER_A, 'lm_abc123', okFetch('Outro', counter));
    expect(name).toBe('Ana');
    expect(counter.n).toBe(0);
    expect(PROFILE_HIT_TTL).toBe(5 * 60_000);
  });

  it('hidrata via upstream em miss (seam injetável, offline)', async () => {
    const counter = { n: 0 };
    const name = await resolveTenantProfile(OWNER_A, 'lm_abc123', okFetch('Beto', counter));
    expect(name).toBe('Beto');
    expect(counter.n).toBe(1);
    // Segunda leitura: hit, sem nova rede.
    const again = await resolveTenantProfile(OWNER_A, 'lm_abc123', okFetch('Outro', counter));
    expect(again).toBe('Beto');
    expect(counter.n).toBe(1);
  });

  it('sanitiza o nome do upstream e dá miss em nome inválido', async () => {
    const name = await resolveTenantProfile(OWNER_A, 'lm_abc123', okFetch('x', { n: 0 }));
    expect(name).toBeNull();
  });

  it('miss/erro usa TTL curto (15s): não trava em null por 5 min', async () => {
    expect(PROFILE_MISS_TTL).toBe(15_000);
    const t0 = Date.now();
    let now = t0;
    Date.now = () => now;
    const failCounter = { n: 0 };
    const first = await resolveTenantProfile(OWNER_A, 'lm_abc123', failFetch(failCounter));
    expect(first).toBeNull();
    expect(failCounter.n).toBe(1);
    // Dentro do MISS_TTL: cache, sem nova rede.
    now = t0 + 5_000;
    const second = await resolveTenantProfile(OWNER_A, 'lm_abc123', failFetch(failCounter));
    expect(second).toBeNull();
    expect(failCounter.n).toBe(1);
    // Após o MISS_TTL: tenta de novo.
    now = t0 + PROFILE_MISS_TTL + 1;
    const okCounter = { n: 0 };
    const third = await resolveTenantProfile(OWNER_A, 'lm_abc123', okFetch('Carol', okCounter));
    expect(third).toBe('Carol');
    expect(okCounter.n).toBe(1);
    // Hit válido sobrevive além do MISS_TTL (vale por 5 min).
    now = t0 + PROFILE_MISS_TTL + 5_000;
    const fourth = await resolveTenantProfile(OWNER_A, 'lm_abc123', failFetch(failCounter));
    expect(fourth).toBe('Carol');
  });

  it('sem memKey (owner/single-user) retorna null sem rede', async () => {
    cacheTenantProfile(OWNER_B, 'Duda');
    // Com cache válido, hit imediato mesmo sem memKey.
    expect(await resolveTenantProfile(OWNER_B)).toBe('Duda');
    invalidateTenantProfile(OWNER_B);
    const counter = { n: 0 };
    expect(await resolveTenantProfile(OWNER_B, undefined, okFetch('X', counter))).toBeNull();
    expect(counter.n).toBe(0);
    expect(await resolveTenantProfile('owner', 'lm_abc123', okFetch('X', counter))).toBeNull();
  });

  it('dono inválido nunca consulta e nunca cacheia', async () => {
    const counter = { n: 0 };
    expect(await resolveTenantProfile('../x', 'lm_abc123', okFetch('Ana', counter))).toBeNull();
    expect(counter.n).toBe(0);
    cacheTenantProfile('../x', 'Ana'); // no-op
    expect(await resolveTenantProfile('../x', 'lm_abc123', okFetch('Ana', counter))).toBeNull();
    expect(counter.n).toBe(0);
  });

  it('zero escrita de profile.json novo em disco', async () => {
    cacheTenantProfile(OWNER_A, 'Ana');
    await resolveTenantProfile(OWNER_B, 'lm_abc123', okFetch('Beto', { n: 0 }));
    expect(existsSync(join(BASE, OWNER_A, 'profile.json'))).toBe(false);
    expect(existsSync(join(BASE, OWNER_B, 'profile.json'))).toBe(false);
    expect(existsSync(join(BASE, 'profile.json'))).toBe(false);
  });

  it('invalidate remove best-effort o profile.json legado', async () => {
    const legacy = join(BASE, OWNER_A, 'profile.json');
    mkdirSync(join(BASE, OWNER_A), { recursive: true });
    writeFileSync(legacy, JSON.stringify({ name: 'Antiga' }));
    expect(existsSync(legacy)).toBe(true);
    cacheTenantProfile(OWNER_A, 'Nova');
    invalidateTenantProfile(OWNER_A);
    expect(existsSync(legacy)).toBe(false);
    // Cache limpo: próxima leitura sem memKey volta null.
    expect(await resolveTenantProfile(OWNER_A)).toBeNull();
  });
});

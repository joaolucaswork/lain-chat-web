/**
 * Perfil do visitante: sanitização, roundtrip em disco e contexto do prompt.
 * Usa base temporária — nunca toca nas sessões reais.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import {
  __setProfileBaseForTests,
  deleteTenantProfile,
  personContext,
  readTenantProfile,
  sanitizeDisplayName,
  writeTenantProfile,
} from './profile.ts';

let BASE = '';

function tempBase(): string {
  return join(tmpdir(), `lain-profile-test-${randomBytes(6).toString('hex')}`);
}

function fakeOwner(): string {
  return `k-${createHash('sha256').update(randomBytes(8)).digest('hex').slice(0, 16)}`;
}

const OWNER = fakeOwner();

beforeEach(() => {
  BASE = tempBase();
  __setProfileBaseForTests(BASE);
});

afterEach(() => {
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
    // "\n" cai no colapso de espaços; sobra 1 char → rejeita.
    expect(sanitizeDisplayName('\n').ok).toBe(false);
  });
});

describe('profile store', () => {
  it('roundtrip: grava e lê o nome', () => {
    expect(readTenantProfile(OWNER)).toBeNull();
    expect(writeTenantProfile(OWNER, 'Ana')).toEqual({ ok: true, name: 'Ana' });
    expect(readTenantProfile(OWNER)).toBe('Ana');
  });

  it('recusa dono inválido (traversal)', () => {
    expect(writeTenantProfile('../x', 'Ana').ok).toBe(false);
    expect(readTenantProfile('../x')).toBeNull();
    deleteTenantProfile('../x'); // no-op, não joga
  });

  it('delete limpa o cache (leitura seguinte volta null)', () => {
    expect(writeTenantProfile(OWNER, 'Beto')).toEqual({ ok: true, name: 'Beto' });
    expect(readTenantProfile(OWNER)).toBe('Beto');
    deleteTenantProfile(OWNER);
    expect(readTenantProfile(OWNER)).toBeNull();
  });

  it('arquivo em disco tem modo 0600', () => {
    writeTenantProfile(OWNER, 'Carol');
    const f = join(BASE, OWNER, 'profile.json');
    expect(existsSync(f)).toBe(true);
    expect(statSync(f).mode & 0o777).toBe(0o600);
  });
});

describe('personContext', () => {
  it('null sem perfil (prompt intacto)', () => {
    expect(personContext(null)).toBeNull();
  });

  it('cita o nome como dado, sem virar instrução', () => {
    const ctx = personContext('Ana')!;
    expect(ctx).toContain('"Ana"');
    expect(ctx).not.toMatch(/ignore|system|prompt/i);
  });
});

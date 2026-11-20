/**
 * Perfil do visitante (demo): nome de exibição editável.
 *
 * WHY fonte única no `lain-memory`: o BFF mantém APENAS cache em memória
 * por dono (sem `profile.json` novo em disco). O canônico mora no upstream
 * (`tenants.json`); o BFF hidrata via `GET /api/tenant/profile` em miss.
 * Nome nunca vai para log.
 */
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { MEMORY_URL, SESSIONS_DIR } from '../config.ts';
import { isSafeOwner } from './sessions.ts';
import { OWNER } from './tenant.ts';

const PROFILE_FILE = 'profile.json';
export const PROFILE_HIT_TTL = 5 * 60_000;
export const PROFILE_MISS_TTL = 15_000;

/** Override de testes (base do profile.json legado — nunca escreve novo). */
let _baseOverride: string | null = null;

/** Test-only: redirect the legacy profile base dir (pass null to restore). */
export function __setProfileBaseForTests(p: string | null): void {
  _baseOverride = p;
  _cache.clear();
}

function baseDir(): string {
  return _baseOverride ?? SESSIONS_DIR;
}

function profileDir(owner: string): string {
  if (owner === OWNER) return baseDir();
  return join(baseDir(), owner);
}

function profileFile(owner: string): string {
  return join(profileDir(owner), PROFILE_FILE);
}

function removeLegacyProfileFile(owner: string): void {
  if (!isSafeOwner(owner)) return;
  try { unlinkSync(profileFile(owner)); } catch { /* já sumiu / nunca existiu */ }
}

// Controles C0 + DEL viram espaço (não colam palavras); aspas caem
// (quebra de citação no prompt).
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Sanitiza nome de exibição (input do próprio usuário, afeta só o próprio
 * prompt). Corta controles/aspas, colapsa espaços, máx. 40. Nunca joga
 * exceção — validação é 400, não 500.
 */
export function sanitizeDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Informe um nome (mín. 2 letras)' };
  const name = raw.replace(CONTROL_CHARS, ' ').replace(/"/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (name.length < 2) return { ok: false, error: 'Informe um nome (mín. 2 letras)' };
  return { ok: true, name };
}

// Cache em memória por dono: hit 5min (nome válido), miss 15s (null/falha
// transitória — nunca trava o nome em null por 5 min). Teto 2000 entradas.
const _cache = new Map<string, { at: number; name: string | null }>();

function cacheSet(owner: string, name: string | null): void {
  if (_cache.size > 2000) _cache.clear();
  _cache.set(owner, { at: Date.now(), name });
}

/** Pré-aquece / atualiza o cache após signup, login ou POST /api/tenant/profile. */
export function cacheTenantProfile(owner: string, rawName: unknown): void {
  if (!isSafeOwner(owner)) return;
  const clean = sanitizeDisplayName(rawName);
  if (!clean.ok) return;
  cacheSet(owner, clean.name);
}

/** Limpa o cache no DELETE /api/tenant/account, wipe ou re-login (+ legado em disco). */
export function invalidateTenantProfile(owner: string): void {
  if (!isSafeOwner(owner)) return;
  _cache.delete(owner);
  removeLegacyProfileFile(owner);
}

/**
 * Nome atual do dono, ou null. Ordem:
 * 1. Cache válido → imediato (0 I/O, 0 rede).
 * 2. Sem memKey (owner/single-user sem registro no upstream) → null.
 * 3. Miss com memKey → GET upstream (timeout 2s, best-effort; sanitiza),
 *    popula o cache e retorna.
 */
export async function resolveTenantProfile(
  owner: string,
  memKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  if (!isSafeOwner(owner)) return null;
  const now = Date.now();
  const hit = _cache.get(owner);
  if (hit) {
    const ttl = hit.name !== null ? PROFILE_HIT_TTL : PROFILE_MISS_TTL;
    if (now - hit.at < ttl) return hit.name;
  }
  // Owner/single-user: sem registro de tenant no upstream — nunca consulta.
  if (!memKey || owner === OWNER) return null;
  try {
    const res = await fetchFn(`${MEMORY_URL}/api/tenant/profile`, {
      headers: { Authorization: `Bearer ${memKey}` },
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) {
      cacheSet(owner, null);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { name?: unknown } | null;
    const clean = sanitizeDisplayName(data?.name);
    if (!clean.ok) {
      cacheSet(owner, null);
      return null;
    }
    cacheSet(owner, clean.name);
    return clean.name;
  } catch {
    cacheSet(owner, null);
    return null;
  }
}

/**
 * Linha de contexto por turno: nome entra CITADO como dado, nunca como
 * instrução — display name é input do usuário.
 */
export function personContext(name: string | null): string | null {
  if (!name) return null;
  return `[USER PROFILE]\nname: "${name}"`;
}

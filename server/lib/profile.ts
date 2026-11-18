/**
 * Perfil do visitante (demo): nome de exibição editável.
 *
 * WHY um store próprio no BFF: o `localStorage` não chega ao servidor, e o
 * nome canônico do upstream (`tenants.json`) só é gravado no signup/link.
 * O BFF guarda o nome atual por dono (`t-<slug>/profile.json`, 0600) e o
 * chat injeta no prompt por turno — sem tocar no slug (identidade/isolamento)
 * nem nas memórias já salvas. Nunca vai para log.
 */
import { readFileSync, mkdirSync, writeFileSync, unlinkSync, chmodSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { SESSIONS_DIR } from '../config.ts';
import { isSafeOwner } from './sessions.ts';
import { OWNER } from './tenant.ts';

const PROFILE_FILE = 'profile.json';
const PROFILE_TTL = 5 * 60_000;

/** Override de testes (mesmo padrão de tenants.json). Null = produção. */
let _baseOverride: string | null = null;

/** Test-only: redirect the profile base dir (pass null to restore). */
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

// Cache em memória por dono (TTL 5min): o chat lê por turno, sem I/O quente.
const _cache = new Map<string, { at: number; name: string | null }>();

/** Nome atual do dono, ou null (sem perfil / dono inválido / disco ilegível). */
export function readTenantProfile(owner: string): string | null {
  if (!isSafeOwner(owner)) return null;
  const now = Date.now();
  const hit = _cache.get(owner);
  if (hit && now - hit.at < PROFILE_TTL) return hit.name;
  let name: string | null = null;
  try {
    const parsed = JSON.parse(readFileSync(profileFile(owner), 'utf-8')) as { name?: unknown };
    const clean = sanitizeDisplayName(parsed?.name);
    if (clean.ok) name = clean.name;
  } catch { /* sem perfil = sem nome */ }
  if (_cache.size > 2000) _cache.clear();
  _cache.set(owner, { at: now, name });
  return name;
}

/** Grava o perfil do dono (cria o dir 0700; arquivo 0600, escrita atômica). */
export function writeTenantProfile(owner: string, rawName: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (!isSafeOwner(owner)) return { ok: false, error: 'unknown owner' };
  const clean = sanitizeDisplayName(rawName);
  if (!clean.ok) return clean;
  try {
    const dir = profileDir(owner);
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
    const target = profileFile(owner);
    const temp = `${target}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify({ name: clean.name, updatedAt: new Date().toISOString() }), { encoding: 'utf-8', mode: 0o600 });
    chmodSync(temp, 0o600);
    renameSync(temp, target);
    chmodSync(target, 0o600);
  } catch (err) {
    console.error('[bff] persist profile failed:', err instanceof Error ? err.message : err);
    return { ok: false, error: 'could not save profile' };
  }
  _cache.set(owner, { at: Date.now(), name: clean.name });
  return { ok: true, name: clean.name };
}

/** Remove o perfil do dono (wipe LGPD: nome é PII). */
export function deleteTenantProfile(owner: string): void {
  if (!isSafeOwner(owner)) return;
  _cache.delete(owner);
  try { unlinkSync(profileFile(owner)); } catch { /* já sumiu */ }
}

/**
 * Linha de contexto por turno: o nome entra CITADO como dado, nunca como
 * instrução concatenada — display name é input do usuário.
 */
export function personContext(name: string | null): string | null {
  if (!name) return null;
  return `A pessoa com quem você está falando se chama "${name}". Trate-a pelo primeiro nome quando soar natural; não invente sobrenome, apelido ou outros dados sobre ela.`;
}

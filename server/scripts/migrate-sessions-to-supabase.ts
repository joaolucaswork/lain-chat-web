#!/usr/bin/env bun
/**
 * Migra os JSONs do disco (SESSIONS_DIR) para `chat_sessions` no Supabase.
 * Uso: bun run server/scripts/migrate-sessions-to-supabase.ts [dir]
 * Opcional: um diretório (ex. arquivos puxados da VPS) em vez do SESSIONS_DIR.
 * Vazias são puladas; ordem por mtime crescente = last-write-wins.
 * Rode DEPOIS de aplicar supabase/migrations/20261120_chat_sessions.sql.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import '../config.ts';
import { SESSIONS_DIR } from '../config.ts';
import { isSafeOwner, isSafeSessionId, isEmptySession } from '../lib/sessions.ts';
import type { Session } from '../lib/sessions.ts';
import { dbUpsertSession, isSessionDbConfigured } from '../lib/session-store.ts';
import { OWNER } from '../lib/tenant.ts';

const root = process.argv[2] ?? SESSIONS_DIR;

if (!isSessionDbConfigured()) {
  console.error('SUPABASE_URL/SECRET ausentes — nada a migrar.');
  process.exit(1);
}

interface Entry {
  owner: string;
  id: string;
  mtime: string;
  session: Session;
}

function collect(dir: string, owner: string, out: Entry[]): void {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return;
  }
  for (const f of files) {
    const id = basename(f, '.json');
    if (!isSafeSessionId(id)) continue;
    const full = join(dir, f);
    try {
      const s = JSON.parse(readFileSync(full, 'utf-8')) as Session;
      if (!s || s.id !== id || !Array.isArray(s.messages)) continue;
      const full_session: Session = { ...s, owner };
      if (isEmptySession(full_session)) continue; // "New conversation" nunca persistida de verdade
      out.push({ owner, id, mtime: statSync(full).mtime.toISOString(), session: full_session });
    } catch {
      console.error(`ignorando (parse): ${full}`);
    }
  }
}

const entries: Entry[] = [];
collect(root, OWNER, entries);
try {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory() && isSafeOwner(e.name)) collect(join(root, e.name), e.name, entries);
  }
} catch { /* sem subdirs */ }

entries.sort((a, b) => (a.mtime < b.mtime ? -1 : 1));

let ok = 0;
for (const e of entries) {
  try {
    await dbUpsertSession(e.session, e.mtime);
    ok++;
  } catch (err) {
    console.error(`falhou ${e.owner}/${e.id}:`, err instanceof Error ? err.message : err);
  }
}
console.log(`migradas ${ok}/${entries.length} sessões de ${root}`);

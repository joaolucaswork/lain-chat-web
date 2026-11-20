/**
 * Backend Supabase para as sessões (transcripts).
 *
 * Fonte única: localhost e VPS leem/escrevem a mesma tabela `chat_sessions`
 * — é isso que faz as conversas sincronizarem entre máquinas.
 * Sem Supabase configurado (dev sem secret, testes): o BFF cai no disco,
 * como antes. Ver lib/sessions.ts.
 */
import '../config.ts'; // side-effect: carrega server/.env antes de ler o env
import { isSupabaseConfigured, supabaseAdmin } from './supabase.ts';
import type { Session } from './sessions.ts';

export function isSessionDbConfigured(): boolean {
  return isSupabaseConfigured();
}

interface SessionRow {
  owner: string;
  id: string;
  data: Session;
  updated_at: string;
}

function toRow(s: Session): SessionRow {
  return { owner: s.owner, id: s.id, data: s, updated_at: new Date().toISOString() };
}

/** Upsert last-write-wins por (owner, id): doc inteiro, sem merge. */
export async function dbUpsertSession(s: Session, updatedAt?: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('chat_sessions')
    .upsert({ ...toRow(s), ...(updatedAt ? { updated_at: updatedAt } : {}) }, { onConflict: 'owner,id' });
  if (error) throw new Error(`chat_sessions upsert: ${error.message}`);
}

export async function dbFetchSession(owner: string, id: string): Promise<Session | undefined> {
  const { data, error } = await supabaseAdmin()
    .from('chat_sessions')
    .select('data')
    .eq('owner', owner)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`chat_sessions fetch: ${error.message}`);
  const s = (data as { data?: unknown } | null)?.data as Session | undefined;
  if (!s || s.id !== id || !Array.isArray(s.messages)) return undefined;
  return { ...s, owner };
}

export async function dbListSessions(owner: string): Promise<Session[]> {
  const { data, error } = await supabaseAdmin()
    .from('chat_sessions')
    .select('data')
    .eq('owner', owner)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`chat_sessions list: ${error.message}`);
  const out: Session[] = [];
  for (const row of (data ?? []) as Array<{ data?: unknown }>) {
    const s = row.data as Session | undefined;
    if (s && s.id && Array.isArray(s.messages)) out.push({ ...s, owner });
  }
  return out;
}

export async function dbDeleteSession(owner: string, id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('chat_sessions')
    .delete()
    .eq('owner', owner)
    .eq('id', id)
    .select('id');
  if (error) throw new Error(`chat_sessions delete: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function dbDeleteOwnerSessions(owner: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from('chat_sessions')
    .delete()
    .eq('owner', owner)
    .select('id');
  if (error) throw new Error(`chat_sessions wipe: ${error.message}`);
  return data?.length ?? 0;
}

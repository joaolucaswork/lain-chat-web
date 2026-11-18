/**
 * Supabase Auth (Cloud) para o BFF — validação server-side de access tokens.
 *
 * O front autentica com a publishable key (supabase-js no browser) e manda o
 * access_token para POST /api/auth/exchange. Aqui o token é validado com a
 * SECRET key (service_role) — que nunca sai do server/.env — e o `sub`
 * resultante é vinculado a um tenant interno via /api/tenant/link (master).
 * O browser continua vendo só o cookie HttpOnly `lain_tk`, como na demo.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let _admin: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith('http') && SUPABASE_SECRET_KEY.length > 20;
}

function adminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** Valida o access_token e devolve o usuário (id + email). Throw = 401 no caller. */
export async function getSupabaseUser(accessToken: string): Promise<Pick<User, 'id' | 'email'>> {
  const token = (accessToken ?? '').trim();
  if (!token || token.length > 10000) throw new Error('invalid token');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) throw new Error(error?.message ?? 'invalid token');
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/**
 * Exclui o usuário no Supabase Auth (exclusão total da conta). Admin key.
 * Throw em qualquer falha — o caller decide o fallback.
 */
export async function deleteSupabaseUser(sub: string): Promise<void> {
  const id = (sub ?? '').trim();
  if (!id) throw new Error('sub is required');
  if (!isSupabaseConfigured()) throw new Error('auth not configured');
  const { error } = await adminClient().auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}

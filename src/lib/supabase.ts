import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let _client: SupabaseClient | null = null

/** Cliente browser (publishable). Null quando o .env.local ainda não foi preenchido. */
export function supabase(): SupabaseClient | null {
  if (_client) return _client
  if (!url || !anon) return null
  _client = createClient(url, anon)
  return _client
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon)
}

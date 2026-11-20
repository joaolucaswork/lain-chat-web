import { useRef } from 'react'
import { setTenantName } from '@/hooks/useMe'

export type ExchangeResult =
  | { ok: true }
  /** suppressed = chamada duplicada contida pela trava (o vencedor chama onDone). */
  | { ok: false; error: string; suppressed?: boolean }

/**
 * Troca access_token (Supabase) por cookie HttpOnly via /api/auth/exchange.
 * A trava de in-flight fica DENTRO do exchange: o listener de OAuth
 * (SIGNED_IN) e o login direto (senha/OTP) concorrem, e a segunda chamada
 * vira no-op em vez de um segundo POST em paralelo. A trava libera no erro
 * e trava no sucesso (a página recarrega via onDone de qualquer forma).
 */
export function useAuthExchange(onDone: () => void) {
  const inFlightRef = useRef(false)

  async function exchange(
    accessToken: string,
    emailHint: string,
    displayName?: string,
  ): Promise<ExchangeResult> {
    if (inFlightRef.current) return { ok: false, error: '', suppressed: true }
    inFlightRef.current = true
    try {
      const res = await fetch('/api/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, name: displayName }),
      })
      const data = (await res.json().catch(() => null)) as { tenant?: string; error?: string } | null
      if (!res.ok || !data?.tenant) {
        inFlightRef.current = false
        return { ok: false, error: data?.error ?? 'Falha ao abrir seu espaço. Tente de novo.' }
      }
      setTenantName(displayName || emailHint.split('@')[0] || data.tenant)
      onDone()
      return { ok: true }
    } catch {
      inFlightRef.current = false
      return { ok: false, error: 'Sem conexão com o servidor. Tente de novo.' }
    }
  }

  return { exchange, inFlightRef }
}

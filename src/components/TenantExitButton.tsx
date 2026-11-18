import { useState } from 'react'
import { SignOut, Trash } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { clearTenantName, getTenantName, useMeMode } from '@/hooks/useMe'

/**
 * Saída do visitante com conta real (Supabase).
 *
 * "Sair" = só encerra a sessão (cookie + Supabase). Os dados ficam — ao
 * entrar de novo, tudo está lá (a key do tenant rotaciona no login).
 * "Apagar tudo" = wipe LGPD (memórias + grafo) com confirmação; a conta
 * continua, entrar de novo começa do zero. Sem undo.
 */
export function TenantExitButton({ compact }: { compact?: boolean }) {
  const [busy, setBusy] = useState<null | 'logout' | 'wipe'>(null)
  const meMode = useMeMode()

  async function logout() {
    if (busy) return
    setBusy('logout')
    try {
      await fetch('/api/tenant/logout', { method: 'POST' })
    } catch {}
    try {
      await supabase()?.auth.signOut()
    } catch {}
    clearTenantName()
    try {
      sessionStorage.clear()
    } catch {}
    window.location.href = '/'
  }

  async function wipe() {
    if (busy) return
    const name = getTenantName() ?? 'visitante'
    if (
      !window.confirm(
        `Apagar TODOS os dados de "${name}"?\n\nSuas memórias e grafo são eliminados do servidor. Sua conta continua — entrar de novo começa do zero. Não tem como desfazer.`,
      )
    ) {
      return
    }
    setBusy('wipe')
    try {
      await fetch('/api/tenant/data', { method: 'DELETE' })
    } catch {
      /* wipe best-effort: sai mesmo se a rede falhar */
    }
    try {
      await fetch('/api/tenant/logout', { method: 'POST' })
    } catch {}
    try {
      await supabase()?.auth.signOut()
    } catch {}
    clearTenantName()
    try {
      sessionStorage.clear()
    } catch {}
    window.location.href = '/'
  }

  if (!getTenantName() && meMode !== 'tenant') return null
  const btn =
    'flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent disabled:opacity-40'
  return (
    <div className="flex w-full flex-col gap-0.5">
      <button
        type="button"
        onClick={() => void logout()}
        disabled={busy !== null}
        title="Sair (mantém seus dados)"
        aria-label="Sair (mantém seus dados)"
        className={`${btn} hover:text-sidebar-accent-foreground`}
      >
        <SignOut className="size-4 shrink-0" />
        {!compact && <span className="truncate">{busy === 'logout' ? 'Saindo…' : 'Sair'}</span>}
      </button>
      <button
        type="button"
        onClick={() => void wipe()}
        disabled={busy !== null}
        title="Apagar todos os meus dados"
        aria-label="Apagar todos os meus dados"
        className={`${btn} hover:text-destructive`}
      >
        <Trash className="size-4 shrink-0" />
        {!compact && <span className="truncate">{busy === 'wipe' ? 'Apagando…' : 'Apagar tudo'}</span>}
      </button>
    </div>
  )
}

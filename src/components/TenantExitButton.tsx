import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { clearTenantName, getTenantName, useMeMode } from '@/hooks/useMe'

/**
 * Saída do visitante com conta real (Supabase).
 *
 * "Sair" = só encerra a sessão (cookie + Supabase). Os dados ficam — ao
 * entrar de novo, tudo está lá (a key do tenant rotaciona no login).
 * A exclusão total ("Excluir conta") mora em /settings/conta, seção Dados.
 */
export function TenantExitButton({ compact }: { compact?: boolean }) {
  const [busy, setBusy] = useState<null | 'logout'>(null)
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

  if (!getTenantName() && meMode !== 'tenant') return null
  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy !== null}
      title="Sair (mantém seus dados)"
      aria-label="Sair (mantém seus dados)"
      className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-40"
    >
      <SignOut className="size-4 shrink-0" />
      {!compact && <span className="truncate">{busy === 'logout' ? 'Saindo…' : 'Sair'}</span>}
    </button>
  )
}

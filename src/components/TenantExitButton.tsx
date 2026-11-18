import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  const label = 'Sair (mantém seus dados)'
  const btn = (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy !== null}
      title={label}
      aria-label={label}
      className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-40"
    >
      <SignOut className={compact ? 'size-5 shrink-0' : 'size-4 shrink-0'} weight="bold" />
      {!compact && <span className="truncate">{busy === 'logout' ? 'Saindo…' : 'Sair'}</span>}
    </button>
  )
  // No rail (compact) o rótulo não aparece — usa o mesmo Tooltip
  // dos vizinhos (IconRailButton/Link), abrindo para a direita.
  if (!compact) return btn
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

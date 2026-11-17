import { useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { clearTenantName, getTenantName, useMeMode } from '@/hooks/useMe'

/**
 * Saída do visitante (T6/T7): apaga TODOS os dados do tenant no lain-memory
 * (LGPD wipe) + limpa a sessão local. Com confirmação — não tem undo.
 */
export function TenantExitButton({ compact }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const meMode = useMeMode()

  async function exit() {
    if (busy) return
    const name = getTenantName() ?? 'visitante'
    if (
      !window.confirm(
        `Sair e apagar tudo de "${name}"?\n\nSuas memórias, conversas e grafo são eliminados do servidor. Não tem como desfazer.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await fetch('/api/tenant/data', { method: 'DELETE' })
    } catch {
      /* wipe best-effort: sai mesmo se a rede falhar */
    }
    try {
      await fetch('/api/tenant/logout', { method: 'POST' })
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
      onClick={() => void exit()}
      disabled={busy}
      title="Sair e apagar todos os meus dados"
      aria-label="Sair e apagar todos os meus dados"
      className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-destructive disabled:opacity-40"
    >
      <SignOut className="size-4 shrink-0" />
      {!compact && <span className="truncate">{busy ? 'Apagando…' : 'Sair e apagar tudo'}</span>}
    </button>
  )
}

import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import type { LayoutContext } from './Layout'
import { useTheme } from '@/hooks/useTheme'
import { getTenantName, setTenantName } from '@/hooks/useMe'
import { supabase } from '@/lib/supabase'
import { Moon, Sun } from '@phosphor-icons/react'

/**
 * Conta do visitante (demo): perfil + aparência.
 * Nome editável (o agente usa na conversa); email só leitura (login).
 * Modelo e OpenRouter ficam de fora de propósito — o BFF trava o modelo
 * barato para tenants e a trava real é no server (effectiveModel).
 */
export function TenantSettingsPage() {
  const { openMobileNav } = useOutletContext<LayoutContext>()
  const { dark, toggle } = useTheme()
  const [name, setName] = useState(() => getTenantName() ?? '')
  const [savedName, setSavedName] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/tenant/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || typeof d?.name !== 'string') return
        setName(d.name)
        setTenantName(d.name)
      })
      .catch(() => {})
    supabase()
      ?.auth.getSession()
      .then(({ data }) => {
        if (!alive) return
        const mail = data.session?.user.email
        if (mail) setEmail(mail)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const clean = name.trim()
    if (clean.length < 2) {
      setError('Informe um nome (mín. 2 letras).')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const res = await fetch('/api/tenant/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean.slice(0, 40) }),
      })
      const data = (await res.json().catch(() => null)) as { name?: string; error?: string } | null
      if (!res.ok || typeof data?.name !== 'string') {
        setError(data?.error ?? 'Não foi possível salvar. Tente de novo.')
        return
      }
      setTenantName(data.name)
      setSavedName(data.name)
      setInfo(`Pronto — vou te chamar de ${data.name}.`)
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const row = 'flex items-center justify-between gap-6 border-b border-border px-6 py-4 last:border-b-0'
  const label = 'text-[15px] text-foreground'
  const hint = 'pt-0.5 text-sm text-muted-foreground'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={openMobileNav}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent md:hidden"
        >
          <List className="size-5" />
        </button>
        <h2 className="text-sm font-semibold">Sua conta</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold">Preferências</h1>
            <p className="pt-1 text-[15px] text-muted-foreground">
              Gerencie seu perfil e a aparência do app.
            </p>
          </div>

          <section>
            <h2 className="pb-3 text-lg font-bold">Informações do perfil</h2>
            <form
              onSubmit={(e) => void save(e)}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className={row}>
                <div>
                  <p className="text-[13px] text-foreground">Nome</p>
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={40}
                  autoComplete="nickname"
                  className="w-64 rounded-lg border border-border/60 bg-background px-4 py-2 outline-none focus:border-foreground"
                />
              </div>
              <div className={row}>
                <div>
                  <p className="text-[13px] text-foreground">E-mail principal</p>
                  <p className={hint}>Usado para login</p>
                </div>
                <p className="w-64 truncate rounded-lg border border-border/60 bg-muted px-4 py-2 text-muted-foreground">
                  {email || '…'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4">
                {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
                {info && !error && <p className="mr-auto text-sm text-muted-foreground">{info}</p>}
                <button
                  type="submit"
                  disabled={busy || name.trim() === (savedName ?? '')}
                  className="rounded-lg bg-foreground px-3 py-1 text-sm font-normal text-background disabled:opacity-40"
                >
                  {busy ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </section>

          <section>
            <h2 className="pb-3 text-lg font-bold">Aparência</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className={row}>
                <div>
                  <p className={label}>Tema</p>
                  <p className={hint}>{dark ? 'Escuro' : 'Claro'}</p>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                  className="flex w-64 items-center gap-3 rounded-lg border border-border/60 px-4 py-2 hover:bg-accent"
                >
                  {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  <span className="text-[15px]">{dark ? 'Escuro' : 'Claro'}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

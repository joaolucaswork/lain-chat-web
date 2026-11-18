import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import type { LayoutContext } from './Layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useTheme } from '@/hooks/useTheme'
import { getTenantName, setTenantName } from '@/hooks/useMe'
import { Moon, Sun } from '@phosphor-icons/react'

/**
 * Ajustes do visitante (demo): tema + nome.
 * Modelo e OpenRouter ficam de fora de propósito — o BFF trava o modelo
 * barato para tenants e a trava real é no server (effectiveModel).
 */
export function TenantSettingsPage() {
  const { openMobileNav } = useOutletContext<LayoutContext>()
  const { dark, toggle } = useTheme()
  const [name, setName] = useState(() => getTenantName() ?? '')
  const [savedName, setSavedName] = useState<string | null>(null)
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
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle>Como posso te chamar?</CardTitle>
              <CardDescription>
                O agente usa esse nome na conversa. Vale na hora, sem perder nada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void save(e)} className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome (ex: ana)"
                  maxLength={40}
                  autoComplete="nickname"
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 outline-none focus:border-foreground"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                {info && <p className="text-sm text-muted-foreground">{info}</p>}
                <button
                  type="submit"
                  disabled={busy || name.trim() === (savedName ?? '')}
                  className="rounded-lg bg-foreground px-3 py-1 text-sm font-normal text-background disabled:opacity-40"
                >
                  {busy ? 'Salvando…' : 'Salvar nome'}
                </button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Alterna entre o tema claro e o escuro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={toggle}
                aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span className="text-sm">{dark ? 'Escuro' : 'Claro'}</span>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

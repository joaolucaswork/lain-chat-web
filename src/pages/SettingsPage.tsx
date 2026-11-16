import { useEffect, useState, type FormEvent } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OpenRouterLogo } from '@/components/OpenRouterLogo'
import { useTheme } from '@/hooks/useTheme'
import { Moon, Sun } from '@phosphor-icons/react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useModel } from '@/hooks/useModel'

interface SettingsStatus {
  hasKey: boolean
  source: 'settings' | 'env' | 'none'
  masked: string
  fromEnv: boolean
}

export function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null)
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { model, setModel, models } = useModel()
  const { dark, toggle } = useTheme()

  const load = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) setStatus(await res.json())
    } catch {}
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      setError('Cole sua chave do OpenRouter.')
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings/openrouter-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar')
      setKey('')
      setSaved(true)
      setEditOpen(false)
      setStatus({
        hasKey: true,
        source: 'settings',
        masked: data.masked || '',
        fromEnv: status?.fromEnv ?? false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings/openrouter-key', { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao remover')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <SidebarTrigger />
        <h2 className="text-sm font-semibold">Configurações</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle>Modelo</CardTitle>
              <CardDescription>
                Modelo usado pelo chat nas novas mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {status?.hasKey && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <OpenRouterLogo className="h-4 w-auto shrink-0 text-foreground" />
                    Chave ativa
                  </CardTitle>
                  <Badge variant="secondary">Ativa</Badge>
                </div>
                <CardDescription>
                  Chave do OpenRouter em uso pelo chat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-mono text-sm">{status.masked}</p>
                <a
                  href="https://openrouter.ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  openrouter.ai
                </a>
              </CardContent>
              <CardFooter className="gap-2">
                <Popover
                  open={editOpen}
                  onOpenChange={(open) => {
                    setEditOpen(open)
                    if (open) {
                      setError('')
                      setSaved(false)
                    } else {
                      setKey('')
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="outline">
                      Editar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <form onSubmit={handleSave} className="space-y-3">
                      <p className="text-sm font-semibold">Trocar chave</p>
                      <Input
                        type={show ? 'text' : 'password'}
                        placeholder="sk-or-v1-..."
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {error && <p className="text-xs text-destructive">{error}</p>}
                      <div className="flex items-center gap-2">
                        <Button type="submit" size="sm" variant="outline" disabled={saving}>
                          {saving ? 'Salvando...' : 'Salvar chave'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setShow((v) => !v)}
                        >
                          {show ? 'Ocultar' : 'Mostrar'}
                        </Button>
                      </div>
                      <div className="border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">
                          Pegue sua api key:{' '}
                          <a
                            href="https://openrouter.ai/"
                            target="_blank"
                            rel="noreferrer"
                            className="underline-offset-4 hover:underline"
                          >
                            openrouter.ai
                          </a>
                        </p>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
                {status.source === 'settings' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={removing}
                    onClick={handleRemove}
                    className="text-destructive hover:text-destructive"
                  >
                    {removing ? 'Removendo...' : 'Remover chave'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}

          {!status?.hasKey && (
            <Card>
              <CardHeader>
                <CardTitle>Definir chave</CardTitle>
                <CardDescription>
                  Salva no servidor e tem prioridade sobre a chave do ambiente.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSave}>
                <CardContent className="space-y-3">
                  <Input
                    type={show ? 'text' : 'password'}
                    placeholder="sk-or-v1-..."
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  {saved && !error && (
                    <p className="text-xs text-muted-foreground">
                      Chave salva com sucesso.
                    </p>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button type="submit" size="sm" variant="outline" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar chave'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShow((v) => !v)}
                  >
                    {show ? 'Ocultar' : 'Mostrar'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

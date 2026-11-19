import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import type { LayoutContext } from './Layout'
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/hooks/useTheme'
import { BubbleThemePicker } from '@/components/settings/BubbleThemePicker'
import { Moon, Sun } from '@phosphor-icons/react'
import { useModel } from '@/hooks/useModel'

interface SettingsStatus {
  hasKey: boolean
  source: 'env' | 'none'
  masked: string
  fromEnv: boolean
}

export function SettingsPage() {
  const { openMobileNav } = useOutletContext<LayoutContext>()
  const [status, setStatus] = useState<SettingsStatus | null>(null)
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

          <Card>
            <CardHeader>
              <CardTitle>Tema</CardTitle>
              <CardDescription>
                Define a cor das suas mensagens no chat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BubbleThemePicker />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>OpenRouter</CardTitle>
                {status?.hasKey && <Badge variant="secondary">Ativa</Badge>}
              </div>
              <CardDescription>
                A chave é carregada do ambiente do servidor e não fica armazenada na aplicação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status?.hasKey ? (
                <p className="font-mono text-sm">{status.masked}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure <code>LAIN_LLM_API_KEY</code> ou <code>OPENROUTER_API_KEY</code> no arquivo de ambiente do servidor.
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

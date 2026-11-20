import { useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'

/** Snippets reais do guia MCP (mesma surface do DocsInstallPage). */
const TABS = ['OpenCode', 'Claude Code', 'Genérico'] as const
type Tab = (typeof TABS)[number]

const SNIPPETS: Record<Tab, string> = {
  OpenCode: `opencode mcp add --global lain-remote --url https://api.lainmemo.dev/mcp --header "Authorization=Bearer <seu-token>"`,
  'Claude Code': `claude mcp add -s user --transport http lain-remote https://api.lainmemo.dev/mcp --header "Authorization: Bearer <seu-token>"`,
  Genérico: `POST https://api.lainmemo.dev/mcp + Authorization: Bearer <seu-token>\n(stateless, por tenant; mesma surface do stdio)`,
}

/** Tabs copiáveis da Seção 3 — sem deps novas, só clipboard. */
export function McpTabs() {
  const [tab, setTab] = useState<Tab>('OpenCode')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPETS[tab])
    } catch {
      const ta = document.createElement('textarea')
      ta.value = SNIPPETS[tab]
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex gap-1 rounded-full bg-muted p-1" role="tablist" aria-label="Agentes">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1 font-mono text-[12px] font-medium transition-colors ${
              tab === t ? 'bg-accent text-foreground' : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="group relative mt-3 rounded-lg bg-[#0f1420] p-3 pr-11 dark:bg-black/60">
        <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed whitespace-pre text-white/85">
          {SNIPPETS[tab]}
        </pre>
        <button
          type="button"
          onClick={copy}
          title={copied ? 'Copiado!' : 'Copiar comando'}
          aria-label={copied ? 'Copiado!' : 'Copiar comando'}
          className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-4 text-emerald-400" weight="bold" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  )
}

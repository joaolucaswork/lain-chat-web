import { useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'

/** Bloco de comando com botão copiar (mesmo padrão do card MCP). */
function Cmd({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = children
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="group relative rounded-lg bg-[#0f1420] p-3 pr-11 dark:bg-black/60">
      <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed whitespace-pre text-white/85">
        {children}
      </pre>
      <button
        type="button"
        onClick={copy}
        title={copied ? 'Copiado!' : 'Copiar comando'}
        aria-label={copied ? 'Copiado!' : 'Copiar comando'}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        {copied ? (
          <Check className="size-4 text-emerald-400" weight="bold" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
    </div>
  )
}

function Section({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-baseline gap-2 text-[15px] font-bold tracking-tight">
        <span className="text-muted-foreground">{n}.</span> {title}
      </h2>
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

const AGENT_TABS = ['OpenCode', 'Claude Code', 'Genérico'] as const

const AGENT_SNIPPETS: Record<(typeof AGENT_TABS)[number], string> = {
  OpenCode: `opencode mcp add --global lain-remote --url https://api.lainmemo.dev/mcp --header "Authorization=Bearer <seu-token>"`,
  'Claude Code': `claude mcp add -s user --transport http lain-remote https://api.lainmemo.dev/mcp --header "Authorization: Bearer <seu-token>"`,
  Genérico: `POST https://api.lainmemo.dev/mcp + Authorization: Bearer <seu-token>
(stateless, por tenant; mesma surface do stdio)`,
}

/** Guia de instalação do MCP — o card MCP da home aponta para cá. */
export function DocsInstallPage() {
  const [tab, setTab] = useState<(typeof AGENT_TABS)[number]>('OpenCode')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
      <p className="text-xs text-muted-foreground">Documentação</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">
        Leve sua memória pra qualquer agente
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        O lain-memory expõe as mesmas 13 tools no stdio local e no remoto por
        tenant — recall, remember e grafo com os mesmos fatos das conversas.
      </p>

      <Section n="1" title="Conta remota (2 comandos, sem Docker)">
        <p>
          O caminho feliz: a memória mora na sua conta, nada para instalar
          além do repo.
        </p>
        <Cmd>{`git clone https://github.com/joaolucaswork/lain-memory && cd lain-memory
./setup.sh --remote --yes`}</Cmd>
        <p>
          Ele cria a conta, minta o token e escreve a entrada{' '}
          <code className="rounded bg-muted px-1 font-mono text-[12px]">
            lain-remote
          </code>{' '}
          no OpenCode/Claude detectados. Conta existente? Use{' '}
          <code className="rounded bg-muted px-1 font-mono text-[12px]">
            --key lm_...
          </code>{' '}
          em vez de criar outra.
        </p>
      </Section>

      <Section n="2" title="Local (self-host, dados na sua máquina)">
        <p>Precisa de Docker + uma LLM key; os dados ficam com você.</p>
        <Cmd>{`./setup.sh --wire --yes`}</Cmd>
        <p>
          Sobe o Qdrant, cria o <code className="rounded bg-muted px-1 font-mono text-[12px]">.env</code>,
          roda o smoke test e escreve a entrada{' '}
          <code className="rounded bg-muted px-1 font-mono text-[12px]">
            lain-memory
          </code>{' '}
          (stdio) nos agentes.
        </p>
      </Section>

      <Section n="3" title="Deu errado? Doctor">
        <Cmd>{`./setup.sh --doctor [--remote]`}</Cmd>
        <div className="overflow-hidden rounded-lg border border-border text-[12px]">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2 bg-muted px-3 py-2 font-medium text-foreground">
            <span>Sintoma</span>
            <span>Comando</span>
          </div>
          {[
            ['chave rejeitada (401)', './setup.sh --remote --key lm_...'],
            ['rate limit (429)', 'aguarde um minuto e rode de novo'],
            ['servidor inalcançável', 'confira rede/URL; localhost? suba com bun run dev'],
            ['agente sem entrada', './setup.sh --wire --yes (local) ou --remote (conta)'],
          ].map(([s, c]) => (
            <div
              key={s}
              className="grid grid-cols-[1fr_1.4fr] gap-2 border-t border-border px-3 py-2"
            >
              <span>{s}</span>
              <code className="font-mono">{c}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section n="4" title="Por agente">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {AGENT_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                tab === t ? 'bg-accent text-foreground' : 'text-foreground/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Cmd>{AGENT_SNIPPETS[tab]}</Cmd>
        <p>
          Timeout de 120s recomendado no remoto (remember/pgs encadeiam LLMs).
          Re-rodar o <code className="rounded bg-muted px-1 font-mono text-[12px]">--remote</code> rotaciona
          o token; a chave da conta fica em{' '}
          <code className="rounded bg-muted px-1 font-mono text-[12px]">
            ~/.config/lain/token
          </code>{' '}
          (0600, nunca vai para o config do agente).
        </p>
      </Section>
        </div>
      </div>
    </div>
  )
}

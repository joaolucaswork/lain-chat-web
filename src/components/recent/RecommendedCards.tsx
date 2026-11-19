import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { Plus, Brain, Sparkle, ArrowUpRight, Plug } from '@phosphor-icons/react'
import { Skeleton } from '@/components/ui/skeleton'

interface RecommendedCard {
  eyebrow: string
  title: string
  desc: string
  /** Prefill do composer (cards 1-2). */
  prompt?: string
  /** Quando presente, o clique navega em vez de preencher (card MCP). */
  href?: string
  pill: string
  count: string
  visual: 'capture' | 'recall' | 'mcp'
}

const CARDS: RecommendedCard[] = [
  {
    eyebrow: 'MCP universal',
    title: 'Leve sua memória pra qualquer agente',
    desc: 'Conecte o lain-memory via MCP no Claude Code, OpenCode ou Cursor — recall, remember e grafo com os mesmos fatos das conversas.',
    href: '/docs/instalacao',
    pill: 'Ver guia',
    count: '1 de 3',
    visual: 'mcp',
  },
  {
    eyebrow: 'Memória automática',
    title: 'Fale normal, ela guarda o essencial',
    desc: 'A Lain percebe o que importa no que você diz e guarda sozinha. É só conversar — ela lembra por você.',
    prompt: 'O deploy de sexta caiu por falta de memória no Redis e o endpoint /mcp exige Bearer.',
    pill: 'Salvar exemplo',
    count: '2 de 3',
    visual: 'capture',
  },
  {
    eyebrow: 'Recall com contexto',
    title: 'Respostas que lembram de você',
    desc: 'Antes de responder, ela busca memórias e conexões no grafo — sem você repetir tudo.',
    prompt: 'Com base no que você sabe sobre mim, por onde devo começar hoje?',
    pill: 'Testar recall',
    count: '3 de 3',
    visual: 'recall',
  },
]

function Visual({ kind }: { kind: RecommendedCard['visual'] }) {
  if (kind === 'capture') {
    // Mini-conversa: fala do usuário (bolha = token do chat) + resposta da Lain.
    return (
      <div className="flex h-[110px] flex-col justify-center gap-1.5 overflow-hidden rounded-lg bg-muted p-3 dark:bg-muted/60">
        <div className="max-w-[85%] self-end truncate rounded-2xl rounded-br-md bg-primary px-2.5 py-1.5 text-[10px] font-medium text-primary-foreground shadow-sm">
          deploy de sexta caiu por falta de memória no Redis
        </div>
        <div className="flex max-w-[85%] items-center gap-1.5 self-start rounded-2xl rounded-bl-md bg-card px-2.5 py-1.5 shadow-sm">
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Brain className="size-3 text-primary" weight="bold" />
          </span>
          <span className="truncate text-[10px] font-semibold text-card-foreground">
            Anotado, vou lembrar
          </span>
        </div>
      </div>
    )
  }
  if (kind === 'recall') {
    // Resposta com chips de contexto puxados do grafo.
    return (
      <div className="relative flex h-[110px] items-center justify-center overflow-hidden rounded-lg bg-muted dark:bg-muted/60">
        <div className="absolute -top-10 -left-10 size-32 rounded-full bg-primary/10" />
        <div className="absolute -right-8 -bottom-10 size-28 rounded-full bg-primary/5" />
        <div className="relative w-[74%] rounded-lg bg-card p-2.5 shadow-sm">
          <div className="mb-1.5 flex gap-1">
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              rotina
            </span>
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-foreground">
              projeto
            </span>
            <Sparkle className="ml-auto size-3.5 text-primary" weight="fill" />
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <div className="h-1.5 w-5/6 rounded-full bg-muted" />
            <div className="h-1.5 w-2/3 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    )
  }
  // MCP: bloco de terminal com o server + badge de plug (tokens, sem hex fixo).
  return (
    <div className="relative flex h-[110px] flex-col overflow-hidden rounded-lg bg-muted p-3 dark:bg-muted/60">
      <div className="mb-2 flex items-center gap-1">
        <span className="size-2 rounded-full bg-[#ff5f57]" />
        <span className="size-2 rounded-full bg-[#febc2e]" />
        <span className="size-2 rounded-full bg-[#28c840]" />
        <span className="ml-1 text-[9px] font-medium text-muted-foreground">lain-memory · mcp</span>
      </div>
      <div className="space-y-1 font-mono text-[9px] leading-relaxed">
        <div className="truncate text-primary">$ bun run <span className="text-foreground">mcp</span></div>
        <div className="truncate text-muted-foreground">tools: remember · recall · forget</div>
        <div className="truncate text-muted-foreground">graph_query · seed_extract · +8</div>
      </div>
      <span className="absolute right-2.5 bottom-2.5 flex size-7 items-center justify-center rounded-full bg-primary">
        <Plug className="size-4 text-primary-foreground" weight="bold" />
      </span>
    </div>
  )
}

/** Skeleton no formato dos 3 cards — mesmo grid/alturas para não dar salto de layout. */
export function RecommendedCardsSkeleton() {
  return (
    <motion.div
      key="recommended-skeleton"
      className="mt-8 w-full"
      aria-hidden
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeIn' } }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Skeleton className="mb-3 h-[21px] w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-6 rounded-md" />
            </div>
            <Skeleton className="h-[110px] w-full rounded-lg" />
            {/* WHY: min-h iguais aos dos cards reais (título 2 linhas,
                desc 4 linhas) — skeleton e conteúdo têm a mesma altura e
                a troca não empurra o título/input (layout centralizado). */}
            <div className="mt-3 min-h-[42px] space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <div className="mt-1 min-h-[84px] space-y-1.5 pt-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/** Estado vazio da home: explica o Lain em 3 cards clicáveis (estilo onboarding). */
export function RecommendedCards() {
  const navigate = useNavigate()

  const handleClick = (c: RecommendedCard) => {
    // Card MCP: abre o guia em vez de preencher o composer.
    if (c.href) {
      navigate(c.href)
      return
    }
    if (c.prompt) {
      window.dispatchEvent(new CustomEvent<string>('lain:prefill-composer', { detail: c.prompt }))
    }
  }

  return (
    <motion.div
      key="recommended"
      className="mt-8 w-full"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="mb-3 text-left text-[15px] font-bold tracking-tight">Comece com a Lain</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CARDS.map((c, i) => {
          return (
          <motion.button
            key={c.title}
            type="button"
            onClick={() => handleClick(c)}
            title={c.href ? 'Abrir guia de instalação' : 'Usar exemplo'}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="group flex min-w-0 cursor-pointer flex-col rounded-xl border border-border bg-card p-4 text-left shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{c.eyebrow}</span>
              <span
                role="button"
                aria-label={c.href ? `Abrir guia: ${c.title}` : `Usar exemplo: ${c.title}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors group-hover:bg-accent"
              >
                {c.href ? <ArrowUpRight className="size-4" /> : <Plus className="size-4" />}
              </span>
            </div>
            <Visual kind={c.visual} />
            <div className="mt-3 line-clamp-2 min-h-[42px] text-[15px] leading-snug font-bold text-foreground">{c.title}</div>
            <p className="mt-1 line-clamp-4 min-h-[84px] text-[13px] leading-relaxed text-muted-foreground">{c.desc}</p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
                {c.pill}
              </span>
              <span className="text-[11px] text-muted-foreground">{c.count}</span>
            </div>
          </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

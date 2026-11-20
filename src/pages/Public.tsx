import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GooPanel } from '@/components/GooPanel'
import { ViscoseH1 } from '@/components/ViscoseH1'
import { McpTabs } from '@/components/landing/McpTabs'
import { BrainStage } from '@/components/landing/BrainStage'
import { useLandingProgress, type LandingProgress } from '@/components/landing/useLandingProgress'

/**
 * Páginas públicas (fora do DemoGate/AuthGate): landing + privacidade +
 * termos. Servem de "Application home page" e links legais do OAuth
 * (Google exige URLs públicas — a home do app é murada por login).
 * Leves de propósito: import estático no bundle inicial, sem lazy.
 */

function PublicShell({
  children,
  scrollRef,
}: {
  children: React.ReactNode
  scrollRef?: React.RefObject<HTMLDivElement | null>
}) {
  /* Landing sempre dark (fósforo verde sobre #131416), independente do tema. */
  /* WHY scroll próprio: html/body têm overflow hidden (teclado virtual no
     chat mobile) — a landing rola no próprio container sem tocar no global. */
  return (
    <div ref={scrollRef} className="dark flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background/80 px-6 py-4 backdrop-blur-md sm:px-10">
        <Link to="/bem-vindo" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            L
          </span>
          <span className="text-lg font-bold">Lain</span>
        </Link>
        <Link
          to="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Entrar
        </Link>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="flex flex-col items-center gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-10">
        <span>© 2026 Lain — memória de longo prazo universal.</span>
        <nav className="flex gap-4">
          <Link to="/bem-vindo" className="hover:text-foreground hover:underline">
            Início
          </Link>
          <Link to="/privacidade" className="hover:text-foreground hover:underline">
            Privacidade
          </Link>
          <Link to="/termos" className="hover:text-foreground hover:underline">
            Termos
          </Link>
        </nav>
      </footer>
    </div>
  )
}

/**
 * Slot do stage direito. Etapa 2: BrainStage WebGL2 (Hero, morph=0) com
 * fallback p/ GooPanel. Etapa 3 liga o morph p/ o cérebro sem mexer no layout.
 */
function StageSlot({ progressRef }: { progressRef: React.RefObject<LandingProgress> }) {
  return (
    <div className="flex h-full items-center">
      <div className="w-full">
        <BrainStage progressRef={progressRef} />
      </div>
    </div>
  )
}

function HeroCopy() {
  return (
    <div className="text-left">
      <p className="inline-block rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
        MEMÓRIA DE LONGO PRAZO
      </p>
      <div className="mt-5">
        <ViscoseH1 />
      </div>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
        A Lain lembra de você entre conversas — no chat, no cofre de memórias
        e em qualquer agente de código via MCP.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/"
          className="rounded-full bg-primary px-6 py-3 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Entrar ou criar conta
        </Link>
        <a
          href="mailto:jlucaswrk@gmail.com?subject=Lain"
          className="rounded-full border border-border px-6 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Falar com a gente
        </a>
      </div>
      <p className="mt-12 font-mono text-[11px] tracking-[0.18em] text-muted-foreground/70" aria-hidden>
        ROLE ↓ PARA VER A MEMÓRIA TOMAR FORMA
      </p>
    </div>
  )
}

function MemoryBlocks() {
  const items = [
    {
      title: 'Extração silenciosa',
      body: 'Fatos, preferências e projetos capturados em background do que você diz (remember) — sem poluir com texto genérico do modelo.',
    },
    {
      title: 'Grafo de conexões',
      body: 'Entidades e relações ligadas entre si (recall + grafo), trazendo o contexto exato em cada turno.',
    },
    {
      title: 'Controle real no Cofre',
      body: 'Revise, confirme, arquive ou apague qualquer memória; exclusão total de conta e dados quando quiser.',
    },
  ]
  return (
    <div className="mt-10 space-y-8">
      {items.map((it) => (
        <div key={it.title} className="border-l-2 border-primary/40 pl-5">
          <h3 className="text-[15px] font-bold tracking-tight">{it.title}</h3>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{it.body}</p>
        </div>
      ))}
    </div>
  )
}

function ClosingCta() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-20 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="font-display max-w-xl text-3xl font-medium tracking-[-0.02em] text-balance sm:text-4xl">
          Comece com memória. Continue com contexto.
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to="/"
            className="rounded-full bg-primary px-6 py-3 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Criar conta gratuita
          </Link>
          <Link
            to="/docs/instalacao"
            className="rounded-full border border-border px-6 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Conectar um agente
          </Link>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const s2Ref = useRef<HTMLElement | null>(null)
  const s3Ref = useRef<HTMLElement | null>(null)
  const progressRef = useLandingProgress({ scroll: scrollRef, s2: s2Ref, s3: s3Ref })

  return (
    <PublicShell scrollRef={scrollRef}>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 sm:px-10 lg:px-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          <div className="min-w-0">
            <section aria-label="Apresentação" className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center py-12">
              <HeroCopy />
              <div className="mt-10 lg:hidden" aria-hidden>
                <GooPanel />
              </div>
            </section>
            <section ref={s2Ref} aria-label="Como a Lain lembra" className="py-20 sm:py-28">
              <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
                01 / MEMÓRIA ESTRUTURADA
              </p>
              <h2 className="font-display mt-4 max-w-md text-3xl font-medium tracking-[-0.02em] text-balance sm:text-4xl">
                Cada conversa vira estrutura, não histórico perdido.
              </h2>
              <MemoryBlocks />
              <div className="mt-10 lg:hidden" aria-hidden>
                <BrainStage progressRef={progressRef} fixedMorph={1} />
              </div>
            </section>
            <section ref={s3Ref} aria-label="Use em qualquer agente" className="py-20 sm:py-28">
              <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
                02 / MCP UNIVERSAL
              </p>
              <h2 className="font-display mt-4 max-w-md text-3xl font-medium tracking-[-0.02em] text-balance sm:text-4xl">
                O mesmo cérebro no chat e no seu terminal.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                A mesma memória em 1 comando — sem Docker, sem config manual.
              </p>
              <div className="mt-8 max-w-md">
                <McpTabs />
              </div>
            </section>
          </div>
          <aside className="relative hidden min-h-0 lg:block" aria-hidden>
            <div className="sticky top-16 h-[calc(100dvh-4rem)] overflow-hidden">
              <StageSlot progressRef={progressRef} />
            </div>
          </aside>
        </div>
      </div>
      <ClosingCta />
    </PublicShell>
  )
}

function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Atualizado em {updated}.</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_a]:text-foreground [&_a]:underline">
          {children}
        </div>
      </article>
    </PublicShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Política de Privacidade" updated="19 de novembro de 2026">
      <section>
        <h2>O que coletamos</h2>
        <p>
          Conta (nome e e-mail), o conteúdo das suas conversas e as memórias
          extraídas delas (fatos, preferências, projetos e conexões no grafo
          de conhecimento).
        </p>
      </section>
      <section>
        <h2>Como usamos</h2>
        <p>
          Para dar contexto às respostas, manter sua memória entre sessões e
          disponibilizá-la via MCP aos agentes que você conectar. Não vendemos
          seus dados nem os usamos para treinar modelos de terceiros.
        </p>
      </section>
      <section>
        <h2>Seus controles</h2>
        <p>
          Você pode revisar, confirmar, arquivar ou pedir para esquecer
          qualquer memória no cofre, e excluir conta e todos os dados a
          qualquer momento em Configurações → Dados (vale como pedido LGPD).
        </p>
      </section>
      <section>
        <h2>Login com Google</h2>
        <p>
          Usamos apenas nome e e-mail do seu perfil Google para criar e
          identificar sua conta.
        </p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>
          Dúvidas sobre privacidade: <a href="mailto:jlucaswrk@gmail.com">jlucaswrk@gmail.com</a>.
        </p>
      </section>
    </LegalShell>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Termos de Uso" updated="19 de novembro de 2026">
      <section>
        <h2>O serviço</h2>
        <p>
          A Lain é um assistente com memória de longo prazo: chat, cofre de
          memórias e acesso via MCP. O serviço é oferecido como está, em
          evolução contínua.
        </p>
      </section>
      <section>
        <h2>Sua conta</h2>
        <p>
          Você é responsável por manter o acesso à sua conta e pelo conteúdo
          que registra. Uma conta por pessoa; não compartilhe credenciais.
        </p>
      </section>
      <section>
        <h2>Uso aceitável</h2>
        <p>
          Não use a Lain para atividades ilegais, para armazenar dados
          sensíveis de terceiros sem consentimento ou para abusar dos limites
          (60 requisições/min por conta, 500 memórias por escopo).
        </p>
      </section>
      <section>
        <h2>Memórias e exclusão</h2>
        <p>
          Você pode apagar memórias e encerrar a conta quando quiser — a
          exclusão remove seus dados e não tem volta.
        </p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>
          <a href="mailto:jlucaswrk@gmail.com">jlucaswrk@gmail.com</a>.
        </p>
      </section>
    </LegalShell>
  )
}

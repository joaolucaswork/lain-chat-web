import { Link } from 'react-router-dom'
import { ViscoseH1 } from '@/components/ViscoseH1'

/**
 * Páginas públicas (fora do DemoGate/AuthGate): landing + privacidade +
 * termos. Servem de "Application home page" e links legais do OAuth
 * (Google exige URLs públicas — a home do app é murada por login).
 * Leves de propósito: import estático no bundle inicial, sem lazy.
 */

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
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

const FEATURES = [
  {
    title: 'Leve sua memória pra qualquer agente',
    desc: 'Conecte o lain-memory via MCP no Claude Code, OpenCode ou Cursor — recall, remember e grafo com os mesmos fatos das conversas.',
  },
  {
    title: 'Fale normal, ela guarda o essencial',
    desc: 'A Lain percebe o que importa no que você diz e guarda sozinha. É só conversar, ela lembra por você.',
  },
  {
    title: 'Respostas que lembram de você',
    desc: 'Antes de responder, ela busca memórias e conexões no grafo — sem você repetir tudo.',
  },
]

export function LandingPage() {
  return (
    <PublicShell>
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
        <ViscoseH1 />
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          A Lain lembra de você entre conversas — no chat, no cofre de memórias
          e em qualquer agente de código via MCP.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar ou criar conta
          </Link>
          <a
            href="mailto:jlucaswrk@gmail.com?subject=Lain"
            className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Falar com a gente
          </a>
        </div>
        <div className="mt-16 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-bold">{f.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
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

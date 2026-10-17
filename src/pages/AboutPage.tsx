import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const IS = [
  'Um harness de governança para agentes de código — a camada de controle entre intenção e execução',
  'Um portão de aprovação com tokens HMAC de uso único, ligados ao estado exato do git',
  'Uma trilha de auditoria pensada para reconstrução forense depois de qualquer ação do agente',
  'Isolamento de agentes com sessões tmux e perfis de ferramenta por capacidade',
  'Memória governada — auditável, atribuída, com reaper e detecção de contradição',
  'Hooks de ciclo de vida que aplicam política fora do prompt, não dentro dele',
  'Um sistema onde a política vive na aplicação, não na instrução',
]

const IS_NOT = [
  'Não é concorrente do modelo nem um LLM alternativo',
  'Não é um assistente pessoal — a origem em dogfooding não muda isso',
  'Não é ferramenta de produtividade — governança é o objetivo; produtividade vem como consequência',
  'Não compete com subagentes nativos do runtime',
  'Não é um sistema de memória feito para superar o recall nativo do modelo',
  'Não é um produto eterno — existe para um gap específico e uma janela de aprendizado',
  'Não substitui julgamento de engenharia',
]

const LAYERS = [
  { key: 'E', name: 'Execution Loop', desc: 'Roda o agente, gerencia turnos, spawna sessões isoladas' },
  { key: 'T', name: 'Tool Registry', desc: 'Limita e perfila quais ferramentas cada agente pode usar' },
  { key: 'C', name: 'Context Manager', desc: 'Decide que memória e contexto entram no prompt' },
  { key: 'S', name: 'State Store', desc: 'Persiste artefatos, memória, logs de auditoria e vault' },
  { key: 'L', name: 'Lifecycle Hooks', desc: 'Aplica política antes e depois das tool calls; bloqueia antes do dano' },
  { key: 'V', name: 'Evaluation', desc: 'Revisa depois da execução — autopsy, lições, scoring' },
]

type CourseLink = {
  label: string
  href: string
  note: string
}

type CourseModule = {
  n: string
  title: string
  goal: string
  study: string[]
  check: string
  links: CourseLink[]
}

const COURSE: CourseModule[] = [
  {
    n: '0',
    title: 'Pré-requisitos (sem Lain ainda)',
    goal: 'Conseguir ler o harness como um sistema Unix + git + criptografia aplicada — não como um chatbot.',
    study: [
      'Git de verdade: working tree, index (stage), HEAD, branch, git diff --cached, SHA de commit e de tree. Sem isso o portão HMAC é magia.',
      'HMAC vs hash vs criptografia. HMAC prova autenticidade e integridade com uma chave; não esconde o conteúdo. A Lain assina estado, não “intenção”.',
      'Fail closed vs fail open. Se a checagem de política falha, o default é bloquear. Governança que permite no erro é opcional.',
      'Processos Unix: stdin/stdout, sinais, tmux (sessão/pane), PM2 (daemon + logs). Agentes da Lain são processos isolados, não threads de um chat.',
      'Hooks de shell: um script que roda antes de git commit ou de uma tool call. Política mora aqui, não no prompt.',
      'JSON-RPC / HTTP: o MCP é um servidor stdio; a API da Lain é HTTP em 3334. Você precisa saber o que é um request/response.',
    ],
    check: 'Explica, sem olhar: a diferença entre “o modelo prometeu não commitar” e “o hook recusou o commit”. Se as duas frases soam iguais, volte aqui.',
    links: [
      { label: 'Pro Git — o que é Git (oficial, PT-BR)', href: 'https://git-scm.com/book/pt-br/v2/Primeiros-Passos-O-que-%C3%A9-Git%3F', note: 'snapshots, SHA, as três áreas' },
      { label: 'Pro Git — gravando alterações', href: 'https://git-scm.com/book/pt-br/v2/Fundamentos-do-Git-Gravando-Altera%C3%A7%C3%B5es-no-Reposit%C3%B3rio', note: 'working tree, index (stage), commit' },
      { label: 'Git e GitHub para iniciantes — Willian Justen (Udemy grátis)', href: 'https://www.udemy.com/course/git-e-github-para-iniciantes/', note: 'curso em vídeo, ~2h' },
      { label: 'HMAC — Wikipedia', href: 'https://pt.wikipedia.org/wiki/HMAC', note: 'autentica e garante integridade; não cifra o conteúdo' },
      { label: 'Função hash — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Fun%C3%A7%C3%A3o_hash', note: 'o que um SHA prova e o que ele não prova' },
      { label: 'Security by Design — falha segura e menor privilégio', href: 'https://ecotrust.io/blog/security-by-design', note: 'fail closed / fail secure, o default da Lain' },
      { label: 'Linux — Curso em Vídeo (Guanabara)', href: 'https://www.cursoemvideo.com/curso/linux/', note: 'terminal, processos, permissões' },
      { label: 'Como usar o tmux — TabNews', href: 'https://www.tabnews.com.br/josafaverissimo/tutorial-como-usar-o-tmux', note: 'sessão, janela, pane — o isolamento dos agentes' },
      { label: 'Git Hooks — Atlassian (PT)', href: 'https://www.atlassian.com/br/git/tutorials/git-hooks', note: 'script que roda antes do commit, independente do autor' },
      { label: 'Mensagens HTTP — MDN', href: 'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/Messages', note: 'request/response, o formato da API da Lain' },
      { label: 'JSON — MDN', href: 'https://developer.mozilla.org/pt-BR/docs/Learn_web_development/Core/Scripting/JSON', note: 'o corpo de quase tudo no harness' },
      { label: 'JSON-RPC — Wikipedia', href: 'https://pt.wikipedia.org/wiki/JSON-RPC', note: 'o MCP é JSON-RPC em stdio' },
      { label: 'TypeScript em 5 minutos — freeCodeCamp', href: 'https://www.freecodecamp.org/portuguese/news/aprenda-typescript-em-cinco-minutos-um-tutorial-para-iniciantes/', note: 'a linguagem do servidor' },
    ],
  },
  {
    n: '1',
    title: 'Tese — por que a Lain existe',
    goal: 'Memorizar o problema, não o produto. Sem tese, o resto parece feature soup.',
    study: [
      'Ler docs/POSITIONING.md inteiro. É o documento canônico. Uma sentenca: a Lain não substitui o modelo — torna o modelo governável.',
      'Ler docs/O-QUE-E-LAIN.md seções 1–2 (tese + problema). Anotar as perguntas forenses: o que mudou? quem autorizou?',
      'Decorar: “Prompt asks. Hook decides.” Instrução ≠ aplicação. Prompt se esquece, se injeta, se ignora. Hook não.',
      'Decorar: modelos mais fortes aumentam a necessidade de contenção. Capacidade sem governança é passivo, não ativo.',
    ],
    check: 'Escreve em 4 linhas, de memória: o que a Lain é, o que não é, onde a política vive, e o que acontece se o hook estiver fora do ar.',
    links: [
      { label: 'Falha segura (fail secure) — Security by Design', href: 'https://ecotrust.io/blog/security-by-design', note: 'quando a checagem cai, bloqueia — não libera' },
      { label: 'Princípio do menor privilégio — Netwrix', href: 'https://netwrix.com/pt/resources/blog/what-is-the-principle-of-least-privilege/', note: 'agente só recebe as tools do perfil, não “todas”' },
      { label: 'Injeção de prompt — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Inje%C3%A7%C3%A3o_de_prompt', note: 'por que instrução no prompt não é controle' },
      { label: 'O que é um ataque de injeção de prompt — IBM', href: 'https://www.ibm.com/br-pt/think/topics/prompt-injection', note: 'injeção direta vs indireta' },
    ],
  },
  {
    n: '2',
    title: 'Vocabulário (sem o jargão você não lê o código)',
    goal: 'Usar as palavras do POSITIONING.md com o sentido delas — não sinônimos vagos.',
    study: [
      'Harness H = (E, T, C, S, L, V) — as seis camadas. A maioria das mudanças toca uma. Três ou mais = mudança arquitetural.',
      'Hash-bound token: aprovação de uso único, HMAC, ligada a repo + HEAD + diff. Se o diff mudar depois, falha fechado.',
      'Blast radius: o dano possível de uma ação. Governança começa delimitando o raio, não expandindo ferramenta.',
      'Capability isolation: o agente só vê as tools do perfil (minimal / agent-lite / dev / full / critic). Não é o modelo “sendo cuidadoso”.',
      'Forensic replay: reconstruir a sessão só com artefatos — prompt, tools, diff, token, memória, hooks.',
      'Governed memory: não é recall melhor; é atribuição (quem escreveu), auditoria (o que mudou) e reaper (o que morre).',
    ],
    check: 'Para cada termo acima, aponta o arquivo onde ele vira código. Se só souber a definição, ainda não entendeu a Lain.',
    links: [
      { label: 'HMAC — Wikipedia', href: 'https://pt.wikipedia.org/wiki/HMAC', note: 'o “hash-bound token” é HMAC sobre o estado git' },
      { label: 'Reset desmistificado — Pro Git (as três árvores)', href: 'https://git-scm.com/book/pt-br/v2/Ferramentas-do-Git-Reset-Desmistificado', note: 'HEAD, index, working tree — o que o token amarra' },
      { label: 'Menor privilégio — Netwrix', href: 'https://netwrix.com/pt/resources/blog/what-is-the-principle-of-least-privilege/', note: 'capability isolation em linguagem de segurança clássica' },
      { label: 'Computação forense — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Computa%C3%A7%C3%A3o_forense', note: 'reconstruir o que aconteceu a partir de evidência' },
    ],
  },
  {
    n: '3',
    title: 'Mapa H = (E, T, C, S, L, V)',
    goal: 'Abrir o repositório e saber em que pasta cada invariante vive.',
    study: [
      'docs/harness-map.md — documento de onboarding. Lê a tabela das 6 camadas e os entry points.',
      'E — spawn.ts, pool-api.ts, checkpoint.ts, agent-sweeper.ts. Agente = sessão tmux + worktree, não uma goroutine.',
      'T — tools/definitions.ts, profiles.ts, mcp-proxy.ts (porta 3340). Schema JSON + perfil. Critic é read-only.',
      'C — progressive-context.ts, session-context.ts, prompt-builder.ts. O que entra no contexto é decisão do harness, não do modelo.',
      'S — mem0.ts, graphrag.ts, artifacts.ts, vault/. Persistência com trilha. Deleção sem log é bug.',
      'L — hooks/guardrails-hook.ts, hooks/block-git-gh.sh, guardrails no index.ts. Dispara ANTES da ação.',
      'V — autopsy.ts, lessons.ts, feedback-loop.ts, server/src/git-approval/__tests__/. Dispara DEPOIS. Confirma, não bloqueia.',
    ],
    check: 'Pega um arquivo qualquer em lain-core/ e classifica a camada. Se hesitar entre L e V, pergunta: isso impede ou confirma?',
    links: [
      { label: 'O que é MCP — IBM', href: 'https://www.ibm.com/br-pt/think/topics/model-context-protocol', note: 'a camada T: tools padronizadas entre modelo e sistema' },
      { label: 'Protocolo de contexto de modelo — Google Cloud', href: 'https://cloud.google.com/discover/what-is-model-context-protocol?hl=pt-BR', note: 'cliente, servidor, tools, stdio' },
      { label: 'JSON-RPC — Wikipedia', href: 'https://pt.wikipedia.org/wiki/JSON-RPC', note: 'o fio do MCP: method, params, result' },
      { label: 'TypeScript zero to hero — Glaucia Lemos', href: 'https://github.com/glaucia86/curso-typescript-zero-to-hero', note: 'para ler lain-core/ sem se perder nos tipos' },
    ],
  },
  {
    n: '4',
    title: 'Operar a Lain (o ritual cotidiano)',
    goal: 'Subir, ver, reiniciar e diagnosticar sem pedir ajuda a um modelo.',
    study: [
      'CLAUDE.md seção Commands + Port Map. Portas: 3333 (voz), 3334 (API), 3340 (MCP proxy), 3335 (chat UI).',
      'PM2: lain, lain-chat, lain-gesture. pm2 list / pm2 logs <nome> --nostream.',
      'Restart: nunca pm2 restart lain para mudança de código. Sempre delete + start (alias lain-restart) — senão o cache do Bun mente.',
      'Entradas: MCP stdio (server/src/index.ts) para o agente; HTTP (http-server.ts) para o resto. São processos diferentes.',
      'lain-workspace/: memórias, prefs, vault, artefatos. É o estado do harness, não o git do código.',
      'Logs: server/logs/guardrails.ndjson (bloqueios), ~/.pm2/logs/ (processos), transcripts/ (sessões).',
    ],
    check: 'Sobe a stack, curl http://127.0.0.1:3334/api/user-preferences, lê pm2 logs lain --nostream, e explica o que cada processo faz. Sem chute.',
    links: [
      { label: 'Métodos HTTP — MDN', href: 'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Reference/Methods', note: 'GET/POST da API em :3334' },
      { label: 'Mensagens HTTP — MDN', href: 'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/Messages', note: 'ler um curl -v sem medo' },
      { label: 'Linux — Curso em Vídeo', href: 'https://www.cursoemvideo.com/curso/linux/', note: 'ps, kill, logs, o que um daemon é' },
      { label: 'tmux — TabNews', href: 'https://www.tabnews.com.br/josafaverissimo/tutorial-como-usar-o-tmux', note: 'attach, detach, list-sessions — o dia a dia dos agentes' },
      { label: 'PM2 Quick Start (doc oficial)', href: 'https://pm2.keymetrics.io/docs/usage/quick-start/', note: 'start, list, logs, delete — o gerenciador da stack; a doc é em inglês' },
    ],
  },
  {
    n: '5',
    title: 'O wedge — commit HMAC (o primeiro controle real)',
    goal: 'Ver a Lain funcionar como segurança, não como texto. Este módulo é o exame prático.',
    study: [
      'Fluxo: prepare_git_commit_approval → token HMAC ligado a HEAD + index_tree + staged_diff → approve_git_commit → git commit.',
      'Código: server/src/git-approval/ (request.ts, sign.ts, validate.ts, hooks.ts, pretool.ts). Lê nessa ordem.',
      'Hook L: server/hooks/block-git-gh.sh. Sem token válido o commit morre com NO_APPROVAL / NO_REPO_APPROVAL.',
      'Propriedades: uso único, TTL (prepare 10 min, execute 5 min), fail closed se o diff mudar depois da emissão.',
      'Testes: bun test em server/src/git-approval/__tests__/. São a spec executável. Lê um teste de drift e um de token.',
    ],
    check: 'No repo com hook instalado: stage um arquivo, NÃO aprove, rode git commit. Tem que falhar. Depois prepare + approve + commit. Se os dois caminhos não forem previsíveis, você ainda não opera a Lain.',
    links: [
      { label: 'HMAC — Wikipedia', href: 'https://pt.wikipedia.org/wiki/HMAC', note: 'o token de aprovação é um HMAC, não um “ok” no chat' },
      { label: 'Git Hooks — Atlassian', href: 'https://www.atlassian.com/br/git/tutorials/git-hooks', note: 'pre-commit: se o script sair ≠ 0, o commit não existe' },
      { label: 'Hooks do Git — Pro Git', href: 'https://git-scm.com/book/pt-br/v2/Customizando-o-Git-Hooks-do-Git', note: 'client-side vs server-side' },
      { label: 'Uma política imposta pelo Git — Pro Git', href: 'https://git-scm.com/book/pt-br/v2/Customizando-o-Git-Uma-Pol%C3%ADtica-de-Exemplo-Imposta-pelo-Git', note: 'o ancestral conceitual do block-git-gh.sh' },
      { label: 'Gravando alterações — Pro Git', href: 'https://git-scm.com/book/pt-br/v2/Fundamentos-do-Git-Gravando-Altera%C3%A7%C3%B5es-no-Reposit%C3%B3rio', note: 'stage (index) é o que o token amarra, não o working tree' },
    ],
  },
  {
    n: '6',
    title: 'Hooks e guardrails — política fora do prompt',
    goal: 'Saber o que o modelo não consegue furar, mesmo querendo.',
    study: [
      'Duas camadas L: (1) check no MCP (index.ts, antes do dispatch); (2) PreToolUse hook (guardrails-hook.ts) para tools nativas do runtime.',
      'Categorias: destructive, exfiltration, injection, sequence. Lê server/packages/lain-core/src/guardrails/rules/.',
      'Experimento mental (e real, se puder): conteúdo externo com IGNORE PREVIOUS INSTRUCTIONS + git push --force. O hook tem que bloquear ANTES da execução.',
      'Audit: cada BLOCK/ESCALATE/WARN vira linha em guardrails.ndjson. Sem linha, o controle não existiu.',
    ],
    check: 'Lê uma regra em rules/, aponta o pattern, e descreve o que acontece no MCP e no PreToolUse. Cita o campo decision do ndjson.',
    links: [
      { label: 'Injeção de prompt — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Inje%C3%A7%C3%A3o_de_prompt', note: 'a categoria injection dos guardrails' },
      { label: 'Como evitar injeção de prompts — Cloudflare', href: 'https://www.cloudflare.com/pt-br/learning/ai/prompt-injection/', note: 'por que filtro no prompt não basta (abre no browser)' },
      { label: 'O que é injeção de prompt — IBM', href: 'https://www.ibm.com/br-pt/think/topics/prompt-injection', note: 'direta vs indireta (conteúdo externo)' },
      { label: 'Injeção de SQL — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Inje%C3%A7%C3%A3o_de_SQL', note: 'o análogo clássico: validar no motor, não na frase' },
      { label: 'OWASP Top 10 em vídeo (PT)', href: 'https://www.youtube.com/playlist?list=PLEqTHftpM91OZzAIOwMcAuQ4ciK1n4_Ll', note: 'injection, broken access, misconfiguration' },
    ],
  },
  {
    n: '7',
    title: 'Forense e artefatos — reconstruir depois do fato',
    goal: 'Tratar sessão de agente como evidência, não como conversa.',
    study: [
      'As 10 perguntas do POSITIONING.md § Forensics. Qualquer feature que não as responda está incompleta.',
      'Onde mora: artifacts.ts, transcripts/, git-approval storage, guardrails.ndjson, session-store, checkpoints.',
      'Spawn forense: qual agente, sessão, tools, contexto, diff, aprovação. Se faltar um, a cadeia quebra.',
      'Fail closed na prática: política indisponível = bloqueio. Permitir “só dessa vez” é desligar o harness.',
    ],
    check: 'Pega um transcript antigo em lain-workspace/ e reconstruí: quem spawnu, o que leu, o que tentou, o que foi bloqueado. Se não der, o sistema (ou você) falhou.',
    links: [
      { label: 'Computação forense — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Computa%C3%A7%C3%A3o_forense', note: 'evidência, cadeia, reconstrução depois do fato' },
      { label: 'Auditoria de sistemas — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Auditoria_de_sistemas', note: 'o que um log precisa ter para servir de prova' },
      { label: 'Falha segura — Security by Design', href: 'https://ecotrust.io/blog/security-by-design', note: 'política fora do ar = bloqueio, senão a trilha mente' },
    ],
  },
  {
    n: '8',
    title: 'Estado governado — memória, vault, reaper',
    goal: 'Parar de pensar em “o bot lembra” e passar a pensar em escrita atribuída.',
    study: [
      'Mem0 + Qdrant (semântico) e GraphRAG (grafo). remember/recall/forget são tools; o reaper apaga o que esfriou, com audit log.',
      'Vault: BIP39 → Argon2id → AES-256-GCM. Session token 30 min. Presence lock: operação sensível bloqueada na ausência.',
      'Regra de ouro: write com atribuição, delete com trilha. Memória sem audit é um buraco forense.',
      'Contradiction detector: memória nova vs velha. Stale memory injetada no contexto é um bug de C+S, não “o modelo errou”.',
    ],
    check: 'Salva uma memória, lista, esquece. Confere que o esquecimento deixou rastro. Sem rastro, o S layer está mentindo.',
    links: [
      { label: 'AES — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Advanced_Encryption_Standard', note: 'o cofre (vault) cifra com AES-256-GCM' },
      { label: 'O que é criptografia AES — Avast', href: 'https://www.avast.com/pt-br/c-what-is-aes-encryption-guide', note: 'simétrica: mesma chave abre e fecha' },
      { label: 'O que é BIP39 — Área Bitcoin', href: 'https://blog.areabitcoin.com.br/bip39/', note: '12/24 palavras viram a chave mestra do vault' },
      { label: 'Pesquisa vetorial e embeddings — Coursera (PT-BR)', href: 'https://www.coursera.org/learn/vector-search-and-embeddings-portugus-brasileiro', note: 'o que o Mem0/Qdrant faz no recall' },
      { label: 'Grafo — Wikipedia', href: 'https://pt.wikipedia.org/wiki/Grafo', note: 'nós e arestas: o GraphRAG em miniatura' },
    ],
  },
  {
    n: '9',
    title: 'Construir a Lain — como mudar sem destruir o harness',
    goal: 'Mexer numa camada de cada vez, com teste, fail closed e trilha.',
    study: [
      'Antes de qualquer feature: produz audit trail? Falha fechado? Política está no hook ou no prompt? Precisa de aprovação? Dá para reconstruir?',
      'Mudança que toca 3+ letras de H é proposta de arquitetura, não correção. Trata como tal.',
      'Onde começar a contribuir: git-approval (já tem suíte), uma regra de guardrail, um teste de fail-closed. Não um canal novo.',
      'Anti-roadmap: canal novo por curiosidade, UI antes do motor de política, feature que amplia capacidade sem reduzir blast radius.',
      'docs/MIND_OF_THE_BUILDER.md — por que o projeto tem a forma que tem. Lê depois da tese, não antes.',
    ],
    check: 'Escreve um PR imaginário de uma linha (“adicionar tool X”) e classifica E/T/C/S/L/V, blast radius, e se precisa de token. Se não souber classificar, não está pronto para commitar o harness.',
    links: [
      { label: 'Security by Design', href: 'https://ecotrust.io/blog/security-by-design', note: 'checklist: menor privilégio, falha segura, trilha' },
      { label: 'OWASP Top 10 em vídeo (PT)', href: 'https://www.youtube.com/playlist?list=PLEqTHftpM91OZzAIOwMcAuQ4ciK1n4_Ll', note: 'o que não deixar entrar no harness “porque é útil”' },
      { label: 'TypeScript zero to hero — Glaucia Lemos', href: 'https://github.com/glaucia86/curso-typescript-zero-to-hero', note: 'ler e escrever o código do servidor' },
      { label: 'MCP — IBM', href: 'https://www.ibm.com/br-pt/think/topics/model-context-protocol', note: 'adicionar tool = mexer na camada T, com schema' },
    ],
  },
]

export function AboutPage() {
  return (
    <ScrollArea className="h-full">
      <article className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        <header className="space-y-4">
          <img
            src="/lain.webp"
            alt="Lain"
            className="mx-auto w-40 rounded-lg"
          />
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Lain</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              HMAC by design: um harness de segurança e governança que torna
              agentes de código auditáveis, controláveis e seguros de operar
              em ambientes reais de engenharia.
            </p>
          </div>
        </header>

        <p className="text-sm leading-relaxed">
          A Lain não substitui o modelo. Torna o modelo governável. O LLM
          provê capacidade; o harness provê controle. Modelos mais fortes
          aumentam a superfície de risco — não a reduzem. Por isso a tese
          central é{' '}
          <em className="text-foreground">política fora do prompt</em>:
          instruções podem ser esquecidas, injetadas ou ignoradas. Um hook
          que bloqueia <code className="text-xs bg-muted px-1 py-0.5 rounded">git commit</code>{' '}
          sem token válido é aplicação estrutural.
        </p>

        <blockquote className="border-l-2 border-primary/50 pl-4 text-sm italic text-muted-foreground">
          Prompt asks. Hook decides.
        </blockquote>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            O que a Lain é
          </h2>
          <ul className="space-y-2">
            {IS.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            O que a Lain não é
          </h2>
          <ul className="space-y-2">
            {IS_NOT.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            O wedge
          </h2>
          <p className="text-sm leading-relaxed">
            O wedge inicial é aprovação de commit ligada a hash e sessões
            forenses — os dois já implementados, não aspiracionais.
          </p>
          <p className="text-sm leading-relaxed">
            Hash-bound commit approval muda a pergunta de{' '}
            <em>“esse agente pode commitar?”</em> para{' '}
            <em>
              “esse agente pode commitar exatamente este diff, neste repo,
              neste HEAD, nesta janela de tempo?”
            </em>{' '}
            O token é de uso único, assinado com HMAC, expira em 10 minutos
            (prepare→approve), tem 5 minutos para executar depois da
            aprovação, e falha fechado se o diff mudar depois da emissão.
          </p>
          <p className="text-sm leading-relaxed">
            Sessões forenses tornam cada spawn rastreável: qual agente, qual
            sessão, quais ferramentas, qual contexto, qual diff, qual
            aprovação. Juntas, respondem as duas perguntas que importam
            quando algo dá errado: <em>o que mudou?</em> e{' '}
            <em>quem autorizou?</em>
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Arquitetura
          </h2>
          <p className="text-sm leading-relaxed">
            A Lain envolve o agente como plugin (MCP stdio + HTTP API +
            lifecycle hooks). Uma instância de harness é:
          </p>
          <pre className="rounded-md bg-muted px-3 py-2 text-xs font-mono">
            H = (E, T, C, S, L, V)
          </pre>
          <div className="space-y-2">
            {LAYERS.map((layer) => (
              <div key={layer.key} className="flex gap-3 text-sm">
                <span className="w-5 shrink-0 font-mono font-semibold text-primary">
                  {layer.key}
                </span>
                <div>
                  <div className="font-medium">{layer.name}</div>
                  <div className="text-muted-foreground text-[13px] leading-relaxed">
                    {layer.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            TypeScript · Bun · MCP · PM2 · Swift · Mem0/Qdrant · Redis
          </p>
        </section>

        <Separator />

        <section id="curso" className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Curso — entender, operar e construir sem LLM
            </h2>
            <p className="text-sm leading-relaxed">
              Ordem de estudo para um engenheiro. Sem modelo no loop: lê o
              documento, abre o arquivo, roda o comando, verifica o checkpoint.
              Se o checkpoint falhar, não avance. Em cada módulo há cursos e
              artigos em português para o básico daquela peça.
            </p>
          </div>

          <div className="space-y-4">
            {COURSE.map((mod) => (
              <article
                key={mod.n}
                className="rounded-lg border border-border bg-card/50 p-4 space-y-3"
              >
                <header className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {mod.n}
                  </span>
                  <h3 className="text-sm font-semibold leading-snug">
                    {mod.title}
                  </h3>
                </header>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {mod.goal}
                </p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  {mod.study.map((item) => (
                    <li key={item} className="text-[13px] leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ol>
                <div className="border-t border-border pt-2 space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Cursos e leituras (PT)
                  </h4>
                  <ul className="space-y-1">
                    {mod.links.map((link) => (
                      <li key={link.href} className="text-[13px] leading-relaxed">
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {link.label}
                        </a>
                        <span className="text-muted-foreground"> — {link.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[13px] leading-relaxed border-t border-border pt-2">
                  <span className="font-medium text-foreground">Checkpoint. </span>
                  <span className="text-muted-foreground">{mod.check}</span>
                </p>
              </article>
            ))}
          </div>
        </section>
      </article>
    </ScrollArea>
  )
}

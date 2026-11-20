import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Eye, EyeSlash } from '@phosphor-icons/react'
import { RouteFallback } from '@/components/RouteFallback'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { setTenantName } from '@/hooks/useMe'

/**
 * Gate de entrada com Supabase Auth em 2 etapas (visual estilo Asana):
 * 1) email único — o BFF diz se a conta existe (login) ou não (cadastro);
 * 2) senha (login) ou nome + senha (cadastro), inputs Google-like.
 * Troca a sessão por cookie HttpOnly via /api/auth/exchange.
 */

/**
 * Input Google-like: label dentro do campo, flutua pra cima ao focar ou
 * preencher (peer + placeholder=" "). Olho opcional pra senha.
 */
function FloatInput({
  value,
  onChange,
  label,
  type = 'text',
  autoComplete,
  autoFocus,
  maxLength,
  inputMode,
  passwordToggle,
  bare,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  type?: string
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  inputMode?: 'numeric' | 'text'
  passwordToggle?: { show: boolean; onToggle: () => void }
  /** Sem borda (fundo suave): usado no campo de e-mail do gate. */
  bare?: boolean
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        type={passwordToggle ? (passwordToggle.show ? 'text' : 'password') : type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
        className={`peer w-full rounded px-4 pb-2 pt-6 text-[15px] outline-none ${bare ? 'border border-transparent bg-field text-neutral-900 focus:border-transparent dark:text-neutral-100' : 'border border-neutral-300 bg-white text-neutral-900 focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-200'} ${passwordToggle ? 'pr-11' : ''}`}
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-neutral-500 transition-all peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-neutral-700 peer-focus:dark:text-neutral-200 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs dark:text-neutral-400">
        {label}
      </span>
      {passwordToggle && (
        <button
          type="button"
          onClick={passwordToggle.onToggle}
          aria-label={passwordToggle.show ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 dark:text-neutral-400"
        >
          {passwordToggle.show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
        </button>
      )}
    </div>
  )
}

/** Cabeçalho do gate: marca (volta à landing) + seletor de tema na mesma linha. */
function GateHeader() {
  return (
    <div className="flex items-center justify-between px-8 pt-6">
      <Link
        to="/bem-vindo"
        aria-label="Lain — início"
        title="Início"
        className="text-xl font-bold hover:opacity-70"
      >
        Lain
      </Link>
      <ThemeToggle />
    </div>
  )
}

/** Logo "G" do Google (cores oficiais) para o botão de OAuth. */
function GoogleLogo({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.3.6 4.53 1.79l3.4-3.4A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z"
      />
    </svg>
  )
}

/** Traduz erros do Supabase Auth (em inglês) para mensagens amigáveis em PT. */
function friendlyAuthError(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Senha incorreta. Tente de novo.'
  if (m.includes('email not confirmed')) return 'Confirme seu email antes de entrar.'
  if (
    m.includes('user already registered') ||
    m.includes('already been registered') ||
    m.includes('already exists')
  )
    return 'Essa conta já existe. Entre com sua senha.'
  if (m.includes('token has expired') || m.includes('otp has expired') || m.includes('otp expired'))
    return 'Código expirado. Peça um novo código.'
  if (
    m.includes('token is invalid') ||
    m.includes('invalid token') ||
    m.includes('invalid otp') ||
    m.includes('invalid code')
  )
    return 'Código inválido. Confira e tente de novo.'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over email'))
    return 'Muitas tentativas. Aguarde um pouco e tente de novo.'
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'Informe um email válido.'
  return raw
}

export function AuthGate({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  /** null = ainda não checado; true = conta existe (login), false = cadastro. */
  const [exists, setExists] = useState<boolean | null>(null)
  const [method, setMethod] = useState<'password' | 'code'>('password')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  /**
   * checking = conferindo sessão no storage (retorno do OAuth?);
   * oauth = há sessão, exchange em curso (skeleton do chat, nunca o form);
   * none = sem sessão, mostra o formulário de login.
   * WHY callback travado em skeleton: o Supabase usa PKCE (?code= na URL)
   * e troca o código por sessão via rede — um getSession() único conclui
   * "sem sessão" antes disso e piscava o form no meio do login. O estado
   * inicial já nasce 'oauth' quando a URL é de callback, e o SIGNED_IN
   * (listener) cobre a detecção tardia.
   */
  const isAuthCallback =
    typeof window !== 'undefined' && /[?#].*(code=|access_token=)/.test(window.location.href)
  const [sessionCheck, setSessionCheck] = useState<'checking' | 'oauth' | 'none'>(
    isAuthCallback ? 'oauth' : 'checking',
  )
  const exchangedRef = useRef(false)

  // Volta do OAuth (Google): a sessão já está no storage — só falta o exchange.
  useEffect(() => {
    const client = supabase()
    if (!client) {
      setSessionCheck('none')
      return
    }
    let alive = true
    const runExchange = (token: string, email: string) => {
      if (exchangedRef.current) return
      exchangedRef.current = true
      setSessionCheck('oauth')
      // WHY só volta pro form em falha: no sucesso o onDone recarrega a
      // página — reverter aqui pintava o form por alguns frames (o flash).
      void exchange(token, email).then((ok) => {
        if (alive && !ok) setSessionCheck('none')
      })
    }
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return
      if (data.session) {
        runExchange(data.session.access_token, data.session.user.email ?? '')
      } else if (!isAuthCallback) {
        setSessionCheck('none')
      }
      // Callback sem sessão ainda: mantém skeleton até o SIGNED_IN chegar.
    })
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!alive || !session) return
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        runExchange(session.access_token, session.user.email ?? '')
      }
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function exchange(accessToken: string, emailHint: string, displayName?: string): Promise<boolean> {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, name: displayName }),
      })
      const data = (await res.json().catch(() => null)) as { tenant?: string; error?: string } | null
      if (!res.ok || !data?.tenant) {
        setError(data?.error ?? 'Falha ao abrir seu espaço. Tente de novo.')
        return false
      }
      setTenantName(displayName || emailHint.split('@')[0] || data.tenant)
      onDone()
      return true
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function validEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  }

  // Etapa 1: email único — descobre se a conta existe antes de pedir a senha.
  async function goStep2(e: React.FormEvent) {
    e.preventDefault()
    const clean = email.trim()
    if (!validEmail(clean)) {
      setError('Informe um email válido.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
      const data = (await res.json().catch(() => null)) as { exists?: boolean } | null
      if (!res.ok || typeof data?.exists !== 'boolean') {
        setError('Sem conexão com o servidor. Tente de novo.')
        return
      }
      setEmail(clean)
      setExists(data.exists)
      setStep(2)
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  // Cooldown do reenvio (SMTP padrão tem limite rígido).
  useEffect(() => {
    if (resendIn <= 0) return
    const t = window.setTimeout(() => setResendIn((v) => v - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendIn])

  async function sendCode() {
    const client = supabase()
    if (!client || busy) return
    const cleanEmail = email.trim()
    if (exists === false && !name.trim()) {
      setError('Informe seu nome.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      // exists=true → só entra; conta nova → cria (nome vai no exchange).
      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: exists !== true },
      })
      if (error) {
        setError(friendlyAuthError(error.message))
        return
      }
      setOtpSent(true)
      setResendIn(30)
      setInfo(`Código de 6 dígitos enviado para ${cleanEmail}. Vale por 1 hora.`)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    const client = supabase()
    if (!client || busy) return
    const clean = otp.trim()
    if (clean.length < 6) {
      setError('Digite o código de 6 dígitos.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const { data, error } = await client.auth.verifyOtp({
        email: email.trim(),
        token: clean,
        type: 'email',
      })
      if (error) {
        setError(friendlyAuthError(error.message))
        return
      }
      if (!data.session) {
        setError('Sessão não criada — tente de novo.')
        return
      }
      await exchange(
        data.session.access_token,
        email.trim(),
        exists === false ? name.trim() || email.trim() : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault()
    const client = supabase()
    if (!client || busy) return
    const cleanEmail = email.trim()
    const isSignup = exists === false
    if (isSignup) {
      if (!name.trim()) {
        setError('Informe seu nome.')
        return
      }
      if (password.length < 6) {
        setError('Crie uma senha com pelo menos 6 caracteres.')
        return
      }
    } else if (password.length < 6) {
      setError('Informe sua senha (mín. 6 caracteres).')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (isSignup) {
        const { data, error } = await client.auth.signUp({
          password,
          email: cleanEmail,
          options: { data: { display_name: name.trim().slice(0, 40) } },
        })
        if (error) {
          setError(friendlyAuthError(error.message))
          return
        }
        if (!data.session) {
          // Confirmação de email ligada no dashboard: a conta passa a
          // existir — entra após clicar no link.
          setError('')
          setInfo('Conta criada! Confirme o email e depois entre com sua senha.')
          setExists(true)
          return
        }
        await exchange(data.session.access_token, cleanEmail, name.trim() || cleanEmail)
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) {
          setError(friendlyAuthError(error.message))
          return
        }
        if (!data.session) {
          setError('Sessão não criada — tente de novo.')
          return
        }
        await exchange(data.session.access_token, cleanEmail)
      }
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    const client = supabase()
    if (!client || busy) return
    setBusy(true)
    setError('')
    setSessionCheck('oauth')
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        setError(friendlyAuthError(error.message))
        setSessionCheck('none')
      }
      // Sucesso = redirect; o exchange acontece na volta (useEffect).
    } finally {
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white p-6 dark:bg-background">
        <p className="max-w-sm text-center text-sm text-neutral-500 dark:text-neutral-400">
          Login indisponível: falta configurar as chaves do Supabase no servidor.
        </p>
      </div>
    )
  }

  // WHY: botão principal segue o tema (verde --primary), não preto fixo.
  const blackBtn =
    'w-full rounded bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40'
  const ghostBtn =
    'flex w-full items-center justify-center gap-2 rounded border border-transparent bg-field px-4 py-3 font-medium text-neutral-900 disabled:opacity-40 dark:text-neutral-100'

  // Retorno do OAuth / clique no Google: skeleton da tela principal em vez
  // do formulário de login (flash regressivo). Checking inicial = blank
  // neutro (a checagem é local, ~ms) para não piscar skeleton errado.
  if (sessionCheck === 'oauth') return <RouteFallback variant="chat" />
  if (sessionCheck === 'checking') return <div className="h-dvh bg-white dark:bg-background" />

  // ── Etapa 1: só email (centralizado) ──
  if (step === 1) {
    return (
      <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-background dark:text-neutral-100">
        <GateHeader />
        <div className="flex flex-1 items-center justify-center p-6">
          <form onSubmit={goStep2} className="w-full max-w-2xl space-y-4 text-center">
            <div className="mx-auto w-full max-w-md space-y-4">
              <h1 className="text-3xl font-normal">Entre ou crie uma conta</h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Memória de longo prazo universal.
              </p>
              <button type="button" onClick={() => void google()} disabled={busy} className={ghostBtn}>
                <GoogleLogo />
                Continuar com Google
              </button>
              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">ou</span>
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>
              <div className="text-left">
                <FloatInput
                  value={email}
                  onChange={setEmail}
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  bare
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button type="submit" disabled={busy} className={blackBtn}>
                {busy ? 'Aguarde…' : 'Continuar'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 pt-10 text-left sm:grid-cols-3 sm:gap-6">
                {[
                  'Sua memória em qualquer agente — chat, cofre e MCP.',
                  'Ela guarda o essencial sozinha, é só conversar.',
                  'Respostas com seu contexto, sem repetir nada.',
                ].map((perk) => (
                  <div key={perk} className="flex gap-2">
                    <CheckCircle className="mt-0.5 size-5 shrink-0 text-neutral-700" />
                    <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-[13px]">{perk}</p>
                  </div>
                ))}
              </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Etapa 2: senha ou código por e-mail (OTP de 6 dígitos, expira em 1h) ──
  const isSignup = exists === false
  const step2Valid =
    isSignup ? name.trim().length > 0 && password.length >= 6 : password.length >= 6
  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-background dark:text-neutral-100">
      <GateHeader />
      <div className="flex flex-1 items-start justify-start p-6 sm:items-center">
        <form
          onSubmit={(e) => void (method === 'password' ? submitStep2(e) : verifyCode(e))}
          className="w-full max-w-md space-y-5 px-4 text-left sm:px-12"
        >
          <h1 className="text-2xl font-bold">{isSignup ? 'Crie sua conta' : 'Bem-vindo de volta!'}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {isSignup ? 'Criando a conta como' : 'Entrando como'} {email.trim()}.
          </p>
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800" role="tablist" aria-label="Método de acesso">
            {(['password', 'code'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => {
                  setMethod(m)
                  setError('')
                }}
                className={
                  method === m
                    ? 'flex-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-900 shadow-sm dark:bg-background dark:text-neutral-100'
                    : 'flex-1 rounded-full px-3 py-1.5 text-[13px] text-neutral-500 dark:text-neutral-400'
                }
              >
                {m === 'password' ? 'Senha' : 'Código por e-mail'}
              </button>
            ))}
          </div>
          {method === 'password' ? (
            <>
              {isSignup && (
                <FloatInput value={name} onChange={setName} label="Nome" autoComplete="nickname" autoFocus maxLength={40} />
              )}
              <div>
                <FloatInput
                  value={password}
                  onChange={setPassword}
                  label={isSignup ? 'Criar senha' : 'Senha'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  autoFocus={!isSignup}
                  passwordToggle={{ show: showPassword, onToggle: () => setShowPassword((v) => !v) }}
                />
                {isSignup && (
                  <p className="pt-1 text-xs text-neutral-500 dark:text-neutral-400">Crie uma senha com pelo menos 6 caracteres.</p>
                )}
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              {info && <p className="text-sm text-neutral-600 dark:text-neutral-400">{info}</p>}
              <button type="submit" disabled={busy || !step2Valid} className={blackBtn}>
                {busy ? 'Aguarde…' : isSignup ? 'Criar conta' : 'Entrar'}
              </button>
            </>
          ) : (
            <>
              {isSignup && (
                <FloatInput value={name} onChange={setName} label="Nome" autoComplete="nickname" autoFocus maxLength={40} />
              )}
              {!otpSent ? (
                <>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Vamos enviar um código de 6 dígitos para {email.trim()}.
                    {isSignup ? ' Ele cria sua conta na hora.' : ''}
                  </p>
                  {error && <p className="text-sm text-rose-600">{error}</p>}
                  {info && <p className="text-sm text-neutral-600 dark:text-neutral-400">{info}</p>}
                  <button type="button" onClick={() => void sendCode()} disabled={busy} className={blackBtn}>
                    {busy ? 'Enviando…' : 'Enviar código'}
                  </button>
                </>
              ) : (
                <>
                  <FloatInput
                    value={otp}
                    onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                    label="Código de 6 dígitos"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    inputMode="numeric"
                  />
                  {error && <p className="text-sm text-rose-600">{error}</p>}
                  {info && <p className="text-sm text-neutral-600 dark:text-neutral-400">{info}</p>}
                  <button type="submit" disabled={busy || otp.trim().length < 6} className={blackBtn}>
                    {busy ? 'Aguarde…' : isSignup ? 'Verificar e criar conta' : 'Verificar e entrar'}
                  </button>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Não recebeu?{' '}
                    <button
                      type="button"
                      onClick={() => void sendCode()}
                      disabled={busy || resendIn > 0}
                      className="underline disabled:opacity-40"
                    >
                      Reenviar{resendIn > 0 ? ` (${resendIn}s)` : ''}
                    </button>
                  </p>
                </>
              )}
            </>
          )}
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Email errado?{' '}
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setError('')
                setOtp('')
                setOtpSent(false)
                setResendIn(0)
              }}
              className="underline"
            >
              Voltar
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

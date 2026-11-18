import { useEffect, useState } from 'react'
import { CheckCircle, Eye, EyeSlash } from '@phosphor-icons/react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { setTenantName } from '@/hooks/useMe'

/**
 * Gate de entrada com Supabase Auth em 2 etapas (visual estilo Asana):
 * 1) centralizado: título + email + botão preto + perks;
 * 2) nome (signup) + senha, inputs Google-like com floating label.
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
  passwordToggle,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  type?: string
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  passwordToggle?: { show: boolean; onToggle: () => void }
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
        className={`peer w-full rounded border border-neutral-300 bg-white px-4 pb-2 pt-6 text-[15px] text-neutral-900 outline-none focus:border-neutral-900 ${passwordToggle ? 'pr-11' : ''}`}
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-neutral-500 transition-all peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-neutral-700 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs">
        {label}
      </span>
      {passwordToggle && (
        <button
          type="button"
          onClick={passwordToggle.onToggle}
          aria-label={passwordToggle.show ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500"
        >
          {passwordToggle.show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
        </button>
      )}
    </div>
  )
}

export function AuthGate({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Volta do OAuth (Google): a sessão já está no storage — só falta o exchange.
  useEffect(() => {
    const client = supabase()
    if (!client) return
    let alive = true
    client.auth.getSession().then(({ data }) => {
      if (!alive || !data.session) return
      void exchange(data.session.access_token, data.session.user.email ?? '')
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function exchange(accessToken: string, emailHint: string, displayName?: string) {
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
        return
      }
      setTenantName(displayName || emailHint.split('@')[0] || data.tenant)
      onDone()
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  function validEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  }

  function goStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!validEmail(email)) {
      setError('Informe um email válido.')
      return
    }
    setError('')
    setStep(2)
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault()
    const client = supabase()
    if (!client || busy) return
    const cleanEmail = email.trim()
    if (mode === 'signup') {
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
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          password,
          email: cleanEmail,
          options: { data: { display_name: name.trim().slice(0, 40) } },
        })
        if (error) {
          setError(error.message)
          return
        }
        if (!data.session) {
          // Confirmação de email ligada no dashboard: entra após clicar no link.
          setError('')
          setInfo('Conta criada! Confirme o email e depois faça login.')
          setMode('login')
          return
        }
        await exchange(data.session.access_token, cleanEmail, name.trim() || cleanEmail)
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) {
          setError(error.message)
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
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) setError(error.message)
      // Sucesso = redirect; o exchange acontece na volta (useEffect).
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: 'login' | 'signup') {
    setMode(next)
    setStep(1)
    setError('')
    setInfo('')
    setPassword('')
    setShowPassword(false)
    if (next === 'login') setName('')
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white p-6">
        <p className="max-w-sm text-center text-sm text-neutral-500">
          Login indisponível: falta configurar as chaves do Supabase no servidor.
        </p>
      </div>
    )
  }

  const blackBtn =
    'w-full rounded bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-40'
  const ghostBtn =
    'w-full rounded border border-neutral-300 bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-40'

  // ── Etapa 1: só email (centralizado) ──
  if (step === 1) {
    return (
      <div className="flex h-dvh flex-col bg-white text-neutral-900">
        <div className="px-8 pt-6 text-xl font-bold">Lain</div>
        <div className="flex flex-1 items-center justify-center p-6">
          <form onSubmit={goStep2} className="w-full max-w-md space-y-4 text-center">
            <h1 className="text-3xl font-normal">{mode === 'signup' ? 'Criar conta' : 'Entrar'}</h1>
            <p className="text-xs text-neutral-500">
              {mode === 'signup'
                ? 'Ao criar a conta, você concorda com os Termos e a Privacidade.'
                : 'Bem-vindo de volta — sua memória continua onde você parou.'}
            </p>
            <div className="text-left">
              <FloatInput
                value={email}
                onChange={setEmail}
                label="E-mail"
                type="email"
                autoComplete="email"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={busy} className={blackBtn}>
              Continuar
            </button>
            <button type="button" onClick={() => void google()} disabled={busy} className={ghostBtn}>
              Continuar com Google
            </button>
            <p className="text-sm text-neutral-600">
              {mode === 'signup' ? (
                <>
                  Já tem conta?{' '}
                  <button type="button" onClick={() => switchMode('login')} className="underline">
                    Entre
                  </button>
                </>
              ) : (
                <>
                  Sem conta?{' '}
                  <button type="button" onClick={() => switchMode('signup')} className="underline">
                    Crie uma
                  </button>
                </>
              )}
            </p>
            {mode === 'signup' && (
              <div className="grid grid-cols-3 gap-4 pt-10 text-left">
                {[
                  'Memória isolada só sua, em todos os devices.',
                  'Lembretes e contexto que atravessam sessões.',
                  'Apague tudo quando quiser, sem perguntas.',
                ].map((perk) => (
                  <div key={perk} className="flex gap-2">
                    <CheckCircle className="mt-0.5 size-5 shrink-0 text-neutral-700" />
                    <p className="text-xs leading-relaxed text-neutral-600">{perk}</p>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>
    )
  }

  // ── Etapa 2: nome + senha (alinhado à esquerda) ──
  const step2Valid =
    mode === 'login' ? password.length >= 6 : name.trim().length > 0 && password.length >= 6
  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <div className="px-8 pt-6 text-xl font-bold">Lain</div>
      <div className="flex flex-1 items-start justify-start p-6 sm:items-center">
        <form onSubmit={(e) => void submitStep2(e)} className="w-full max-w-md space-y-5 px-4 text-left sm:px-12">
          <h1 className="text-2xl font-bold">{mode === 'signup' ? 'Bem-vindo!' : 'Bem-vindo de volta!'}</h1>
          <p className="text-sm text-neutral-600">
            {mode === 'signup' ? 'Criando a conta como' : 'Entrando como'} {email.trim()}.
          </p>
          {mode === 'signup' && (
            <FloatInput value={name} onChange={setName} label="Nome" autoComplete="nickname" autoFocus maxLength={40} />
          )}
          <div>
            <FloatInput
              value={password}
              onChange={setPassword}
              label={mode === 'signup' ? 'Criar senha' : 'Senha'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              autoFocus={mode === 'login'}
              passwordToggle={{ show: showPassword, onToggle: () => setShowPassword((v) => !v) }}
            />
            {mode === 'signup' && (
              <p className="pt-1 text-xs text-neutral-500">Crie uma senha com pelo menos 6 caracteres.</p>
            )}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {info && <p className="text-sm text-neutral-600">{info}</p>}
          <button type="submit" disabled={busy || !step2Valid} className={blackBtn}>
            {busy ? 'Aguarde…' : 'Continuar'}
          </button>
          <p className="text-sm text-neutral-600">
            Email errado?{' '}
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setError('')
              }}
              className="underline"
            >
              Voltar
            </button>{' '}
            ·{' '}
            {mode === 'signup' ? (
              <button type="button" onClick={() => switchMode('login')} className="underline">
                Já tenho conta
              </button>
            ) : (
              <button type="button" onClick={() => switchMode('signup')} className="underline">
                Criar conta
              </button>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}

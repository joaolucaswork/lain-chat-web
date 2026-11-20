import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FloatInput, GateHeader, blackBtn, friendlyAuthError } from './primitives'
import type { ExchangeResult } from './useAuthExchange'

/**
 * Etapa 2: senha ou código por e-mail (OTP de 6 dígitos, expira em 1h).
 * Dona de todo o estado do passo (method, password, name, otp, otpSent,
 * resendIn, busy, error, info) — ao desmontar (Voltar), o reset é grátis.
 * O Supabase roda aqui; a troca por cookie vai pelo pai via onAuthenticated
 * (trava de duplicata centralizada no exchange).
 */
export function CredentialsStep({
  email,
  exists,
  onBack,
  onAuthenticated,
}: {
  email: string
  exists: boolean
  onBack: () => void
  onAuthenticated: (
    token: string,
    emailHint: string,
    displayName?: string,
  ) => Promise<ExchangeResult>
}) {
  // exists=true → login; conta nova → cadastro. Vira login se o dashboard
  // exigir confirmação de email (a conta passa a existir).
  const [isLogin, setIsLogin] = useState(exists)
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

  // Cooldown do reenvio (SMTP padrão tem limite rígido).
  useEffect(() => {
    if (resendIn <= 0) return
    const t = window.setTimeout(() => setResendIn((v) => v - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendIn])

  const isSignup = !isLogin

  async function sendCode() {
    const client = supabase()
    if (!client || busy) return
    const cleanEmail = email.trim()
    if (isSignup && !name.trim()) {
      setError('Informe seu nome.')
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      // isLogin → só entra; conta nova → cria (nome vai no exchange).
      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: !isLogin },
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
      const r = await onAuthenticated(
        data.session.access_token,
        email.trim(),
        isSignup ? name.trim() || email.trim() : undefined,
      )
      if (!r.ok && r.error) setError(r.error)
    } finally {
      setBusy(false)
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    const client = supabase()
    if (!client || busy) return
    const cleanEmail = email.trim()
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
          setIsLogin(true)
          return
        }
        const r = await onAuthenticated(data.session.access_token, cleanEmail, name.trim() || cleanEmail)
        if (!r.ok && r.error) setError(r.error)
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
        const r = await onAuthenticated(data.session.access_token, cleanEmail)
        if (!r.ok && r.error) setError(r.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const step2Valid =
    isSignup ? name.trim().length > 0 && password.length >= 6 : password.length >= 6

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-background dark:text-neutral-100">
      <GateHeader />
      <div className="flex flex-1 items-start justify-start p-6 sm:items-center">
        <form
          onSubmit={(e) => void (method === 'password' ? submitPassword(e) : verifyCode(e))}
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
              {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
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
                  {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
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
                  {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
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
            <button type="button" onClick={onBack} className="underline">
              Voltar
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

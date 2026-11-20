import { useEffect, useState } from 'react'
import { RouteFallback } from '@/components/RouteFallback'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { EmailStep } from './auth/EmailStep'
import { CredentialsStep } from './auth/CredentialsStep'
import { friendlyAuthError } from './auth/primitives'
import { useAuthExchange } from './auth/useAuthExchange'
import type { ExchangeResult } from './auth/useAuthExchange'

/**
 * Gate de entrada com Supabase Auth em 2 etapas (visual estilo Asana):
 * 1) email único — o BFF diz se a conta existe (login) ou não (cadastro);
 * 2) senha (login) ou nome + senha (cadastro), inputs Google-like.
 * Troca a sessão por cookie HttpOnly via /api/auth/exchange.
 *
 * Orquestra passo + OAuth; o estado de cada etapa mora no próprio passo
 * (Voltar desmonta a Etapa 2 e o reset é grátis). O exchange é centralizado
 * no useAuthExchange com trava de in-flight (listener SIGNED_IN x login
 * direto não disparam dois POST em paralelo).
 */
export function AuthGate({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  /** null = ainda não checado; true = conta existe (login), false = cadastro. */
  const [exists, setExists] = useState<boolean | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [gateError, setGateError] = useState('')
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
  const { exchange, inFlightRef } = useAuthExchange(onDone)

  // Volta do OAuth (Google): a sessão já está no storage — só falta o exchange.
  useEffect(() => {
    const client = supabase()
    if (!client) {
      setSessionCheck('none')
      return
    }
    let alive = true
    const runExchange = (token: string, hint: string) => {
      if (inFlightRef.current) return
      setSessionCheck('oauth')
      // WHY só volta pro form em falha: no sucesso o onDone recarrega a
      // página — reverter aqui pintava o form por alguns frames (o flash).
      void exchange(token, hint).then((r) => {
        if (!alive) return
        if (!r.ok && !r.suppressed) {
          setGateError(r.error)
          setSessionCheck('none')
        }
      })
    }
    const isCallbackNow = () => /[?#].*(code=|access_token=)/.test(window.location.href)
    const settleNoSession = () => {
      // Volta de cancelamento (back no Google / erro no callback): form de novo.
      if (/[?#].*(error=|error_code=)/.test(window.location.href)) {
        setGateError('Login com Google cancelado. Tente de novo.')
      }
      setSessionCheck('none')
    }
    const checkSession = () => {
      void client.auth.getSession().then(({ data }) => {
        if (!alive) return
        if (data.session) {
          runExchange(data.session.access_token, data.session.user.email ?? '')
        } else if (!isCallbackNow()) {
          settleNoSession()
        }
        // Callback sem sessão ainda: mantém skeleton até o SIGNED_IN chegar.
      })
    }
    checkSession()
    // WHY pageshow: o back button restaura a página do bfcache com o estado
    // congelado (skeleton) sem remontar — sem isso o skeleton carregava
    // infinitamente após cancelar no Google.
    const onPageShow = () => {
      if (inFlightRef.current) return
      setSessionCheck((cur) => {
        if (cur === 'oauth' && !isCallbackNow()) return 'checking'
        return cur
      })
      checkSession()
    }
    window.addEventListener('pageshow', onPageShow)
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
      window.removeEventListener('pageshow', onPageShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function google() {
    const client = supabase()
    if (!client || googleBusy) return
    setGoogleBusy(true)
    setGateError('')
    setSessionCheck('oauth')
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        setGateError(friendlyAuthError(error.message))
        setSessionCheck('none')
      }
      // Sucesso = redirect; o exchange acontece na volta (useEffect).
    } finally {
      setGoogleBusy(false)
    }
  }

  function handleNext(nextEmail: string, nextExists: boolean) {
    setEmail(nextEmail)
    setExists(nextExists)
    setStep(2)
  }

  async function handleAuthenticated(
    token: string,
    emailHint: string,
    displayName?: string,
  ): Promise<ExchangeResult> {
    return exchange(token, emailHint, displayName)
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

  // Retorno do OAuth / clique no Google: skeleton da tela principal em vez
  // do formulário de login (flash regressivo). Checking inicial = blank
  // neutro (a checagem é local, ~ms) para não piscar skeleton errado.
  if (sessionCheck === 'oauth') return <RouteFallback variant="chat" />
  if (sessionCheck === 'checking') return <div className="h-dvh bg-white dark:bg-background" />

  if (step === 1 || exists === null) {
    return (
      <EmailStep
        initialEmail={email}
        busy={googleBusy}
        serverError={gateError}
        onGoogle={() => void google()}
        onNext={handleNext}
        onClearServerError={() => setGateError('')}
      />
    )
  }

  return (
    <CredentialsStep
      email={email}
      exists={exists}
      onBack={() => setStep(1)}
      onAuthenticated={handleAuthenticated}
    />
  )
}

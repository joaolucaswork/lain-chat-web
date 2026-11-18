import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { setTenantName } from '@/hooks/useMe'

/** Gate de entrada com Supabase Auth: email+senha (login/cadastro) + Google. Troca a sessão por cookie HttpOnly via /api/auth/exchange. */
export function AuthGate({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const client = supabase()
    if (!client || busy) return
    const cleanEmail = email.trim()
    if (!cleanEmail || password.length < 6) {
      setError('Informe email e senha (mín. 6 caracteres).')
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
          options: { data: { display_name: name.trim().slice(0, 40) || undefined } },
        })
        if (error) {
          setError(error.message)
          return
        }
        if (!data.session) {
          // Confirmação de email ligada no dashboard: entra após clicar no link.
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

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Login indisponível: falta configurar as chaves do Supabase no servidor.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-6">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
          L
        </div>
        <h1 className="text-2xl font-semibold">Lain com memória</h1>
        <p className="text-sm text-muted-foreground">
          Entre com email e senha — sua memória fica isolada e você pode apagar tudo quando quiser.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
              setInfo('')
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError('')
              setInfo('')
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'signup' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            Criar conta
          </button>
        </div>
        {mode === 'signup' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome (ex: ana)"
            maxLength={40}
            autoComplete="nickname"
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center outline-none focus:border-primary"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          type="email"
          autoComplete="email"
          autoFocus
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center outline-none focus:border-primary"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha (mín. 6)"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center outline-none focus:border-primary"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={() => void google()}
          disabled={busy}
          className="w-full rounded-lg border border-input bg-background px-4 py-3 font-medium disabled:opacity-40"
        >
          Continuar com Google
        </button>
      </form>
    </div>
  )
}

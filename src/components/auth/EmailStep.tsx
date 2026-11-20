import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { FloatInput, GateHeader, GoogleLogo, blackBtn, ghostBtn, validEmail } from './primitives'

/**
 * Etapa 1: email único — o BFF diz se a conta existe (login) ou não
 * (cadastro) e o pai avança via onNext. Dono do input + busy/erro do
 * check-email; busy/erro do Google vêm do pai (fluxo OAuth mora lá).
 */
export function EmailStep({
  initialEmail,
  busy,
  serverError,
  onGoogle,
  onNext,
  onClearServerError,
}: {
  initialEmail: string
  busy: boolean
  serverError: string
  onGoogle: () => void
  onNext: (email: string, exists: boolean) => void
  onClearServerError: () => void
}) {
  const [value, setValue] = useState(initialEmail)
  const [checking, setChecking] = useState(false)
  const [localError, setLocalError] = useState('')

  const disabled = busy || checking
  const error = serverError || localError

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const clean = value.trim()
    if (!validEmail(clean)) {
      setLocalError('Informe um email válido.')
      return
    }
    onClearServerError()
    setLocalError('')
    setChecking(true)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
      const data = (await res.json().catch(() => null)) as { exists?: boolean } | null
      if (!res.ok || typeof data?.exists !== 'boolean') {
        setLocalError('Sem conexão com o servidor. Tente de novo.')
        return
      }
      onNext(clean, data.exists)
    } catch {
      setLocalError('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-background dark:text-neutral-100">
      <GateHeader />
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={(e) => void submit(e)} className="w-full max-w-2xl space-y-4 text-center">
          <div className="mx-auto w-full max-w-md space-y-4">
            <h1 className="text-3xl font-normal">Entre ou crie uma conta</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Memória de longo prazo universal.
            </p>
            <button type="button" onClick={onGoogle} disabled={disabled} className={ghostBtn}>
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
                value={value}
                onChange={setValue}
                label="E-mail"
                type="email"
                autoComplete="email"
                autoFocus
                bare
              />
            </div>
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <button type="submit" disabled={disabled} className={blackBtn}>
              {checking ? 'Aguarde…' : 'Continuar'}
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

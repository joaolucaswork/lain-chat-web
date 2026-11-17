import { useState } from 'react'
import { setTenantName } from '@/hooks/useMe'

/** Gate da demo (T6): visitante digita o nome → ganha tenant + key (cookie HttpOnly). */
export function TenantGate({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (clean.length < 2 || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/tenant/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      })
      const data = (await res.json().catch(() => null)) as { tenant?: string; error?: string } | null
      if (!res.ok || !data?.tenant) {
        setError(
          res.status === 409
            ? 'Esse nome já está em uso — tente outro.'
            : (data?.error ?? 'Falha ao criar sua conta. Tente de novo.'),
        )
        return
      }
      setTenantName(data.tenant)
      onDone()
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
          L
        </div>
        <h1 className="text-2xl font-semibold">Lain com memória</h1>
        <p className="text-sm text-muted-foreground">
          Uma demo pública: converse e eu lembro de você entre sessões. Escolha um nome para começar —
          seus dados ficam isolados e você pode apagar tudo quando quiser.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome (ex: ana)"
          maxLength={40}
          autoFocus
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-lg outline-none focus:border-primary"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={name.trim().length < 2 || busy}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? 'Criando…' : 'Começar a conversar'}
        </button>
      </form>
    </div>
  )
}

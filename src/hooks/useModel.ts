import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'lain-chat-model'

const MODELS = [
  'z-ai/glm-5.3-flash',
  'anthropic/claude-haiku-5.5',
]

/** Modelo barato fixo da demo (T7). O server ignora qualquer outro para visitantes. */
export const DEMO_MODEL = MODELS[0]

/** Visitante (nome de tenant em localStorage) não troca de modelo. */
export function isTenantUi(): boolean {
  try {
    return localStorage.getItem('lain_tenant_name') !== null
  } catch {
    return false
  }
}

function getStoredModel(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && MODELS.includes(stored)) return stored
    localStorage.setItem(STORAGE_KEY, MODELS[0])
  }
  return MODELS[0]
}

export function useModel() {
  const [model, setModelState] = useState(getStoredModel)

  const setModel = useCallback((m: string) => {
    // T7: visitante não troca de modelo (server também ignora).
    if (isTenantUi()) return
    setModelState(m)
    localStorage.setItem(STORAGE_KEY, m)
    // Sincroniza outras instâncias do hook (ex: sidebar + página de configurações)
    window.dispatchEvent(new CustomEvent('lain:model-change', { detail: m }))
  }, [])

  useEffect(() => {
    // Visitante sempre no barato, mesmo com valor antigo no storage.
    if (isTenantUi()) {
      setModelState(DEMO_MODEL)
      return
    }
    const onChange = (e: Event) => {
      const m = (e as CustomEvent).detail
      if (typeof m === 'string' && MODELS.includes(m)) setModelState(m)
    }
    window.addEventListener('lain:model-change', onChange)
    return () => window.removeEventListener('lain:model-change', onChange)
  }, [])

  if (isTenantUi()) return { model: DEMO_MODEL, setModel, models: [DEMO_MODEL] }
  return { model, setModel, models: MODELS }
}

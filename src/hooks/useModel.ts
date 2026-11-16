import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'lain-chat-model'

const MODELS = [
  'z-ai/glm-5.3-flash',
  'anthropic/claude-haiku-5.5',
]

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
    setModelState(m)
    localStorage.setItem(STORAGE_KEY, m)
    // Sincroniza outras instâncias do hook (ex: sidebar + página de configurações)
    window.dispatchEvent(new CustomEvent('lain:model-change', { detail: m }))
  }, [])

  useEffect(() => {
    const onChange = (e: Event) => {
      const m = (e as CustomEvent).detail
      if (typeof m === 'string' && MODELS.includes(m)) setModelState(m)
    }
    window.addEventListener('lain:model-change', onChange)
    return () => window.removeEventListener('lain:model-change', onChange)
  }, [])

  return { model, setModel, models: MODELS }
}

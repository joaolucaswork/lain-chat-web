import { useState, useCallback } from 'react'

const STORAGE_KEY = 'lain-chat-model'

const MODELS = [
  'deepseek/deepseek-v4-flash',
]

function getStoredModel(): string {
  const model = MODELS[0]
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, model)
  }
  return model
}

export function useModel() {
  const [model, setModelState] = useState(getStoredModel)

  const setModel = useCallback((m: string) => {
    setModelState(m)
    localStorage.setItem(STORAGE_KEY, m)
  }, [])

  return { model, setModel, models: MODELS }
}

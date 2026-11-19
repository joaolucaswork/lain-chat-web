import { useCallback, useEffect, useState } from 'react'

const KEY = 'lain-bubble-theme'

export type BubbleTheme = 'default' | 'primary'

function stored(): BubbleTheme {
  try {
    if (localStorage.getItem(KEY) === 'primary') return 'primary'
  } catch {}
  return 'default'
}

/**
 * WHY: Tema das mensagens do usuário — "Padrão" (cinza por modo) ou
 * "Principal" (verde --primary). Só alterna entre os dois tokens, sem
 * cor custom. Persistido em localStorage.
 */
export function useBubbleTheme() {
  const [bubble, setBubbleState] = useState<BubbleTheme>(stored)

  useEffect(() => {
    try {
      if (bubble === 'primary') localStorage.setItem(KEY, 'primary')
      else localStorage.removeItem(KEY)
    } catch {}
  }, [bubble])

  const setBubble = useCallback((b: BubbleTheme) => setBubbleState(b), [])

  return { bubble, setBubble }
}

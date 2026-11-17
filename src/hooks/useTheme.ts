import { useCallback, useEffect, useState } from 'react'

const KEY = 'lain-theme'

function initialDark(): boolean {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {}
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) return true
    try {
      if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return true
    } catch {}
  }
  return false
}

export function useTheme() {
  const [dark, setDark] = useState(initialDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light')
    } catch {}
  }, [dark])

  const toggle = useCallback(() => setDark((d) => !d), [])

  return { dark, toggle }
}

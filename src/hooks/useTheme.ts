import { useCallback, useEffect, useState } from 'react'

const KEY = 'lain-theme'

export type ThemeMode = 'system' | 'light' | 'dark'

function storedMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {}
  return 'system'
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } catch {
    return false
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(storedMode)
  const [dark, setDark] = useState<boolean>(() => resolveDark(storedMode()))

  useEffect(() => {
    setDark(resolveDark(theme))
    try {
      localStorage.setItem(KEY, theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Segue o SO enquanto estiver em "system".
  useEffect(() => {
    if (theme !== 'system') return
    let mq: MediaQueryList | undefined
    try {
      mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((m: ThemeMode) => setThemeState(m), [])
  const toggle = useCallback(
    () =>
      setDark((d) => {
        const v = !d
        setThemeState(v ? 'dark' : 'light')
        return v
      }),
    [],
  )

  return { dark, toggle, theme, setTheme }
}

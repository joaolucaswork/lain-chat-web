import { useEffect, useState, createContext, useContext } from 'react'

export type MeMode = 'owner' | 'demo' | 'tenant' | 'unknown'

const MeContext = createContext<MeMode>('unknown')

/** Modo resolvido pelo DemoGate (evita refetch em cada guarda). */
export function useMeMode(): MeMode {
  return useContext(MeContext)
}

export { MeContext }

const TENANT_NAME_KEY = 'lain_tenant_name'

/** Nome de exibição do visitante (guardado no signup; a key fica no cookie HttpOnly). */
export function getTenantName(): string | null {
  try {
    return localStorage.getItem(TENANT_NAME_KEY)
  } catch {
    return null
  }
}

export function setTenantName(name: string) {
  try {
    localStorage.setItem(TENANT_NAME_KEY, name)
  } catch {}
}

export function clearTenantName() {
  try {
    localStorage.removeItem(TENANT_NAME_KEY)
  } catch {}
}

/** /api/me do BFF: owner (modo legado), demo (gate aberto, sem cookie) ou tenant (com cookie). */
export function useMe() {
  const [mode, setMode] = useState<MeMode>('unknown')

  useEffect(() => {
    let alive = true
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : { mode: 'owner' }))
      .then((d) => {
        if (!alive) return
        const m = d?.mode
        setMode(m === 'demo' || m === 'tenant' || m === 'owner' ? m : 'owner')
      })
      .catch(() => {
        if (alive) setMode('owner')
      })
    return () => {
      alive = false
    }
  }, [])

  return mode
}

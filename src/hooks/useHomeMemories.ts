import { useState, useCallback, useEffect } from 'react'
import type { Memory } from '@/types'
import { sortByCreatedDesc, loadHiddenHomeIds } from '@/lib/homeMemories'

/** Camada de dados da home: carrega, ordena e filtra os ocultos. */
export function useHomeMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [allMemories, setAllMemories] = useState<Memory[] | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/vault/memories')
      const data: Memory[] = r.ok ? await r.json() : []
      const hidden = loadHiddenHomeIds()
      const sorted = sortByCreatedDesc(Array.isArray(data) ? data : [])
      setMemories(sorted.filter((m) => !hidden.has(m.id)).slice(0, 12))
      setAllMemories(sorted)
    } catch {
      /* mantém lista atual */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    reload().then(() => {
      if (!alive) return
    })
    return () => {
      alive = false
    }
  }, [reload])

  return { memories, setMemories, allMemories, setAllMemories, loading, reload }
}

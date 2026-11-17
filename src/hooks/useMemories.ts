import { useState, useCallback } from 'react'
import type { Memory, GraphNode, FeedbackAction, MemoryKind } from '@/types'
import { sendFeedback, forgetMemory, restoreMemory } from '@/lib/memoryApi'

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, gRes] = await Promise.all([
        fetch('/api/vault/memories'),
        fetch('/api/vault/graph'),
      ])
      if (!mRes.ok || !gRes.ok) throw new Error('vault not found')
      const m = await mRes.json()
      const g = await gRes.json()
      setMemories(m)
      setGraphNodes(g)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'vault not found')
    } finally {
      setLoading(false)
    }
  }, [])

  const getMemory = useCallback(async (id: string): Promise<Memory & { body?: string } | null> => {
    try {
      const res = await fetch(`/api/vault/memory/${encodeURIComponent(id)}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const getGraphNode = useCallback(async (key: string): Promise<(GraphNode & { body?: string }) | null> => {
    try {
      const res = await fetch(`/api/vault/graph/${encodeURIComponent(key)}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const patchMemory = useCallback((id: string, patch: Partial<Memory>) => {
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const vote = useCallback(async (id: string, action: FeedbackAction, kind?: MemoryKind) => {
    const fb = await sendFeedback(id, action, kind)
    patchMemory(id, {
      confidence: fb.confidence,
      last_confirmed_at: fb.last_confirmed_at,
      status: fb.status,
      kind: fb.kind,
    })
    return fb
  }, [patchMemory])

  const forget = useCallback(async (id: string) => {
    const res = await forgetMemory(id)
    let removed: Memory | null = null
    setMemories((prev) => {
      removed = prev.find((m) => m.id === id) ?? null
      return prev.filter((m) => m.id !== id)
    })
    return { ...res, removed }
  }, [])

  const restore = useCallback(async (trashId: string, project: string) => {
    const res = await restoreMemory(trashId, project)
    await load()
    return res
  }, [load])

  return { memories, graphNodes, loading, error, load, getMemory, getGraphNode, vote, forget, restore }
}

import { useState, useCallback } from 'react'
import type { Memory, GraphNode } from '@/types'

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

  return { memories, graphNodes, loading, error, load, getMemory, getGraphNode }
}

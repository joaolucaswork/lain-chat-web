import { useState, useCallback, useEffect, useRef } from 'react'
import type { Session, AgentPool } from '@/types'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { sessions, refresh }
}

export function useAgents() {
  const [pools, setPools] = useState<AgentPool[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/lain/agents')
      const data = await res.json()
      setPools(data.pools || [])
    } catch {}
  }, [])

  const killPool = useCallback(async (poolId: string) => {
    setLoading(true)
    try {
      await fetch('/api/lain/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poolId }),
      })
      await refresh()
    } catch {}
    setLoading(false)
  }, [refresh])

  const killAgent = useCallback(async (poolId: string, agentId: string) => {
    setLoading(true)
    try {
      await fetch('/api/lain/kill-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poolId, agent_id: agentId }),
      })
      await refresh()
    } catch {}
    setLoading(false)
  }, [refresh])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [refresh])

  return { pools, loading, refresh, killPool, killAgent }
}

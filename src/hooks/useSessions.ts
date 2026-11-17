import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Session } from '@/types'

interface SessionsDeps {
  activeSessionId: string | undefined
  clearActiveSession: () => Promise<void>
}

/** CRUD de sessões: lista (poll 10s), patch, delete, rename. */
export function useSessions({ activeSessionId, clearActiveSession }: SessionsDeps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch { /* polling silencioso */ }
  }, [])

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 10000)
    return () => clearInterval(interval)
  }, [refreshSessions])

  useEffect(() => {
    if (!openMenuId) {
      setConfirmDeleteId(null)
      return
    }
    const close = () => {
      setOpenMenuId(null)
      setConfirmDeleteId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenuId])

  const patchSession = useCallback(async (id: string, patch: { title?: string; favorite?: boolean }) => {
    const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('patch failed')
    await refreshSessions()
  }, [refreshSessions])

  const handleDeleteSession = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      if (id === activeSessionId) await clearActiveSession()
      await refreshSessions()
    } catch {
      /* erro silencioso */
    } finally {
      setDeletingId(null)
    }
  }, [activeSessionId, clearActiveSession, refreshSessions])

  const startRename = useCallback((s: Session) => {
    setOpenMenuId(null)
    setRenameValue(s.title || s.preview || '')
    setRenamingId(s.id)
  }, [])

  const saveRename = useCallback(async (s: Session) => {
    const id = s.id
    const value = renameValue.trim()
    setRenamingId(null)
    if (!value || value === (s.title || s.preview || '')) return
    try {
      await patchSession(id, { title: value })
    } catch { /* erro silencioso */ }
  }, [renameValue, patchSession])

  const toggleMenu = useCallback((id: string) => {
    setConfirmDeleteId(null)
    setOpenMenuId((cur) => (cur === id ? null : id))
  }, [])

  const favorites = useMemo(() => sessions.filter((s) => s.favorite), [sessions])
  const rest = useMemo(() => sessions.filter((s) => !s.favorite), [sessions])

  return {
    sessions, favorites, rest, deletingId,
    openMenuId, setOpenMenuId, confirmDeleteId, setConfirmDeleteId,
    renamingId, renameValue, setRenameValue, setRenamingId,
    refreshSessions, patchSession, handleDeleteSession,
    startRename, saveRename, toggleMenu,
  }
}

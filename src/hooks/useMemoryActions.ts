import { useState, useCallback, useEffect, useRef } from 'react'
import type { Memory, FeedbackAction } from '@/types'
import { sendFeedback, forgetMemory, restoreMemory } from '@/lib/memoryApi'
import { loadHiddenHomeIds, persistHiddenHomeIds } from '@/lib/homeMemories'

export interface UndoJob {
  message: string
  run: () => void
}

interface ActionsDeps {
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>
  setAllMemories: React.Dispatch<React.SetStateAction<Memory[] | null>>
  reload: () => Promise<void>
}

/** Ações vote/forget/hide + undo + seleção do modal. */
export function useMemoryActions({ setMemories, setAllMemories, reload }: ActionsDeps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)
  const [undo, setUndo] = useState<UndoJob | null>(null)
  const undoTimer = useRef<number | null>(null)

  const showUndo = useCallback((message: string, run: () => void) => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo({ message, run })
    undoTimer.current = window.setTimeout(() => setUndo(null), 8000)
  }, [])

  useEffect(() => {
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const getMemory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vault/memory/${encodeURIComponent(id)}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const patchOne = useCallback((id: string, patch: Partial<Memory>) => {
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    setAllMemories((prev) => (prev ? prev.map((m) => (m.id === id ? { ...m, ...patch } : m)) : prev))
  }, [setMemories, setAllMemories])

  const removeOne = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    setAllMemories((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
  }, [setMemories, setAllMemories])

  const handleVote = useCallback(async (id: string, action: FeedbackAction) => {
    setBusyId(id)
    try {
      const fb = await sendFeedback(id, action)
      patchOne(id, { confidence: fb.confidence, last_confirmed_at: fb.last_confirmed_at, status: fb.status, kind: fb.kind })
      setDetailVersion((v) => v + 1)
      if (action === 'archive') {
        showUndo('Memória arquivada — fora da busca, mantida como histórico.', () => {
          sendFeedback(id, 'unarchive')
            .then((u) => patchOne(id, { status: u.status, confidence: u.confidence }))
            .catch(() => {})
        })
      }
    } catch {
      /* erro silencioso */
    } finally {
      setBusyId(null)
    }
  }, [patchOne, showUndo])

  const handleForget = useCallback(async (id: string) => {
    setBusyId(id)
    try {
      const { trashId, project } = await forgetMemory(id)
      removeOne(id)
      if (selectedId === id) setSelectedId(null)
      if (trashId) {
        showUndo('Memória esquecida — não volta a ser extraída.', () => {
          restoreMemory(trashId, project).then(() => reload()).catch(() => {})
        })
      }
    } catch {
      /* erro silencioso */
    } finally {
      setBusyId(null)
    }
  }, [selectedId, showUndo, reload, removeOne])

  const handleHideHome = useCallback((id: string) => {
    const hidden = loadHiddenHomeIds()
    hidden.add(id)
    persistHiddenHomeIds(hidden)
    removeOne(id)
    if (selectedId === id) setSelectedId(null)
    showUndo('Memória ocultada da home.', () => {
      const cur = loadHiddenHomeIds()
      cur.delete(id)
      persistHiddenHomeIds(cur)
      reload()
    })
  }, [selectedId, showUndo, reload, removeOne])

  return {
    selectedId, setSelectedId, busyId, detailVersion,
    undo, setUndo, showUndo, getMemory,
    handleVote, handleForget, handleHideHome,
  }
}

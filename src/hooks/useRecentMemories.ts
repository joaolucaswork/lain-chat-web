import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { Memory, FeedbackAction } from '@/types'
import { sendFeedback, forgetMemory, restoreMemory } from '@/lib/memoryApi'
import {
  sortByCreatedDesc, filterByQuery,
  loadHiddenHomeIds, persistHiddenHomeIds,
  SEARCH_PAGE_SIZE, SEARCH_DEBOUNCE_MS,
} from '@/lib/homeMemories'

export interface UndoJob {
  message: string
  run: () => void
}

/** Estado completo da home num hook só: dados + busca + ações andam juntos. */
export function useRecentMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [allMemories, setAllMemories] = useState<Memory[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE_SIZE)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)
  const [undo, setUndo] = useState<UndoJob | null>(null)
  const undoTimer = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

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

  const showUndo = useCallback((message: string, run: () => void) => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo({ message, run })
    undoTimer.current = window.setTimeout(() => setUndo(null), 8000)
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
    const apply = (prev: Memory[]) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setMemories(apply)
    setAllMemories((prev) => (prev ? apply(prev) : prev))
  }, [])

  const removeOne = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    setAllMemories((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

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
  }, [removeOne, showUndo, reload])

  const handleHideHome = useCallback((id: string) => {
    const hidden = loadHiddenHomeIds()
    hidden.add(id)
    persistHiddenHomeIds(hidden)
    removeOne(id)
    showUndo('Memória ocultada da home.', () => {
      const cur = loadHiddenHomeIds()
      cur.delete(id)
      persistHiddenHomeIds(cur)
      reload()
    })
  }, [removeOne, showUndo, reload])

  const openSearch = useCallback(() => setSearchOpen(true), [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setDebounced('')
    setVisibleCount(SEARCH_PAGE_SIZE)
  }, [])

  const loadMoreSearch = useCallback(() => {
    setVisibleCount((v) => v + SEARCH_PAGE_SIZE)
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

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!searchOpen || allMemories !== null || searchLoading) return
    let alive = true
    setSearchLoading(true)
    fetch('/api/vault/memories')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Memory[]) => {
        if (alive) setAllMemories(sortByCreatedDesc(Array.isArray(data) ? data : []))
      })
      .catch(() => {
        if (alive) setAllMemories([])
      })
      .finally(() => {
        if (alive) setSearchLoading(false)
      })
    return () => {
      alive = false
    }
  }, [searchOpen, allMemories, searchLoading])

  useEffect(() => {
    if (searchOpen) {
      setVisibleCount(SEARCH_PAGE_SIZE)
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 60)
      return () => window.clearTimeout(t)
    }
  }, [searchOpen])

  useEffect(() => {
    setVisibleCount(SEARCH_PAGE_SIZE)
  }, [debounced])

  useEffect(() => {
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const searchFiltered = useMemo(() => {
    if (!allMemories) return []
    return filterByQuery(allMemories, debounced)
  }, [allMemories, debounced])

  return {
    memories, allMemories, loading,
    searchOpen, query, setQuery, debounced, visibleCount,
    searchLoading, searchFiltered, searchInputRef,
    openSearch, closeSearch, loadMoreSearch,
    selectedId, setSelectedId, busyId, detailVersion,
    undo, setUndo, getMemory, handleVote, handleForget, handleHideHome,
  }
}

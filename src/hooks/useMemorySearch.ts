import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Memory } from '@/types'
import { sortByCreatedDesc, filterByQuery, SEARCH_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/lib/homeMemories'

interface SearchDeps {
  allMemories: Memory[] | null
  setAllMemories: React.Dispatch<React.SetStateAction<Memory[] | null>>
}

/** Estado da busca da home: debounce, lazy-load, paginação. */
export function useMemorySearch({ allMemories, setAllMemories }: SearchDeps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE_SIZE)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

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
  }, [searchOpen, allMemories, searchLoading, setAllMemories])

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

  const searchFiltered = useMemo(() => {
    if (!allMemories) return []
    return filterByQuery(allMemories, debounced)
  }, [allMemories, debounced])

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

  return {
    searchOpen, query, setQuery, debounced, visibleCount,
    searchLoading, searchFiltered, openSearch, closeSearch,
    loadMoreSearch, searchInputRef,
  }
}

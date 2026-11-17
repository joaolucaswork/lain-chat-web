import { useState, useMemo } from 'react'
import type { Memory } from '@/types'
import { groupByMonthDay } from '@/lib/groupMemories'

/** Filtros do vault: busca + projeto + tag, com derivados. */
export function useMemoryFilters(memories: Memory[]) {
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState('')
  const [activeTag, setActiveTag] = useState('')

  const filtered = useMemo(() => {
    let f = memories
    if (activeProject) f = f.filter((m) => m.project === activeProject)
    if (activeTag) f = f.filter((m) => (m.tags || []).includes(activeTag))
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(
        (m) =>
          m.preview.toLowerCase().includes(q) ||
          m.project.toLowerCase().includes(q) ||
          (m.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    }
    return f
  }, [memories, activeProject, activeTag, search])

  const grouped = useMemo(() => groupByMonthDay(filtered), [filtered])

  const projects = useMemo(
    () => [...new Set(memories.map((m) => m.project))].sort(),
    [memories]
  )

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>()
    memories.forEach((m) => (m.tags || []).forEach((t) => map.set(t, (map.get(t) || 0) + 1)))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
  }, [memories])

  return {
    search, setSearch, activeProject, setActiveProject,
    activeTag, setActiveTag, filtered, grouped, projects, tagCounts,
  }
}

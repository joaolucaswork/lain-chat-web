import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMemories } from '@/hooks/useMemories'
import type { Memory, FeedbackAction } from '@/types'
import { MemoryCard } from '@/components/MemoryCard'
import { MemoryDetail } from '@/components/MemoryDetail'
import { GraphDetail } from '@/components/GraphDetail'
import { UndoBar } from '@/components/UndoBar'
import { List, Funnel } from '@phosphor-icons/react'
import type { LayoutContext } from './Layout'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

interface DayGroup {
  key: string
  label: string
  count: number
  items: Memory[]
}

interface MonthGroup {
  key: string
  label: string
  days: DayGroup[]
}

export function MemoriesPage() {
  const { openMobileNav } = useOutletContext<LayoutContext>()
  const { memories, graphNodes, loading, error, load, getMemory, getGraphNode, vote, forget, restore } = useMemories()
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
  const [selectedGraphKey, setSelectedGraphKey] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [undo, setUndo] = useState<{ message: string; run: () => void } | null>(null)
  const undoTimer = useRef<number | null>(null)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const showUndo = useCallback((message: string, run: () => void) => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo({ message, run })
    undoTimer.current = window.setTimeout(() => setUndo(null), 8000)
  }, [])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo(null)
  }, [])

  const handleVote = useCallback(async (id: string, action: FeedbackAction) => {
    setBusyId(id)
    try {
      await vote(id, action)
      setDetailVersion((v) => v + 1)
      if (action === 'archive') {
        showUndo('Memória arquivada — fora da busca, mantida como histórico.', () => {
          vote(id, 'unarchive').then(() => setDetailVersion((v) => v + 1)).catch(() => {})
        })
      }
    } catch {
      /* erro silencioso: estado local não muda */
    } finally {
      setBusyId(null)
    }
  }, [vote, showUndo])

  const handleForget = useCallback(async (id: string) => {
    setBusyId(id)
    try {
      const { trashId, project } = await forget(id)
      if (selectedMemoryId === id) setSelectedMemoryId(null)
      if (trashId) {
        showUndo('Memória esquecida — não volta a ser extraída.', () => {
          restore(trashId, project).catch(() => {})
        })
      }
    } catch {
      /* erro silencioso: item continua na lista */
    } finally {
      setBusyId(null)
    }
  }, [forget, restore, selectedMemoryId, showUndo])

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

  const grouped = useMemo<MonthGroup[]>(() => {
    const sorted = [...filtered].sort((a, b) => {
      const ta = Date.parse(a.created || '')
      const tb = Date.parse(b.created || '')
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
      if (Number.isNaN(ta)) return 1
      if (Number.isNaN(tb)) return -1
      return tb - ta
    })
    const months: MonthGroup[] = []
    let curM: MonthGroup | null = null
    let curD: DayGroup | null = null
    for (const m of sorted) {
      const d = new Date(m.created)
      const valid = !Number.isNaN(d.getTime())
      const mKey = valid
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : 'sem-data'
      const dKey = valid
        ? `${mKey}-${String(d.getDate()).padStart(2, '0')}`
        : 'sem-data'
      if (!curM || curM.key !== mKey) {
        curM = {
          key: mKey,
          label: valid ? capitalize(monthFmt.format(d)) : 'Sem data',
          days: [],
        }
        months.push(curM)
        curD = null
      }
      if (!curD || curD.key !== dKey) {
        curD = {
          key: dKey,
          label: valid ? capitalize(dayFmt.format(d)) : 'Sem data',
          count: 0,
          items: [],
        }
        curM.days.push(curD)
      }
      curD.items.push(m)
      curD.count += 1
    }
    return months
  }, [filtered])

  const projects = useMemo(
    () => [...new Set(memories.map((m) => m.project))].sort(),
    [memories]
  )

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>()
    memories.forEach((m) => (m.tags || []).forEach((t) => map.set(t, (map.get(t) || 0) + 1)))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
  }, [memories])

  const handleGraphNodeClick = useCallback((key: string) => {
    setSelectedGraphKey(key)
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">vault nao encontrado</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={openMobileNav}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent md:hidden"
        >
          <List className="size-5" />
        </button>
        <h2 className="text-sm font-semibold md:hidden">Memórias</h2>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
      <div className={cn(
        'w-full shrink-0 space-y-4 overflow-y-auto border-b border-border bg-card p-3 md:w-56 md:border-r md:border-b-0',
        !showFilters && 'hidden md:block'
      )}>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Projetos
          </h3>
          <div className="space-y-0.5">
            {projects.map((p) => (
              <button
                key={p}
                onClick={() => setActiveProject(activeProject === p ? '' : p)}
                className={cn(
                  'w-full text-left px-2 py-1 text-sm rounded transition-colors',
                  activeProject === p
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1">
            {tagCounts.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? '' : t)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full border transition-colors',
                  activeTag === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {t.replace(/^#/, '')} ({n})
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Grafo
          </h3>
          <div className="space-y-0.5">
            {graphNodes.slice(0, 60).map((n) => (
              <button
                key={n.key}
                onClick={() => handleGraphNodeClick(n.key)}
                className="w-full text-left px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded truncate"
              >
                ● {n.key}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Input
            placeholder="buscar memorias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-w-0 flex-1 md:max-w-md"
          />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label="Mostrar filtros"
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors md:hidden',
              showFilters || activeProject || activeTag
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Funnel className="size-4" />
            Filtros
            {(activeProject || activeTag) && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {(activeProject ? 1 : 0) + (activeTag ? 1 : 0)}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {filtered.length} de {memories.length}
          </span>
          <span>{memories.length} memorias</span>
        </div>
        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <div className="mx-auto w-full min-w-0 max-w-2xl p-4 sm:p-6">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">carregando...</div>
            ) : (
              grouped.map((month) => (
                <section key={month.key}>
                  {month.days.map((day) => (
                    <div key={day.key}>
                      <div className="sticky top-0 z-10 -mx-3 bg-background px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold uppercase tracking-widest text-foreground">
                            {month.label}
                          </span>
                          <span className="rounded-full bg-muted px-3 py-1 text-[13px] font-medium text-muted-foreground">
                            {day.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {day.count}
                          </span>
                          <div className="h-px flex-1 bg-border/60" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        {day.items.map((m) => (
                          <MemoryCard
                            key={m.id}
                            memory={m}
                            onClick={setSelectedMemoryId}
                            onVote={handleVote}
                            onForget={handleForget}
                            busy={busyId === m.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <MemoryDetail
        memoryId={selectedMemoryId}
        onClose={() => setSelectedMemoryId(null)}
        getMemory={getMemory}
        onVote={handleVote}
        onForget={handleForget}
        busy={busyId === selectedMemoryId}
        refreshKey={detailVersion}
      />
      <GraphDetail
        nodeKey={selectedGraphKey}
        onClose={() => setSelectedGraphKey(null)}
        getNode={getGraphNode}
      />
      {undo && (
        <UndoBar
          message={undo.message}
          onUndo={() => { const run = undo.run; dismissUndo(); run() }}
          onDismiss={dismissUndo}
        />
      )}
      </div>
    </div>
  )
}

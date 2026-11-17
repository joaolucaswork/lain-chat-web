import { useEffect, useState, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMemories } from '@/hooks/useMemories'
import { useMemoryFilters } from '@/hooks/useMemoryFilters'
import type { FeedbackAction } from '@/types'
import { MemoryCard } from '@/components/MemoryCard'
import { MemoryDetail } from '@/components/MemoryDetail'
import { GraphDetail } from '@/components/GraphDetail'
import { UndoBar } from '@/components/UndoBar'
import { MemoryFilters } from '@/components/vault/MemoryFilters'
import { List, Funnel } from '@phosphor-icons/react'
import type { LayoutContext } from './Layout'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export function MemoriesPage() {
  const { openMobileNav } = useOutletContext<LayoutContext>()
  const { memories, graphNodes, loading, error, load, getMemory, getGraphNode, vote, forget, restore } = useMemories()
  const filters = useMemoryFilters(memories)
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">vault nao encontrado</p>
      </div>
    )
  }

  const activeFilterCount = (filters.activeProject ? 1 : 0) + (filters.activeTag ? 1 : 0)

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
        <MemoryFilters
          showFilters={showFilters}
          projects={filters.projects}
          activeProject={filters.activeProject}
          onSelectProject={filters.setActiveProject}
          tagCounts={filters.tagCounts}
          activeTag={filters.activeTag}
          onSelectTag={filters.setActiveTag}
          graphNodes={graphNodes}
          onGraphNodeClick={setSelectedGraphKey}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Input
              placeholder="buscar memorias..."
              value={filters.search}
              onChange={(e) => filters.setSearch(e.target.value)}
              className="w-full min-w-0 flex-1 md:max-w-md"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-label="Mostrar filtros"
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors md:hidden',
                showFilters || activeFilterCount > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Funnel className="size-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              {filters.filtered.length} de {memories.length}
            </span>
            <span>{memories.length} memorias</span>
          </div>
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div className="mx-auto w-full min-w-0 max-w-2xl p-4 sm:p-6">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">carregando...</div>
              ) : (
                filters.grouped.map((month) => (
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

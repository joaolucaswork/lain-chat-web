import { useEffect, useState, useMemo, useCallback } from 'react'
import { useMemories } from '@/hooks/useMemories'
import { MemoryCard } from '@/components/MemoryCard'
import { MemoryDetail } from '@/components/MemoryDetail'
import { GraphDetail } from '@/components/GraphDetail'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export function MemoriesPage() {
  const { memories, graphNodes, loading, error, load, getMemory, getGraphNode } = useMemories()
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
  const [selectedGraphKey, setSelectedGraphKey] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [load])

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <SidebarTrigger />
        <div className="ml-auto flex shrink-0 items-center">
          <ThemeToggle />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
      <div className="w-56 border-r border-border bg-card p-3 space-y-4 overflow-y-auto shrink-0">
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
        <div>
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

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="p-3 border-b border-border">
          <Input
            placeholder="buscar memorias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {filtered.length} de {memories.length}
          </span>
          <span>{memories.length} memorias</span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">carregando...</div>
            ) : (
              filtered.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  onClick={setSelectedMemoryId}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <MemoryDetail
        memoryId={selectedMemoryId}
        onClose={() => setSelectedMemoryId(null)}
        getMemory={getMemory}
      />
      <GraphDetail
        nodeKey={selectedGraphKey}
        onClose={() => setSelectedGraphKey(null)}
        getNode={getGraphNode}
      />
      </div>
    </div>
  )
}

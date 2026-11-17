import type { GraphNode } from '@/types'
import { cn } from '@/lib/utils'

interface MemoryFiltersProps {
  showFilters: boolean
  projects: string[]
  activeProject: string
  onSelectProject: (p: string) => void
  tagCounts: Array<[string, number]>
  activeTag: string
  onSelectTag: (t: string) => void
  graphNodes: GraphNode[]
  onGraphNodeClick: (key: string) => void
}

/** Sidebar do vault: projetos + tags + grafo. */
export function MemoryFilters({
  showFilters, projects, activeProject, onSelectProject,
  tagCounts, activeTag, onSelectTag, graphNodes, onGraphNodeClick,
}: MemoryFiltersProps) {
  return (
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
              onClick={() => onSelectProject(activeProject === p ? '' : p)}
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
              onClick={() => onSelectTag(activeTag === t ? '' : t)}
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
              onClick={() => onGraphNodeClick(n.key)}
              className="w-full text-left px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded truncate"
            >
              ● {n.key}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

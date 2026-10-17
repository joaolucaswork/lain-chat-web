import type { Memory } from '@/types'
import { Badge } from '@/components/ui/badge'

interface MemoryCardProps {
  memory: Memory
  onClick: (id: string) => void
}

export function MemoryCard({ memory, onClick }: MemoryCardProps) {
  const tags = (memory.tags || []).slice(0, 5)

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onClick(memory.id)}
    >
      <div className="text-sm font-semibold mb-1 text-card-foreground truncate">
        {memory.preview.slice(0, 70)}{memory.preview.length > 70 ? '...' : ''}
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground mb-1">
        <span>{memory.created || ''}</span>
        <span>{memory.project}</span>
      </div>
      <div className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
        {memory.preview}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
              {t.replace(/^#/, '')}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

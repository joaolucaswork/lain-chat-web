import type { Memory } from '@/types'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

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
      <div className="mb-1 truncate text-[16px] font-semibold leading-[1.7] tracking-[0.01em] text-card-foreground">
        {memory.preview.slice(0, 70)}{memory.preview.length > 70 ? '...' : ''}
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground mb-1">
        <span>{formatDateTime(memory.created)}</span>
        <span>{memory.project}</span>
      </div>
      <div className="line-clamp-2 text-[16px] leading-[1.8] tracking-[0.015em] text-muted-foreground">
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

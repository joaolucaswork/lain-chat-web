import { useState } from 'react'
import type { Memory, FeedbackAction } from '@/types'
import { feedbackOf } from '@/types'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Check, ClockCounterClockwise, X } from '@phosphor-icons/react'

interface MemoryCardProps {
  memory: Memory
  onClick: (id: string) => void
  onVote?: (id: string, action: FeedbackAction) => void
  onForget?: (id: string) => void
  busy?: boolean
}

export function MemoryCard({ memory, onClick, onVote, onForget, busy }: MemoryCardProps) {
  const tags = (memory.tags || []).slice(0, 5)
  const fb = feedbackOf(memory)
  const [confirmingForget, setConfirmingForget] = useState(false)

  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const act = (e: React.MouseEvent, fn?: () => void) => {
    e.stopPropagation()
    if (!busy) fn?.()
  }

  return (
    <div
      className={cn(
        'group bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors relative',
        fb.status === 'archived' && 'opacity-60'
      )}
      onClick={() => onClick(memory.id)}
    >
      <div className="mb-1 truncate text-[16px] font-semibold leading-[1.7] tracking-[0.01em] text-card-foreground pr-20">
        {memory.preview.slice(0, 70)}{memory.preview.length > 70 ? '...' : ''}
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground mb-1 items-center">
        <span>{formatDateTime(memory.created)}</span>
        <span>{memory.project}</span>
        {fb.status === 'archived' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            arquivada
          </Badge>
        )}
        {fb.confidence >= 1 && (
          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400" title="Confirmada por você">
            <Check className="size-3" weight="bold" />
          </span>
        )}
        {fb.kind === 'state' && (
          <span className="text-[10px]" title="Estado temporário — perde peso com o tempo">◔</span>
        )}
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

      {(onVote || onForget) && (
        <div
          className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1"
          onClick={stop}
        >
          {onVote && (
            <>
              <button
                type="button"
                title={fb.confidence >= 1 ? 'Confirmada' : 'Correta — protege do esquecimento'}
                aria-label="Marcar como correta"
                disabled={busy}
                onClick={(e) => act(e, () => onVote(memory.id, 'confirm'))}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md border transition-colors',
                  fb.confidence >= 1
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-border bg-background text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/50'
                )}
              >
                <Check className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                title={fb.status === 'archived' ? 'Voltar para ativas' : 'Não é mais assim — arquiva sem apagar'}
                aria-label={fb.status === 'archived' ? 'Desarquivar' : 'Arquivar: não é mais assim'}
                disabled={busy}
                onClick={(e) => act(e, () => onVote(memory.id, fb.status === 'archived' ? 'unarchive' : 'archive'))}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md border transition-colors',
                  fb.status === 'archived'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-border bg-background text-muted-foreground hover:text-amber-600 hover:border-amber-500/50'
                )}
              >
                <ClockCounterClockwise className="size-4" />
              </button>
            </>
          )}
          {onForget && (
            confirmingForget ? (
              <span className="flex items-center gap-1 rounded-md border border-destructive/50 bg-background px-1 py-0.5 text-[11px]">
                <button
                  type="button"
                  aria-label="Confirmar esquecer"
                  disabled={busy}
                  onClick={(e) => act(e, () => { setConfirmingForget(false); onForget(memory.id) })}
                  className="px-1 font-medium text-destructive hover:underline"
                >
                  esquecer?
                </button>
                <button
                  type="button"
                  aria-label="Cancelar"
                  onClick={(e) => act(e, () => setConfirmingForget(false))}
                  className="px-1 text-muted-foreground hover:text-foreground"
                >
                  não
                </button>
              </span>
            ) : (
              <button
                type="button"
                title="Esquecer — apaga e evita que volte"
                aria-label="Esquecer memória"
                disabled={busy}
                onClick={(e) => act(e, () => setConfirmingForget(true))}
                className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-destructive hover:border-destructive/50"
              >
                <X className="size-4" weight="bold" />
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

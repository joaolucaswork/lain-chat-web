import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, cn } from '@/lib/utils'
import type { Memory, FeedbackAction } from '@/types'
import { feedbackOf } from '@/types'
import { Tip } from '@/components/MemoryTip'
import { Check, ClockCounterClockwise, X } from '@phosphor-icons/react'
import { renderWikiHtml } from '@/lib/linkify'

interface MemoryDetailProps {
  memoryId: string | null
  onClose: () => void
  getMemory: (id: string) => Promise<(Memory & { body?: string }) | null>
  onVote?: (id: string, action: FeedbackAction) => void
  onForget?: (id: string) => void
  busy?: boolean
  refreshKey?: number
}

export function MemoryDetail({ memoryId, onClose, getMemory, onVote, onForget, busy, refreshKey }: MemoryDetailProps) {
  const [data, setData] = useState<(Memory & { body?: string }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmingForget, setConfirmingForget] = useState(false)

  useEffect(() => {
    if (!memoryId) {
      setData(null)
      return
    }
    setLoading(true)
    setConfirmingForget(false)
    getMemory(memoryId).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [memoryId, getMemory, refreshKey])

  return (
    <Dialog open={!!memoryId} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[80vh] max-w-[calc(100%-2rem)] overflow-y-auto bg-card p-4 text-card-foreground border-border data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-lg sm:p-6">
        <motion.div
          key={memoryId ?? 'empty'}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
        {loading || !data ? (
          <div aria-hidden>
            {/* linha 1: data */}
            <div className="mb-3">
              <Skeleton className="h-4 w-44" />
            </div>
            {/* linha 2: texto */}
            <div className="text-[16px] leading-[1.8]">
              <div className="flex items-center h-[1.8em]">
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex items-center h-[1.8em]">
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        ) : data ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {data.title || (data.created ? formatDateTime(data.created) : '')}
              </DialogTitle>
            </DialogHeader>
            {(data.tags || []).length > 0 && (
              <div className="mb-4 flex min-w-0 flex-wrap gap-1">
                {(data.tags || []).map((t: string) => (
                  <Badge key={t} variant="secondary" className="max-w-full truncate text-xs">
                    {t.replace(/^#/, '')}
                  </Badge>
                ))}
              </div>
            )}
            <div
              className="min-w-0 text-[15px] leading-[1.7] tracking-[0.01em] break-words whitespace-pre-wrap sm:text-[16px] sm:leading-[1.8] sm:tracking-[0.015em]"
              dangerouslySetInnerHTML={{
                __html: renderWikiHtml((data.body || '').trim()),
              }}
            />
            <div className="mt-6 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {data.created ? formatDateTime(data.created) : ''}{data.project ? ` · ${data.project}` : ''}
              </span>
            </div>
            {(onVote || onForget) && (() => {
              const fb = feedbackOf(data)
              const showStatus = fb.status === 'archived' || fb.confidence >= 1 || fb.kind === 'state'
              return (
                <div className="mt-3 border-t border-border pt-4">
                  {showStatus && (
                  <div className="mb-3 text-xs text-muted-foreground">
                    {fb.status === 'archived' ? (
                      <span>Arquivada — fora da busca, mantida como histórico.</span>
                    ) : fb.confidence >= 1 ? (
                      <span>
                        Confirmada{fb.last_confirmed_at ? ` em ${formatDateTime(fb.last_confirmed_at)}` : ''} — protegida do esquecimento.
                      </span>
                    ) : null}
                    {fb.kind === 'state' && (
                      <span> Estado temporário: perde peso com o tempo.</span>
                    )}
                  </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {onVote && (
                      <>
                        <Tip tip="confirm" side="top">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onVote(data.id, 'confirm')}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                              fb.confidence >= 1
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'border-border text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/50'
                            )}
                          >
                            <Check className="size-4" weight="bold" />
                            {fb.confidence >= 1 ? 'Confirmada' : 'Correta'}
                          </button>
                        </Tip>
                        <Tip tip={fb.status === 'archived' ? 'unarchive' : 'archive'} side="top">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onVote(data.id, fb.status === 'archived' ? 'unarchive' : 'archive')}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                              fb.status === 'archived'
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'border-border text-muted-foreground hover:text-amber-600 hover:border-amber-500/50'
                            )}
                          >
                            <ClockCounterClockwise className="size-4" />
                            {fb.status === 'archived' ? 'Desarquivar' : 'Não é mais assim'}
                          </button>
                        </Tip>
                      </>
                    )}
                    {onForget && (
                      confirmingForget ? (
                        <span className="inline-flex items-center gap-2 rounded-md border border-destructive/50 px-3 py-1.5 text-sm">
                          <span className="text-muted-foreground">Apagar e não trazer de volta?</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setConfirmingForget(false); onForget(data.id) }}
                            className="font-medium text-destructive hover:underline disabled:opacity-50"
                          >
                            esquecer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingForget(false)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            manter
                          </button>
                        </span>
                      ) : (
                        <Tip tip="forget" side="top">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmingForget(true)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive hover:border-destructive/50 disabled:opacity-50"
                          >
                            <X className="size-4" weight="bold" />
                            Esquecer
                          </button>
                        </Tip>
                      )
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        ) : null}
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

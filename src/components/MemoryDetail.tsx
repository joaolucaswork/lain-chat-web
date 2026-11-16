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
import { formatDateTime } from '@/lib/utils'
import type { Memory } from '@/types'

interface MemoryDetailProps {
  memoryId: string | null
  onClose: () => void
  getMemory: (id: string) => Promise<(Memory & { body?: string }) | null>
}

export function MemoryDetail({ memoryId, onClose, getMemory }: MemoryDetailProps) {
  const [data, setData] = useState<(Memory & { body?: string }) | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!memoryId) {
      setData(null)
      return
    }
    setLoading(true)
    getMemory(memoryId).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [memoryId, getMemory])

  const linkify = (text: string) =>
    text.replace(/\[\[([^\]]+)\]\]/g, '<a href="javascript:void(0)" class="text-primary hover:underline">$1</a>')

  return (
    <Dialog open={!!memoryId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card text-card-foreground border-border data-[state=open]:animate-none data-[state=closed]:animate-none">
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
                {data.preview?.slice(0, 70)}
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-muted-foreground mb-3">
              {formatDateTime(data.created)} · {data.project || ''}
            </div>
            {(data.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {(data.tags || []).map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t.replace(/^#/, '')}
                  </Badge>
                ))}
              </div>
            )}
            <div
              className="text-[16px] leading-[1.8] tracking-[0.015em] whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: linkify((data.body || '').trim()),
              }}
            />
          </>
        ) : null}
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

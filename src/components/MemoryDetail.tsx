import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : data ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {data.preview?.slice(0, 70)}
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-muted-foreground mb-3">
              {data.created || ''} · {data.project || ''}
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
              className="text-sm leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: linkify((data.body || '').trim()),
              }}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

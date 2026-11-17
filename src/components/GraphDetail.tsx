import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GraphNode } from '@/types'
import { renderWikiHtml } from '@/lib/linkify'

interface GraphDetailProps {
  nodeKey: string | null
  onClose: () => void
  getNode: (key: string) => Promise<(GraphNode & { body?: string }) | null>
}

export function GraphDetail({ nodeKey, onClose, getNode }: GraphDetailProps) {
  const [data, setData] = useState<(GraphNode & { body?: string }) | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!nodeKey) {
      setData(null)
      return
    }
    setLoading(true)
    getNode(nodeKey).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [nodeKey, getNode])

  return (
    <Dialog open={!!nodeKey} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[70vh] max-w-[calc(100%-2rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : data ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                {data.key || data.id || nodeKey}
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-muted-foreground mb-3">{data.type || ''}</div>
            <div
              className="min-w-0 text-sm leading-relaxed break-words whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: renderWikiHtml((data.body || '').trim()),
              }}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

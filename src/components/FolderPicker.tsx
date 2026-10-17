import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Folder, ChevronRight, ChevronUp, Home, Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FolderEntry {
  name: string
  isDir: boolean
}

interface BrowseResponse {
  path: string
  parent: string
  entries: FolderEntry[]
  error?: string
}

interface FolderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
  initialPath?: string | null
}

export function FolderPicker({ open, onOpenChange, onSelect, initialPath }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '~')
  const [entries, setEntries] = useState<FolderEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const browse = useCallback(async (p: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(p)}`)
      const data: BrowseResponse = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to browse')
        return
      }
      setCurrentPath(data.path)
      setEntries(data.entries)
    } catch {
      setError('Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      browse(initialPath || '~')
    }
  }, [open, initialPath, browse])

  const navigateTo = (p: string) => browse(p)

  const goUp = () => {
    const parts = currentPath.split('/')
    parts.pop()
    navigateTo(parts.join('/') || '/')
  }

  const goHome = () => navigateTo('~')

  const pathParts = currentPath.split('/').filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar pasta</DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-1">
          <button
            onClick={goHome}
            className="shrink-0 hover:text-foreground transition-colors p-0.5 rounded"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))}
                className="hover:text-foreground transition-colors truncate max-w-[120px]"
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <ScrollArea className="h-[300px] -mx-1">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Carregando...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-20 text-xs text-red-500">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Pasta vazia
            </div>
          ) : (
            <div className="space-y-0.5 px-1">
              {/* Up directory */}
              <button
                onClick={goUp}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>..</span>
              </button>
              {entries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => navigateTo(`${currentPath}/${entry.name}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-left"
                >
                  <Folder className="w-3.5 h-3.5 shrink-0 text-yellow-500" />
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0" title={currentPath}>
            {currentPath}
          </span>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => { onSelect(currentPath); onOpenChange(false) }}>
              <Check className="w-3.5 h-3.5 mr-1" />
              Selecionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

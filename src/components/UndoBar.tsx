import { X } from '@phosphor-icons/react'

interface UndoBarProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

export function UndoBar({ message, onUndo, onDismiss }: UndoBarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-lg dark:bg-black">
      <span className="min-w-0 flex-1 truncate text-muted-foreground sm:whitespace-normal">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="font-medium text-foreground hover:underline"
      >
        Desfazer
      </button>
      <button
        type="button"
        aria-label="Dispensar"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

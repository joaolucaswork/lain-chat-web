import { motion, AnimatePresence } from 'motion/react'
import { ChatTeardrop, DotsThree, PencilSimple, Star, Trash, Check } from '@phosphor-icons/react'
import type { Session } from '@/types'
import { cn } from '@/lib/utils'

interface SessionRowProps {
  session: Session
  active: boolean
  renaming: boolean
  renameValue: string
  setRenameValue: (v: string) => void
  menuOpen: boolean
  confirmDelete: boolean
  deleting: boolean
  onSwitch: (s: Session) => void
  onToggleMenu: () => void
  onStartRename: (s: Session) => void
  onSaveRename: (s: Session) => void
  onCancelRename: () => void
  onToggleFavorite: (s: Session) => void
  onDelete: (s: Session) => void
}

/** Linha da conversa: switch, rename inline, menu favoritar/excluir. */
export function SessionRow({
  session: s, active, renaming, renameValue, setRenameValue,
  menuOpen, confirmDelete, deleting,
  onSwitch, onToggleMenu, onStartRename, onSaveRename,
  onCancelRename, onToggleFavorite, onDelete,
}: SessionRowProps) {
  return (
    <div
      className={cn(
        'group relative flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      {s.favorite && (
        <ChatTeardrop className="size-4 shrink-0" weight="bold" aria-hidden />
      )}
      {renaming ? (
        <input
          autoFocus
          value={renameValue}
          maxLength={80}
          onChange={(e) => setRenameValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onSaveRename(s)
            if (e.key === 'Escape') onCancelRename()
          }}
          onBlur={() => void onSaveRename(s)}
          aria-label="Renomear conversa"
          className="min-w-0 flex-1 rounded border border-sidebar-ring bg-background px-1 py-0.5 text-sm text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          title={s.title || s.preview || s.id}
          onClick={() => onSwitch(s)}
          className="min-w-0 flex-1 truncate text-left"
        >
          {s.title || s.preview || 'Nova conversa'}
        </button>
      )}
      <button
        type="button"
        aria-label="Opções da conversa"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation()
          onToggleMenu()
        }}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <DotsThree className="size-4 rotate-90" weight="bold" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full right-0 z-30 mt-1 w-44 rounded-md bg-popover p-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => onStartRename(s)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-popover-foreground hover:bg-accent"
          >
            <PencilSimple className="size-3.5" />
            Renomear
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => onToggleFavorite(s)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-popover-foreground hover:bg-accent"
          >
            <Star className="size-3.5" weight={s.favorite ? 'fill' : 'regular'} />
            {s.favorite ? 'Desfavoritar' : 'Favoritar'}
          </button>
          <div className="mx-2 my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            disabled={deleting}
            onClick={() => onDelete(s)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50',
              confirmDelete ? 'text-destructive' : 'text-popover-foreground'
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={confirmDelete ? 'check' : 'trash'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex"
              >
                {confirmDelete ? <Check className="size-3.5" weight="bold" /> : <Trash className="size-3.5" />}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={deleting ? 'Excluindo...' : confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
                initial={{ x: -8, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 8, opacity: 0 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="flex"
              >
                {deleting ? 'Excluindo...' : confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      )}
    </div>
  )
}

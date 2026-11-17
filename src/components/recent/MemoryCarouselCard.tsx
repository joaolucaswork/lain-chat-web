import { motion } from 'motion/react'
import { DotsThree, EyeSlash } from '@phosphor-icons/react'
import type { Memory } from '@/types'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

interface CardProps {
  memory: Memory
  dimmed: boolean
  staggerDelay: number
  menuOpen: boolean
  onToggleMenu: (id: string) => void
  onHide: (id: string) => void
  onPointerDownPos: (x: number, y: number) => void
  onCardClick: (id: string, x: number, y: number) => void
}

/** Card do carrossel: preview + menu "ocultar da home". */
export function MemoryCarouselCard({
  memory: m, dimmed, staggerDelay, menuOpen,
  onToggleMenu, onHide, onPointerDownPos, onCardClick,
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.35, delay: staggerDelay, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={(e) => onPointerDownPos(e.clientX, e.clientY)}
      onClick={(e) => onCardClick(m.id, e.clientX, e.clientY)}
      className={`group relative flex h-[148px] cursor-pointer flex-col rounded-xl bg-muted p-3.5 text-left select-none transition-all duration-300 hover:bg-accent dark:bg-input/30 dark:hover:bg-input/40 ${dimmed ? 'shadow-[0_12px_32px_rgba(0,0,0,0.14)] dark:shadow-black/40' : 'shadow-none'}`}
    >
      <button
        type="button"
        aria-label="Opções da memória"
        onClick={(e) => {
          e.stopPropagation()
          onToggleMenu(m.id)
        }}
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none [@media(hover:none)]:opacity-100 data-[open=true]:opacity-100"
        data-open={menuOpen}
      >
        <DotsThree className="size-4" weight="bold" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-9 right-2 z-20 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => onHide(m.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
          >
            <EyeSlash className="size-3.5" />
            Ocultar da home
          </button>
        </div>
      )}
      <div className="mb-1 truncate pr-7 text-[13px] font-semibold leading-snug text-card-foreground">
        {m.title || formatDateTime(m.created)}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="line-clamp-3 text-[13px] leading-[1.6] text-muted-foreground">
          {m.preview}
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="shrink-0 text-[11px] text-muted-foreground">
          {formatDateTime(m.created)} · {m.project}
        </div>
        {(m.tags || []).length > 0 && (
          <div className="flex min-w-0 justify-end gap-1 overflow-hidden">
            {(m.tags || []).slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {t.replace(/^#/, '')}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

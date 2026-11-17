import { motion, AnimatePresence } from 'motion/react'
import { CaretDown, CaretLeft, CaretRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { RefObject } from 'react'

interface HeaderProps {
  titleLabel: string
  titleMode: string
  isSearching: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  searchOpen: boolean
  query: string
  setQuery: (q: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
  showLeft: boolean
  showRight: boolean
  onPrev: () => void
  onNext: () => void
  onViewAll: () => void
}

/** Título animado + collapse + busca + navegação do carrossel. */
export function RecentMemoriesHeader({
  titleLabel, titleMode, isSearching, collapsed, onToggleCollapse,
  searchOpen, query, setQuery, onOpenSearch, onCloseSearch,
  searchInputRef, showLeft, showRight, onPrev, onNext, onViewAll,
}: HeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-0.5">
        <h2 className="shrink-0 overflow-hidden text-sm font-medium text-muted-foreground">
          <AnimatePresence mode="wait" initial={false} custom={isSearching ? 1 : -1}>
            <motion.span
              key={titleMode}
              custom={isSearching ? 1 : -1}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 10 * d, filter: 'blur(2px)' }),
                center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } },
                exit: (d: number) => ({ opacity: 0, x: -10 * d, filter: 'blur(2px)', transition: { duration: 0.09, ease: [0.4, 0, 0.2, 1] } }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              className="inline-block whitespace-nowrap"
            >
              {titleLabel}
            </motion.span>
          </AnimatePresence>
        </h2>
        <button
          type="button"
          aria-label={collapsed ? 'Expandir memórias' : 'Recolher memórias'}
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <motion.span
            initial={false}
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex"
          >
            <CaretDown className="size-3.5" />
          </motion.span>
        </button>
        {searchOpen ? (
          <motion.div
            key="mem-search"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 240 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-w-[46vw] items-center gap-1 overflow-hidden"
          >
            <div className="relative w-full">
              <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onCloseSearch()
                }}
                placeholder="Buscar memórias..."
                className="h-8 w-full rounded-md border border-border bg-background pr-3 pl-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              type="button"
              aria-label="Fechar busca"
              onClick={onCloseSearch}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ) : (
          <button
            type="button"
            aria-label="Buscar memórias"
            title="Buscar memórias"
            onClick={onOpenSearch}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MagnifyingGlass className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="mem-nav"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                aria-label="Memórias anteriores"
                disabled={!showLeft}
                onClick={onPrev}
                className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <CaretLeft className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Próximas memórias"
                disabled={!showRight}
                onClick={onNext}
                className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <CaretRight className="size-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onViewAll}
          className="ml-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Ver todas
        </button>
      </div>
    </div>
  )
}

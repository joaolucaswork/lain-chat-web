import { motion, AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperType } from 'swiper'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import { CaretDown, CaretLeft, CaretRight, DotsThree, EyeSlash, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { Memory, FeedbackAction } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MemoryDetail } from '@/components/MemoryDetail'
import { UndoBar } from '@/components/UndoBar'
import { formatDateTime } from '@/lib/utils'
import { sendFeedback, forgetMemory, restoreMemory } from '@/lib/memoryApi'

const HIDDEN_HOME_KEY = 'lain-hidden-home-memories'
const COLLAPSED_HOME_KEY = 'lain-memories-home-collapsed'
const SEARCH_PAGE_SIZE = 12
const SEARCH_DEBOUNCE_MS = 250

function loadHiddenHomeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_HOME_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.filter((v) => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function RecentMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)
  const [undo, setUndo] = useState<{ message: string; run: () => void } | null>(null)
  const undoTimer = useRef<number | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [justOpened, setJustOpened] = useState(true)
  const openTimer = useRef<number | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_HOME_KEY) === '1'
    } catch {
      return false
    }
  })
  const swiperRef = useRef<SwiperType | null>(null)
  const downPos = useRef<{ x: number; y: number } | null>(null)
  const navigate = useNavigate()
  // ── Busca home (lazy: só carrega todas as memórias ao abrir) ──
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [allMemories, setAllMemories] = useState<Memory[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE_SIZE)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const updateEdges = useCallback((s: SwiperType) => {
    swiperRef.current = s
    setShowLeft(!s.isBeginning)
    setShowRight(!s.isEnd)
    setActiveIdx(s.activeIndex)
  }, [])

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/vault/memories')
      const data: Memory[] = r.ok ? await r.json() : []
      const hidden = loadHiddenHomeIds()
      const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
        const ta = Date.parse(a.created || '')
        const tb = Date.parse(b.created || '')
        if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
        if (Number.isNaN(ta)) return 1
        if (Number.isNaN(tb)) return -1
        return tb - ta
      })
      setMemories(sorted.filter((m) => !hidden.has(m.id)).slice(0, 12))
      // A busca da home reutiliza a mesma carga (todas, sem fatiar) — evita 2º fetch
      setAllMemories(sorted)
    } catch {
      /* mantém lista atual */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    reload().then(() => {
      if (!alive) return
    })
    return () => {
      alive = false
    }
  }, [reload])

  // Debounce da busca para não filtrar a cada tecla
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query])

  // Lazy: busca todas as memórias só quando a caixa abre (não pesa o load inicial da home)
  useEffect(() => {
    if (!searchOpen || allMemories !== null || searchLoading) return
    let alive = true
    setSearchLoading(true)
    fetch('/api/vault/memories')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Memory[]) => {
        if (!alive) return
        const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
          const ta = Date.parse(a.created || '')
          const tb = Date.parse(b.created || '')
          if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
          if (Number.isNaN(ta)) return 1
          if (Number.isNaN(tb)) return -1
          return tb - ta
        })
        setAllMemories(sorted)
      })
      .catch(() => {
        if (alive) setAllMemories([])
      })
      .finally(() => {
        if (alive) setSearchLoading(false)
      })
    return () => {
      alive = false
    }
  }, [searchOpen, allMemories, searchLoading])

  // Foco automático ao abrir + reseta paginação ao trocar o termo
  useEffect(() => {
    if (searchOpen) {
      setVisibleCount(SEARCH_PAGE_SIZE)
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 60)
      return () => window.clearTimeout(t)
    }
  }, [searchOpen])

  useEffect(() => {
    setVisibleCount(SEARCH_PAGE_SIZE)
  }, [debounced])

  const isSearching = searchOpen

  const searchFiltered = useMemo(() => {
    if (!allMemories) return []
    if (!debounced) return allMemories
    return allMemories.filter(
      (m) =>
        (m.title || '').toLowerCase().includes(debounced) ||
        m.preview.toLowerCase().includes(debounced) ||
        m.project.toLowerCase().includes(debounced) ||
        (m.tags || []).some((t) => t.toLowerCase().includes(debounced))
    )
  }, [allMemories, debounced])

  // Sync com o swiper: mesma seção, mesmos cards — só troca a fonte dos slides
  const swiperMemories = useMemo(
    () => (isSearching ? searchFiltered.slice(0, visibleCount) : memories),
    [isSearching, searchFiltered, visibleCount, memories]
  )
  const searchTotal = searchFiltered.length
  const searchHasMore = isSearching && searchTotal > visibleCount

  // Título do header com transição animada (recent <-> all <-> results)
  const titleMode = !isSearching ? 'recent' : debounced ? 'results' : 'all'
  const titleLabel =
    titleMode === 'recent'
      ? 'Memórias recentes'
      : titleMode === 'all'
        ? 'Todas as memórias'
        : `${searchTotal} resultado${searchTotal === 1 ? '' : 's'}`

  const loadMoreSearch = useCallback(() => {
    setVisibleCount((v) => v + SEARCH_PAGE_SIZE)
  }, [])

  // Ao trocar o termo, volta o carrossel pro início (sync swiper <-> busca)
  useEffect(() => {
    if (searchOpen) swiperRef.current?.slideTo(0, 0)
  }, [debounced, searchOpen])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    // busca exige lista expandida
    setCollapsed((v) => {
      if (!v) return v
      try {
        localStorage.setItem(COLLAPSED_HOME_KEY, '0')
      } catch {}
      return false
    })
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setDebounced('')
    setVisibleCount(SEARCH_PAGE_SIZE)
  }, [])

  const getMemory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vault/memory/${encodeURIComponent(id)}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const showUndo = useCallback((message: string, run: () => void) => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo({ message, run })
    undoTimer.current = window.setTimeout(() => setUndo(null), 8000)
  }, [])

  useEffect(() => {
    openTimer.current = window.setTimeout(() => setJustOpened(false), 1100)
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
      if (openTimer.current) window.clearTimeout(openTimer.current)
    }
  }, [])

  const handleVote = useCallback(async (id: string, action: FeedbackAction) => {
    setBusyId(id)
    try {
      const fb = await sendFeedback(id, action)
      const patch = (m: Memory) =>
        m.id === id
          ? { ...m, confidence: fb.confidence, last_confirmed_at: fb.last_confirmed_at, status: fb.status, kind: fb.kind }
          : m
      setMemories((prev) => prev.map(patch))
      setAllMemories((prev) => (prev ? prev.map(patch) : prev))
      setDetailVersion((v) => v + 1)
      if (action === 'archive') {
        showUndo('Memória arquivada — fora da busca, mantida como histórico.', () => {
          sendFeedback(id, 'unarchive')
            .then((u) => {
              setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, status: u.status, confidence: u.confidence } : m)))
              setDetailVersion((v) => v + 1)
            })
            .catch(() => {})
        })
      }
    } catch {
      /* erro silencioso */
    } finally {
      setBusyId(null)
    }
  }, [showUndo])

  const handleForget = useCallback(async (id: string) => {
    setBusyId(id)
    try {
      const { trashId, project } = await forgetMemory(id)
      setMemories((prev) => prev.filter((m) => m.id !== id))
      setAllMemories((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
      if (selectedId === id) setSelectedId(null)
      if (trashId) {
        showUndo('Memória esquecida — não volta a ser extraída.', () => {
          restoreMemory(trashId, project)
            .then(() => reload())
            .catch(() => {})
        })
      }
    } catch {
      /* erro silencioso */
    } finally {
      setBusyId(null)
    }
  }, [selectedId, showUndo, reload])

  const handleHideHome = useCallback((id: string) => {
    try {
      const hidden = loadHiddenHomeIds()
      hidden.add(id)
      localStorage.setItem(HIDDEN_HOME_KEY, JSON.stringify([...hidden]))
    } catch {}
    setMenuId(null)
    setMemories((prev) => prev.filter((m) => m.id !== id))
    setAllMemories((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))
    if (selectedId === id) setSelectedId(null)
    showUndo('Memória ocultada da home.', () => {
      try {
        const hidden = loadHiddenHomeIds()
        hidden.delete(id)
        localStorage.setItem(HIDDEN_HOME_KEY, JSON.stringify([...hidden]))
      } catch {}
      reload()
    })
  }, [selectedId, showUndo, reload])

  const slidePage = useCallback((dir: 1 | -1) => {
    const s = swiperRef.current
    if (!s) return
    s.slideTo(s.activeIndex + dir)
  }, [])

  useEffect(() => {
    if (!menuId) return
    const close = () => setMenuId(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuId(null)
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (selectedId) return
      if (e.key === 'ArrowLeft') slidePage(-1)
      else slidePage(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, slidePage])

  if (!loading && memories.length === 0) return null

  return (
    <AnimatePresence mode="wait" initial={false}>
      {loading ? (
        <motion.div
          key="skeleton"
          className="mt-8 w-full"
          aria-hidden
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.3, ease: 'easeIn' } }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="ml-1 h-4 w-14" />
            </div>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="flex h-[148px] w-[260px] shrink-0 flex-col gap-2 rounded-xl bg-muted p-3.5 dark:bg-input/30"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full flex-1" />
                <div className="flex gap-1">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </motion.div>
            ))}
            {/* quarto card cortado, igual ao carrossel real, para reservar a mesma largura */}
            <div className="h-[148px] w-[260px] shrink-0 opacity-0" />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeIn' } }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-0.5">
          <h2 className="shrink-0 overflow-hidden text-sm font-medium text-muted-foreground">
            <AnimatePresence mode="wait" initial={false} custom={isSearching ? 1 : -1}>
              <motion.span
                key={titleMode}
                custom={isSearching ? 1 : -1}
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: 10 * d, filter: 'blur(2px)' }),
                  center: {
                    opacity: 1,
                    x: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
                  },
                  exit: (d: number) => ({
                    opacity: 0,
                    x: -10 * d,
                    filter: 'blur(2px)',
                    transition: { duration: 0.09, ease: [0.4, 0, 0.2, 1] },
                  }),
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
            onClick={() => {
              if (collapsed) {
                setJustOpened(true)
                if (openTimer.current) window.clearTimeout(openTimer.current)
                openTimer.current = window.setTimeout(() => setJustOpened(false), 1100)
              }
              setCollapsed((v) => {
                try {
                  localStorage.setItem(COLLAPSED_HOME_KEY, v ? '0' : '1')
                } catch {}
                return !v
              })
            }}
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
          {/* Busca home: começa como ícone ao lado do dropdown, expande inline */}
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
                    if (e.key === 'Escape') closeSearch()
                  }}
                  placeholder="Buscar memórias..."
                  className="h-8 w-full rounded-md border border-border bg-background pr-3 pl-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <button
                type="button"
                aria-label="Fechar busca"
                onClick={closeSearch}
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
              onClick={openSearch}
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
            onClick={() => slidePage(-1)}
            className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <CaretLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Próximas memórias"
            disabled={!showRight}
            onClick={() => slidePage(1)}
            className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <CaretRight className="size-3.5" />
          </button>
            </motion.div>
          )}
        </AnimatePresence>
          <button
            type="button"
            onClick={() => navigate('/memorias')}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Ver todas
          </button>
        </div>
      </div>
      <motion.div
        initial={false}
        animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
        transition={
          collapsed
            ? {
                height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.15, ease: 'easeOut' },
              }
            : {
                height: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.3, delay: 0.08 },
              }
        }
        className="overflow-hidden"
      >
      <div className="relative">
        {isSearching && (searchLoading || allMemories === null) ? (
          /* Skeleton agressivo no próprio carrossel enquanto carrega todas */
          <div className="flex gap-3 overflow-hidden" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex h-[148px] w-[260px] shrink-0 animate-pulse flex-col gap-2 rounded-xl bg-muted p-3.5 dark:bg-input/30"
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full flex-1" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
              </div>
            ))}
            <div className="h-[148px] w-[260px] shrink-0 opacity-0" />
          </div>
        ) : isSearching && swiperMemories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhuma memória encontrada{debounced ? ` para “${debounced}”` : ''}.
          </div>
        ) : (
        <>
        <Swiper
          key={searchOpen ? 'search' : 'recent'}
          modules={[FreeMode]}
          slidesPerView="auto"
          spaceBetween={12}
          freeMode={{ enabled: true, sticky: true, momentumRatio: 0.35 }}
          speed={550}
          resistanceRatio={0.7}
          grabCursor
          className="w-full"
          onSwiper={updateEdges}
          onSlideChange={updateEdges}
          onProgress={(_, progress) => {
            setShowLeft(progress > 0)
            setShowRight(progress < 1)
          }}
          onReachBeginning={() => setShowLeft(false)}
          onReachEnd={() => {
            setShowRight(false)
            if (searchHasMore) loadMoreSearch()
          }}
          onFromEdge={(s) => updateEdges(s)}
          onTouchStart={() => setDragging(true)}
          onTouchEnd={() => setDragging(false)}
        >
          {swiperMemories.map((m, idx) => {
            const isSide = idx === activeIdx || idx === activeIdx + 2
            return (
            <SwiperSlide
              key={m.id}
              style={{ width: 260 }}
              className={`transition-opacity duration-300 ${dragging && isSide ? 'opacity-70' : 'opacity-100'}`}
            >
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.35, delay: justOpened ? Math.min(idx, 5) * 0.06 : 0, ease: [0.22, 1, 0.36, 1] }}
                onPointerDown={(e) => {
                  downPos.current = { x: e.clientX, y: e.clientY }
                }}
                onClick={(e) => {
                  const d = downPos.current
                  downPos.current = null
                  if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
                  setSelectedId(m.id)
                }}
                className={`group relative flex h-[148px] cursor-pointer flex-col rounded-xl bg-muted p-3.5 text-left select-none transition-all duration-300 hover:bg-accent dark:bg-input/30 dark:hover:bg-input/40 ${dragging && isSide ? 'shadow-[0_12px_32px_rgba(0,0,0,0.14)] dark:shadow-black/40' : 'shadow-none'}`}
              >
                <button
                  type="button"
                  aria-label="Opções da memória"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuId((cur) => (cur === m.id ? null : m.id))
                  }}
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none [@media(hover:none)]:opacity-100 data-[open=true]:opacity-100"
                  data-open={menuId === m.id}
                >
                  <DotsThree className="size-4" weight="bold" />
                </button>
                {menuId === m.id && (
                  <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-9 right-2 z-20 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleHideHome(m.id)}
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
            </SwiperSlide>
            )
          })}
          {searchHasMore && (
            <SwiperSlide key="__more" style={{ width: 160 }}>
              <button
                type="button"
                onClick={loadMoreSearch}
                className="flex h-[148px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <span>Mostrar mais</span>
                <span>({searchTotal - visibleCount})</span>
              </button>
            </SwiperSlide>
          )}
        </Swiper>
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 ${dragging && showLeft ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 ${dragging && showRight ? 'opacity-100' : 'opacity-0'}`}
        />
        </>
        )}
      </div>
      </motion.div>

      <MemoryDetail
        memoryId={selectedId}
        onClose={() => setSelectedId(null)}
        getMemory={getMemory}
        onVote={handleVote}
        onForget={handleForget}
        busy={busyId === selectedId}
        refreshKey={detailVersion}
      />
      {undo && (
        <UndoBar
          message={undo.message}
          onUndo={() => { const run = undo.run; setUndo(null); run() }}
          onDismiss={() => setUndo(null)}
        />
      )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

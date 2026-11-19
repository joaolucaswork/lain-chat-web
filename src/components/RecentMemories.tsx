import { motion, AnimatePresence } from 'motion/react'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperType } from 'swiper'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import { MemoryDetail } from '@/components/MemoryDetail'
import { UndoBar } from '@/components/UndoBar'
import { useRecentMemories } from '@/hooks/useRecentMemories'
import { readCollapsedHome, writeCollapsedHome, readHomeHasMemories } from '@/lib/homeMemories'
import { RecentMemoriesHeader } from '@/components/recent/RecentMemoriesHeader'
import { InitialSkeleton, SearchSkeleton } from '@/components/recent/RecentMemoriesSkeleton'
import { RecommendedCards, RecommendedCardsSkeleton } from '@/components/recent/RecommendedCards'
import { MemoryCarouselCard } from '@/components/recent/MemoryCarouselCard'

export function RecentMemories() {
  const rec = useRecentMemories()
  const { memories, allMemories, loading } = rec
  const search = rec
  const actions = rec
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsedHome())
  const [justOpened, setJustOpened] = useState(true)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const swiperRef = useRef<SwiperType | null>(null)
  const downPos = useRef<{ x: number; y: number } | null>(null)
  const openTimer = useRef<number | null>(null)

  const { searchOpen, debounced, visibleCount, searchLoading, searchFiltered } = search
  const isSearching = searchOpen

  const swiperMemories = useMemo(
    () => (isSearching ? searchFiltered.slice(0, visibleCount) : memories),
    [isSearching, searchFiltered, visibleCount, memories]
  )
  const searchTotal = searchFiltered.length
  const searchHasMore = isSearching && searchTotal > visibleCount

  const titleMode = !isSearching ? 'recent' : debounced ? 'results' : 'all'
  const titleLabel =
    titleMode === 'recent'
      ? 'Memórias recentes'
      : titleMode === 'all'
        ? 'Todas as memórias'
        : `${searchTotal} resultado${searchTotal === 1 ? '' : 's'}`

  const updateEdges = useCallback((s: SwiperType) => {
    swiperRef.current = s
    setShowLeft(!s.isBeginning)
    setShowRight(!s.isEnd)
    setActiveIdx(s.activeIndex)
  }, [])

  const slidePage = useCallback((dir: 1 | -1) => {
    const s = swiperRef.current
    if (!s) return
    s.slideTo(s.activeIndex + dir)
  }, [])

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      setJustOpened(true)
      if (openTimer.current) window.clearTimeout(openTimer.current)
      openTimer.current = window.setTimeout(() => setJustOpened(false), 1100)
    } else {
      search.closeSearch()
    }
    setCollapsed((v) => {
      writeCollapsedHome(!v)
      return !v
    })
  }, [collapsed, search])

  const handleOpenSearch = useCallback(() => {
    search.openSearch()
    setCollapsed((v) => {
      if (!v) return v
      writeCollapsedHome(false)
      return false
    })
  }, [search])

  const rememberPointer = useCallback((x: number, y: number) => {
    downPos.current = { x, y }
  }, [])

  const handleCardClick = useCallback((id: string, x: number, y: number) => {
    const d = downPos.current
    downPos.current = null
    if (d && Math.hypot(x - d.x, y - d.y) > 8) return
    actions.setSelectedId(id)
  }, [actions])

  const toggleMenu = useCallback((id: string) => {
    setMenuId((cur) => (cur === id ? null : id))
  }, [])

  const hideFromHome = useCallback((id: string) => {
    setMenuId(null)
    actions.handleHideHome(id)
  }, [actions])

  useEffect(() => {
    openTimer.current = window.setTimeout(() => setJustOpened(false), 1100)
    return () => {
      if (openTimer.current) window.clearTimeout(openTimer.current)
    }
  }, [])

  useEffect(() => {
    if (searchOpen) swiperRef.current?.slideTo(0, 0)
  }, [debounced, searchOpen])

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
      if (actions.selectedId) return
      slidePage(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions.selectedId, slidePage])

  // Vazio: onboarding explicativo no lugar do swiper. Loading mostra o
  // skeleton na hora (sem grace): dos 3 cards por padrão, do swiper só
  // quando o cache confirma que há memórias. Cards entram com stagger depois.
  if (!loading && memories.length === 0) return <RecommendedCards />

  return (
    <AnimatePresence mode="wait" initial={false}>
      {loading ? (
        readHomeHasMemories() === true ? <InitialSkeleton /> : <RecommendedCardsSkeleton />
      ) : (
        <motion.div
          key="content"
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.25, ease: 'easeIn' } }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <RecentMemoriesHeader
            titleLabel={titleLabel}
            titleMode={titleMode}
            isSearching={isSearching}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            searchOpen={search.searchOpen}
            query={search.query}
            setQuery={search.setQuery}
            onOpenSearch={handleOpenSearch}
            onCloseSearch={search.closeSearch}
            searchInputRef={search.searchInputRef}
            showLeft={showLeft}
            showRight={showRight}
            onPrev={() => slidePage(-1)}
            onNext={() => slidePage(1)}
            onViewAll={() => navigate('/memorias')}
          />
          <motion.div
            initial={false}
            animate={{ height: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
            transition={
              collapsed
                ? { height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.15, ease: 'easeOut' } }
                : { height: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.3, delay: 0.08 } }
            }
            className="overflow-hidden"
          >
            <div className="relative">
              {isSearching && (searchLoading || allMemories === null) ? (
                <SearchSkeleton />
              ) : isSearching && swiperMemories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhuma memória encontrada{debounced ? ` para “${debounced}”` : ''}.
                </div>
              ) : (
                <>
                  <Swiper
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
                      if (searchHasMore) search.loadMoreSearch()
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
                          <MemoryCarouselCard
                            memory={m}
                            dimmed={dragging && isSide}
                            staggerDelay={justOpened ? Math.min(idx, 5) * 0.06 : 0}
                            menuOpen={menuId === m.id}
                            onToggleMenu={toggleMenu}
                            onHide={hideFromHome}
                            onPointerDownPos={rememberPointer}
                            onCardClick={handleCardClick}
                          />
                        </SwiperSlide>
                      )
                    })}
                    {searchHasMore && (
                      <SwiperSlide key="__more" style={{ width: 160 }}>
                        <button
                          type="button"
                          onClick={search.loadMoreSearch}
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
            memoryId={actions.selectedId}
            onClose={() => actions.setSelectedId(null)}
            getMemory={actions.getMemory}
            onVote={actions.handleVote}
            onForget={actions.handleForget}
            busy={actions.busyId === actions.selectedId}
            refreshKey={actions.detailVersion}
          />
          {actions.undo && (
            <UndoBar
              message={actions.undo.message}
              onUndo={() => { const run = actions.undo!.run; actions.setUndo(null); run() }}
              onDismiss={() => actions.setUndo(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

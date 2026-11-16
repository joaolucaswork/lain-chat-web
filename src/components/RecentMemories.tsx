import { motion, AnimatePresence } from 'motion/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperType } from 'swiper'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { Memory, FeedbackAction } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MemoryDetail } from '@/components/MemoryDetail'
import { UndoBar } from '@/components/UndoBar'
import { formatDateTime } from '@/lib/utils'
import { sendFeedback, forgetMemory, restoreMemory } from '@/lib/memoryApi'

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
  const swiperRef = useRef<SwiperType | null>(null)
  const downPos = useRef<{ x: number; y: number } | null>(null)
  const navigate = useNavigate()

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
      const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
        const ta = Date.parse(a.created || '')
        const tb = Date.parse(b.created || '')
        if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
        if (Number.isNaN(ta)) return 1
        if (Number.isNaN(tb)) return -1
        return tb - ta
      })
      setMemories(sorted.slice(0, 12))
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
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
    }
  }, [])

  const handleVote = useCallback(async (id: string, action: FeedbackAction) => {
    setBusyId(id)
    try {
      const fb = await sendFeedback(id, action)
      setMemories((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, confidence: fb.confidence, last_confirmed_at: fb.last_confirmed_at, status: fb.status, kind: fb.kind }
            : m
        )
      )
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
      const { trashId } = await forgetMemory(id)
      setMemories((prev) => prev.filter((m) => m.id !== id))
      if (selectedId === id) setSelectedId(null)
      if (trashId) {
        showUndo('Memória esquecida — não volta a ser extraída.', () => {
          restoreMemory(trashId)
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

  const slidePage = useCallback((dir: 1 | -1) => {
    const s = swiperRef.current
    if (!s) return
    s.slideTo(s.activeIndex + dir)
  }, [])

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
                className="flex h-[148px] w-[260px] shrink-0 flex-col gap-2 rounded-xl bg-card p-3.5"
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
        <h2 className="text-sm font-medium text-muted-foreground">Memórias recentes</h2>
        <div className="flex items-center gap-1.5">
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
          <button
            type="button"
            onClick={() => navigate('/memorias')}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Ver todas
          </button>
        </div>
      </div>
      <div className="relative">
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
          onReachEnd={() => setShowRight(false)}
          onFromEdge={(s) => updateEdges(s)}
          onTouchStart={() => setDragging(true)}
          onTouchEnd={() => setDragging(false)}
        >
          {memories.map((m, idx) => {
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
                viewport={{ once: false, amount: 0.5 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onPointerDown={(e) => {
                  downPos.current = { x: e.clientX, y: e.clientY }
                }}
                onClick={(e) => {
                  const d = downPos.current
                  downPos.current = null
                  if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
                  setSelectedId(m.id)
                }}
                className={`flex h-[148px] cursor-pointer flex-col rounded-xl bg-card p-3.5 text-left select-none transition-all duration-300 hover:bg-accent/60 ${dragging && isSide ? 'shadow-[0_12px_32px_rgba(0,0,0,0.14)]' : 'shadow-none'}`}
              >
                <div className="mb-1 truncate text-[13px] font-semibold leading-snug text-card-foreground">
                  {formatDateTime(m.created)}
                </div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                  {m.project}
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <div className="line-clamp-3 text-[13px] leading-[1.6] text-muted-foreground">
                    {m.preview}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />
                </div>
                {(m.tags || []).length > 0 && (
                  <div className="mt-2 flex gap-1 overflow-hidden">
                    {(m.tags || []).slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {t.replace(/^#/, '')}
                      </Badge>
                    ))}
                  </div>
                )}
              </motion.div>
            </SwiperSlide>
            )
          })}
        </Swiper>
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 ${dragging && showLeft ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 ${dragging && showRight ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

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

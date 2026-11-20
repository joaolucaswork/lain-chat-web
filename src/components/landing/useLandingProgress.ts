import { useEffect, useRef } from 'react'

/** Progresso normalizado da landing para o stage WebGL (Etapa 2/3 consome). */
export type LandingProgress = { morph: number; pulse: number }

type Refs = {
  scroll: React.RefObject<HTMLDivElement | null>
  s2: React.RefObject<HTMLElement | null>
  s3: React.RefObject<HTMLElement | null>
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Fração de uma seção já atravessada pelo container (0 entrou, 1 passou). */
function sectionTarget(
  scrollEl: HTMLDivElement,
  sectionEl: HTMLElement,
): number {
  const c = scrollEl.getBoundingClientRect()
  const r = sectionEl.getBoundingClientRect()
  const total = r.height + c.height * 0.5
  if (total <= 0) return 0
  return clamp01((c.bottom - r.top) / total)
}

/**
 * WHY ref sem setState: o scroll dispara a 60-120Hz; setState re-renderizaria
 * a landing inteira por frame. O BrainStage (Etapa 2) lê `progressRef.current`
 * dentro do próprio rAF com damping — custo zero no React.
 */
export function useLandingProgress({ scroll, s2, s3 }: Refs) {
  const progressRef = useRef<LandingProgress>({ morph: 0, pulse: 0 })

  useEffect(() => {
    const scrollEl = scroll.current
    if (!scrollEl) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let dirty = true

    const onScroll = () => {
      dirty = true
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      if (!dirty) {
        // Damping contínuo mesmo sem scroll (assenta o valor).
        const p = progressRef.current
        if (Math.abs(p.morph - target.morph) < 0.001 && Math.abs(p.pulse - target.pulse) < 0.001) return
      }
      dirty = false
      const s2El = s2.current
      const s3El = s3.current
      if (!s2El || !s3El) return
      target.morph = sectionTarget(scrollEl, s2El)
      target.pulse = sectionTarget(scrollEl, s3El)
      const p = progressRef.current
      if (reduce) {
        p.morph = target.morph
        p.pulse = target.pulse
        return
      }
      p.morph += (target.morph - p.morph) * 0.12
      p.pulse += (target.pulse - p.pulse) * 0.12
      if (Math.abs(target.morph - p.morph) < 0.001) p.morph = target.morph
      if (Math.abs(target.pulse - p.pulse) < 0.001) p.pulse = target.pulse
    }
    const target = { morph: 0, pulse: 0 }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      scrollEl.removeEventListener('scroll', onScroll)
    }
  }, [scroll, s2, s3])

  return progressRef
}

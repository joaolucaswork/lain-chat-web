import { useEffect, useRef } from 'react'

/**
 * Painel direito do hero (/bem-vindo) — estética Serial Experiments Lain:
 * goo de fósforo verde sobre preto + scanlines, ruído de sinal, sweep de
 * refresh e anel de "protocolo" girando devagar. Canvas 2D + CSS (GPU),
 * sem Three.js. Reduzido a estático sob prefers-reduced-motion.
 */

const BLOBS = 7
const COLORS = ['#4d7c0f', '#65a30d', '#84cc16']

/** Campo de glifos sobre a gosma — o "ASCII em movimento" da Adaline. */
const GLYPHS = 'アイウエオカキクケコサシスセソ01<>*+#$%&?/\\|_='
const CELL = 15

function GlyphField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let cols = 0
    let rows = 0
    let cells: Array<{ ch: string; b: number }> = []

    const seed = () => {
      cols = Math.ceil(w / CELL)
      rows = Math.ceil(h / CELL) + 1
      cells = Array.from({ length: cols * rows }, () => ({
        ch: GLYPHS[(Math.random() * GLYPHS.length) | 0],
        b: 0.25 + Math.random() * 0.75,
      }))
    }
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${CELL - 3}px ui-monospace, monospace`
      ctx.textBaseline = 'top'
      seed()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = (now - t0) / 1000
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const maxD = Math.hypot(cx, cy)
      const yOff = (t * 9) % CELL
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const cell = cells[i]
          // Cintilação: poucos glifos trocam por frame.
          if (Math.random() < 0.012) {
            cell.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0]
            cell.b = 0.25 + Math.random() * 0.75
          }
          const x = c * CELL
          const y = r * CELL - CELL + yOff
          const d = Math.hypot(x - cx, y - cy) / maxD
          const mask = Math.max(0, 1 - d * d)
          if (mask <= 0.02) continue
          ctx.fillStyle = `rgba(190, 242, 100, ${(cell.b * mask * 0.85).toFixed(3)})`
          ctx.fillText(cell.ch, x, y)
        }
      }
      if (!still) raf = requestAnimationFrame(draw)
    }
    draw(t0)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen"
      style={{ filter: 'blur(0.4px)' }}
    />
  )
}

type Blob = { bx: number; by: number; r: number; sp: number; ph: number }

export function GooPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const mouse = { x: -9999, y: -9999 }
    const blobs: Blob[] = Array.from({ length: BLOBS }, (_, i) => ({
      bx: 0.2 + 0.6 * ((i * 0.37) % 1),
      by: 0.28 + 0.5 * ((i * 0.53) % 1),
      r: 0.09 + 0.05 * ((i * 0.29) % 1),
      sp: 0.00035 + 0.0002 * ((i * 0.41) % 1),
      ph: i * 1.7,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    canvas.parentElement?.addEventListener('pointermove', onMove)
    canvas.parentElement?.addEventListener('pointerleave', onLeave)

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = now - t0
      ctx.clearRect(0, 0, w, h)
      const m = Math.min(w, h)

      blobs.forEach((b, i) => {
        const x = b.bx * w + Math.sin(t * b.sp + b.ph) * w * 0.08
        const y = b.by * h + Math.cos(t * b.sp * 1.3 + b.ph) * h * 0.08
        const dx = x - mouse.x
        const dy = y - mouse.y
        const d = Math.hypot(dx, dy)
        const push = d < 160 && d > 0.01 ? ((160 - d) / 160) * 46 : 0
        ctx.fillStyle = COLORS[i % COLORS.length]
        ctx.beginPath()
        ctx.arc(x + (dx / (d || 1)) * push, y + (dy / (d || 1)) * push, b.r * m, 0, Math.PI * 2)
        ctx.fill()
      })
      if (!still) raf = requestAnimationFrame(draw)
    }
    draw(t0)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.parentElement?.removeEventListener('pointermove', onMove)
      canvas.parentElement?.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="relative h-72 overflow-hidden sm:h-96 lg:h-[540px]" aria-hidden>
      <canvas
        ref={canvasRef}
        className="lain-flicker absolute inset-0 h-full w-full"
        style={{ filter: 'blur(24px) contrast(24)' }}
      />
      <GlyphField />
    </div>
  )
}

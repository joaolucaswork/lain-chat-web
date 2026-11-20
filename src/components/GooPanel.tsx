import { useEffect, useRef } from 'react'

/**
 * Painel direito do hero (/bem-vindo): fundo Lain (ruído + scanlines)
 * com campo de glifos foscos que foge do mouse. Sem neon: os blobs são
 * só posições invisíveis à deriva que moldam onde os glifos acendem.
 * Reduzido a estático sob prefers-reduced-motion.
 */

const BLOBS = 7
const GLYPHS = 'アイウエオカキクケコサシスセソ01<>*+#$%&?/\\|_='
const CELL = 15
const MOUSE_R = 170
const PUSH = 52

type Blob = { bx: number; by: number; r: number; sp: number; ph: number; x: number; y: number }

export function GooPanel() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
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
      x: 0,
      y: 0,
    }))
    let cols = 0
    let rows = 0
    let cells: Array<{ ch: string; b: number }> = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${CELL - 3}px ui-monospace, monospace`
      ctx.textBaseline = 'top'
      cols = Math.ceil(w / CELL)
      rows = Math.ceil(h / CELL) + 1
      cells = Array.from({ length: cols * rows }, () => ({
        ch: GLYPHS[(Math.random() * GLYPHS.length) | 0],
        b: 0.25 + Math.random() * 0.75,
      }))
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
      const m = Math.min(w, h)
      const cx = w / 2
      const cy = h / 2
      const maxD = Math.hypot(cx, cy)
      ctx.clearRect(0, 0, w, h)

      // Blobs invisíveis: só posições à deriva (foge do mouse).
      for (const b of blobs) {
        const x = b.bx * w + Math.sin(t * b.sp + b.ph) * w * 0.08
        const y = b.by * h + Math.cos(t * b.sp * 1.3 + b.ph) * h * 0.08
        const dx = x - mouse.x
        const dy = y - mouse.y
        const d = Math.hypot(dx, dy)
        const push = d < 160 && d > 0.01 ? ((160 - d) / 160) * 46 : 0
        b.x = x + (dx / (d || 1)) * push
        b.y = y + (dy / (d || 1)) * push
      }

      // Glifos foscos onde o campo está + repel direto do mouse.
      const yOff = (t / 1000) * 9 % CELL
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const cell = cells[i]
          if (Math.random() < 0.012) {
            cell.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0]
            cell.b = 0.25 + Math.random() * 0.75
          }
          const x = c * CELL
          const y = r * CELL - CELL + yOff
          let f = 0
          for (const b of blobs) {
            const br = b.r * m * 0.7
            const dd = (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y)
            f += Math.exp(-dd / (2 * br * br))
          }
          if (f < 0.5) continue
          const dx = x - mouse.x
          const dy = y - mouse.y
          const md = Math.hypot(dx, dy)
          const near = md < MOUSE_R && md > 0.01 ? (MOUSE_R - md) / MOUSE_R : 0
          const px = x + (dx / (md || 1)) * near * PUSH
          const py = y + (dy / (md || 1)) * near * PUSH
          const d = Math.hypot(px - cx, py - cy) / maxD
          const mask = Math.max(0, 1 - d * d)
          if (mask <= 0.02) continue
          const a = Math.min(0.5, cell.b * mask * (0.4 + near * 0.8))
          ctx.fillStyle = `rgba(132, 204, 22, ${a.toFixed(3)})`
          ctx.fillText(cell.ch, px, py)
        }
      }
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
      <canvas ref={ref} className="absolute inset-0 h-full w-full mix-blend-screen" />
      <div className="lain-scanlines pointer-events-none absolute inset-0" />
      <div className="lain-noise pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  )
}

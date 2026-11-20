import { useEffect, useRef } from 'react'

/**
 * Painel direito do hero (/bem-vindo): bloco cheio de glifos verdes
 * (katakana + ASCII, o "ASCII em movimento" da Adaline) com scanlines
 * recortadas nos próprios glifos. O mouse empurra os glifos e os acende
 * por perto. Reduzido a estático sob prefers-reduced-motion.
 */

const GLYPHS = 'アイウエオカキクケコサシスセソ01<>*+#$%&?/\\|_='
const CELL = 15
const MOUSE_R = 170
const PUSH = 52

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
      ctx.clearRect(0, 0, w, h)
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
          const dx = x - mouse.x
          const dy = y - mouse.y
          const md = Math.hypot(dx, dy)
          const near = md < MOUSE_R && md > 0.01 ? (MOUSE_R - md) / MOUSE_R : 0
          const a = Math.min(0.8, cell.b * (0.45 + near * 0.9))
          ctx.fillStyle = `rgba(190, 242, 100, ${a.toFixed(3)})`
          ctx.fillText(cell.ch, x + (dx / (md || 1)) * near * PUSH, y + (dy / (md || 1)) * near * PUSH)
        }
      }
      // Scanlines só no formato dos glifos: apaga 1px a cada 4px do canvas.
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      for (let y = (t / 1000) * 9 % CELL % 4; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1)
      }
      ctx.restore()
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
    </div>
  )
}

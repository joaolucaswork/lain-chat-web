import { useEffect, useRef } from 'react'

/**
 * Painel direito do hero (/bem-vindo): só o campo de glifos verdes
 * (katakana + ASCII, o "ASCII em movimento" da Adaline). O mouse empurra
 * os glifos como empurrava as bolinhas — repulsão num raio, com os glifos
 * acendendo perto do cursor. Reduzido a estático sob reduced-motion.
 */

const GLYPHS = 'アイウエオカキクケコサシスセソ01<>*+#$%&?/\\|_='
const CELL = 15
const MOUSE_R = 170
const PUSH = 52

export function GlyphPanel() {
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
          if (Math.random() < 0.012) {
            cell.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0]
            cell.b = 0.25 + Math.random() * 0.75
          }
          const x = c * CELL
          const y = r * CELL - CELL + yOff
          // Repulsão do mouse (era das bolinhas, agora nos glifos).
          const dx = x - mouse.x
          const dy = y - mouse.y
          const md = Math.hypot(dx, dy)
          const near = md < MOUSE_R && md > 0.01 ? (MOUSE_R - md) / MOUSE_R : 0
          const px = x + (dx / (md || 1)) * near * PUSH
          const py = y + (dy / (md || 1)) * near * PUSH
          // Máscara radial suave p/ não formar retângulo; acende perto do mouse.
          const d = Math.hypot(px - cx, py - cy) / maxD
          const mask = Math.max(0, 1 - d * d)
          if (mask <= 0.02) continue
          const a = Math.min(0.9, cell.b * mask * (0.55 + near * 0.9))
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
    </div>
  )
}

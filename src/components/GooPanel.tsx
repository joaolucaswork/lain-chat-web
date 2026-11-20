import { useEffect, useRef } from 'react'

/**
 * Painel direito do hero (/bem-vindo) — gosma de fósforo verde com glifos
 * sobrepostos (o "ASCII em movimento" da Adaline, que é canvas próprio,
 * não lib). Um único rAF desenha as duas camadas: os glifos acendem onde
 * o campo da gosma está forte, então eles "moram" em cima das bolinhas.
 * Reduzido a estático sob prefers-reduced-motion.
 */

const BLOBS = 7
const COLORS = ['#4d7c0f', '#65a30d', '#84cc16']
const GLYPHS = 'アイウエオカキクケコサシスセソ01<>*+#$%&?/\\|_='
const CELL = 15

type Blob = { bx: number; by: number; r: number; sp: number; ph: number; x: number; y: number }

export function GooPanel() {
  const gooRef = useRef<HTMLCanvasElement>(null)
  const glyphRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const goo = gooRef.current
    const glyph = glyphRef.current
    if (!goo || !glyph) return
    const gtx = goo.getContext('2d')
    const ltx = glyph.getContext('2d')
    if (!gtx || !ltx) return

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
    let chars: string[] = []

    const resize = () => {
      const rect = goo.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      for (const [cv, cx] of [[goo, gtx], [glyph, ltx]] as const) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
        cx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      ltx.font = `${CELL - 3}px ui-monospace, monospace`
      ltx.textBaseline = 'top'
      cols = Math.ceil(w / CELL)
      rows = Math.ceil(h / CELL) + 1
      chars = Array.from({ length: cols * rows }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0])
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(goo)

    const onMove = (e: PointerEvent) => {
      const rect = goo.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    goo.parentElement?.addEventListener('pointermove', onMove)
    goo.parentElement?.addEventListener('pointerleave', onLeave)

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = now - t0
      const m = Math.min(w, h)

      // Camada 1: gosma em glow — mesmo formato, sem núcleo sólido
      // (só blur, sem o contraste que endurecia em bolinha).
      gtx.clearRect(0, 0, w, h)
      blobs.forEach((b, i) => {
        const x = b.bx * w + Math.sin(t * b.sp + b.ph) * w * 0.08
        const y = b.by * h + Math.cos(t * b.sp * 1.3 + b.ph) * h * 0.08
        const dx = x - mouse.x
        const dy = y - mouse.y
        const d = Math.hypot(dx, dy)
        const push = d < 160 && d > 0.01 ? ((160 - d) / 160) * 46 : 0
        b.x = x + (dx / (d || 1)) * push
        b.y = y + (dy / (d || 1)) * push
        gtx.fillStyle = COLORS[i % COLORS.length]
        gtx.beginPath()
        gtx.arc(b.x, b.y, b.r * m, 0, Math.PI * 2)
        gtx.fill()
      })

      // Camada 2: glifos onde a gosma está — campo gaussiano por blob.
      ltx.clearRect(0, 0, w, h)
      const yOff = (t / 1000) * 9 % CELL
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          if (Math.random() < 0.012) chars[i] = GLYPHS[(Math.random() * GLYPHS.length) | 0]
          const x = c * CELL
          const y = r * CELL - CELL + yOff
          let f = 0
          for (const b of blobs) {
            const br = b.r * m * 0.7
            const dd = (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y)
            f += Math.exp(-dd / (2 * br * br))
          }
          if (f < 0.5) continue
          ltx.fillStyle = `rgba(190, 242, 100, ${Math.min(0.55, f * 0.35).toFixed(3)})`
          ltx.fillText(chars[i], x, y)
        }
      }

      if (!still) raf = requestAnimationFrame(draw)
    }
    draw(t0)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      goo.parentElement?.removeEventListener('pointermove', onMove)
      goo.parentElement?.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="relative h-72 overflow-hidden sm:h-96 lg:h-[540px]" aria-hidden>
      <canvas
        ref={gooRef}
        className="absolute inset-0 h-full w-full mix-blend-screen"
        style={{ filter: 'blur(28px)' }}
      />
      <canvas
        ref={glyphRef}
        className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen"
        style={{ filter: 'blur(0.4px)' }}
      />
    </div>
  )
}

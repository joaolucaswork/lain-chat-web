import { useEffect, useRef } from 'react'

/**
 * Painel goo do hero (/bem-vindo, lado direito — estilo Adaline).
 * Mesma técnica do morph do h1 (blur + threshold de alpha), mas contínua:
 * blobs à deriva que fundem/esticam fios entre si e reagem ao cursor.
 * Canvas 2D + CSS filter (GPU), sem Three.js — primo pobre do
 * planeShaders (smin) do Viscose, bom o bastante p/ o experimento.
 */

const BLOBS = 7
const BLUR_PX = 24

type Blob = { bx: number; by: number; r: number; sp: number; ph: number }

function palette(): string[] {
  const css = getComputedStyle(document.documentElement)
  const g = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb
  return [g('--goo-1', '#65a30d'), g('--goo-2', '#84cc16'), g('--goo-3', '#a3e635')]
}

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
      by: 0.2 + 0.6 * ((i * 0.53) % 1),
      r: 0.1 + 0.05 * ((i * 0.29) % 1),
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

    let colors = palette()
    const mo = new MutationObserver(() => {
      colors = palette()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

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
        // Cursor empurra o blob (força do Viscose, versão 2D).
        const dx = x - mouse.x
        const dy = y - mouse.y
        const d = Math.hypot(dx, dy)
        const push = d < 160 && d > 0.01 ? ((160 - d) / 160) * 46 : 0
        ctx.fillStyle = colors[i % colors.length]
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
      mo.disconnect()
      canvas.parentElement?.removeEventListener('pointermove', onMove)
      canvas.parentElement?.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="relative h-72 overflow-hidden sm:h-96 lg:h-[540px]" aria-hidden>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ filter: `blur(${BLUR_PX}px) contrast(24)` }}
      />
    </div>
  )
}

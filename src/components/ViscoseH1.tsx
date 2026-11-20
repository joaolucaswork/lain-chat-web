import { useEffect, useRef, useState } from 'react'

/**
 * Experimento Viscose no h1 da landing (/bem-vindo).
 * Técnica do `meta.js` do Viscose-carousel: duas cópias da frase, uma com
 * blur-out e outra com blur-in, fundidas por um threshold de alpha
 * (`contrast()` no container, só durante o morph — em repouso o filtro
 * desliga p/ o glifo continuar nítido). GPU puro, sem SVG filter (que o
 * WebKit roda em software) e sem Three.js.
 * Face: Satoshi (fallback livre do repo) via `font-display`.
 */

const PHRASES = [
  'Memória de longo prazo universal.',
  'Lembre de tudo, em todo lugar.',
  'Sua memória, em qualquer agente.',
]

const MORPH_MS = 1200 // nameMorphTime do params.js
const HOLD_MS = 2600
const BLUR_MAX = 8.5 // nameBlur do params.js (px)

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** circ.out — mesmo easing do morph original (nameEase). */
const circOut = (t: number): number => Math.sqrt(1 - (t - 1) * (t - 1))

/** Uma camada do morph: f = 1 presente, 0 ausente (fade do meta.js). */
function paint(el: HTMLSpanElement | null, f: number): void {
  if (!el) return
  if (f >= 1) {
    el.style.filter = 'none'
    el.style.opacity = '1'
    return
  }
  const a = f <= 0 ? 0 : Math.pow(f, 0.4) * smoothstep(0.1, 0.22, f)
  if (a <= 0.001) {
    el.style.filter = 'none'
    el.style.opacity = '0'
    return
  }
  const b = Math.min(BLUR_MAX / f - BLUR_MAX, BLUR_MAX * 3)
  el.style.filter = b > 0.01 ? `blur(${b.toFixed(2)}px)` : 'none'
  el.style.opacity = a.toFixed(3)
}

export function ViscoseH1() {
  const gooRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<Array<HTMLSpanElement | null>>([])
  const [spoken, setSpoken] = useState(PHRASES[0])

  useEffect(() => {
    const goo = gooRef.current
    if (!goo) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let cur = 0
    let raf = 0
    let timer = 0
    let alive = true

    const morphTo = (next: number) => {
      const out = layersRef.current[cur]
      const into = layersRef.current[next]
      const t0 = performance.now()
      goo.style.filter = 'contrast(20)'
      const frame = (now: number) => {
        if (!alive) return
        const t = circOut(Math.min(1, (now - t0) / MORPH_MS))
        paint(out, 1 - t)
        paint(into, t)
        if (t < 1) {
          raf = requestAnimationFrame(frame)
        } else {
          goo.style.filter = 'none'
          cur = next
          setSpoken(PHRASES[cur])
          timer = window.setTimeout(() => morphTo((cur + 1) % PHRASES.length), HOLD_MS)
        }
      }
      raf = requestAnimationFrame(frame)
    }

    timer = window.setTimeout(() => morphTo(1), HOLD_MS)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      goo.style.filter = 'none'
    }
  }, [])

  return (
    <h1
      aria-label={spoken}
      className="font-display text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl sm:leading-[1.02]"
    >
      <div ref={gooRef} aria-hidden className="grid">
        {PHRASES.map((p, i) => (
          <span
            key={p}
            ref={(el) => {
              layersRef.current[i] = el
            }}
            className="col-start-1 row-start-1"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            {p}
          </span>
        ))}
      </div>
    </h1>
  )
}

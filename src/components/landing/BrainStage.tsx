import { useEffect, useRef, useState } from 'react'
import { GooPanel } from '@/components/GooPanel'
import { GLYPH_ORDER, createGlyphAtlas } from './glyphAtlas'
import { FRAG_SRC, LINE_FRAG_SRC, LINE_VERT_SRC, VERT_SRC } from './brainShaders'
import { buildBrainGeometry, buildSynapses } from './brainGeometry'
import type { LandingProgress } from './useLandingProgress'

/**
 * Stage WebGL2 da landing (Etapa 3: Hero morph -> cérebro 3D).
 * Pontos: instanced quads [home + brain + meta]; linhas: 2ª passada
 * (gl.LINES) com o mesmo transform 3D. Hover dispara ondas sinápticas;
 * a Seção 3 (pulse) intensifica os pulsos automáticos.
 * Fallback p/ GooPanel 2D sem WebGL2 ou com context perdido.
 */

const CELL = 15
const FOCAL = 2.4

function compileSrc(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string,
): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // WHY log: fallback silencioso escondeu o `near` reservado por 3 etapas.
    console.error(`[BrainStage] falha ao compilar ${label}:`, gl.getShaderInfoLog(sh))
    return null
  }
  return sh
}

function makeProg(gl: WebGL2RenderingContext, vs: string, fs: string, label: string): WebGLProgram | null {
  const v = compileSrc(gl, gl.VERTEX_SHADER, vs, `${label} vertex`)
  const f = compileSrc(gl, gl.FRAGMENT_SHADER, fs, `${label} fragment`)
  if (!v || !f) return null
  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, v)
  gl.attachShader(prog, f)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(`[BrainStage] falha ao linkar ${label}:`, gl.getProgramInfoLog(prog))
    return null
  }
  return prog
}

type Uniforms = Record<string, WebGLUniformLocation | null>

function getUniforms(gl: WebGL2RenderingContext, prog: WebGLProgram, names: string[]): Uniforms {
  const out: Uniforms = {}
  for (const n of names) out[n] = gl.getUniformLocation(prog, n)
  return out
}

/** Liga um atributo (pula os podados pelo compilador). */
function bindAttrib(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  name: string,
  size: number,
  stride: number,
  offset: number,
  divisor: number,
): void {
  const loc = gl.getAttribLocation(prog, name)
  if (loc < 0) return
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset)
  gl.vertexAttribDivisor(loc, divisor)
}

/** Grade jitter que cobre o stage (estado Hero). */
function makeHomePositions(n: number, w: number, h: number): Float32Array {
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / Math.max(1, h))))
  const rows = Math.max(1, Math.ceil(n / cols))
  const home = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols) % rows
    home[i * 2] = ((c + 0.5) / cols) * w + (Math.random() - 0.5) * (w / cols) * 0.6
    home[i * 2 + 1] = ((r + 0.5) / rows) * h + (Math.random() - 0.5) * (h / rows) * 0.6
  }
  return home
}

/** Projeção CPU espelhando brainProject (p/ picking do pulso no hover). */
function projectCPU(
  px: number,
  py: number,
  pz: number,
  angleY: number,
  tiltX: number,
  scale: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const cy1 = Math.cos(angleY)
  const sy1 = Math.sin(angleY)
  let x = cy1 * px + sy1 * pz
  let y = py
  let z = -sy1 * px + cy1 * pz
  const cx1 = Math.cos(tiltX)
  const sx1 = Math.sin(tiltX)
  const y2 = cx1 * y - sx1 * z
  const z2 = sx1 * y + cx1 * z
  const ps = FOCAL / (FOCAL + z2)
  return { x: cx + x * scale * ps, y: cy + y2 * scale * ps }
}

export function BrainStage({
  progressRef,
  fixedMorph,
}: {
  progressRef: React.RefObject<LandingProgress>
  /** Mobile (Seção 2): cérebro fixo em morph=1, sem depender do scroll. */
  fixedMorph?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || failed) return
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true })
    if (!gl) {
      setFailed(true)
      return
    }
    const progP = makeProg(gl, VERT_SRC, FRAG_SRC, 'pontos')
    const progL = makeProg(gl, LINE_VERT_SRC, LINE_FRAG_SRC, 'linhas')
    if (!progP || !progL) {
      setFailed(true)
      return
    }
    const SHARED = [
      'uRes', 'uTime', 'uMorph', 'uAngleY', 'uTiltX', 'uBrainScale',
      'uCenter', 'uFocal', 'uPulseOrigin', 'uPulseTime', 'uPulseBoost',
    ]
    const locP = getUniforms(gl, progP, [...SHARED, 'uBlobs', 'uMouse', 'uGlow', 'uCell', 'uAtlas', 'uDpr'])
    const locL = getUniforms(gl, progL, [...SHARED, 'uCell'])

    const tex = gl.createTexture()
    if (!tex) {
      setFailed(true)
      return
    }
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createGlyphAtlas())
    // Sem mipmaps: minificação 40px -> 15px com LINEAR direto preserva a
    // nitidez do 2D (mipmap trilinear borrava os glifos). Shimmer residual
    // é aceitável — os glifos trocam a ~8Hz mesmo.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const desktop = window.matchMedia?.('(min-width: 1024px)').matches ?? true
    const N = desktop ? 3500 : 1800
    const E = desktop ? 220 : 120
    const cloud = buildBrainGeometry(N)
    const pairs = buildSynapses(cloud.positions, cloud.lobe, E)
    const glyphs = new Float32Array(N)
    for (let i = 0; i < N; i++) glyphs[i] = (Math.random() * GLYPH_ORDER.length) | 0
    const crests: number[] = []
    for (let i = 0; i < N; i++) {
      if (cloud.ridge[i] > 0.55 && cloud.lobe[i] <= 4) crests.push(i)
    }
    const crestPool = crests.length > 0 ? crests : Array.from({ length: N }, (_, i) => i)

    // VAO dos pontos: quad estático + instâncias [home2 brain3 meta4].
    const vaoP = gl.createVertexArray()
    gl.bindVertexArray(vaoP)
    const quadVBO = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0, 0, 0.5, -0.5, 1, 0, 0.5, 0.5, 1, 1, -0.5, 0.5, 0, 1]),
      gl.STATIC_DRAW,
    )
    bindAttrib(gl, progP, 'aCorner', 2, 16, 0, 0)
    bindAttrib(gl, progP, 'aUV', 2, 16, 8, 0)
    const instVBO = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, instVBO)
    gl.bufferData(gl.ARRAY_BUFFER, N * 9 * 4, gl.DYNAMIC_DRAW)
    bindAttrib(gl, progP, 'aHomePos', 2, 36, 0, 1)
    bindAttrib(gl, progP, 'aBrainPos', 3, 36, 8, 1)
    bindAttrib(gl, progP, 'aMeta', 4, 36, 20, 1)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
    // VAO das linhas: 2 vértices por aresta [home2 brain3 seed ridge].
    const vaoL = gl.createVertexArray()
    gl.bindVertexArray(vaoL)
    const lineVBO = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, lineVBO)
    gl.bufferData(gl.ARRAY_BUFFER, E * 2 * 7 * 4, gl.DYNAMIC_DRAW)
    bindAttrib(gl, progL, 'aHome', 2, 28, 0, 0)
    bindAttrib(gl, progL, 'aBrain', 3, 28, 8, 0)
    bindAttrib(gl, progL, 'aSeed', 1, 28, 20, 0)
    bindAttrib(gl, progL, 'aRidge', 1, 28, 24, 0)
    gl.bindVertexArray(null)

    let w = 1
    let h = 1
    let dpr = 1
    const refill = () => {
      const home = makeHomePositions(N, w, h)
      const inst = new Float32Array(N * 9)
      for (let i = 0; i < N; i++) {
        inst[i * 9] = home[i * 2]
        inst[i * 9 + 1] = home[i * 2 + 1]
        inst[i * 9 + 2] = cloud.positions[i * 3]
        inst[i * 9 + 3] = cloud.positions[i * 3 + 1]
        inst[i * 9 + 4] = cloud.positions[i * 3 + 2]
        inst[i * 9 + 5] = cloud.seeds[i]
        inst[i * 9 + 6] = glyphs[i]
        inst[i * 9 + 7] = cloud.ridge[i]
        inst[i * 9 + 8] = cloud.lobe[i]
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, instVBO)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst)
      const lines = new Float32Array(E * 2 * 7)
      for (let e = 0; e < E; e++) {
        for (let k = 0; k < 2; k++) {
          const idx = pairs[e * 2 + k]
          const a = pairs[e * 2]
          const b = pairs[e * 2 + 1]
          const o = (e * 2 + k) * 7
          lines[o] = home[idx * 2]
          lines[o + 1] = home[idx * 2 + 1]
          lines[o + 2] = cloud.positions[idx * 3]
          lines[o + 3] = cloud.positions[idx * 3 + 1]
          lines[o + 4] = cloud.positions[idx * 3 + 2]
          lines[o + 5] = (cloud.seeds[a] + cloud.seeds[b]) / 2
          lines[o + 6] = (cloud.ridge[a] + cloud.ridge[b]) / 2
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineVBO)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, lines)
    }
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, desktop ? 2 : 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      refill()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const mouse = { x: -9999, y: -9999 }
    const sm = { x: -9999, y: -9999 }
    let glow = 1
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

    let visible = true
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    })
    io.observe(canvas)
    const onLost = (e: Event) => {
      e.preventDefault()
      setFailed(true)
    }
    canvas.addEventListener('webglcontextlost', onLost)

    const blobs = Array.from({ length: 10 }, (_, i) => ({
      bx: 0.2 + 0.6 * ((i * 0.37) % 1),
      by: 0.28 + 0.5 * ((i * 0.53) % 1),
      r: 0.09 + 0.05 * ((i * 0.29) % 1),
      sp: 0.0009 + 0.0005 * ((i * 0.41) % 1),
      ph: i * 1.7,
      x: 0,
      y: 0,
    }))
    const blobArr = new Float32Array(30)
    const pulseOrigin = new Float32Array([0, 0.3, 0.5])
    let pulseStart = -1
    let lastAuto = 0
    let lastHover = 0
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let raf = 0
    const lastDrawn = { morph: -1, pulse: -1, x: 0, y: 0 }

    const firePulse = (idx: number, now: number) => {
      pulseOrigin[0] = cloud.positions[idx * 3]
      pulseOrigin[1] = cloud.positions[idx * 3 + 1]
      pulseOrigin[2] = cloud.positions[idx * 3 + 2]
      pulseStart = now
    }

    const draw = (now: number) => {
      const morph = fixedMorph ?? progressRef.current.morph
      const boost = progressRef.current.pulse
      const tMs = still ? 0 : now - t0
      const time = tMs / 1000
      const active = mouse.x > -9000
      if (still) {
        sm.x = mouse.x
        sm.y = mouse.y
        glow = active ? 1 : 0
      } else if (active) {
        if (sm.x < -9000) {
          sm.x = mouse.x
          sm.y = mouse.y
        } else {
          sm.x += (mouse.x - sm.x) * 0.14
          sm.y += (mouse.y - sm.y) * 0.14
        }
        glow += ((active ? 1 : 0) - glow) * 0.07
      } else {
        glow += (0 - glow) * 0.07
      }
      const m = Math.min(w, h)
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i]
        const x = b.bx * w + Math.sin(tMs * b.sp + b.ph) * w * 0.12
        const y = b.by * h + Math.cos(tMs * b.sp * 1.3 + b.ph) * h * 0.12
        const dx = x - sm.x
        const dy = y - sm.y
        const d = Math.hypot(dx, dy)
        const push = d < 160 && d > 0.01 ? ((160 - d) / 160) * 46 * glow : 0
        blobArr[i * 3] = x + (dx / (d || 1)) * push
        blobArr[i * 3 + 1] = y + (dy / (d || 1)) * push
        blobArr[i * 3 + 2] = b.r * m * 0.6
      }
      const scale = m * 0.36
      const cx = w / 2
      const cyy = h * 0.46
      const hasPointer = sm.x > -9000
      const px = hasPointer ? sm.x / w - 0.5 : 0
      const py = hasPointer ? sm.y / h - 0.5 : 0
      const morphQ = morph > 0.001 ? 1 : 0
      const angleY = still ? 0.6 : time * 0.18 * morphQ + px * 0.55 * morph
      const tiltX = still ? 0.15 : 0.12 + py * 0.35 * morph
      // Pulsos: automáticos (ritmo sobe com o boost da Seção 3) + hover.
      if (!still && morph > 0.75 && now - lastAuto > 3800 - 1800 * boost) {
        firePulse(crestPool[(Math.random() * crestPool.length) | 0], now)
        lastAuto = now
      }
      if (morph > 0.75 && active && now - lastHover > 1400) {
        let best = -1
        let bd = scale * 1.3 * (scale * 1.3)
        for (let i = 0; i < N; i += 7) {
          const p = projectCPU(
            cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2],
            angleY, tiltX, scale, cx, cyy,
          )
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d2 = dx * dx + dy * dy
          if (d2 < bd) {
            bd = d2
            best = i
          }
        }
        if (best >= 0) {
          firePulse(best, now)
          lastHover = now
        }
      }
      const pulseT = pulseStart < 0 || now - pulseStart > 3000 ? -1 : (now - pulseStart) / 1000
      if (pulseT < 0) pulseStart = -1

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.bindVertexArray(vaoP)
      gl.useProgram(progP)
      gl.uniform2f(locP.uRes, w, h)
      gl.uniform1f(locP.uTime, time)
      gl.uniform1f(locP.uMorph, morph)
      gl.uniform1f(locP.uAngleY, angleY)
      gl.uniform1f(locP.uTiltX, tiltX)
      gl.uniform1f(locP.uBrainScale, scale)
      gl.uniform2f(locP.uCenter, cx, cyy)
      gl.uniform1f(locP.uFocal, FOCAL)
      gl.uniform3fv(locP.uPulseOrigin, pulseOrigin)
      gl.uniform1f(locP.uPulseTime, pulseT)
      gl.uniform1f(locP.uPulseBoost, boost)
      gl.uniform3fv(locP.uBlobs, blobArr)
      gl.uniform2f(locP.uMouse, sm.x, sm.y)
      gl.uniform1f(locP.uGlow, glow)
      gl.uniform1f(locP.uCell, CELL)
      gl.uniform1i(locP.uAtlas, 0)
      gl.uniform1f(locP.uDpr, dpr)
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, N)
      gl.bindVertexArray(vaoL)
      gl.useProgram(progL)
      gl.uniform2f(locL.uRes, w, h)
      gl.uniform1f(locL.uTime, time)
      gl.uniform1f(locL.uMorph, morph)
      gl.uniform1f(locL.uAngleY, angleY)
      gl.uniform1f(locL.uTiltX, tiltX)
      gl.uniform1f(locL.uBrainScale, scale)
      gl.uniform2f(locL.uCenter, cx, cyy)
      gl.uniform1f(locL.uFocal, FOCAL)
      gl.uniform3fv(locL.uPulseOrigin, pulseOrigin)
      gl.uniform1f(locL.uPulseTime, pulseT)
      gl.uniform1f(locL.uPulseBoost, boost)
      gl.uniform1f(locL.uCell, CELL)
      gl.drawArrays(gl.LINES, 0, E * 2)
      gl.bindVertexArray(null)
      lastDrawn.morph = morph
      lastDrawn.pulse = boost
      lastDrawn.x = sm.x
      lastDrawn.y = sm.y
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || !visible) return
      if (still) {
        const p = progressRef.current
        if (p.morph === lastDrawn.morph && p.pulse === lastDrawn.pulse && sm.x === lastDrawn.x && sm.y === lastDrawn.y) {
          // Cena congelada: sem animação contínua em reduced-motion.
          if (mouse.x !== sm.x || mouse.y !== sm.y) draw(now)
          return
        }
        draw(now)
        return
      }
      draw(now)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.parentElement?.removeEventListener('pointermove', onMove)
      canvas.parentElement?.removeEventListener('pointerleave', onLeave)
      // WHY sem loseContext: getContext devolve o MESMO contexto do canvas —
      // perdê-lo no cleanup (StrictMode remount / HMR) quebra o efeito seguinte
      // com compiles noop e info-log null. O contexto morre com o canvas.
    }
  }, [failed, progressRef, fixedMorph])

  if (failed) return <GooPanel />
  return (
    <div className="relative h-72 w-full overflow-hidden sm:h-96 lg:h-full lg:min-h-[540px]" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full mix-blend-screen" />
    </div>
  )
}

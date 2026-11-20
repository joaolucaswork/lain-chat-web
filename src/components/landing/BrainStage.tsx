import { useEffect, useRef, useState } from 'react'
import { GooPanel } from '@/components/GooPanel'
import { GLYPH_ORDER, createGlyphAtlas } from './glyphAtlas'
import { FRAG_SRC, VERT_SRC } from './brainShaders'
import type { LandingProgress } from './useLandingProgress'

/**
 * Stage WebGL2 da landing (Etapa 2: Hero, morph=0).
 * Instanced quads com o mesmo campo de glifos do GooPanel, só que na GPU.
 * Fallback automático p/ GooPanel 2D sem WebGL2 ou com context perdido.
 */

const BLOBS = 10
const CELL = 15

type Blob = { bx: number; by: number; r: number; sp: number; ph: number; x: number; y: number }

function makeBlobs(): Blob[] {
  return Array.from({ length: BLOBS }, (_, i) => ({
    bx: 0.2 + 0.6 * ((i * 0.37) % 1),
    by: 0.28 + 0.5 * ((i * 0.53) % 1),
    r: 0.09 + 0.05 * ((i * 0.29) % 1),
    sp: 0.0009 + 0.0005 * ((i * 0.41) % 1),
    ph: i * 1.7,
    x: 0,
    y: 0,
  }))
}

/** Avança os blobs (mesma fórmula do GooPanel) e preenche o uniform uBlobs. */
function stepBlobs(
  blobs: Blob[],
  out: Float32Array,
  w: number,
  h: number,
  tMs: number,
  sm: { x: number; y: number },
  glow: number,
): void {
  const m = Math.min(w, h)
  blobs.forEach((b, i) => {
    const x = b.bx * w + Math.sin(tMs * b.sp + b.ph) * w * 0.12
    const y = b.by * h + Math.cos(tMs * b.sp * 1.3 + b.ph) * h * 0.12
    const dx = x - sm.x
    const dy = y - sm.y
    const d = Math.hypot(dx, dy)
    const push = d < 160 && d > 0.01 ? ((160 - d) / 160) * 46 * glow : 0
    b.x = x + (dx / (d || 1)) * push
    b.y = y + (dy / (d || 1)) * push
    out[i * 3] = b.x
    out[i * 3 + 1] = b.y
    out[i * 3 + 2] = b.r * m * 0.6
  })
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null
  return sh
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  return prog
}

/** Sobe o atlas 8x8 p/ a GPU (uma única vez). */
function uploadAtlas(gl: WebGL2RenderingContext, prog: WebGLProgram): boolean {
  const tex = gl.createTexture()
  if (!tex) return false
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createGlyphAtlas())
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform1i(gl.getUniformLocation(prog, 'uAtlas'), 0)
  return true
}

/** Grade jitter que cobre o stage (1 partícula por célula + jitter). */
function makeInstanceData(n: number, w: number, h: number): Float32Array {
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / Math.max(1, h))))
  const rows = Math.max(1, Math.ceil(n / cols))
  const data = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols) % rows
    data[i * 4] = ((c + 0.5) / cols) * w + (Math.random() - 0.5) * (w / cols) * 0.6
    data[i * 4 + 1] = ((r + 0.5) / rows) * h + (Math.random() - 0.5) * (h / rows) * 0.6
    data[i * 4 + 2] = Math.random()
    data[i * 4 + 3] = (Math.random() * GLYPH_ORDER.length) | 0
  }
  return data
}

type Locs = Record<'res' | 'time' | 'blobs' | 'mouse' | 'glow' | 'cell' | 'dpr', WebGLUniformLocation | null>

function getLocs(gl: WebGL2RenderingContext, prog: WebGLProgram): Locs {
  const u = (name: string) => gl.getUniformLocation(prog, name)
  return { res: u('uRes'), time: u('uTime'), blobs: u('uBlobs'), mouse: u('uMouse'), glow: u('uGlow'), cell: u('uCell'), dpr: u('uDpr') }
}

/** Liga o quad base (4 vértices, não-instanciado) + índice. */
function bindQuad(gl: WebGL2RenderingContext, prog: WebGLProgram): void {
  // v0 = esquerda-topo na tela (Y flip no shader) — casa com o atlas sem FLIP_Y.
  const verts = new Float32Array([-0.5, -0.5, 0, 0, 0.5, -0.5, 1, 0, 0.5, 0.5, 1, 1, -0.5, 0.5, 0, 1])
  const vbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
  const aCorner = gl.getAttribLocation(prog, 'aCorner')
  const aUV = gl.getAttribLocation(prog, 'aUV')
  gl.enableVertexAttribArray(aCorner)
  gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(aUV)
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
}

/** Liga o buffer de instâncias [homeX, homeY, seed, glyph] com divisor 1. */
function bindInstances(gl: WebGL2RenderingContext, prog: WebGLProgram, data: Float32Array): WebGLBuffer | null {
  const vbo = gl.createBuffer()
  if (!vbo) return null
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  const ptr = (name: string, size: number, offset: number) => {
    const loc = gl.getAttribLocation(prog, name)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 16, offset)
    gl.vertexAttribDivisor(loc, 1)
  }
  ptr('aHome', 2, 0)
  ptr('aSeed', 1, 8)
  ptr('aGlyph', 1, 12)
  return vbo
}

export function BrainStage({ progressRef }: { progressRef: React.RefObject<LandingProgress> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || failed) return
    // Etapa 3 consome progressRef (uMorph); Etapa 2 fixa o Hero em morph=0.
    void progressRef
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true })
    if (!gl) {
      setFailed(true)
      return
    }
    const prog = createProgram(gl)
    if (!prog || !uploadAtlas(gl, prog)) {
      setFailed(true)
      return
    }
    gl.useProgram(prog)
    const loc = getLocs(gl, prog)
    bindQuad(gl, prog)

    const desktop = window.matchMedia?.('(min-width: 1024px)').matches ?? true
    const N = desktop ? 3500 : 1800
    let w = 1
    let h = 1
    let dpr = 1
    let instVbo: WebGLBuffer | null = null

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, desktop ? 2 : 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      if (instVbo) gl.deleteBuffer(instVbo)
      instVbo = bindInstances(gl, prog, makeInstanceData(N, w, h))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const mouse = { x: -9999, y: -9999 }
    const sm = { x: -9999, y: -9999 }
    let glow = 1
    const blobs = makeBlobs()
    const blobArr = new Float32Array(BLOBS * 3)
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

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let raf = 0

    const draw = (now: number) => {
      const tMs = now - t0
      const active = mouse.x > -9000
      if (active) {
        if (sm.x < -9000) {
          sm.x = mouse.x
          sm.y = mouse.y
        } else {
          sm.x += (mouse.x - sm.x) * 0.14
          sm.y += (mouse.y - sm.y) * 0.14
        }
      }
      glow += ((active ? 1 : 0) - glow) * 0.07
      stepBlobs(blobs, blobArr, w, h, tMs, sm, glow)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.uniform2f(loc.res, w, h)
      gl.uniform1f(loc.time, tMs / 1000)
      gl.uniform3fv(loc.blobs, blobArr)
      gl.uniform2f(loc.mouse, sm.x, sm.y)
      gl.uniform1f(loc.glow, glow)
      gl.uniform1f(loc.cell, CELL)
      gl.uniform1f(loc.dpr, dpr)
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, N)
    }
    if (still) {
      draw(t0)
    } else {
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop)
        if (document.hidden || !visible) return
        draw(now)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.parentElement?.removeEventListener('pointermove', onMove)
      canvas.parentElement?.removeEventListener('pointerleave', onLeave)
      if (instVbo) gl.deleteBuffer(instVbo)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [failed, progressRef])

  if (failed) return <GooPanel />
  return (
    <div className="relative h-72 w-full overflow-hidden sm:h-96 lg:h-full lg:min-h-[540px]" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full mix-blend-screen" />
    </div>
  )
}

/** Atlas de glifos 8x8 para o stage WebGL2 (Etapa 2: Hero, morph=0). */

export const GLYPH_ORDER = 'アイウエオカキクケコサシスセソ01<>*+#$%&?/\\|_='
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 8
export const ATLAS_CELL = 40

/** Desenha cada glifo uma única vez num canvas 2D offscreen (branco puro). */
export function createGlyphAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLS * ATLAS_CELL
  canvas.height = ATLAS_ROWS * ATLAS_CELL
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.font = `28px ui-monospace, Menlo, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < GLYPH_ORDER.length; i++) {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    ctx.fillText(GLYPH_ORDER[i], col * ATLAS_CELL + ATLAS_CELL / 2, row * ATLAS_CELL + ATLAS_CELL / 2 + 1)
  }
  return canvas
}

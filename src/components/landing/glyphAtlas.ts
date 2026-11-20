/** Atlas de glifos 8x8 para o stage WebGL2 (Etapa 2: Hero, morph=0). */

/**
 * Vocabulário de símbolos do stage (espelho do hero de referência Adaline:
 * só ASCII + middle dot, sem katakana e sem dígitos). Cabe nos 64 slots
 * do atlas 8x8; o shader sorteia `0..length`.
 */
export const GLYPH_ORDER = '!#$%&*+-./:;<=>?@\\^_|~·'
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
  // Glifo grande na célula (34/40): no quad de 15px rende ~13px, par com os
  // 12px do GooPanel 2D. Sem mipmaps no upload (LINEAR direto = nítido).
  ctx.font = `34px ui-monospace, Menlo, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < GLYPH_ORDER.length; i++) {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    ctx.fillText(GLYPH_ORDER[i], col * ATLAS_CELL + ATLAS_CELL / 2, row * ATLAS_CELL + ATLAS_CELL / 2 + 1)
  }
  return canvas
}

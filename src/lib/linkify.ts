/** Escapa texto para injeção segura via dangerouslySetInnerHTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Renderiza corpo de memória/grafo: escapa HTML e destaca `[[entidade]]`
 * como span (antes era <a href="javascript:void(0)"> morto / vetor javascript:).
 */
export function renderWikiHtml(text: string): string {
  return escapeHtml(text).replace(
    /\[\[([^\]]+)\]\]/g,
    '<span class="text-primary font-medium">$1</span>',
  )
}

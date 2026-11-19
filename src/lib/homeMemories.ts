import type { Memory } from '@/types'

export const HIDDEN_HOME_KEY = 'lain-hidden-home-memories'
export const COLLAPSED_HOME_KEY = 'lain-memories-home-collapsed'
export const HAS_MEMORIES_HOME_KEY = 'lain-memories-home-has'
export const SEARCH_PAGE_SIZE = 12
export const SEARCH_DEBOUNCE_MS = 250

/** Ordena por created desc; sem data vai para o fim. */
export function sortByCreatedDesc(list: Memory[]): Memory[] {
  return [...list].sort((a, b) => {
    const ta = Date.parse(a.created || '')
    const tb = Date.parse(b.created || '')
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
    if (Number.isNaN(ta)) return 1
    if (Number.isNaN(tb)) return -1
    return tb - ta
  })
}

/** Filtra por título/preview/projeto/tags (query já normalizada). */
export function filterByQuery(all: Memory[], debounced: string): Memory[] {
  if (!debounced) return all
  return all.filter(
    (m) =>
      (m.title || '').toLowerCase().includes(debounced) ||
      m.preview.toLowerCase().includes(debounced) ||
      m.project.toLowerCase().includes(debounced) ||
      (m.tags || []).some((t) => t.toLowerCase().includes(debounced))
  )
}

export function loadHiddenHomeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_HOME_KEY)
    if (!raw) return new Set()
    const arr: unknown = JSON.parse(raw)
    const ids = Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : []
    return new Set(ids)
  } catch {
    return new Set()
  }
}

export function persistHiddenHomeIds(ids: Set<string>): void {
  try {
    localStorage.setItem(HIDDEN_HOME_KEY, JSON.stringify([...ids]))
  } catch { /* best-effort */ }
}

export function readCollapsedHome(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_HOME_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCollapsedHome(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_HOME_KEY, collapsed ? '1' : '0')
  } catch { /* best-effort */ }
}

/**
 * WHY: evita o flash do skeleton do swiper para quem não tem memórias.
 * Guarda o resultado do último fetch: '1' tem, '0' vazio, null nunca
 * consultado. Visitantes com '0' pulam o skeleton e renderizam null
 * direto até o fetch provar o contrário.
 */
export function readHomeHasMemories(): boolean | null {
  try {
    const raw = localStorage.getItem(HAS_MEMORIES_HOME_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null
  }
}

export function persistHomeHasMemories(has: boolean): void {
  try {
    localStorage.setItem(HAS_MEMORIES_HOME_KEY, has ? '1' : '0')
  } catch { /* best-effort */ }
}

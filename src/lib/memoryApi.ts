import type { FeedbackAction, MemoryKind } from '@/types'

async function parseJson(res: Response) {
  if (!res.ok) throw new Error(`vault ${res.status}`)
  return res.json()
}

/** ✓/🕐 — retorna o feedback atualizado. */
export function sendFeedback(id: string, action: FeedbackAction, kind?: MemoryKind) {
  return fetch(`/api/vault/memory/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...(kind ? { kind } : {}) }),
  }).then(parseJson) as Promise<{
    id: string
    confidence: number
    last_confirmed_at: string | null
    status: 'active' | 'archived'
    kind: MemoryKind
  }>
}

/** ✕ — retorna trashId para undo (7d). */
export function forgetMemory(id: string) {
  return fetch(`/api/vault/memory/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseJson) as Promise<{ success: boolean; trashId: string | null; blocked: boolean; project: string }>
}

/** Undo do ✕. */
export function restoreMemory(trashId: string, project: string) {
  return fetch('/api/vault/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trash_id: trashId, project }),
  }).then(parseJson) as Promise<{ success: boolean; id: string }>
}

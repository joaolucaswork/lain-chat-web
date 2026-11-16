export type MemoryStatus = 'active' | 'archived'
export type MemoryKind = 'fact' | 'state'
export type FeedbackAction = 'confirm' | 'archive' | 'unarchive'

export interface Memory {
  id: string
  file: string
  project: string
  tags: string[]
  created: string
  preview: string
  /** Título curto (ideal 3, máx 6 palavras). Null até o backfill/extração gerar. */
  title?: string | null
  confidence: number
  last_confirmed_at: string | null
  status: MemoryStatus
  kind: MemoryKind
}

/** Defaults neutros — ranking inalterado até o primeiro voto. */
export const NEUTRAL_FEEDBACK = {
  confidence: 0.5,
  last_confirmed_at: null,
  status: 'active',
  kind: 'fact',
} as const

export function feedbackOf(m: Partial<Memory>) {
  return {
    confidence: typeof m.confidence === 'number' ? m.confidence : NEUTRAL_FEEDBACK.confidence,
    last_confirmed_at: m.last_confirmed_at ?? null,
    status: m.status === 'archived' ? 'archived' : ('active' as MemoryStatus),
    kind: m.kind === 'state' ? 'state' : ('fact' as MemoryKind),
  }
}

export interface GraphNode {
  id?: string
  key: string
  type: string
  file: string
  body?: string
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'system'; content: string }

export interface Session {
  id: string
  createdAt: number
  messageCount: number
  preview: string
  title?: string
  model?: string
}

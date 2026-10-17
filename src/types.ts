export interface Memory {
  id: string
  file: string
  project: string
  tags: string[]
  created: string
  preview: string
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
  model?: string
}

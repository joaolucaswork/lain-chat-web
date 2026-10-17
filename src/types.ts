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

export type ChatMode = 'chat' | 'agent'

export interface Project {
  name: string
  path: string
}

export interface ToolActivity {
  type: 'tool'
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  error?: string
  status: 'running' | 'done' | 'error'
}

export interface ApprovalRequest {
  type: 'approval'
  approvalId: string
  tool: string
  summary: string
  preview?: string
  status: 'pending' | 'approved' | 'denied'
  error?: string
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'system'; content: string }
  | ToolActivity
  | ApprovalRequest

export function isToolActivity(msg: ChatMessage): msg is ToolActivity {
  return 'type' in msg && msg.type === 'tool'
}

export function isApprovalRequest(msg: ChatMessage): msg is ApprovalRequest {
  return 'type' in msg && msg.type === 'approval'
}

export function isRoleMessage(msg: ChatMessage): msg is { role: 'user' | 'assistant' | 'system'; content: string } {
  return 'role' in msg
}

export interface Session {
  id: string
  createdAt: number
  messageCount: number
  preview: string
  mode?: ChatMode
  workingDir?: string | null
  autoApproveEdits?: boolean
}

export interface AgentPool {
  pool_id?: string
  id?: string
  task?: string
  agentCount?: number
  status?: string
  agents?: AgentInfo[]
}

export interface AgentInfo {
  id?: string
  agent_id?: string
  status?: string
  task?: string
}

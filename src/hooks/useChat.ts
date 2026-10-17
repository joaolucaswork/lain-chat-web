import { useState, useRef, useCallback, useEffect } from 'react'
import type { ChatMessage, ChatMode, ToolActivity, ApprovalRequest } from '@/types'
import { isToolActivity, isApprovalRequest } from '@/types'

const SESSION_ID_KEY = 'lain-chat-session'
const GLOBAL_MODE_KEY = 'lain-chat-mode'
const GLOBAL_WORKING_DIR_KEY = 'lain-chat-working-dir'
const GLOBAL_AUTO_APPROVE_KEY = 'lain-chat-auto-approve'

function sessionKey(sessionId: string, suffix: string): string {
  return `lain-chat-${sessionId}-${suffix}`
}

function loadSessionMode(sessionId: string): ChatMode {
  const stored = localStorage.getItem(sessionKey(sessionId, 'mode'))
  if (stored === 'chat' || stored === 'agent') return stored
  const global = localStorage.getItem(GLOBAL_MODE_KEY)
  if (global === 'chat' || global === 'agent') return global
  return 'chat'
}

function loadSessionWorkingDir(sessionId: string): string | null {
  return localStorage.getItem(sessionKey(sessionId, 'workingDir'))
    || localStorage.getItem(GLOBAL_WORKING_DIR_KEY)
    || null
}

function loadSessionAutoApprove(sessionId: string): boolean {
  const val = localStorage.getItem(sessionKey(sessionId, 'autoApprove'))
  if (val !== null) return val === 'true'
  return localStorage.getItem(GLOBAL_AUTO_APPROVE_KEY) === 'true'
}

function saveSessionMode(sessionId: string, mode: ChatMode): void {
  localStorage.setItem(sessionKey(sessionId, 'mode'), mode)
}

function saveSessionWorkingDir(sessionId: string, dir: string | null): void {
  if (dir) localStorage.setItem(sessionKey(sessionId, 'workingDir'), dir)
  else localStorage.removeItem(sessionKey(sessionId, 'workingDir'))
}

function saveSessionAutoApprove(sessionId: string, value: boolean): void {
  localStorage.setItem(sessionKey(sessionId, 'autoApprove'), String(value))
}

type RawServerMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: string
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

function loadPersistedMode(): ChatMode {
  return loadSessionMode(getSessionId())
}

function loadPersistedWorkingDir(): string | null {
  return loadSessionWorkingDir(getSessionId())
}

function loadPersistedAutoApprove(): boolean {
  return loadSessionAutoApprove(getSessionId())
}

export function useChat(model: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [sessionId, setSessionId] = useState(getSessionId)
  const [mode, setModeState] = useState<ChatMode>(loadPersistedMode)
  const [workingDir, setWorkingDirState] = useState<string | null>(loadPersistedWorkingDir)
  const [autoApproveEdits, setAutoApproveEditsState] = useState(loadPersistedAutoApprove)
  const eventSourceRef = useRef<EventSource | null>(null)
  const latestRequestedSessionRef = useRef<string | null>(getSessionId())
  const activeSessionRef = useRef<string>(getSessionId())

  const setMode = useCallback((m: ChatMode) => {
    setModeState(m)
    saveSessionMode(activeSessionRef.current, m)
  }, [])

  const setWorkingDir = useCallback((d: string | null) => {
    setWorkingDirState(d)
    saveSessionWorkingDir(activeSessionRef.current, d)
  }, [])

  const setAutoApproveEdits = useCallback((v: boolean) => {
    setAutoApproveEditsState(v)
    saveSessionAutoApprove(activeSessionRef.current, v)
  }, [])

  const connectSSE = useCallback((sid: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(`/api/chat?sessionId=${sid}`)
    eventSourceRef.current = es

    es.addEventListener('connected', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setSessionId(data.sessionId)
      sessionStorage.setItem(SESSION_ID_KEY, data.sessionId)
    })

    es.addEventListener('user_message', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => [...prev, { role: 'user', content: data.text }])
    })

    es.addEventListener('processing_start', () => {
      setProcessing(true)
      setStatus('Thinking...')
    })

    es.addEventListener('token', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && 'role' in last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: last.content + data.text }]
        }
        return [...prev, { role: 'assistant', content: data.text }]
      })
    })

    es.addEventListener('token_end', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      if (!data.text) return
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && 'role' in last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: last.content + data.text }]
        }
        return [...prev, { role: 'assistant', content: data.text }]
      })
    })

    es.addEventListener('tool_start', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      const activity: ToolActivity = {
        type: 'tool',
        id: data.id,
        name: data.name,
        args: data.args || {},
        status: 'running',
      }
      setMessages((prev) => [...prev, activity])
    })

    es.addEventListener('tool_end', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const msg = prev[i]
          if (isToolActivity(msg) && msg.id === data.id) {
            const updated = [...prev]
            updated[i] = { ...msg, result: data.result, status: 'done' }
            return updated
          }
        }
        return prev
      })
    })

    es.addEventListener('tool_error', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const msg = prev[i]
          if (isToolActivity(msg) && msg.id === data.id) {
            const updated = [...prev]
            updated[i] = { ...msg, error: data.error, status: 'error' }
            return updated
          }
        }
        return prev
      })
    })

    es.addEventListener('approval_request', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      const approval: ApprovalRequest = {
        type: 'approval',
        approvalId: data.approvalId,
        tool: data.tool,
        summary: data.summary,
        preview: data.preview,
        status: 'pending',
      }
      setMessages((prev) => [...prev, approval])
      setStatus('Waiting for approval...')
    })

    es.addEventListener('done', () => {
      setProcessing(false)
      setStatus('Ready')
    })

    es.addEventListener('server_error', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => [...prev, { role: 'system', content: `Error: ${data.message}` }])
      setProcessing(false)
      setStatus('Ready')
    })

    es.addEventListener('ping', () => {})

    es.onerror = () => {
      es.close()
      setTimeout(() => connectSSE(sid), 3000)
    }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || processing) return
    setLoading(true)
    try {
      await fetch(`/api/chat?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model,
          mode,
          workingDir,
          autoApproveEdits,
        }),
      })
    } catch {
      setMessages((prev) => [...prev, { role: 'system', content: 'Failed to send message' }])
    } finally {
      setLoading(false)
    }
  }, [sessionId, processing, model, mode, workingDir, autoApproveEdits])

  const stopGenerating = useCallback(async () => {
    try {
      await fetch(`/api/chat/stop?sessionId=${sessionId}`, { method: 'POST' })
    } catch {}
    setProcessing(false)
    setStatus('Ready')
  }, [sessionId])

  const submittingApprovalRef = useRef<Set<string>>(new Set())

  const approveAction = useCallback(async (approvalId: string, decision: 'approve' | 'deny') => {
    if (submittingApprovalRef.current.has(approvalId)) return
    submittingApprovalRef.current.add(approvalId)

    try {
      const res = await fetch(`/api/chat/approve?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decision }),
      })

      if (!res.ok) {
        let errorMsg = `Approval failed (${res.status})`
        try {
          const errData = await res.json()
          if (errData.error) errorMsg = errData.error
        } catch {}
        setMessages((prev) =>
          prev.map((msg) =>
            isApprovalRequest(msg) && msg.approvalId === approvalId
              ? { ...msg, status: 'pending' as const, error: errorMsg }
              : msg
          )
        )
        return
      }

      const body = await res.json().catch(() => null)
      if (!body || body.ok !== true) {
        setMessages((prev) =>
          prev.map((msg) =>
            isApprovalRequest(msg) && msg.approvalId === approvalId
              ? { ...msg, status: 'pending' as const, error: 'Server rejected approval' }
              : msg
          )
        )
        return
      }

      setMessages((prev) =>
        prev.map((msg) =>
          isApprovalRequest(msg) && msg.approvalId === approvalId
            ? { ...msg, status: decision === 'approve' ? 'approved' : 'denied' as const }
            : msg
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          isApprovalRequest(msg) && msg.approvalId === approvalId
            ? { ...msg, status: 'pending' as const, error: 'Network error' }
            : msg
        )
      )
    } finally {
      submittingApprovalRef.current.delete(approvalId)
    }
  }, [sessionId])

  const loadMessages = useCallback(async (sid: string) => {
    const requestedSid = sid

    try {
      const res = await fetch(`/api/history?sessionId=${sid}`)
      const data = await res.json()
      const toolResults = new Map<string, string>()
      const toolErrors = new Map<string, string>()
      const rawMessages = (data.messages ?? []) as RawServerMessage[]

      for (const msg of rawMessages) {
        if (msg.role === 'tool' && msg.tool_call_id) {
          if (msg.content?.startsWith('Error:') || msg.content?.startsWith('Negado')) {
            toolErrors.set(msg.tool_call_id, msg.content)
          } else {
            toolResults.set(msg.tool_call_id, msg.content || '')
          }
        }
      }

      const mappedMessages = rawMessages.reduce<ChatMessage[]>((acc, message) => {
        const content = message.content?.trim()

        if (message.role === 'system') {
          return acc
        }

        if (message.role === 'tool') {
          return acc
        }

        if (message.role === 'user') {
          if (content) {
            acc.push({ role: 'user', content })
          }
          return acc
        }

        if (message.role === 'assistant') {
          if (content) {
            acc.push({ role: 'assistant', content })
          }

          if (message.tool_calls?.length) {
            for (const toolCall of message.tool_calls) {
              const name = toolCall.function.name.includes('__')
                ? toolCall.function.name.split('__').pop() ?? toolCall.function.name
                : toolCall.function.name
              let args: Record<string, unknown> = {}
              try { args = JSON.parse(toolCall.function.arguments) } catch {}

              const result = toolResults.get(toolCall.id)
              const error = toolErrors.get(toolCall.id)
              const status: ToolActivity['status'] = error ? 'error' : result !== undefined ? 'done' : 'running'

              acc.push({
                type: 'tool',
                id: toolCall.id,
                name,
                args,
                result,
                error,
                status,
              })
            }
          }
        }

        return acc
      }, [])

      const pendingApprovals = (data.pendingApprovals ?? []) as Array<{ approvalId: string; tool: string; summary: string; preview?: string }>
      for (const pa of pendingApprovals) {
        mappedMessages.push({
          type: 'approval',
          approvalId: pa.approvalId,
          tool: pa.tool,
          summary: pa.summary,
          preview: pa.preview,
          status: 'pending',
        })
      }

      if (latestRequestedSessionRef.current !== requestedSid) return

      setMessages(mappedMessages)

      if (data.mode || data.workingDir !== undefined || typeof data.autoApproveEdits === 'boolean') {
        if (data.mode && (data.mode === 'chat' || data.mode === 'agent')) {
          setModeState(data.mode)
          saveSessionMode(sid, data.mode)
        }
        if (data.workingDir !== undefined) {
          setWorkingDirState(data.workingDir)
          saveSessionWorkingDir(sid, data.workingDir)
        }
        if (typeof data.autoApproveEdits === 'boolean') {
          setAutoApproveEditsState(data.autoApproveEdits)
          saveSessionAutoApprove(sid, data.autoApproveEdits)
        }
      }
    } catch {
      if (latestRequestedSessionRef.current === requestedSid) {
        setMessages([])
      }
    }
  }, [])

  const switchSession = useCallback((sid: string) => {
    saveSessionMode(activeSessionRef.current, mode)
    saveSessionWorkingDir(activeSessionRef.current, workingDir)
    saveSessionAutoApprove(activeSessionRef.current, autoApproveEdits)

    latestRequestedSessionRef.current = sid
    activeSessionRef.current = sid
    setSessionId(sid)
    sessionStorage.setItem(SESSION_ID_KEY, sid)
    setMessages([])
    setProcessing(false)
    setStatus('Ready')
    void loadMessages(sid)
    connectSSE(sid)
  }, [mode, workingDir, autoApproveEdits, loadMessages, connectSSE])

  const clearSession = useCallback(async () => {
    try {
      await fetch(`/api/clear?sessionId=${sessionId}`, { method: 'POST' })
    } catch {}
    const newId = crypto.randomUUID()
    switchSession(newId)
  }, [sessionId, switchSession])

  /*HOOK_MATCH_4*/useEffect(() => {
    latestRequestedSessionRef.current = sessionId
    connectSSE(sessionId)
    void loadMessages(sessionId)
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [])

  const canSend = mode === 'chat' || (mode === 'agent' && !!workingDir)

  return {
    messages,
    loading,
    processing,
    status,
    sessionId,
    mode,
    setMode,
    workingDir,
    setWorkingDir,
    autoApproveEdits,
    setAutoApproveEdits,
    canSend,
    sendMessage,
    stopGenerating,
    approveAction,
    switchSession,
    clearSession,
    loadMessages,
  }
}

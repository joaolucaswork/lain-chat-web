import { useState, useRef, useCallback, useEffect } from 'react'
import type { ChatMessage } from '@/types'

const SESSION_ID_KEY = 'lain-chat-session'

type RawServerMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | null
}

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

export function useChat(model: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [processing, setProcessing] = useState(false)
  const [sessionId, setSessionId] = useState(getSessionId)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRequestedSessionRef = useRef<string | null>(getSessionId())
  const activeSessionRef = useRef<string>(getSessionId())

  const connectSSE = useCallback((sid: string) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
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
    })

    es.addEventListener('token', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
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
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: last.content + data.text }]
        }
        return [...prev, { role: 'assistant', content: data.text }]
      })
    })

    es.addEventListener('done', () => {
      setProcessing(false)
    })

    es.addEventListener('server_error', (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setMessages((prev) => [...prev, { role: 'system', content: `Error: ${data.message}` }])
      setProcessing(false)
    })

    es.addEventListener('ping', () => {})

    es.onerror = () => {
      es.close()
      if (activeSessionRef.current !== sid) return
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        if (activeSessionRef.current !== sid) return
        connectSSE(sid)
      }, 3000)
    }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || processing) return
    try {
      await fetch(`/api/chat?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model }),
      })
    } catch {
      setMessages((prev) => [...prev, { role: 'system', content: 'Failed to send message' }])
    }
  }, [sessionId, processing, model])

  const stopGenerating = useCallback(async () => {
    try {
      await fetch(`/api/chat/stop?sessionId=${sessionId}`, { method: 'POST' })
    } catch {}
    setProcessing(false)
  }, [sessionId])

  const retryLast = useCallback(async () => {
    if (processing) return
    // Descarta o estado parcial do turno falho (erros + resposta incompleta
    // após o último user) e re-executa o LLM no servidor sem duplicar
    // a mensagem do usuário.
    let lastUser = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUser = i
        break
      }
    }
    if (lastUser === -1) return
    setMessages((prev) => {
      // `prev` pode ter avançado desde o clique; recorta após o último user
      // do estado atual para não apagar mensagem nova.
      let u = -1
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'user') {
          u = i
          break
        }
      }
      if (u === -1) return prev
      return prev.slice(0, u + 1)
    })
    try {
      const res = await fetch(`/api/chat/retry?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: `Error: ${(data as { error?: string }).error || 'retry failed'}` },
        ])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'system', content: 'Error: retry failed' }])
    }
  }, [sessionId, processing, model, messages])

  const loadMessages = useCallback(async (sid: string) => {
    const requestedSid = sid

    try {
      const res = await fetch(`/api/history?sessionId=${sid}`)
      const data = await res.json()
      const rawMessages = (data.messages ?? []) as RawServerMessage[]

      const mapped: ChatMessage[] = []
      for (const m of rawMessages) {
        if (m.role === 'system' && !m.content?.startsWith('Error:')) continue
        if (m.role === 'user' || m.role === 'assistant') {
          if (m.content?.trim()) mapped.push({ role: m.role, content: m.content })
        } else if (m.role === 'system' && m.content?.trim()) {
          mapped.push({ role: 'system', content: m.content })
        }
      }

      if (latestRequestedSessionRef.current !== requestedSid) return
      setMessages(mapped)
    } catch {
      if (latestRequestedSessionRef.current === requestedSid) {
        setMessages([])
      }
    }
  }, [])

  const switchSession = useCallback((sid: string) => {
    latestRequestedSessionRef.current = sid
    activeSessionRef.current = sid
    setSessionId(sid)
    sessionStorage.setItem(SESSION_ID_KEY, sid)
    setMessages([])
    setProcessing(false)
    void loadMessages(sid)
    connectSSE(sid)
  }, [loadMessages, connectSSE])

  const clearSession = useCallback(async () => {
    // "New conversation" = apenas troca para um id novo.
    // A sessão antiga permanece no servidor para continuar acessível no histórico.
    const newId = crypto.randomUUID()
    switchSession(newId)
  }, [switchSession])

  useEffect(() => {
    latestRequestedSessionRef.current = sessionId
    connectSSE(sessionId)
    void loadMessages(sessionId)
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [])

  return {
    messages,
    processing,
    sessionId,
    sendMessage,
    retryLast,
    stopGenerating,
    switchSession,
    clearSession,
    loadMessages,
  }
}

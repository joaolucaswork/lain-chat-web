import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useModel } from '@/hooks/useModel'
import { useChat } from '@/hooks/useChat'
import { cn } from '@/lib/utils'
import type { ChatMessage, Session } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageSquare, BookOpen, Plus } from 'lucide-react'

export interface LayoutContext {
  model: string
  messages: ChatMessage[]
  processing: boolean
  status: string
  sendMessage: (text: string) => Promise<void> | void
  stopGenerating: () => Promise<void>
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const { model, setModel, models } = useModel()
  const chat = useChat(model)

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {}
  }, [])

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 10000)
    return () => clearInterval(interval)
  }, [refreshSessions])

  const navItems = [
    { path: '/', label: 'Chat', icon: MessageSquare },
    { path: '/memorias', label: 'Memórias', icon: BookOpen },
  ]

  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground">Lain</h1>
          </div>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="p-2 space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                location.pathname === path
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 flex flex-col overflow-hidden">
          {location.pathname === '/' && (
            <>
              <div className="px-3 py-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Sessions
                </h2>
              </div>
              <ScrollArea className="flex-1 px-2">
                <div className="space-y-0.5">
                  {sessions.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No sessions</p>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          chat.switchSession(s.id)
                          void refreshSessions()
                        }}
                        className={cn(
                          'px-2 py-1.5 rounded text-xs cursor-pointer truncate transition-colors',
                          s.id === chat.sessionId
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        title={s.preview || s.id}
                      >
                        {s.preview || s.id.slice(0, 8)}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="px-3 py-2 border-t border-border">
                <button
                  type="button"
                  onClick={async () => {
                    await chat.clearSession()
                    await refreshSessions()
                    if (location.pathname !== '/') {
                      navigate('/')
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-3 h-3" />
                  New conversation
                </button>
              </div>
            </>
          )}
        </div>

        <div className="block border-t border-border p-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Memória ativa
          </h2>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Cada conversa consulta suas memórias antes de responder e salva o
            que importa depois. Veja tudo em Memórias.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet
          context={{
            model,
            messages: chat.messages,
            processing: chat.processing,
            status: chat.status,
            sendMessage: chat.sendMessage,
            stopGenerating: chat.stopGenerating,
          } satisfies LayoutContext}
        />
      </div>
    </div>
  )
}

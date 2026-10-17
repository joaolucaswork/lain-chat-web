import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
import { MessageSquare, BookOpen, Plus, MoreHorizontal, Trash2 } from 'lucide-react'

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
  // Menu "Apagar" renderizado em portal (fixed) para não ser cortado pelo overflow do ScrollArea
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

  // Fecha o menu de "..." ao clicar fora, rolar, redimensionar ou apertar Escape
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  const handleDeleteSession = useCallback(
    async (id: string) => {
      setMenu(null)
      setDeletingId(id)
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('delete failed')
        if (id === chat.sessionId) {
          await chat.clearSession()
        }
        await refreshSessions()
      } catch {
        // mantém a lista como está em caso de erro
      } finally {
        setDeletingId(null)
      }
    },
    [chat, refreshSessions]
  )

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
                          'group relative px-2 py-1.5 rounded text-xs cursor-pointer transition-colors flex items-center',
                          s.id === chat.sessionId
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        title={s.preview || s.id}
                      >
                        <span className="min-w-0 flex-1 truncate pr-7">
                          {s.preview || 'New conversation'}
                        </span>
                        <div className="absolute top-1/2 right-1 -translate-y-1/2 shrink-0">
                          <button
                            type="button"
                            aria-label="Opções da conversa"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (menu?.id === s.id) {
                                setMenu(null)
                                return
                              }
                              const rect = e.currentTarget.getBoundingClientRect()
                              const menuHeight = 48
                              const top =
                                rect.bottom + 4 + menuHeight > window.innerHeight
                                  ? rect.top - menuHeight - 4
                                  : rect.bottom + 4
                              setMenu({
                                id: s.id,
                                top,
                                right: window.innerWidth - rect.right,
                              })
                            }}
                            className="p-0.5 rounded hover:bg-accent-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
      {menu &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ top: menu.top, right: menu.right }}
            className="fixed z-50 min-w-[130px] rounded-md border border-border bg-popover p-1 shadow-md"
          >
            <button
              type="button"
              disabled={deletingId === menu.id}
              onClick={() => void handleDeleteSession(menu.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-accent disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deletingId === menu.id ? 'Apagando...' : 'Apagar'}
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}

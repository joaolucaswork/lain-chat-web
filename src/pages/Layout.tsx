import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useModel } from '@/hooks/useModel'
import { useChat } from '@/hooks/useChat'
import type { ChatMessage, Session } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { MessageSquare, BookOpen, Plus, MoreHorizontal, Trash2 } from 'lucide-react'

export interface LayoutContext {
  model: string
  messages: ChatMessage[]
  processing: boolean
  status: string
  sendMessage: (text: string) => Promise<void> | void
  retryLast: () => Promise<void> | void
  stopGenerating: () => Promise<void>
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
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
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader>
          <div className="px-2 pt-2">
            <h1 className="text-lg font-bold text-foreground group-data-[collapsible=icon]:hidden">Lain</h1>
          </div>
          <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-7 w-full text-xs">
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
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ path, label, icon: Icon }) => (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === path}
                      tooltip={label}
                    >
                      <Link to={path}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {location.pathname === '/' && (
            <SidebarGroup>
              <SidebarGroupLabel>Sessions</SidebarGroupLabel>
              <SidebarGroupAction
                title="New conversation"
                onClick={async () => {
                  await chat.clearSession()
                  await refreshSessions()
                  if (location.pathname !== '/') navigate('/')
                }}
              >
                <Plus />
              </SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sessions.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                      No sessions
                    </p>
                  ) : (
                    sessions.map((s) => (
                      <SidebarMenuItem key={s.id}>
                        <SidebarMenuButton
                          isActive={s.id === chat.sessionId}
                          tooltip={s.preview || s.id}
                          className="data-[active=true]:bg-foreground/5 data-[active=true]:font-normal"
                          onClick={() => {
                            chat.switchSession(s.id)
                            void refreshSessions()
                          }}
                        >
                          <span className="truncate">{s.preview || 'New conversation'}</span>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                          showOnHover
                          aria-label="Opções da conversa"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (menu?.id === s.id) {
                              setMenu(null)
                              return
                            }
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
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
                        >
                          <MoreHorizontal />
                        </SidebarMenuAction>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <div className="p-2 group-data-[collapsible=icon]:hidden">
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Memória ativa
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Cada conversa consulta suas memórias antes de responder e salva o
              que importa depois. Veja tudo em Memórias.
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden">
        <Outlet
          context={{
            model,
            messages: chat.messages,
            processing: chat.processing,
            status: chat.status,
            sendMessage: chat.sendMessage,
            retryLast: chat.retryLast,
            stopGenerating: chat.stopGenerating,
          } satisfies LayoutContext}
        />
      </SidebarInset>

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
              <Trash2 className="h-3.5 w-3.5" />
              {deletingId === menu.id ? 'Apagando...' : 'Apagar'}
            </button>
          </div>,
          document.body
        )}
    </SidebarProvider>
  )
}

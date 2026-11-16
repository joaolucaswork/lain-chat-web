import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useModel } from '@/hooks/useModel'
import { useChat } from '@/hooks/useChat'
import type { ChatMessage, Session } from '@/types'
import {
  Sidebar,
  SidebarContent,
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
  useSidebar,
} from '@/components/ui/sidebar'
import { Chat, BookOpen, NotePencil, DotsThree, Trash, Chats, Gear } from '@phosphor-icons/react'

export interface LayoutContext {
  model: string
  messages: ChatMessage[]
  processing: boolean
  sendMessage: (text: string) => Promise<void> | void
  retryLast: () => Promise<void> | void
  stopGenerating: () => Promise<void>
  sessionTitle?: string
}

/** Estado inicial da sidebar a partir do cookie que o SidebarProvider grava
 *  ao alternar (sem isso o refresh sempre voltava expandida). */
function readSidebarOpen(): boolean {
  if (typeof document === 'undefined') return true
  const m = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/)
  return m ? m[1] === 'true' : true
}

/** Item Recentes (só no modo colapsado). Monta/desmonta com altura animada
 *  para não empurrar o item Configurações de repente. */
function RecentesNavItem({
  btnRef,
  open,
  onToggle,
}: {
  btnRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  onToggle: () => void
}) {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  return (
    <AnimatePresence initial={false}>
      {collapsed && (
        <motion.li
          key="recents"
          data-sidebar="menu-item"
          data-slot="sidebar-menu-item"
          className="group/menu-item relative overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          <SidebarMenuButton
            ref={btnRef}
            tooltip="Recentes"
            isActive={open}
            onClick={onToggle}
            aria-label="Conversas recentes"
          >
            <Chats />
            <span>Recentes</span>
          </SidebarMenuButton>
        </motion.li>
      )}
    </AnimatePresence>
  )
}

export function Layout() {  const location = useLocation()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recentsOpen, setRecentsOpen] = useState(false)
  const [recentsPos, setRecentsPos] = useState<{ top: number; left: number } | null>(null)
  const recentsBtnRef = useRef<HTMLButtonElement>(null)
  const { model } = useModel()
  const chat = useChat(model)

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {}
  }, [])

  const focusComposer = useCallback(() => {
    // ChatInput pode ainda não estar montado (navegação) — o mount já foca,
    // o evento cobre o caso de já estar na página do chat.
    setTimeout(() => window.dispatchEvent(new Event('lain:focus-composer')), 50)
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

  useEffect(() => {
    if (!recentsOpen) return
    const close = () => setRecentsOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRecentsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [recentsOpen])

  const toggleRecents = useCallback(() => {
    if (recentsOpen) {
      setRecentsOpen(false)
      return
    }
    const rect = recentsBtnRef.current?.getBoundingClientRect()
    const maxH = Math.min(window.innerHeight * 0.6, 400)
    const left = rect ? rect.right + 8 : 56
    const top = rect
      ? Math.max(8, Math.min(rect.top, window.innerHeight - maxH - 8))
      : 80
    setRecentsPos({ top, left })
    setRecentsOpen(true)
  }, [recentsOpen])

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
    { path: '/', label: 'Chat', icon: Chat },
    { path: '/memorias', label: 'Memórias', icon: BookOpen },
    { path: '/settings', label: 'Configurações', icon: Gear },
  ]

  return (
    <SidebarProvider
      defaultOpen={readSidebarOpen()}
      className="h-svh overflow-hidden"
    >
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center px-2 pt-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <h1 className="overflow-hidden text-lg font-bold whitespace-nowrap text-foreground transition-opacity duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">Lain</h1>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.slice(0, 2).map(({ path, label, icon: Icon }) => (
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
                <RecentesNavItem btnRef={recentsBtnRef} open={recentsOpen} onToggle={toggleRecents} />
                {navItems.slice(2).map(({ path, label, icon: Icon }) => (
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
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>Sessions</SidebarGroupLabel>
                <SidebarGroupAction
                  title="New conversation"
                  onClick={async () => {
                    await chat.clearSession()
                    await refreshSessions()
                    if (location.pathname !== '/') navigate('/')
                    focusComposer()
                  }}
                >
                  <NotePencil />
                </SidebarGroupAction>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sessions.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        No sessions
                      </p>
                    ) : (
                      sessions.map((s) => (
                        <SidebarMenuItem key={s.id}>
                          <SidebarMenuButton
                            isActive={s.id === chat.sessionId}
                            tooltip={s.title || s.preview || s.id}
                            className="data-[active=true]:bg-foreground/5 data-[active=true]:font-normal"
                            onClick={() => {
                              chat.switchSession(s.id)
                              void refreshSessions()
                            }}
                          >
                            <span className="truncate text-muted-foreground/80">{s.title || s.preview || 'New conversation'}</span>
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
                            <DotsThree />
                          </SidebarMenuAction>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden">
        <Outlet
          context={{
            model,
            messages: chat.messages,
            processing: chat.processing,
            sendMessage: chat.sendMessage,
            retryLast: chat.retryLast,
            stopGenerating: chat.stopGenerating,
            sessionTitle:
              sessions.find((s) => s.id === chat.sessionId)?.title ||
              sessions.find((s) => s.id === chat.sessionId)?.preview ||
              undefined,
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
              <Trash className="h-3.5 w-3.5" />
              {deletingId === menu.id ? 'Apagando...' : 'Apagar'}
            </button>
          </div>,
          document.body
        )}

      {recentsOpen &&
        recentsPos &&
        createPortal(
          <div className="fixed inset-0 z-40" onClick={() => setRecentsOpen(false)}>
            <div
              role="dialog"
              aria-label="Conversas recentes"
              onClick={(e) => e.stopPropagation()}
              style={{ top: recentsPos.top, left: recentsPos.left }}
              className="fixed z-50 flex max-h-[60vh] w-64 flex-col overflow-hidden rounded-md border border-border bg-popover shadow-md"
            >
              <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                <span className="text-xs font-medium">Recentes</span>
                <button
                  type="button"
                  title="New conversation"
                  aria-label="New conversation"
                  onClick={async () => {
                    await chat.clearSession()
                    await refreshSessions()
                    setRecentsOpen(false)
                    if (location.pathname !== '/') navigate('/')
                    focusComposer()
                  }}
                  className="flex size-6 items-center justify-center rounded-md hover:bg-accent"
                >
                  <NotePencil className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {sessions.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No sessions
                  </p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`group flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-xs hover:bg-accent ${
                        s.id === chat.sessionId ? 'bg-accent/60' : ''
                      }`}
                    >
                      <button
                        type="button"
                        title={s.title || s.preview || s.id}
                        onClick={() => {
                          chat.switchSession(s.id)
                          void refreshSessions()
                          setRecentsOpen(false)
                          if (location.pathname !== '/') navigate('/')
                        }}
                        className="min-w-0 flex-1 truncate text-left text-muted-foreground/80"
                      >
                        {s.title || s.preview || 'New conversation'}
                      </button>
                      <button
                        type="button"
                        aria-label="Apagar conversa"
                        disabled={deletingId === s.id}
                        onClick={() => void handleDeleteSession(s.id)}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                      >
                        <Trash className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </SidebarProvider>
  )
}

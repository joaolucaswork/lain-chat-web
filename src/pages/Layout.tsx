import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useModel } from '@/hooks/useModel'
import { useChat } from '@/hooks/useChat'
import type { ChatMessage, Session } from '@/types'
import { Chat, BookOpen, Trash, Gear, List, Plus, SidebarSimple } from '@phosphor-icons/react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface LayoutContext {
  model: string
  messages: ChatMessage[]
  processing: boolean
  sendMessage: (text: string) => Promise<void> | void
  retryLast: () => Promise<void> | void
  stopGenerating: () => Promise<void>
  sessionTitle?: string
  openMobileNav: () => void
}

function IconRailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={onClick}
          className={cn(
            'flex size-10 items-center justify-center rounded-lg transition-colors',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function IconRailLink({
  to,
  label,
  active,
  children,
}: {
  to: string
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          aria-label={label}
          title={label}
          className={cn(
            'flex size-10 items-center justify-center rounded-lg transition-colors',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          {children}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const { model } = useModel()
  const chat = useChat(model)

  const isChatRoute = location.pathname === '/'

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {}
  }, [])

  const focusComposer = useCallback(() => {
    setTimeout(() => window.dispatchEvent(new Event('lain:focus-composer')), 50)
  }, [])

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 10000)
    return () => clearInterval(interval)
  }, [refreshSessions])

  const handleNewChat = useCallback(async () => {
    await chat.clearSession()
    await refreshSessions()
    setMobileOpen(false)
    if (location.pathname !== '/') navigate('/')
    focusComposer()
  }, [chat, refreshSessions, location.pathname, navigate, focusComposer])

  const handleDeleteSession = useCallback(
    async (id: string) => {
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

  const openMobileNav = useCallback(() => setMobileOpen(true), [])

  const chatsPanel = (withToggle: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
        <span className="px-1 text-xs font-medium text-muted-foreground">
          Conversas
        </span>
        {withToggle && (
          <button
            type="button"
            title="Retrair histórico"
            aria-label="Retrair histórico"
            onClick={() => setHistoryCollapsed(true)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <SidebarSimple className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Nenhuma conversa
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sessions.map((s) => {
              const active = s.id === chat.sessionId
              return (
                <div
                  key={s.id}
                  className={cn(
                    'group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <button
                    type="button"
                    title={s.title || s.preview || s.id}
                    onClick={() => {
                      chat.switchSession(s.id)
                      void refreshSessions()
                      setMobileOpen(false)
                      if (location.pathname !== '/') navigate('/')
                    }}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    {s.title || s.preview || 'Nova conversa'}
                  </button>
                  <button
                    type="button"
                    aria-label="Apagar conversa"
                    disabled={deletingId === s.id}
                    onClick={() => void handleDeleteSession(s.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                  >
                    <Trash className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Rail de ícones — só ícones, sem títulos */}
      <nav
        aria-label="Navegação principal"
        className="hidden w-[60px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3 md:flex"
      >
        <Link
          to="/"
          aria-label="Lain — início"
          title="Lain"
          className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground"
        >
          L
        </Link>

        <IconRailButton
          label="Nova conversa"
          onClick={() => void handleNewChat()}
        >
          <Plus className="size-5" weight="bold" />
        </IconRailButton>

        <div className="my-1 h-px w-6 bg-sidebar-border" />

        <IconRailLink to="/" label="Chat" active={location.pathname === '/'}>
          <Chat className="size-5" />
        </IconRailLink>
        <IconRailLink
          to="/memorias"
          label="Memórias"
          active={location.pathname === '/memorias'}
        >
          <BookOpen className="size-5" />
        </IconRailLink>

        <div className="flex-1" />

        <IconRailLink
          to="/settings"
          label="Configurações"
          active={location.pathname === '/settings'}
        >
          <Gear className="size-5" />
        </IconRailLink>
      </nav>

      {/* Painel só de chats (desktop, rota do chat) — retrai com motion */}
      {isChatRoute && (
        <motion.aside
          initial={false}
          animate={{ width: historyCollapsed ? 0 : 260 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="hidden shrink-0 overflow-hidden bg-sidebar md:block"
        >
          <motion.div
            initial={false}
            animate={{
              opacity: historyCollapsed ? 0 : 1,
              x: historyCollapsed ? -16 : 0,
            }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex h-full w-[260px] flex-col border-r border-sidebar-border"
          >
            {chatsPanel(true)}
          </motion.div>
        </motion.aside>
      )}

      {/* Conteúdo */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence>
          {isChatRoute && historyCollapsed && (
            <motion.button
              key="expand-history"
              type="button"
              title="Expandir histórico"
              aria-label="Expandir histórico"
              onClick={() => setHistoryCollapsed(false)}
              initial={{ opacity: 0, x: -12, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.92 }}
              className="absolute top-1/2 left-0 z-10 hidden -translate-y-1/2 rounded-r-xl border border-l-0 border-sidebar-border bg-sidebar/90 py-3 pr-1.5 pl-1 text-muted-foreground shadow-lg backdrop-blur hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:block"
            >
              <SidebarSimple className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <Outlet
          context={
            {
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
              openMobileNav,
            } satisfies LayoutContext
          }
        />
      </div>

      {/* Drawer mobile: rail + chats */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-[300px] gap-0 p-0 sm:w-[340px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>
          <div className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3">
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
              className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground"
            >
              L
            </button>
            <button
              type="button"
              aria-label="Nova conversa"
              onClick={() => void handleNewChat()}
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Plus className="size-5" weight="bold" />
            </button>
            <div className="my-1 h-px w-6 bg-sidebar-border" />
            <Link
              to="/"
              aria-label="Chat"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                location.pathname === '/'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent'
              )}
            >
              <Chat className="size-5" />
            </Link>
            <Link
              to="/memorias"
              aria-label="Memórias"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                location.pathname === '/memorias'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent'
              )}
            >
              <BookOpen className="size-5" />
            </Link>
            <div className="flex-1" />
            <Link
              to="/settings"
              aria-label="Configurações"
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                location.pathname === '/settings'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent'
              )}
            >
              <Gear className="size-5" />
            </Link>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
            <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
              <List className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Menu
              </span>
            </div>
            {chatsPanel(false)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

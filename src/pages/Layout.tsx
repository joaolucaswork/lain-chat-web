import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useModel } from '@/hooks/useModel'
import { useChat } from '@/hooks/useChat'
import type { ChatMessage, Session } from '@/types'
import { ChatTeardrop, Brain, Trash, Gear, List, Plus, SidebarSimple, DotsThree, PencilSimple, Star, Check } from '@phosphor-icons/react'
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
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

  useEffect(() => {
    if (!openMenuId) {
      setConfirmDeleteId(null)
      return
    }
    const close = () => {
      setOpenMenuId(null)
      setConfirmDeleteId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenuId])

  const patchSession = useCallback(
    async (id: string, patch: { title?: string; favorite?: boolean }) => {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('patch failed')
      await refreshSessions()
    },
    [refreshSessions]
  )

  const startRename = useCallback((s: Session) => {
    setOpenMenuId(null)
    setRenameValue(s.title || s.preview || '')
    setRenamingId(s.id)
  }, [])

  const saveRename = useCallback(
    async (s: Session) => {
      const id = s.id
      const value = renameValue.trim()
      setRenamingId(null)
      if (!value || value === (s.title || s.preview || '')) return
      try {
        await patchSession(id, { title: value })
      } catch {}
    },
    [renameValue, patchSession]
  )

  const favorites = sessions.filter((s) => s.favorite)
  const rest = sessions.filter((s) => !s.favorite)

  const renderRow = (s: Session) => {
    const active = s.id === chat.sessionId
    const menuOpen = openMenuId === s.id
    return (
      <div
        key={s.id}
        className={cn(
          'group relative flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
      >
        {s.favorite && (
          <ChatTeardrop className="size-4 shrink-0" weight="bold" aria-hidden />
        )}
        {renamingId === s.id ? (
          <input
            autoFocus
            value={renameValue}
            maxLength={80}
            onChange={(e) => setRenameValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveRename(s)
              if (e.key === 'Escape') setRenamingId(null)
            }}
            onBlur={() => void saveRename(s)}
            aria-label="Renomear conversa"
            className="min-w-0 flex-1 rounded border border-sidebar-ring bg-background px-1 py-0.5 text-sm text-foreground outline-none"
          />
        ) : (
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
        )}
        <button
          type="button"
          aria-label="Opções da conversa"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation()
            setConfirmDeleteId(null)
            setOpenMenuId(menuOpen ? null : s.id)
          }}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background focus-visible:opacity-100',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <DotsThree className="size-4 rotate-90" weight="bold" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full right-0 z-30 mt-1 w-44 rounded-md bg-popover p-1 shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => startRename(s)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-popover-foreground hover:bg-accent"
            >
              <PencilSimple className="size-3.5" />
              Renomear
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpenMenuId(null)
                try {
                  await patchSession(s.id, { favorite: !s.favorite })
                } catch {}
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-popover-foreground hover:bg-accent"
            >
              <Star
                className="size-3.5"
                weight={s.favorite ? 'fill' : 'regular'}
              />
              {s.favorite ? 'Desfavoritar' : 'Favoritar'}
            </button>
            <div className="mx-2 my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              disabled={deletingId === s.id}
              onClick={() => {
                if (confirmDeleteId !== s.id) {
                  setConfirmDeleteId(s.id)
                  return
                }
                setOpenMenuId(null)
                setConfirmDeleteId(null)
                void handleDeleteSession(s.id)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50',
                confirmDeleteId === s.id
                  ? 'text-destructive'
                  : 'text-popover-foreground'
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={confirmDeleteId === s.id ? 'check' : 'trash'}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="flex"
                >
                  {confirmDeleteId === s.id ? (
                    <Check className="size-3.5" weight="bold" />
                  ) : (
                    <Trash className="size-3.5" />
                  )}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={
                    deletingId === s.id
                      ? 'Excluindo...'
                      : confirmDeleteId === s.id
                        ? 'Confirmar exclusão'
                        : 'Excluir'
                  }
                  initial={{ x: -8, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 8, opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className="flex"
                >
                  {deletingId === s.id
                    ? 'Excluindo...'
                    : confirmDeleteId === s.id
                      ? 'Confirmar exclusão'
                      : 'Excluir'}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        )}
      </div>
    )
  }

  const chatsPanel = (withToggle: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
        <span className="px-1 text-sm font-semibold text-sidebar-foreground">
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
            <SidebarSimple className="size-4" weight="bold" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Nenhuma conversa
          </p>
        ) : (
          <>
            {favorites.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 px-2 pt-1 pb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Favoritos
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {favorites.map(renderRow)}
                </div>
              </div>
            )}
            {(favorites.length === 0 || rest.length > 0) && (
              <div>
                {favorites.length > 0 && rest.length > 0 && (
                  <div className="px-2 pt-2 pb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Conversas
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {(favorites.length > 0 ? rest : sessions).map(renderRow)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Rail de ícones — só ícones, sem títulos */}
      <nav
        aria-label="Navegação principal"
        className={cn(
          'hidden w-[60px] shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3 md:flex dark:bg-[#111113]',
          isChatRoute && historyCollapsed
            ? 'border-transparent'
            : 'border-sidebar-border'
        )}
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

        <motion.div
          initial={false}
          animate={{
            height: historyCollapsed ? 'auto' : 0,
            opacity: historyCollapsed ? 1 : 0,
            marginTop: historyCollapsed ? 0 : -4,
            marginBottom: historyCollapsed ? 0 : -4,
          }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          style={{ pointerEvents: historyCollapsed ? 'auto' : 'none' }}
          inert={!historyCollapsed}
          aria-hidden={!historyCollapsed}
          className="overflow-hidden"
        >
          <IconRailButton
            label="Expandir histórico"
            onClick={() => {
              if (!isChatRoute) {
                setHistoryCollapsed(false)
                navigate('/')
                return
              }
              setHistoryCollapsed(false)
            }}
          >
            <SidebarSimple className="size-5" weight="bold" />
          </IconRailButton>
        </motion.div>
        <IconRailLink to="/" label="Chat" active={location.pathname === '/'}>
          <ChatTeardrop className="size-5" weight="bold" />
        </IconRailLink>
        <IconRailLink
          to="/memorias"
          label="Memórias"
          active={location.pathname === '/memorias'}
        >
          <Brain className="size-5" weight="regular" />
        </IconRailLink>

        <div className="flex-1" />

        <IconRailLink
          to="/settings"
          label="Configurações"
          active={location.pathname === '/settings'}
        >
          <Gear className="size-5" weight="bold" />
        </IconRailLink>
      </nav>

      {/* Painel só de chats (desktop, rota do chat) — retrai com motion */}
      {isChatRoute && (
        <motion.aside
          initial={false}
          animate={{ width: historyCollapsed ? 0 : 260 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="hidden shrink-0 overflow-hidden bg-sidebar md:block dark:bg-[#111113]"
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
      <div className="flex min-h-0 flex-1 flex-col bg-background">
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
          <div className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3 dark:bg-[#111113]">
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
              <ChatTeardrop className="size-5" weight="bold" />
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
              <Brain className="size-5" weight="regular" />
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
              <Gear className="size-5" weight="bold" />
            </Link>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-sidebar dark:bg-[#111113]">
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

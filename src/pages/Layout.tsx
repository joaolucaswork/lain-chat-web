import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { useModel } from '@/hooks/useModel'
import { useMeMode } from '@/hooks/useMe'
import { TenantExitButton } from '@/components/TenantExitButton'
import { useChat } from '@/hooks/useChat'
import { useSessions } from '@/hooks/useSessions'
import type { ChatMessage, Session } from '@/types'
import { ChatTeardrop, Brain, Gear, Plus, SidebarSimple } from '@phosphor-icons/react'
import { IconRailButton, IconRailLink } from '@/components/layout/IconRail'
import { ChatsPanel } from '@/components/layout/ChatsPanel'
import { SessionRow } from '@/components/layout/SessionRow'
import { MobileNav } from '@/components/layout/MobileNav'
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

const HISTORY_COLLAPSED_KEY = 'lain-history-collapsed'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState<boolean>(() => {
    // WHY persist: mantém o estado retraído/expandido entre reloads.
    // Lê localStorage primeiro, cai para o cookie `sidebar_state` (convenção shadcn).
    try {
      const stored = localStorage.getItem(HISTORY_COLLAPSED_KEY)
      if (stored !== null) return stored === '1'
      const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/)
      if (match) return match[1] === 'false'
    } catch {}
    return false
  })
  const { model } = useModel()
  const meMode = useMeMode()
  const isTenant = meMode === 'tenant'
  const chat = useChat(model)
  const sess = useSessions({ activeSessionId: chat.sessionId, clearActiveSession: chat.clearSession })
  const rootRef = useRef<HTMLDivElement>(null)

  // WHY mobile: acompanha o visualViewport (altura com teclado aberto).
  // iOS não redimensiona o layout no teclado — sem isso o app fica com a
  // altura cheia sob o teclado e o navegador rola a página no foco do input.
  useEffect(() => {
    const el = rootRef.current
    const vv = window.visualViewport
    if (!el || !vv) return
    const sync = () => {
      el.style.height = `${vv.height}px`
    }
    sync()
    vv.addEventListener('resize', sync)
    return () => vv.removeEventListener('resize', sync)
  }, [])

  // WHY persist: salva retraído/expandido em localStorage + cookie `sidebar_state`.
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_COLLAPSED_KEY, historyCollapsed ? '1' : '0')
      document.cookie = `sidebar_state=${String(!historyCollapsed)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    } catch {}
  }, [historyCollapsed])

  const isChatRoute = location.pathname === '/'

  const focusComposer = useCallback(() => {
    setTimeout(() => window.dispatchEvent(new Event('lain:focus-composer')), 50)
  }, [])

  const handleNewChat = useCallback(async () => {
    await chat.clearSession()
    await sess.refreshSessions()
    setMobileOpen(false)
    if (location.pathname !== '/') navigate('/')
    focusComposer()
  }, [chat, sess, location.pathname, navigate, focusComposer])

  const openMobileNav = useCallback(() => setMobileOpen(true), [])

  useEffect(() => {
    const onToggleHistory = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setHistoryCollapsed((v) => !v)
      }
    }
    window.addEventListener('keydown', onToggleHistory)
    return () => window.removeEventListener('keydown', onToggleHistory)
  }, [])

  const switchToSession = useCallback((s: Session) => {
    chat.switchSession(s.id)
    void sess.refreshSessions()
    setMobileOpen(false)
    if (location.pathname !== '/') navigate('/')
  }, [chat, sess, location.pathname, navigate])

  const toggleFavorite = useCallback((s: Session) => {
    sess.setOpenMenuId(null)
    sess.patchSession(s.id, { favorite: !s.favorite }).catch(() => {})
  }, [sess])

  const deleteSession = useCallback((s: Session) => {
    if (sess.confirmDeleteId !== s.id) {
      sess.setConfirmDeleteId(s.id)
      return
    }
    sess.setOpenMenuId(null)
    sess.setConfirmDeleteId(null)
    void sess.handleDeleteSession(s.id)
  }, [sess])

  const renderRow = useCallback((s: Session) => (
    <SessionRow
      key={s.id}
      session={s}
      active={s.id === chat.sessionId}
      renaming={sess.renamingId === s.id}
      renameValue={sess.renameValue}
      setRenameValue={sess.setRenameValue}
      menuOpen={sess.openMenuId === s.id}
      confirmDelete={sess.confirmDeleteId === s.id}
      deleting={sess.deletingId === s.id}
      onSwitch={switchToSession}
      onToggleMenu={() => sess.toggleMenu(s.id)}
      onStartRename={sess.startRename}
      onSaveRename={(row) => void sess.saveRename(row)}
      onCancelRename={() => sess.setRenamingId(null)}
      onToggleFavorite={toggleFavorite}
      onDelete={deleteSession}
    />
  ), [chat.sessionId, sess, switchToSession, toggleFavorite, deleteSession])

  const panel = useCallback((withToggle: boolean) => (
    <ChatsPanel
      favorites={sess.favorites}
      rest={sess.rest}
      sessions={sess.sessions}
      withToggle={withToggle}
      onCollapse={() => setHistoryCollapsed(true)}
      renderRow={renderRow}
    />
  ), [sess, renderRow])

  return (
    <div ref={rootRef} className="flex h-screen overflow-hidden bg-background supports-[height:100dvh]:h-dvh">
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
            label="Expandir histórico (Ctrl+B)"
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

        {isTenant ? (
          <TenantExitButton compact />
        ) : (
          <IconRailLink
            to="/settings"
            label="Configurações"
            active={location.pathname === '/settings'}
          >
            <Gear className="size-5" weight="bold" />
          </IconRailLink>
        )}
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
            className="flex h-full w-[260px] flex-col"
          >
            {panel(true)}
          </motion.div>
        </motion.aside>
      )}

      {/* Conteúdo */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
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
                sess.sessions.find((s) => s.id === chat.sessionId)?.title ||
                sess.sessions.find((s) => s.id === chat.sessionId)?.preview ||
                undefined,
              openMobileNav,
            } satisfies LayoutContext
          }
        />
      </div>

      {/* Drawer mobile: coluna única — histórico em largura total */}
      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        onNewChat={() => void handleNewChat()}
        panel={panel(false)}
      />
    </div>
  )
}

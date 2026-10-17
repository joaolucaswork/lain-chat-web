import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useSessions, useAgents } from '@/hooks/useAgents'
import { useModel } from '@/hooks/useModel'
import { useChat } from '@/hooks/useChat'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ChatMessage, ChatMode } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MessageSquare, BookOpen, Square, Plus, Shield } from 'lucide-react'

export interface LayoutContext {
  model: string
  messages: ChatMessage[]
  processing: boolean
  status: string
  sendMessage: (text: string) => Promise<void> | void
  stopGenerating: () => Promise<void>
  mode: ChatMode
  setMode: (m: ChatMode) => void
  workingDir: string | null
  setWorkingDir: (d: string | null) => void
  autoApproveEdits: boolean
  setAutoApproveEdits: (v: boolean) => void
  canSend: boolean
  approveAction: (approvalId: string, decision: 'approve' | 'deny') => Promise<void>
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sessions, refresh } = useSessions()
  const { pools, killPool } = useAgents()
  const { model, setModel, models } = useModel()
  const chat = useChat(model)

  const navItems = [
    { path: '/', label: 'Chat', icon: MessageSquare },
    { path: '/memorias', label: 'Memórias', icon: BookOpen },
    { path: '/sobre', label: 'O que é', icon: Shield },
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
                          void refresh()
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
                    await refresh()
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

              <div className="border-t border-border">
                <div className="px-3 py-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Agents
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      ({pools.length})
                    </span>
                  </h2>
                </div>
                <ScrollArea className="max-h-48 px-2 pb-2">
                  {pools.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No active agents</p>
                  ) : (
                    <div className="space-y-1">
                      {pools.map((pool) => (
                        <div
                          key={pool.pool_id || pool.id}
                          className="flex items-center justify-between px-2 py-1 rounded text-xs"
                        >
                          <span className="truncate text-muted-foreground">
                            {pool.task?.slice(0, 40) || pool.pool_id?.slice(0, 8)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => pool.pool_id && killPool(pool.pool_id)}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <Link
          to="/sobre"
          className={cn(
            'block border-t border-border p-3 transition-colors',
            location.pathname === '/sobre'
              ? 'bg-primary/5'
              : 'hover:bg-accent'
          )}
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            O que é a Lain
          </h2>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Harness de governança para agentes de código. Não substitui o
            modelo — torna as ações auditáveis, aprováveis e forenses.
          </p>
          <p className="mt-1.5 text-[11px] italic text-foreground/80">
            Prompt asks. Hook decides.
          </p>
          <p className="mt-1.5 text-[11px] text-primary">
            Curso 0–9 no Sobre →
          </p>
        </Link>
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
            mode: chat.mode,
            setMode: chat.setMode,
            workingDir: chat.workingDir,
            setWorkingDir: chat.setWorkingDir,
            autoApproveEdits: chat.autoApproveEdits,
            setAutoApproveEdits: chat.setAutoApproveEdits,
            canSend: chat.canSend,
            approveAction: chat.approveAction,
          } satisfies LayoutContext}
        />
      </div>
    </div>
  )
}

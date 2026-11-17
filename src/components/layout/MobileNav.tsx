import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChatTeardrop, Brain, Gear, Plus } from '@phosphor-icons/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TenantExitButton } from '@/components/TenantExitButton'
import { useMeMode } from '@/hooks/useMe'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNewChat: () => void
  panel: ReactNode
}

/** Drawer mobile: navegação + histórico em largura total. */
export function MobileNav({ open, onOpenChange, onNewChat, panel }: MobileNavProps) {
  const location = useLocation()
  const meMode = useMeMode()
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[85vw] max-w-[320px] flex-col gap-0 p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navegação</SheetTitle>
        </SheetHeader>
        <div className="flex shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar py-2.5 pr-12 pl-3 dark:bg-[#111113]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            L
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground">
            Lain
          </span>
          <button
            type="button"
            aria-label="Nova conversa"
            title="Nova conversa"
            onClick={onNewChat}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Plus className="size-5" weight="bold" />
          </button>
        </div>
        <nav
          aria-label="Navegação principal"
          className="flex shrink-0 items-center gap-1 border-b border-sidebar-border bg-sidebar px-2 py-2 dark:bg-[#111113]"
        >
          <MobileLink to="/" label="Chat" icon="chat" active={location.pathname === '/'} onClick={close} />
          <MobileLink to="/memorias" label="Memórias" icon="brain" active={location.pathname === '/memorias'} onClick={close} />
          {meMode === 'tenant' ? (
            <div className="flex min-w-0 flex-1" onClick={close}>
              <TenantExitButton />
            </div>
          ) : (
            <MobileLink to="/settings" label="Ajustes" icon="gear" active={location.pathname === '/settings'} onClick={close} />
          )}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-sidebar dark:bg-[#111113]">
          {panel}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MobileLink({ to, label, icon, active, onClick }: {
  to: string
  label: string
  icon: 'chat' | 'brain' | 'gear'
  active: boolean
  onClick: () => void
}) {
  const Icon = icon === 'chat' ? ChatTeardrop : icon === 'brain' ? Brain : Gear
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" weight={icon === 'brain' ? 'regular' : 'bold'} />
      <span className="truncate">{label}</span>
    </Link>
  )
}

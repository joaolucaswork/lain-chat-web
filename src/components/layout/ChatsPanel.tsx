import type { ReactNode } from 'react'
import { SidebarSimple } from '@phosphor-icons/react'
import type { Session } from '@/types'

interface ChatsPanelProps {
  favorites: Session[]
  rest: Session[]
  sessions: Session[]
  withToggle: boolean
  onCollapse: () => void
  renderRow: (s: Session) => ReactNode
}

/** Painel de histórico: grupos Favoritos/Conversas + toggle retrair. */
export function ChatsPanel({ favorites, rest, sessions, withToggle, onCollapse, renderRow }: ChatsPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
        <span className="px-1 text-sm font-semibold text-sidebar-foreground">
          Conversas
        </span>
        {withToggle && (
          <button
            type="button"
            title="Retrair histórico (Ctrl+B)"
            aria-label="Retrair histórico (Ctrl+B)"
            onClick={onCollapse}
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
}

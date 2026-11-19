import { useBubbleTheme, type BubbleTheme } from '@/hooks/useBubbleTheme'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ id: BubbleTheme; label: string; dot: string }> = [
  { id: 'default', label: 'Padrão', dot: 'bg-[#e4e4e7] dark:bg-[#2e2f31]' },
  { id: 'primary', label: 'Principal', dot: 'bg-primary' },
]

/**
 * WHY: Tema das mensagens do usuário — só alterna entre Padrão (cinza)
 * e Principal (verde). Sem conta-gotas.
 */
export function BubbleThemePicker() {
  const { bubble, setBubble } = useBubbleTheme()

  return (
    <div className="flex items-center gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setBubble(o.id)}
          aria-pressed={bubble === o.id}
          aria-label={o.label}
          title={o.label}
          className="rounded-full p-1"
        >
          <span
            aria-hidden
            className={cn(
              'block size-7 rounded-full outline-solid transition-[outline-color,outline-width,box-shadow,background-color] duration-300 ease-out',
              o.dot,
              // WHY: outline em vez de border; a cor acompanha o dot —
              // cinza análogo no Padrão (inclusive no dark), variações do
              // verde principal no Principal. Troca com ease.
              o.id === 'default' && 'outline-1 outline-zinc-400/70 dark:outline-zinc-500/70',
              o.id === 'primary' && 'outline-1 outline-primary/50',
              bubble === o.id &&
                o.id === 'default' &&
                'outline-2 outline-zinc-500 dark:outline-zinc-500',
              bubble === o.id &&
                o.id === 'primary' &&
                'outline-2 outline-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_75%)]',
            )}
          />
        </button>
      ))}
    </div>
  )
}

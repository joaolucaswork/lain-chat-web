import { useState } from 'react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Info } from '@phosphor-icons/react'

export const FEEDBACK_TIPS = {
  confirm: {
    title: 'Correta',
    body: 'Confiança vai a 100% e a memória ganha peso máximo na busca. Protege contra o esquecimento automático.',
  },
  archive: {
    title: 'Não é mais assim',
    body: 'Arquiva sem apagar: sai da busca, continua no histórico. Dá para desarquivar.',
  },
  unarchive: {
    title: 'Desarquivar',
    body: 'Volta para a busca com peso normal.',
  },
  forget: {
    title: 'Esquecer',
    body: 'Apaga e bloqueia: não volta a ser extraída em conversas futuras. Dá para desfazer em 7 dias.',
  },
} as const

export type FeedbackTipKey = keyof typeof FEEDBACK_TIPS

interface TipProps {
  tip: FeedbackTipKey
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}

/**
 * Tooltip explicativo com entrada animada (fade + zoom + slide).
 * Hover abre no desktop; o botão ⓘ abre no toque (click alterna).
 */
export function Tip({ tip, side = 'bottom', children }: TipProps) {
  const [open, setOpen] = useState(false)
  const copy = FEEDBACK_TIPS[tip]
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span className="relative inline-flex">
          {children}
          <button
            type="button"
            aria-label={`O que faz: ${copy.title}`}
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            className="absolute -top-1.5 -right-1.5 z-10 flex size-3.5 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <Info className="size-2.5" weight="bold" />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[240px] duration-150">
        <p className="font-semibold">{copy.title}</p>
        <p className="opacity-80">{copy.body}</p>
      </TooltipContent>
    </Tooltip>
  )
}

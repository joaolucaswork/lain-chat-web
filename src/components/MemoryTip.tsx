import type { ReactNode } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

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

/** Tooltip explicativo com entrada animada (fade + zoom + slide). */
export function Tip({ tip, side = 'bottom', children }: TipProps) {
  const copy = FEEDBACK_TIPS[tip]
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[320px] duration-150">
        <p className="font-semibold">{copy.title}</p>
        <p className="opacity-80">{copy.body}</p>
      </TooltipContent>
    </Tooltip>
  )
}

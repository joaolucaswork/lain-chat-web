import { Skeleton } from '@/components/ui/skeleton'

type RouteFallbackVariant = 'memories' | 'settings' | 'blank'

// WHY: skeleton no lugar de spinner no lazy load de rotas — mantém
// a estrutura aproximada da página e evita tela vazia / salto de layout.
// 'blank' é neutro (sem cara de outra página): usado no boot do DemoGate
// quando ainda não sabemos o modo e na rota / — evita o flash da página
// de memórias dentro da home.
export function RouteFallback({ variant = 'memories' }: { variant?: RouteFallbackVariant }) {
  if (variant === 'settings') return <SettingsFallback />
  if (variant === 'blank') return <BlankFallback />
  return <MemoriesFallback />
}

function BlankFallback() {
  return (
    <div role="status" aria-label="Carregando" className="flex min-h-0 flex-1 bg-background">
      <span className="sr-only">carregando...</span>
    </div>
  )
}

function MemoriesFallback() {
  return (
    <div role="status" aria-label="Carregando memórias" className="flex min-h-0 flex-1">
      <span className="sr-only">carregando...</span>
      <div className="hidden w-56 shrink-0 space-y-4 border-r border-border bg-card p-3 md:block" aria-hidden>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-6 h-4 w-20" />
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col" aria-hidden>
        <div className="border-b border-border p-3">
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
        <div className="mx-auto w-full max-w-2xl space-y-3 p-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-4/5" />
        </div>
      </div>
    </div>
  )
}

function SettingsFallback() {
  return (
    <div role="status" aria-label="Carregando configurações" className="flex min-h-0 flex-1 flex-col">
      <span className="sr-only">carregando...</span>
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6" aria-hidden>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

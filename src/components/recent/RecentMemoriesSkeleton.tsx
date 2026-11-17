import { motion } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'

/** Skeleton da carga inicial (header + 3 cards + corte do 4º). */
export function InitialSkeleton() {
  return (
    <motion.div
      key="skeleton"
      className="mt-8 w-full"
      aria-hidden
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.3, ease: 'easeIn' } }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="ml-1 h-4 w-14" />
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="flex h-[148px] w-[260px] shrink-0 flex-col gap-2 rounded-xl bg-muted p-3.5 dark:bg-input/30"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full flex-1" />
            <div className="flex gap-1">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
          </motion.div>
        ))}
        <div className="h-[148px] w-[260px] shrink-0 opacity-0" />
      </div>
    </motion.div>
  )
}

/** Skeleton agressivo dentro do carrossel enquanto a busca lazy carrega. */
export function SearchSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex h-[148px] w-[260px] shrink-0 animate-pulse flex-col gap-2 rounded-xl bg-muted p-3.5 dark:bg-input/30"
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full flex-1" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      ))}
      <div className="h-[148px] w-[260px] shrink-0 opacity-0" />
    </div>
  )
}

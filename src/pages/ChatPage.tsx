import { motion } from 'motion/react'
import { useOutletContext } from 'react-router-dom'
import { ChatMessages } from '@/components/ChatMessages'
import { ChatInput } from '@/components/ChatInput'
import { RecentMemories } from '@/components/RecentMemories'
import { List } from '@phosphor-icons/react'
import type { LayoutContext } from './Layout'

const spring = { type: 'spring' as const, stiffness: 260, damping: 32 }

export function ChatPage() {
  const ctx = useOutletContext<LayoutContext>()
  const { messages, processing, sendMessage, retryLast, stopGenerating, sessionTitle, openMobileNav } = ctx
  const isEmpty = messages.length === 0 && !processing

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 bg-transparent px-4 pt-3 pb-5">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={openMobileNav}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent md:hidden"
        >
          <List className="size-5" />
        </button>
        <h1 className="flex-1 truncate text-left text-[15px] font-medium text-muted-foreground">
          {sessionTitle || 'Nova conversa'}
        </h1>
      </div>

      {isEmpty ? (
        <motion.div
          key="composer-center"
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <motion.h1
            className="mb-6 text-center text-2xl font-semibold tracking-tight text-foreground"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            Comece uma conversa
          </motion.h1>
          <motion.div
            layoutId="composer"
            transition={spring}
            className="w-full max-w-[46rem]"
          >
            <ChatInput
              bare
              onSend={sendMessage}
              onStop={stopGenerating}
              disabled={processing}
              placeholder="Envie uma mensagem..."
            />
          </motion.div>
          <div className="w-full max-w-[804px] overflow-hidden pt-6">
            <RecentMemories />
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div
            key="messages"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <ChatMessages messages={messages} processing={processing} onRetry={retryLast} />
          </motion.div>
          <motion.div
            layoutId="composer"
            transition={spring}
            className="shrink-0"
          >
            <ChatInput onSend={sendMessage} onStop={stopGenerating} disabled={processing} placeholder="Envie uma mensagem..." />
          </motion.div>
        </>
      )}
    </div>
  )
}

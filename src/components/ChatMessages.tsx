import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/types'
import { cn } from '@/lib/utils'

interface ChatMessagesProps {
  messages: ChatMessage[]
  processing: boolean
}

export function ChatMessages({ messages, processing }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && !processing && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Start a conversation
        </div>
      )}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={cn(
            'flex',
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          <div
            className={cn(
              'max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : msg.role === 'system'
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-muted text-foreground'
            )}
          >
            {msg.content}
          </div>
        </div>
      ))}
      {processing && (
        <div className="flex justify-start">
          <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2 text-sm flex items-center gap-1">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse animation-delay-200">●</span>
            <span className="animate-pulse animation-delay-400">●</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

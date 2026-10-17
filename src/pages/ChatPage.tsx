import { useOutletContext } from 'react-router-dom'
import { ChatMessages } from '@/components/ChatMessages'
import { ChatInput } from '@/components/ChatInput'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { LayoutContext } from './Layout'

export function ChatPage() {
  const ctx = useOutletContext<LayoutContext>()
  const { messages, processing, status, sendMessage, stopGenerating } = ctx

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <SidebarTrigger />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <span
            className={`h-2 w-2 rounded-full ${
              processing ? 'animate-pulse bg-yellow-500' : 'bg-green-500'
            }`}
          />
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>
      </div>

      <ChatMessages messages={messages} processing={processing} />
      <ChatInput onSend={sendMessage} onStop={stopGenerating} disabled={processing} placeholder="Send a message..." />
    </div>
  )
}

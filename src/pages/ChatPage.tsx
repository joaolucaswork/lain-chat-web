import { useOutletContext } from 'react-router-dom'
import { ChatMessages } from '@/components/ChatMessages'
import { ChatInput } from '@/components/ChatInput'
import type { LayoutContext } from './Layout'

export function ChatPage() {
  const ctx = useOutletContext<LayoutContext>()
  const { messages, processing, status, sendMessage, stopGenerating } = ctx

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-border bg-card gap-3">
        {/* Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              processing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
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

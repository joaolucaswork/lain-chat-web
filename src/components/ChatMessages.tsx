import { useEffect, useRef } from 'react'
import type { ChatMessage, ToolActivity } from '@/types'
import { isToolActivity, isApprovalRequest, isRoleMessage } from '@/types'
import { cn } from '@/lib/utils'
import { ApprovalCard } from '@/components/ApprovalCard'
import { Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface ChatMessagesProps {
  messages: ChatMessage[]
  processing: boolean
  onApprove?: (approvalId: string, decision: 'approve' | 'deny') => Promise<void>
}

function ToolActivityCard({ activity }: { activity: ToolActivity }) {
  const argsSummary = Object.entries(activity.args)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return val.length > 80 ? `${k}: ${val.slice(0, 80)}...` : `${k}: ${val}`
    })
    .join(', ')

  return (
    <div className="max-w-[80%] rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 mb-1">
        {activity.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
        {activity.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
        {activity.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
        <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">{activity.name}</span>
      </div>

      {argsSummary && (
        <div className="text-xs text-muted-foreground truncate">{argsSummary}</div>
      )}

      {activity.result && (
        <pre className="mt-1.5 p-2 rounded bg-background/50 text-xs text-muted-foreground overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap">
          {activity.result.length > 500 ? activity.result.slice(0, 500) + '...' : activity.result}
        </pre>
      )}

      {activity.error && (
        <div className="mt-1.5 text-xs text-red-500">{activity.error}</div>
      )}
    </div>
  )
}

export function ChatMessages({ messages, processing, onApprove }: ChatMessagesProps) {
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
      {messages.map((msg, i) => {
        if (isToolActivity(msg)) {
          return (
            <div key={i} className="flex justify-start">
              <ToolActivityCard activity={msg} />
            </div>
          )
        }

        if (isApprovalRequest(msg)) {
          return (
            <div key={i} className="flex justify-start">
              {onApprove ? (
                <ApprovalCard approval={msg} onApprove={onApprove} />
              ) : (
                <div className="max-w-[80%] rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-muted-foreground">
                  Approval required: {msg.summary}
                </div>
              )}
            </div>
          )
        }

        if (isRoleMessage(msg)) {
          return (
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
          )
        }

        return null
      })}
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

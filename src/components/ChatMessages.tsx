import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/types'
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Streamdown } from 'streamdown'
import { ArrowDown, Check, Copy, RotateCcw } from 'lucide-react'

interface ChatMessagesProps {
  messages: ChatMessage[]
  processing: boolean
  onRetry?: () => void
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {}
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}

export function ChatMessages({ messages, processing, onRetry }: ChatMessagesProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  // Último user sem resposta (ex: erro aconteceu e a página foi recarregada,
  // limpando o balão de erro que não é persistido) — oferece retry.
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i
      break
    }
  }
  const lastUserUnanswered =
    lastUserIdx !== -1 && lastUserIdx === messages.length - 1 && !processing

  const isNearBottom = () => {
    const el = viewportRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const scrollToEnd = (smooth = false) => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  // Segue o stream enquanto o leitor está no fim; se ele subir, solta.
  useEffect(() => {
    if (stickRef.current) scrollToEnd()
  }, [messages, processing])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        role="log"
        aria-label="Messages"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
        onScroll={() => {
          stickRef.current = isNearBottom()
          setShowJump(!stickRef.current)
        }}
        onWheel={() => {
          // Atualiza o estado de forma otimista durante o gesto
          requestAnimationFrame(() => {
            stickRef.current = isNearBottom()
            setShowJump(!stickRef.current)
          })
        }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-4">
          {messages.length === 0 && !processing && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Start a conversation
            </div>
          )}
          {messages.map((msg, i) => {
            if (msg.role === 'user') {
              return (
                <div key={i} data-message-id={`msg-${i}`}>
                  <Message align="end">
                    <MessageContent>
                      <Bubble
                        variant="default"
                        align="end"
                        className="*:data-[slot=bubble-content]:bg-foreground/85 *:data-[slot=bubble-content]:text-background"
                      >
                        <BubbleContent className="whitespace-pre-wrap">
                          {msg.content}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </div>
              )
            }

            if (msg.role === 'system') {
              return (
                <div key={i} data-message-id={`msg-${i}`}>
                  <Message align="start">
                    <MessageContent>
                      <Bubble variant="destructive">
                        <BubbleContent className="whitespace-pre-wrap">
                          {msg.content}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                    {onRetry && !processing && (
                      <MessageFooter>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Tentar de novo"
                              onClick={onRetry}
                            >
                              <RotateCcw />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Tentar de novo</TooltipContent>
                        </Tooltip>
                      </MessageFooter>
                    )}
                  </Message>
                </div>
              )
            }

            return (
              <div key={i} data-message-id={`msg-${i}`}>
                <Message align="start">
                  <MessageContent>
                    <Bubble variant="ghost">
                      <BubbleContent className="max-w-full">
                        <Streamdown>{msg.content}</Streamdown>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                  <MessageFooter>
                    <CopyAction text={msg.content} />
                  </MessageFooter>
                </Message>
              </div>
            )
          })}
          {lastUserUnanswered && onRetry && (
            <div className="flex justify-start">
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw />
                Tentar de novo
              </Button>
            </div>
          )}
          {processing && (
            <div>
              <Message align="start">
                <MessageContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    <span>Thinking…</span>
                  </div>
                </MessageContent>
              </Message>
            </div>
          )}
        </div>
      </div>

      {showJump && (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Scroll to end"
          onClick={() => {
            stickRef.current = true
            setShowJump(false)
            scrollToEnd(true)
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border shadow-md"
        >
          <ArrowDown />
        </Button>
      )}
    </div>
  )
}

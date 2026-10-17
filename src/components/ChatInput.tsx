import { useState, useRef, useEffect } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Send, Square } from 'lucide-react'

interface ChatInputProps {
  onSend: (text: string) => void
  onStop?: () => void
  disabled: boolean
  placeholder?: string
}

export function ChatInput({ onSend, onStop, disabled, placeholder = 'Send a message...' }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div className="shrink-0 border-t border-border bg-background p-4">
      <div className="mx-auto w-full max-w-4xl">
        <InputGroup className="has-[[data-slot=input-group-control]:focus-visible]:border-foreground/20 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
          <InputGroupTextarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="min-h-[40px] max-h-[200px]"
            aria-label="Message"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupText className="mr-auto text-xs">
              Enter to send, Shift+Enter for new line
            </InputGroupText>
            {disabled && onStop ? (
              <InputGroupButton
                size="icon-sm"
                variant="destructive"
                onClick={onStop}
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                size="icon-sm"
                variant="default"
                onClick={handleSend}
                disabled={disabled || !text.trim()}
                title="Send"
                aria-label="Send"
              >
                {disabled ? <Spinner /> : <Send />}
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  )
}

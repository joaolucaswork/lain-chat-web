import { useState, useRef, useEffect } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { ArrowUp, Square } from '@phosphor-icons/react'

interface ChatInputProps {
  onSend: (text: string) => void
  onStop?: () => void
  disabled: boolean
  placeholder?: string
  bare?: boolean
}

export function ChatInput({ onSend, onStop, disabled, placeholder = 'Envie uma mensagem...', bare = false }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  useEffect(() => {
    const onFocus = () => textareaRef.current?.focus()
    window.addEventListener('lain:focus-composer', onFocus)
    return () => window.removeEventListener('lain:focus-composer', onFocus)
  }, [])

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div className={bare ? 'w-full' : 'shrink-0 border-t border-border bg-background p-4 dark:bg-[#131416]'}>
      <div className={bare ? 'w-full' : 'mx-auto w-full max-w-[46rem]'}>
        <InputGroup className="rounded-3xl border border-border bg-muted px-1 py-1 shadow-none dark:border-0 dark:bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:border-border has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:has-[[data-slot=input-group-control]:focus-visible]:border-0">
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
            className="max-h-[200px] min-h-[40px] text-[16px] leading-[1.7] tracking-[0.01em]"
            aria-label="Mensagem"
          />
          <InputGroupAddon align="inline-end" className="self-center pr-3">
            {disabled && onStop ? (
              <InputGroupButton
                size="icon-sm"
                variant="destructive"
                className="cursor-pointer"
                onClick={onStop}
                title="Parar de gerar"
                aria-label="Parar de gerar"
              >
                <Square className="fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                size="icon-sm"
                variant="secondary"
                className="cursor-pointer rounded-full bg-background shadow-sm dark:bg-secondary dark:shadow-none"
                onClick={handleSend}
                disabled={disabled || !text.trim()}
                title="Enviar"
                aria-label="Enviar"
              >
                {disabled ? <Spinner /> : <ArrowUp weight="bold" />}
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  )
}

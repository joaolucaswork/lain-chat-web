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
    // WHY mobile: não puxa o foco (e o teclado) automaticamente no touch.
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  useEffect(() => {
    const onFocus = () => textareaRef.current?.focus()
    window.addEventListener('lain:focus-composer', onFocus)
    return () => window.removeEventListener('lain:focus-composer', onFocus)
  }, [])

  // WHY: cards de onboarding (estado vazio) preenchem o composer sem
  // enviar — o usuário revisa e aperta Enter. CustomEvent carrega o prompt.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const prompt = (e as CustomEvent<string>).detail
      if (typeof prompt !== 'string' || !prompt) return
      setText(prompt)
      textareaRef.current?.focus()
    }
    window.addEventListener('lain:prefill-composer', onPrefill)
    return () => window.removeEventListener('lain:prefill-composer', onPrefill)
  }, [])

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div className={bare ? 'w-full min-w-0' : 'shrink-0 bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4'}>
      <div className={bare ? 'w-full min-w-0' : 'mx-auto w-full min-w-0 max-w-[46rem]'}>
        <InputGroup className="min-w-0 rounded-3xl border-0 bg-muted px-1 py-1 shadow-none dark:bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
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
            enterKeyHint="send"
            className="max-h-[200px] min-h-[40px] min-w-0 text-[16px] leading-[1.6] tracking-[0.01em] sm:leading-[1.7]"
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

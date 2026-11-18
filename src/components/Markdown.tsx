import { Suspense, lazy } from 'react'

// WHY: Streamdown + ecossistema unified/remark/rehype (~500kB) só é
// necessário quando há mensagem do assistente para renderizar. O lazy
// tira esse peso do bundle inicial; o fallback mostra o texto puro
// com pre-wrap — importante no streaming, onde o conteúdo precisa
// aparecer antes do chunk chegar.
const StreamdownLazy = lazy(() =>
  import('streamdown').then((m) => ({ default: m.Streamdown })),
)

export function Markdown({ content }: { content: string }) {
  return (
    <Suspense
      fallback={
        <span className="whitespace-pre-wrap break-words">{content}</span>
      }
    >
      <StreamdownLazy>{content}</StreamdownLazy>
    </Suspense>
  )
}

import { Link } from 'react-router-dom'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Input Google-like: label dentro do campo, flutua pra cima ao focar ou
 * preencher (peer + placeholder=" "). Olho opcional pra senha.
 */
export function FloatInput({
  value,
  onChange,
  label,
  type = 'text',
  autoComplete,
  autoFocus,
  maxLength,
  inputMode,
  passwordToggle,
  bare,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  type?: string
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  inputMode?: 'numeric' | 'text'
  passwordToggle?: { show: boolean; onToggle: () => void }
  /** Sem borda (fundo suave): usado no campo de e-mail do gate. */
  bare?: boolean
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        type={passwordToggle ? (passwordToggle.show ? 'text' : 'password') : type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
        className={`peer w-full rounded px-4 pb-2 pt-6 text-[15px] outline-none ${bare ? 'border border-transparent bg-field text-neutral-900 focus:border-transparent dark:text-neutral-100' : 'border border-neutral-300 bg-white text-neutral-900 focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-200'} ${passwordToggle ? 'pr-11' : ''}`}
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-neutral-500 transition-all peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-neutral-700 peer-focus:dark:text-neutral-200 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs dark:text-neutral-400">
        {label}
      </span>
      {passwordToggle && (
        <button
          type="button"
          onClick={passwordToggle.onToggle}
          aria-label={passwordToggle.show ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 dark:text-neutral-400"
        >
          {passwordToggle.show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
        </button>
      )}
    </div>
  )
}

/** Cabeçalho do gate: marca (volta à landing) + seletor de tema na mesma linha. */
export function GateHeader() {
  return (
    <div className="flex items-center justify-between px-8 pt-6">
      <Link
        to="/bem-vindo"
        aria-label="Lain — início"
        title="Início"
        className="text-xl font-bold hover:opacity-70"
      >
        Lain
      </Link>
      <ThemeToggle />
    </div>
  )
}

/** Logo "G" do Google (cores oficiais) para o botão de OAuth. */
export function GoogleLogo({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.3.6 4.53 1.79l3.4-3.4A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z"
      />
    </svg>
  )
}

/** Traduz erros do Supabase Auth (em inglês) para mensagens amigáveis em PT. */
export function friendlyAuthError(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Senha incorreta. Tente de novo.'
  if (m.includes('email not confirmed')) return 'Confirme seu email antes de entrar.'
  if (
    m.includes('user already registered') ||
    m.includes('already been registered') ||
    m.includes('already exists')
  )
    return 'Essa conta já existe. Entre com sua senha.'
  if (m.includes('token has expired') || m.includes('otp has expired') || m.includes('otp expired'))
    return 'Código expirado. Peça um novo código.'
  if (
    m.includes('token is invalid') ||
    m.includes('invalid token') ||
    m.includes('invalid otp') ||
    m.includes('invalid code')
  )
    return 'Código inválido. Confira e tente de novo.'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over email'))
    return 'Muitas tentativas. Aguarde um pouco e tente de novo.'
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('unable to validate email')) return 'Informe um email válido.'
  return raw
}

export function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

// WHY: botão principal segue o tema (verde --primary), não preto fixo.
export const blackBtn =
  'w-full rounded bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40'
export const ghostBtn =
  'flex w-full items-center justify-center gap-2 rounded border border-transparent bg-field px-4 py-3 font-medium text-neutral-900 transition-colors hover:bg-field-hover disabled:opacity-40 dark:text-neutral-100'

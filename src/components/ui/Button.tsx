import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  size?: 'sm' | 'md'
  icon?: ReactNode
}

const styles: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'border border-ink-200 bg-white text-ink-900 shadow-sm hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-200',
}

export function Button({ variant = 'primary', loading, size = 'md', icon, children, disabled, className = '', type = 'button', ...rest }: Props) {
  const iconOnly = !children
  return (
    <button
      type={type}
      title={rest.title ?? (iconOnly ? (rest['aria-label'] as string | undefined) : undefined)}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-(--radius-control) font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100
        ${size === 'sm' ? `min-h-9 text-sm ${iconOnly ? 'w-9' : 'px-3'}` : `min-h-11 text-sm sm:min-h-10 ${iconOnly ? 'w-11 sm:w-10' : 'px-4'}`} ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

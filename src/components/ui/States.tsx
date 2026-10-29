import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { Button } from './Button'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-500">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" /> {label}
    </div>
  )
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" role="status" aria-label="Memuat">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-28 rounded-(--radius-card)" />)}
    </div>
  )
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">{icon ?? <Inbox size={24} />}</div>
      <h3 className="mt-1 text-base font-semibold text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600" aria-hidden="true"><AlertTriangle size={24} /></div>
      <h3 className="mt-1 text-base font-semibold text-ink-900">Data tidak bisa dimuat</h3>
      <p className="max-w-md text-sm text-ink-500">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">Muat ulang</Button>}
    </div>
  )
}

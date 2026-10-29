import type { ReactNode } from 'react'

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  // Kartu 'flush' (!p-0) dipakai untuk tabel/daftar yang harus memenuhi lebar kartu.
  const flush = className.includes('!p-0')
  return (
    <section className={`min-w-0 rounded-(--radius-card) border border-ink-200/80 bg-white shadow-(--shadow-card) ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3 sm:px-5">
          {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  )
}

export type Accent = 'blue' | 'teal' | 'violet' | 'amber'
const accents: Record<Accent, { chip: string; bar: string }> = {
  blue: { chip: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' },
  teal: { chip: 'bg-teal-50 text-teal-600', bar: 'bg-teal-500' },
  violet: { chip: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
  amber: { chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
}

export function StatCard({ label, value, icon, hint, accent = 'blue' }: { label: string; value: ReactNode; icon: ReactNode; hint?: string; accent?: Accent }) {
  const a = accents[accent]
  return (
    <div className="group relative overflow-hidden rounded-(--radius-card) border border-ink-200/80 bg-white p-4 shadow-(--shadow-card) transition duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-lift) sm:p-5">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${a.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight text-ink-500">{label}</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink-900">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${a.chip}`} aria-hidden="true">{icon}</div>
      </div>
      {hint && <p className="mt-2 truncate text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

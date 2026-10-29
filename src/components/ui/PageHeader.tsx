import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions, leading }: { title: string; description?: string; actions?: ReactNode; leading?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold text-ink-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 [&>a]:contents max-sm:[&_button]:flex-1">{actions}</div>}
    </div>
  )
}

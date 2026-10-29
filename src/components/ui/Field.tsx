import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const base = 'min-h-11 w-full rounded-(--radius-control) border border-ink-200 bg-white px-3 py-2 text-base text-ink-900 transition placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 disabled:bg-ink-100 disabled:text-ink-500 sm:min-h-10 sm:text-sm'

interface FieldShellProps { label: string; error?: string; hint?: string; required?: boolean; children: (id: string, describedBy?: string) => ReactNode }
function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-ink-700">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      {children(id, error ? `${id}-err` : hint ? `${id}-hint` : undefined)}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-ink-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

type CommonProps = { label: string; error?: string; hint?: string }

export function Input({ label, error, hint, required, className = '', ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(id, d) => <input id={id} required={required} aria-invalid={!!error} aria-describedby={d} className={`${base} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`} {...rest} />}
    </FieldShell>
  )
}

export function Textarea({ label, error, hint, required, className = '', ...rest }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(id, d) => <textarea id={id} rows={3} required={required} aria-invalid={!!error} aria-describedby={d} className={`${base} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`} {...rest} />}
    </FieldShell>
  )
}

export interface Option { value: string; label: string }
export function Select({ label, error, hint, required, options, placeholder, className = '', ...rest }:
  CommonProps & SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(id, d) => (
        <select id={id} required={required} aria-invalid={!!error} aria-describedby={d} className={`${base} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </FieldShell>
  )
}

/** Select ringkas tanpa label untuk bar filter. */
export function FilterSelect({ label, value, onChange, options, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; options: Option[]; placeholder: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${base} sm:w-auto sm:min-w-40`}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

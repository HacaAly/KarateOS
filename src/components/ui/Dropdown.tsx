import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Menu dropdown aksesibel: Esc menutup, klik di luar menutup, fokus kembali ke pemicu. */
export function Dropdown({ trigger, label, children, align = 'right', placement = 'bottom' }:
  { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; placement?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const close = () => { setOpen(false); btn.current?.focus() }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}
        className="rounded-xl transition hover:bg-ink-100/70 focus-visible:outline-2">
        {trigger}
      </button>
      {open && (
        <div role="menu" className={`absolute z-20 w-60 animate-pop-in rounded-xl border border-ink-200 bg-white py-1 shadow-(--shadow-pop) ${align === 'right' ? 'right-0' : 'left-0'} ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {children(close)}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ onClick, icon, children, danger }: { onClick: () => void; icon?: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <button role="menuitem" type="button" onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm transition sm:min-h-10 ${danger ? 'text-red-700 hover:bg-red-50' : 'text-ink-800 hover:bg-ink-50'}`}>
      {icon}{children}
    </button>
  )
}

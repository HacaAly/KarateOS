import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface ModalProps { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }

/** Dialog aksesibel: fokus terkunci di dalam dialog, Esc menutup, fokus kembali ke pemicu, scroll latar dikunci. */
export function Modal({ open, title, onClose, children, footer, wide }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = panel.current?.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
    ;(first ?? panel.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) { e.preventDefault(); return }
      const a = items[0], z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus?.() }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-(--z-modal) flex animate-fade-in items-end justify-center bg-ink-900/55 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`flex max-h-[92dvh] w-full animate-sheet-in flex-col rounded-t-3xl bg-white shadow-(--shadow-pop) outline-none sm:animate-pop-in sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup dialog" title="Tutup" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</footer>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; loading?: boolean
  onConfirm: () => void; onCancel: () => void; danger?: boolean
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Ya, lanjutkan', loading, onConfirm, onCancel, danger = true }: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={<>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>Batal</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}>
      <p className="text-sm text-ink-700">{message}</p>
    </Modal>
  )
}

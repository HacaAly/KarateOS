import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; message: string }
export interface ToastApi {
  success: (m: string) => void
  error: (m: string) => void
  info: (m: string) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastApi | null>(null)

const accent: Record<ToastKind, string> = { success: 'border-l-teal-500', error: 'border-l-red-500', info: 'border-l-brand-500' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const remove = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), [])
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setItems((p) => [...p.slice(-3), { id, kind, message }])
    setTimeout(() => remove(id), kind === 'error' ? 6500 : 3800)
  }, [remove])
  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m),
  }), [push])

  const icon = { success: <CheckCircle2 size={18} className="text-teal-600" />, error: <AlertCircle size={18} className="text-red-600" />, info: <Info size={18} className="text-brand-600" /> }
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-(--z-toast) flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[22rem]" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-l-4 border-ink-200 bg-white p-3 shadow-(--shadow-pop) ${accent[t.kind]}`}>
            <span className="mt-0.5" aria-hidden="true">{icon[t.kind]}</span>
            <p className="flex-1 text-sm text-ink-900">{t.message}</p>
            <button onClick={() => remove(t.id)} aria-label="Tutup notifikasi" className="rounded p-1 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

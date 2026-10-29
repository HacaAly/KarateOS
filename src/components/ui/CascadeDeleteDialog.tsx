import { useEffect, useState } from 'react'
import { AlertTriangle, EyeOff } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Field'
import { Spinner } from './States'
import { toMessage } from '../../lib/supabase'

export interface CascadeItem { label: string; count: number }

/**
 * Konfirmasi hapus berantai. Menampilkan jumlah data terikat yang AKAN ikut terhapus,
 * meminta pengguna mengetik nama sebagai konfirmasi, dan menawarkan alternatif
 * "Nonaktifkan saja" (data tetap tersimpan) bila tersedia.
 */
export function CascadeDeleteDialog({ open, kind, name, loadItems, onDeleteAll, onDeactivate, onCancel, busy }: {
  open: boolean
  kind: 'dojo' | 'organisasi'
  name: string
  loadItems: () => Promise<CascadeItem[]>
  onDeleteAll: () => void
  onDeactivate?: () => void
  onCancel: () => void
  busy: boolean
}) {
  const [items, setItems] = useState<CascadeItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setItems(null); setError(null); setTyped('')
    loadItems().then((r) => { if (alive) setItems(r) }).catch((e) => { if (alive) setError(toMessage(e)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const nonZero = (items ?? []).filter((i) => i.count > 0)
  const total = nonZero.reduce((n, i) => n + i.count, 0)
  const matches = typed.trim() === name.trim()

  return (
    <Modal open={open} title={`Hapus ${kind}`} onClose={onCancel}
      footer={<>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Batal</Button>
        {onDeactivate && <Button variant="secondary" icon={<EyeOff size={16} />} onClick={onDeactivate} disabled={busy || !items}>Nonaktifkan saja</Button>}
        <Button variant="danger" onClick={onDeleteAll} loading={busy} disabled={!items || !matches}>{total > 0 ? 'Hapus semuanya' : `Hapus ${kind}`}</Button>
      </>}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>Menghapus <strong className="break-words">{name}</strong> bersifat <strong>permanen</strong> dan tidak dapat dibatalkan.</p>
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p>
          : !items ? <Spinner />
          : nonZero.length === 0 ? <p className="text-sm text-ink-700">Tidak ada data terikat. Hanya {kind} ini yang akan dihapus.</p>
          : (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Data berikut ikut terhapus:</p>
              <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 text-sm">
                {nonZero.map((i) => <li key={i.label} className="flex justify-between px-3 py-2"><span className="text-ink-700">{i.label}</span><span className="font-semibold tabular-nums text-ink-900">{i.count}</span></li>)}
              </ul>
            </div>)}
        {onDeactivate && <p className="text-xs text-ink-500">“Nonaktifkan saja” menyembunyikan status aktif {kind} tetapi semua datanya tetap tersimpan dan bisa diaktifkan kembali.</p>}
        <Input label={`Ketik “${name}” untuk mengonfirmasi`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={busy || !items} />
      </div>
    </Modal>
  )
}

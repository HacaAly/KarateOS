import { useId, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { ConfirmDialog } from './Modal'
import { useToast } from '../../hooks/useToast'
import { toMessage } from '../../lib/supabase'
import { removeEntityPhoto, setEntityPhoto, type PhotoKind } from '../../services/photos'

/** Unggah foto dari perangkat. Tombol hanya ditampilkan bila pengguna berhak (`canEdit`). */
export function PhotoUploader({ kind, id, name, url, canEdit, size = 'xl', rounded = 'xl', onChanged }: {
  kind: PhotoKind; id: string; name: string; url: string | null; canEdit: boolean
  size?: 'lg' | 'xl'; rounded?: 'full' | 'xl'; onChanged: (url: string | null) => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [busy, setBusy] = useState<'file' | 'remove' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function save(file: File) {
    const next = await setEntityPhoto(kind, id, file, url)
    onChanged(next); toast.success('Foto diperbarui.')
  }
  async function onFile(file?: File) {
    if (!file) return
    setBusy('file'); setErr(null); setInfo(`Mengunggah ${file.name || 'foto'}…`)
    try { await save(file); setInfo('Foto tersimpan.') } catch (e) { setInfo(null); setErr(toMessage(e)); toast.error(toMessage(e)) } finally { setBusy(null); if (fileRef.current) fileRef.current.value = '' }
  }
  async function onRemove() {
    setBusy('remove')
    try { await removeEntityPhoto(kind, id, url); onChanged(null); toast.success('Foto dihapus.'); setConfirm(false) }
    catch (e) { toast.error(toMessage(e)) } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar key={url ?? 'none'} name={name} src={url} size={size} rounded={rounded} />
      {canEdit && (
        <div className="min-w-0">
          {/* <label> membuka pemilih file secara native (lebih andal di HP & browser dalam-aplikasi daripada input.click() pada elemen display:none) */}
          <input ref={fileRef} id={inputId} type="file" accept="image/*" className="peer sr-only" disabled={!!busy} onChange={(e) => void onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} aria-disabled={!!busy}
              className={`inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 rounded-(--radius-control) border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900 shadow-sm transition hover:bg-ink-50 active:bg-ink-100 sm:min-h-9 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <Camera size={16} aria-hidden="true" />{busy === 'file' ? 'Mengunggah…' : 'Unggah foto'}
            </label>
            {url && <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} disabled={!!busy} onClick={() => setConfirm(true)}>Hapus foto</Button>}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">JPG, PNG, atau WebP. Foto besar dikecilkan otomatis (maks. 2 MB).</p>
          {info && !err && <p role="status" className="mt-1.5 text-sm font-medium text-teal-700">{info}</p>}
          {err && <p role="alert" className="mt-1.5 text-sm font-medium text-red-700">{err}</p>}
        </div>)}
      <ConfirmDialog open={confirm} title="Hapus foto" message="Foto akan dihapus dan diganti inisial nama." confirmLabel="Hapus foto" loading={busy === 'remove'} onCancel={() => setConfirm(false)} onConfirm={() => void onRemove()} />
    </div>
  )
}
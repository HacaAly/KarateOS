import { useRef, useState } from 'react'
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
  const [busy, setBusy] = useState<'file' | 'remove' | null>(null)
  const [confirm, setConfirm] = useState(false)

  async function save(file: File) {
    const next = await setEntityPhoto(kind, id, file, url)
    onChanged(next); toast.success('Foto diperbarui.')
  }
  async function onFile(file?: File) {
    if (!file) return
    setBusy('file')
    try { await save(file) } catch (e) { toast.error(toMessage(e)) } finally { setBusy(null); if (fileRef.current) fileRef.current.value = '' }
  }
  async function onRemove() {
    setBusy('remove')
    try { await removeEntityPhoto(kind, id, url); onChanged(null); toast.success('Foto dihapus.'); setConfirm(false) }
    catch (e) { toast.error(toMessage(e)) } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={url} size={size} rounded={rounded} />
      {canEdit && (
        <div className="min-w-0">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label={`Pilih foto untuk ${name}`} onChange={(e) => void onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Camera size={16} />} loading={busy === 'file'} disabled={!!busy && busy !== 'file'} onClick={() => fileRef.current?.click()}>Unggah foto</Button>
            {url && <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} disabled={!!busy} onClick={() => setConfirm(true)}>Hapus foto</Button>}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">JPG, PNG, atau WebP. Foto besar dikecilkan otomatis (maks. 2 MB).</p>
        </div>)}
      <ConfirmDialog open={confirm} title="Hapus foto" message="Foto akan dihapus dan diganti inisial nama." confirmLabel="Hapus foto" loading={busy === 'remove'} onCancel={() => setConfirm(false)} onConfirm={() => void onRemove()} />
    </div>
  )
}

import { useRef, useState, type FormEvent } from 'react'
import { Camera } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { toMessage } from '../../lib/supabase'
import { updateProfile, uploadAvatar } from '../../services/profiles'
import { formatDate } from '../../utils/format'

export default function ProfilePage() {
  const { user, profile, setProfile, refreshProfile } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user || !profile) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (fullName.trim().length < 2) errs.fullName = 'Nama lengkap minimal 2 karakter.'
    if (phone && !/^[0-9+()\-\s]{6,30}$/.test(phone)) errs.phone = 'Nomor telepon tidak valid.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const updated = await updateProfile(user!.id, { full_name: fullName.trim(), phone: phone.trim() || null })
      setProfile(updated)
      await refreshProfile() // muat ulang dari database untuk memastikan data tersimpan
      toast.success('Profil berhasil disimpan.')
    } catch (err) {
      toast.error(toMessage(err))
    } finally { setSaving(false) }
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user!.id, file)
      const updated = await updateProfile(user!.id, { full_name: profile!.full_name, phone: profile!.phone, avatar_url: url })
      setProfile(updated)
      toast.success('Foto profil diperbarui.')
    } catch (err) {
      toast.error(toMessage(err))
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profil saya" description="Kelola informasi akun Anda." />
      <Card className="!p-0 overflow-hidden">
        <div className="h-24 bg-ink-900 bg-[linear-gradient(135deg,var(--color-brand-700),var(--color-ink-900)_60%,var(--color-teal-700))]" aria-hidden="true" />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 mb-6 flex flex-wrap items-end gap-4">
            <span className="rounded-full ring-4 ring-white"><Avatar name={profile.full_name || user.email || '?'} src={profile.avatar_url} size="xl" /></span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-lg font-semibold text-ink-900">{profile.full_name || 'Tanpa nama'}</p>
              <p className="truncate text-sm text-ink-500">{user.email}</p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Pilih foto profil" onChange={(e) => void onPickFile(e.target.files?.[0])} />
              <Button variant="secondary" size="sm" icon={<Camera size={16} />} loading={uploading} onClick={() => fileRef.current?.click()}>Ganti foto</Button>
            </div>
          </div>
          <p className="-mt-3 mb-5 text-xs text-ink-500">Foto: JPG, PNG, atau WebP. Maksimal 2 MB.</p>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Email berasal dari Supabase Auth dan tidak dapat diubah dari formulir profil */}
          <Input label="Email" value={user.email ?? ''} disabled readOnly hint="Email dikelola oleh sistem autentikasi." />
          <Input label="Nama lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} required />
          <Input label="Nomor telepon" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} placeholder="08xxxxxxxxxx" />
          <p className="text-xs text-ink-500">Terdaftar sejak {formatDate(profile.created_at)}</p>
          <div className="flex justify-end"><Button type="submit" loading={saving}>Simpan perubahan</Button></div>
        </form>
        </div>
      </Card>
    </div>
  )
}

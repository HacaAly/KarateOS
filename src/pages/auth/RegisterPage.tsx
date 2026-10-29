import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { AuthShell, FormAlert } from './AuthShell'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterPage() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const errs: Record<string, string> = {}
    if (form.fullName.trim().length < 2) errs.fullName = 'Nama lengkap minimal 2 karakter.'
    if (!emailRe.test(form.email.trim())) errs.email = 'Format email tidak valid.'
    if (form.password.length < 8) errs.password = 'Password minimal 8 karakter.'
    if (form.confirm !== form.password) errs.confirm = 'Konfirmasi password tidak sama.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const res = await signUp(form.fullName, form.email, form.password)
    setBusy(false)
    if (!res.ok) { setError(res.message ?? 'Pendaftaran gagal.'); return }
    // Bila verifikasi email dimatikan di Supabase, sesi langsung aktif dan route otomatis berpindah.
    if (res.needsConfirmation) setDone(true)
  }

  if (done) {
    return (
      <AuthShell title="Periksa email Anda" footer={<Link to="/login" className="font-semibold text-brand-700 hover:underline">Kembali ke halaman masuk</Link>}>
        <FormAlert kind="success">
          Kami mengirim tautan verifikasi ke <strong>{form.email}</strong>. Klik tautan tersebut, lalu masuk.
        </FormAlert>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Buat akun" subtitle="Daftar untuk mulai mengelola atau bergabung dengan dojo."
      footer={<>Sudah punya akun? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Masuk</Link></>}>
      {error && <FormAlert kind="error">{error}</FormAlert>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Nama lengkap" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} required />
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} required />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Minimal 8 karakter." required />
        <Input label="Konfirmasi password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
        <Button type="submit" loading={busy} className="w-full">Daftar</Button>
      </form>
    </AuthShell>
  )
}

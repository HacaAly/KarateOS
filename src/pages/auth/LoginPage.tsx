import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { AuthShell, FormAlert } from './AuthShell'

export default function LoginPage() {
  const { signIn, resendConfirmation } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null); setUnconfirmed(false)
    if (!email.trim() || !password) { setError('Email dan password wajib diisi.'); return }
    setBusy(true)
    const res = await signIn(email, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.message ?? 'Gagal masuk.')
      setUnconfirmed(/belum diverifikasi/i.test(res.message ?? ''))
    }
    // Bila berhasil, PublicOnlyRoute otomatis mengarahkan ke dashboard.
  }

  async function resend() {
    const res = await resendConfirmation(email)
    if (res.ok) { setInfo('Email verifikasi dikirim ulang. Periksa kotak masuk Anda.'); setError(null) }
    else setError(res.message ?? 'Gagal mengirim ulang email.')
  }

  return (
    <AuthShell title="Masuk ke KarateOS" subtitle="Gunakan akun yang terdaftar."
      footer={<>Belum punya akun? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Daftar</Link></>}>
      {error && <FormAlert kind="error">{error}{unconfirmed && email && (
        <> <button type="button" onClick={() => void resend()} className="font-medium underline">Kirim ulang email verifikasi</button></>)}</FormAlert>}
      {info && <FormAlert kind="success">{info}</FormAlert>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="text-right"><Link to="/lupa-password" className="text-sm font-semibold text-brand-700 hover:underline">Lupa password?</Link></div>
        <Button type="submit" loading={busy} className="w-full">Masuk</Button>
      </form>
    </AuthShell>
  )
}

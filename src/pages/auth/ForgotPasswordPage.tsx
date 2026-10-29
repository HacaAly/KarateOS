import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { AuthShell, FormAlert } from './AuthShell'

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) { setError('Email wajib diisi.'); return }
    setBusy(true)
    const res = await sendPasswordReset(email)
    setBusy(false)
    if (res.ok) setSent(true); else setError(res.message ?? 'Gagal mengirim email.')
  }

  return (
    <AuthShell title="Pulihkan password" subtitle="Kami akan mengirim tautan untuk mengatur password baru."
      footer={<Link to="/login" className="font-semibold text-brand-700 hover:underline">Kembali ke halaman masuk</Link>}>
      {sent
        ? <FormAlert kind="success">Jika email terdaftar, tautan pemulihan telah dikirim. Periksa kotak masuk dan folder spam.</FormAlert>
        : <>
            {error && <FormAlert kind="error">{error}</FormAlert>}
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" loading={busy} className="w-full">Kirim tautan pemulihan</Button>
            </form>
          </>}
    </AuthShell>
  )
}

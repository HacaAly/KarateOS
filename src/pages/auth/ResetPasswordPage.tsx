import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { AuthShell, FormAlert } from './AuthShell'
import { Spinner } from '../../components/ui/States'

export default function ResetPasswordPage() {
  const { session, loading, recoveryMode, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password minimal 8 karakter.'); return }
    if (password !== confirm) { setError('Konfirmasi password tidak sama.'); return }
    setBusy(true)
    const res = await updatePassword(password)
    setBusy(false)
    if (res.ok) navigate('/', { replace: true }); else setError(res.message ?? 'Gagal mengubah password.')
  }

  if (!session) {
    return (
      <AuthShell title="Tautan tidak valid" footer={<Link to="/lupa-password" className="font-semibold text-brand-700 hover:underline">Minta tautan baru</Link>}>
        <FormAlert kind="error">Tautan pemulihan tidak valid atau sudah kedaluwarsa.</FormAlert>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Atur password baru"
      footer={recoveryMode ? <button onClick={() => void signOut()} className="font-semibold text-brand-700 hover:underline">Batalkan</button> : undefined}>
      {error && <FormAlert kind="error">{error}</FormAlert>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Password baru" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Minimal 8 karakter." required />
        <Input label="Konfirmasi password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <Button type="submit" loading={busy} className="w-full">Simpan password</Button>
      </form>
    </AuthShell>
  )
}

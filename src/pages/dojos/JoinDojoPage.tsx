import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { DataTable, type Column } from '../../components/tables/DataTable'
import { applyToDojo, cancelApplication, getDojoPublicInfo, listMyApplications } from '../../services/dojos'
import { toMessage } from '../../lib/supabase'
import { applicationStatusLabel, toneFor } from '../../utils/labels'
import { formatDate } from '../../utils/format'
import type { MyApplication } from '../../types/database'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function JoinDojoPage() {
  const { user } = useAuth()
  const access = useAccess()
  const toast = useToast()
  const [dojoId, setDojoId] = useState('')
  const [dojoName, setDojoName] = useState<string | null>(null)
  const [role, setRole] = useState<'athlete' | 'guardian'>('athlete')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const mine = useAsync(() => listMyApplications(user!.id), [user?.id])

  async function lookup() {
    setError(undefined); setDojoName(null)
    const id = dojoId.trim()
    if (!UUID.test(id)) { setError('ID dojo tidak valid. Minta ID dojo kepada pengelola dojo.'); return }
    setBusy(true)
    try {
      const info = await getDojoPublicInfo(id)
      if (!info) setError('Dojo tidak ditemukan atau tidak aktif.'); else setDojoName(info.name)
    } catch (e) { setError(toMessage(e)) } finally { setBusy(false) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!dojoName) { await lookup(); return }
    setBusy(true)
    try {
      await applyToDojo(dojoId.trim(), user!.id, role, message.trim() || null)
      toast.success('Permohonan terkirim. Tunggu persetujuan pengelola dojo.')
      setDojoId(''); setDojoName(null); setMessage(''); mine.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  async function cancel(a: MyApplication) {
    try { await cancelApplication(a.id); toast.success('Permohonan dibatalkan.'); mine.reload() } catch (err) { toast.error(toMessage(err)) }
  }

  const cols: Column<MyApplication>[] = [
    { key: 'dojo', header: 'Dojo', render: (a) => access.dojos.some((d) => d.id === a.dojo_id) ? access.dojoName(a.dojo_id) : <span className="text-ink-500">{a.dojo_id.slice(0, 8)}…</span> },
    { key: 'role', header: 'Sebagai', render: (a) => (a.requested_role === 'athlete' ? 'Atlet' : 'Wali') },
    { key: 'status', header: 'Status', render: (a) => <Badge tone={toneFor.status(a.status)}>{applicationStatusLabel[a.status]}</Badge> },
    { key: 'date', header: 'Diajukan', render: (a) => formatDate(a.created_at) },
    { key: 'act', header: '', className: 'text-right', render: (a) => a.status === 'pending' ? <Button size="sm" variant="ghost" onClick={() => void cancel(a)}>Batalkan</Button> : null },
  ]

  return (
    <>
      <PageHeader title="Gabung ke dojo" description="Ajukan keanggotaan ke dojo. Pengelola dojo akan menyetujui atau menolak permohonan Anda."
        actions={<Link to="/dojo"><Button variant="secondary">Kembali</Button></Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ajukan permohonan">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Input label="ID dojo" value={dojoId} onChange={(e) => { setDojoId(e.target.value); setDojoName(null) }} error={error}
              hint="Pengelola dojo dapat membagikan ID dojo dari halaman detail dojo." placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
            {dojoName && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Dojo ditemukan: <strong>{dojoName}</strong></p>}
            {dojoName && (<>
              <Select label="Bergabung sebagai" value={role} onChange={(e) => setRole(e.target.value as 'athlete' | 'guardian')}
                options={[{ value: 'athlete', label: 'Atlet' }, { value: 'guardian', label: 'Wali atlet' }]} />
              <Textarea label="Pesan (opsional)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </>)}
            <Button type="submit" loading={busy} className="w-full">{dojoName ? 'Kirim permohonan' : 'Cari dojo'}</Button>
          </form>
        </Card>
        <Card title="Permohonan saya" className="!p-0">
          <DataTable columns={cols} rows={mine.data} rowKey={(a) => a.id} loading={mine.loading} error={mine.error} onRetry={mine.reload}
            empty={{ title: 'Belum ada permohonan' }} />
        </Card>
      </div>
    </>
  )
}

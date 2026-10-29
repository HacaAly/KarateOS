import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { attendanceIcon, medalIcon } from '../../components/ui/StatusIcons'
import { Badge } from '../../components/ui/Badge'
import { Input, Select } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { DataTable } from '../../components/tables/DataTable'
import { AthleteFormModal } from './AthletesPage'
import { deleteAthlete, getAthlete, linkAthleteAccount } from '../../services/athletes'
import { attendanceHistory, summarize } from '../../services/attendance'
import { listAchievements } from '../../services/achievements'
import { toMessage } from '../../lib/supabase'
import { athleteStatusLabel, attendanceLabel, beltLabel, medalLabel, toneFor } from '../../utils/labels'
import { ageFrom, formatDate, formatShortDate } from '../../utils/format'

export default function AthleteDetailPage() {
  const { id = '' } = useParams()
  const access = useAccess()
  const toast = useToast()
  const navigate = useNavigate()
  const athlete = useAsync(() => getAthlete(id), [id])
  const att = useAsync(() => attendanceHistory({ athleteId: id, limit: 200 }), [id])
  const ach = useAsync(() => listAchievements({ athleteId: id }), [id])
  const [editOpen, setEditOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState({ email: '', as: 'guardian' as 'self' | 'guardian' })
  const [busy, setBusy] = useState(false)

  if (athlete.loading && !athlete.data) return <Spinner />
  if (athlete.error) return <Card><ErrorState message={athlete.error} onRetry={athlete.reload} /></Card>
  if (!athlete.data) return <Card><EmptyState title="Atlet tidak ditemukan" description="Data tidak ada atau Anda tidak memiliki akses." action={<Link to="/atlet"><Button variant="secondary">Kembali</Button></Link>} /></Card>
  const a = athlete.data
  const canStaff = access.canStaffDojo(a.dojo_id)
  const canManage = access.canManageDojo(a.dojo_id)
  const s = att.data ? summarize(att.data) : null

  async function submitLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try { await linkAthleteAccount(id, link.email.trim(), link.as); toast.success(link.email.trim() ? 'Akun ditautkan.' : 'Tautan akun dilepas.'); setLinkOpen(false); athlete.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true)
    try { await deleteAthlete(id); toast.success('Atlet dihapus.'); navigate('/atlet', { replace: true }) }
    catch (err) { toast.error(toMessage(err)); setDelOpen(false) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title={a.full_name} description={`${access.dojoName(a.dojo_id)} · Sabuk ${beltLabel[a.belt_rank]}`}
        actions={<>
          <Link to="/atlet"><Button variant="secondary">Kembali</Button></Link>
          {canManage && <Button variant="secondary" onClick={() => setLinkOpen(true)}>Tautkan akun</Button>}
          {canStaff && <Button variant="secondary" onClick={() => setEditOpen(true)}>Ubah</Button>}
          {canManage && <Button variant="danger" onClick={() => setDelOpen(true)}>Hapus</Button>}
        </>} />
      <div className="grid gap-6">
        <Card title="Data atlet">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Item label="Status"><Badge tone={toneFor.status(a.status)}>{athleteStatusLabel[a.status]}</Badge></Item>
            <Item label="Nomor anggota">{a.member_number ?? '—'}</Item>
            <Item label="Jenis kelamin">{a.gender === 'L' ? 'Laki-laki' : a.gender === 'P' ? 'Perempuan' : '—'}</Item>
            <Item label="Tanggal lahir">{formatDate(a.birth_date)}{ageFrom(a.birth_date) !== null && ` (${ageFrom(a.birth_date)} th)`}</Item>
            <Item label="Wali">{a.guardian_name ?? '—'}</Item>
            <Item label="Telepon wali">{a.guardian_phone ?? '—'}</Item>
            <Item label="Akun atlet">{a.user_id ? 'Tertaut' : 'Tidak ada akun'}</Item>
            <Item label="Akun wali">{a.guardian_user_id ? 'Tertaut' : 'Tidak ada akun'}</Item>
          </dl>
        </Card>
        <Card title="Riwayat kehadiran" className="!p-0">
          {s && s.total > 0 && <p className="border-b border-ink-100 px-4 py-3 text-sm">Tingkat kehadiran <strong>{s.rate}%</strong> — {s.present} hadir, {s.late} terlambat, {s.excused} izin, {s.absent} alpa</p>}
          <DataTable columns={[
            { key: 'd', header: 'Tanggal', render: (r) => formatShortDate(r.training_schedules?.session_date) },
            { key: 's', header: 'Sesi', render: (r) => r.training_schedules?.title ?? '—' },
            { key: 'st', header: 'Status', render: (r) => <Badge tone={toneFor.attendance(r.status)} icon={attendanceIcon(r.status)}>{attendanceLabel[r.status]}</Badge> },
          ]} rows={att.data?.slice(0, 30) ?? null} rowKey={(r) => r.id} loading={att.loading} error={att.error} onRetry={att.reload} empty={{ title: 'Belum ada catatan kehadiran' }} />
        </Card>
        <Card title="Prestasi" className="!p-0">
          <DataTable columns={[
            { key: 'e', header: 'Kompetisi / event', render: (r) => r.competitions?.name ?? r.event_name ?? '—' },
            { key: 'c', header: 'Kategori', render: (r) => r.category ?? '—' },
            { key: 'r', header: 'Hasil', render: (r) => r.result ?? '—' },
            { key: 'm', header: 'Medali', render: (r) => <Badge tone={toneFor.medal(r.medal)} icon={medalIcon(r.medal)}>{medalLabel[r.medal]}</Badge> },
            { key: 'y', header: 'Tahun', render: (r) => r.year },
          ]} rows={ach.data} rowKey={(r) => r.id} loading={ach.loading} error={ach.error} onRetry={ach.reload} empty={{ title: 'Belum ada prestasi' }} />
        </Card>
      </div>

      <AthleteFormModal open={editOpen} onClose={() => setEditOpen(false)} athlete={a} dojos={access.staffDojos as never} onSaved={athlete.reload} />
      <Modal open={linkOpen} title="Tautkan akun pengguna" onClose={() => setLinkOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setLinkOpen(false)}>Batal</Button><Button type="submit" form="link-form" loading={busy}>Simpan</Button></>}>
        <form id="link-form" onSubmit={submitLink} className="space-y-4" noValidate>
          <Select label="Tautkan sebagai" value={link.as} onChange={(e) => setLink({ ...link, as: e.target.value as 'self' | 'guardian' })} options={[{ value: 'guardian', label: 'Wali atlet' }, { value: 'self', label: 'Akun atlet itu sendiri' }]} />
          <Input label="Email pengguna" type="email" value={link.email} onChange={(e) => setLink({ ...link, email: e.target.value })} hint="Kosongkan lalu simpan untuk melepas tautan. Pengguna harus sudah terdaftar." />
        </form>
      </Modal>
      <ConfirmDialog open={delOpen} title="Hapus atlet" loading={busy} onCancel={() => setDelOpen(false)} onConfirm={() => void remove()}
        message="Data atlet beserta kehadiran dan prestasinya akan dihapus. Atlet yang memiliki catatan pembayaran tidak dapat dihapus. Tindakan ini tidak dapat dibatalkan." />
    </>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt><dd className="mt-1 text-sm">{children}</dd></div>
}

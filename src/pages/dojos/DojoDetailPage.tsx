import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Award, CalendarDays, Check, Copy, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { attendanceIcon, medalIcon, paymentIcon } from '../../components/ui/StatusIcons'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Input, Select } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { CascadeDeleteDialog } from '../../components/ui/CascadeDeleteDialog'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { DataTable, type Column } from '../../components/tables/DataTable'
import { DojoFormModal } from './DojoFormModal'
import {
  addDojoMember, dojoStats, deleteDojoCascade, dojoDeletePreview, decideApplication, getDojo, listApplications, listDojoMembers, removeDojoMember,
  updateDojo, updateDojoMemberStatus, type DojoInput,
} from '../../services/dojos'
import { listAthletes } from '../../services/athletes'
import { listCoaches } from '../../services/coaches'
import { listSchedules } from '../../services/schedules'
import { listPayments } from '../../services/payments'
import { listAchievements } from '../../services/achievements'
import { attendanceHistory, summarize } from '../../services/attendance'
import { listCompetitions } from '../../services/competitions'
import { toMessage } from '../../lib/supabase'
import {
  applicationStatusLabel, athleteStatusLabel, attendanceLabel, beltLabel, competitionStatusLabel, dojoRoleLabel,
  entityStatusLabel, medalLabel, membershipLabel, options, paymentStatusLabel, scheduleStatusLabel, toneFor,
} from '../../utils/labels'
import { formatDate, formatMonth, formatRupiah, formatShortDate, formatTime } from '../../utils/format'
import type {
  Athlete, Coach, DojoApplicationRow, DojoMemberRow, DojoRole, TrainingSchedule, Competition,
} from '../../types/database'
import type { AchievementRow } from '../../services/achievements'
import type { PaymentRow } from '../../services/payments'

type TabKey = 'ringkasan' | 'anggota' | 'permohonan' | 'atlet' | 'pelatih' | 'jadwal' | 'kehadiran' | 'kompetisi' | 'prestasi' | 'pembayaran'

export default function DojoDetailPage() {
  const { id = '' } = useParams()
  const access = useAccess()
  const toast = useToast()
  const navigate = useNavigate()
  const dojo = useAsync(() => getDojo(id), [id])
  const stats = useAsync(() => dojoStats(id), [id])
  const [tab, setTab] = useState<TabKey>('ringkasan')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const canManage = access.canManageDojo(id)
  const canStaff = access.canStaffDojo(id)
  const org = dojo.data ? dojo.data.organization_id : ''
  const canDelete = !!org && access.isOrgAdmin(org)

  if (dojo.loading && !dojo.data) return <Spinner />
  if (dojo.error) return <Card><ErrorState message={dojo.error} onRetry={dojo.reload} /></Card>
  if (!dojo.data) return <Card><EmptyState title="Dojo tidak ditemukan" description="Dojo tidak ada atau Anda tidak memiliki akses." action={<Link to="/dojo"><Button variant="secondary">Kembali</Button></Link>} /></Card>
  const d = dojo.data

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'ringkasan', label: 'Ringkasan' },
    ...(canStaff ? [{ key: 'anggota' as const, label: 'Anggota' }] : []),
    ...(canManage ? [{ key: 'permohonan' as const, label: 'Permohonan' }] : []),
    ...(canStaff ? [{ key: 'atlet' as const, label: 'Atlet' }, { key: 'pelatih' as const, label: 'Pelatih' }] : []),
    { key: 'jadwal', label: 'Jadwal' },
    ...(canStaff ? [{ key: 'kehadiran' as const, label: 'Kehadiran' }] : []),
    { key: 'kompetisi', label: 'Kompetisi' },
    ...(canStaff ? [{ key: 'prestasi' as const, label: 'Prestasi' }] : []),
    ...(canManage ? [{ key: 'pembayaran' as const, label: 'Pembayaran' }] : []),
  ]

  async function save(v: DojoInput) {
    setBusy(true)
    try {
      await updateDojo(id, { name: v.name, address: v.address, description: v.description, contact: v.contact, status: v.status })
      toast.success('Dojo diperbarui.'); setEditOpen(false); dojo.reload(); access.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    try { await deleteDojoCascade(id); toast.success('Dojo dan seluruh data terikat dihapus.'); access.reload(); navigate('/dojo', { replace: true }) }
    catch (err) { toast.error(toMessage(err)); setDeleteOpen(false) } finally { setBusy(false) }
  }

  async function deactivate() {
    setBusy(true)
    try { await updateDojo(id, { name: d.name, address: d.address, description: d.description, contact: d.contact, status: 'inactive' }); toast.success('Dojo dinonaktifkan. Data tetap tersimpan.'); setDeleteOpen(false); dojo.reload(); access.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(id); toast.success('ID dojo disalin.') } catch { toast.info(`ID dojo: ${id}`) }
  }

  return (
    <>
      <PageHeader leading={<Avatar name={d.name} src={d.logo_url} size="lg" rounded="xl" />} title={d.name} description={`${access.orgName(d.organization_id)} · ${d.address ?? 'Alamat belum diisi'}`}
        actions={<>
          <Link to="/dojo"><Button variant="secondary">Kembali</Button></Link>
          {canManage && <Button variant="secondary" onClick={() => setEditOpen(true)}>Ubah dojo</Button>}
          {canDelete && <Button variant="danger" onClick={() => setDeleteOpen(true)}>Hapus</Button>}
        </>} />
      {canStaff && stats.data && (
        <dl className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
          {([['Atlet', stats.data.athletes, <Users key="a" size={16} />, 'text-brand-700 bg-brand-50'], ['Pelatih', stats.data.coaches, <Award key="c" size={16} />, 'text-teal-700 bg-teal-50'], ['Jadwal', stats.data.upcoming, <CalendarDays key="j" size={16} />, 'text-violet-700 bg-violet-50']] as const).map(([l, v, ic, tone]) => (
            <div key={l} className="rounded-(--radius-card) border border-ink-200/80 bg-white p-3 shadow-(--shadow-card) sm:p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-500 sm:text-sm"><span aria-hidden="true" className={`hidden h-6 w-6 items-center justify-center rounded-lg sm:flex ${tone}`}>{ic}</span>{l}{l === 'Jadwal' && <span className="sr-only"> mendatang</span>}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink-900">{v}</dd>
            </div>))}
        </dl>)}
      <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {tab === 'ringkasan' && (
        <Card>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info label="Status"><Badge tone={toneFor.status(d.status)}>{entityStatusLabel[d.status]}</Badge></Info>
            <Info label="Kontak">{d.contact ?? '—'}</Info>
            <Info label="Organisasi"><Link className="text-brand-700 hover:underline" to={`/organisasi/${d.organization_id}`}>{access.orgName(d.organization_id)}</Link></Info>
            <Info label="Dibuat">{formatDate(d.created_at)}</Info>
            <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink-500">Deskripsi</dt><dd className="mt-1 text-sm">{d.description ?? '—'}</dd></div>
            {canManage && (
              <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink-500">ID dojo (untuk permohonan bergabung)</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2"><code className="break-all rounded bg-ink-100 px-2 py-1 text-xs">{id}</code>
                  <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => void copyId()}>Salin</Button></dd></div>)}
          </dl>
        </Card>)}
      {tab === 'anggota' && <MembersTab dojoId={id} canManage={canManage} canAssignAdmin={access.isOrgAdmin(d.organization_id)} />}
      {tab === 'permohonan' && <ApplicationsTab dojoId={id} />}
      {tab === 'atlet' && <AthletesTab dojoId={id} />}
      {tab === 'pelatih' && <CoachesTab dojoId={id} />}
      {tab === 'jadwal' && <SchedulesTab dojoId={id} />}
      {tab === 'kehadiran' && <AttendanceTab dojoId={id} />}
      {tab === 'kompetisi' && <CompetitionsTab organizationId={d.organization_id} />}
      {tab === 'prestasi' && <AchievementsTab dojoId={id} />}
      {tab === 'pembayaran' && <PaymentsTab dojoId={id} />}

      <DojoFormModal open={editOpen} onClose={() => setEditOpen(false)} organizations={access.organizations} dojo={d} busy={busy} onSubmit={(v) => void save(v)} />
      <CascadeDeleteDialog open={deleteOpen} kind="dojo" name={d.name} busy={busy} onCancel={() => setDeleteOpen(false)}
        onDeleteAll={() => void remove()} onDeactivate={d.status === 'active' ? () => void deactivate() : undefined}
        loadItems={async () => { const p = await dojoDeletePreview(id); return [
          { label: 'Atlet', count: p.athletes }, { label: 'Pelatih', count: p.coaches }, { label: 'Jadwal latihan', count: p.schedules }, { label: 'Catatan kehadiran', count: p.attendance },
          { label: 'Prestasi', count: p.achievements }, { label: 'Peserta kompetisi', count: p.entries }, { label: 'Pembayaran', count: p.payments },
          { label: 'Anggota dojo', count: p.members }, { label: 'Permohonan bergabung', count: p.applications }] }} />
    </>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt><dd className="mt-1 text-sm">{children}</dd></div>
}

function MembersTab({ dojoId, canManage, canAssignAdmin }: { dojoId: string; canManage: boolean; canAssignAdmin: boolean }) {
  const toast = useToast()
  const members = useAsync(() => listDojoMembers(dojoId), [dojoId])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ email: '', role: 'athlete' as DojoRole })
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<DojoMemberRow | null>(null)
  const roleOptions = options(dojoRoleLabel).filter((r) => canAssignAdmin || r.value !== 'dojo_admin')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { toast.error('Format email tidak valid.'); return }
    setBusy(true)
    try { await addDojoMember(dojoId, f.email.trim(), f.role); toast.success('Anggota ditambahkan.'); setOpen(false); setF({ email: '', role: 'athlete' }); members.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function toggle(m: DojoMemberRow) {
    try { await updateDojoMemberStatus(m.id, m.membership_status === 'active' ? 'inactive' : 'active'); members.reload() } catch (err) { toast.error(toMessage(err)) }
  }
  async function remove() {
    if (!target) return
    setBusy(true)
    try { await removeDojoMember(target.id); toast.success('Anggota dihapus.'); setTarget(null); members.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const cols: Column<DojoMemberRow>[] = [
    { key: 'name', header: 'Nama', render: (m) => <div><p className="font-medium">{m.full_name || '(tanpa nama)'}</p>{m.email && <p className="text-xs text-ink-500">{m.email}</p>}</div> },
    { key: 'role', header: 'Peran', render: (m) => <Badge tone="blue">{dojoRoleLabel[m.role]}</Badge> },
    { key: 'status', header: 'Status', render: (m) => <Badge tone={toneFor.status(m.membership_status)}>{membershipLabel[m.membership_status]}</Badge> },
    { key: 'joined', header: 'Bergabung', render: (m) => formatShortDate(m.joined_at) },
    ...(canManage ? [{ key: 'act', header: '', className: 'text-right', render: (m: DojoMemberRow) => (m.role !== 'dojo_admin' || canAssignAdmin) ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => void toggle(m)}>{m.membership_status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</Button>
        <Button size="sm" variant="ghost" aria-label="Hapus anggota" icon={<Trash2 size={16} />} onClick={() => setTarget(m)} />
      </div>) : null }] : []),
  ]
  return (
    <Card title="Anggota dojo" className="!p-0" action={canManage ? <Button size="sm" icon={<UserPlus size={16} />} onClick={() => setOpen(true)}>Tambah anggota</Button> : undefined}>
      <DataTable columns={cols} rows={members.data} rowKey={(m) => m.id} loading={members.loading} error={members.error} onRetry={members.reload}
        empty={{ title: 'Belum ada anggota', description: 'Tambahkan anggota lewat email atau setujui permohonan bergabung.' }} />
      <Modal open={open} title="Tambah anggota dojo" onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="add-dojo-member" loading={busy}>Tambah</Button></>}>
        <form id="add-dojo-member" onSubmit={submit} className="space-y-4" noValidate>
          <Input label="Email pengguna" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} hint="Pengguna harus sudah mendaftar di KarateOS." required />
          <Select label="Peran" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as DojoRole })} options={roleOptions} />
        </form>
      </Modal>
      <ConfirmDialog open={!!target} title="Hapus anggota" loading={busy} onCancel={() => setTarget(null)} onConfirm={() => void remove()}
        message={<>Hapus <strong>{target?.full_name || 'anggota ini'}</strong> dari dojo?</>} />
    </Card>
  )
}

function ApplicationsTab({ dojoId }: { dojoId: string }) {
  const toast = useToast()
  const apps = useAsync(() => listApplications(dojoId), [dojoId])
  async function decide(a: DojoApplicationRow, status: 'approved' | 'rejected') {
    try { await decideApplication(a.id, status); toast.success(status === 'approved' ? 'Permohonan disetujui. Pemohon kini menjadi anggota.' : 'Permohonan ditolak.'); apps.reload() }
    catch (err) { toast.error(toMessage(err)); apps.reload() }
  }
  const cols: Column<DojoApplicationRow>[] = [
    { key: 'name', header: 'Pemohon', render: (a) => <div><p className="font-medium">{a.full_name || '(tanpa nama)'}</p><p className="text-xs text-ink-500">{a.email}</p></div> },
    { key: 'role', header: 'Sebagai', render: (a) => (a.requested_role === 'athlete' ? 'Atlet' : 'Wali') },
    { key: 'msg', header: 'Pesan', render: (a) => a.message ?? '—' },
    { key: 'status', header: 'Status', render: (a) => <Badge tone={toneFor.status(a.status)}>{applicationStatusLabel[a.status]}</Badge> },
    { key: 'date', header: 'Diajukan', render: (a) => formatShortDate(a.created_at) },
    { key: 'act', header: '', className: 'text-right', render: (a) => a.status === 'pending' ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" icon={<Check size={14} />} onClick={() => void decide(a, 'approved')}>Setujui</Button>
        <Button size="sm" variant="secondary" icon={<X size={14} />} onClick={() => void decide(a, 'rejected')}>Tolak</Button>
      </div>) : null },
  ]
  return (
    <Card title="Permohonan bergabung" className="!p-0">
      <DataTable columns={cols} rows={apps.data} rowKey={(a) => a.id} loading={apps.loading} error={apps.error} onRetry={apps.reload}
        empty={{ title: 'Belum ada permohonan', description: 'Bagikan ID dojo kepada calon anggota agar mereka dapat mengajukan permohonan.' }} />
    </Card>
  )
}

function SummaryLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="text-sm text-brand-700 hover:underline">{label}</Link>
}

function AthletesTab({ dojoId }: { dojoId: string }) {
  const list = useAsync(() => listAthletes({ dojoId }), [dojoId])
  const cols: Column<Athlete>[] = [
    { key: 'name', header: 'Nama', render: (a) => <Link className="font-medium text-brand-700 hover:underline" to={`/atlet/${a.id}`}>{a.full_name}</Link> },
    { key: 'belt', header: 'Sabuk', render: (a) => beltLabel[a.belt_rank] },
    { key: 'no', header: 'No. anggota', render: (a) => a.member_number ?? '—' },
    { key: 'status', header: 'Status', render: (a) => <Badge tone={toneFor.status(a.status)}>{athleteStatusLabel[a.status]}</Badge> },
  ]
  return <Card title="Atlet" className="!p-0" action={<SummaryLink to={`/atlet?dojo=${dojoId}`} label="Kelola atlet" />}>
    <DataTable columns={cols} rows={list.data} rowKey={(a) => a.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={{ title: 'Belum ada atlet' }} /></Card>
}

function CoachesTab({ dojoId }: { dojoId: string }) {
  const list = useAsync(() => listCoaches(dojoId), [dojoId])
  const cols: Column<Coach>[] = [
    { key: 'name', header: 'Nama', render: (c) => <span className="font-medium">{c.full_name}</span> },
    { key: 'belt', header: 'Sabuk', render: (c) => (c.belt_rank ? beltLabel[c.belt_rank] : '—') },
    { key: 'phone', header: 'Telepon', render: (c) => c.phone ?? '—' },
    { key: 'status', header: 'Status', render: (c) => <Badge tone={toneFor.status(c.status)}>{entityStatusLabel[c.status]}</Badge> },
  ]
  return <Card title="Pelatih" className="!p-0" action={<SummaryLink to={`/pelatih?dojo=${dojoId}`} label="Kelola pelatih" />}>
    <DataTable columns={cols} rows={list.data} rowKey={(c) => c.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={{ title: 'Belum ada pelatih' }} /></Card>
}

function SchedulesTab({ dojoId }: { dojoId: string }) {
  const list = useAsync(() => listSchedules({ dojoId, ascending: false, limit: 20 }), [dojoId])
  const cols: Column<TrainingSchedule>[] = [
    { key: 'title', header: 'Sesi', render: (s) => <span className="font-medium">{s.title}</span> },
    { key: 'date', header: 'Tanggal', render: (s) => formatShortDate(s.session_date) },
    { key: 'time', header: 'Waktu', render: (s) => `${formatTime(s.start_time)}–${formatTime(s.end_time)}` },
    { key: 'status', header: 'Status', render: (s) => <Badge tone={toneFor.status(s.status)}>{scheduleStatusLabel[s.status]}</Badge> },
  ]
  return <Card title="Jadwal latihan (20 terbaru)" className="!p-0" action={<SummaryLink to={`/jadwal?dojo=${dojoId}`} label="Kelola jadwal" />}>
    <DataTable columns={cols} rows={list.data} rowKey={(s) => s.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={{ title: 'Belum ada jadwal' }} /></Card>
}

function AttendanceTab({ dojoId }: { dojoId: string }) {
  const hist = useAsync(() => attendanceHistory({ dojoId, limit: 500 }), [dojoId])
  const s = hist.data ? summarize(hist.data) : null
  const rows = hist.data?.slice(0, 30) ?? null
  return (
    <Card title="Riwayat kehadiran" className="!p-0" action={<SummaryLink to={`/kehadiran?dojo=${dojoId}`} label="Catat kehadiran" />}>
      {s && s.total > 0 && <p className="border-b border-ink-100 px-4 py-3 text-sm text-ink-700">Tingkat kehadiran: <strong>{s.rate}%</strong> ({s.present} hadir, {s.late} terlambat, {s.excused} izin, {s.absent} alpa dari {s.total} catatan)</p>}
      <DataTable columns={[
        { key: 'a', header: 'Atlet', render: (r) => r.athletes?.full_name ?? '—' },
        { key: 's', header: 'Sesi', render: (r) => r.training_schedules?.title ?? '—' },
        { key: 'd', header: 'Tanggal', render: (r) => formatShortDate(r.training_schedules?.session_date) },
        { key: 'st', header: 'Status', render: (r) => <Badge tone={toneFor.attendance(r.status)} icon={attendanceIcon(r.status)}>{attendanceLabel[r.status]}</Badge> },
      ]} rows={rows} rowKey={(r) => r.id} loading={hist.loading} error={hist.error} onRetry={hist.reload} empty={{ title: 'Belum ada catatan kehadiran' }} />
    </Card>
  )
}

function CompetitionsTab({ organizationId }: { organizationId: string }) {
  const list = useAsync(() => listCompetitions(organizationId), [organizationId])
  const cols: Column<Competition>[] = [
    { key: 'name', header: 'Kompetisi', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'date', header: 'Tanggal', render: (c) => formatShortDate(c.start_date) },
    { key: 'loc', header: 'Lokasi', render: (c) => c.location ?? '—' },
    { key: 'st', header: 'Status', render: (c) => <Badge tone={toneFor.status(c.status)}>{competitionStatusLabel[c.status]}</Badge> },
  ]
  return <Card title="Kompetisi organisasi" className="!p-0" action={<SummaryLink to="/kompetisi" label="Kelola kompetisi" />}>
    <DataTable columns={cols} rows={list.data} rowKey={(c) => c.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={{ title: 'Belum ada kompetisi' }} /></Card>
}

function AchievementsTab({ dojoId }: { dojoId: string }) {
  const list = useAsync(() => listAchievements({ dojoId, limit: 30 }), [dojoId])
  const cols: Column<AchievementRow>[] = [
    { key: 'a', header: 'Atlet', render: (r) => r.athletes?.full_name ?? '—' },
    { key: 'e', header: 'Kompetisi / event', render: (r) => r.competitions?.name ?? r.event_name ?? '—' },
    { key: 'r', header: 'Hasil', render: (r) => r.result ?? '—' },
    { key: 'm', header: 'Medali', render: (r) => <Badge tone={toneFor.medal(r.medal)} icon={medalIcon(r.medal)}>{medalLabel[r.medal]}</Badge> },
    { key: 'y', header: 'Tahun', render: (r) => r.year },
  ]
  const medals = list.data ? { gold: list.data.filter((x) => x.medal === 'gold').length, silver: list.data.filter((x) => x.medal === 'silver').length, bronze: list.data.filter((x) => x.medal === 'bronze').length } : null
  return <Card title="Prestasi dojo" className="!p-0" action={<SummaryLink to={`/prestasi?dojo=${dojoId}`} label="Kelola prestasi" />}>
    {medals && <p className="border-b border-ink-100 px-4 py-3 text-sm text-ink-700">Ringkasan: <strong>{medals.gold}</strong> emas · <strong>{medals.silver}</strong> perak · <strong>{medals.bronze}</strong> perunggu</p>}
    <DataTable columns={cols} rows={list.data} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={{ title: 'Belum ada prestasi' }} /></Card>
}

function PaymentsTab({ dojoId }: { dojoId: string }) {
  const list = useAsync(() => listPayments({ dojoId }), [dojoId])
  const cols: Column<PaymentRow>[] = [
    { key: 'a', header: 'Atlet', render: (r) => r.athletes?.full_name ?? '—' },
    { key: 'p', header: 'Periode', render: (r) => formatMonth(r.period) },
    { key: 'am', header: 'Nominal', render: (r) => formatRupiah(r.amount) },
    { key: 'st', header: 'Status', render: (r) => <Badge tone={toneFor.status(r.status)} icon={paymentIcon(r.status)}>{paymentStatusLabel[r.status]}</Badge> },
  ]
  return <Card title="Pembayaran (pencatatan manual)" className="!p-0" action={<SummaryLink to={`/pembayaran?dojo=${dojoId}`} label="Kelola pembayaran" />}>
    <DataTable columns={cols} rows={list.data?.slice(0, 20) ?? null} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={{ title: 'Belum ada catatan pembayaran' }} /></Card>
}

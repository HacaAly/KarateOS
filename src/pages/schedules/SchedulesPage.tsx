import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, List, Pencil, Plus, Trash2 } from 'lucide-react'
import { ScheduleCalendar, iso } from './ScheduleCalendar'
import { Link } from 'react-router-dom'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useQueryParam } from '../../hooks/useQueryParam'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DataTable, Toolbar, type Column } from '../../components/tables/DataTable'
import { DojoSelectField } from '../../components/forms/DojoSelectField'
import { createSchedule, deleteSchedule, listSchedules, updateSchedule, type ScheduleInput } from '../../services/schedules'
import { listCoaches } from '../../services/coaches'
import { toMessage } from '../../lib/supabase'
import { options, scheduleStatusLabel, toneFor } from '../../utils/labels'
import { formatShortDate, formatTime, todayISO } from '../../utils/format'
import type { ScheduleStatus, TrainingSchedule } from '../../types/database'

const blank = { dojo_id: '', title: '', session_date: '', start_time: '16:00', end_time: '18:00', location: '', coach_id: '', status: 'scheduled' as ScheduleStatus, notes: '' }

export default function SchedulesPage() {
  const access = useAccess()
  const toast = useToast()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const [when, setWhen] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<TrainingSchedule | null>(null)
  const [del, setDel] = useState<TrainingSchedule | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const today = todayISO()
  const list = useAsync(() => listSchedules({
    dojoId: dojoId || undefined, status: status || undefined,
    from: when === 'upcoming' ? today : undefined, to: when === 'past' ? today : undefined, ascending: when !== 'past',
  }), [dojoId, status, when])
  const monthList = useAsync(() => view === 'calendar' ? listSchedules({
    dojoId: dojoId || undefined, status: status || undefined,
    from: iso(cursor.y, cursor.m, 1), to: iso(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate()),
  }) : Promise.resolve([] as TrainingSchedule[]), [view, cursor.y, cursor.m, dojoId, status])
  const coaches = useAsync(() => listCoaches(f.dojo_id || undefined), [f.dojo_id, open])
  const canCreate = access.staffDojos.length > 0

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(edit ? { dojo_id: edit.dojo_id, title: edit.title, session_date: edit.session_date, start_time: edit.start_time.slice(0, 5), end_time: edit.end_time.slice(0, 5),
      location: edit.location ?? '', coach_id: edit.coach_id ?? '', status: edit.status, notes: edit.notes ?? '' }
      : { ...blank, dojo_id: dojoId || (access.staffDojos.length === 1 ? access.staffDojos[0].id : ''), session_date: todayISO() })
  }, [open, edit, dojoId, access.staffDojos])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.dojo_id) errs.dojo_id = 'Pilih dojo.'
    if (f.title.trim().length < 2) errs.title = 'Nama sesi minimal 2 karakter.'
    if (!f.session_date) errs.session_date = 'Tanggal wajib diisi.'
    if (!f.start_time) errs.start_time = 'Wajib diisi.'
    if (!f.end_time) errs.end_time = 'Wajib diisi.'
    else if (f.start_time && f.end_time <= f.start_time) errs.end_time = 'Jam selesai harus setelah jam mulai.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload: ScheduleInput = { dojo_id: f.dojo_id, title: f.title.trim(), session_date: f.session_date, start_time: f.start_time, end_time: f.end_time,
      location: f.location.trim() || null, coach_id: f.coach_id || null, status: f.status, notes: f.notes.trim() || null }
    setBusy(true)
    try {
      if (edit) { const { dojo_id: _d, ...patch } = payload; void _d; await updateSchedule(edit.id, patch) } else await createSchedule(payload)
      toast.success(edit ? 'Jadwal diperbarui.' : 'Jadwal dibuat.'); setOpen(false); list.reload(); monthList.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!del) return
    setBusy(true)
    try { await deleteSchedule(del.id); toast.success('Jadwal dihapus.'); setDel(null); list.reload(); monthList.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const rows = list.data?.filter((s) => s.title.toLowerCase().includes(search.toLowerCase())) ?? null
  const cols: Column<TrainingSchedule>[] = [
    { key: 'title', header: 'Sesi', render: (s) => <div><p className="font-medium">{s.title}</p><p className="text-xs text-ink-500">{s.location ?? 'Lokasi belum diisi'}</p></div> },
    { key: 'dojo', header: 'Dojo', render: (s) => access.dojoName(s.dojo_id) },
    { key: 'date', header: 'Tanggal', render: (s) => formatShortDate(s.session_date) },
    { key: 'time', header: 'Waktu', render: (s) => `${formatTime(s.start_time)}–${formatTime(s.end_time)}` },
    { key: 'status', header: 'Status', render: (s) => <Badge tone={toneFor.status(s.status)}>{scheduleStatusLabel[s.status]}</Badge> },
    { key: 'act', header: '', className: 'text-right', render: (s) => access.canStaffDojo(s.dojo_id) ? (
      <div className="flex justify-end gap-1">
        <Link to={`/kehadiran?dojo=${s.dojo_id}&sesi=${s.id}`}><Button size="sm" variant="secondary">Kehadiran</Button></Link>
        <Button size="sm" variant="ghost" aria-label="Ubah" icon={<Pencil size={16} />} onClick={() => { setEdit(s); setOpen(true) }} />
        {access.canManageDojo(s.dojo_id) && <Button size="sm" variant="ghost" aria-label="Hapus" icon={<Trash2 size={16} />} onClick={() => setDel(s)} />}
      </div>) : null },
  ]

  return (
    <>
      <PageHeader title="Jadwal latihan" description="Sesi latihan di dojo yang dapat Anda akses."
        actions={canCreate ? <Button icon={<Plus size={16} />} onClick={() => { setEdit(null); setOpen(true) }}>Buat jadwal</Button> : undefined} />
      <div className="mb-3 inline-flex rounded-lg border border-ink-200 bg-white p-0.5" role="group" aria-label="Tampilan jadwal">
        {([['list', 'Daftar', List], ['calendar', 'Kalender', CalendarDays]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
            className={`flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition ${view === k ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100'}`}><Icon size={16} aria-hidden="true" />{l}</button>))}
      </div>
      <Card className="!p-0">
        <Toolbar search={search} onSearch={setSearch} placeholder="Cari sesi…">
          <FilterSelect label="Filter dojo" value={dojoId} onChange={setDojoId} placeholder="Semua dojo" options={access.dojos.map((d) => ({ value: d.id, label: d.name }))} />
          {view === 'list' && <select aria-label="Rentang waktu" value={when} onChange={(e) => setWhen(e.target.value as typeof when)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base sm:w-auto sm:text-sm">
            <option value="upcoming">Mendatang</option><option value="past">Sudah lewat</option><option value="all">Semua</option>
          </select>}
          <FilterSelect label="Filter status" value={status} onChange={setStatus} placeholder="Semua status" options={options(scheduleStatusLabel)} />
        </Toolbar>
        {view === 'calendar' ? (
          <ScheduleCalendar cursor={cursor} onCursor={setCursor} rows={monthList.data ? monthList.data.filter((s) => s.title.toLowerCase().includes(search.toLowerCase())) : null} loading={monthList.loading} error={monthList.error} onRetry={monthList.reload}
            dojoName={access.dojoName}
            renderActions={(s) => access.canStaffDojo(s.dojo_id) ? (<>
              <Link to={`/kehadiran?dojo=${s.dojo_id}&sesi=${s.id}`}><Button size="sm" variant="secondary">Kehadiran</Button></Link>
              <Button size="sm" variant="ghost" aria-label="Ubah" icon={<Pencil size={16} />} onClick={() => { setEdit(s); setOpen(true) }} />
              {access.canManageDojo(s.dojo_id) && <Button size="sm" variant="ghost" aria-label="Hapus" icon={<Trash2 size={16} />} onClick={() => setDel(s)} />}
            </>) : null} />
        ) : <DataTable columns={cols} rows={rows} rowKey={(s) => s.id} loading={list.loading} error={list.error} onRetry={list.reload}
          empty={{ title: 'Tidak ada jadwal', description: canCreate ? 'Buat jadwal latihan baru.' : undefined }} />}
      </Card>

      <Modal open={open} title={edit ? 'Ubah jadwal' : 'Buat jadwal latihan'} onClose={() => setOpen(false)} wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="sch-form" loading={busy}>Simpan</Button></>}>
        <form id="sch-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2"><DojoSelectField dojos={access.staffDojos} value={f.dojo_id} disabled={!!edit} onChange={(v) => setF({ ...f, dojo_id: v, coach_id: '' })} error={errors.dojo_id} /></div>
          <div className="sm:col-span-2"><Input label="Nama / jenis sesi" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} placeholder="Latihan rutin, Kumite, Ujian kenaikan sabuk…" required /></div>
          <Input label="Tanggal" type="date" value={f.session_date} onChange={(e) => setF({ ...f, session_date: e.target.value })} error={errors.session_date} required />
          <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ScheduleStatus })} options={options(scheduleStatusLabel)} />
          <Input label="Jam mulai" type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} error={errors.start_time} required />
          <Input label="Jam selesai" type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} error={errors.end_time} required />
          <Input label="Lokasi" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={200} />
          <Select label="Pelatih bertugas" value={f.coach_id} onChange={(e) => setF({ ...f, coach_id: e.target.value })} placeholder="— Belum ditentukan —"
            options={(coaches.data ?? []).filter((c) => c.dojo_id === f.dojo_id && c.status === 'active').map((c) => ({ value: c.id, label: c.full_name }))}
            hint={f.dojo_id ? undefined : 'Pilih dojo terlebih dahulu.'} />
          <div className="sm:col-span-2"><Textarea label="Catatan" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus jadwal" loading={busy} onCancel={() => setDel(null)} onConfirm={() => void remove()}
        message={<>Hapus sesi <strong>{del?.title}</strong>? Catatan kehadiran pada sesi ini juga akan dihapus.</>} />
    </>
  )
}

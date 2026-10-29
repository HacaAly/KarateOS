import { useEffect, useMemo, useState } from 'react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useQueryParam } from '../../hooks/useQueryParam'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { attendanceIcon } from '../../components/ui/StatusIcons'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect } from '../../components/ui/Field'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { DataTable } from '../../components/tables/DataTable'
import { listSchedules } from '../../services/schedules'
import { listAthletes } from '../../services/athletes'
import { attendanceHistory, listAttendanceForSchedule, saveAttendance, summarize } from '../../services/attendance'
import { toMessage } from '../../lib/supabase'
import { attendanceLabel, options, toneFor } from '../../utils/labels'
import { formatShortDate, formatTime } from '../../utils/format'
import type { AttendanceStatus } from '../../types/database'

export default function AttendancePage() {
  const access = useAccess()
  const [tab, setTab] = useState<'catat' | 'riwayat'>(access.anyStaff ? 'catat' : 'riwayat')
  return (
    <>
      <PageHeader title="Kehadiran" description="Catat kehadiran latihan dan lihat riwayatnya." />
      <Tabs tabs={[...(access.anyStaff ? [{ key: 'catat', label: 'Catat kehadiran' }] : []), { key: 'riwayat', label: 'Riwayat' }]} active={tab} onChange={(k) => setTab(k as 'catat' | 'riwayat')} />
      {tab === 'catat' && access.anyStaff ? <Record /> : <History />}
    </>
  )
}

function Record() {
  const access = useAccess()
  const toast = useToast()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const [scheduleId, setScheduleId] = useQueryParam('sesi')
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)

  const schedules = useAsync(async () => (dojoId ? listSchedules({ dojoId, ascending: false, limit: 40 }) : []), [dojoId])
  const athletes = useAsync(async () => (dojoId ? listAthletes({ dojoId, status: 'active' }) : []), [dojoId])
  const existing = useAsync(async () => (scheduleId ? listAttendanceForSchedule(scheduleId) : []), [scheduleId])
  const schedule = schedules.data?.find((s) => s.id === scheduleId)

  useEffect(() => {
    const map: Record<string, AttendanceStatus> = {}
    for (const r of existing.data ?? []) map[r.athlete_id] = r.status
    setDraft(map)
  }, [existing.data])

  const dirty = useMemo(() => {
    const saved = new Map((existing.data ?? []).map((r) => [r.athlete_id, r.status]))
    return Object.entries(draft).filter(([id, st]) => saved.get(id) !== st)
  }, [draft, existing.data])

  async function save() {
    if (!schedule) return
    setSaving(true)
    try {
      await saveAttendance(schedule.dojo_id, schedule.id, dirty.map(([athlete_id, status]) => ({ athlete_id, status, notes: null })))
      toast.success(`Kehadiran tersimpan (${dirty.length} perubahan).`); existing.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setSaving(false) }
  }
  function markAll(status: AttendanceStatus) { setDraft(Object.fromEntries((athletes.data ?? []).map((a) => [a.id, status]))) }

  return (
    <Card className="!p-0">
      <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row">
        <FilterSelect label="Dojo" value={dojoId} onChange={(v) => { setDojoId(v); setScheduleId('') }} placeholder="Pilih dojo" options={access.staffDojos.map((d) => ({ value: d.id, label: d.name }))} />
        <FilterSelect label="Sesi latihan" value={scheduleId} onChange={setScheduleId} placeholder={dojoId ? 'Pilih sesi latihan' : 'Pilih dojo dulu'}
          options={(schedules.data ?? []).map((s) => ({ value: s.id, label: `${formatShortDate(s.session_date)} · ${s.title}` }))} />
      </div>
      {!dojoId || !scheduleId ? <EmptyState title="Pilih dojo dan sesi latihan" description="Daftar atlet aktif akan muncul setelah sesi dipilih." />
        : athletes.loading || existing.loading ? <Spinner />
        : athletes.error || existing.error ? <ErrorState message={(athletes.error ?? existing.error)!} onRetry={() => { athletes.reload(); existing.reload() }} />
        : (athletes.data ?? []).length === 0 ? <EmptyState title="Belum ada atlet aktif di dojo ini" />
        : (<>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
              <p className="text-sm text-ink-700">{schedule ? `${schedule.title} · ${formatShortDate(schedule.session_date)} · ${formatTime(schedule.start_time)}` : ''}</p>
              <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => markAll('present')}>Tandai semua hadir</Button>
                <Button size="sm" loading={saving} disabled={dirty.length === 0} onClick={() => void save()}>Simpan{dirty.length ? ` (${dirty.length})` : ''}</Button></div>
            </div>
            <ul className="divide-y divide-ink-100">
              {athletes.data!.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium">{a.full_name}</span>
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Kehadiran ${a.full_name}`}>
                    {options(attendanceLabel).map((o) => (
                      <button key={o.value} role="radio" aria-checked={draft[a.id] === o.value} onClick={() => setDraft((d) => ({ ...d, [a.id]: o.value as AttendanceStatus }))}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${draft[a.id] === o.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-100'}`}>{o.label}</button>
                    ))}
                  </div>
                </li>))}
            </ul>
          </>)}
    </Card>
  )
}

function History() {
  const access = useAccess()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const hist = useAsync(() => attendanceHistory({ dojoId: dojoId || undefined, limit: 500 }), [dojoId])
  const s = hist.data ? summarize(hist.data) : null
  return (
    <Card className="!p-0">
      <div className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterSelect label="Filter dojo" value={dojoId} onChange={setDojoId} placeholder="Semua dojo" options={access.dojos.map((d) => ({ value: d.id, label: d.name }))} />
        {s && s.total > 0 && <p className="text-sm text-ink-700">Tingkat kehadiran <strong>{s.rate}%</strong> · {s.present} hadir · {s.late} terlambat · {s.excused} izin · {s.absent} alpa ({s.total} catatan)</p>}
      </div>
      <DataTable columns={[
        { key: 'd', header: 'Tanggal', render: (r) => formatShortDate(r.training_schedules?.session_date) },
        { key: 'a', header: 'Atlet', render: (r) => r.athletes?.full_name ?? '—' },
        { key: 's', header: 'Sesi', render: (r) => r.training_schedules?.title ?? '—' },
        { key: 'dj', header: 'Dojo', render: (r) => access.dojoName(r.dojo_id) },
        { key: 'st', header: 'Status', render: (r) => <Badge tone={toneFor.attendance(r.status)} icon={attendanceIcon(r.status)}>{attendanceLabel[r.status]}</Badge> },
      ]} rows={hist.data} rowKey={(r) => r.id} loading={hist.loading} error={hist.error} onRetry={hist.reload} empty={{ title: 'Belum ada catatan kehadiran' }} />
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { scheduleStatusLabel, toneFor } from '../../utils/labels'
import { formatTime } from '../../utils/format'
import type { TrainingSchedule } from '../../types/database'

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** Kalender bulanan dari data jadwal nyata. Klik tanggal untuk melihat sesi pada hari itu. */
export function ScheduleCalendar({ cursor, onCursor, rows, loading, error, onRetry, renderActions, dojoName }: {
  cursor: { y: number; m: number }
  onCursor: (c: { y: number; m: number }) => void
  rows: TrainingSchedule[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  renderActions: (s: TrainingSchedule) => React.ReactNode
  dojoName: (id: string) => string
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selected, setSelected] = useState<string>(todayStr)
  const { y, m } = cursor
  const first = new Date(y, m, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const cells = Math.ceil((offset + days) / 7) * 7
  const byDate = useMemo(() => {
    const map: Record<string, TrainingSchedule[]> = {}
    for (const s of rows ?? []) (map[s.session_date] ??= []).push(s)
    return map
  }, [rows])
  const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(first)
  const shift = (d: number) => { const t = new Date(y, m + d, 1); onCursor({ y: t.getFullYear(), m: t.getMonth() }) }
  const dayRows = byDate[selected] ?? []

  if (error) return <div className="p-4"><ErrorState message={error} onRetry={onRetry} /></div>

  return (
    <div className="p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold capitalize text-ink-900" aria-live="polite">{label}</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" aria-label="Bulan sebelumnya" icon={<ChevronLeft size={16} />} onClick={() => shift(-1)} />
          <Button size="sm" variant="secondary" onClick={() => { const t = new Date(); onCursor({ y: t.getFullYear(), m: t.getMonth() }); setSelected(todayStr) }}>Hari ini</Button>
          <Button size="sm" variant="secondary" aria-label="Bulan berikutnya" icon={<ChevronRight size={16} />} onClick={() => shift(1)} />
        </div>
      </div>
      {loading && !rows ? <Skeleton className="h-64" /> : (
        <div role="grid" aria-label={`Kalender ${label}`} className="grid grid-cols-7 gap-1">
          {DAYS.map((d) => <div key={d} role="columnheader" className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">{d}</div>)}
          {Array.from({ length: cells }, (_, i) => {
            const day = i - offset + 1
            if (day < 1 || day > days) return <div key={i} role="gridcell" aria-hidden="true" />
            const key = iso(y, m, day)
            const n = byDate[key]?.length ?? 0
            const isSel = key === selected
            const isToday = key === todayStr
            return (
              <button key={i} type="button" role="gridcell" aria-selected={isSel} aria-label={`${day} ${label}, ${n ? `${n} sesi` : 'tidak ada sesi'}`}
                onClick={() => setSelected(key)}
                className={`relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm transition sm:min-h-14 ${isSel ? 'border-brand-600 bg-brand-600 text-white' : isToday ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-transparent hover:bg-ink-100'}`}>
                <span className="font-semibold">{day}</span>
                {n > 0 && <span className={`mt-0.5 rounded-full px-1.5 text-[10px] font-bold leading-4 ${isSel ? 'bg-white/25 text-white' : 'bg-teal-100 text-teal-800'}`}>{n} sesi</span>}
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-4 border-t border-ink-100 pt-4">
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Sesi pada {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(selected + 'T00:00:00'))}</h3>
        {dayRows.length === 0 ? <EmptyState title="Tidak ada sesi" description="Tidak ada jadwal latihan pada tanggal ini." /> : (
          <ul className="space-y-2">
            {dayRows.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-lg border border-ink-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{s.title}</p>
                  <p className="text-xs text-ink-500">{formatTime(s.start_time)}–{formatTime(s.end_time)} · {dojoName(s.dojo_id)}{s.location ? ` · ${s.location}` : ''}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1"><Badge tone={toneFor.status(s.status)}>{scheduleStatusLabel[s.status]}</Badge>{renderActions(s)}</div>
              </li>))}
          </ul>)}
      </div>
    </div>
  )
}

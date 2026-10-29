import { Link } from 'react-router-dom'
import { Check, ClipboardCheck, Medal as MedalIcon, Trophy, Users, CalendarDays } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ActivityItem, WeekPoint } from '../../services/dashboard'
import type { BeltRank, Medal } from '../../types/database'
import { BELTS, beltLabel, medalLabel } from '../../utils/labels'
import { formatRelative } from '../../utils/format'
import { EmptyState } from '../../components/ui/States'
import { useCountUp } from '../../hooks/useCountUp'

export function CountUp({ value }: { value: number }) {
  const v = useCountUp(value)
  return <span aria-label={String(value)}>{v.toLocaleString('id-ID')}</span>
}

/** Tangga sabuk: jumlah atlet per tingkat, dengan warna sabuk yang sebenarnya. Angka selalu ditampilkan sebagai teks. */
export function BeltLadder({ belts, action }: { belts: Record<BeltRank, number>; action?: ReactNode }) {
  const total = BELTS.reduce((s, b) => s + belts[b], 0)
  const max = Math.max(1, ...BELTS.map((b) => belts[b]))
  if (total === 0) return <EmptyState icon={<Users size={22} />} title="Belum ada atlet" description="Tangga sabuk muncul setelah atlet pertama ditambahkan." action={action} />
  return (
    <ul className="space-y-2.5" aria-label="Jumlah atlet per tingkat sabuk">
      {[...BELTS].reverse().map((b) => (
        <li key={b} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="text-ink-700">{beltLabel[b]}</span>
          <span className="h-3 overflow-hidden rounded-full bg-ink-100">
            <span className="block h-full rounded-full ring-1 ring-inset ring-ink-900/10 transition-[width] duration-700 ease-out"
              style={{ width: belts[b] ? `${Math.max(6, (belts[b] / max) * 100)}%` : '0%', background: `var(--color-belt-${b})` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{belts[b]}</span>
        </li>
      ))}
    </ul>
  )
}

/** Tren kehadiran per minggu (persentase hadir + terlambat). Minggu tanpa data ditandai kosong, bukan nol. */
export function AttendanceTrend({ weeks, action }: { weeks: WeekPoint[]; action?: ReactNode }) {
  if (weeks.every((w) => w.rate === null)) return <EmptyState icon={<ClipboardCheck size={22} />} title="Belum ada data kehadiran" description="Grafik muncul setelah kehadiran pertama dicatat." action={action} />
  const summary = weeks.map((w) => `${w.label}: ${w.rate === null ? 'tidak ada data' : `${w.rate}% dari ${w.total} catatan`}`).join('; ')
  return (
    <div role="img" aria-label={`Tren kehadiran 8 minggu terakhir. ${summary}`} className="grid grid-cols-[2rem_1fr] gap-2">
      <div className="flex h-40 flex-col justify-between pb-6 text-right text-xs text-ink-500" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
      <div className="relative h-40">
        <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden="true">
          <span className="border-t border-dashed border-ink-200" /><span className="border-t border-dashed border-ink-200" /><span className="border-t border-ink-200" />
        </div>
        <div className="absolute inset-0 grid grid-cols-8 gap-1.5 sm:gap-3">
          {weeks.map((w, i) => (
            <div key={w.label + i} className="flex min-w-0 flex-col items-center" title={w.rate === null ? `${w.label}: tidak ada data` : `${w.label}: ${w.rate}% dari ${w.total} catatan`}>
              <div className="relative flex w-full flex-1 items-end justify-center pb-0">
                {w.rate === null
                  ? <span className="mb-0 h-1 w-full max-w-9 rounded-full bg-ink-200" />
                  : <span className={`flex w-full max-w-9 items-start justify-center rounded-t-lg pt-1 text-xs font-semibold text-white transition-[height] duration-700 ease-out ${w.rate >= 75 ? 'bg-teal-600' : w.rate >= 50 ? 'bg-brand-600' : 'bg-violet-600'}`}
                      style={{ height: `${Math.max(w.rate, 6)}%` }}>{w.rate >= 22 ? w.rate : ''}</span>}
              </div>
              <span className="h-6 pt-1.5 text-[11px] leading-none text-ink-500">{i % 2 === 1 || weeks.length < 6 ? w.label : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const medalStyle: Record<Exclude<Medal, 'none'>, { chip: string; ring: string }> = {
  gold: { chip: 'bg-amber-50 text-amber-700', ring: 'ring-amber-200' },
  silver: { chip: 'bg-ink-100 text-ink-700', ring: 'ring-ink-200' },
  bronze: { chip: 'bg-orange-50 text-orange-800', ring: 'ring-orange-200' },
}
export function MedalSummary({ medals, action }: { medals: Record<Medal, number>; action?: ReactNode }) {
  const total = medals.gold + medals.silver + medals.bronze
  if (total === 0 && medals.none === 0) return <EmptyState icon={<MedalIcon size={22} />} title="Belum ada prestasi" description="Catat hasil kompetisi atlet untuk melihat ringkasan medali." action={action} />
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {(['gold', 'silver', 'bronze'] as const).map((m) => (
          <div key={m} className={`rounded-xl p-3 text-center ring-1 ${medalStyle[m].chip} ${medalStyle[m].ring}`}>
            <MedalIcon size={18} className="mx-auto" aria-hidden="true" />
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{medals[m]}</p>
            <p className="text-xs font-medium">{medalLabel[m]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">{total} medali dari {total + medals.none} catatan prestasi.</p>
    </div>
  )
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Penanda tanggal: angka hari + bulan singkat. */
export function DateTile({ date, tone = 'blue' }: { date: string; tone?: 'blue' | 'teal' }) {
  const [, m, d] = date.slice(0, 10).split('-').map(Number)
  return (
    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${tone === 'teal' ? 'bg-teal-50 text-teal-700' : 'bg-brand-50 text-brand-700'}`} aria-hidden="true">
      <span className="font-display text-xl font-semibold leading-none">{d}</span>
      <span className="mt-0.5 text-xs font-semibold">{months[m - 1]}</span>
    </div>
  )
}

const activityIcon = { athlete: Users, schedule: CalendarDays, achievement: MedalIcon, competition: Trophy } as const
const activityTone = { athlete: 'bg-brand-50 text-brand-600', schedule: 'bg-teal-50 text-teal-600', achievement: 'bg-amber-50 text-amber-600', competition: 'bg-violet-50 text-violet-600' } as const
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <EmptyState icon={<Check size={22} />} title="Belum ada aktivitas" description="Aktivitas muncul saat atlet, jadwal, kompetisi, atau prestasi ditambahkan." />
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const Icon = activityIcon[a.kind]
        return (
          <li key={a.id} className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activityTone[a.kind]}`} aria-hidden="true"><Icon size={16} /></span>
            <div className="min-w-0">
              <p className="break-words text-sm text-ink-900">{a.text}</p>
              <p className="text-xs text-ink-500"><time dateTime={a.at}>{formatRelative(a.at)}</time></p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="rounded text-sm font-semibold text-brand-700 hover:underline">{children}</Link>
}

import { Link } from 'react-router-dom'
import { Building2, CalendarDays, ClipboardCheck, MapPin, Plus, School, Trophy, UserCog, UserRound, Users, Wallet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { loadDashboard, type ScheduleWithCoach } from '../../services/dashboard'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { CardsSkeleton, EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { formatRupiah, formatShortDate, formatTime, greetingFor } from '../../utils/format'
import { competitionStatusLabel, scheduleStatusLabel, toneFor } from '../../utils/labels'
import { ActivityFeed, AttendanceTrend, BeltLadder, CountUp, DateTile, MedalSummary, SectionLink } from './widgets'

function Hero({ next }: { next?: ScheduleWithCoach }) {
  const { profile, user } = useAuth()
  const access = useAccess()
  const name = (profile?.full_name || user?.email || '').split(' ')[0]
  const orgs = access.organizations
  const context = orgs.length === 1 ? orgs[0].name : orgs.length > 1 ? `${orgs.length} organisasi` : null

  let lead = 'Mulai dengan membuat organisasi, atau ajukan permohonan bergabung ke dojo yang sudah ada.'
  let primary = <Link to="/organisasi"><Button icon={<Building2 size={16} />}>Buat organisasi</Button></Link>
  let secondary = <Link to="/dojo/gabung"><Button variant="secondary" className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20">Gabung ke dojo</Button></Link>
  if (access.anyStaff) {
    lead = 'Pantau aktivitas dojo dan perkembangan atletmu hari ini.'
    primary = <Link to="/kehadiran"><Button icon={<ClipboardCheck size={16} />}>Catat kehadiran</Button></Link>
    secondary = <Link to="/jadwal"><Button variant="secondary" className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20" icon={<Plus size={16} />}>Buat jadwal</Button></Link>
  } else if (access.adminOrgs.length > 0 && access.dojos.length === 0) {
    lead = 'Organisasimu sudah siap. Tambahkan dojo pertama untuk mulai mengelola atlet dan jadwal latihan.'
    primary = <Link to="/dojo?baru=1"><Button icon={<School size={16} />}>Buat dojo</Button></Link>
    secondary = <Link to="/organisasi"><Button variant="secondary" className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20">Lihat organisasi</Button></Link>
  } else if (access.isParticipant) {
    lead = 'Lihat jadwal latihan dan perkembangan prestasimu di sini.'
    primary = <Link to="/jadwal"><Button icon={<CalendarDays size={16} />}>Lihat jadwal latihan</Button></Link>
    secondary = <Link to="/prestasi"><Button variant="secondary" className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20">Prestasi</Button></Link>
  }

  return (
    <section aria-labelledby="sapaan" className="relative overflow-hidden rounded-3xl bg-ink-900 p-5 text-white shadow-(--shadow-lift) sm:p-8">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 800 300" preserveAspectRatio="xMaxYMid slice">
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#14B8A6" /></linearGradient>
          <radialGradient id="hglow" cx=".85" cy=".1" r=".8"><stop offset="0" stopColor="#3B82F6" stopOpacity=".4" /><stop offset="1" stopColor="#111827" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="800" height="300" fill="url(#hglow)" />
        <path d="M520 340 820-40" stroke="url(#hg)" strokeWidth="46" strokeLinecap="round" opacity=".75" />
        <path d="M610 360 900 0" stroke="#8B5CF6" strokeWidth="18" strokeLinecap="round" opacity=".5" />
        <path d="M440 330 680 30" stroke="#F8FAFC" strokeWidth="8" strokeLinecap="round" opacity=".14" />
      </svg>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h1 id="sapaan" className="text-2xl font-semibold leading-tight sm:text-3xl">{greetingFor()}{name ? `, ${name}` : ''}</h1>
          {(context || !access.loading) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-300">
              {context && <span className="inline-flex items-center gap-1.5"><Building2 size={14} aria-hidden="true" />{context}</span>}
              {!access.loading && <Badge tone="blue">{access.roleLabel}</Badge>}
            </p>
          )}
          <p className="mt-3 max-w-md text-base text-ink-200">{lead}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row [&_button]:w-full sm:[&_button]:w-auto">{primary}{secondary}</div>
        </div>
        {next && (
          <Link to="/jadwal" className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur transition hover:bg-white/15 lg:w-72">
            <DateTile date={next.session_date} />
            <div className="min-w-0">
              <p className="text-xs text-ink-300">Sesi berikutnya</p>
              <p className="truncate text-sm font-semibold">{next.title}</p>
              <p className="truncate text-xs text-ink-300">{formatTime(next.start_time)}–{formatTime(next.end_time)}{next.location ? ` · ${next.location}` : ''}</p>
            </div>
          </Link>
        )}
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const access = useAccess()
  const { data, loading, error, reload } = useAsync(loadDashboard, [])
  const canStaff = access.anyStaff
  const addAthlete = canStaff ? <Link to="/atlet"><Button size="sm" icon={<Plus size={14} />}>Tambah atlet</Button></Link> : undefined

  return (
    <div className="space-y-6">
      <Hero next={data?.upcomingSchedules[0]} />

      {error ? <Card><ErrorState message={error} onRetry={reload} /></Card> : loading || !data ? (
        <>
          <CardsSkeleton />
          <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-72 rounded-(--radius-card) lg:col-span-2" /><Skeleton className="h-72 rounded-(--radius-card)" /></div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard accent="blue" label="Atlet" value={<CountUp value={data.counts.athletes} />} icon={<Users size={20} />}
              hint={data.counts.athletes ? `${data.counts.activeAthletes} berstatus aktif` : 'Belum ada atlet'} />
            <StatCard accent="teal" label="Dojo" value={<CountUp value={data.counts.dojos} />} icon={<School size={20} />}
              hint={`${data.counts.organizations} organisasi`} />
            <StatCard accent="violet" label="Pelatih" value={<CountUp value={data.counts.coaches} />} icon={<UserCog size={20} />} hint={data.counts.coaches ? undefined : 'Belum ada pelatih'} />
            <StatCard accent="amber" label="Jadwal mendatang" value={<CountUp value={data.counts.upcomingSchedules} />} icon={<CalendarDays size={20} />}
              hint={data.counts.upcomingSchedules ? 'Sesi belum dibatalkan' : 'Belum ada jadwal'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Jadwal latihan mendatang" className="lg:col-span-2" action={<SectionLink to="/jadwal">Semua jadwal</SectionLink>}>
              {data.upcomingSchedules.length === 0 ? (
                <EmptyState icon={<CalendarDays size={22} />} title="Belum ada jadwal mendatang"
                  description={canStaff ? 'Buat sesi latihan agar atlet tahu kapan harus datang.' : 'Jadwal akan muncul di sini setelah pelatih membuatnya.'}
                  action={canStaff ? <Link to="/jadwal"><Button icon={<Plus size={16} />}>Buat jadwal</Button></Link> : undefined} />
              ) : (
                <ul className="-my-1 divide-y divide-ink-100">
                  {data.upcomingSchedules.map((s) => (
                    <li key={s.id} className="flex items-center gap-3.5 py-3">
                      <DateTile date={s.session_date} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words text-sm font-semibold">{s.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                          <span>{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                          {s.location && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{s.location}</span>}
                          {s.coaches && <span className="inline-flex items-center gap-1"><UserRound size={12} aria-hidden="true" />{s.coaches.full_name}</span>}
                        </p>
                        <p className="truncate text-xs text-ink-400">{access.dojoName(s.dojo_id)}</p>
                      </div>
                      <Badge tone={toneFor.status(s.status)}>{scheduleStatusLabel[s.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Atlet per tingkat sabuk" action={<SectionLink to="/atlet">Kelola</SectionLink>}>
              <BeltLadder belts={data.belts} action={addAthlete} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Tren kehadiran, 8 minggu terakhir" className="lg:col-span-2" action={<SectionLink to="/kehadiran">Riwayat</SectionLink>}>
              <AttendanceTrend weeks={data.attendanceWeeks}
                action={canStaff ? <Link to="/kehadiran"><Button size="sm" icon={<ClipboardCheck size={14} />}>Catat kehadiran</Button></Link> : undefined} />
              {data.attendance.total > 0 && (
                <p className="mt-3 text-xs text-ink-500">Bulan ini: <strong className="text-ink-900">{data.attendance.rate}%</strong> hadir ({data.attendance.present} hadir, {data.attendance.late} terlambat, {data.attendance.excused} izin, {data.attendance.absent} alpa).</p>
              )}
            </Card>
            <Card title="Ringkasan prestasi" action={<SectionLink to="/prestasi">Semua</SectionLink>}>
              <MedalSummary medals={data.medals} action={canStaff ? <Link to="/prestasi"><Button size="sm" icon={<Plus size={14} />}>Catat prestasi</Button></Link> : undefined} />
              {data.recentAchievements.length > 0 && (
                <ul className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
                  {data.recentAchievements.slice(0, 3).map((a) => (
                    <li key={a.id} className="py-2.5">
                      <p className="truncate text-sm font-medium">{a.athletes?.full_name ?? 'Atlet'}</p>
                      <p className="truncate text-xs text-ink-500">{a.result ?? a.event_name ?? 'Prestasi'} · {a.year}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Aktivitas terbaru" className="lg:col-span-2"><ActivityFeed items={data.activity} /></Card>
            <div className="space-y-6">
              <Card title="Kompetisi mendatang" action={<SectionLink to="/kompetisi">Semua</SectionLink>}>
                {data.upcomingCompetitions.length === 0 ? <EmptyState icon={<Trophy size={22} />} title="Belum ada kompetisi mendatang" /> : (
                  <ul className="-my-1 divide-y divide-ink-100">
                    {data.upcomingCompetitions.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-3">
                        <DateTile date={c.start_date} tone="teal" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-semibold">{c.name}</p>
                          <p className="truncate text-xs text-ink-500">{c.location ?? access.orgName(c.organization_id)}</p>
                          <p className="text-xs text-ink-400">{formatShortDate(c.start_date)} · {competitionStatusLabel[c.status]}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {data.payments.canView && (
                <Card title="Iuran bulan ini" action={<SectionLink to="/pembayaran">Detail</SectionLink>}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600" aria-hidden="true"><Wallet size={20} /></span>
                    <div>
                      <p className="font-display text-xl font-semibold tabular-nums">{formatRupiah(data.payments.paidThisMonth)}</p>
                      <p className="text-xs text-ink-500">Dicatat lunas · {data.payments.pendingCount} belum lunas</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-ink-400">Berdasarkan pencatatan manual pengelola.</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

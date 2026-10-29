import { supabase } from '../lib/supabase'
import type { Achievement, BeltRank, Competition, Medal, TrainingSchedule } from '../types/database'
import { monthStartISO, parseDate, todayISO, toISODate, weekStart } from '../utils/format'

export type ScheduleWithCoach = TrainingSchedule & { coaches: { full_name: string } | null }
export interface ActivityItem { id: string; kind: 'athlete' | 'schedule' | 'achievement' | 'competition'; text: string; at: string }
export interface WeekPoint { label: string; rate: number | null; total: number }

export interface DashboardData {
  counts: { organizations: number; dojos: number; athletes: number; activeAthletes: number; coaches: number; upcomingSchedules: number }
  upcomingSchedules: ScheduleWithCoach[]
  upcomingCompetitions: Competition[]
  recentAchievements: (Achievement & { athletes: { full_name: string } | null })[]
  belts: Record<BeltRank, number>
  medals: Record<Medal, number>
  attendanceWeeks: WeekPoint[]
  attendance: { total: number; present: number; late: number; excused: number; absent: number; rate: number }
  activity: ActivityItem[]
  payments: { canView: boolean; paidThisMonth: number; pendingCount: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filter = (q: any) => any

async function count(table: string, apply?: Filter): Promise<number> {
  const base = supabase.from(table).select('*', { count: 'exact', head: true })
  const { count: c, error } = await (apply ? apply(base) : base)
  if (error) throw error
  return c ?? 0
}

const WEEKS = 8

/** Semua angka berasal dari query Supabase dan otomatis disaring RLS sesuai hak akses pengguna. */
export async function loadDashboard(): Promise<DashboardData> {
  const today = todayISO()
  const monthStart = monthStartISO()
  const since = new Date(); since.setDate(since.getDate() - WEEKS * 7)
  const [orgs, dojos, athletesN, coaches, upcomingN, schedules, comps, ach, athletes, attendance, pay, newAthletes, newSchedules, newComps] = await Promise.all([
    count('organizations'), count('dojos'), count('athletes'), count('coaches'),
    count('training_schedules', (q) => q.gte('session_date', today).neq('status', 'cancelled')),
    supabase.from('training_schedules').select('*, coaches(full_name)').gte('session_date', today).neq('status', 'cancelled').order('session_date').order('start_time').limit(5),
    supabase.from('competitions').select('*').gte('start_date', today).neq('status', 'cancelled').order('start_date').limit(4),
    supabase.from('achievements').select('*, athletes(full_name)').order('created_at', { ascending: false }).limit(300),
    supabase.from('athletes').select('belt_rank, status').limit(5000),
    supabase.from('attendance').select('status, created_at, training_schedules(session_date)').gte('created_at', since.toISOString()).limit(5000),
    supabase.from('payments').select('amount, status, period').gte('period', monthStart),
    supabase.from('athletes').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('training_schedules').select('id, title, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('competitions').select('id, name, created_at').order('created_at', { ascending: false }).limit(3),
  ])
  for (const r of [schedules, comps, ach, athletes, attendance, pay, newAthletes, newSchedules, newComps]) if (r.error) throw r.error

  // Sabuk & status atlet
  const belts: Record<BeltRank, number> = { putih: 0, kuning: 0, oranye: 0, hijau: 0, biru: 0, cokelat: 0, hitam: 0 }
  let activeAthletes = 0
  for (const a of (athletes.data ?? []) as { belt_rank: BeltRank; status: string }[]) { belts[a.belt_rank]++; if (a.status === 'active') activeAthletes++ }

  // Medali
  const achRows = (ach.data ?? []) as unknown as (Achievement & { athletes: { full_name: string } | null })[]
  const medals: Record<Medal, number> = { gold: 0, silver: 0, bronze: 0, none: 0 }
  for (const a of achRows) medals[a.medal]++

  // Kehadiran: ringkasan 8 minggu + tren per minggu (berdasarkan tanggal sesi)
  type AttRow = { status: 'present' | 'late' | 'excused' | 'absent'; created_at: string; training_schedules: { session_date: string } | null }
  const attRows = (attendance.data ?? []) as unknown as AttRow[]
  const thisWeek = weekStart(new Date())
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek); start.setDate(start.getDate() - (WEEKS - 1 - i) * 7)
    return { key: toISODate(start), start, ok: 0, total: 0 }
  })
  const monthRows: AttRow[] = []
  for (const r of attRows) {
    const d = r.training_schedules?.session_date ? parseDate(r.training_schedules.session_date) : new Date(r.created_at)
    const b = buckets.find((x) => x.key === toISODate(weekStart(d)))
    if (b) { b.total++; if (r.status === 'present' || r.status === 'late') b.ok++ }
    if (toISODate(d) >= monthStart) monthRows.push(r)
  }
  const n = (s: string) => monthRows.filter((r) => r.status === s).length
  const total = monthRows.length
  const labelFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })

  // Aktivitas terbaru — hanya dari data nyata
  const activity: ActivityItem[] = [
    ...((newAthletes.data ?? []) as { id: string; full_name: string; created_at: string }[]).map((r) => ({ id: `a-${r.id}`, kind: 'athlete' as const, text: `Atlet baru ditambahkan: ${r.full_name}`, at: r.created_at })),
    ...((newSchedules.data ?? []) as { id: string; title: string; created_at: string }[]).map((r) => ({ id: `s-${r.id}`, kind: 'schedule' as const, text: `Jadwal latihan dibuat: ${r.title}`, at: r.created_at })),
    ...((newComps.data ?? []) as { id: string; name: string; created_at: string }[]).map((r) => ({ id: `c-${r.id}`, kind: 'competition' as const, text: `Kompetisi dibuat: ${r.name}`, at: r.created_at })),
    ...achRows.slice(0, 5).map((r) => ({ id: `p-${r.id}`, kind: 'achievement' as const, text: `Prestasi dicatat: ${r.athletes?.full_name ?? 'Atlet'}${r.result ? ` — ${r.result}` : ''}`, at: r.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)

  const payRows = (pay.data ?? []) as { amount: number; status: string }[]

  return {
    counts: { organizations: orgs, dojos, athletes: athletesN, activeAthletes, coaches, upcomingSchedules: upcomingN },
    upcomingSchedules: (schedules.data ?? []) as unknown as ScheduleWithCoach[],
    upcomingCompetitions: (comps.data ?? []) as Competition[],
    recentAchievements: achRows.slice(0, 5),
    belts, medals,
    attendanceWeeks: buckets.map((b) => ({ label: labelFmt.format(b.start), total: b.total, rate: b.total ? Math.round((b.ok / b.total) * 100) : null })),
    attendance: { total, present: n('present'), late: n('late'), excused: n('excused'), absent: n('absent'), rate: total ? Math.round(((n('present') + n('late')) / total) * 100) : 0 },
    activity,
    payments: {
      canView: payRows.length > 0,
      paidThisMonth: payRows.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0),
      pendingCount: payRows.filter((p) => p.status === 'pending' || p.status === 'overdue').length,
    },
  }
}

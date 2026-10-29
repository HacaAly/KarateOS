import { supabase } from '../lib/supabase'
import type { Attendance, AttendanceStatus } from '../types/database'

export interface AttendanceHistoryRow extends Attendance {
  training_schedules: { title: string; session_date: string; start_time: string } | null
  athletes?: { full_name: string } | null
}

export async function listAttendanceForSchedule(scheduleId: string): Promise<Attendance[]> {
  const { data, error } = await supabase.from('attendance').select('*').eq('schedule_id', scheduleId)
  if (error) throw error
  return (data ?? []) as Attendance[]
}

/** Simpan banyak kehadiran sekaligus. Unik per (sesi, atlet) → upsert tidak membuat data ganda. */
export async function saveAttendance(dojoId: string, scheduleId: string,
  entries: { athlete_id: string; status: AttendanceStatus; notes: string | null }[]): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((e) => ({ dojo_id: dojoId, schedule_id: scheduleId, athlete_id: e.athlete_id, status: e.status, notes: e.notes }))
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'schedule_id,athlete_id' })
  if (error) throw error
}

export async function attendanceHistory(f: { athleteId?: string; dojoId?: string; limit?: number }): Promise<AttendanceHistoryRow[]> {
  let q = supabase.from('attendance')
    .select('*, training_schedules(title, session_date, start_time), athletes(full_name)')
    .order('created_at', { ascending: false })
  if (f.athleteId) q = q.eq('athlete_id', f.athleteId)
  if (f.dojoId) q = q.eq('dojo_id', f.dojoId)
  q = q.limit(f.limit ?? 200)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as AttendanceHistoryRow[]
}

export function summarize(rows: { status: AttendanceStatus }[]) {
  const total = rows.length
  const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length
  const present = count('present'), late = count('late'), excused = count('excused'), absent = count('absent')
  return { total, present, late, excused, absent, rate: total ? Math.round(((present + late) / total) * 100) : 0 }
}

import { supabase } from '../lib/supabase'
import type { ScheduleStatus, TrainingSchedule } from '../types/database'

export interface ScheduleFilter { dojoId?: string; from?: string; to?: string; status?: string; limit?: number; ascending?: boolean }
export interface ScheduleInput {
  dojo_id: string
  title: string
  session_date: string
  start_time: string
  end_time: string
  location: string | null
  coach_id: string | null
  status: ScheduleStatus
  notes: string | null
}

export async function listSchedules(f: ScheduleFilter = {}): Promise<TrainingSchedule[]> {
  let q = supabase.from('training_schedules').select('*').order('session_date', { ascending: f.ascending ?? true }).order('start_time', { ascending: f.ascending ?? true })
  if (f.dojoId) q = q.eq('dojo_id', f.dojoId)
  if (f.from) q = q.gte('session_date', f.from)
  if (f.to) q = q.lte('session_date', f.to)
  if (f.status) q = q.eq('status', f.status)
  if (f.limit) q = q.limit(f.limit)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TrainingSchedule[]
}

export async function createSchedule(input: ScheduleInput): Promise<TrainingSchedule> {
  const { data, error } = await supabase.from('training_schedules').insert(input).select('*').single()
  if (error) throw error
  return data as TrainingSchedule
}

export async function updateSchedule(id: string, patch: Omit<ScheduleInput, 'dojo_id'>): Promise<TrainingSchedule> {
  const { data, error } = await supabase.from('training_schedules').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as TrainingSchedule
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('training_schedules').delete().eq('id', id)
  if (error) throw error
}

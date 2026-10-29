import { supabase } from '../lib/supabase'
import type { Achievement, Medal } from '../types/database'

export interface AchievementRow extends Achievement {
  athletes: { full_name: string } | null
  competitions: { name: string } | null
}
export interface AchievementInput {
  athlete_id: string
  dojo_id: string
  competition_id: string | null
  event_name: string | null
  category: string | null
  result: string | null
  medal: Medal
  year: number
  notes: string | null
}

export async function listAchievements(f: { dojoId?: string; athleteId?: string; limit?: number } = {}): Promise<AchievementRow[]> {
  let q = supabase.from('achievements').select('*, athletes(full_name), competitions(name)').order('year', { ascending: false }).order('created_at', { ascending: false })
  if (f.dojoId) q = q.eq('dojo_id', f.dojoId)
  if (f.athleteId) q = q.eq('athlete_id', f.athleteId)
  if (f.limit) q = q.limit(f.limit)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as AchievementRow[]
}

export async function createAchievement(input: AchievementInput): Promise<void> {
  const { error } = await supabase.from('achievements').insert(input)
  if (error) throw error
}

export async function updateAchievement(id: string, patch: Omit<AchievementInput, 'athlete_id' | 'dojo_id'>): Promise<void> {
  const { error } = await supabase.from('achievements').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAchievement(id: string): Promise<void> {
  const { error } = await supabase.from('achievements').delete().eq('id', id)
  if (error) throw error
}

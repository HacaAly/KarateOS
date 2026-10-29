import { supabase } from '../lib/supabase'
import type { Athlete, BeltRank, AthleteStatus } from '../types/database'

export interface AthleteFilter { dojoId?: string; belt?: string; status?: string }
export interface AthleteInput {
  dojo_id: string
  full_name: string
  birth_date: string | null
  gender: 'L' | 'P' | null
  member_number: string | null
  belt_rank: BeltRank
  status: AthleteStatus
  guardian_name: string | null
  guardian_phone: string | null
}

export async function listAthletes(f: AthleteFilter = {}): Promise<Athlete[]> {
  let q = supabase.from('athletes').select('*').order('full_name')
  if (f.dojoId) q = q.eq('dojo_id', f.dojoId)
  if (f.belt) q = q.eq('belt_rank', f.belt)
  if (f.status) q = q.eq('status', f.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Athlete[]
}

export async function getAthlete(id: string): Promise<Athlete | null> {
  const { data, error } = await supabase.from('athletes').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Athlete | null
}

export async function createAthlete(input: AthleteInput): Promise<Athlete> {
  const { data, error } = await supabase.from('athletes').insert(input).select('*').single()
  if (error) throw error
  return data as Athlete
}

export async function updateAthlete(id: string, patch: Omit<AthleteInput, 'dojo_id'>): Promise<Athlete> {
  const { data, error } = await supabase.from('athletes').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Athlete
}

export async function deleteAthlete(id: string): Promise<void> {
  const { error } = await supabase.from('athletes').delete().eq('id', id)
  if (error) throw error
}

export async function linkAthleteAccount(athleteId: string, email: string, as: 'self' | 'guardian'): Promise<void> {
  const { error } = await supabase.rpc('link_athlete_account', { p_athlete: athleteId, p_email: email, p_as: as })
  if (error) throw error
}

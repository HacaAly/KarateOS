import { supabase } from '../lib/supabase'
import type { BeltRank, Coach } from '../types/database'

export interface CoachInput {
  dojo_id: string
  full_name: string
  phone: string | null
  belt_rank: BeltRank | null
  license_number: string | null
  status: 'active' | 'inactive'
}

export async function listCoaches(dojoId?: string): Promise<Coach[]> {
  let q = supabase.from('coaches').select('*').order('full_name')
  if (dojoId) q = q.eq('dojo_id', dojoId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Coach[]
}

export async function createCoach(input: CoachInput): Promise<Coach> {
  const { data, error } = await supabase.from('coaches').insert(input).select('*').single()
  if (error) throw error
  return data as Coach
}

export async function updateCoach(id: string, patch: Omit<CoachInput, 'dojo_id'>): Promise<Coach> {
  const { data, error } = await supabase.from('coaches').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Coach
}

export async function deleteCoach(id: string): Promise<void> {
  const { error } = await supabase.from('coaches').delete().eq('id', id)
  if (error) throw error
}

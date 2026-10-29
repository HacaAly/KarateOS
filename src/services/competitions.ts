import { supabase } from '../lib/supabase'
import type { Competition, CompetitionEntry, CompetitionStatus } from '../types/database'

export interface CompetitionInput {
  organization_id: string
  name: string
  organizer: string | null
  location: string | null
  start_date: string
  end_date: string | null
  category: string | null
  status: CompetitionStatus
}

export async function listCompetitions(organizationId?: string): Promise<Competition[]> {
  let q = supabase.from('competitions').select('*').order('start_date', { ascending: false })
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Competition[]
}

export async function createCompetition(input: CompetitionInput): Promise<Competition> {
  const { data, error } = await supabase.from('competitions').insert(input).select('*').single()
  if (error) throw error
  return data as Competition
}

export async function updateCompetition(id: string, patch: Omit<CompetitionInput, 'organization_id'>): Promise<Competition> {
  const { data, error } = await supabase.from('competitions').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Competition
}

export async function deleteCompetition(id: string): Promise<void> {
  const { error } = await supabase.from('competitions').delete().eq('id', id)
  if (error) throw error
}

export interface EntryRow extends CompetitionEntry { athletes: { full_name: string } | null }

export async function listEntries(competitionId: string): Promise<EntryRow[]> {
  const { data, error } = await supabase.from('competition_entries').select('*, athletes(full_name)').eq('competition_id', competitionId).order('created_at')
  if (error) throw error
  return (data ?? []) as unknown as EntryRow[]
}

export async function addEntry(competitionId: string, athleteId: string, dojoId: string, category: string | null): Promise<void> {
  const { error } = await supabase.from('competition_entries').insert({ competition_id: competitionId, athlete_id: athleteId, dojo_id: dojoId, category })
  if (error) throw error
}

export async function removeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('competition_entries').delete().eq('id', id)
  if (error) throw error
}

import { supabase } from '../lib/supabase'
import type { Dojo, DojoApplicationRow, DojoMemberRow, DojoRole, MembershipStatus, MyApplication } from '../types/database'

export interface DojoInput {
  organization_id: string
  name: string
  address: string | null
  description: string | null
  contact: string | null
  status: 'active' | 'inactive'
}

export async function getDojo(id: string): Promise<Dojo | null> {
  const { data, error } = await supabase.from('dojos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Dojo | null
}

export async function createDojo(input: DojoInput): Promise<Dojo> {
  const { data, error } = await supabase.from('dojos').insert({ ...input, name: input.name.trim() }).select('*').single()
  if (error) throw error
  return data as Dojo
}

export async function updateDojo(id: string, patch: Omit<DojoInput, 'organization_id'>): Promise<Dojo> {
  const { data, error } = await supabase.from('dojos').update({ ...patch, name: patch.name.trim() }).eq('id', id).select('*').single()
  if (error) throw error
  return data as Dojo
}

export async function deleteDojo(id: string): Promise<void> {
  const { error } = await supabase.from('dojos').delete().eq('id', id)
  if (error) throw error
}

export async function listDojoMembers(dojoId: string): Promise<DojoMemberRow[]> {
  const { data, error } = await supabase.rpc('list_dojo_members', { p_dojo: dojoId })
  if (error) throw error
  return (data ?? []) as DojoMemberRow[]
}

export async function addDojoMember(dojoId: string, email: string, role: DojoRole): Promise<void> {
  const { error } = await supabase.rpc('add_dojo_member', { p_dojo: dojoId, p_email: email, p_role: role })
  if (error) throw error
}

export async function updateDojoMemberStatus(memberId: string, status: MembershipStatus): Promise<void> {
  const { data, error } = await supabase.from('dojo_members').update({ membership_status: status }).eq('id', memberId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Anda tidak berwenang mengubah anggota ini.')
}

export async function removeDojoMember(memberId: string): Promise<void> {
  const { data, error } = await supabase.from('dojo_members').delete().eq('id', memberId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Anda tidak berwenang menghapus anggota ini.')
}

export async function listApplications(dojoId: string): Promise<DojoApplicationRow[]> {
  const { data, error } = await supabase.rpc('list_dojo_applications', { p_dojo: dojoId })
  if (error) throw error
  return (data ?? []) as DojoApplicationRow[]
}

export async function decideApplication(id: string, status: 'approved' | 'rejected'): Promise<void> {
  const { data, error } = await supabase.from('dojo_applications').update({ status }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Permohonan tidak ditemukan atau Anda tidak berwenang.')
}

export async function getDojoPublicInfo(id: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.rpc('get_dojo_public_info', { p_dojo: id })
  if (error) throw error
  const rows = (data ?? []) as { id: string; name: string }[]
  return rows[0] ?? null
}

export async function applyToDojo(dojoId: string, applicantId: string, role: 'athlete' | 'guardian', message: string | null): Promise<void> {
  const { error } = await supabase.from('dojo_applications').insert({ dojo_id: dojoId, applicant_id: applicantId, requested_role: role, message })
  if (error) throw error
}

export async function listMyApplications(userId: string): Promise<MyApplication[]> {
  const { data, error } = await supabase.from('dojo_applications')
    .select('id, dojo_id, requested_role, status, created_at').eq('applicant_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MyApplication[]
}

export async function cancelApplication(id: string): Promise<void> {
  const { error } = await supabase.from('dojo_applications').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
}

/** Jumlah atlet per dojo (hanya dojo yang atletnya dapat dilihat pengguna; disaring RLS). */
export async function athleteCountsByDojo(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('athletes').select('dojo_id').limit(5000)
  if (error) throw error
  const out: Record<string, number> = {}
  for (const r of (data ?? []) as { dojo_id: string }[]) out[r.dojo_id] = (out[r.dojo_id] ?? 0) + 1
  return out
}

export async function dojoStats(dojoId: string): Promise<{ athletes: number; coaches: number; upcoming: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const [a, c, s] = await Promise.all([
    supabase.from('athletes').select('*', { count: 'exact', head: true }).eq('dojo_id', dojoId),
    supabase.from('coaches').select('*', { count: 'exact', head: true }).eq('dojo_id', dojoId),
    supabase.from('training_schedules').select('*', { count: 'exact', head: true }).eq('dojo_id', dojoId).gte('session_date', today).neq('status', 'cancelled'),
  ])
  for (const r of [a, c, s]) if (r.error) throw r.error
  return { athletes: a.count ?? 0, coaches: c.count ?? 0, upcoming: s.count ?? 0 }
}

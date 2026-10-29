import { supabase } from '../lib/supabase'
import type { Dojo, Organization, OrganizationMemberRow, OrgRole } from '../types/database'
import { randomSuffix, slugify } from '../utils/format'

export async function getOrganization(id: string): Promise<Organization | null> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Organization | null
}

export async function createOrganization(userId: string, input: { name: string; description: string | null }): Promise<Organization> {
  const slug = `${slugify(input.name) || 'organisasi'}-${randomSuffix(5)}`
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name: input.name.trim(), description: input.description, slug, created_by: userId })
    .select('*').single()
  if (error) throw error
  return data as Organization
}

export async function updateOrganization(id: string, patch: { name: string; description: string | null; status: 'active' | 'inactive' }): Promise<Organization> {
  const { data, error } = await supabase.from('organizations').update({ ...patch, name: patch.name.trim() }).eq('id', id).select('*').single()
  if (error) throw error
  return data as Organization
}

export async function deleteOrganization(id: string): Promise<void> {
  const { error } = await supabase.from('organizations').delete().eq('id', id)
  if (error) throw error
}

export async function listOrgMembers(orgId: string): Promise<OrganizationMemberRow[]> {
  const { data, error } = await supabase.rpc('list_organization_members', { p_org: orgId })
  if (error) throw error
  return (data ?? []) as OrganizationMemberRow[]
}

export async function addOrgMember(orgId: string, email: string, role: OrgRole): Promise<void> {
  const { error } = await supabase.rpc('add_organization_member', { p_org: orgId, p_email: email, p_role: role })
  if (error) throw error
}

export async function updateOrgMemberRole(memberId: string, role: OrgRole): Promise<void> {
  const { data, error } = await supabase.from('organization_members').update({ role }).eq('id', memberId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Anda tidak berwenang mengubah peran ini.')
}

export async function removeOrgMember(memberId: string): Promise<void> {
  const { data, error } = await supabase.from('organization_members').delete().eq('id', memberId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Anda tidak berwenang menghapus anggota ini.')
}

export async function listOrgDojos(orgId: string): Promise<Dojo[]> {
  const { data, error } = await supabase.from('dojos').select('*').eq('organization_id', orgId).order('name')
  if (error) throw error
  return (data ?? []) as Dojo[]
}

export type OrganizationDeletePreview = { dojos: number; athletes: number; coaches: number; schedules: number; payments: number; achievements: number; competitions: number; members: number }
export async function organizationDeletePreview(id: string): Promise<OrganizationDeletePreview> {
  const { data, error } = await supabase.rpc('organization_delete_preview', { p_org: id })
  if (error) throw error
  return data as OrganizationDeletePreview
}
/** Hapus organisasi beserta dojo & seluruh isinya dalam satu transaksi (hanya Owner). */
export async function deleteOrganizationCascade(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_organization_cascade', { p_org: id })
  if (error) throw error
}

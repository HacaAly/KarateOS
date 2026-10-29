import { supabase } from '../lib/supabase'
import type { Dojo, DojoRole, MembershipStatus, OrgRole, Organization } from '../types/database'

export interface DojoMembershipLite { dojo_id: string; role: DojoRole; membership_status: MembershipStatus }

export interface AccessData {
  isPlatformAdmin: boolean
  orgRoles: Record<string, OrgRole>
  dojoMemberships: DojoMembershipLite[]
  coachDojoIds: string[]
  dojos: Dojo[]
  organizations: Organization[]
}

/** Memuat seluruh konteks hak akses pengguna. Semua query disaring RLS di database. */
export async function loadAccess(userId: string): Promise<AccessData> {
  const [admin, orgM, dojoM, coachRows, dojos, orgs] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('organization_members').select('organization_id, role').eq('user_id', userId),
    supabase.from('dojo_members').select('dojo_id, role, membership_status').eq('user_id', userId),
    supabase.from('coaches').select('dojo_id').eq('user_id', userId).eq('status', 'active'),
    supabase.from('dojos').select('*').order('name'),
    supabase.from('organizations').select('*').order('name'),
  ])
  for (const r of [admin, orgM, dojoM, coachRows, dojos, orgs]) if (r.error) throw r.error

  const orgRoles: Record<string, OrgRole> = {}
  for (const r of (orgM.data ?? []) as { organization_id: string; role: OrgRole }[]) orgRoles[r.organization_id] = r.role

  return {
    isPlatformAdmin: !!admin.data,
    orgRoles,
    dojoMemberships: (dojoM.data ?? []) as DojoMembershipLite[],
    coachDojoIds: ((coachRows.data ?? []) as { dojo_id: string }[]).map((c) => c.dojo_id),
    dojos: (dojos.data ?? []) as Dojo[],
    organizations: (orgs.data ?? []) as Organization[],
  }
}

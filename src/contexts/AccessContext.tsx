import { createContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAsync } from '../hooks/useAsync'
import { loadAccess } from '../services/access'
import type { Dojo, DojoRole, Organization } from '../types/database'

export interface AccessValue {
  loading: boolean
  error: string | null
  reload: () => void
  isPlatformAdmin: boolean
  organizations: Organization[]
  dojos: Dojo[]
  dojoName: (id?: string | null) => string
  orgName: (id?: string | null) => string
  isOrgAdmin: (orgId: string) => boolean
  isOrgOwner: (orgId: string) => boolean
  canManageDojo: (dojoId: string) => boolean
  canStaffDojo: (dojoId: string) => boolean
  hasDojoRole: (role: DojoRole) => boolean
  /** Organisasi tempat pengguna owner/admin (boleh membuat dojo & kompetisi). */
  adminOrgs: Organization[]
  manageableDojos: Dojo[]
  staffDojos: Dojo[]
  anyManage: boolean
  anyStaff: boolean
  isParticipant: boolean
  /** Label peran tertinggi pengguna, untuk ditampilkan di navigasi. */
  roleLabel: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const AccessContext = createContext<AccessValue | null>(null)

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const state = useAsync(async () => (userId ? loadAccess(userId) : null), [userId])

  const value = useMemo<AccessValue>(() => {
    const d = state.data
    const organizations = d?.organizations ?? []
    const dojos = d?.dojos ?? []
    const isPlatformAdmin = d?.isPlatformAdmin ?? false
    const orgRoles = d?.orgRoles ?? {}
    const memberships = (d?.dojoMemberships ?? []).filter((m) => m.membership_status === 'active')
    const coachIds = new Set(d?.coachDojoIds ?? [])

    const isOrgAdmin = (orgId: string) => isPlatformAdmin || orgRoles[orgId] === 'owner' || orgRoles[orgId] === 'admin'
    const isOrgOwner = (orgId: string) => isPlatformAdmin || orgRoles[orgId] === 'owner'
    const dojoOrg = (dojoId: string) => dojos.find((x) => x.id === dojoId)?.organization_id
    const canManageDojo = (dojoId: string) => {
      const org = dojoOrg(dojoId)
      return (!!org && isOrgAdmin(org)) || memberships.some((m) => m.dojo_id === dojoId && m.role === 'dojo_admin')
    }
    const canStaffDojo = (dojoId: string) =>
      canManageDojo(dojoId) || coachIds.has(dojoId) || memberships.some((m) => m.dojo_id === dojoId && m.role === 'coach')
    const manageableDojos = dojos.filter((x) => canManageDojo(x.id))
    const staffDojos = dojos.filter((x) => canStaffDojo(x.id))
    const hasOwner = isPlatformAdmin || Object.values(orgRoles).includes('owner')
    const roleLabel = isPlatformAdmin ? 'Admin platform' : hasOwner ? 'Owner organisasi'
      : Object.values(orgRoles).includes('admin') ? 'Administrator organisasi'
      : manageableDojos.length > 0 ? 'Administrator dojo'
      : staffDojos.length > 0 ? 'Pelatih'
      : memberships.some((m) => m.role === 'athlete') ? 'Atlet'
      : memberships.some((m) => m.role === 'guardian') ? 'Wali atlet' : 'Anggota'
    return {
      roleLabel,
      loading: state.loading,
      error: state.error,
      reload: state.reload,
      isPlatformAdmin,
      organizations,
      dojos,
      dojoName: (id) => dojos.find((x) => x.id === id)?.name ?? '—',
      orgName: (id) => organizations.find((x) => x.id === id)?.name ?? '—',
      isOrgAdmin,
      isOrgOwner,
      canManageDojo,
      canStaffDojo,
      hasDojoRole: (role) => memberships.some((m) => m.role === role),
      adminOrgs: organizations.filter((o) => isOrgAdmin(o.id)),
      manageableDojos,
      staffDojos,
      anyManage: manageableDojos.length > 0,
      anyStaff: staffDojos.length > 0,
      isParticipant: memberships.some((m) => m.role === 'athlete' || m.role === 'guardian'),
    }
  }, [state.data, state.loading, state.error, state.reload])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

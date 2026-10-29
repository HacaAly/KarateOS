import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAccess, } from '../../hooks/useAccess'
import type { AccessValue } from '../../contexts/AccessContext'
import { EmptyState, ErrorState, Spinner } from '../ui/States'

/** Pelindung halaman di frontend. Keamanan sebenarnya tetap ditegakkan oleh RLS di database. */
export function RequireAccess({ allow, children }: { allow: (a: AccessValue) => boolean; children: ReactNode }) {
  const access = useAccess()
  if (access.loading) return <Spinner />
  if (access.error) return <ErrorState message={access.error} onRetry={access.reload} />
  if (!allow(access)) {
    return <EmptyState icon={<ShieldAlert size={22} />} title="Akses ditolak" description="Anda tidak memiliki izin untuk membuka halaman ini." />
  }
  return <>{children}</>
}

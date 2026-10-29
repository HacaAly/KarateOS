import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner, ErrorState } from '../ui/States'
import { Button } from '../ui/Button'
import { ConfigMissing } from './ConfigMissing'

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-ink-50">{children}</div>
}

export function ProtectedRoute() {
  const { configured, loading, session, profile, profileLoading, profileError, refreshProfile, signOut, recoveryMode } = useAuth()
  const location = useLocation()
  if (!configured) return <ConfigMissing />
  if (loading) return <FullScreen><Spinner label="Memeriksa sesi…" /></FullScreen>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (recoveryMode && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />
  if (profileError) {
    return (
      <FullScreen>
        <div className="max-w-md">
          <ErrorState message={profileError} onRetry={() => void refreshProfile()} />
          <div className="text-center"><Button variant="ghost" size="sm" onClick={() => void signOut()}>Keluar</Button></div>
        </div>
      </FullScreen>
    )
  }
  if (!profile && profileLoading) return <FullScreen><Spinner label="Memuat profil…" /></FullScreen>
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { configured, loading, session, recoveryMode } = useAuth()
  const location = useLocation()
  if (!configured) return <ConfigMissing />
  if (loading) return <FullScreen><Spinner label="Memeriksa sesi…" /></FullScreen>
  if (session && !recoveryMode) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }
  return <Outlet />
}

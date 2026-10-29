import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AccessProvider } from './contexts/AccessContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { RequireAccess } from './components/layout/RequireAccess'
import { EmptyState } from './components/ui/States'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProfilePage from './pages/profile/ProfilePage'
import OrganizationsPage from './pages/organizations/OrganizationsPage'
import OrganizationDetailPage from './pages/organizations/OrganizationDetailPage'
import DojosPage from './pages/dojos/DojosPage'
import DojoDetailPage from './pages/dojos/DojoDetailPage'
import JoinDojoPage from './pages/dojos/JoinDojoPage'
import AthletesPage from './pages/athletes/AthletesPage'
import AthleteDetailPage from './pages/athletes/AthleteDetailPage'
import CoachesPage from './pages/coaches/CoachesPage'
import SchedulesPage from './pages/schedules/SchedulesPage'
import AttendancePage from './pages/attendance/AttendancePage'
import CompetitionsPage from './pages/competitions/CompetitionsPage'
import AchievementsPage from './pages/achievements/AchievementsPage'
import PaymentsPage from './pages/payments/PaymentsPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/lupa-password" element={<ForgotPasswordPage />} />
            </Route>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AccessProvider><AppLayout /></AccessProvider>}>
                <Route index element={<DashboardPage />} />
                <Route path="profil" element={<ProfilePage />} />
                <Route path="organisasi" element={<OrganizationsPage />} />
                <Route path="organisasi/:id" element={<OrganizationDetailPage />} />
                <Route path="dojo" element={<DojosPage />} />
                <Route path="dojo/gabung" element={<JoinDojoPage />} />
                <Route path="dojo/:id" element={<DojoDetailPage />} />
                <Route path="atlet" element={<RequireAccess allow={(a) => a.anyStaff || a.isParticipant}><AthletesPage /></RequireAccess>} />
                <Route path="atlet/:id" element={<AthleteDetailPage />} />
                <Route path="pelatih" element={<RequireAccess allow={(a) => a.anyStaff}><CoachesPage /></RequireAccess>} />
                <Route path="jadwal" element={<SchedulesPage />} />
                <Route path="kehadiran" element={<RequireAccess allow={(a) => a.anyStaff || a.isParticipant}><AttendancePage /></RequireAccess>} />
                <Route path="kompetisi" element={<CompetitionsPage />} />
                <Route path="prestasi" element={<RequireAccess allow={(a) => a.anyStaff || a.isParticipant}><AchievementsPage /></RequireAccess>} />
                <Route path="pembayaran" element={<RequireAccess allow={(a) => a.anyManage || a.isParticipant}><PaymentsPage /></RequireAccess>} />
                <Route path="*" element={<EmptyState title="Halaman tidak ditemukan" />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

import type {
  AthleteStatus, AttendanceStatus, BeltRank, CompetitionStatus, DojoRole, EntityStatus, Medal,
  MembershipStatus, OrgRole, PaymentStatus, ScheduleStatus, ApplicationStatus,
} from '../types/database'

export type Tone = 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'purple'

export const orgRoleLabel: Record<OrgRole, string> = { owner: 'Owner', admin: 'Administrator', member: 'Anggota' }
export const dojoRoleLabel: Record<DojoRole, string> = {
  dojo_admin: 'Administrator Dojo', coach: 'Pelatih', athlete: 'Atlet', guardian: 'Wali',
}
export const membershipLabel: Record<MembershipStatus, string> = { active: 'Aktif', pending: 'Menunggu', inactive: 'Nonaktif' }
export const entityStatusLabel: Record<EntityStatus, string> = { active: 'Aktif', inactive: 'Nonaktif' }
export const athleteStatusLabel: Record<AthleteStatus, string> = { active: 'Aktif', inactive: 'Nonaktif', on_leave: 'Cuti' }
export const scheduleStatusLabel: Record<ScheduleStatus, string> = { scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan' }
export const attendanceLabel: Record<AttendanceStatus, string> = { present: 'Hadir', late: 'Terlambat', excused: 'Izin', absent: 'Alpa' }
export const competitionStatusLabel: Record<CompetitionStatus, string> = {
  upcoming: 'Akan datang', ongoing: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan',
}
export const medalLabel: Record<Medal, string> = { gold: 'Emas', silver: 'Perak', bronze: 'Perunggu', none: 'Tanpa medali' }
export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: 'Belum dibayar', paid: 'Dicatat lunas', overdue: 'Terlambat', cancelled: 'Dibatalkan',
}
export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', cancelled: 'Dibatalkan',
}
export const beltLabel: Record<BeltRank, string> = {
  putih: 'Putih', kuning: 'Kuning', oranye: 'Oranye', hijau: 'Hijau', biru: 'Biru', cokelat: 'Cokelat', hitam: 'Hitam',
}
export const BELTS = Object.keys(beltLabel) as BeltRank[]

export const toneFor = {
  status: (s: string): Tone =>
    ({ active: 'green', inactive: 'gray', on_leave: 'amber', scheduled: 'blue', completed: 'green', cancelled: 'gray',
       upcoming: 'blue', ongoing: 'green', pending: 'amber', paid: 'green', overdue: 'red', approved: 'green', rejected: 'red' } as Record<string, Tone>)[s] ?? 'gray',
  attendance: (s: AttendanceStatus): Tone => ({ present: 'green', late: 'amber', excused: 'blue', absent: 'red' } as const)[s],
  medal: (m: Medal): Tone => ({ gold: 'amber', silver: 'gray', bronze: 'purple', none: 'gray' } as const)[m],
}

export const options = <T extends string>(map: Record<T, string>) =>
  (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }))

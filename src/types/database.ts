// Tipe ini mencerminkan skema di supabase/migrations/0001_schema.sql

export type OrgRole = 'owner' | 'admin' | 'member'
export type DojoRole = 'dojo_admin' | 'coach' | 'athlete' | 'guardian'
export type MembershipStatus = 'active' | 'pending' | 'inactive'
export type BeltRank = 'putih' | 'kuning' | 'oranye' | 'hijau' | 'biru' | 'cokelat' | 'hitam'
export type EntityStatus = 'active' | 'inactive'
export type AthleteStatus = 'active' | 'inactive' | 'on_leave'
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled'
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent'
export type CompetitionStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
export type Medal = 'gold' | 'silver' | 'bronze' | 'none'
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  status: EntityStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMemberRow {
  id: string
  user_id: string
  role: OrgRole
  created_at: string
  full_name: string
  email: string | null
}

export interface Dojo {
  id: string
  organization_id: string
  name: string
  address: string | null
  description: string | null
  contact: string | null
  logo_url: string | null
  status: EntityStatus
  created_at: string
  updated_at: string
}

export interface DojoMemberRow {
  id: string
  user_id: string
  role: DojoRole
  membership_status: MembershipStatus
  joined_at: string
  full_name: string
  email: string | null
}

export interface DojoApplicationRow {
  id: string
  applicant_id: string
  requested_role: 'athlete' | 'guardian'
  message: string | null
  status: ApplicationStatus
  created_at: string
  decided_at: string | null
  full_name: string
  email: string | null
}

export interface MyApplication {
  id: string
  dojo_id: string
  requested_role: 'athlete' | 'guardian'
  status: ApplicationStatus
  created_at: string
}

export interface Athlete {
  id: string
  dojo_id: string
  user_id: string | null
  guardian_user_id: string | null
  full_name: string
  birth_date: string | null
  gender: 'L' | 'P' | null
  member_number: string | null
  belt_rank: BeltRank
  status: AthleteStatus
  photo_url: string | null
  guardian_name: string | null
  guardian_phone: string | null
  created_at: string
  updated_at: string
}

export interface Coach {
  id: string
  dojo_id: string
  user_id: string | null
  full_name: string
  phone: string | null
  belt_rank: BeltRank | null
  license_number: string | null
  status: EntityStatus
  created_at: string
  updated_at: string
}

export interface TrainingSchedule {
  id: string
  dojo_id: string
  title: string
  session_date: string
  start_time: string
  end_time: string
  location: string | null
  coach_id: string | null
  status: ScheduleStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  dojo_id: string
  schedule_id: string
  athlete_id: string
  status: AttendanceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Competition {
  id: string
  organization_id: string
  name: string
  organizer: string | null
  location: string | null
  start_date: string
  end_date: string | null
  category: string | null
  status: CompetitionStatus
  created_at: string
  updated_at: string
}

export interface CompetitionEntry {
  id: string
  competition_id: string
  athlete_id: string
  dojo_id: string
  category: string | null
  status: 'registered' | 'withdrawn'
  created_at: string
}

export interface Achievement {
  id: string
  athlete_id: string
  dojo_id: string
  competition_id: string | null
  event_name: string | null
  category: string | null
  result: string | null
  medal: Medal
  year: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  dojo_id: string
  athlete_id: string | null
  member_user_id: string | null
  period: string
  amount: number
  status: PaymentStatus
  method: string | null
  paid_at: string | null
  notes: string | null
  source: 'manual'
  created_at: string
  updated_at: string
}

-- =====================================================================
-- KarateOS — 0001: Skema tabel, constraint, dan indeks
-- Jalankan berurutan: 0001 → 0002 → 0003 → 0004
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. profiles — profil pengguna (1:1 dengan auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  avatar_url  text,
  phone       text check (phone is null or char_length(phone) <= 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Administrator platform. Tabel ini TIDAK memiliki kebijakan tulis:
-- hanya bisa diisi lewat SQL Editor / service role oleh pemilik platform.
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- B. organizations
-- ---------------------------------------------------------------------
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 3 and 120),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description  text check (description is null or char_length(description) <= 2000),
  logo_url     text,
  status       text not null default 'active' check (status in ('active', 'inactive')),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- C. organization_members
-- ---------------------------------------------------------------------
create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at       timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------
-- D. dojos
-- ---------------------------------------------------------------------
create table public.dojos (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  name             text not null check (char_length(btrim(name)) between 3 and 120),
  address          text check (address is null or char_length(address) <= 500),
  description      text check (description is null or char_length(description) <= 2000),
  contact          text check (contact is null or char_length(contact) <= 120),
  logo_url         text,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint dojos_name_unique_per_org unique (organization_id, name)
);
create index dojos_org_idx on public.dojos (organization_id);

-- ---------------------------------------------------------------------
-- E. dojo_members
-- ---------------------------------------------------------------------
create table public.dojo_members (
  id                 uuid primary key default gen_random_uuid(),
  dojo_id            uuid not null references public.dojos (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  role               text not null check (role in ('dojo_admin', 'coach', 'athlete', 'guardian')),
  membership_status  text not null default 'active' check (membership_status in ('active', 'pending', 'inactive')),
  joined_at          timestamptz not null default now(),
  constraint dojo_members_unique unique (dojo_id, user_id, role)
);
create index dojo_members_user_idx on public.dojo_members (user_id);

-- ---------------------------------------------------------------------
-- F. dojo_applications — permohonan bergabung
-- ---------------------------------------------------------------------
create table public.dojo_applications (
  id              uuid primary key default gen_random_uuid(),
  dojo_id         uuid not null references public.dojos (id) on delete cascade,
  applicant_id    uuid not null references public.profiles (id) on delete cascade,
  requested_role  text not null default 'athlete' check (requested_role in ('athlete', 'guardian')),
  message         text check (message is null or char_length(message) <= 1000),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index dojo_applications_dojo_idx on public.dojo_applications (dojo_id, status);
create index dojo_applications_applicant_idx on public.dojo_applications (applicant_id);
-- Satu permohonan pending per pengguna per dojo.
create unique index dojo_applications_one_pending
  on public.dojo_applications (dojo_id, applicant_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- G. athletes — tidak semua atlet punya akun login
-- ---------------------------------------------------------------------
create table public.athletes (
  id                uuid primary key default gen_random_uuid(),
  dojo_id           uuid not null references public.dojos (id) on delete restrict,
  user_id           uuid references public.profiles (id) on delete set null,
  guardian_user_id  uuid references public.profiles (id) on delete set null,
  full_name         text not null check (char_length(btrim(full_name)) between 2 and 120),
  birth_date        date check (birth_date is null or birth_date <= current_date),
  gender            text check (gender in ('L', 'P')),
  member_number     text check (member_number is null or char_length(member_number) <= 40),
  belt_rank         text not null default 'putih'
                    check (belt_rank in ('putih', 'kuning', 'oranye', 'hijau', 'biru', 'cokelat', 'hitam')),
  status            text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  photo_url         text,
  guardian_name     text check (guardian_name is null or char_length(guardian_name) <= 120),
  guardian_phone    text check (guardian_phone is null or char_length(guardian_phone) <= 30),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index athletes_dojo_idx on public.athletes (dojo_id);
create index athletes_user_idx on public.athletes (user_id) where user_id is not null;
create index athletes_guardian_idx on public.athletes (guardian_user_id) where guardian_user_id is not null;
create index athletes_name_idx on public.athletes (lower(full_name));
create unique index athletes_member_number_unique
  on public.athletes (dojo_id, member_number) where member_number is not null;

-- ---------------------------------------------------------------------
-- H. coaches — satu baris per (pelatih, dojo yang menjadi tanggung jawabnya)
-- ---------------------------------------------------------------------
create table public.coaches (
  id              uuid primary key default gen_random_uuid(),
  dojo_id         uuid not null references public.dojos (id) on delete restrict,
  user_id         uuid references public.profiles (id) on delete set null,
  full_name       text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone           text check (phone is null or char_length(phone) <= 30),
  belt_rank       text check (belt_rank in ('putih', 'kuning', 'oranye', 'hijau', 'biru', 'cokelat', 'hitam')),
  license_number  text check (license_number is null or char_length(license_number) <= 60),
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index coaches_dojo_idx on public.coaches (dojo_id);
create index coaches_user_idx on public.coaches (user_id) where user_id is not null;
create unique index coaches_unique_user_per_dojo on public.coaches (dojo_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- I. training_schedules
-- ---------------------------------------------------------------------
create table public.training_schedules (
  id            uuid primary key default gen_random_uuid(),
  dojo_id       uuid not null references public.dojos (id) on delete restrict,
  title         text not null check (char_length(btrim(title)) between 2 and 120),
  session_date  date not null,
  start_time    time not null,
  end_time      time not null,
  location      text check (location is null or char_length(location) <= 200),
  coach_id      uuid references public.coaches (id) on delete set null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes         text check (notes is null or char_length(notes) <= 1000),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint training_schedules_time_order check (end_time > start_time)
);
create index training_schedules_dojo_date_idx on public.training_schedules (dojo_id, session_date);
create index training_schedules_coach_idx on public.training_schedules (coach_id) where coach_id is not null;

-- ---------------------------------------------------------------------
-- J. attendance
-- ---------------------------------------------------------------------
create table public.attendance (
  id           uuid primary key default gen_random_uuid(),
  dojo_id      uuid not null references public.dojos (id) on delete restrict,
  schedule_id  uuid not null references public.training_schedules (id) on delete cascade,
  athlete_id   uuid not null references public.athletes (id) on delete cascade,
  status       text not null default 'present' check (status in ('present', 'late', 'excused', 'absent')),
  notes        text check (notes is null or char_length(notes) <= 500),
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint attendance_unique unique (schedule_id, athlete_id)
);
create index attendance_athlete_idx on public.attendance (athlete_id);
create index attendance_dojo_idx on public.attendance (dojo_id);

-- ---------------------------------------------------------------------
-- K. competitions
-- ---------------------------------------------------------------------
create table public.competitions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  name             text not null check (char_length(btrim(name)) between 3 and 160),
  organizer        text check (organizer is null or char_length(organizer) <= 160),
  location         text check (location is null or char_length(location) <= 200),
  start_date       date not null,
  end_date         date,
  category         text check (category is null or char_length(category) <= 200),
  status           text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint competitions_date_order check (end_date is null or end_date >= start_date)
);
create index competitions_org_date_idx on public.competitions (organization_id, start_date);

-- Pendaftaran atlet ke kompetisi (hubungan atlet ↔ kompetisi)
create table public.competition_entries (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions (id) on delete cascade,
  athlete_id      uuid not null references public.athletes (id) on delete cascade,
  dojo_id         uuid not null references public.dojos (id) on delete restrict,
  category        text check (category is null or char_length(category) <= 120),
  status          text not null default 'registered' check (status in ('registered', 'withdrawn')),
  registered_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint competition_entries_unique unique (competition_id, athlete_id)
);
create index competition_entries_athlete_idx on public.competition_entries (athlete_id);
create index competition_entries_dojo_idx on public.competition_entries (dojo_id);

-- ---------------------------------------------------------------------
-- L. achievements — hasil/prestasi (berbeda dari data kompetisi)
-- ---------------------------------------------------------------------
create table public.achievements (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes (id) on delete cascade,
  dojo_id         uuid not null references public.dojos (id) on delete restrict,
  competition_id  uuid references public.competitions (id) on delete set null,
  event_name      text check (event_name is null or char_length(event_name) <= 160),
  category        text check (category is null or char_length(category) <= 160),
  result          text check (result is null or char_length(result) <= 160),
  medal           text not null default 'none' check (medal in ('gold', 'silver', 'bronze', 'none')),
  year            smallint not null check (year between 1950 and 2100),
  notes           text check (notes is null or char_length(notes) <= 1000),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint achievements_has_event check (competition_id is not null or event_name is not null)
);
create index achievements_athlete_idx on public.achievements (athlete_id);
create index achievements_dojo_year_idx on public.achievements (dojo_id, year desc);
create index achievements_competition_idx on public.achievements (competition_id) where competition_id is not null;

-- ---------------------------------------------------------------------
-- M. payments — pencatatan MANUAL (bukan pemrosesan pembayaran otomatis)
-- ---------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  dojo_id         uuid not null references public.dojos (id) on delete restrict,
  athlete_id      uuid references public.athletes (id) on delete restrict,
  member_user_id  uuid references public.profiles (id) on delete set null,
  period          date not null check (extract(day from period) = 1),
  amount          numeric(12, 2) not null check (amount >= 0),
  status          text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  method          text check (method is null or char_length(method) <= 60),
  paid_at         timestamptz,
  notes           text check (notes is null or char_length(notes) <= 500),
  source          text not null default 'manual' check (source = 'manual'),
  recorded_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_has_payer check (athlete_id is not null or member_user_id is not null),
  constraint payments_paid_has_date check (status <> 'paid' or paid_at is not null)
);
create index payments_dojo_period_idx on public.payments (dojo_id, period desc);
create index payments_athlete_idx on public.payments (athlete_id) where athlete_id is not null;
create index payments_member_idx on public.payments (member_user_id) where member_user_id is not null;

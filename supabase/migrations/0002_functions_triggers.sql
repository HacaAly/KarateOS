-- =====================================================================
-- KarateOS — 0002: Fungsi bantu (SECURITY DEFINER), trigger, dan RPC
--
-- Fungsi pemeriksa peran memakai SECURITY DEFINER agar dapat membaca tabel
-- keanggotaan tanpa memicu RLS lagi → menghindari rekursi kebijakan.
-- Semua fungsi memakai search_path tetap (public) untuk mencegah pembajakan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger trg_dojos_updated before update on public.dojos
  for each row execute function public.set_updated_at();
create trigger trg_athletes_updated before update on public.athletes
  for each row execute function public.set_updated_at();
create trigger trg_coaches_updated before update on public.coaches
  for each row execute function public.set_updated_at();
create trigger trg_schedules_updated before update on public.training_schedules
  for each row execute function public.set_updated_at();
create trigger trg_attendance_updated before update on public.attendance
  for each row execute function public.set_updated_at();
create trigger trg_competitions_updated before update on public.competitions
  for each row execute function public.set_updated_at();
create trigger trg_achievements_updated before update on public.achievements
  for each row execute function public.set_updated_at();
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Pembuatan profil otomatis saat registrasi (idempotent)
-- ---------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Fungsi pemeriksa peran / akses
-- ---------------------------------------------------------------------
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.organization_members
                 where organization_id = p_org and user_id = auth.uid());
$$;

create function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.organization_members
                 where organization_id = p_org and user_id = auth.uid()
                   and role in ('owner', 'admin'));
$$;

create function public.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.organization_members
                 where organization_id = p_org and user_id = auth.uid()
                   and role = 'owner');
$$;

create function public.dojo_org(p_dojo uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.dojos where id = p_dojo;
$$;

create function public.is_dojo_member(p_dojo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dojo_members
                 where dojo_id = p_dojo and user_id = auth.uid()
                   and membership_status = 'active');
$$;

create function public.is_dojo_admin(p_dojo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dojo_members
                 where dojo_id = p_dojo and user_id = auth.uid()
                   and role = 'dojo_admin' and membership_status = 'active');
$$;

create function public.is_dojo_coach(p_dojo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dojo_members
                 where dojo_id = p_dojo and user_id = auth.uid()
                   and role = 'coach' and membership_status = 'active')
      or exists (select 1 from public.coaches
                 where dojo_id = p_dojo and user_id = auth.uid() and status = 'active');
$$;

-- Mengelola dojo: platform admin, owner/admin organisasi induk, atau admin dojo itu sendiri.
create function public.can_manage_dojo(p_dojo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_admin(public.dojo_org(p_dojo)) or public.is_dojo_admin(p_dojo);
$$;

-- Staf dojo: pengelola + pelatih yang ditugaskan.
create function public.can_staff_dojo(p_dojo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_dojo(p_dojo) or public.is_dojo_coach(p_dojo);
$$;

create function public.can_view_dojo(p_dojo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_staff_dojo(p_dojo) or public.is_dojo_member(p_dojo);
$$;

-- Organisasi terlihat oleh anggotanya, atau anggota aktif salah satu dojo di dalamnya.
create function public.can_view_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org)
      or exists (select 1
                 from public.dojo_members dm
                 join public.dojos d on d.id = dm.dojo_id
                 where dm.user_id = auth.uid()
                   and dm.membership_status = 'active'
                   and d.organization_id = p_org);
$$;

-- Atlet dapat dilihat staf dojo, akun atlet itu sendiri, atau walinya.
create function public.can_view_athlete(p_athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.athletes a
                 where a.id = p_athlete
                   and (public.can_staff_dojo(a.dojo_id)
                        or a.user_id = auth.uid()
                        or a.guardian_user_id = auth.uid()));
$$;

-- Khusus akun atlet/wali (tanpa pelatih) — dipakai untuk pembayaran.
create function public.is_athlete_self_or_guardian(p_athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.athletes a
                 where a.id = p_athlete
                   and (a.user_id = auth.uid() or a.guardian_user_id = auth.uid()));
$$;

-- Aturan penetapan peran (mencegah eskalasi hak akses).
create function public.can_assign_org_role(p_org uuid, p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_role in ('owner', 'admin')
              then public.is_org_owner(p_org)
              else public.is_org_admin(p_org) end;
$$;

create function public.can_assign_dojo_role(p_dojo uuid, p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_role = 'dojo_admin'
              then public.is_org_admin(public.dojo_org(p_dojo))
              else public.can_manage_dojo(p_dojo) end;
$$;

-- ---------------------------------------------------------------------
-- Trigger: organisasi baru → pembuatnya otomatis menjadi owner
-- ---------------------------------------------------------------------
create function public.on_organization_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.profiles (id) values (new.created_by) on conflict (id) do nothing;
    insert into public.organization_members (organization_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end if;
  return new;
end $$;

create trigger trg_organization_created after insert on public.organizations
  for each row execute function public.on_organization_created();

-- ---------------------------------------------------------------------
-- Trigger: penjaga keanggotaan organisasi
-- ---------------------------------------------------------------------
create function public.guard_org_member_update() returns trigger
language plpgsql as $$
begin
  if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
    raise exception 'Organisasi dan pengguna pada keanggotaan tidak boleh diubah.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_org_member_guard before update on public.organization_members
  for each row execute function public.guard_org_member_update();

create function public.guard_last_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if exists (select 1 from public.organizations where id = old.organization_id)
       and not exists (select 1 from public.organization_members
                       where organization_id = old.organization_id
                         and role = 'owner' and id <> old.id) then
      raise exception 'Organisasi harus memiliki minimal satu owner.' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger trg_org_member_last_owner before update or delete on public.organization_members
  for each row execute function public.guard_last_owner();

-- ---------------------------------------------------------------------
-- Trigger: dojo
-- ---------------------------------------------------------------------
create function public.guard_dojo_update() returns trigger
language plpgsql as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'Dojo tidak dapat dipindahkan ke organisasi lain.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_dojo_guard before update on public.dojos
  for each row execute function public.guard_dojo_update();

create function public.guard_dojo_member_update() returns trigger
language plpgsql as $$
begin
  if new.dojo_id <> old.dojo_id or new.user_id <> old.user_id then
    raise exception 'Dojo dan pengguna pada keanggotaan tidak boleh diubah.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_dojo_member_guard before update on public.dojo_members
  for each row execute function public.guard_dojo_member_update();

-- ---------------------------------------------------------------------
-- Trigger: permohonan bergabung dojo
-- ---------------------------------------------------------------------
create function public.dojo_application_before_insert() returns trigger
language plpgsql as $$
begin
  new.status := 'pending';
  new.decided_by := null;
  new.decided_at := null;
  return new;
end $$;

create trigger trg_dojo_app_insert before insert on public.dojo_applications
  for each row execute function public.dojo_application_before_insert();

create function public.dojo_application_before_update() returns trigger
language plpgsql as $$
begin
  if old.status <> 'pending' then
    raise exception 'Permohonan ini sudah diputuskan.' using errcode = '23514';
  end if;
  if new.dojo_id <> old.dojo_id or new.applicant_id <> old.applicant_id
     or new.requested_role <> old.requested_role or new.message is distinct from old.message then
    raise exception 'Isi permohonan tidak boleh diubah.' using errcode = '23514';
  end if;
  if new.status = 'pending' then
    return new;
  elsif new.status in ('approved', 'rejected') then
    if not public.can_manage_dojo(old.dojo_id) then
      raise exception 'Hanya pengelola dojo yang dapat memutuskan permohonan.' using errcode = '42501';
    end if;
  elsif new.status = 'cancelled' then
    if old.applicant_id <> auth.uid() then
      raise exception 'Hanya pemohon yang dapat membatalkan permohonan.' using errcode = '42501';
    end if;
  end if;
  new.decided_by := auth.uid();
  new.decided_at := now();
  return new;
end $$;

create trigger trg_dojo_app_update before update on public.dojo_applications
  for each row execute function public.dojo_application_before_update();

create function public.dojo_application_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.dojo_members (dojo_id, user_id, role, membership_status)
    values (new.dojo_id, new.applicant_id, new.requested_role, 'active')
    on conflict (dojo_id, user_id, role) do update set membership_status = 'active';
  end if;
  return new;
end $$;

create trigger trg_dojo_app_approved after update on public.dojo_applications
  for each row execute function public.dojo_application_after_update();

-- ---------------------------------------------------------------------
-- Trigger: atlet
-- ---------------------------------------------------------------------
create function public.guard_athlete() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (new.user_id is not null or new.guardian_user_id is not null)
       and not public.can_manage_dojo(new.dojo_id) then
      raise exception 'Hanya pengelola dojo yang dapat menautkan akun ke atlet.' using errcode = '42501';
    end if;
  else
    if new.dojo_id <> old.dojo_id then
      raise exception 'Atlet tidak dapat dipindahkan antardojo.' using errcode = '23514';
    end if;
    if (new.user_id is distinct from old.user_id
        or new.guardian_user_id is distinct from old.guardian_user_id)
       and not public.can_manage_dojo(new.dojo_id) then
      raise exception 'Hanya pengelola dojo yang dapat mengubah tautan akun atlet.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger trg_athlete_guard before insert or update on public.athletes
  for each row execute function public.guard_athlete();

-- ---------------------------------------------------------------------
-- Trigger: jadwal latihan
-- ---------------------------------------------------------------------
create function public.guard_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_coach_dojo uuid;
begin
  if tg_op = 'UPDATE' and new.dojo_id <> old.dojo_id then
    raise exception 'Jadwal tidak dapat dipindahkan antardojo.' using errcode = '23514';
  end if;
  if new.coach_id is not null then
    select dojo_id into v_coach_dojo from public.coaches where id = new.coach_id;
    if v_coach_dojo is null or v_coach_dojo <> new.dojo_id then
      raise exception 'Pelatih yang bertugas harus berasal dari dojo yang sama.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger trg_schedule_guard before insert or update on public.training_schedules
  for each row execute function public.guard_schedule();

-- ---------------------------------------------------------------------
-- Trigger: kehadiran (atlet & jadwal harus satu dojo; dojo_id diturunkan)
-- ---------------------------------------------------------------------
create function public.guard_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sched uuid; v_ath uuid;
begin
  select dojo_id into v_sched from public.training_schedules where id = new.schedule_id;
  select dojo_id into v_ath from public.athletes where id = new.athlete_id;
  if v_sched is null or v_ath is null or v_sched <> v_ath then
    raise exception 'Atlet dan sesi latihan harus berasal dari dojo yang sama.' using errcode = '23514';
  end if;
  new.dojo_id := v_sched;
  return new;
end $$;

create trigger trg_attendance_guard before insert or update on public.attendance
  for each row execute function public.guard_attendance();

-- ---------------------------------------------------------------------
-- Trigger: pendaftaran kompetisi & prestasi
-- ---------------------------------------------------------------------
create function public.guard_competition_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dojo uuid; v_org uuid; v_comp_org uuid;
begin
  select a.dojo_id, d.organization_id into v_dojo, v_org
  from public.athletes a join public.dojos d on d.id = a.dojo_id
  where a.id = new.athlete_id;
  select organization_id into v_comp_org from public.competitions where id = new.competition_id;
  if v_dojo is null or v_comp_org is null or v_org <> v_comp_org then
    raise exception 'Atlet dan kompetisi harus berada pada organisasi yang sama.' using errcode = '23514';
  end if;
  new.dojo_id := v_dojo;
  return new;
end $$;

create trigger trg_entry_guard before insert or update on public.competition_entries
  for each row execute function public.guard_competition_entry();

create function public.guard_achievement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dojo uuid; v_org uuid; v_comp_org uuid;
begin
  select a.dojo_id, d.organization_id into v_dojo, v_org
  from public.athletes a join public.dojos d on d.id = a.dojo_id
  where a.id = new.athlete_id;
  if v_dojo is null then
    raise exception 'Atlet tidak ditemukan.' using errcode = '23503';
  end if;
  if new.competition_id is not null then
    select organization_id into v_comp_org from public.competitions where id = new.competition_id;
    if v_comp_org is null or v_comp_org <> v_org then
      raise exception 'Atlet dan kompetisi harus berada pada organisasi yang sama.' using errcode = '23514';
    end if;
  end if;
  new.dojo_id := v_dojo;
  return new;
end $$;

create trigger trg_achievement_guard before insert or update on public.achievements
  for each row execute function public.guard_achievement();

-- ---------------------------------------------------------------------
-- Trigger: pembayaran
-- ---------------------------------------------------------------------
create function public.guard_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ath_dojo uuid;
begin
  if tg_op = 'UPDATE' and new.dojo_id <> old.dojo_id then
    raise exception 'Pembayaran tidak dapat dipindahkan antardojo.' using errcode = '23514';
  end if;
  if new.athlete_id is not null then
    select dojo_id into v_ath_dojo from public.athletes where id = new.athlete_id;
    if v_ath_dojo is null or v_ath_dojo <> new.dojo_id then
      raise exception 'Atlet pada pembayaran harus berasal dari dojo yang sama.' using errcode = '23514';
    end if;
  end if;
  if new.member_user_id is not null and not exists (
       select 1 from public.dojo_members
       where dojo_id = new.dojo_id and user_id = new.member_user_id) then
    raise exception 'Anggota pada pembayaran harus terdaftar di dojo yang sama.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_payment_guard before insert or update on public.payments
  for each row execute function public.guard_payment();

-- =====================================================================
-- RPC (dipanggil dari frontend lewat supabase.rpc)
-- =====================================================================

-- Menambahkan anggota organisasi berdasarkan email (hanya pihak berwenang).
create function public.add_organization_member(p_org uuid, p_email text, p_role text default 'member')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Anda belum login.' using errcode = '28000';
  end if;
  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'Peran tidak valid.' using errcode = '22023';
  end if;
  if not public.can_assign_org_role(p_org, p_role) then
    raise exception 'Anda tidak berwenang menetapkan peran ini.' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'Pengguna dengan email tersebut belum terdaftar.' using errcode = 'P0002';
  end if;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  insert into public.organization_members (organization_id, user_id, role)
  values (p_org, v_user, p_role)
  returning id into v_id;
  return v_id;
end $$;

-- Menambahkan anggota dojo berdasarkan email.
create function public.add_dojo_member(p_dojo uuid, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Anda belum login.' using errcode = '28000';
  end if;
  if p_role not in ('dojo_admin', 'coach', 'athlete', 'guardian') then
    raise exception 'Peran tidak valid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.dojos where id = p_dojo) then
    raise exception 'Dojo tidak ditemukan.' using errcode = 'P0002';
  end if;
  if not public.can_assign_dojo_role(p_dojo, p_role) then
    raise exception 'Anda tidak berwenang menetapkan peran ini.' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'Pengguna dengan email tersebut belum terdaftar.' using errcode = 'P0002';
  end if;
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  insert into public.dojo_members (dojo_id, user_id, role, membership_status)
  values (p_dojo, v_user, p_role, 'active')
  returning id into v_id;
  return v_id;
end $$;

-- Daftar anggota organisasi. Email hanya ditampilkan kepada owner/admin.
create function public.list_organization_members(p_org uuid)
returns table (id uuid, user_id uuid, role text, created_at timestamptz, full_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_member(p_org) then
    raise exception 'Anda tidak memiliki akses ke organisasi ini.' using errcode = '42501';
  end if;
  return query
    select om.id, om.user_id, om.role, om.created_at, p.full_name,
           case when public.is_org_admin(p_org) then u.email::text else null end
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    left join auth.users u on u.id = om.user_id
    where om.organization_id = p_org
    order by case om.role when 'owner' then 0 when 'admin' then 1 else 2 end, om.created_at;
end $$;

-- Daftar anggota dojo (staf). Email hanya untuk pengelola.
create function public.list_dojo_members(p_dojo uuid)
returns table (id uuid, user_id uuid, role text, membership_status text, joined_at timestamptz,
               full_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_staff_dojo(p_dojo) then
    raise exception 'Anda tidak memiliki akses ke anggota dojo ini.' using errcode = '42501';
  end if;
  return query
    select dm.id, dm.user_id, dm.role, dm.membership_status, dm.joined_at, p.full_name,
           case when public.can_manage_dojo(p_dojo) then u.email::text else null end
    from public.dojo_members dm
    join public.profiles p on p.id = dm.user_id
    left join auth.users u on u.id = dm.user_id
    where dm.dojo_id = p_dojo
    order by dm.joined_at;
end $$;

-- Daftar permohonan bergabung beserta nama pemohon (pengelola dojo).
create function public.list_dojo_applications(p_dojo uuid)
returns table (id uuid, applicant_id uuid, requested_role text, message text, status text,
               created_at timestamptz, decided_at timestamptz, full_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_dojo(p_dojo) then
    raise exception 'Hanya pengelola dojo yang dapat melihat permohonan.' using errcode = '42501';
  end if;
  return query
    select a.id, a.applicant_id, a.requested_role, a.message, a.status,
           a.created_at, a.decided_at, p.full_name, u.email::text
    from public.dojo_applications a
    join public.profiles p on p.id = a.applicant_id
    left join auth.users u on u.id = a.applicant_id
    where a.dojo_id = p_dojo
    order by (a.status = 'pending') desc, a.created_at desc;
end $$;

-- Info publik minimal sebuah dojo (hanya nama) agar calon anggota dapat mengajukan permohonan
-- tanpa membuka akses baca ke data dojo.
create function public.get_dojo_public_info(p_dojo uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select d.id, d.name from public.dojos d where d.id = p_dojo and d.status = 'active';
$$;

-- Menautkan / melepas akun pengguna ke data atlet (p_as: 'self' atau 'guardian').
create function public.link_athlete_account(p_athlete uuid, p_email text, p_as text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_dojo uuid; v_user uuid;
begin
  if p_as not in ('self', 'guardian') then
    raise exception 'Jenis tautan tidak valid.' using errcode = '22023';
  end if;
  select dojo_id into v_dojo from public.athletes where id = p_athlete;
  if v_dojo is null then
    raise exception 'Atlet tidak ditemukan.' using errcode = 'P0002';
  end if;
  if not public.can_manage_dojo(v_dojo) then
    raise exception 'Hanya pengelola dojo yang dapat menautkan akun.' using errcode = '42501';
  end if;
  if p_email is null or btrim(p_email) = '' then
    v_user := null;
  else
    select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
    if v_user is null then
      raise exception 'Pengguna dengan email tersebut belum terdaftar.' using errcode = 'P0002';
    end if;
    insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  end if;
  if p_as = 'self' then
    update public.athletes set user_id = v_user where id = p_athlete;
  else
    update public.athletes set guardian_user_id = v_user where id = p_athlete;
  end if;
end $$;

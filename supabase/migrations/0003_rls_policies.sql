-- =====================================================================
-- KarateOS — 0003: Row Level Security
-- Prinsip: default tolak. Tidak ada kebijakan "semua pengguna terautentikasi".
-- Fungsi pemeriksa peran (0002) bersifat SECURITY DEFINER → tidak rekursif.
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.platform_admins     enable row level security;
alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;
alter table public.dojos               enable row level security;
alter table public.dojo_members        enable row level security;
alter table public.dojo_applications   enable row level security;
alter table public.athletes            enable row level security;
alter table public.coaches             enable row level security;
alter table public.training_schedules  enable row level security;
alter table public.attendance          enable row level security;
alter table public.competitions        enable row level security;
alter table public.competition_entries enable row level security;
alter table public.achievements        enable row level security;
alter table public.payments            enable row level security;

-- ---------------- profiles ----------------
-- Hanya pemilik (dan admin platform) yang dapat membaca profil. Daftar anggota memakai RPC.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------- platform_admins (baca-sendiri saja; tanpa kebijakan tulis) ----------------
create policy platform_admins_select_self on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- ---------------- organizations ----------------
create policy organizations_select on public.organizations for select to authenticated
  using (public.can_view_org(id) or created_by = auth.uid());
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.is_org_owner(id));

-- ---------------- organization_members ----------------
create policy org_members_select on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));
-- Penambahan langsung: owner/admin hanya untuk owner; 'member' oleh admin. Tidak ada self-join.
create policy org_members_insert on public.organization_members for insert to authenticated
  with check (public.can_assign_org_role(organization_id, role));
-- Perubahan peran hanya oleh owner.
create policy org_members_update on public.organization_members for update to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
-- Hapus: owner (semua), admin (hanya 'member'), atau keluar sendiri.
create policy org_members_delete on public.organization_members for delete to authenticated
  using (
    public.is_org_owner(organization_id)
    or (public.is_org_admin(organization_id) and role = 'member')
    or user_id = auth.uid()
  );

-- ---------------- dojos ----------------
-- Catatan: is_org_admin(organization_id) memakai nilai kolom langsung (bukan lookup lewat id)
-- agar baris yang baru di-INSERT tetap terlihat oleh INSERT ... RETURNING pada statement yang sama.
create policy dojos_select on public.dojos for select to authenticated
  using (public.can_view_dojo(id) or public.is_org_admin(organization_id));
create policy dojos_insert on public.dojos for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy dojos_update on public.dojos for update to authenticated
  using (public.can_manage_dojo(id)) with check (public.can_manage_dojo(id));
create policy dojos_delete on public.dojos for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------- dojo_members ----------------
create policy dojo_members_select on public.dojo_members for select to authenticated
  using (user_id = auth.uid() or public.can_staff_dojo(dojo_id));
create policy dojo_members_insert on public.dojo_members for insert to authenticated
  with check (public.can_assign_dojo_role(dojo_id, role));
-- Hanya org admin yang dapat menyentuh baris dojo_admin (using memeriksa peran lama).
create policy dojo_members_update on public.dojo_members for update to authenticated
  using (public.can_assign_dojo_role(dojo_id, role))
  with check (public.can_assign_dojo_role(dojo_id, role));
create policy dojo_members_delete on public.dojo_members for delete to authenticated
  using (public.can_assign_dojo_role(dojo_id, role) or user_id = auth.uid());

-- ---------------- dojo_applications ----------------
create policy dojo_apps_select on public.dojo_applications for select to authenticated
  using (applicant_id = auth.uid() or public.can_manage_dojo(dojo_id));
create policy dojo_apps_insert on public.dojo_applications for insert to authenticated
  with check (applicant_id = auth.uid());
create policy dojo_apps_update on public.dojo_applications for update to authenticated
  using (applicant_id = auth.uid() or public.can_manage_dojo(dojo_id))
  with check (applicant_id = auth.uid() or public.can_manage_dojo(dojo_id));

-- ---------------- athletes ----------------
create policy athletes_select on public.athletes for select to authenticated
  using (public.can_staff_dojo(dojo_id) or user_id = auth.uid() or guardian_user_id = auth.uid());
create policy athletes_insert on public.athletes for insert to authenticated
  with check (public.can_staff_dojo(dojo_id));
create policy athletes_update on public.athletes for update to authenticated
  using (public.can_staff_dojo(dojo_id)) with check (public.can_staff_dojo(dojo_id));
create policy athletes_delete on public.athletes for delete to authenticated
  using (public.can_manage_dojo(dojo_id));

-- ---------------- coaches ----------------
create policy coaches_select on public.coaches for select to authenticated
  using (public.can_staff_dojo(dojo_id) or user_id = auth.uid());
create policy coaches_insert on public.coaches for insert to authenticated
  with check (public.can_manage_dojo(dojo_id));
create policy coaches_update on public.coaches for update to authenticated
  using (public.can_manage_dojo(dojo_id)) with check (public.can_manage_dojo(dojo_id));
create policy coaches_delete on public.coaches for delete to authenticated
  using (public.can_manage_dojo(dojo_id));

-- ---------------- training_schedules ----------------
create policy schedules_select on public.training_schedules for select to authenticated
  using (public.can_view_dojo(dojo_id));
create policy schedules_insert on public.training_schedules for insert to authenticated
  with check (public.can_staff_dojo(dojo_id));
create policy schedules_update on public.training_schedules for update to authenticated
  using (public.can_staff_dojo(dojo_id)) with check (public.can_staff_dojo(dojo_id));
create policy schedules_delete on public.training_schedules for delete to authenticated
  using (public.can_manage_dojo(dojo_id));

-- ---------------- attendance ----------------
create policy attendance_select on public.attendance for select to authenticated
  using (public.can_staff_dojo(dojo_id) or public.can_view_athlete(athlete_id));
create policy attendance_insert on public.attendance for insert to authenticated
  with check (public.can_staff_dojo(dojo_id));
create policy attendance_update on public.attendance for update to authenticated
  using (public.can_staff_dojo(dojo_id)) with check (public.can_staff_dojo(dojo_id));
create policy attendance_delete on public.attendance for delete to authenticated
  using (public.can_staff_dojo(dojo_id));

-- ---------------- competitions ----------------
create policy competitions_select on public.competitions for select to authenticated
  using (public.can_view_org(organization_id));
create policy competitions_insert on public.competitions for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy competitions_update on public.competitions for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy competitions_delete on public.competitions for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------------- competition_entries ----------------
create policy entries_select on public.competition_entries for select to authenticated
  using (public.can_staff_dojo(dojo_id) or public.can_view_athlete(athlete_id));
create policy entries_insert on public.competition_entries for insert to authenticated
  with check (public.can_staff_dojo(dojo_id));
create policy entries_update on public.competition_entries for update to authenticated
  using (public.can_staff_dojo(dojo_id)) with check (public.can_staff_dojo(dojo_id));
create policy entries_delete on public.competition_entries for delete to authenticated
  using (public.can_staff_dojo(dojo_id));

-- ---------------- achievements ----------------
create policy achievements_select on public.achievements for select to authenticated
  using (public.can_staff_dojo(dojo_id) or public.can_view_athlete(athlete_id));
create policy achievements_insert on public.achievements for insert to authenticated
  with check (public.can_staff_dojo(dojo_id));
create policy achievements_update on public.achievements for update to authenticated
  using (public.can_staff_dojo(dojo_id)) with check (public.can_staff_dojo(dojo_id));
create policy achievements_delete on public.achievements for delete to authenticated
  using (public.can_manage_dojo(dojo_id));

-- ---------------- payments (dibatasi: pengelola dojo; atlet/wali hanya miliknya) ----------------
create policy payments_select on public.payments for select to authenticated
  using (
    public.can_manage_dojo(dojo_id)
    or member_user_id = auth.uid()
    or (athlete_id is not null and public.is_athlete_self_or_guardian(athlete_id))
  );
create policy payments_insert on public.payments for insert to authenticated
  with check (public.can_manage_dojo(dojo_id));
create policy payments_update on public.payments for update to authenticated
  using (public.can_manage_dojo(dojo_id)) with check (public.can_manage_dojo(dojo_id));
create policy payments_delete on public.payments for delete to authenticated
  using (public.can_manage_dojo(dojo_id));

-- ---------------- Hak eksekusi fungsi ----------------
-- Cabut dari anon/public; hanya pengguna terautentikasi yang boleh memanggil RPC & helper.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;

-- 0006: Persetujuan permohonan bergabung (sebagai atlet) kini juga membuat data atlet
-- di dojo tersebut, sehingga langsung muncul di daftar Atlet dan terhitung di statistik.
-- Sebelumnya hanya baris dojo_members yang dibuat (tampil di tab Anggota), sedangkan
-- jumlah/daftar Atlet membaca tabel athletes sehingga tetap 0.
-- Permohonan sebagai wali tidak membuat atlet (wali ditautkan ke anak oleh pengelola).

create or replace function public._person_display_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(btrim((select full_name from public.profiles where id = p_user)), ''),
    nullif(btrim(split_part((select email from auth.users where id = p_user), '@', 1)), ''),
    'Atlet baru')
$$;
revoke execute on function public._person_display_name(uuid) from public, anon, authenticated;

create or replace function public.dojo_application_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.dojo_members (dojo_id, user_id, role, membership_status)
    values (new.dojo_id, new.applicant_id, new.requested_role, 'active')
    on conflict (dojo_id, user_id, role) do update set membership_status = 'active';

    if new.requested_role = 'athlete'
       and not exists (select 1 from public.athletes where dojo_id = new.dojo_id and user_id = new.applicant_id) then
      insert into public.athletes (dojo_id, user_id, full_name)
      values (new.dojo_id, new.applicant_id, left(public._person_display_name(new.applicant_id), 120));
    end if;
  end if;
  return new;
end $$;

-- Pemulihan data: pemohon atlet yang SUDAH disetujui sebelumnya tetapi belum punya data atlet.
-- SQL Editor berjalan tanpa pengguna login (auth.uid() null), sehingga trigger pengaman
-- guard_athlete menolak penautan akun. Trigger dimatikan HANYA di dalam blok ini; bila terjadi
-- error, seluruh blok (termasuk DISABLE) dibatalkan otomatis sehingga trigger tetap aktif.
do $$
begin
  alter table public.athletes disable trigger trg_athlete_guard;
  insert into public.athletes (dojo_id, user_id, full_name)
  select distinct on (a.dojo_id, a.applicant_id) a.dojo_id, a.applicant_id, left(public._person_display_name(a.applicant_id), 120)
  from public.dojo_applications a
  where a.status = 'approved' and a.requested_role = 'athlete'
    and not exists (select 1 from public.athletes x where x.dojo_id = a.dojo_id and x.user_id = a.applicant_id);
  alter table public.athletes enable trigger trg_athlete_guard;
end $$;
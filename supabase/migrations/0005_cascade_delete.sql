-- 0005: Hapus berantai (dojo & organisasi) + pratinjau jumlah data terikat.
-- Otorisasi sama dengan kebijakan hapus yang sudah ada:
--   dojo       -> is_org_admin(organisasi dojo)   (kebijakan dojos_delete)
--   organisasi -> is_org_owner(organisasi)         (kebijakan organizations_delete)
-- Fungsi SECURITY DEFINER hanya dipakai agar urutan hapus (anak -> induk) bisa dijalankan dalam
-- SATU transaksi; pengecekan izin dilakukan eksplisit di awal. Gagal di tengah = rollback total.

create or replace function public.dojo_delete_preview(p_dojo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.dojos where id = p_dojo;
  if v_org is null or not public.is_org_admin(v_org) then
    raise exception 'Anda tidak memiliki akses untuk menghapus dojo ini.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'athletes',     (select count(*) from public.athletes where dojo_id = p_dojo),
    'coaches',      (select count(*) from public.coaches where dojo_id = p_dojo),
    'schedules',    (select count(*) from public.training_schedules where dojo_id = p_dojo),
    'attendance',   (select count(*) from public.attendance where dojo_id = p_dojo),
    'achievements', (select count(*) from public.achievements where dojo_id = p_dojo),
    'entries',      (select count(*) from public.competition_entries where dojo_id = p_dojo),
    'payments',     (select count(*) from public.payments where dojo_id = p_dojo),
    'members',      (select count(*) from public.dojo_members where dojo_id = p_dojo),
    'applications', (select count(*) from public.dojo_applications where dojo_id = p_dojo)
  );
end $$;

-- Hapus isi dojo (bukan dojo-nya). Dipakai bersama oleh hapus dojo & hapus organisasi.
create or replace function public._purge_dojo_contents(p_dojo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.payments            where dojo_id = p_dojo;
  delete from public.achievements        where dojo_id = p_dojo;
  delete from public.competition_entries where dojo_id = p_dojo;
  delete from public.attendance          where dojo_id = p_dojo;
  delete from public.training_schedules  where dojo_id = p_dojo;
  delete from public.athletes            where dojo_id = p_dojo;
  delete from public.coaches             where dojo_id = p_dojo;
end $$;
revoke execute on function public._purge_dojo_contents(uuid) from public, anon, authenticated;

create or replace function public.delete_dojo_cascade(p_dojo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.dojos where id = p_dojo;
  if v_org is null then raise exception 'Dojo tidak ditemukan.'; end if;
  if not public.is_org_admin(v_org) then
    raise exception 'Anda tidak memiliki akses untuk menghapus dojo ini.' using errcode = '42501';
  end if;
  perform public._purge_dojo_contents(p_dojo);
  delete from public.dojos where id = p_dojo;   -- anggota & permohonan ikut terhapus (cascade)
end $$;

create or replace function public.organization_delete_preview(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_owner(p_org) then
    raise exception 'Hanya Owner yang dapat menghapus organisasi.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'dojos',        (select count(*) from public.dojos where organization_id = p_org),
    'athletes',     (select count(*) from public.athletes a join public.dojos d on d.id = a.dojo_id where d.organization_id = p_org),
    'coaches',      (select count(*) from public.coaches c join public.dojos d on d.id = c.dojo_id where d.organization_id = p_org),
    'schedules',    (select count(*) from public.training_schedules s join public.dojos d on d.id = s.dojo_id where d.organization_id = p_org),
    'payments',     (select count(*) from public.payments p join public.dojos d on d.id = p.dojo_id where d.organization_id = p_org),
    'achievements', (select count(*) from public.achievements x join public.dojos d on d.id = x.dojo_id where d.organization_id = p_org),
    'competitions', (select count(*) from public.competitions where organization_id = p_org),
    'members',      (select count(*) from public.organization_members where organization_id = p_org)
  );
end $$;

create or replace function public.delete_organization_cascade(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'Organisasi tidak ditemukan.'; end if;
  if not public.is_org_owner(p_org) then
    raise exception 'Hanya Owner yang dapat menghapus organisasi.' using errcode = '42501';
  end if;
  for r in select id from public.dojos where organization_id = p_org loop
    perform public._purge_dojo_contents(r.id);
  end loop;
  delete from public.dojos where organization_id = p_org;
  delete from public.competitions where organization_id = p_org;  -- peserta kompetisi ikut terhapus (cascade)
  delete from public.organizations where id = p_org;              -- anggota organisasi ikut terhapus (cascade)
end $$;

revoke execute on function public.dojo_delete_preview(uuid), public.delete_dojo_cascade(uuid),
  public.organization_delete_preview(uuid), public.delete_organization_cascade(uuid) from public, anon;
grant execute on function public.dojo_delete_preview(uuid), public.delete_dojo_cascade(uuid),
  public.organization_delete_preview(uuid), public.delete_organization_cascade(uuid) to authenticated;

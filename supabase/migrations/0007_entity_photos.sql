-- 0007: Foto untuk organisasi, dojo, atlet, dan pelatih (bucket 'avatars' yang sama).
-- Path:  organizations/<id>/…  dojos/<id>/…  athletes/<id>/…  coaches/<id>/…
-- Izin unggah/ubah/hapus mengikuti izin mengubah data induknya:
--   organisasi → admin organisasi | dojo → pengelola dojo (admin dojo/org)
--   atlet      → staf dojo (admin dojo, pelatih) | pelatih → pengelola dojo
-- Folder user-id (foto profil, 0004) tidak berubah.

alter table public.coaches add column if not exists photo_url text;

create or replace function public.storage_photo_allowed(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_kind  text := v_parts[1];
  v_id    uuid;
  v_dojo  uuid;
begin
  if array_length(v_parts, 1) is null or array_length(v_parts, 1) < 3 then return false; end if;
  if v_parts[2] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  v_id := v_parts[2]::uuid;
  if v_kind = 'organizations' then
    return public.is_org_admin(v_id);
  elsif v_kind = 'dojos' then
    return public.can_manage_dojo(v_id);
  elsif v_kind = 'athletes' then
    select dojo_id into v_dojo from public.athletes where id = v_id;
    return v_dojo is not null and public.can_staff_dojo(v_dojo);
  elsif v_kind = 'coaches' then
    select dojo_id into v_dojo from public.coaches where id = v_id;
    return v_dojo is not null and public.can_manage_dojo(v_dojo);
  end if;
  return false;
end $$;
revoke execute on function public.storage_photo_allowed(text) from public, anon;
grant execute on function public.storage_photo_allowed(text) to authenticated;

create policy avatars_entity_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.storage_photo_allowed(name));
create policy avatars_entity_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.storage_photo_allowed(name))
  with check (bucket_id = 'avatars' and public.storage_photo_allowed(name));
create policy avatars_entity_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.storage_photo_allowed(name));

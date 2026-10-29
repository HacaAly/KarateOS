// Pengujian RLS nyata menggunakan PGlite (PostgreSQL WASM) — tanpa perlu project Supabase.
// Menjalankan migrasi 0001–0004 apa adanya, lalu menguji kebijakan sebagai pengguna berbeda.
// Jalankan:  npm run test:rls
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const migDir = join(here, '..', 'migrations')

const db = new PGlite()

// ---- Tiruan minimal lingkungan Supabase (auth, storage, role) ----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email varchar(255), raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant all on all tables in schema storage to anon, authenticated;
  grant select on auth.users to authenticated;
`)

for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migDir, f), 'utf8'))
  console.log('✓ migrasi', f)
}
// Hak default Supabase untuk tabel pada schema public (RLS yang membatasi)
await db.exec(`grant all on all tables in schema public to anon, authenticated;`)

let pass = 0, fail = 0
const failures = []
const asUser = async (uid) => {
  await db.exec(`reset role;`)
  if (uid) {
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uid, role: 'authenticated' })])
    await db.exec(`set role authenticated;`)
  } else {
    await db.query(`select set_config('request.jwt.claims', '', false)`)
    await db.exec(`set role anon;`)
  }
}
const q = async (uid, sql, params = []) => { await asUser(uid); return db.query(sql, params) }
const ok = async (name, fn) => {
  try { await fn(); pass++; console.log('  ✓', name) }
  catch (e) { fail++; failures.push(name); console.log('  ✗', name, '→', e.message) }
}
const mustFail = async (name, uid, sql, params, pattern) => ok(name, async () => {
  try { await q(uid, sql, params) } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error('error berbeda: ' + e.message)
    return
  }
  throw new Error('seharusnya ditolak, tetapi berhasil')
})
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg ?? ''} diharapkan ${b}, dapat ${a}`) }

// ---- Data uji (dibuat sebagai superuser) ----
const U = {
  A: '00000000-0000-0000-0000-00000000000a', // owner Org1
  B: '00000000-0000-0000-0000-00000000000b', // tanpa akses apa pun
  C: '00000000-0000-0000-0000-00000000000c', // owner Org2
  D: '00000000-0000-0000-0000-00000000000d', // dojo_admin Dojo1
  E: '00000000-0000-0000-0000-00000000000e', // coach Dojo1
  F: '00000000-0000-0000-0000-00000000000f', // wali atlet
  G: '00000000-0000-0000-0000-000000000011', // dojo_admin murni Dojo1 (bukan admin organisasi)
  P: '00000000-0000-0000-0000-000000000099', // platform admin
}
await db.exec(`reset role;`)
for (const [k, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${k.toLowerCase()}@test.id`, JSON.stringify({ full_name: 'User ' + k })])
}
await db.exec(`insert into public.platform_admins (user_id) values ('${U.P}')`)

console.log('\n[Profil]')
await ok('profil dibuat otomatis oleh trigger saat registrasi', async () => {
  const r = await q(U.A, `select full_name from profiles where id = $1`, [U.A]); eq(r.rows.length, 1); eq(r.rows[0].full_name, 'User A')
})
await ok('pengguna dapat mengubah profil sendiri', async () => {
  await q(U.A, `update profiles set full_name='Cahya', phone='0812' where id=$1`, [U.A])
  const r = await q(U.A, `select full_name from profiles where id=$1`, [U.A]); eq(r.rows[0].full_name, 'Cahya')
})
await ok('pengguna tidak dapat MEMBACA profil orang lain', async () => {
  const r = await q(U.B, `select * from profiles where id=$1`, [U.A]); eq(r.rows.length, 0)
})
await ok('pengguna tidak dapat MENGUBAH profil orang lain (0 baris terpengaruh)', async () => {
  const r = await q(U.B, `update profiles set full_name='HACK' where id=$1`, [U.A]); eq(r.affectedRows, 0)
  await asUser(null); await db.exec('reset role')
  const c = await db.query(`select full_name from profiles where id=$1`, [U.A]); eq(c.rows[0].full_name, 'Cahya')
})
await mustFail('pengguna tidak dapat mengganti id profilnya ke id orang lain', U.B, `update profiles set id=$1 where id=$2`, [U.A, U.B], /row-level security|duplicate|violates/i)
await ok('anon melihat 0 baris profil', async () => { const r = await q(null, `select * from profiles`); eq(r.rows.length, 0) })

console.log('\n[Organisasi]')
let ORG1, ORG2
await ok('pengguna dapat membuat organisasi & otomatis menjadi owner', async () => {
  const r = await q(U.A, `insert into organizations (name, slug, created_by) values ('Org Satu','org-satu',$1) returning id`, [U.A])
  ORG1 = r.rows[0].id
  const m = await q(U.A, `select role from organization_members where organization_id=$1 and user_id=$2`, [ORG1, U.A]); eq(m.rows[0].role, 'owner')
})
await ok('organisasi kedua dibuat oleh pengguna C', async () => {
  const r = await q(U.C, `insert into organizations (name, slug, created_by) values ('Org Dua','org-dua',$1) returning id`, [U.C]); ORG2 = r.rows[0].id
})
await mustFail('tidak bisa membuat organisasi atas nama orang lain', U.B, `insert into organizations (name, slug, created_by) values ('Palsu','palsu',$1)`, [U.A], /row-level security/i)
await ok('pengguna B tidak melihat organisasi manapun', async () => { eq((await q(U.B, `select id from organizations`)).rows.length, 0) })
await ok('A hanya melihat Org1 (tidak bocor lintas organisasi)', async () => { const r = await q(U.A, `select id from organizations`); eq(r.rows.length, 1); eq(r.rows[0].id, ORG1) })
await mustFail('B tidak bisa menjadikan dirinya owner Org1 (insert langsung)', U.B, `insert into organization_members (organization_id,user_id,role) values ($1,$2,'owner')`, [ORG1, U.B], /row-level security/i)
await mustFail('B tidak bisa menjadikan dirinya member Org1 (self-join)', U.B, `insert into organization_members (organization_id,user_id,role) values ($1,$2,'member')`, [ORG1, U.B], /row-level security/i)
await ok('owner menambah anggota via RPC (email)', async () => {
  await q(U.A, `select add_organization_member($1,'d@test.id','admin')`, [ORG1])
  eq((await q(U.A, `select 1 from organization_members where organization_id=$1`, [ORG1])).rows.length, 2)
})
await mustFail('admin (D) tidak bisa menambah admin baru', U.D, `select add_organization_member($1,'e@test.id','admin')`, [ORG1], /tidak berwenang/i)
await ok('admin (D) dapat menambah role member', async () => { await q(U.D, `select add_organization_member($1,'e@test.id','member')`, [ORG1]) })
await ok('admin (D) tidak bisa menaikkan perannya sendiri jadi owner (0 baris)', async () => {
  const r = await q(U.D, `update organization_members set role='owner' where organization_id=$1 and user_id=$2`, [ORG1, U.D]); eq(r.affectedRows, 0)
})
await ok('member (E) tidak bisa menaikkan perannya sendiri (0 baris)', async () => {
  const r = await q(U.E, `update organization_members set role='admin' where organization_id=$1 and user_id=$2`, [ORG1, U.E]); eq(r.affectedRows, 0)
})
await ok('owner dapat mengubah peran anggota', async () => {
  const r = await q(U.A, `update organization_members set role='member' where organization_id=$1 and user_id=$2`, [ORG1, U.E]); eq(r.affectedRows, 1)
})
await mustFail('owner terakhir tidak bisa diturunkan', U.A, `update organization_members set role='admin' where organization_id=$1 and user_id=$2`, [ORG1, U.A], /minimal satu owner/i)
await mustFail('owner terakhir tidak bisa keluar', U.A, `delete from organization_members where organization_id=$1 and user_id=$2`, [ORG1, U.A], /minimal satu owner/i)
await ok('RPC list anggota: email terlihat oleh admin, tidak oleh member', async () => {
  const a = await q(U.A, `select email from list_organization_members($1)`, [ORG1]); if (!a.rows.every((r) => r.email)) throw new Error('email admin kosong')
  const e = await q(U.E, `select email from list_organization_members($1)`, [ORG1]); if (e.rows.some((r) => r.email)) throw new Error('email bocor ke member')
})
await mustFail('non-anggota tidak bisa memakai RPC list anggota', U.B, `select * from list_organization_members($1)`, [ORG1], /tidak memiliki akses/i)
await ok('non-anggota mengubah organisasi → 0 baris', async () => { eq((await q(U.B, `update organizations set name='Hack Org' where id=$1`, [ORG1])).affectedRows, 0) })
await ok('member (E) mengubah organisasi → 0 baris', async () => { eq((await q(U.E, `update organizations set name='Hack Org' where id=$1`, [ORG1])).affectedRows, 0) })
await ok('admin (D) dapat mengubah organisasi', async () => { eq((await q(U.D, `update organizations set description='ok' where id=$1`, [ORG1])).affectedRows, 1) })
await ok('admin (D) tidak dapat menghapus organisasi (owner saja)', async () => { eq((await q(U.D, `delete from organizations where id=$1`, [ORG1])).affectedRows, 0) })

console.log('\n[Dojo & isolasi akses]')
let DOJO1, DOJO2
await ok('admin organisasi membuat dojo', async () => {
  const r = await q(U.A, `insert into dojos (organization_id,name) values ($1,'Dojo Satu') returning id`, [ORG1]); DOJO1 = r.rows[0].id
})
await ok('owner Org2 membuat dojo di Org2', async () => {
  const r = await q(U.C, `insert into dojos (organization_id,name) values ($1,'Dojo Dua') returning id`, [ORG2]); DOJO2 = r.rows[0].id
})
await mustFail('B tidak bisa membuat dojo di Org1', U.B, `insert into dojos (organization_id,name) values ($1,'Dojo Palsu')`, [ORG1], /row-level security/i)
await mustFail('C (owner Org2) tidak bisa membuat dojo di Org1', U.C, `insert into dojos (organization_id,name) values ($1,'Dojo Silang')`, [ORG1], /row-level security/i)
await ok('akun B tidak dapat membaca dojo via query langsung', async () => { eq((await q(U.B, `select * from dojos where id=$1`, [DOJO1])).rows.length, 0); eq((await q(U.B, `select * from dojos`)).rows.length, 0) })
await ok('akun C tidak melihat dojo Org1 (tidak bocor lintas organisasi)', async () => { const r = await q(U.C, `select id from dojos`); eq(r.rows.length, 1); eq(r.rows[0].id, DOJO2) })
await ok('akun B tidak dapat mengubah/menghapus dojo', async () => {
  eq((await q(U.B, `update dojos set name='Hack Dojo' where id=$1`, [DOJO1])).affectedRows, 0)
  eq((await q(U.B, `delete from dojos where id=$1`, [DOJO1])).affectedRows, 0)
})
await ok('A (org owner) melihat dojo-nya', async () => { eq((await q(U.A, `select 1 from dojos where id=$1`, [DOJO1])).rows.length, 1) })
await ok('A menambahkan D sebagai dojo_admin dan E sebagai coach (RPC)', async () => {
  await q(U.A, `select add_dojo_member($1,'d@test.id','dojo_admin')`, [DOJO1])
  await q(U.A, `select add_dojo_member($1,'e@test.id','coach')`, [DOJO1])
  await q(U.A, `select add_dojo_member($1,'g@test.id','dojo_admin')`, [DOJO1])
})
await ok('G (dojo_admin murni) hanya melihat Dojo1 dan dapat mengubahnya', async () => {
  const r = await q(U.G, `select id from dojos`); eq(r.rows.length, 1); eq(r.rows[0].id, DOJO1)
  eq((await q(U.G, `update dojos set address='Jl. Karate 1' where id=$1`, [DOJO1])).affectedRows, 1)
})
await ok('G (dojo_admin) tidak melihat organisasi/anggota organisasi lain, hanya organisasi induk dojonya', async () => {
  const r = await q(U.G, `select id from organizations`); eq(r.rows.length, 1); eq(r.rows[0].id, ORG1)
  eq((await q(U.G, `select 1 from organization_members`)).rows.length, 0)
})
await mustFail('G tidak bisa membuat dojo baru di organisasi (bukan admin organisasi)', U.G, `insert into dojos (organization_id,name) values ($1,'Dojo Liar')`, [ORG1], /row-level security/i)
await ok('D (dojo_admin) melihat Dojo1 tetapi tidak melihat Dojo2', async () => {
  const r = await q(U.D, `select id from dojos`); eq(r.rows.length, 1); eq(r.rows[0].id, DOJO1)
})
await ok('D (dojo_admin) dapat mengubah dojo-nya', async () => { eq((await q(U.D, `update dojos set contact='0812' where id=$1`, [DOJO1])).affectedRows, 1) })
await ok('coach E dapat melihat dojo tapi tidak mengubahnya', async () => {
  eq((await q(U.E, `select 1 from dojos where id=$1`, [DOJO1])).rows.length, 1)
  eq((await q(U.E, `update dojos set contact='x' where id=$1`, [DOJO1])).affectedRows, 0)
})
await mustFail('dojo tidak bisa dipindah ke organisasi lain', U.A, `update dojos set organization_id=$1 where id=$2`, [ORG2, DOJO1], /row-level security|tidak dapat dipindahkan/i)
await mustFail('dojo_admin tidak bisa mengangkat dojo_admin lain (hanya org admin)', U.G, `select add_dojo_member($1,'f@test.id','dojo_admin')`, [DOJO1], /tidak berwenang/i)
await mustFail('coach tidak bisa menambah anggota dojo', U.E, `select add_dojo_member($1,'f@test.id','athlete')`, [DOJO1], /tidak berwenang/i)
await mustFail('B tidak bisa memasukkan dirinya ke dojo (insert langsung)', U.B, `insert into dojo_members (dojo_id,user_id,role) values ($1,$2,'dojo_admin')`, [DOJO1, U.B], /row-level security/i)
await mustFail('B tidak bisa memasukkan dirinya sebagai athlete (insert langsung)', U.B, `insert into dojo_members (dojo_id,user_id,role) values ($1,$2,'athlete')`, [DOJO1, U.B], /row-level security/i)
await ok('dojo_admin tidak bisa menyentuh baris dojo_admin lain (0 baris)', async () => {
  eq((await q(U.G, `update dojo_members set membership_status='inactive' where dojo_id=$1 and role='dojo_admin'`, [DOJO1])).affectedRows, 0)
})
await ok('dojo_admin dapat menonaktifkan coach', async () => {
  eq((await q(U.D, `update dojo_members set membership_status='inactive' where dojo_id=$1 and role='coach'`, [DOJO1])).affectedRows, 1)
  await q(U.D, `update dojo_members set membership_status='active' where dojo_id=$1 and role='coach'`, [DOJO1])
})
await ok('B hanya membaca info publik (nama) dojo lewat RPC, bukan data dojo', async () => {
  const r = await q(U.B, `select * from get_dojo_public_info($1)`, [DOJO1]); eq(r.rows.length, 1); eq(r.rows[0].name, 'Dojo Satu')
  if (Object.keys(r.rows[0]).length !== 2) throw new Error('kolom berlebih')
})
await ok('B melihat daftar anggota dojo → ditolak', async () => {
  try { await q(U.B, `select * from list_dojo_members($1)`, [DOJO1]) } catch { return }
  throw new Error('seharusnya ditolak')
})

console.log('\n[Permohonan bergabung]')
let APP
await ok('B mengajukan permohonan bergabung', async () => {
  const r = await q(U.B, `insert into dojo_applications (dojo_id, applicant_id, requested_role, message) values ($1,$2,'athlete','Mau gabung') returning id`, [DOJO1, U.B]); APP = r.rows[0].id
})
await mustFail('permohonan ganda pending ditolak', U.B, `insert into dojo_applications (dojo_id, applicant_id) values ($1,$2)`, [DOJO1, U.B], /duplicate|unique/i)
await mustFail('B tidak bisa mengajukan atas nama orang lain', U.B, `insert into dojo_applications (dojo_id, applicant_id) values ($1,$2)`, [DOJO1, U.F], /row-level security/i)
await mustFail('B tidak bisa menyetujui permohonannya sendiri', U.B, `update dojo_applications set status='approved' where id=$1`, [APP], /pengelola dojo/i)
await ok('B belum menjadi anggota setelah mencoba', async () => { eq((await q(U.B, `select 1 from dojo_members where user_id=$1`, [U.B])).rows.length, 0) })
await ok('coach tidak melihat permohonan', async () => { eq((await q(U.E, `select 1 from dojo_applications`)).rows.length, 0) })
await ok('dojo_admin melihat & menyetujui permohonan → B jadi anggota', async () => {
  eq((await q(U.D, `select 1 from list_dojo_applications($1)`, [DOJO1])).rows.length, 1)
  await q(U.D, `update dojo_applications set status='approved' where id=$1`, [APP])
  const m = await q(U.B, `select role, membership_status from dojo_members where user_id=$1`, [U.B]); eq(m.rows.length, 1); eq(m.rows[0].role, 'athlete')
})
await mustFail('permohonan yang sudah diputuskan tidak bisa diubah lagi', U.D, `update dojo_applications set status='rejected' where id=$1`, [APP], /sudah diputuskan/i)
await ok('B (athlete) kini bisa melihat dojo tetapi tidak mengubah', async () => {
  eq((await q(U.B, `select 1 from dojos where id=$1`, [DOJO1])).rows.length, 1)
  eq((await q(U.B, `update dojos set name='Hack' where id=$1`, [DOJO1])).affectedRows, 0)
})

console.log('\n[Atlet, jadwal, kehadiran]')
let ATH1, ATH2, SCH
await ok('coach menambah atlet', async () => {
  ATH1 = (await q(U.E, `insert into athletes (dojo_id, full_name, birth_date, belt_rank) values ($1,'Budi','2012-05-01','kuning') returning id`, [DOJO1])).rows[0].id
  ATH2 = (await q(U.E, `insert into athletes (dojo_id, full_name) values ($1,'Sari') returning id`, [DOJO1])).rows[0].id
})
await mustFail('coach tidak bisa menautkan akun saat insert atlet', U.E, `insert into athletes (dojo_id, full_name, user_id) values ($1,'Tautan',$2)`, [DOJO1, U.B], /pengelola dojo/i)
await mustFail('B (athlete biasa) tidak bisa menambah atlet', U.B, `insert into athletes (dojo_id, full_name) values ($1,'Siluman')`, [DOJO1], /row-level security/i)
await mustFail('orang di luar dojo tidak bisa menambah atlet', U.C, `insert into athletes (dojo_id, full_name) values ($1,'Siluman')`, [DOJO1], /row-level security/i)
await ok('C (org lain) tidak melihat atlet Dojo1', async () => { eq((await q(U.C, `select 1 from athletes`)).rows.length, 0) })
await ok('A menautkan wali (F) ke Budi via RPC; F melihat hanya Budi', async () => {
  await q(U.A, `select link_athlete_account($1,'f@test.id','guardian')`, [ATH1])
  const r = await q(U.F, `select full_name from athletes`); eq(r.rows.length, 1); eq(r.rows[0].full_name, 'Budi')
})
await mustFail('coach tidak bisa menautkan akun via RPC', U.E, `select link_athlete_account($1,'b@test.id','self')`, [ATH2], /pengelola dojo/i)
await mustFail('coach tidak bisa mengubah user_id atlet via update', U.E, `update athletes set user_id=$1 where id=$2`, [U.B, ATH2], /pengelola dojo/i)
await mustFail('atlet tidak dapat dipindah antardojo', U.A, `update athletes set dojo_id=$1 where id=$2`, [DOJO2, ATH1], /tidak dapat dipindahkan|row-level/i)
await ok('coach membuat jadwal latihan', async () => {
  SCH = (await q(U.E, `insert into training_schedules (dojo_id,title,session_date,start_time,end_time) values ($1,'Latihan Rutin', current_date + 1,'16:00','18:00') returning id`, [DOJO1])).rows[0].id
})
await mustFail('jam selesai harus setelah jam mulai', U.E, `insert into training_schedules (dojo_id,title,session_date,start_time,end_time) values ($1,'Salah', current_date,'18:00','16:00')`, [DOJO1], /time_order|check/i)
await ok('pelatih dari dojo lain ditolak pada jadwal', async () => {
  await db.exec('reset role')
  const c2 = (await db.query(`insert into coaches (dojo_id, full_name) values ($1,'Pelatih Dojo2') returning id`, [DOJO2])).rows[0].id
  try { await q(U.A, `insert into training_schedules (dojo_id,title,session_date,start_time,end_time,coach_id) values ($1,'X', current_date,'10:00','11:00',$2)`, [DOJO1, c2]) } catch (e) { if (/dojo yang sama/i.test(e.message)) return; throw e }
  throw new Error('seharusnya ditolak')
})
await ok('coach mencatat kehadiran', async () => {
  await q(U.E, `insert into attendance (dojo_id,schedule_id,athlete_id,status) values ($1,$2,$3,'present')`, [DOJO1, SCH, ATH1])
})
await mustFail('kehadiran ganda untuk atlet+sesi yang sama ditolak', U.E, `insert into attendance (dojo_id,schedule_id,athlete_id) values ($1,$2,$3)`, [DOJO1, SCH, ATH1], /duplicate|unique/i)
await ok('upsert kehadiran memperbarui status (tanpa duplikat)', async () => {
  await q(U.E, `insert into attendance (dojo_id,schedule_id,athlete_id,status) values ($1,$2,$3,'late') on conflict (schedule_id,athlete_id) do update set status=excluded.status`, [DOJO1, SCH, ATH1])
  const r = await q(U.E, `select status from attendance where athlete_id=$1`, [ATH1]); eq(r.rows.length, 1); eq(r.rows[0].status, 'late')
})
await ok('atlet dari dojo lain tidak bisa dicatat hadir', async () => {
  await db.exec('reset role')
  const x = (await db.query(`insert into athletes (dojo_id, full_name) values ($1,'Orang Dojo2') returning id`, [DOJO2])).rows[0].id
  try { await q(U.E, `insert into attendance (dojo_id,schedule_id,athlete_id) values ($1,$2,$3)`, [DOJO1, SCH, x]) } catch (e) { if (/dojo yang sama|row-level|violates/i.test(e.message)) return; throw e }
  throw new Error('seharusnya ditolak')
})
await ok('wali F dapat melihat kehadiran anaknya, tidak yang lain', async () => { eq((await q(U.F, `select 1 from attendance`)).rows.length, 1) })
await ok('wali F tidak bisa mengubah kehadiran (0 baris)', async () => { eq((await q(U.F, `update attendance set status='absent'`)).affectedRows, 0) })

console.log('\n[Kompetisi & prestasi]')
let COMP, COMP2
await ok('admin organisasi membuat kompetisi', async () => {
  COMP = (await q(U.A, `insert into competitions (organization_id,name,start_date) values ($1,'Kejurda 2026', current_date + 30) returning id`, [ORG1])).rows[0].id
  COMP2 = (await q(U.C, `insert into competitions (organization_id,name,start_date) values ($1,'Kejurda Org2', current_date + 30) returning id`, [ORG2])).rows[0].id
})
await mustFail('coach tidak bisa membuat kompetisi', U.E, `insert into competitions (organization_id,name,start_date) values ($1,'Palsu', current_date)`, [ORG1], /row-level security/i)
await ok('coach mendaftarkan atlet ke kompetisi', async () => { await q(U.E, `insert into competition_entries (competition_id, athlete_id, dojo_id, category) values ($1,$2,$3,'Kata U-12')`, [COMP, ATH1, DOJO1]) })
await mustFail('pendaftaran ke kompetisi organisasi lain ditolak', U.E, `insert into competition_entries (competition_id, athlete_id, dojo_id) values ($1,$2,$3)`, [COMP2, ATH2, DOJO1], /organisasi yang sama|row-level/i)
await ok('coach mencatat prestasi (medali emas)', async () => { await q(U.E, `insert into achievements (athlete_id, dojo_id, competition_id, medal, result, year) values ($1,$2,$3,'gold','Juara 1',2026)`, [ATH1, DOJO1, COMP]) })
await mustFail('prestasi harus punya kompetisi atau nama event', U.E, `insert into achievements (athlete_id, dojo_id, year) values ($1,$2,2026)`, [ATH1, DOJO1], /has_event|check/i)
await ok('wali F melihat prestasi anaknya', async () => { eq((await q(U.F, `select 1 from achievements`)).rows.length, 1) })
await ok('C tidak melihat kompetisi Org1', async () => { const r = await q(U.C, `select id from competitions`); eq(r.rows.length, 1); eq(r.rows[0].id, COMP2) })
await ok('anggota dojo (B athlete) melihat kompetisi organisasinya', async () => { eq((await q(U.B, `select 1 from competitions where id=$1`, [COMP])).rows.length, 1) })

console.log('\n[Pembayaran — akses dibatasi]')
let PAY
await ok('dojo_admin mencatat pembayaran manual', async () => {
  PAY = (await q(U.D, `insert into payments (dojo_id, athlete_id, period, amount, status, paid_at, method) values ($1,$2,'2026-10-01',150000,'paid', now(),'tunai') returning id`, [DOJO1, ATH1])).rows[0].id
})
await mustFail('status paid tanpa paid_at ditolak', U.D, `insert into payments (dojo_id, athlete_id, period, amount, status) values ($1,$2,'2026-11-01',1,'paid')`, [DOJO1, ATH1], /paid_has_date|check/i)
await mustFail('periode harus tanggal 1', U.D, `insert into payments (dojo_id, athlete_id, period, amount) values ($1,$2,'2026-11-15',1)`, [DOJO1, ATH1], /check|period/i)
await mustFail('nominal negatif ditolak', U.D, `insert into payments (dojo_id, athlete_id, period, amount) values ($1,$2,'2026-11-01',-5)`, [DOJO1, ATH1], /check|amount/i)
await ok('coach TIDAK dapat melihat pembayaran', async () => { eq((await q(U.E, `select 1 from payments`)).rows.length, 0) })
await mustFail('coach tidak bisa membuat pembayaran', U.E, `insert into payments (dojo_id, athlete_id, period, amount) values ($1,$2,'2026-12-01',1)`, [DOJO1, ATH1], /row-level security/i)
await ok('wali F hanya melihat pembayaran anaknya', async () => { eq((await q(U.F, `select 1 from payments`)).rows.length, 1) })
await ok('C (org lain) tidak melihat pembayaran', async () => { eq((await q(U.C, `select 1 from payments`)).rows.length, 0) })
await ok('wali F tidak bisa mengubah pembayaran (0 baris)', async () => { eq((await q(U.F, `update payments set amount=1`)).affectedRows, 0) })
await ok('pembayaran lintas dojo ditolak', async () => {
  await db.exec('reset role')
  const x = (await db.query(`select id from athletes where dojo_id=$1 limit 1`, [DOJO2])).rows[0].id
  try { await q(U.A, `insert into payments (dojo_id, athlete_id, period, amount) values ($1,$2,'2026-12-01',1)`, [DOJO1, x]) } catch (e) { if (/dojo yang sama/i.test(e.message)) return; throw e }
  throw new Error('seharusnya ditolak')
})

console.log('\n[Admin platform & hak eksekusi]')
await ok('platform admin melihat semua dojo', async () => { eq((await q(U.P, `select 1 from dojos`)).rows.length, 2) })
await mustFail('pengguna biasa tidak bisa menjadikan dirinya platform admin', U.B, `insert into platform_admins (user_id) values ($1)`, [U.B], /row-level security|permission denied/i)
await mustFail('anon tidak bisa memanggil RPC', null, `select * from get_dojo_public_info($1)`, [DOJO1], /permission denied/i)
await ok('RLS aktif pada semua tabel public', async () => {
  await db.exec('reset role')
  const r = await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
  eq(r.rows.length, 0, 'tabel tanpa RLS: ' + r.rows.map((x) => x.relname))
})

console.log(`\nHasil: ${pass} lulus, ${fail} gagal`)
if (fail) { console.log('Gagal:', failures.join(' | ')); process.exit(1) }

# KarateOS — Multi-Dojo Management System

Aplikasi web untuk mengelola organisasi karate, dojo, atlet, pelatih, jadwal, kehadiran, kompetisi, prestasi, dan pencatatan iuran.
Stack: React + TypeScript + Vite + Tailwind CSS v4 + React Router + Supabase (Auth, PostgreSQL, RLS, Storage).

## 1. Persyaratan
- Node.js 20+ (diuji dengan Node 22) dan npm
- Akun Supabase (gratis cukup)

## 2. Instalasi & menjalankan
```bash
npm install
cp .env.example .env     # lalu isi nilainya (langkah 4)
npm run dev              # http://localhost:5173
```

## 3. Membuat project Supabase
1. Masuk ke supabase.com → **New project**.
2. Tunggu sampai project siap.

## 4. Environment variables
Di dashboard Supabase: **Project Settings → API**. Isi `.env`:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable atau anon key>
```
**Jangan** memakai `service_role`/secret key di frontend. File `.env` sudah di-`.gitignore`.
Tanpa variabel ini aplikasi menampilkan halaman "Supabase belum dikonfigurasi".

## 5. Migrasi SQL
Buka **SQL Editor** di Supabase dan jalankan **berurutan** isi file berikut (satu per satu):

| File | Isi |
|---|---|
| `supabase/migrations/0001_schema.sql` | Tabel, constraint, indeks |
| `supabase/migrations/0002_functions_triggers.sql` | Fungsi pemeriksa peran (SECURITY DEFINER), trigger, RPC |
| `supabase/migrations/0003_rls_policies.sql` | Aktivasi RLS + semua kebijakan, pencabutan hak `anon` |
| `supabase/migrations/0004_storage.sql` | Bucket `avatars` untuk foto profil |

Atau dengan Supabase CLI: `supabase link` lalu `supabase db push`.

### Relasi utama
`organizations` 1—N `dojos` · `organizations` 1—N `competitions` · `dojos` 1—N `athletes/coaches/training_schedules/payments` ·
`training_schedules` 1—N `attendance` N—1 `athletes` · `competitions` 1—N `competition_entries` N—1 `athletes` ·
`achievements` → `athletes` (+ opsional `competitions`). Keanggotaan: `organization_members` (owner/admin/member), `dojo_members` (dojo_admin/coach/athlete/guardian).
Data atlet **terpisah** dari akun login (`athletes.user_id` / `guardian_user_id` opsional).

### Model hak akses (ditegakkan di database lewat RLS)
- **Admin platform**: baris di `platform_admins` (isi manual lewat SQL Editor: `insert into platform_admins (user_id) values ('<uuid>');`). Tidak ada jalur API untuk menjadikan diri sendiri admin platform.
- **Owner** organisasi: semua; satu-satunya yang bisa menetapkan Owner/Admin & menghapus organisasi. Organisasi selalu punya ≥1 Owner.
- **Admin** organisasi: membuat/mengelola dojo, kompetisi, dan anggota biasa.
- **Admin dojo**: mengelola dojo-nya (anggota, pelatih, atlet, pembayaran), tidak otomatis admin organisasi.
- **Pelatih**: mengelola atlet, jadwal, kehadiran, prestasi, pendaftaran kompetisi di dojo-nya; **tidak** melihat pembayaran.
- **Atlet / wali**: hanya melihat dojo mereka, serta data/kehadiran/prestasi/pembayaran atlet yang tertaut.
- Email pengguna hanya terlihat oleh pengelola (lewat RPC); profil orang lain tidak dapat dibaca.

## 6. Autentikasi (konfigurasi manual di dashboard)
- **Authentication → Providers → Email**: aktif. Verifikasi email (Confirm email) dianjurkan.
- **Authentication → URL Configuration**: isi **Site URL** (mis. `http://localhost:5173`) dan tambahkan `…/login` & `…/reset-password` ke **Redirect URLs** (juga URL produksi).
- Profil dibuat otomatis oleh trigger `on_auth_user_created`; aplikasi juga membuatnya secara idempotent bila belum ada.

## 7. Membuat akun uji & menguji
1. Daftar **Akun A** (`/register`), verifikasi email, masuk.
2. Akun A: **Organisasi → Buat organisasi** (otomatis Owner) → **Dojo → Buat dojo**.
3. Daftar **Akun B** di browser/jendela lain.
4. Pengujian profil: ubah nama/telepon/foto di **Profil saya**, muat ulang halaman → data tetap.
5. Pengujian akses dojo: Akun B → menu Dojo kosong; membuka `/dojo/<id-dojo-A>` → "Dojo tidak ditemukan". Lewat SQL/REST dengan token B, `select * from dojos` mengembalikan 0 baris.
6. Alur gabung: Akun A salin **ID dojo** dari detail dojo → Akun B **Dojo → Gabung ke dojo** → Akun A setujui di tab **Permohonan**.

## 8. Test
```bash
npm run test:rls   # 101 pengujian RLS/trigger/constraint pada PostgreSQL (PGlite) dengan migrasi asli
npm run build      # typecheck + build produksi
npm run lint
```
`test:rls` menjalankan migrasi 0001–0004 pada PostgreSQL in-memory dengan tiruan minimal `auth.users`/`auth.uid()`/`storage`
dan memeriksa isolasi antarorganisasi, pencegahan eskalasi peran, pembatasan pembayaran, dsb. Ini **bukan** pengganti uji pada project Supabase sungguhan (lihat batasan di bawah).

## 9. Deployment
`npm run build` menghasilkan `dist/`. Deploy ke hosting statis (Vercel, Netlify, Cloudflare Pages) dengan:
- Build command `npm run build`, output `dist`
- Environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Rewrite SPA: semua path → `/index.html`
- Tambahkan URL produksi ke Supabase **Site URL / Redirect URLs**.

## 10. Troubleshooting
| Gejala | Penyebab / solusi |
|---|---|
| Halaman "Supabase belum dikonfigurasi" | `.env` belum diisi / dev server belum di-restart |
| "Tidak dapat terhubung ke server" | URL Supabase salah atau project di-pause |
| `relation ... does not exist` / `function ... does not exist` | Migrasi belum dijalankan lengkap & berurutan |
| Login berhasil tapi data kosong | Normal untuk akun baru — RLS hanya menampilkan data milik/aksesmu |
| "Email belum diverifikasi" | Klik tautan di email, atau matikan Confirm email untuk pengembangan |
| Unggah foto gagal "Bucket not found" | Jalankan `0004_storage.sql` |
| Tautan reset password tidak valid | Periksa Redirect URLs (langkah 6) |
| Menambah anggota: "belum terdaftar" | Pengguna harus mendaftar dulu; penambahan memakai email |

## 11. Batasan yang diketahui
- Belum diuji pada project Supabase sungguhan (tidak ada kredensial di lingkungan pembuatan); RLS diuji pada PostgreSQL + tiruan skema Supabase.
- Belum ada test otomatis untuk UI; alur UI hanya diuji asap (halaman dimuat, validasi, error koneksi, layout ponsel).
- Pembayaran hanya pencatatan manual; status "lunas" tidak diverifikasi sistem.
- Logo organisasi/dojo & foto atlet belum ada UI unggah (kolom tersedia); hanya foto profil pengguna.
- Peran wali/atlet bergabung lewat permohonan atau penautan oleh pengelola; belum ada undangan via email.
- Bundel JS ±620 kB (belum code-splitting).

## Redesain UI/UX

Perubahan hanya di sisi tampilan (`src/`, `index.html`, `public/favicon.svg`). Skema database, RLS, service, auth, rute, validasi, dan pengecekan izin **tidak diubah**.

- **Design tokens** terpusat di `src/index.css` (`@theme static`): navy `#111827`, biru `#3B82F6`, teal `#14B8A6`, lavender `#8B5CF6` (terbatas), latar `#F8FAFC`. Merah hanya untuk bahaya.
- **Komponen**: Button, Badge (ikon status, tidak hanya warna), Card/StatCard, Avatar, Dropdown, Modal (focus trap, bottom-sheet di mobile), Tabs, DataTable (kartu di mobile + paginasi), Skeleton/Empty/Error state.
- **Layout**: sidebar bergrup berbasis izin, drawer mobile yang aksesibel (overlay, Esc, focus trap, tutup saat memilih menu), skip link.
- **Dashboard**: salam sesuai waktu, hero, kartu statistik, jadwal terdekat, tren kehadiran, sebaran sabuk, aktivitas terbaru — semua dari data nyata; tanpa data → empty state.
- **Halaman**: kartu organisasi & dojo (pencarian/filter/“tampilkan lebih banyak”), detail dojo dengan ringkasan, profil dengan banner, jadwal tampilan Daftar/Kalender, avatar di daftar atlet & pelatih.
- **Aksesibilitas & gerak**: label form, `aria-*`, fokus terlihat, animasi mati pada `prefers-reduced-motion`.

### Pengujian yang dilakukan
- `tsc -b`, `npm run build`, `npm run test:rls` (101 lulus; PGlite, bukan Supabase asli).
- Pemeriksaan otomatis 18 rute × lebar 320/375/430/768/1024/1280/1440: tanpa overflow horizontal dan tanpa error konsol, **dengan data tiruan** (Supabase dimock).
- **Belum diuji**: alur nyata ke project Supabase (login, simpan data), pembaca layar sungguhan, perangkat fisik, Lighthouse.

## Hapus berantai (migrasi 0005)

Menghapus dojo atau organisasi kini otomatis menghapus seluruh data di bawahnya dalam **satu transaksi** (gagal di tengah = rollback total), setelah pengguna melihat popup berisi jumlah data yang ikut terhapus dan mengetik nama sebagai konfirmasi. Popup juga menawarkan **"Nonaktifkan saja"** (data tetap tersimpan).

- Dojo: `delete_dojo_cascade` — hanya admin/owner organisasi. Organisasi: `delete_organization_cascade` — hanya Owner. Izin diperiksa di dalam fungsi; `anon` dan pengguna lain ditolak.
- **Jalankan `supabase/migrations/0005_cascade_delete.sql` di SQL Editor Supabase** (pilih "Run and enable RLS" bila muncul).
- Catatan: "lepas hubungan" (memindahkan atlet/dojo tanpa induk) tidak disediakan karena setiap atlet/dojo wajib punya induk, dan trigger keamanan melarang pemindahan dojo/organisasi.
- Diuji: `npm run test:rls` → 110 lulus (PGlite). Popup diuji dengan data tiruan; belum dicoba di Supabase asli.

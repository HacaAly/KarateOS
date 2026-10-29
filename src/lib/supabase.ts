import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

const isPlaceholder = (v?: string) => !v || v.includes('YOUR_')

export const isSupabaseConfigured = !isPlaceholder(url) && !isPlaceholder(anonKey)

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi. Salin .env.example menjadi .env lalu isi dengan nilai dari project Supabase Anda.'

// Klien hanya dibuat jika konfigurasi lengkap. Hanya publishable/anon key yang boleh dipakai di frontend.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : (null as unknown as SupabaseClient)

/** Ubah error Supabase/jaringan menjadi pesan Bahasa Indonesia yang ramah. */
export function toMessage(err: unknown): string {
  if (!err) return 'Terjadi kesalahan tidak dikenal.'
  const e = err as { message?: string; code?: string }
  const msg = e.message ?? String(err)
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet dan URL Supabase Anda.'
  }
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
  }
  if (e.code === '23505') return 'Data sudah ada (duplikat).'
  if (e.code === '23503') return 'Data terkait tidak valid atau masih digunakan data lain.'
  if (e.code === '23514') return 'Data tidak memenuhi aturan validasi.'
  return msg
}

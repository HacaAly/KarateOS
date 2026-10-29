import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

/** Membaca profil; bila belum ada, membuatnya secara idempotent (ON CONFLICT DO NOTHING) lalu membaca ulang. */
export async function fetchOrCreateProfile(userId: string, fallbackName: string): Promise<Profile> {
  const first = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (first.error) throw first.error
  if (first.data) return first.data as Profile

  const created = await supabase
    .from('profiles')
    .upsert({ id: userId, full_name: fallbackName }, { onConflict: 'id', ignoreDuplicates: true })
  if (created.error) throw created.error

  const again = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (again.error) throw again.error
  return again.data as Profile
}

export async function updateProfile(userId: string, patch: { full_name: string; phone: string | null; avatar_url?: string | null }): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single()
  if (error) throw error
  return data as Profile
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error('Format foto harus JPG, PNG, atau WebP.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('Ukuran foto maksimal 2 MB.')
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error("Bucket Storage 'avatars' belum dibuat. Jalankan migrasi 0004_storage.sql di Supabase.")
    }
    throw error
  }
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

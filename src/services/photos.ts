import { supabase } from '../lib/supabase'

export type PhotoKind = 'organizations' | 'dojos' | 'athletes' | 'coaches'
const TABLE: Record<PhotoKind, { table: string; column: string }> = {
  organizations: { table: 'organizations', column: 'logo_url' },
  dojos: { table: 'dojos', column: 'logo_url' },
  athletes: { table: 'athletes', column: 'photo_url' },
  coaches: { table: 'coaches', column: 'photo_url' },
}
const BUCKET = 'avatars'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/** Perkecil (maks 1024 px) & kompres di browser agar foto kamera besar tetap muat di batas 2 MB. */
export async function prepareImage(file: File): Promise<File> {
  // Beberapa HP/pemilih file mengirim type kosong atau HEIC; tentukan dari ekstensi bila perlu.
  const ext0 = file.name.split('.').pop()?.toLowerCase() ?? ''
  const guessed = file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' } as Record<string, string>)[ext0] || ''
  if (!guessed.startsWith('image/')) throw new Error('File harus berupa gambar.')
  let out: File | null = null
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale))
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85))
    if (!blob || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    if (blob) out = new File([blob], 'foto', { type: blob.type })
  } catch { /* tidak bisa didekode browser */ }
  if (!out) {
    if (!ALLOWED.includes(guessed)) throw new Error('Format foto tidak didukung browser ini (mis. HEIC). Ubah kamera ke format "Paling kompatibel"/JPG, atau pilih foto lain.')
    out = file
  }
  if (out.size > MAX_BYTES) throw new Error('Ukuran foto masih melebihi 2 MB setelah dikompres. Pilih foto lain.')
  return out
}

function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

/** Unggah foto, simpan URL ke kolom data induk, lalu hapus file lama (best-effort). Izin ditegakkan RLS/Storage policy. */
export async function setEntityPhoto(kind: PhotoKind, id: string, file: File, previousUrl?: string | null): Promise<string> {
  const ready = await prepareImage(file)
  const ext = ready.type === 'image/png' ? 'png' : ready.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${kind}/${id}/foto-${Date.now()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, ready, { contentType: ready.type, upsert: false })
  if (up.error) {
    if (/bucket not found/i.test(up.error.message)) throw new Error("Bucket Storage 'avatars' belum dibuat. Jalankan migrasi 0004_storage.sql.")
    if (/row-level security|violates|unauthorized/i.test(up.error.message)) throw new Error('Anda tidak berwenang mengunggah foto ini. Pastikan migrasi 0007_entity_photos.sql sudah dijalankan.')
    throw up.error
  }
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const { table, column } = TABLE[kind]
  const { data, error } = await supabase.from(table).update({ [column]: url }).eq('id', id).select('id')
  if (error || !data || data.length === 0) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error ?? new Error('Foto tidak dapat disimpan: Anda tidak berwenang mengubah data ini.')
  }
  const old = pathFromUrl(previousUrl)
  if (old) await supabase.storage.from(BUCKET).remove([old])
  return url
}

export async function removeEntityPhoto(kind: PhotoKind, id: string, previousUrl: string | null): Promise<void> {
  const { table, column } = TABLE[kind]
  const { data, error } = await supabase.from(table).update({ [column]: null }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Anda tidak berwenang menghapus foto ini.')
  const old = pathFromUrl(previousUrl)
  if (old) await supabase.storage.from(BUCKET).remove([old])
}
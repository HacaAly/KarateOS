const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

/** Parse 'YYYY-MM-DD' sebagai tanggal lokal (menghindari pergeseran zona waktu). */
export function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
export const formatDate = (v?: string | null) => (v ? dateFmt.format(v.length <= 10 ? parseDate(v) : new Date(v)) : '—')
export const formatShortDate = (v?: string | null) => (v ? shortDateFmt.format(v.length <= 10 ? parseDate(v) : new Date(v)) : '—')
export const formatMonth = (v?: string | null) => (v ? monthFmt.format(parseDate(v)) : '—')
export const formatTime = (v?: string | null) => (v ? v.slice(0, 5).replace(':', '.') : '—')
export const formatRupiah = (n: number | string | null | undefined) => rupiahFmt.format(Number(n ?? 0))

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
export const todayISO = () => toISODate(new Date())
export const monthStartISO = (d = new Date()) => toISODate(new Date(d.getFullYear(), d.getMonth(), 1))

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function randomSuffix(len = 4): string {
  return Math.random().toString(36).slice(2, 2 + len)
}

export function ageFrom(birth?: string | null): number | null {
  if (!birth) return null
  const b = parseDate(birth)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const relFmt = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' })
/** "2 jam yang lalu", "kemarin", … dari ISO timestamp. */
export function formatRelative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return 'baru saja'
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return relFmt.format(Math.round(diff / 86400), 'day')
  return formatShortDate(iso)
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** Senin dari minggu yang memuat tanggal tersebut. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

import { initials } from '../../utils/format'

const palette = ['bg-brand-100 text-brand-800', 'bg-teal-100 text-teal-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800']
const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

export function Avatar({ name, src, size = 'md', rounded = 'full' }: { name?: string | null; src?: string | null; size?: keyof typeof sizes; rounded?: 'full' | 'xl' }) {
  const r = rounded === 'full' ? 'rounded-full' : 'rounded-xl'
  if (src) return <img src={src} alt={name ? `Foto ${name}` : ''} loading="lazy" className={`${sizes[size]} ${r} shrink-0 object-cover`} />
  return (
    <span aria-hidden="true" className={`${sizes[size]} ${r} ${palette[hash(name ?? '') % palette.length]} flex shrink-0 items-center justify-center font-display font-semibold`}>
      {initials(name)}
    </span>
  )
}

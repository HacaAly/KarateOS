import type { ReactNode } from 'react'
import type { Tone } from '../../utils/labels'

const tones: Record<Tone, string> = {
  gray: 'bg-ink-100 text-ink-700',
  green: 'bg-teal-50 text-teal-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-brand-50 text-brand-700',
  purple: 'bg-violet-50 text-violet-700',
}

/** Status tidak hanya dibedakan warna: sertakan teks dan, bila perlu, ikon. */
export function Badge({ tone = 'gray', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {icon}{children}
    </span>
  )
}

/** Logo KarateOS: dua jalur diagonal menyerupai simpul sabuk (obi) pada kotak navy. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="KarateOS" className="shrink-0">
      <defs>
        <linearGradient id="kos-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#1f2937" />
      <path d="M14 46 46 14" stroke="url(#kos-g)" strokeWidth="9" strokeLinecap="round" />
      <path d="M26 50 50 26" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      <path d="M14 30 30 14" stroke="#F8FAFC" strokeWidth="5" strokeLinecap="round" opacity=".9" />
    </svg>
  )
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>KarateOS</span>
    </span>
  )
}

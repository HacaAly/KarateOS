import type { ReactNode } from 'react'
import { Logo } from '../../components/ui/Logo'

const belts = ['#f8fafc', '#facc15', '#fb923c', '#22c55e', '#3b82f6', '#92400e', '#111827']

/** Panel visual: jalur diagonal bergaya sabuk (obi) dan tangga tujuh warna sabuk. Murni CSS/SVG, tanpa gambar. */
function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-ink-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="a1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#14B8A6" /></linearGradient>
          <radialGradient id="glow" cx=".2" cy=".1" r=".9"><stop offset="0" stopColor="#3B82F6" stopOpacity=".35" /><stop offset="1" stopColor="#111827" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="600" height="800" fill="url(#glow)" />
        <path d="M-80 640 560 0" stroke="url(#a1)" strokeWidth="64" strokeLinecap="round" opacity=".9" />
        <path d="M60 820 640 240" stroke="#8B5CF6" strokeWidth="26" strokeLinecap="round" opacity=".55" />
        <path d="M-120 420 300 0" stroke="#F8FAFC" strokeWidth="14" strokeLinecap="round" opacity=".18" />
      </svg>
      <div className="relative"><Logo light /></div>
      <div className="relative max-w-md">
        <h2 className="text-3xl font-semibold leading-tight xl:text-4xl">Dari ujian sabuk sampai podium, semuanya tercatat.</h2>
        <p className="mt-4 text-base text-ink-300">Kelola dojo, atlet, jadwal latihan, kehadiran, dan kompetisi di satu tempat, dengan hak akses yang dijaga langsung di database.</p>
        <div className="mt-8 flex h-2 max-w-xs overflow-hidden rounded-full ring-1 ring-white/20" aria-hidden="true">
          {belts.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
        </div>
      </div>
    </div>
  )
}

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />
      <div className="flex flex-col bg-white px-5 py-8 sm:px-10">
        <div className="mb-8 lg:hidden"><Logo /></div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm animate-fade-in">
            <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-7 text-center text-sm text-ink-500">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FormAlert({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const cls = { error: 'border-red-200 bg-red-50 text-red-800', success: 'border-teal-200 bg-teal-50 text-teal-800', info: 'border-brand-200 bg-brand-50 text-brand-800' }[kind]
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>
}

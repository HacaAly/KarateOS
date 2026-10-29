import { DatabaseZap } from 'lucide-react'
import { supabaseConfigError } from '../../lib/supabase'

export function ConfigMissing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700"><DatabaseZap size={24} /></div>
        <h1 className="text-lg font-semibold text-ink-900">Supabase belum dikonfigurasi</h1>
        <p className="mt-2 text-sm text-ink-700">{supabaseConfigError}</p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-700">
          <li>Buat project di <span className="font-medium">supabase.com</span>.</li>
          <li>Salin <code className="rounded bg-ink-100 px-1">.env.example</code> menjadi <code className="rounded bg-ink-100 px-1">.env</code>.</li>
          <li>Isi <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_URL</code> dan <code className="rounded bg-ink-100 px-1">VITE_SUPABASE_ANON_KEY</code>.</li>
          <li>Jalankan migrasi di <code className="rounded bg-ink-100 px-1">supabase/migrations/</code>, lalu restart <code className="rounded bg-ink-100 px-1">npm run dev</code>.</li>
        </ol>
        <p className="mt-4 text-xs text-ink-500">Jangan pernah memakai service_role key di frontend. Detail langkah ada di README.md.</p>
      </div>
    </div>
  )
}

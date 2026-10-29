export interface TabItem { key: string; label: string }
export function Tabs({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
      <div className="flex min-w-max gap-1 border-b border-ink-200">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => onChange(t.key)}
            className={`relative min-h-11 whitespace-nowrap px-3.5 text-sm font-semibold transition-colors sm:min-h-10 ${active === t.key ? 'text-brand-700' : 'text-ink-500 hover:text-ink-900'}`}>
            {t.label}
            <span aria-hidden="true" className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 transition-transform duration-200 ${active === t.key ? 'scale-x-100' : 'scale-x-0'}`} />
          </button>
        ))}
      </div>
    </div>
  )
}

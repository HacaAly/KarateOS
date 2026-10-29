import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, LogIn, MapPin, Plus, School, Search, Users } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect } from '../../components/ui/Field'
import { DojoFormModal } from './DojoFormModal'
import { athleteCountsByDojo, createDojo, type DojoInput } from '../../services/dojos'
import { toMessage } from '../../lib/supabase'
import { entityStatusLabel, toneFor } from '../../utils/labels'

const PAGE = 9

export default function DojosPage() {
  const access = useAccess()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState(params.get('org') ?? '')
  const [shown, setShown] = useState(PAGE)
  const counts = useAsync(athleteCountsByDojo, [])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const canCreate = access.adminOrgs.length > 0

  useEffect(() => {
    if (params.get('baru') === '1' && canCreate) {
      setOpen(true)
      setParams((p) => { const n = new URLSearchParams(p); n.delete('baru'); return n }, { replace: true })
    }
  }, [params, canCreate, setParams])

  const rows = access.dojos.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) && (!orgFilter || d.organization_id === orgFilter))

  async function submit(v: DojoInput) {
    setBusy(true)
    try {
      const d = await createDojo(v)
      toast.success('Dojo berhasil dibuat.'); setOpen(false); access.reload(); navigate(`/dojo/${d.id}`)
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Dojo" description="Dojo yang dapat Anda akses melalui keanggotaan atau izin organisasi."
        actions={<>
          <Link to="/dojo/gabung"><Button variant="secondary" icon={<LogIn size={16} />}>Gabung ke dojo</Button></Link>
          {canCreate && <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Buat dojo</Button>}
        </>} />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input type="search" aria-label="Cari dojo" placeholder="Cari nama dojo…" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE) }}
            className="min-h-11 w-full rounded-(--radius-control) border border-ink-200 bg-white py-2 pl-9 pr-3 text-base focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 sm:min-h-10 sm:text-sm" />
        </div>
        {access.organizations.length > 1 && (
          <FilterSelect label="Filter organisasi" value={orgFilter} onChange={(v) => { setOrgFilter(v); setShown(PAGE) }} placeholder="Semua organisasi"
            options={access.organizations.map((o) => ({ value: o.id, label: o.name }))} />)}
      </div>

      {access.error ? <Card><ErrorState message={access.error} onRetry={access.reload} /></Card>
        : access.loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-(--radius-card)" />)}</div>
        : rows.length === 0 ? (
          <Card><EmptyState icon={<School size={24} />} title={search || orgFilter ? 'Tidak ada dojo yang cocok' : 'Belum ada dojo yang dapat diakses'}
            description={canCreate ? 'Buat dojo pertama untuk organisasi Anda.' : 'Ajukan permohonan bergabung ke dojo, atau minta administrator organisasi menambahkan Anda.'}
            action={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Buat dojo</Button> : <Link to="/dojo/gabung"><Button icon={<LogIn size={16} />}>Gabung ke dojo</Button></Link>} /></Card>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.slice(0, shown).map((d) => {
                const n = counts.data?.[d.id]
                return (
                  <li key={d.id} className="min-w-0">
                    <Link to={`/dojo/${d.id}`} className="group flex h-full flex-col rounded-(--radius-card) border border-ink-200/80 bg-white p-5 shadow-(--shadow-card) transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-(--shadow-lift)">
                      <div className="flex items-start gap-3.5">
                        <Avatar name={d.name} src={d.logo_url} size="lg" rounded="xl" />
                        <div className="min-w-0 flex-1">
                          <h2 className="line-clamp-2 break-words text-base font-semibold text-ink-900">{d.name}</h2>
                          <p className="mt-0.5 truncate text-sm text-ink-500">{access.orgName(d.organization_id)}</p>
                        </div>
                        <Badge tone={toneFor.status(d.status)}>{entityStatusLabel[d.status]}</Badge>
                      </div>
                      <p className="mt-3 flex flex-1 items-start gap-1.5 text-sm text-ink-500"><MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="line-clamp-2">{d.address ?? 'Alamat belum diisi'}</span></p>
                      <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                        <span className="flex items-center gap-1.5 text-ink-500"><Users size={15} aria-hidden="true" />{n === undefined ? (access.canStaffDojo(d.id) ? '0 atlet' : 'Anggota') : `${n} atlet`}</span>
                        <span className="flex items-center gap-1 font-semibold text-brand-700">{access.canManageDojo(d.id) ? 'Pengelola' : access.canStaffDojo(d.id) ? 'Pelatih' : 'Anggota'}<ChevronRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {rows.length > shown && <div className="mt-5 text-center"><Button variant="secondary" onClick={() => setShown((c) => c + PAGE)}>Tampilkan lebih banyak ({rows.length - shown})</Button></div>}
          </>
        )}
      <DojoFormModal open={open} onClose={() => setOpen(false)} organizations={access.adminOrgs} defaultOrgId={orgFilter || undefined} busy={busy} onSubmit={(v) => void submit(v)} />
    </>
  )
}

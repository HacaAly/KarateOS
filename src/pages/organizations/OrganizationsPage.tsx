import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Plus, Search, School } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAccess } from '../../hooks/useAccess'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States'
import { createOrganization } from '../../services/organizations'
import { toMessage } from '../../lib/supabase'
import { entityStatusLabel, orgRoleLabel, toneFor } from '../../utils/labels'

const PAGE = 9

export default function OrganizationsPage() {
  const { user } = useAuth()
  const access = useAccess()
  const toast = useToast()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const rows = access.organizations.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 3) { setError('Nama organisasi minimal 3 karakter.'); return }
    setError(undefined); setBusy(true)
    try {
      const org = await createOrganization(user!.id, { name, description: description.trim() || null })
      toast.success('Organisasi dibuat. Anda menjadi Owner.')
      setOpen(false); setName(''); setDescription('')
      access.reload()
      navigate(`/organisasi/${org.id}`)
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Organisasi" description="Organisasi karate yang dapat Anda akses."
        actions={<Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Buat organisasi</Button>} />

      {access.organizations.length > 3 && (
        <div className="relative mb-5 max-w-md">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input type="search" aria-label="Cari organisasi" placeholder="Cari organisasi…" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE) }}
            className="min-h-11 w-full rounded-(--radius-control) border border-ink-200 bg-white py-2 pl-9 pr-3 text-base focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 sm:min-h-10 sm:text-sm" />
        </div>
      )}

      {access.error ? <Card><ErrorState message={access.error} onRetry={access.reload} /></Card>
        : access.loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-(--radius-card)" />)}</div>
        : rows.length === 0 ? (
          <Card><EmptyState icon={<Building2 size={24} />} title={search ? 'Tidak ada organisasi yang cocok' : 'Belum ada organisasi'}
            description={search ? 'Coba kata kunci lain.' : 'Buat organisasi pertama Anda. Anda otomatis menjadi Owner dan bisa menambahkan dojo.'}
            action={!search ? <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Buat organisasi</Button> : undefined} /></Card>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.slice(0, shown).map((o) => {
                const dojoCount = access.dojos.filter((d) => d.organization_id === o.id).length
                const role = access.isPlatformAdmin ? 'Admin platform' : access.isOrgOwner(o.id) ? orgRoleLabel.owner : access.isOrgAdmin(o.id) ? orgRoleLabel.admin : 'Anggota dojo'
                return (
                  <li key={o.id} className="min-w-0">
                    <Link to={`/organisasi/${o.id}`} className="group flex h-full flex-col rounded-(--radius-card) border border-ink-200/80 bg-white p-5 shadow-(--shadow-card) transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-(--shadow-lift)">
                      <div className="flex items-start gap-3.5">
                        <Avatar name={o.name} src={o.logo_url} size="lg" rounded="xl" />
                        <div className="min-w-0 flex-1">
                          <h2 className="line-clamp-2 break-words text-base font-semibold text-ink-900">{o.name}</h2>
                          <div className="mt-1.5"><Badge tone={toneFor.status(o.status)}>{entityStatusLabel[o.status]}</Badge></div>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-500">{o.description ?? 'Belum ada deskripsi.'}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                        <span className="flex items-center gap-1.5 text-ink-500"><School size={15} aria-hidden="true" />{dojoCount} dojo</span>
                        <span className="flex items-center gap-1 font-semibold text-brand-700">{role}<ChevronRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {rows.length > shown && <div className="mt-5 text-center"><Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>Tampilkan lebih banyak ({rows.length - shown})</Button></div>}
          </>
        )}

      <Modal open={open} title="Buat organisasi" onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="org-form" loading={busy}>Buat organisasi</Button></>}>
        <form id="org-form" onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input label="Nama organisasi" value={name} onChange={(e) => setName(e.target.value)} error={error} required />
          <Textarea label="Deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </form>
      </Modal>
    </>
  )
}

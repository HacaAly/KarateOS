import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect, Input, Select } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DataTable, Toolbar, type Column } from '../../components/tables/DataTable'
import { addEntry, createCompetition, deleteCompetition, listCompetitions, listEntries, removeEntry, updateCompetition, type CompetitionInput } from '../../services/competitions'
import { listAthletes } from '../../services/athletes'
import { toMessage } from '../../lib/supabase'
import { competitionStatusLabel, options, toneFor } from '../../utils/labels'
import { formatShortDate } from '../../utils/format'
import type { Competition, CompetitionStatus } from '../../types/database'

const blank = { organization_id: '', name: '', organizer: '', location: '', start_date: '', end_date: '', category: '', status: 'upcoming' as CompetitionStatus }

export default function CompetitionsPage() {
  const access = useAccess()
  const toast = useToast()
  const [orgId, setOrgId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Competition | null>(null)
  const [del, setDel] = useState<Competition | null>(null)
  const [entriesFor, setEntriesFor] = useState<Competition | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const list = useAsync(() => listCompetitions(orgId || undefined), [orgId])
  const canCreate = access.adminOrgs.length > 0

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(edit ? { organization_id: edit.organization_id, name: edit.name, organizer: edit.organizer ?? '', location: edit.location ?? '', start_date: edit.start_date,
      end_date: edit.end_date ?? '', category: edit.category ?? '', status: edit.status }
      : { ...blank, organization_id: orgId || (access.adminOrgs.length === 1 ? access.adminOrgs[0].id : '') })
  }, [open, edit, orgId, access.adminOrgs])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.organization_id) errs.organization_id = 'Pilih organisasi.'
    if (f.name.trim().length < 3) errs.name = 'Nama minimal 3 karakter.'
    if (!f.start_date) errs.start_date = 'Tanggal mulai wajib diisi.'
    if (f.end_date && f.start_date && f.end_date < f.start_date) errs.end_date = 'Tanggal selesai tidak boleh sebelum tanggal mulai.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload: CompetitionInput = { organization_id: f.organization_id, name: f.name.trim(), organizer: f.organizer.trim() || null, location: f.location.trim() || null,
      start_date: f.start_date, end_date: f.end_date || null, category: f.category.trim() || null, status: f.status }
    setBusy(true)
    try {
      if (edit) { const { organization_id: _o, ...patch } = payload; void _o; await updateCompetition(edit.id, patch) } else await createCompetition(payload)
      toast.success(edit ? 'Kompetisi diperbarui.' : 'Kompetisi dibuat.'); setOpen(false); list.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!del) return
    setBusy(true)
    try { await deleteCompetition(del.id); toast.success('Kompetisi dihapus.'); setDel(null); list.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const rows = list.data?.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) && (!status || c.status === status)) ?? null
  const cols: Column<Competition>[] = [
    { key: 'name', header: 'Kompetisi', render: (c) => <div><p className="font-medium">{c.name}</p><p className="text-xs text-ink-500">{c.organizer ?? 'Penyelenggara belum diisi'}</p></div> },
    { key: 'org', header: 'Organisasi', render: (c) => access.orgName(c.organization_id) },
    { key: 'date', header: 'Tanggal', render: (c) => c.end_date && c.end_date !== c.start_date ? `${formatShortDate(c.start_date)} – ${formatShortDate(c.end_date)}` : formatShortDate(c.start_date) },
    { key: 'loc', header: 'Lokasi', render: (c) => c.location ?? '—' },
    { key: 'st', header: 'Status', render: (c) => <Badge tone={toneFor.status(c.status)}>{competitionStatusLabel[c.status]}</Badge> },
    { key: 'act', header: '', className: 'text-right', render: (c) => (
      <div className="flex justify-end gap-1">
        {access.anyStaff && <Button size="sm" variant="secondary" icon={<Users size={14} />} onClick={() => setEntriesFor(c)}>Peserta</Button>}
        {access.isOrgAdmin(c.organization_id) && <>
          <Button size="sm" variant="ghost" aria-label="Ubah" icon={<Pencil size={16} />} onClick={() => { setEdit(c); setOpen(true) }} />
          <Button size="sm" variant="ghost" aria-label="Hapus" icon={<Trash2 size={16} />} onClick={() => setDel(c)} /></>}
      </div>) },
  ]

  return (
    <>
      <PageHeader title="Kompetisi" description="Kompetisi organisasi dan pendaftaran atlet."
        actions={canCreate ? <Button icon={<Plus size={16} />} onClick={() => { setEdit(null); setOpen(true) }}>Buat kompetisi</Button> : undefined} />
      <Card className="!p-0">
        <Toolbar search={search} onSearch={setSearch} placeholder="Cari kompetisi…">
          {access.organizations.length > 1 && <FilterSelect label="Filter organisasi" value={orgId} onChange={setOrgId} placeholder="Semua organisasi" options={access.organizations.map((o) => ({ value: o.id, label: o.name }))} />}
          <FilterSelect label="Filter status" value={status} onChange={setStatus} placeholder="Semua status" options={options(competitionStatusLabel)} />
        </Toolbar>
        <DataTable columns={cols} rows={rows} rowKey={(c) => c.id} loading={list.loading} error={list.error} onRetry={list.reload}
          empty={{ title: 'Belum ada kompetisi', description: canCreate ? 'Buat kompetisi pertama.' : undefined }} />
      </Card>

      <Modal open={open} title={edit ? 'Ubah kompetisi' : 'Buat kompetisi'} onClose={() => setOpen(false)} wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="comp-form" loading={busy}>Simpan</Button></>}>
        <form id="comp-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2"><Select label="Organisasi" required value={f.organization_id} disabled={!!edit} onChange={(e) => setF({ ...f, organization_id: e.target.value })} error={errors.organization_id}
            placeholder="Pilih organisasi" options={access.adminOrgs.map((o) => ({ value: o.id, label: o.name }))} /></div>
          <div className="sm:col-span-2"><Input label="Nama kompetisi" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required /></div>
          <Input label="Penyelenggara" value={f.organizer} onChange={(e) => setF({ ...f, organizer: e.target.value })} maxLength={160} />
          <Input label="Lokasi" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={200} />
          <Input label="Tanggal mulai" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} error={errors.start_date} required />
          <Input label="Tanggal selesai" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} error={errors.end_date} />
          <Input label="Kategori" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} maxLength={200} placeholder="Kata, Kumite, usia…" />
          <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CompetitionStatus })} options={options(competitionStatusLabel)} />
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus kompetisi" loading={busy} onCancel={() => setDel(null)} onConfirm={() => void remove()}
        message={<>Hapus <strong>{del?.name}</strong>? Pendaftaran peserta ikut terhapus; prestasi terkait tetap tersimpan tanpa tautan kompetisi.</>} />
      {entriesFor && <EntriesModal competition={entriesFor} onClose={() => setEntriesFor(null)} />}
    </>
  )
}

function EntriesModal({ competition, onClose }: { competition: Competition; onClose: () => void }) {
  const access = useAccess()
  const toast = useToast()
  const entries = useAsync(() => listEntries(competition.id), [competition.id])
  const orgDojos = access.staffDojos.filter((d) => d.organization_id === competition.organization_id)
  const athletes = useAsync(() => listAthletes({ status: 'active' }), [])
  const [athleteId, setAthleteId] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const registered = new Set((entries.data ?? []).map((e) => e.athlete_id))
  const candidates = (athletes.data ?? []).filter((a) => orgDojos.some((d) => d.id === a.dojo_id) && !registered.has(a.id))

  async function add() {
    const a = candidates.find((x) => x.id === athleteId)
    if (!a) { toast.error('Pilih atlet.'); return }
    setBusy(true)
    try { await addEntry(competition.id, a.id, a.dojo_id, category.trim() || null); toast.success('Atlet didaftarkan.'); setAthleteId(''); setCategory(''); entries.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove(id: string) {
    try { await removeEntry(id); entries.reload() } catch (err) { toast.error(toMessage(err)) }
  }

  return (
    <Modal open title={`Peserta · ${competition.name}`} onClose={onClose} wide>
      {orgDojos.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1"><Select label="Atlet" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} placeholder="Pilih atlet" options={candidates.map((a) => ({ value: a.id, label: `${a.full_name} — ${access.dojoName(a.dojo_id)}` }))} /></div>
          <div className="flex-1"><Input label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={120} /></div>
          <Button onClick={() => void add()} loading={busy}>Daftarkan</Button>
        </div>)}
      <DataTable columns={[
        { key: 'a', header: 'Atlet', render: (e) => e.athletes?.full_name ?? '—' },
        { key: 'd', header: 'Dojo', render: (e) => access.dojoName(e.dojo_id) },
        { key: 'c', header: 'Kategori', render: (e) => e.category ?? '—' },
        { key: 'x', header: '', className: 'text-right', render: (e) => access.canStaffDojo(e.dojo_id) ? <Button size="sm" variant="ghost" aria-label="Batalkan pendaftaran" icon={<Trash2 size={16} />} onClick={() => void remove(e.id)} /> : null },
      ]} rows={entries.data} rowKey={(e) => e.id} loading={entries.loading} error={entries.error} onRetry={entries.reload} empty={{ title: 'Belum ada peserta terdaftar' }} />
    </Modal>
  )
}

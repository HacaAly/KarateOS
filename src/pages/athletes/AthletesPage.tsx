import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useQueryParam } from '../../hooks/useQueryParam'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { DataTable, Toolbar, type Column } from '../../components/tables/DataTable'
import { DojoSelectField } from '../../components/forms/DojoSelectField'
import { createAthlete, listAthletes, updateAthlete, type AthleteInput } from '../../services/athletes'
import { toMessage } from '../../lib/supabase'
import { athleteStatusLabel, BELTS, beltLabel, options, toneFor } from '../../utils/labels'
import { ageFrom, todayISO } from '../../utils/format'
import type { Athlete, AthleteStatus, BeltRank } from '../../types/database'

export interface AthleteFormState {
  dojo_id: string; full_name: string; birth_date: string; gender: '' | 'L' | 'P'; member_number: string
  belt_rank: BeltRank; status: AthleteStatus; guardian_name: string; guardian_phone: string
}
export const emptyAthlete = (dojo_id = ''): AthleteFormState => ({
  dojo_id, full_name: '', birth_date: '', gender: '', member_number: '', belt_rank: 'putih', status: 'active', guardian_name: '', guardian_phone: '',
})

export function AthleteFormModal({ open, onClose, athlete, dojos, defaultDojo, onSaved }:
  { open: boolean; onClose: () => void; athlete?: Athlete | null; dojos: { id: string; name: string; organization_id: string; address: null; description: null; contact: null; logo_url: null; status: 'active' | 'inactive'; created_at: string; updated_at: string }[]; defaultDojo?: string; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<AthleteFormState>(emptyAthlete())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(athlete ? {
      dojo_id: athlete.dojo_id, full_name: athlete.full_name, birth_date: athlete.birth_date ?? '', gender: athlete.gender ?? '',
      member_number: athlete.member_number ?? '', belt_rank: athlete.belt_rank, status: athlete.status,
      guardian_name: athlete.guardian_name ?? '', guardian_phone: athlete.guardian_phone ?? '',
    } : emptyAthlete(defaultDojo ?? (dojos.length === 1 ? dojos[0].id : '')))
  }, [open, athlete, defaultDojo, dojos])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.dojo_id) errs.dojo_id = 'Pilih dojo.'
    if (f.full_name.trim().length < 2) errs.full_name = 'Nama minimal 2 karakter.'
    if (f.birth_date && f.birth_date > todayISO()) errs.birth_date = 'Tanggal lahir tidak boleh di masa depan.'
    if (f.guardian_phone && !/^[0-9+()\-\s]{6,30}$/.test(f.guardian_phone)) errs.guardian_phone = 'Nomor telepon tidak valid.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload: AthleteInput = {
      dojo_id: f.dojo_id, full_name: f.full_name.trim(), birth_date: f.birth_date || null, gender: f.gender || null,
      member_number: f.member_number.trim() || null, belt_rank: f.belt_rank, status: f.status,
      guardian_name: f.guardian_name.trim() || null, guardian_phone: f.guardian_phone.trim() || null,
    }
    setBusy(true)
    try {
      if (athlete) { const { dojo_id: _d, ...patch } = payload; void _d; await updateAthlete(athlete.id, patch) } else await createAthlete(payload)
      toast.success(athlete ? 'Data atlet diperbarui.' : 'Atlet ditambahkan.'); onSaved(); onClose()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} title={athlete ? 'Ubah data atlet' : 'Tambah atlet'} onClose={onClose} wide
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button type="submit" form="athlete-form" loading={busy}>Simpan</Button></>}>
      <form id="athlete-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2"><DojoSelectField dojos={dojos as never} value={f.dojo_id} disabled={!!athlete} onChange={(v) => setF({ ...f, dojo_id: v })} error={errors.dojo_id} /></div>
        <div className="sm:col-span-2"><Input label="Nama lengkap" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} error={errors.full_name} required /></div>
        <Input label="Tanggal lahir" type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} error={errors.birth_date} max={todayISO()} />
        <Select label="Jenis kelamin" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value as '' | 'L' | 'P' })} placeholder="—" options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} />
        <Input label="Nomor anggota" value={f.member_number} onChange={(e) => setF({ ...f, member_number: e.target.value })} maxLength={40} hint="Harus unik di dalam dojo." />
        <Select label="Tingkat sabuk" value={f.belt_rank} onChange={(e) => setF({ ...f, belt_rank: e.target.value as BeltRank })} options={BELTS.map((b) => ({ value: b, label: beltLabel[b] }))} />
        <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AthleteStatus })} options={options(athleteStatusLabel)} />
        <span className="hidden sm:block" />
        <Input label="Nama wali" value={f.guardian_name} onChange={(e) => setF({ ...f, guardian_name: e.target.value })} maxLength={120} />
        <Input label="Telepon wali" type="tel" value={f.guardian_phone} onChange={(e) => setF({ ...f, guardian_phone: e.target.value })} error={errors.guardian_phone} />
      </form>
    </Modal>
  )
}

export default function AthletesPage() {
  const access = useAccess()
  const navigate = useNavigate()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const [belt, setBelt] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const list = useAsync(() => listAthletes({ dojoId: dojoId || undefined, belt: belt || undefined, status: status || undefined }), [dojoId, belt, status])
  const canAdd = access.staffDojos.length > 0

  const rows = list.data?.filter((a) => a.full_name.toLowerCase().includes(search.toLowerCase()) || (a.member_number ?? '').toLowerCase().includes(search.toLowerCase())) ?? null
  const cols: Column<Athlete>[] = [
    { key: 'name', header: 'Nama', render: (a) => <div className="flex min-w-0 items-center gap-3"><Avatar name={a.full_name} src={a.photo_url} size="sm" /><div className="min-w-0"><Link to={`/atlet/${a.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{a.full_name}</Link>
      <p className="text-xs text-ink-500">{a.member_number ?? 'Tanpa nomor'}{ageFrom(a.birth_date) !== null ? ` · ${ageFrom(a.birth_date)} th` : ''}</p></div></div> },
    { key: 'dojo', header: 'Dojo', render: (a) => access.dojoName(a.dojo_id) },
    { key: 'belt', header: 'Sabuk', render: (a) => beltLabel[a.belt_rank] },
    { key: 'status', header: 'Status', render: (a) => <Badge tone={toneFor.status(a.status)}>{athleteStatusLabel[a.status]}</Badge> },
  ]

  return (
    <>
      <PageHeader title="Atlet" description="Data atlet sesuai hak akses Anda."
        actions={canAdd ? <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Tambah atlet</Button> : undefined} />
      <Card className="!p-0">
        <Toolbar search={search} onSearch={setSearch} placeholder="Cari nama atau nomor anggota…">
          <FilterSelect label="Filter dojo" value={dojoId} onChange={setDojoId} placeholder="Semua dojo" options={access.dojos.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Filter sabuk" value={belt} onChange={setBelt} placeholder="Semua sabuk" options={BELTS.map((b) => ({ value: b, label: beltLabel[b] }))} />
          <FilterSelect label="Filter status" value={status} onChange={setStatus} placeholder="Semua status" options={options(athleteStatusLabel)} />
        </Toolbar>
        <DataTable columns={cols} rows={rows} rowKey={(a) => a.id} loading={list.loading} error={list.error} onRetry={list.reload} onRowClick={(a) => navigate(`/atlet/${a.id}`)}
          empty={{ title: 'Belum ada atlet', description: canAdd ? 'Tambahkan atlet pertama.' : 'Tidak ada data atlet yang dapat Anda akses.' }} />
      </Card>
      <AthleteFormModal open={open} onClose={() => setOpen(false)} dojos={access.staffDojos as never} defaultDojo={dojoId || undefined} onSaved={list.reload} />
    </>
  )
}

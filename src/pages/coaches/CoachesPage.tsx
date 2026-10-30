import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useQueryParam } from '../../hooks/useQueryParam'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PhotoUploader } from '../../components/ui/PhotoUploader'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect, Input, Select } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DataTable, Toolbar, type Column } from '../../components/tables/DataTable'
import { DojoSelectField } from '../../components/forms/DojoSelectField'
import { createCoach, deleteCoach, listCoaches, updateCoach, type CoachInput } from '../../services/coaches'
import { toMessage } from '../../lib/supabase'
import { BELTS, beltLabel, entityStatusLabel, options, toneFor } from '../../utils/labels'
import type { BeltRank, Coach } from '../../types/database'

export default function CoachesPage() {
  const access = useAccess()
  const toast = useToast()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Coach | null>(null)
  const [del, setDel] = useState<Coach | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [f, setF] = useState({ dojo_id: '', full_name: '', phone: '', belt_rank: '' as '' | BeltRank, license_number: '', status: 'active' as 'active' | 'inactive' })
  const list = useAsync(() => listCoaches(dojoId || undefined), [dojoId])
  const canManageAny = access.anyManage

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(edit ? { dojo_id: edit.dojo_id, full_name: edit.full_name, phone: edit.phone ?? '', belt_rank: edit.belt_rank ?? '', license_number: edit.license_number ?? '', status: edit.status }
      : { dojo_id: dojoId || (access.manageableDojos.length === 1 ? access.manageableDojos[0].id : ''), full_name: '', phone: '', belt_rank: '', license_number: '', status: 'active' })
  }, [open, edit, dojoId, access.manageableDojos])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.dojo_id) errs.dojo_id = 'Pilih dojo.'
    if (f.full_name.trim().length < 2) errs.full_name = 'Nama minimal 2 karakter.'
    if (f.phone && !/^[0-9+()\-\s]{6,30}$/.test(f.phone)) errs.phone = 'Nomor telepon tidak valid.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const payload: CoachInput = { dojo_id: f.dojo_id, full_name: f.full_name.trim(), phone: f.phone.trim() || null, belt_rank: f.belt_rank || null, license_number: f.license_number.trim() || null, status: f.status }
    setBusy(true)
    try {
      if (edit) { const { dojo_id: _d, ...patch } = payload; void _d; await updateCoach(edit.id, patch) } else await createCoach(payload)
      toast.success(edit ? 'Data pelatih diperbarui.' : 'Pelatih ditambahkan.'); setOpen(false); list.reload(); access.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!del) return
    setBusy(true)
    try { await deleteCoach(del.id); toast.success('Pelatih dihapus.'); setDel(null); list.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const rows = list.data?.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase())) ?? null
  const cols: Column<Coach>[] = [
    { key: 'name', header: 'Nama', render: (c) => <div className="flex min-w-0 items-center gap-3"><Avatar name={c.full_name} src={c.photo_url} size="sm" /><div className="min-w-0"><p className="font-medium">{c.full_name}</p><p className="text-xs text-ink-500">{c.license_number ? `Lisensi ${c.license_number}` : 'Tanpa nomor lisensi'}</p></div></div> },
    { key: 'dojo', header: 'Dojo', render: (c) => access.dojoName(c.dojo_id) },
    { key: 'belt', header: 'Sabuk', render: (c) => (c.belt_rank ? beltLabel[c.belt_rank] : '—') },
    { key: 'phone', header: 'Telepon', render: (c) => c.phone ?? '—' },
    { key: 'status', header: 'Status', render: (c) => <Badge tone={toneFor.status(c.status)}>{entityStatusLabel[c.status]}</Badge> },
    { key: 'act', header: '', className: 'text-right', render: (c) => access.canManageDojo(c.dojo_id) ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" aria-label="Ubah" icon={<Pencil size={16} />} onClick={() => { setEdit(c); setOpen(true) }} />
        <Button size="sm" variant="ghost" aria-label="Hapus" icon={<Trash2 size={16} />} onClick={() => setDel(c)} />
      </div>) : null },
  ]

  return (
    <>
      <PageHeader title="Pelatih" description="Pelatih dan dojo yang menjadi tanggung jawabnya."
        actions={canManageAny ? <Button icon={<Plus size={16} />} onClick={() => { setEdit(null); setOpen(true) }}>Tambah pelatih</Button> : undefined} />
      <Card className="!p-0">
        <Toolbar search={search} onSearch={setSearch} placeholder="Cari pelatih…">
          <FilterSelect label="Filter dojo" value={dojoId} onChange={setDojoId} placeholder="Semua dojo" options={access.dojos.map((d) => ({ value: d.id, label: d.name }))} />
        </Toolbar>
        <DataTable columns={cols} rows={rows} rowKey={(c) => c.id} loading={list.loading} error={list.error} onRetry={list.reload}
          empty={{ title: 'Belum ada pelatih', description: canManageAny ? 'Tambahkan pelatih pertama.' : undefined }} />
      </Card>
      <Modal open={open} title={edit ? 'Ubah pelatih' : 'Tambah pelatih'} onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="coach-form" loading={busy}>Simpan</Button></>}>
        {edit && <div className="mb-4"><PhotoUploader kind="coaches" id={edit.id} name={edit.full_name} url={edit.photo_url} canEdit rounded="full" onChanged={(u) => { setEdit({ ...edit, photo_url: u }); list.reload() }} /></div>}
        <form id="coach-form" onSubmit={submit} className="space-y-4" noValidate>
          <DojoSelectField dojos={access.manageableDojos} value={f.dojo_id} disabled={!!edit} onChange={(v) => setF({ ...f, dojo_id: v })} error={errors.dojo_id} />
          <Input label="Nama lengkap" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} error={errors.full_name} required />
          <Input label="Telepon" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
          <Select label="Tingkat sabuk" value={f.belt_rank} onChange={(e) => setF({ ...f, belt_rank: e.target.value as '' | BeltRank })} placeholder="—" options={BELTS.map((b) => ({ value: b, label: beltLabel[b] }))} />
          <Input label="Nomor lisensi" value={f.license_number} onChange={(e) => setF({ ...f, license_number: e.target.value })} maxLength={60} />
          <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'active' | 'inactive' })} options={options(entityStatusLabel)} />
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus pelatih" loading={busy} onCancel={() => setDel(null)} onConfirm={() => void remove()}
        message={<>Hapus <strong>{del?.full_name}</strong>? Jadwal yang ditugaskan padanya akan menjadi tanpa pelatih.</>} />
    </>
  )
}

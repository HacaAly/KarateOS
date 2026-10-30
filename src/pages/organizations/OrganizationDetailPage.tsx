import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { PhotoUploader } from '../../components/ui/PhotoUploader'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { CascadeDeleteDialog } from '../../components/ui/CascadeDeleteDialog'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { DataTable, type Column } from '../../components/tables/DataTable'
import {
  addOrgMember, deleteOrganizationCascade, organizationDeletePreview, getOrganization, listOrgDojos, listOrgMembers, removeOrgMember,
  updateOrganization, updateOrgMemberRole,
} from '../../services/organizations'
import { toMessage } from '../../lib/supabase'
import { entityStatusLabel, options, orgRoleLabel, toneFor } from '../../utils/labels'
import { formatDate } from '../../utils/format'
import type { Dojo, OrganizationMemberRow, OrgRole } from '../../types/database'

export default function OrganizationDetailPage() {
  const { id = '' } = useParams()
  const access = useAccess()
  const toast = useToast()
  const navigate = useNavigate()
  const org = useAsync(() => getOrganization(id), [id])
  const members = useAsync(() => listOrgMembers(id), [id])
  const dojos = useAsync(() => listOrgDojos(id), [id])

  const isAdmin = access.isOrgAdmin(id)
  const isOwner = access.isOrgOwner(id)

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', status: 'active' as 'active' | 'inactive' })
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [add, setAdd] = useState({ email: '', role: 'member' as OrgRole })
  const [removeTarget, setRemoveTarget] = useState<OrganizationMemberRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (org.loading && !org.data) return <Spinner />
  if (org.error) return <Card><ErrorState message={org.error} onRetry={org.reload} /></Card>
  if (!org.data) return <Card><EmptyState title="Organisasi tidak ditemukan" description="Organisasi tidak ada atau Anda tidak memiliki akses." action={<Link to="/organisasi"><Button variant="secondary">Kembali</Button></Link>} /></Card>
  const o = org.data

  function openEdit() { setForm({ name: o.name, description: o.description ?? '', status: o.status }); setEditOpen(true) }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 3) { toast.error('Nama organisasi minimal 3 karakter.'); return }
    setBusy(true)
    try {
      await updateOrganization(id, { name: form.name, description: form.description.trim() || null, status: form.status })
      toast.success('Organisasi diperbarui.'); setEditOpen(false); org.reload(); access.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(add.email.trim())) { toast.error('Format email tidak valid.'); return }
    setBusy(true)
    try {
      await addOrgMember(id, add.email.trim(), add.role)
      toast.success('Anggota ditambahkan.'); setAddOpen(false); setAdd({ email: '', role: 'member' }); members.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  async function changeRole(m: OrganizationMemberRow, role: OrgRole) {
    try { await updateOrgMemberRole(m.id, role); toast.success('Peran diperbarui.'); members.reload(); access.reload() }
    catch (err) { toast.error(toMessage(err)); members.reload() }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setBusy(true)
    try { await removeOrgMember(removeTarget.id); toast.success('Anggota dihapus.'); setRemoveTarget(null); members.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  async function confirmDelete() {
    setBusy(true)
    try { await deleteOrganizationCascade(id); toast.success('Organisasi dan seluruh data terikat dihapus.'); access.reload(); navigate('/organisasi', { replace: true }) }
    catch (err) { toast.error(toMessage(err)); setDeleteOpen(false) } finally { setBusy(false) }
  }

  async function deactivate() {
    setBusy(true)
    try { await updateOrganization(id, { name: o.name, description: o.description, status: 'inactive' }); toast.success('Organisasi dinonaktifkan. Data tetap tersimpan.'); setDeleteOpen(false); org.reload(); access.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const memberCols: Column<OrganizationMemberRow>[] = [
    { key: 'name', header: 'Nama', render: (m) => <div><p className="font-medium">{m.full_name || '(tanpa nama)'}</p>{m.email && <p className="text-xs text-ink-500">{m.email}</p>}</div> },
    { key: 'role', header: 'Peran', render: (m) => isOwner ? (
        <select aria-label={`Peran ${m.full_name}`} value={m.role} onChange={(e) => void changeRole(m, e.target.value as OrgRole)} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-base sm:text-sm">
          {options(orgRoleLabel).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>) : <Badge tone={m.role === 'member' ? 'gray' : 'blue'}>{orgRoleLabel[m.role]}</Badge> },
    { key: 'since', header: 'Bergabung', render: (m) => formatDate(m.created_at) },
    { key: 'act', header: '', className: 'text-right', render: (m) => (isOwner || (isAdmin && m.role === 'member')) ? (
        <Button variant="ghost" size="sm" aria-label="Hapus anggota" icon={<Trash2 size={16} />} onClick={() => setRemoveTarget(m)} />) : null },
  ]

  const dojoCols: Column<Dojo>[] = [
    { key: 'name', header: 'Nama dojo', render: (d) => <Link to={`/dojo/${d.id}`} className="font-medium text-brand-700 hover:underline">{d.name}</Link> },
    { key: 'address', header: 'Alamat', render: (d) => d.address ?? '—' },
    { key: 'status', header: 'Status', render: (d) => <Badge tone={toneFor.status(d.status)}>{entityStatusLabel[d.status]}</Badge> },
  ]

  return (
    <>
      <PageHeader title={o.name} description={o.description ?? 'Tidak ada deskripsi.'}
        actions={<>
          <Link to="/organisasi"><Button variant="secondary">Kembali</Button></Link>
          {isAdmin && <Button variant="secondary" onClick={openEdit}>Ubah informasi</Button>}
          {isOwner && <Button variant="danger" onClick={() => setDeleteOpen(true)}>Hapus</Button>}
        </>} />
      <Card className="mb-4"><PhotoUploader kind="organizations" id={id} name={o.name} url={o.logo_url} canEdit={isAdmin} onChanged={() => { org.reload(); access.reload() }} /></Card>
      <div className="mb-4 flex items-center gap-2"><Badge tone={toneFor.status(o.status)}>{entityStatusLabel[o.status]}</Badge><span className="text-xs text-ink-500">Dibuat {formatDate(o.created_at)}</span></div>

      <div className="grid gap-6">
        <Card title="Anggota organisasi" className="!p-0" action={isAdmin ? <Button size="sm" icon={<UserPlus size={16} />} onClick={() => setAddOpen(true)}>Tambah anggota</Button> : undefined}>
          <DataTable columns={memberCols} rows={members.data} rowKey={(m) => m.id} loading={members.loading} error={members.error} onRetry={members.reload}
            empty={{ title: 'Belum ada anggota' }} />
        </Card>
        <Card title="Dojo di bawah organisasi" className="!p-0" action={isAdmin ? <Link to={`/dojo?org=${id}&baru=1`}><Button size="sm" icon={<Plus size={16} />}>Buat dojo</Button></Link> : undefined}>
          <DataTable columns={dojoCols} rows={dojos.data} rowKey={(d) => d.id} loading={dojos.loading} error={dojos.error} onRetry={dojos.reload}
            empty={{ title: 'Belum ada dojo', description: isAdmin ? 'Buat dojo pertama untuk organisasi ini.' : 'Anda hanya melihat dojo yang menjadi akses Anda.' }} />
        </Card>
      </div>

      <Modal open={editOpen} title="Ubah informasi organisasi" onClose={() => setEditOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button><Button type="submit" form="edit-org" loading={busy}>Simpan</Button></>}>
        <form id="edit-org" onSubmit={saveEdit} className="space-y-4" noValidate>
          <Input label="Nama organisasi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Textarea label="Deskripsi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} options={options(entityStatusLabel)} />
        </form>
      </Modal>

      <Modal open={addOpen} title="Tambah anggota organisasi" onClose={() => setAddOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Batal</Button><Button type="submit" form="add-member" loading={busy}>Tambah</Button></>}>
        <form id="add-member" onSubmit={submitAdd} className="space-y-4" noValidate>
          <Input label="Email pengguna" type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} hint="Pengguna harus sudah mendaftar di KarateOS." required />
          <Select label="Peran" value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value as OrgRole })}
            options={options(orgRoleLabel).filter((r) => isOwner || r.value === 'member')} />
        </form>
      </Modal>

      <ConfirmDialog open={!!removeTarget} title="Hapus anggota" loading={busy} onCancel={() => setRemoveTarget(null)} onConfirm={() => void confirmRemove()}
        message={<>Hapus <strong>{removeTarget?.full_name || 'anggota ini'}</strong> dari organisasi? Organisasi harus selalu memiliki minimal satu Owner.</>} />
      <CascadeDeleteDialog open={deleteOpen} kind="organisasi" name={o.name} busy={busy} onCancel={() => setDeleteOpen(false)}
        onDeleteAll={() => void confirmDelete()} onDeactivate={o.status === 'active' ? () => void deactivate() : undefined}
        loadItems={async () => { const p = await organizationDeletePreview(id); return [
          { label: 'Dojo', count: p.dojos }, { label: 'Atlet', count: p.athletes }, { label: 'Pelatih', count: p.coaches }, { label: 'Jadwal latihan', count: p.schedules },
          { label: 'Prestasi', count: p.achievements }, { label: 'Pembayaran', count: p.payments }, { label: 'Kompetisi', count: p.competitions }, { label: 'Anggota organisasi', count: p.members }] }} />
    </>
  )
}

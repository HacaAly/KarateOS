import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { entityStatusLabel, options } from '../../utils/labels'
import type { Dojo, Organization } from '../../types/database'
import type { DojoInput } from '../../services/dojos'

interface Props {
  open: boolean
  onClose: () => void
  organizations: Organization[]
  dojo?: Dojo | null
  defaultOrgId?: string
  busy: boolean
  onSubmit: (v: DojoInput) => void
}

export function DojoFormModal({ open, onClose, organizations, dojo, defaultOrgId, busy, onSubmit }: Props) {
  const [f, setF] = useState({ organization_id: '', name: '', address: '', description: '', contact: '', status: 'active' as 'active' | 'inactive' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF({
      organization_id: dojo?.organization_id ?? defaultOrgId ?? (organizations.length === 1 ? organizations[0].id : ''),
      name: dojo?.name ?? '', address: dojo?.address ?? '', description: dojo?.description ?? '',
      contact: dojo?.contact ?? '', status: dojo?.status ?? 'active',
    })
  }, [open, dojo, defaultOrgId, organizations])

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.organization_id) errs.organization_id = 'Pilih organisasi.'
    if (f.name.trim().length < 3) errs.name = 'Nama dojo minimal 3 karakter.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSubmit({
      organization_id: f.organization_id, name: f.name, address: f.address.trim() || null,
      description: f.description.trim() || null, contact: f.contact.trim() || null, status: f.status,
    })
  }

  return (
    <Modal open={open} title={dojo ? 'Ubah dojo' : 'Buat dojo'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button type="submit" form="dojo-form" loading={busy}>Simpan</Button></>}>
      <form id="dojo-form" onSubmit={submit} className="space-y-4" noValidate>
        <Select label="Organisasi induk" required value={f.organization_id} disabled={!!dojo} error={errors.organization_id}
          onChange={(e) => setF({ ...f, organization_id: e.target.value })} placeholder="Pilih organisasi"
          options={organizations.map((o) => ({ value: o.id, label: o.name }))}
          hint={dojo ? 'Dojo tidak dapat dipindahkan ke organisasi lain.' : undefined} />
        <Input label="Nama dojo" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required />
        <Input label="Alamat" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={500} />
        <Input label="Kontak" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} maxLength={120} placeholder="Telepon / email / media sosial" />
        <Textarea label="Deskripsi" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
        <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'active' | 'inactive' })} options={options(entityStatusLabel)} />
      </form>
    </Modal>
  )
}

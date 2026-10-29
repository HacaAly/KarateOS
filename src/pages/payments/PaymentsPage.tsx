import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useQueryParam } from '../../hooks/useQueryParam'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { paymentIcon } from '../../components/ui/StatusIcons'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DataTable, Toolbar, type Column } from '../../components/tables/DataTable'
import { createPayment, deletePayment, listPayments, updatePayment, type PaymentRow } from '../../services/payments'
import { listAthletes } from '../../services/athletes'
import { toMessage } from '../../lib/supabase'
import { options, paymentStatusLabel, toneFor } from '../../utils/labels'
import { formatMonth, formatRupiah, monthStartISO } from '../../utils/format'
import type { PaymentStatus } from '../../types/database'

const blank = { dojo_id: '', athlete_id: '', month: '', amount: '', status: 'pending' as PaymentStatus, method: '', notes: '' }

export default function PaymentsPage() {
  const access = useAccess()
  const toast = useToast()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const [status, setStatus] = useState('')
  const [month, setMonth] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<PaymentRow | null>(null)
  const [del, setDel] = useState<PaymentRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const list = useAsync(() => listPayments({ dojoId: dojoId || undefined, status: status || undefined, period: month ? `${month}-01` : undefined }), [dojoId, status, month])
  const athletes = useAsync(() => listAthletes({ dojoId: f.dojo_id || undefined }), [f.dojo_id, open])
  const canManage = access.anyManage

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(edit ? { dojo_id: edit.dojo_id, athlete_id: edit.athlete_id ?? '', month: edit.period.slice(0, 7), amount: String(edit.amount), status: edit.status, method: edit.method ?? '', notes: edit.notes ?? '' }
      : { ...blank, dojo_id: dojoId || (access.manageableDojos.length === 1 ? access.manageableDojos[0].id : ''), month: monthStartISO().slice(0, 7) })
  }, [open, edit, dojoId, access.manageableDojos])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.dojo_id) errs.dojo_id = 'Pilih dojo.'
    if (!f.athlete_id) errs.athlete_id = 'Pilih atlet.'
    if (!/^\d{4}-\d{2}$/.test(f.month)) errs.month = 'Pilih periode.'
    const amount = Number(f.amount)
    if (f.amount === '' || !Number.isFinite(amount) || amount < 0) errs.amount = 'Nominal harus berupa angka ≥ 0.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const patch = {
      period: `${f.month}-01`, amount, status: f.status, method: f.method.trim() || null, notes: f.notes.trim() || null,
      paid_at: f.status === 'paid' ? (edit?.paid_at ?? new Date().toISOString()) : null,
    }
    setBusy(true)
    try {
      if (edit) await updatePayment(edit.id, patch); else await createPayment({ dojo_id: f.dojo_id, athlete_id: f.athlete_id, ...patch })
      toast.success(edit ? 'Catatan pembayaran diperbarui.' : 'Pembayaran dicatat.'); setOpen(false); list.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!del) return
    setBusy(true)
    try { await deletePayment(del.id); toast.success('Catatan dihapus.'); setDel(null); list.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const rows = list.data
  const paidTotal = rows?.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0) ?? 0
  const cols: Column<PaymentRow>[] = [
    { key: 'a', header: 'Atlet', render: (r) => <span className="font-medium">{r.athletes?.full_name ?? '—'}</span> },
    { key: 'd', header: 'Dojo', render: (r) => access.dojoName(r.dojo_id) },
    { key: 'p', header: 'Periode', render: (r) => formatMonth(r.period) },
    { key: 'am', header: 'Nominal', render: (r) => formatRupiah(r.amount) },
    { key: 'm', header: 'Metode', render: (r) => r.method ?? '—' },
    { key: 'st', header: 'Status', render: (r) => <Badge tone={toneFor.status(r.status)} icon={paymentIcon(r.status)}>{paymentStatusLabel[r.status]}</Badge> },
    ...(canManage ? [{ key: 'act', header: '', className: 'text-right', render: (r: PaymentRow) => access.canManageDojo(r.dojo_id) ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" aria-label="Ubah" icon={<Pencil size={16} />} onClick={() => { setEdit(r); setOpen(true) }} />
        <Button size="sm" variant="ghost" aria-label="Hapus" icon={<Trash2 size={16} />} onClick={() => setDel(r)} />
      </div>) : null }] : []),
  ]

  return (
    <>
      <PageHeader title="Pembayaran" description="Pencatatan iuran manual. Status 'lunas' berarti dicatat oleh pengelola — belum diverifikasi oleh sistem pembayaran."
        actions={canManage ? <Button icon={<Plus size={16} />} onClick={() => { setEdit(null); setOpen(true) }}>Catat pembayaran</Button> : undefined} />
      <Card className="!p-0">
        <Toolbar>
          {access.dojos.length > 1 && <FilterSelect label="Filter dojo" value={dojoId} onChange={setDojoId} placeholder="Semua dojo" options={access.dojos.map((d) => ({ value: d.id, label: d.name }))} />}
          <FilterSelect label="Filter status" value={status} onChange={setStatus} placeholder="Semua status" options={options(paymentStatusLabel)} />
          <input type="month" aria-label="Filter periode" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base sm:w-auto sm:text-sm" />
          {month && <Button size="sm" variant="ghost" onClick={() => setMonth('')}>Hapus periode</Button>}
        </Toolbar>
        {rows && rows.length > 0 && <p className="border-b border-ink-100 px-4 py-3 text-sm text-ink-700">{rows.length} catatan · total dicatat lunas <strong>{formatRupiah(paidTotal)}</strong></p>}
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
          empty={{ title: 'Belum ada catatan pembayaran', description: canManage ? 'Catat pembayaran iuran pertama.' : 'Tidak ada catatan pembayaran untuk Anda.' }} />
      </Card>

      <Modal open={open} title={edit ? 'Ubah catatan pembayaran' : 'Catat pembayaran'} onClose={() => setOpen(false)} wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="pay-form" loading={busy}>Simpan</Button></>}>
        <form id="pay-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Select label="Dojo" required value={f.dojo_id} disabled={!!edit} onChange={(e) => setF({ ...f, dojo_id: e.target.value, athlete_id: '' })} error={errors.dojo_id} placeholder="Pilih dojo" options={access.manageableDojos.map((d) => ({ value: d.id, label: d.name }))} />
          <Select label="Atlet" required value={f.athlete_id} disabled={!!edit} onChange={(e) => setF({ ...f, athlete_id: e.target.value })} error={errors.athlete_id} placeholder="Pilih atlet"
            options={(athletes.data ?? []).filter((a) => a.dojo_id === f.dojo_id).map((a) => ({ value: a.id, label: a.full_name }))} />
          <Input label="Periode" type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} error={errors.month} required />
          <Input label="Nominal (Rp)" type="number" min={0} step="1000" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} error={errors.amount} required />
          <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as PaymentStatus })} options={options(paymentStatusLabel)} />
          <Input label="Metode" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} maxLength={60} placeholder="Tunai, transfer…" hint="Jangan isi nomor kartu atau rekening." />
          <div className="sm:col-span-2"><Textarea label="Catatan" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus catatan pembayaran" loading={busy} onCancel={() => setDel(null)} onConfirm={() => void remove()} message="Hapus catatan pembayaran ini?" />
    </>
  )
}

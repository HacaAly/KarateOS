import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAccess } from '../../hooks/useAccess'
import { useAsync } from '../../hooks/useAsync'
import { useQueryParam } from '../../hooks/useQueryParam'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { medalIcon } from '../../components/ui/StatusIcons'
import { Badge } from '../../components/ui/Badge'
import { FilterSelect, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DataTable, Toolbar, type Column } from '../../components/tables/DataTable'
import { createAchievement, deleteAchievement, listAchievements, updateAchievement, type AchievementRow } from '../../services/achievements'
import { listAthletes } from '../../services/athletes'
import { listCompetitions } from '../../services/competitions'
import { toMessage } from '../../lib/supabase'
import { medalLabel, options, toneFor } from '../../utils/labels'
import type { Medal } from '../../types/database'

const blank = { athlete_id: '', competition_id: '', event_name: '', category: '', result: '', medal: 'none' as Medal, year: String(new Date().getFullYear()), notes: '' }

export default function AchievementsPage() {
  const access = useAccess()
  const toast = useToast()
  const [dojoId, setDojoId] = useQueryParam('dojo')
  const [medal, setMedal] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<AchievementRow | null>(null)
  const [del, setDel] = useState<AchievementRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const list = useAsync(() => listAchievements({ dojoId: dojoId || undefined }), [dojoId])
  const athletes = useAsync(() => listAthletes(), [])
  const comps = useAsync(() => listCompetitions(), [])
  const canAdd = access.anyStaff

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(edit ? { athlete_id: edit.athlete_id, competition_id: edit.competition_id ?? '', event_name: edit.event_name ?? '', category: edit.category ?? '', result: edit.result ?? '',
      medal: edit.medal, year: String(edit.year), notes: edit.notes ?? '' } : blank)
  }, [open, edit])

  const athlete = athletes.data?.find((a) => a.id === f.athlete_id)
  const athleteOrg = athlete ? access.dojos.find((d) => d.id === athlete.dojo_id)?.organization_id : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.athlete_id) errs.athlete_id = 'Pilih atlet.'
    const year = Number(f.year)
    if (!Number.isInteger(year) || year < 1950 || year > 2100) errs.year = 'Tahun tidak valid.'
    if (!f.competition_id && !f.event_name.trim()) errs.event_name = 'Pilih kompetisi atau isi nama event.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const patch = { competition_id: f.competition_id || null, event_name: f.event_name.trim() || null, category: f.category.trim() || null,
      result: f.result.trim() || null, medal: f.medal, year, notes: f.notes.trim() || null }
    setBusy(true)
    try {
      if (edit) await updateAchievement(edit.id, patch)
      else await createAchievement({ athlete_id: f.athlete_id, dojo_id: athlete!.dojo_id, ...patch })
      toast.success(edit ? 'Prestasi diperbarui.' : 'Prestasi dicatat.'); setOpen(false); list.reload()
    } catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }
  async function remove() {
    if (!del) return
    setBusy(true)
    try { await deleteAchievement(del.id); toast.success('Prestasi dihapus.'); setDel(null); list.reload() }
    catch (err) { toast.error(toMessage(err)) } finally { setBusy(false) }
  }

  const rows = list.data?.filter((r) => (r.athletes?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) && (!medal || r.medal === medal)) ?? null
  const gold = rows?.filter((r) => r.medal === 'gold').length ?? 0, silver = rows?.filter((r) => r.medal === 'silver').length ?? 0, bronze = rows?.filter((r) => r.medal === 'bronze').length ?? 0
  const cols: Column<AchievementRow>[] = [
    { key: 'a', header: 'Atlet', render: (r) => <span className="font-medium">{r.athletes?.full_name ?? '—'}</span> },
    { key: 'e', header: 'Kompetisi / event', render: (r) => r.competitions?.name ?? r.event_name ?? '—' },
    { key: 'c', header: 'Kategori', render: (r) => r.category ?? '—' },
    { key: 'r', header: 'Hasil', render: (r) => r.result ?? '—' },
    { key: 'm', header: 'Medali', render: (r) => <Badge tone={toneFor.medal(r.medal)} icon={medalIcon(r.medal)}>{medalLabel[r.medal]}</Badge> },
    { key: 'y', header: 'Tahun', render: (r) => r.year },
    { key: 'act', header: '', className: 'text-right', render: (r) => access.canStaffDojo(r.dojo_id) ? (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" aria-label="Ubah" icon={<Pencil size={16} />} onClick={() => { setEdit(r); setOpen(true) }} />
        {access.canManageDojo(r.dojo_id) && <Button size="sm" variant="ghost" aria-label="Hapus" icon={<Trash2 size={16} />} onClick={() => setDel(r)} />}
      </div>) : null },
  ]

  return (
    <>
      <PageHeader title="Prestasi" description="Hasil dan medali atlet."
        actions={canAdd ? <Button icon={<Plus size={16} />} onClick={() => { setEdit(null); setOpen(true) }}>Catat prestasi</Button> : undefined} />
      <Card className="!p-0">
        <Toolbar search={search} onSearch={setSearch} placeholder="Cari nama atlet…">
          <FilterSelect label="Filter dojo" value={dojoId} onChange={setDojoId} placeholder="Semua dojo" options={access.dojos.map((d) => ({ value: d.id, label: d.name }))} />
          <FilterSelect label="Filter medali" value={medal} onChange={setMedal} placeholder="Semua medali" options={options(medalLabel)} />
        </Toolbar>
        {rows && rows.length > 0 && <p className="border-b border-ink-100 px-4 py-3 text-sm text-ink-700">Ringkasan: <strong>{gold}</strong> emas · <strong>{silver}</strong> perak · <strong>{bronze}</strong> perunggu</p>}
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
          empty={{ title: 'Belum ada prestasi', description: canAdd ? 'Catat prestasi pertama.' : undefined }} />
      </Card>

      <Modal open={open} title={edit ? 'Ubah prestasi' : 'Catat prestasi'} onClose={() => setOpen(false)} wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" form="ach-form" loading={busy}>Simpan</Button></>}>
        <form id="ach-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2"><Select label="Atlet" required value={f.athlete_id} disabled={!!edit} onChange={(e) => setF({ ...f, athlete_id: e.target.value, competition_id: '' })} error={errors.athlete_id}
            placeholder="Pilih atlet" options={(athletes.data ?? []).filter((a) => access.canStaffDojo(a.dojo_id)).map((a) => ({ value: a.id, label: `${a.full_name} — ${access.dojoName(a.dojo_id)}` }))} /></div>
          <Select label="Kompetisi" value={f.competition_id} onChange={(e) => setF({ ...f, competition_id: e.target.value })} placeholder="— Event lain —"
            options={(comps.data ?? []).filter((c) => !athleteOrg || c.organization_id === athleteOrg).map((c) => ({ value: c.id, label: c.name }))} />
          <Input label="Nama event (jika bukan dari daftar)" value={f.event_name} onChange={(e) => setF({ ...f, event_name: e.target.value })} error={errors.event_name} maxLength={160} />
          <Input label="Kategori pertandingan" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} maxLength={160} />
          <Input label="Hasil" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} maxLength={160} placeholder="Juara 1, Semifinalis…" />
          <Select label="Medali" value={f.medal} onChange={(e) => setF({ ...f, medal: e.target.value as Medal })} options={options(medalLabel)} />
          <Input label="Tahun" type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} error={errors.year} min={1950} max={2100} required />
          <div className="sm:col-span-2"><Textarea label="Keterangan" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} title="Hapus prestasi" loading={busy} onCancel={() => setDel(null)} onConfirm={() => void remove()} message="Hapus catatan prestasi ini?" />
    </>
  )
}

import { Select } from '../ui/Field'
import type { Dojo } from '../../types/database'

export function DojoSelectField({ dojos, value, onChange, error, disabled, label = 'Dojo' }:
  { dojos: Dojo[]; value: string; onChange: (v: string) => void; error?: string; disabled?: boolean; label?: string }) {
  return (
    <Select label={label} required value={value} onChange={(e) => onChange(e.target.value)} error={error} disabled={disabled}
      placeholder="Pilih dojo" options={dojos.map((d) => ({ value: d.id, label: d.name }))} />
  )
}

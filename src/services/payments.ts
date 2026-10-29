import { supabase } from '../lib/supabase'
import type { Payment, PaymentStatus } from '../types/database'

export interface PaymentRow extends Payment { athletes: { full_name: string } | null }
export interface PaymentInput {
  dojo_id: string
  athlete_id: string
  period: string
  amount: number
  status: PaymentStatus
  method: string | null
  paid_at: string | null
  notes: string | null
}

export async function listPayments(f: { dojoId?: string; status?: string; period?: string } = {}): Promise<PaymentRow[]> {
  let q = supabase.from('payments').select('*, athletes(full_name)').order('period', { ascending: false }).order('created_at', { ascending: false })
  if (f.dojoId) q = q.eq('dojo_id', f.dojoId)
  if (f.status) q = q.eq('status', f.status)
  if (f.period) q = q.eq('period', f.period)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PaymentRow[]
}

export async function createPayment(input: PaymentInput): Promise<void> {
  const { error } = await supabase.from('payments').insert(input)
  if (error) throw error
}

export async function updatePayment(id: string, patch: Omit<PaymentInput, 'dojo_id' | 'athlete_id'>): Promise<void> {
  const { error } = await supabase.from('payments').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}

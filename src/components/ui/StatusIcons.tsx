import { Check, Clock, Info, Medal as MedalIcon, X, CircleDashed, Ban, AlertTriangle, Hourglass } from 'lucide-react'
import type { AttendanceStatus, Medal, PaymentStatus } from '../../types/database'

/** Ikon pendamping label status, agar status tidak hanya dibedakan lewat warna. */
export const attendanceIcon = (s: AttendanceStatus) =>
  ({ present: <Check size={12} aria-hidden="true" />, late: <Clock size={12} aria-hidden="true" />, excused: <Info size={12} aria-hidden="true" />, absent: <X size={12} aria-hidden="true" /> })[s]

export const medalIcon = (m: Medal) => (m === 'none' ? <CircleDashed size={12} aria-hidden="true" /> : <MedalIcon size={12} aria-hidden="true" />)

export const paymentIcon = (s: PaymentStatus) =>
  ({ paid: <Check size={12} aria-hidden="true" />, pending: <Hourglass size={12} aria-hidden="true" />, overdue: <AlertTriangle size={12} aria-hidden="true" />, cancelled: <Ban size={12} aria-hidden="true" /> })[s]

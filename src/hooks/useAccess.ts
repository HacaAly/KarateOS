import { useContext } from 'react'
import { AccessContext } from '../contexts/AccessContext'

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess harus dipakai di dalam AccessProvider')
  return ctx
}

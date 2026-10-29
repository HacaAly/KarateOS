import { useCallback, useEffect, useRef, useState } from 'react'
import { toMessage } from '../lib/supabase'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
  setData: (updater: (prev: T | null) => T | null) => void
}

/** Memuat data async dengan state loading/error dan fungsi reload. Hasil lama diabaikan bila deps berubah. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fnRef.current()
      .then((res) => { if (!cancelled) setDataState(res) })
      .catch((e) => { if (!cancelled) setError(toMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(updater), [])
  return { data, loading, error, reload, setData }
}

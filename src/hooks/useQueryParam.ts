import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Parameter URL sederhana (mis. ?dojo=...) agar filter dapat dibagikan/di-bookmark. */
export function useQueryParam(key: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? ''
  const set = useCallback((v: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (v) next.set(key, v); else next.delete(key)
      return next
    }, { replace: true })
  }, [key, setParams])
  return [value, set]
}

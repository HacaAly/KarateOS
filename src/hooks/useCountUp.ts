import { useEffect, useState } from 'react'

/** Animasi angka singkat. Nilai akhir selalu benar; tanpa animasi bila pengguna memilih reduced motion. */
export function useCountUp(target: number, duration = 700): number {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce || target === 0) { setValue(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduce])
  return value
}

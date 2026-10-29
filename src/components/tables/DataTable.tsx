import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Skeleton, EmptyState, ErrorState } from '../ui/States'
import { Button } from '../ui/Button'

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string }

interface Props<T> {
  columns: Column<T>[]
  rows: T[] | null
  rowKey: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty?: { title: string; description?: string; action?: ReactNode }
  onRowClick?: (row: T) => void
  /** Jumlah baris per halaman (default 10). Isi 0 untuk menonaktifkan pagination. */
  pageSize?: number
}

/**
 * Tabel responsif: tabel pada tablet/desktop, kartu bertumpuk pada ponsel. Kolom pertama menjadi judul kartu,
 * kolom dengan header kosong menjadi baris aksi.
 */
export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, empty, onRowClick, pageSize = 10 }: Props<T>) {
  const [page, setPage] = useState(0)
  const total = rows?.length ?? 0
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
  useEffect(() => { if (page > pages - 1) setPage(0) }, [page, pages])
  useEffect(() => { setPage(0) }, [total])

  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (loading && !rows) {
    return (
      <div className="space-y-2 p-4" role="status" aria-label="Memuat tabel">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    )
  }
  if (!rows || rows.length === 0) {
    return <EmptyState title={empty?.title ?? 'Belum ada data'} description={empty?.description} action={empty?.action} />
  }

  const visible = pageSize > 0 ? rows.slice(page * pageSize, page * pageSize + pageSize) : rows
  const [first, ...rest] = columns
  const dataCols = rest.filter((c) => c.header !== '')
  const actionCols = rest.filter((c) => c.header === '')
  const from = page * pageSize + 1
  const to = Math.min(total, page * pageSize + pageSize)

  return (
    <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {/* Kartu untuk ponsel */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {visible.map((row) => (
          <li key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`space-y-2 px-4 py-3.5 transition-colors ${onRowClick ? 'cursor-pointer active:bg-ink-50' : ''}`}>
            <div className="min-w-0 break-words text-sm">{first.render(row)}</div>
            {dataCols.length > 0 && (
              <dl className="space-y-1.5">
                {dataCols.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="shrink-0 text-xs text-ink-500">{c.header}</dt>
                    <dd className="min-w-0 break-words text-right">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actionCols.map((c) => {
              const el = c.render(row)
              return el ? <div key={c.key} className="flex justify-end pt-1" onClick={(e) => e.stopPropagation()}>{el}</div> : null
            })}
          </li>
        ))}
      </ul>
      {/* Tabel untuk tablet/desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50/80 text-xs text-ink-500">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={`px-4 py-3 font-semibold ${c.className ?? ''}`}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {visible.map((row) => (
              <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-brand-50/50' : 'hover:bg-ink-50/60'}`}>
                {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Halaman data" className="flex items-center justify-between gap-3 border-t border-ink-100 px-4 py-3">
          <p className="text-xs text-ink-500">Menampilkan {from}–{to} dari {total}</p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" aria-label="Halaman sebelumnya" icon={<ChevronLeft size={16} />} disabled={page === 0} onClick={() => setPage((p) => p - 1)} />
            <span className="px-2 text-xs font-medium text-ink-700" aria-live="polite">{page + 1} / {pages}</span>
            <Button size="sm" variant="secondary" aria-label="Halaman berikutnya" icon={<ChevronRight size={16} />} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} />
          </div>
        </nav>
      )}
    </div>
  )
}

/** Nama alias sesuai design system. */
export const ResponsiveTable = DataTable

export function Toolbar({ search, onSearch, placeholder = 'Cari…', children }:
  { search?: string; onSearch?: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-ink-100 p-3 sm:p-4 lg:flex-row lg:items-center">
      {onSearch && (
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input type="search" aria-label="Pencarian" value={search ?? ''} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
            className="min-h-11 w-full rounded-(--radius-control) border border-ink-200 bg-white py-2 pl-9 pr-3 text-base transition hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 sm:min-h-10 sm:text-sm" />
        </div>
      )}
      {children && <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">{children}</div>}
    </div>
  )
}

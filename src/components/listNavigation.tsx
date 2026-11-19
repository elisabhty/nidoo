import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

export function useListPage<T>(items: T[], size: number, resetKey: string) {
  const [selected, setSelected] = useState(1)
  const total = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(selected, total)
  useEffect(() => setSelected(1), [resetKey])
  useEffect(() => setSelected((value) => Math.min(value, total)), [total])
  return { visible: items.slice((page - 1) * size, page * size), page, total, setPage: setSelected }
}

export function ListPages({ page, total, setPage, label }: {
  page: number; total: number; setPage: (page: number) => void; label: string
}) {
  if (total <= 1) return null
  return (
    <nav aria-label={label} className="mx-4 mt-3 mb-3 flex items-center justify-between rounded-full bg-teinte-doux px-2">
      <button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage(page - 1)} className="presse grid h-11 w-11 place-items-center text-teinte disabled:opacity-30"><ChevronLeft size={18} /></button>
      <span aria-live="polite" className="text-mini font-semibold text-brume">Page {page} sur {total}</span>
      <button type="button" aria-label="Page suivante" disabled={page === total} onClick={() => setPage(page + 1)} className="presse grid h-11 w-11 place-items-center text-teinte disabled:opacity-30"><ChevronRight size={18} /></button>
    </nav>
  )
}

export function ProgressiveList<T>({ items, size = 6, children }: {
  items: T[]; size?: number; children: (visible: T[]) => ReactNode
}) {
  const [limit, setLimit] = useState(size)
  return (
    <>
      {children(items.slice(0, limit))}
      {items.length > limit && <button type="button" onClick={() => setLimit((value) => value + size)} className="presse mx-auto mt-3 block min-h-11 rounded-full bg-teinte-doux px-5 text-note font-semibold text-teinte-fonce">Voir plus · {items.length - limit} restants</button>}
    </>
  )
}

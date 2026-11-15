import { useRef } from 'react'
import { CARE } from '../lib/data'
import { tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { HouseCare } from '../lib/types'
import { todayKey } from '../lib/util'

// Les soins du jardin : une gamelle pour le chat, des graines pour les oiseaux,
// un arrosoir pour les fleurs et le potager. Dessinés, pas d'emoji.

export function CareIcon({ k, size = 20 }: { k: string; size?: number | string }) {
  if (k === 'chat')
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <ellipse cx="12" cy="11.4" rx="8.2" ry="2.4" fill="#8B5A2B" />
        <circle cx="8.6" cy="10.4" r="1.5" fill="#B9773A" />
        <circle cx="12" cy="9.7" r="1.6" fill="#C98445" />
        <circle cx="15.3" cy="10.5" r="1.4" fill="#A86A33" />
        <path d="M3 11.6h18l-1.5 5.8a2.2 2.2 0 0 1-2.1 1.6H6.6a2.2 2.2 0 0 1-2.1-1.6z" fill="#F76B8A" />
        <path d="M5.4 14.4h13.2" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.3} strokeLinecap="round" />
      </svg>
    )
  if (k === 'cabane')
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        {[[7, 12, -30], [10.5, 10.4, 20], [14, 11.6, -10], [17, 10.2, 35], [9, 14, 60], [12.6, 13.4, -45], [15.8, 14, 15]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="1.6" ry="1" fill={i % 2 ? '#D9A43A' : '#EEC35A'} transform={`rotate(${r} ${x} ${y})`} />
        ))}
        <path d="M2.5 14.6h19l-1.3 3.2a2.2 2.2 0 0 1-2 1.4H5.8a2.2 2.2 0 0 1-2-1.4z" fill="#C98F55" />
        <path d="M5 16.6h14" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.2} strokeLinecap="round" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M6.4 9.2a3.2 3.2 0 0 1 6.4 0" fill="none" stroke="#2D7FC9" strokeWidth={1.9} strokeLinecap="round" />
      <path d="M3.6 9.4h11v8.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8z" fill="#3E9BE9" />
      <path d="M14.4 12.4 19.8 7.6" stroke="#3E9BE9" strokeWidth={2.4} strokeLinecap="round" />
      <path d="m18.6 5.7 2.7 2.7" stroke="#2D7FC9" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M5.6 12.2h7" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
      <circle cx="21.4" cy="11" r="0.95" fill="#7CC3F5" />
      <circle cx="22.4" cy="13.8" r="0.85" fill="#7CC3F5" />
    </svg>
  )
}

/** Ce qui reste à faire aujourd'hui dans le jardin (seulement ce que la famille possède). */
export function careTodo(items: string[], cares: HouseCare[]) {
  const day = todayKey()
  return Object.keys(CARE).filter((k) => items.includes(k) && !cares.some((c) => c.item_key === k && c.day === day))
}

/** Nourrir ou arroser : la maison montre elle-même le « +3 » quand c'est fait. */
export function useCare() {
  const { state, run } = useHome()
  const busy = useRef(new Set<string>())
  return (key: string) => {
    if (busy.current.has(key)) return
    busy.current.add(key)
    tap()
    void run((api) => api.care(state.family.id, key)).finally(() => busy.current.delete(key))
  }
}

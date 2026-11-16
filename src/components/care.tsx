import { useRef } from 'react'
import { ANIMALS, CARE, GONE_AFTER, type Care } from '../lib/data'
import { tap, warn } from '../lib/haptic'
import { teinteMain } from '../lib/personnalise'
import { useHome, useStore } from '../lib/store'
import type { HouseCare, Pet, StarEntry } from '../lib/types'
import { isToday, todayKey } from '../lib/util'

// Les soins du jardin : une gamelle pour le chat, des graines pour les oiseaux,
// un arrosoir pour les fleurs et le potager. Dessinés, pas d'emoji.

export function CareIcon({ k, size = 20 }: { k: string; size?: number | string }) {
  if (k === 'chat' || k === 'compagnon')
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

/** Les phrases d'un soin ; celles du compagnon prennent son prénom. */
export function careFor(key: string, pet: Pet | null | undefined): Care {
  const c = CARE[key]
  if (key !== 'compagnon' || !pet) return c
  return { ...c, verb: `Nourrir ${pet.name}`, need: `${pet.name} a faim`, done: `a nourri ${pet.name}`, who: pet.name }
}

/** Ce qui vit au jardin : les décorations, plus le compagnon s'il y en a un. */
export const gardenKeys = (items: string[], pet: Pet | null | undefined) => (pet ? [...items, 'compagnon'] : items)

/** Ce qui reste à faire aujourd'hui dans le jardin (seulement ce que la famille possède : passer gardenKeys). */
export function careTodo(items: string[], cares: HouseCare[]) {
  const day = todayKey()
  return Object.keys(CARE).filter((k) => items.includes(k) && !cares.some((c) => c.item_key === k && c.day === day))
}

/** Nourrir ou arroser : la maison montre elle-même le « +3 » quand c'est fait.
 *  Sans croquettes, on prévient et on propose d'en racheter (onEmpty). */
export function useCare(onEmpty?: () => void) {
  const { state, run, toast } = useHome()
  const busy = useRef(new Set<string>())
  return (key: string) => {
    if (busy.current.has(key)) return
    if (ANIMALS.includes(key) && state.family.food <= 0) {
      warn()
      toast('Plus de croquettes ! Il faut en racheter un sac.', 'err')
      onEmpty?.()
      return
    }
    busy.current.add(key)
    tap()
    void run((api) => api.care(state.family.id, key)).finally(() => busy.current.delete(key))
  }
}

/** Caresser un animal : l'animation part tout de suite, l'étoile arrive si c'est la première caresse du jour. */
export function usePet() {
  const { state, api, reload } = useHome()
  return async (key: string) => {
    try {
      const n = await api.pet(state.family.id, key)
      if (n) await reload()
      return n
    } catch {
      return 0
    }
  }
}

/** Ai-je déjà caressé un animal aujourd'hui ? (une étoile par personne et par jour) */
export const pettedToday = (log: StarEntry[], meId: string) => log.some((s) => s.reason === 'caresse' && s.member_id === meId && isToday(s.created_at))

/** Nombre de jours entre deux dates AAAA-MM-JJ. */
export function dayDiff(from: string, to: string) {
  const d = (k: string) => {
    const [y, m, j] = k.split('-').map(Number)
    return Date.UTC(y, m - 1, j)
  }
  return Math.round((d(to) - d(from)) / 86400000)
}

/** Depuis combien de jours il n'a pas mangé (ou pas été arrosé) : 0 aujourd'hui, 1 hier… */
export function hungerOf(key: string, cares: HouseCare[], since: Record<string, string> | undefined) {
  const today = todayKey()
  const last = cares.filter((c) => c.item_key === key).reduce<string | null>((a, c) => (!a || c.day > a ? c.day : a), null)
  const base = last ?? (since?.[key] ? todayKey(new Date(since[key])) : today)
  return Math.max(0, dayDiff(base, today))
}

/** Comment va l'animal : bien, triste (pas mangé hier), déprimé (deux jours) ; au 4e jour il s'en va. */
export type AnimalMood = 'bien' | 'triste' | 'deprime'
export const animalMood = (hunger: number): AnimalMood => (hunger >= GONE_AFTER - 1 ? 'deprime' : hunger >= 2 ? 'triste' : 'bien')

/** La main qui caresse. */
/** La main qui caresse : une main en feutrine (public/art/main-1…5.webp), de la couleur de peau de son personnage. */
export function HandIcon({ size = 24 }: { size?: number | string }) {
  const { state } = useStore()
  const n = teinteMain(state?.me?.avatar)
  return <img src={`./art/main-${n}.webp`} alt="" draggable={false} className="pointer-events-none block select-none" style={{ width: size, height: size, objectFit: 'contain' }} />
}

/** Le sac de croquettes de la maison. */
export function BagIcon({ size = 24, empty = false }: { size?: number | string; empty?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M5.6 7.4 7 4.6h10l1.4 2.8v12a2 2 0 0 1-2 2H7.6a2 2 0 0 1-2-2z" fill={empty ? '#D9D4E4' : '#F2A93B'} />
      <path d="M5.6 7.4 7 4.6h10l1.4 2.8z" fill={empty ? '#BDB6CC' : '#D9862A'} />
      <path d="M7.4 3h9.2v1.6H7.4z" fill={empty ? '#A9A2BA' : '#B86C1C'} />
      <g fill="#fff" fillOpacity={0.92}>
        <ellipse cx="12" cy="15.4" rx="2.6" ry="2.2" />
        <circle cx="8.9" cy="12.6" r="1.1" />
        <circle cx="10.9" cy="11.2" r="1.1" />
        <circle cx="13.1" cy="11.2" r="1.1" />
        <circle cx="15.1" cy="12.6" r="1.1" />
      </g>
    </svg>
  )
}

/** Une note de musique : les oiseaux chantent quand on les caresse. */
export function NoteIcon({ size = 16, color = '#6E56CF' }: { size?: number | string; color?: string }) {
  return (
    <svg viewBox="0 0 16 20" width={size} height={size} aria-hidden>
      <path d="M6 15.5V3.2l8-1.7v11.6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="3.6" cy="15.8" rx="2.9" ry="2.3" fill={color} transform="rotate(-18 3.6 15.8)" />
      <ellipse cx="11.6" cy="13.4" rx="2.9" ry="2.3" fill={color} transform="rotate(-18 11.6 13.4)" />
    </svg>
  )
}

/** Un petit nuage de pluie, au-dessus d'un animal qui déprime. */
export function RainCloud({ size = 30 }: { size?: number | string }) {
  return (
    <svg viewBox="0 0 30 24" width={size} height={size} aria-hidden>
      <path d="M8 14.5a5 5 0 0 1 .6-9.9 6.4 6.4 0 0 1 12 1.6A4.2 4.2 0 0 1 22 14.5z" fill="#8E8AA6" />
      <path d="M8 14.5a5 5 0 0 1-1-9.6" fill="none" stroke="#A9A5C0" strokeWidth={1} />
    </svg>
  )
}

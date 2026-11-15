import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { success, tap } from '../lib/haptic'
import { moodOf } from '../lib/data'
import type { HouseType, Member } from '../lib/types'
import { lookOf } from '../lib/look'
import { Character } from './Character'
import { dayPhase, season as seasonOf, type Season } from '../lib/util'

// La maison de la famille : un décor vivant qui suit l'heure, la maison en 3D
// et les décorations débloquées avec les étoiles. Tout réagit au toucher.

const SKY = {
  matin: 'linear-gradient(180deg, #FFD9C2 0%, #FBE3EC 45%, #EFE6FB 100%)',
  jour: 'linear-gradient(180deg, #CFE4FB 0%, #E6ECFC 50%, #F3ECFB 100%)',
  soir: 'linear-gradient(180deg, #F7B48E 0%, #EBB2C6 45%, #BFA6EC 100%)',
  nuit: 'linear-gradient(180deg, #2B2260 0%, #4B3D8F 55%, #7E69BE 100%)',
} as const
type Phase = keyof typeof SKY

// Positions en % du décor (largeur de référence : celle du cadre).
const HOUSE: Record<HouseType, { w: number; bottom: number; smoke: [number, number] }> = {
  maison: { w: 47, bottom: 15, smoke: [62, 64] },
  appartement: { w: 33, bottom: 15, smoke: [44, 64] },
  chalet: { w: 49, bottom: 15, smoke: [36, 67] },
}
// anim : boucle propre à l'objet ; roam : déplacement dans le décor.
type Spot = { left: number; bottom?: number; top?: number; w: number; z: number; anim?: string; roam?: string }
const SPOTS: Record<string, Spot> = {
  montgolfiere: { left: 0, top: 6, w: 13, z: 1, roam: 'traverse 80s linear -14s infinite' },
  arbre: { left: 0, bottom: 24, w: 25, z: 2, anim: 'balance 6s ease-in-out infinite' },
  cabane: { left: 87, bottom: 31, w: 12, z: 2, anim: 'balance 7s ease-in-out 1s infinite' },
  balancoire: { left: 72, bottom: 21, w: 18, z: 3 },
  lanterne: { left: 22, bottom: 14, w: 9, z: 5, anim: 'lueur 3.2s ease-in-out infinite' },
  boite: { left: 67, bottom: 12, w: 8.5, z: 6 },
  fleurs: { left: 28, bottom: 7, w: 15, z: 7, anim: 'balance 4.5s ease-in-out 0.6s infinite' },
  chat: { left: 57, bottom: 7, w: 12, z: 7, anim: 'respire 3.4s ease-in-out infinite', roam: 'balade 16s ease-in-out 4s infinite' },
  fontaine: { left: 2, bottom: 1, w: 18, z: 8, anim: 'respire 2.2s ease-in-out infinite' },
  potager: { left: 79, bottom: 0, w: 19, z: 8, anim: 'respire 5s ease-in-out 1s infinite' },
}
const ORDER = Object.keys(SPOTS)
// Décorations qui ont une vraie boucle animée (bande de sprites deco-<clé>-anim.webp).
const ANIM: Record<string, { frames: number; dur: number }> = {
  chat: { frames: 6, dur: 1.3 },
  balancoire: { frames: 8, dur: 1.9 },
  fontaine: { frames: 6, dur: 0.8 },
}
const cover: CSSProperties = { position: 'absolute', inset: 0 }

/** Un proche dans le jardin, avec son humeur du jour (null : pas encore donnée). */
export type HousePerson = { m: Member; mood: string | null; label: string; me: boolean }
// Places dans le jardin : de chaque côté de la maison (devant, puis un peu plus loin) et devant la porte.
const SLOTS = [
  { x: 13, y: 2, k: 1 },
  { x: 87, y: 2, k: 1 },
  { x: 29, y: 15, k: 0.82 },
  { x: 71, y: 15, k: 0.82 },
  { x: 50, y: 0, k: 1 },
]
const ORDERS: Record<number, number[]> = { 1: [4], 2: [0, 1], 3: [0, 4, 1], 4: [0, 2, 3, 1], 5: [0, 2, 4, 3, 1] }
// Chacun bouge selon son humeur.
const MOVES: Record<string, string> = {
  heureux: 'sautille 1.8s ease-in-out infinite',
  fete: 'sautille 0.9s ease-in-out infinite',
  motive: 'sautille 1.3s ease-in-out infinite',
  serein: 'respire 4.5s ease-in-out infinite',
  fatigue: 'oscille 4s ease-in-out infinite',
  nostalgique: 'oscille 6s ease-in-out infinite',
  stresse: 'oscille 0.9s ease-in-out infinite',
  triste: 'respire 5s ease-in-out infinite',
}

const LEAVES = ['#E8833A', '#D9572B', '#F2B33D', '#B5532A', '#E9A23B']
const PETALS = ['#F9C4D5', '#FDE6EE', '#F4A9C2', '#FFFFFF']

export default function House({
  type, items, className = '', phase = dayPhase(), bare = false, season = seasonOf(), photos = [], people = [], onPerson,
}: {
  type: HouseType
  items: string[]
  className?: string
  phase?: Phase
  bare?: boolean
  /** La maison suit les saisons : feuilles, neige, pétales, papillons. */
  season?: Season
  /** Les dernières photos partagées, accrochées au fil avec des pinces à linge. */
  photos?: string[]
  /** La famille devant la maison, chacun avec son humeur. */
  people?: HousePerson[]
  onPerson?: (m: Member) => void
}) {
  const night = phase === 'nuit'
  const base = HOUSE[type]
  // En vignette, la maison occupe presque tout le cadre.
  const h = bare ? { ...base, w: base.w * 1.5, bottom: 11 } : base
  const has = (k: string) => items.includes(k)
  const dim = night ? 'brightness(0.72) saturate(0.9)' : undefined
  const [bounce, setBounce] = useState(0)
  const [poke, setPoke] = useState<{ key: string; n: number } | null>(null)

  // Une décoration qui vient d'être installée arrive avec une gerbe d'étoiles.
  const known = useRef<string[] | null>(null)
  const [fresh, setFresh] = useState<string[]>([])
  useEffect(() => {
    if (known.current) {
      const added = items.filter((k) => !known.current!.includes(k))
      if (added.length) {
        success()
        setFresh(added)
        const t = window.setTimeout(() => setFresh([]), 1600)
        known.current = items
        return () => window.clearTimeout(t)
      }
    }
    known.current = items
  }, [items])

  const touch = (key: string) => {
    tap()
    setPoke((p) => ({ key, n: (p?.n ?? 0) + 1 }))
  }

  const deco = (key: string) => {
    const sp = SPOTS[key]
    const glow = key === 'lanterne' && night ? 'drop-shadow(0 0 10px rgba(255,214,120,0.95))' : undefined
    const poked = poke?.key === key
    return (
      <span
        key={key}
        onClick={() => touch(key)}
        className="absolute"
        style={{ left: `${sp.left}%`, bottom: sp.bottom != null ? `${sp.bottom}%` : undefined, top: sp.top != null ? `${sp.top}%` : undefined, width: `${sp.w}%`, zIndex: sp.z, animation: sp.roam }}
      >
        <span className="block" style={{ animation: `pousse 0.6s var(--ressort) ${fresh.includes(key) ? 0 : 0.15 + ORDER.indexOf(key) * 0.07}s both`, transformOrigin: '50% 100%' }}>
          <span key={poked ? poke.n : 0} className="block" style={{ animation: poked ? 'rebond 0.7s var(--ressort)' : undefined, transformOrigin: '50% 100%' }}>
            {ANIM[key] ? (
              <span className="block aspect-square w-full overflow-hidden" style={{ filter: dim }}>
                <img src={`./art/deco-${key}-anim.webp`} alt="" className="block h-full max-w-none" style={{ width: `${ANIM[key].frames * 100}%`, animation: `sprite ${ANIM[key].dur}s steps(${ANIM[key].frames}) infinite` }} />
              </span>
            ) : (
              <img src={`./art/deco-${key}.webp`} alt="" className="block w-full" style={{ animation: sp.anim, transformOrigin: '50% 100%', filter: glow ?? dim }} />
            )}
          </span>
        </span>
        {fresh.includes(key) && (
          <span className="pointer-events-none absolute inset-0">
            {[0, 1, 2, 3].map((i) => (
              <img key={i} src="./art/picto-etoile.webp" alt="" className="absolute left-[30%] top-[10%] w-[40%]" style={{ animation: `jaillit 1.1s ease-out ${i * 0.07}s both`, ['--jx' as string]: `${(i - 1.5) * 110}%` }} />
            ))}
          </span>
        )}
        {/* l'arbre secoué laisse tomber deux oranges */}
        {key === 'arbre' && poked && (
          <span key={`o${poke.n}`} className="pointer-events-none absolute inset-0">
            {[[30, 0], [62, 0.12]].map(([x, d]) => (
              <span key={x} className="absolute top-[38%] aspect-square w-[11%] rounded-full" style={{ left: `${x}%`, background: 'radial-gradient(circle at 35% 30%, #FFC27A, #F08A2C 70%)', animation: `chute 0.9s ease-in ${d}s both` }} />
            ))}
          </span>
        )}
      </span>
    )
  }

  return (
    <div
      className={`relative aspect-[16/11] overflow-hidden ${className}`}
      style={{ background: SKY[phase] }}
      role={people.length ? 'group' : 'img'}
      aria-label={people.length ? 'La maison de la famille et l’humeur de chacun' : 'La maison de la famille'}
    >
      {/* ciel : se décale moins vite que le reste au défilement */}
      <div style={{ ...cover, transform: 'translateY(calc(var(--par, 0) * 0.14px))' }}>
        {night ? (
          <>
            {[[10, 14], [24, 30], [41, 9], [68, 16], [86, 34], [92, 10], [55, 24], [16, 44], [33, 20], [77, 6]].map(([x, y], i) => (
              <span key={i} className="absolute h-[3px] w-[3px] rounded-full bg-[#FFF6D6]" style={{ left: `${x}%`, top: `${y}%`, animation: `scintille ${2 + (i % 4) * 0.6}s ease-in-out ${i * 0.3}s infinite` }} />
            ))}
            {!bare && <span className="absolute left-[18%] top-[12%] h-[2px] w-[14%] rounded-full opacity-0" style={{ background: 'linear-gradient(90deg, rgba(255,246,214,0) 0%, #FFF6D6 100%)', animation: 'filante 11s ease-in 3s infinite' }} />}
            <span className="absolute right-[13%] top-[11%] h-[11%] w-[8%] rounded-full" style={{ boxShadow: 'inset -7px 3px 0 0 #FFF1C4', transform: 'rotate(-20deg)' }} />
          </>
        ) : (
          <>
            <span className="absolute h-[34%] w-[25%] rounded-full" style={{ right: phase === 'soir' ? '62%' : '6%', top: phase === 'jour' ? '2%' : '14%', background: 'radial-gradient(circle, rgba(255,236,170,0.95) 0%, rgba(255,225,150,0.5) 32%, rgba(255,225,150,0) 68%)', animation: bare ? undefined : 'halo 6s ease-in-out infinite' }} />
            {!bare && (
              <>
                <span className="absolute left-0 top-[14%] h-[9%] w-[20%] rounded-full bg-white/70 blur-[5px]" style={{ animation: 'passe 70s linear -20s infinite' }} />
                <span className="absolute left-0 top-[6%] h-[7%] w-[15%] rounded-full bg-white/60 blur-[5px]" style={{ animation: 'passe 95s linear -60s infinite' }} />
                <span className="absolute left-0 top-[24%] h-[6%] w-[12%] rounded-full bg-white/50 blur-[5px]" style={{ animation: 'passe 120s linear -95s infinite' }} />
              </>
            )}
          </>
        )}
        {!bare && has('montgolfiere') && deco('montgolfiere')}
      </div>

      {/* collines */}
      <svg viewBox="0 0 320 220" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ transform: 'translateY(calc(var(--par, 0) * 0.05px))' }} aria-hidden>
        <defs>
          <linearGradient id={`c1-${phase}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={night ? '#5B7F7C' : '#CDE9CC'} />
            <stop offset="1" stopColor={night ? '#4A6B6C' : '#B5DCB9'} />
          </linearGradient>
          <linearGradient id={`c2-${phase}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={night ? '#4F7272' : '#BFE3C0'} />
            <stop offset="1" stopColor={night ? '#3E5E62' : '#A3D2AB'} />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="190" rx="170" ry="52" fill={`url(#c1-${phase})`} />
        <ellipse cx="280" cy="196" rx="170" ry="56" fill={`url(#c1-${phase})`} />
        <ellipse cx="160" cy="240" rx="260" ry="70" fill={`url(#c2-${phase})`} />
      </svg>

      {!bare && ORDER.filter((k) => k !== 'montgolfiere' && has(k) && SPOTS[k].z < 4).map((k) => deco(k))}

      {/* ombre de contact, halo des fenêtres la nuit, puis la maison */}
      <span className="absolute left-1/2 h-[7%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/20 blur-[6px]" style={{ width: `${h.w * 0.92}%`, bottom: `${h.bottom - 2.5}%`, zIndex: 4 }} />
      {night && <span className="absolute left-1/2 aspect-square -translate-x-1/2 rounded-full" style={{ width: `${h.w * 1.5}%`, bottom: `${h.bottom - 6}%`, zIndex: 3, background: 'radial-gradient(circle, rgba(255,206,120,0.42) 0%, rgba(255,206,120,0) 62%)', animation: 'scintille 4.5s ease-in-out infinite' }} />}
      <div
        onClick={
          bare
            ? undefined
            : () => {
                tap()
                setBounce((n) => n + 1)
              }
        }
        className="absolute left-1/2 -translate-x-1/2"
        style={{ width: `${h.w}%`, bottom: `${h.bottom}%`, zIndex: 4 }}
      >
        <span key={bounce} className="block" style={{ animation: bounce ? 'rebond 0.7s var(--ressort)' : 'pousse 0.7s var(--ressort) both', transformOrigin: '50% 100%' }}>
          <img src={`./art/maison-${type}.webp`} alt="" className="block w-full" style={{ animation: bare ? undefined : 'respire 5.5s ease-in-out infinite', transformOrigin: '50% 100%', filter: night ? 'brightness(0.86)' : undefined }} />
        </span>
        {bounce > 0 && !bare && (
          <span key={`c${bounce}`} className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            {[0, 1, 2].map((i) => (
              <img key={i} src="./art/geste-coeur.webp" alt="" className="absolute w-[16%]" style={{ animation: `jaillit 1s ease-out ${i * 0.08}s both`, ['--jx' as string]: `${(i - 1) * 70}%` }} />
            ))}
          </span>
        )}
      </div>

      {!bare &&
        has('fumee') &&
        [0, 1, 2].map((i) => (
          <span key={i} className="pointer-events-none absolute h-[7%] w-[5%] rounded-full bg-white/90 opacity-0 blur-[2px]" style={{ left: `${h.smoke[0]}%`, bottom: `${h.smoke[1]}%`, zIndex: 5, animation: `fumee 3.8s ease-out ${i * 1.25}s infinite` }} />
        ))}

      {!bare && ORDER.filter((k) => has(k) && SPOTS[k].z >= 4).map((k) => deco(k))}

      {/* vie du décor : lucioles la nuit, pollen le jour, neige sur le chalet */}
      {!bare && night &&
        [[14, 30], [31, 22], [47, 12], [63, 26], [82, 18], [91, 34], [24, 40]].map(([x, y], i) => (
          <span key={i} className="pointer-events-none absolute h-[4px] w-[4px] rounded-full bg-[#FFF0A8] opacity-0" style={{ left: `${x}%`, bottom: `${y}%`, zIndex: 9, boxShadow: '0 0 8px 2px rgba(255,236,150,0.85)', animation: `luciole ${6 + (i % 3) * 2}s ease-in-out ${i * 0.9}s infinite`, ['--lx' as string]: `${i % 2 ? 26 : -22}px`, ['--ly' as string]: `${-18 - (i % 3) * 8}px` }} />
        ))}
      {!bare && !night && type !== 'chalet' &&
        [[12, 20], [36, 34], [58, 16], [74, 30], [90, 22]].map(([x, y], i) => (
          <span key={i} className="pointer-events-none absolute h-[3px] w-[3px] rounded-full bg-white opacity-0" style={{ left: `${x}%`, bottom: `${y}%`, zIndex: 9, animation: `luciole ${9 + i * 1.5}s ease-in-out ${i * 1.3}s infinite`, ['--lx' as string]: `${i % 2 ? 30 : -24}px`, ['--ly' as string]: '-46px' }} />
        ))}
      {/* la saison */}
      {!bare && season === 'automne' &&
        Array.from({ length: 11 }).map((_, i) => (
          <span key={`f${i}`} className="pointer-events-none absolute -top-[6%]" style={{ left: `${(i * 29 + 7) % 96}%`, zIndex: 9, animation: `feuille ${8 + (i % 4) * 1.7}s linear ${-i * 1.3}s infinite`, ['--fx' as string]: `${i % 2 ? 46 : -38}px`, ['--fr' as string]: `${i % 2 ? 520 : -460}deg` }}>
            <span className="block h-[9px] w-[9px]" style={{ background: LEAVES[i % LEAVES.length], borderRadius: '0 80% 0 80%' }} />
          </span>
        ))}
      {!bare && season === 'printemps' &&
        Array.from({ length: 10 }).map((_, i) => (
          <span key={`p${i}`} className="pointer-events-none absolute -top-[6%]" style={{ left: `${(i * 31 + 3) % 96}%`, zIndex: 9, animation: `feuille ${9 + (i % 4) * 1.5}s linear ${-i * 1.4}s infinite`, ['--fx' as string]: `${i % 2 ? 40 : -34}px`, ['--fr' as string]: `${i % 2 ? 300 : -280}deg` }}>
            <span className="block h-[7px] w-[6px] rounded-[60%_60%_60%_10%]" style={{ background: PETALS[i % PETALS.length] }} />
          </span>
        ))}
      {!bare && season === 'ete' && !night &&
        [[18, 30, '#F76B15'], [70, 40, '#6E56CF']].map(([x, y, c], i) => (
          <span key={`b${i}`} className="pointer-events-none absolute flex" style={{ left: `${x}%`, bottom: `${y}%`, zIndex: 9, animation: `papillon ${11 + i * 3}s ease-in-out ${-i * 4}s infinite` }}>
            {[0, 1].map((w) => (
              <span key={w} className="block h-[9px] w-[8px] rounded-full" style={{ background: c as string, opacity: 0.9, transformOrigin: w ? '0 50%' : '100% 50%', animation: 'aile 0.35s ease-in-out infinite' }} />
            ))}
          </span>
        ))}
      {!bare && (season === 'hiver' || season === 'noel') && type !== 'chalet' &&
        Array.from({ length: 14 }).map((_, i) => (
          <span key={`n${i}`} className="pointer-events-none absolute -top-[4%] rounded-full bg-white" style={{ left: `${(i * 41 + 9) % 100}%`, width: 3 + (i % 3), height: 3 + (i % 3), opacity: 0.85, zIndex: 9, animation: `neige ${7 + (i % 5) * 1.6}s linear ${-i * 0.9}s infinite`, ['--nx' as string]: `${i % 2 ? 22 : -18}px` }} />
        ))}

      {/* le fil à photos : un cordon noir sur toute la largeur, les photos tenues par des pinces à linge en bois */}
      {!bare && photos.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%]" style={{ zIndex: 8 }}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d="M-2 3 Q 50 17 102 3" fill="none" stroke="#1D1A2B" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {photos.slice(0, 6).map((src, i, all) => {
            const x = ((i + 1) / (all.length + 1)) * 100
            const t = (x + 2) / 104
            const y = 3 + 28 * t * (1 - t) // le creux du cordon à cet endroit (sur 40)
            const r = [-5, 4, -3, 5, -4, 3][i]
            return (
              <span key={src.slice(-32) + i} className="absolute w-[11.5%] -translate-x-1/2" style={{ left: `${x}%`, top: `${(y / 40) * 100}%` }}>
                <span className="block origin-top" style={{ animation: `balance ${4.2 + (i % 3) * 0.9}s ease-in-out ${-i * 0.7}s infinite` }}>
                  <span className="block bg-white p-[7%] pb-[22%] shadow-[0_5px_12px_rgba(29,26,43,0.28)]" style={{ transform: `translateY(14%) rotate(${r}deg)`, transformOrigin: '50% 0' }}>
                    <img src={src} alt="" className="block aspect-square w-full object-cover" />
                  </span>
                  {/* la pince à linge en bois */}
                  <span className="absolute left-1/2 top-[-9%] block h-[34%] w-[22%] -translate-x-1/2 rounded-[2px] shadow-[0_1px_2px_rgba(29,26,43,0.35)]" style={{ background: 'linear-gradient(90deg, #C98F55 0%, #E7BD86 45%, #D7A267 100%)' }}>
                    <span className="absolute inset-x-0 top-[42%] h-[14%] bg-[#8E5E33]/70" />
                  </span>
                </span>
              </span>
            )
          })}
        </div>
      )}

      {/* la famille dans le jardin : chacun son personnage, son humeur sur le visage et dans une bulle */}
      {!bare &&
        people.slice(0, people.length > 5 ? 4 : 5).map((p, i, shown) => {
          const md = moodOf(p.mood)
          const slot = SLOTS[(ORDERS[shown.length] ?? ORDERS[5])[i]]
          const hop = poke?.key === p.m.id
          return (
            <button
              key={p.m.id}
              onClick={() => {
                touch(p.m.id)
                onPerson?.(p.m)
              }}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${slot.x}%`, bottom: `${slot.y}%`, width: `${14 * slot.k}%`, zIndex: slot.k < 1 ? 7 : 8 }}
              aria-label={p.me ? (md ? `Moi : ${md.label}. Changer mon humeur` : 'Partager mon humeur') : `${p.label} : ${md ? md.label : 'pas encore d’humeur aujourd’hui'}. Lui envoyer un câlin`}
            >
              {/* la bulle d'humeur */}
              {md ? (
                <span className="relative mb-[2px] flex items-center gap-[3px] whitespace-nowrap rounded-full bg-white py-[2px] pl-[5px] pr-[7px] text-[10px] font-semibold leading-[14px] text-encre shadow-[0_3px_8px_rgba(29,26,43,0.2)]" style={{ animation: `flotte ${3.6 + i * 0.5}s ease-in-out infinite` }}>
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: md.color }} />
                  {md.label}
                  <span className="absolute -bottom-[3px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-white" />
                </span>
              ) : p.me ? (
                <span className="relative mb-[2px] whitespace-nowrap rounded-full bg-teinte px-[7px] py-[2px] text-[10px] font-semibold leading-[14px] text-white shadow-[0_3px_8px_rgba(102,70,204,0.35)]" style={{ animation: 'flotte 3.6s ease-in-out infinite' }}>
                  + Mon humeur
                  <span className="absolute -bottom-[3px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-teinte" />
                </span>
              ) : null}
              {/* le personnage : il se promène un peu, respire, cligne des yeux, saute quand on le touche */}
              <span className="relative block w-full" style={{ animation: `marche ${8 + i * 1.7}s ease-in-out ${-i * 2}s infinite`, ['--mx' as string]: `${i % 2 ? -7 : 7}px` }}>
                <span className="absolute bottom-[0.5%] left-1/2 h-[6%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/20 blur-[2px]" />
                <span key={hop ? poke!.n : 0} className="block" style={{ animation: hop ? 'rebond 0.7s var(--ressort)' : undefined, transformOrigin: '50% 100%' }}>
                  <span className={`block transition-[filter,opacity] duration-500 ${p.me && !md ? 'opacity-60 grayscale' : ''}`} style={{ animation: MOVES[p.mood ?? ''] ?? `respire ${3 + (i % 3) * 0.6}s ease-in-out infinite`, transformOrigin: '50% 100%' }}>
                    <Character look={lookOf(p.m.avatar, p.m.user_id)} mood={p.mood} extras className="block h-auto w-full" blinkDelay={i * 1.3} />
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      {!bare && people.length > 5 && (
        <span className="absolute bottom-[4%] left-1/2 flex h-[30px] w-[30px] -translate-x-1/2 items-center justify-center rounded-full bg-white/90 text-[12px] font-semibold text-encre shadow-[0_2px_8px_rgba(29,26,43,0.2)]" style={{ zIndex: 8 }}>
          +{people.length - 4}
        </span>
      )}

      {!bare && type === 'chalet' &&
        Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="pointer-events-none absolute -top-[4%] rounded-full bg-white" style={{ left: `${(i * 37 + 5) % 100}%`, width: 3 + (i % 3), height: 3 + (i % 3), opacity: 0.85, zIndex: 9, animation: `neige ${7 + (i % 5) * 1.6}s linear ${-i * 0.9}s infinite`, ['--nx' as string]: `${i % 2 ? 22 : -18}px` }} />
        ))}
    </div>
  )
}

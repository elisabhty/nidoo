import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { success, tap } from '../lib/haptic'
import type { HouseType } from '../lib/types'
import { dayPhase } from '../lib/util'

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
const HOUSE: Record<HouseType, { w: number; bottom: number; smoke: [number, number]; lights: [number, number, number] }> = {
  maison: { w: 47, bottom: 15, smoke: [62, 64], lights: [50, 42, 30] },
  appartement: { w: 33, bottom: 15, smoke: [44, 64], lights: [50, 41, 21] },
  chalet: { w: 49, bottom: 15, smoke: [36, 67], lights: [50, 41, 30] },
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
  chat: { frames: 10, dur: 1.5 },
  balancoire: { frames: 8, dur: 2.2 },
  fontaine: { frames: 6, dur: 0.85 },
}
const cover: CSSProperties = { position: 'absolute', inset: 0 }

export default function House({
  type, items, className = '', phase = dayPhase(), bare = false,
}: { type: HouseType; items: string[]; className?: string; phase?: Phase; bare?: boolean }) {
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
    <div className={`relative aspect-[16/11] overflow-hidden ${className}`} style={{ background: SKY[phase] }} role="img" aria-label="La maison de la famille">
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

      {!bare && has('guirlande') && (
        <img src="./art/deco-guirlande.webp" alt="" className="pointer-events-none absolute -translate-x-1/2" style={{ left: `${h.lights[0]}%`, bottom: `${h.lights[1]}%`, width: `${h.lights[2]}%`, zIndex: 5, animation: 'lueur 2.4s ease-in-out infinite', filter: 'drop-shadow(0 0 3px rgba(255,214,120,0.7))' }} />
      )}
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
      {!bare && type === 'chalet' &&
        Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="pointer-events-none absolute -top-[4%] rounded-full bg-white" style={{ left: `${(i * 37 + 5) % 100}%`, width: 3 + (i % 3), height: 3 + (i % 3), opacity: 0.85, zIndex: 9, animation: `neige ${7 + (i % 5) * 1.6}s linear ${-i * 0.9}s infinite`, ['--nx' as string]: `${i % 2 ? 22 : -18}px` }} />
        ))}
    </div>
  )
}

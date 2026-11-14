import type { CSSProperties } from 'react'
import type { HouseType } from '../lib/types'
import { dayPhase } from '../lib/util'

// La maison de la famille : un décor qui suit l'heure, la maison en 3D
// et les décorations débloquées avec les étoiles, posées autour d'elle.

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
type Spot = { left: number; bottom?: number; top?: number; w: number; z: number; anim?: string }
const SPOTS: Record<string, Spot> = {
  montgolfiere: { left: 7, top: 5, w: 13, z: 1, anim: 'derive 9s ease-in-out infinite' },
  arbre: { left: 0, bottom: 24, w: 25, z: 2 },
  cabane: { left: 87, bottom: 31, w: 12, z: 2 },
  balancoire: { left: 72, bottom: 21, w: 18, z: 3 },
  lanterne: { left: 22, bottom: 14, w: 9, z: 5 },
  boite: { left: 67, bottom: 12, w: 8.5, z: 6 },
  fleurs: { left: 28, bottom: 7, w: 15, z: 7 },
  chat: { left: 58, bottom: 7, w: 10, z: 7 },
  fontaine: { left: 2, bottom: 1, w: 18, z: 8 },
  potager: { left: 79, bottom: 0, w: 19, z: 8 },
}

export default function House({
  type, items, className = '', phase = dayPhase(), bare = false,
}: { type: HouseType; items: string[]; className?: string; phase?: Phase; bare?: boolean }) {
  const night = phase === 'nuit'
  const base = HOUSE[type]
  // En vignette, la maison occupe presque tout le cadre.
  const h = bare ? { ...base, w: base.w * 1.5, bottom: 11 } : base
  const has = (k: string) => items.includes(k)
  const dim: CSSProperties = night ? { filter: 'brightness(0.72) saturate(0.9)' } : {}

  return (
    <div className={`relative aspect-[16/11] overflow-hidden ${className}`} style={{ background: SKY[phase] }} role="img" aria-label="La maison de la famille">
      {night ? (
        <>
          {[[10, 14], [24, 30], [41, 9], [68, 16], [86, 34], [92, 10], [55, 24], [16, 44]].map(([x, y], i) => (
            <span key={i} className="absolute h-[3px] w-[3px] rounded-full bg-[#FFF6D6]" style={{ left: `${x}%`, top: `${y}%`, animation: `scintille ${2 + (i % 4) * 0.6}s ease-in-out ${i * 0.3}s infinite` }} />
          ))}
          <span className="absolute right-[13%] top-[11%] h-[11%] w-[8%] rounded-full" style={{ boxShadow: 'inset -7px 3px 0 0 #FFF1C4', transform: 'rotate(-20deg)' }} />
        </>
      ) : (
        <>
          <span className="absolute h-[34%] w-[25%] rounded-full" style={{ right: phase === 'soir' ? '62%' : '6%', top: phase === 'jour' ? '2%' : '14%', background: 'radial-gradient(circle, rgba(255,236,170,0.95) 0%, rgba(255,225,150,0.5) 32%, rgba(255,225,150,0) 68%)' }} />
          {!bare && (
            <>
              <span className="absolute left-[22%] top-[14%] h-[9%] w-[20%] rounded-full bg-white/70 blur-[5px]" style={{ animation: 'derive 16s ease-in-out infinite' }} />
              <span className="absolute left-[52%] top-[7%] h-[7%] w-[15%] rounded-full bg-white/60 blur-[5px]" style={{ animation: 'derive 20s ease-in-out 2s infinite' }} />
            </>
          )}
        </>
      )}

      {/* collines */}
      <svg viewBox="0 0 320 220" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
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
        <ellipse cx="160" cy="232" rx="260" ry="62" fill={`url(#c2-${phase})`} />
      </svg>

      {!bare &&
        Object.entries(SPOTS).map(([key, s]) =>
          has(key) && s.z < 4 ? (
            <img key={key} src={`./art/deco-${key}.webp`} alt="" className="absolute" style={{ left: `${s.left}%`, bottom: s.bottom != null ? `${s.bottom}%` : undefined, top: s.top != null ? `${s.top}%` : undefined, width: `${s.w}%`, zIndex: s.z, animation: s.anim, ...dim }} />
          ) : null,
        )}

      {/* ombre de contact puis maison */}
      <span className="absolute left-1/2 h-[7%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/20 blur-[6px]" style={{ width: `${h.w * 0.92}%`, bottom: `${h.bottom - 2.5}%`, zIndex: 4 }} />
      <img src={`./art/maison-${type}.webp`} alt="" className="absolute left-1/2 -translate-x-1/2" style={{ width: `${h.w}%`, bottom: `${h.bottom}%`, zIndex: 4, filter: night ? 'brightness(0.86)' : undefined }} />

      {!bare && has('guirlande') && (
        <img src="./art/deco-guirlande.webp" alt="" className="absolute -translate-x-1/2" style={{ left: `${h.lights[0]}%`, bottom: `${h.lights[1]}%`, width: `${h.lights[2]}%`, zIndex: 5, animation: 'scintille 2.4s ease-in-out infinite', filter: 'drop-shadow(0 0 3px rgba(255,214,120,0.7))' }} />
      )}
      {!bare &&
        has('fumee') &&
        [0, 1, 2].map((i) => (
          <span key={i} className="absolute h-[7%] w-[5%] rounded-full bg-white/90 opacity-0 blur-[2px]" style={{ left: `${h.smoke[0]}%`, bottom: `${h.smoke[1]}%`, zIndex: 5, animation: `fumee 3.8s ease-out ${i * 1.25}s infinite` }} />
        ))}

      {!bare &&
        Object.entries(SPOTS).map(([key, s]) =>
          has(key) && s.z >= 4 ? (
            <img key={key} src={`./art/deco-${key}.webp`} alt="" className="absolute" style={{ left: `${s.left}%`, bottom: `${s.bottom}%`, width: `${s.w}%`, zIndex: s.z, ...dim, ...(key === 'lanterne' && night ? { filter: 'drop-shadow(0 0 10px rgba(255,214,120,0.95))' } : {}) }} />
          ) : null,
        )}
    </div>
  )
}

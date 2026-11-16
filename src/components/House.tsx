import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { success, tap } from '../lib/haptic'
import { ANIMALS, CARE, moodOf, petStage, plantArt } from '../lib/data'
import type { HouseCare, HouseType, Member, Pet, Plot } from '../lib/types'
import { AGE_SCALE, lookOf } from '../lib/look'
import { Character } from './Character'
import { Smiley } from './Smiley'
import { dayPhase, season as seasonOf, todayKey, type Season } from '../lib/util'
import { animalMood, careFor, CareIcon, HandIcon, hungerOf, NoteIcon, RainCloud } from './care'
import { PetFigure } from './pet'

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
// Les fenêtres du bas et la porte de chaque maison, mesurées sur l'image (carrée) : x au centre, rebord, largeur du carreau.
// box : largeur minimale du cadre dans le décor (en %), pour qu'on voie bien le visage ; frame : couleur du cadre.
// L'immeuble n'a personne sur le pas de la porte : sa porte est trop près des fenêtres.
const OPENINGS: Record<HouseType, { win: { x: number; sill: number; w: number }[]; door: { x: number; y: number } | null; box: number; frame: string }> = {
  maison: { win: [{ x: 0.261, sill: 0.8, w: 0.169 }, { x: 0.712, sill: 0.8, w: 0.169 }], door: { x: 0.487, y: 0.885 }, box: 10, frame: '#E9A882' },
  appartement: { win: [{ x: 0.399, sill: 0.585, w: 0.112 }, { x: 0.676, sill: 0.585, w: 0.1 }], door: null, box: 8.5, frame: '#9C86D9' },
  chalet: { win: [{ x: 0.667, sill: 0.744, w: 0.118 }], door: { x: 0.433, y: 0.856 }, box: 9.5, frame: '#C98F55' },
}
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
  // le compagnon passe devant la famille : on doit pouvoir le voir, le nourrir et le caresser
  fleurs: { left: 28, bottom: 7, w: 15, z: 7, anim: 'balance 4.5s ease-in-out 0.6s infinite' },
  compagnon: { left: 57, bottom: 7, w: 12, z: 9, anim: 'respire 3.4s ease-in-out infinite', roam: 'balade 16s ease-in-out 4s infinite' },
  fontaine: { left: 2, bottom: 1, w: 18, z: 8, anim: 'respire 2.2s ease-in-out infinite' },
  potager: { left: 79, bottom: 0, w: 19, z: 9, anim: 'respire 5s ease-in-out 1s infinite' },
}
const ORDER = Object.keys(SPOTS)
// Décorations qui ont une vraie boucle animée (bande de sprites deco-<clé>-anim.webp).
const ANIM: Record<string, { frames: number; dur: number }> = {
  balancoire: { frames: 8, dur: 1.9 },
  fontaine: { frames: 6, dur: 0.8 },
}
const cover: CSSProperties = { position: 'absolute', inset: 0 }
// Le décor est dessiné pour un cadre 16/11 ; plus large (widget moyen), tout se resserre en largeur.
const BASE = 16 / 11
const careId = (c: HouseCare) => `${c.item_key}|${c.day}`

/** Un proche dans le jardin, avec son humeur du jour (null : pas encore donnée). */
export type HousePerson = { m: Member; mood: string | null; label: string; me: boolean }
// Places dans le jardin : de chaque côté de la maison (devant, puis un peu plus loin) et devant la porte.
const SLOTS = [
  { x: 13, y: 2, k: 1 },
  { x: 87, y: 2, k: 1 },
  { x: 29, y: 15, k: 0.82 },
  { x: 71, y: 15, k: 0.82 },
  { x: 50, y: 0, k: 1 },
  { x: 36, y: 1, k: 0.95 },
  { x: 64, y: 1, k: 0.95 },
]
const ORDERS: Record<number, number[]> = { 1: [4], 2: [0, 1], 3: [0, 4, 1], 4: [0, 2, 3, 1], 5: [0, 2, 4, 3, 1], 6: [0, 2, 5, 6, 3, 1], 7: [0, 2, 5, 4, 6, 3, 1] }

/** Un geste envoyé à un proche, joué pour de vrai dans le jardin : on va le voir et on le fait. */
export type HouseScene = { id: string; from: string; to: string; kind: string }
const SCENE_ART: Record<string, string> = { calin: 'geste-calin', bisou: 'geste-bisou', coeur: 'geste-coeur', courage: 'geste-courage', mot: 'geste-mot' }
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
  type, items, className = '', phase = dayPhase(), bare = false, season = seasonOf(), photos = [], people = [], onPerson, scene = null, onSceneEnd, ratio, cares, onCare, since, petted = true, onPet, pet = null, plots = [], gold = false,
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
  /** Un câlin, un bisou… : celui qui l'envoie va voir l'autre dans le jardin. */
  scene?: HouseScene | null
  onSceneEnd?: () => void
  /** Largeur / hauteur du cadre (16/11 par défaut ; plus large pour un widget moyen). */
  ratio?: number
  /** Les soins du jour : qui a nourri le chat, arrosé les fleurs… */
  cares?: HouseCare[]
  /** Toucher un animal qui a faim ou une plante qui a soif s'en occupe. */
  onCare?: (key: string) => void
  /** Date d'arrivée de chaque décoration : un animal oublié devient triste, puis déprime. */
  since?: Record<string, string>
  /** Ai-je déjà eu mon étoile de caresse aujourd'hui ? (sinon, une petite main invite à caresser) */
  petted?: boolean
  /** Caresser un animal nourri ; renvoie les étoiles gagnées. */
  onPet?: (key: string) => Promise<number>
  /** Le compagnon de la famille (il grandit avec l'amour) et ce qui pousse au potager. */
  pet?: Pet | null
  plots?: Plot[]
  /** La gamelle dorée du centre commercial, posée près de son coin. */
  gold?: boolean
}) {
  const night = phase === 'nuit'
  const base = HOUSE[type]
  const s = ratio ? Math.min(1, BASE / ratio) : 1
  // En vignette, la maison occupe presque tout le cadre.
  const h = bare ? { ...base, w: base.w * 1.5, bottom: 11 } : { ...base, w: base.w * s, smoke: [50 + (base.smoke[0] - 50) * s, base.smoke[1]] as [number, number] }
  // Les fenêtres et la porte, placées dans le décor : une partie de la famille s'y installe.
  const R = ratio ?? BASE
  const op0 = OPENINGS[type]
  const openings: Openings = {
    win: op0.win.map((w) => ({ x: 50 + (w.x - 0.5) * h.w, y: h.bottom + (1 - w.sill) * h.w * R, w: Math.max(w.w * h.w, op0.box * s) })),
    door: op0.door && { x: 50 + (op0.door.x - 0.5) * h.w, y: h.bottom + (1 - op0.door.y) * h.w * R },
    frame: op0.frame,
    ground: Math.max(0, h.bottom - 10),
    R,
  }
  const has = (k: string) => items.includes(k) || (k === 'compagnon' && !!pet)
  // le compagnon grandit : bébé, jeune, adulte
  const spotW = (k: string) => SPOTS[k].w * (k === 'compagnon' && pet ? petStage(pet.love).scale : 1)
  const dim = night ? 'brightness(0.72) saturate(0.9)' : undefined
  const [bounce, setBounce] = useState(0)
  const [poke, setPoke] = useState<{ key: string; n: number } | null>(null)

  // Soins : ce qui a déjà été fait aujourd'hui, et le « +3 » qui monte quand quelqu'un s'en occupe (soi ou un proche, en direct).
  const today = todayKey()
  const cared = (k: string) => !!cares?.some((c) => c.item_key === k && c.day === today)
  const seenCares = useRef<Set<string> | null>(null)
  const [gains, setGains] = useState<{ key: string; id: string; n: number }[]>([])
  // Comment va chaque animal ou plante (triste, déprimé, fané) ; les caresses en cours.
  const hunger = (k: string) => (cares ? hungerOf(k, cares, since) : 0)
  const moodOfKey = (k: string) => (ANIMALS.includes(k) ? animalMood(hunger(k)) : 'bien')
  const sadFilter = (k: string) => {
    if (!cares || !CARE[k]) return undefined
    if (ANIMALS.includes(k)) {
      const m = moodOfKey(k)
      return m === 'deprime' ? 'grayscale(0.75) brightness(0.92)' : m === 'triste' ? 'saturate(0.5)' : undefined
    }
    return hunger(k) >= 2 ? 'saturate(0.45) sepia(0.3)' : undefined
  }
  const [pets, setPets] = useState<{ key: string; id: number; n: number }[]>([])
  const stroke = (key: string) => {
    const id = Date.now()
    setPets((p) => [...p.filter((x) => x.key !== key), { key, id, n: 0 }])
    void onPet?.(key).then((n) => n && setPets((p) => p.map((x) => (x.id === id ? { ...x, n } : x))))
  }
  useEffect(() => {
    if (!cares) return
    if (seenCares.current) {
      const fresh = cares.filter((c) => c.day === today && CARE[c.item_key] && !seenCares.current!.has(careId(c)))
      if (fresh.length) {
        success()
        setGains((g) => [...g, ...fresh.map((c) => ({ key: c.item_key, id: `${careId(c)}:${Date.now()}`, n: CARE[c.item_key].stars }))])
      }
    }
    seenCares.current = new Set(cares.map(careId))
  }, [cares, today])

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

  // La scène : aller voir l'autre, faire le geste, revenir.
  const [act, setAct] = useState<null | 'aller' | 'geste' | 'retour'>(null)
  const endRef = useRef(onSceneEnd)
  endRef.current = onSceneEnd
  useEffect(() => {
    if (!scene) return
    setAct('aller')
    const t = [
      window.setTimeout(() => setAct('geste'), 1300),
      window.setTimeout(() => setAct('retour'), 3900),
      window.setTimeout(() => {
        setAct(null)
        endRef.current?.()
      }, 5300),
    ]
    return () => t.forEach((x) => window.clearTimeout(x))
  }, [scene?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const touch = (key: string) => {
    tap()
    setPoke((p) => ({ key, n: (p?.n ?? 0) + 1 }))
  }

  const deco = (key: string) => {
    const sp = SPOTS[key]
    const glow = key === 'lanterne' && night ? 'drop-shadow(0 0 10px rgba(255,214,120,0.95))' : undefined
    const poked = poke?.key === key
    const sad = sadFilter(key)
    const look = [glow ?? dim, sad].filter(Boolean).join(' ') || undefined
    return (
      <span
        key={key}
        onClick={() => {
          touch(key)
          if (onCare && CARE[key] && !cared(key)) onCare(key)
          else if (onPet && ANIMALS.includes(key)) stroke(key)
        }}
        className="absolute"
        style={{ left: `${sp.left}%`, bottom: sp.bottom != null ? `${sp.bottom}%` : undefined, top: sp.top != null ? `${sp.top}%` : undefined, width: `${spotW(key) * s}%`, zIndex: sp.z, animation: moodOfKey(key) === 'deprime' ? undefined : sp.roam }}
      >
        <span className="block" style={{ animation: `pousse 0.6s var(--ressort) ${fresh.includes(key) ? 0 : 0.15 + ORDER.indexOf(key) * 0.07}s both`, transformOrigin: '50% 100%' }}>
          <span key={poked ? poke.n : 0} className="block" style={{ animation: poked ? 'rebond 0.7s var(--ressort)' : undefined, transformOrigin: '50% 100%' }}>
            {key === 'compagnon' && pet ? (
              <PetFigure pet={pet} className="w-full transition-[filter] duration-700" style={{ animation: sp.anim, transformOrigin: '50% 100%' }} filter={look} />
            ) : key === 'potager' ? (
              // le bac du potager, et ce qui pousse dans ses trois parcelles
              <span className="relative block aspect-square w-full transition-[filter] duration-700" style={{ filter: look }}>
                <img src="./art/potager-bac.webp" alt="" className="absolute inset-0 block h-full w-full" />
                {plots.map((p) => (
                  <img
                    key={`${p.plot}${p.plant}${p.growth}`}
                    src={`./art/${plantArt(p.plant, p.growth)}.webp`}
                    alt=""
                    className="absolute block w-[40%]"
                    style={{ left: `${[30, 50, 70][p.plot] - 20}%`, bottom: '32%', zIndex: p.plot === 1 ? 1 : 2, animation: 'pop 0.5s var(--ressort) both, balance 5s ease-in-out 0.5s infinite', transformOrigin: '50% 100%' }}
                  />
                ))}
              </span>
            ) : ANIM[key] ? (
              <span className="block aspect-square w-full overflow-hidden transition-[filter] duration-700" style={{ filter: look }}>
                <img
                  src={`./art/deco-${key}-anim.webp`}
                  alt=""
                  className="block h-full max-w-none"
                  style={{ width: `${ANIM[key].frames * 100}%`, animation: `sprite ${ANIM[key].dur * (sad ? 2.4 : 1)}s steps(${ANIM[key].frames}) infinite` }}
                />
              </span>
            ) : (
              <img src={`./art/deco-${key}.webp`} alt="" className="block w-full transition-[filter] duration-700" style={{ animation: sp.anim, transformOrigin: '50% 100%', filter: look }} />
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

  // Au-dessus de tout (même des personnages) : la bulle « j'ai faim / j'ai soif », puis le soin lui-même.
  const careLayer = (key: string) => {
    const sp = SPOTS[key]
    const c = careFor(key, pet)
    const need = !cared(key)
    const mine = gains.filter((g) => g.key === key)
    const animal = ANIMALS.includes(key)
    const mood = moodOfKey(key)
    const petting = pets.filter((p) => p.key === key)
    const invite = animal && !need && !petted && !!onPet
    if (!need && !mine.length && !petting.length && !invite) return null
    const water = c.kind === 'arroser'
    const icon = Math.round(19 * Math.max(0.75, s))
    const sadLabel = mood === 'deprime' ? `${c.who.replace(/^./, (x) => x.toUpperCase())} déprime${c.plural ? 'nt' : ''} : ${c.plural ? 'ils' : 'il'} n’${c.plural ? 'ont' : 'a'} pas mangé depuis deux jours. ` : mood === 'triste' ? `${c.who.replace(/^./, (x) => x.toUpperCase())} ${c.plural ? 'sont tristes' : 'est triste'} : pas mangé hier. ` : ''
    return (
      <span
        key={`soin-${key}`}
        className="pointer-events-none absolute aspect-square"
        style={{ left: `${sp.left}%`, bottom: `${sp.bottom ?? 0}%`, width: `${spotW(key) * s}%`, zIndex: 10, animation: mood === 'deprime' ? undefined : sp.roam }}
      >
        {/* un animal qui déprime a son petit nuage de pluie */}
        {need && mood === 'deprime' && (
          <span className="absolute bottom-[150%] left-1/2 block w-[110%] -translate-x-1/2" style={{ animation: 'flotte 3s ease-in-out infinite' }}>
            <RainCloud size="100%" />
            {[22, 44, 66].map((x, i) => (
              <span key={x} className="absolute top-[58%] block h-[16%] w-[5%] rounded-full bg-[#7CA6D6]" style={{ left: `${x}%`, animation: `pluie 1.1s linear ${i * 0.35}s infinite` }} />
            ))}
          </span>
        )}
        {need &&
          (onCare ? (
            <button
              onClick={() => {
                touch(key)
                onCare(key)
              }}
              className={`pointer-events-auto absolute bottom-[88%] left-1/2 flex rounded-full bg-white p-[3px] shadow-[0_3px_10px_rgba(29,26,43,0.25)] ${mood !== 'bien' ? 'ring-2 ring-rouge/70' : ''}`}
              style={{ animation: `appelle ${mood === 'bien' ? 2.2 : 1.1}s ease-in-out infinite` }}
              aria-label={`${sadLabel || `${c.need}. `}${c.verb} : +${c.stars} étoile${c.stars > 1 ? 's' : ''}`}
            >
              <CareIcon k={key} size={icon} />
            </button>
          ) : (
            <span className={`absolute bottom-[88%] left-1/2 flex -translate-x-1/2 rounded-full bg-white p-[2px] shadow-[0_2px_6px_rgba(29,26,43,0.22)] ${mood !== 'bien' ? 'ring-2 ring-rouge/70' : ''}`}>
              <CareIcon k={key} size={Math.round(17 * Math.max(0.75, s))} />
            </span>
          ))}
        {/* nourri, pas encore caressé aujourd'hui : une petite main invite à le faire */}
        {invite && !petting.length && !mine.length && (
          <button
            onClick={() => {
              touch(key)
              stroke(key)
            }}
            className="pointer-events-auto absolute bottom-[88%] left-1/2 flex rounded-full bg-[#FFE4EC] p-[3px] shadow-[0_3px_10px_rgba(29,26,43,0.22)]"
            style={{ animation: 'appelle 2.6s ease-in-out infinite' }}
            aria-label={`Caresser ${c.who} : +1 étoile`}
          >
            <HandIcon size={icon + 2} />
          </button>
        )}
        {/* la caresse : la main passe et repasse, le chat ronronne, les oiseaux chantent */}
        {petting.map((p) => (
          <span key={p.id} className="absolute inset-0" style={{ animation: 'apparait 3s ease both' }} onAnimationEnd={(e) => e.target === e.currentTarget && setPets((all) => all.filter((x) => x.id !== p.id))}>
            {key === 'compagnon' ? (
              <>
                <span className="absolute left-[2%] top-[-40%] block w-[100%] drop-shadow-[0_2px_4px_rgba(29,26,43,0.3)]" style={{ animation: 'caresse 0.62s ease-in-out 3' }}>
                  <HandIcon size="100%" />
                </span>
                <span className="absolute -top-[52%] left-[70%] whitespace-nowrap font-rond text-[11px] font-semibold italic text-[#8B5A2B]" style={{ animation: 'jaillit 1.6s ease-out 0.5s both', ['--jx' as string]: '30%' }}>
                  ronron
                </span>
              </>
            ) : (
              [0, 1, 2].map((i) => (
                <span key={i} className="absolute left-[34%] top-[-10%] block w-[30%]" style={{ animation: `jaillit 1.5s ease-out ${i * 0.28}s both`, ['--jx' as string]: `${(i - 1) * 120}%` }}>
                  <NoteIcon size="100%" color={['#6E56CF', '#E77BA0', '#3E9BE9'][i]} />
                </span>
              ))
            )}
            {[0, 1, 2].map((i) => (
              <img key={i} src="./art/geste-coeur.webp" alt="" className="absolute left-[25%] top-[-6%] w-[50%]" style={{ animation: `jaillit 1.3s ease-out ${1.1 + i * 0.2}s both`, ['--jx' as string]: `${(i - 1) * 90}%` }} />
            ))}
            {p.n > 0 && (
              <span
                className="absolute bottom-[110%] left-1/2 flex items-center gap-[3px] whitespace-nowrap rounded-full bg-white py-[3px] pl-[8px] pr-[5px] text-[13px] font-bold text-teinte-fonce shadow-[0_4px_12px_rgba(29,26,43,0.25)]"
                style={{ animation: 'gain 1.6s ease-out 1.2s both' }}
              >
                +{p.n} <img src="./art/picto-etoile.webp" alt="" className="h-[15px] w-[15px]" />
              </span>
            )}
          </span>
        ))}
        {mine.map((g) => (
          <span key={g.id} className="absolute inset-0">
            {/* l'arrosoir qui verse, ou la gamelle / les graines qui arrivent */}
            {water ? (
              <span className="absolute left-[-18%] top-[-58%] block w-[62%] origin-[80%_60%]" style={{ animation: 'verse 1.7s ease-in-out both' }}>
                <CareIcon k={key} size="100%" />
              </span>
            ) : key === 'compagnon' ? (
              <span className="absolute bottom-[-6%] left-[58%] block w-[46%]" style={{ animation: 'pop 0.45s var(--ressort) both' }}>
                <CareIcon k={key} size="100%" />
              </span>
            ) : null}
            {water || key === 'cabane'
              ? [12, 30, 48, 64, 22, 56].map((x, i) => (
                  <span
                    key={i}
                    className="absolute top-[8%] block w-[7%]"
                    style={{
                      left: `${x}%`,
                      aspectRatio: water ? '0.72' : '1.5',
                      borderRadius: water ? '50% 50% 50% 50% / 62% 62% 38% 38%' : '50%',
                      background: water ? '#5AAEF0' : i % 2 ? '#D9A43A' : '#EEC35A',
                      animation: `pluie 0.9s ease-in ${0.35 + i * 0.14}s both`,
                    }}
                  />
                ))
              : [0, 1, 2].map((i) => (
                  <img key={i} src="./art/geste-coeur.webp" alt="" className="absolute left-[30%] top-[0%] w-[40%]" style={{ animation: `jaillit 1.2s ease-out ${0.3 + i * 0.12}s both`, ['--jx' as string]: `${(i - 1) * 90}%` }} />
                ))}
            {/* le gain, qui monte au-dessus */}
            <span
              className="absolute bottom-[70%] left-1/2 flex items-center gap-[3px] whitespace-nowrap rounded-full bg-white py-[3px] pl-[8px] pr-[5px] text-[13px] font-bold text-teinte-fonce shadow-[0_4px_12px_rgba(29,26,43,0.25)]"
              style={{ animation: 'gain 2.2s ease-out 0.25s both' }}
              onAnimationEnd={() => setGains((all) => all.filter((x) => x.id !== g.id))}
            >
              +{g.n} <img src="./art/picto-etoile.webp" alt="" className="h-[15px] w-[15px]" />
            </span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <div
      className={`relative overflow-hidden ${ratio ? '' : 'aspect-[16/11]'} ${className}`}
      style={{ background: SKY[phase], aspectRatio: ratio }}
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

      {/* le coin du compagnon (panier, coussin, niche, arbre) et sa gamelle dorée */}
      {!bare && pet?.bed && (
        <img
          src={`./art/${pet.bed.replace(':', '-')}.webp`}
          alt=""
          className="pointer-events-none absolute block"
          style={{ left: `${50 + (SPOTS.compagnon.left - 12 - 50) * s}%`, bottom: '4%', width: `${(pet.bed === 'lit:arbre' || pet.bed === 'lit:niche' ? 13 : 10.5) * s}%`, zIndex: 8, animation: 'pop 0.6s var(--ressort) both' }}
        />
      )}
      {!bare && pet && gold && (
        <img src="./art/shop-gamelle.webp" alt="" className="pointer-events-none absolute block" style={{ left: `${50 + (SPOTS.compagnon.left + 11 - 50) * s}%`, bottom: '3%', width: `${5.5 * s}%`, zIndex: 8 }} />
      )}

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
              <span key={src.slice(-32) + i} className="absolute -translate-x-1/2" style={{ left: `${x}%`, top: `${(y / 40) * 100}%`, width: `${11.5 * s}%` }}>
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

      {/* la famille dans le jardin : chacun son personnage, sa taille, son humeur sur le visage et dans une bulle */}
      {!bare && people.length > 0 && <Jardin people={people} onTouch={touch} onPerson={onPerson} poke={poke} scene={act ? scene : null} act={act} s={s} op={openings} />}

      {/* les soins du jour, par-dessus tout le monde */}
      {!bare && cares && Object.keys(CARE).filter(has).map(careLayer)}

      {!bare && type === 'chalet' &&
        Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="pointer-events-none absolute -top-[4%] rounded-full bg-white" style={{ left: `${(i * 37 + 5) % 100}%`, width: 3 + (i % 3), height: 3 + (i % 3), opacity: 0.85, zIndex: 9, animation: `neige ${7 + (i % 5) * 1.6}s linear ${-i * 0.9}s infinite`, ['--nx' as string]: `${i % 2 ? 22 : -18}px` }} />
        ))}
    </div>
  )
}

// Où se tient chacun : dans le jardin, devant la porte d'entrée, ou à une fenêtre du bas.
type Where = 'jardin' | 'porte' | 'fenetre'
/** x, y : position dans le décor (en %) ; pour une fenêtre, y est le rebord et w la largeur du cadre. */
type At = { x: number; y: number; k: number; where: Where; w?: number }
type Placed = { p: HousePerson; at: At; i: number; scale: number }
/** Les ouvertures de la maison, déjà placées dans le décor. */
export type Openings = { win: { x: number; y: number; w: number }[]; door: { x: number; y: number } | null; frame: string; ground: number; R: number }

// Quand la porte et les fenêtres sont occupées, le jardin garde les côtés (le milieu reste dégagé).
const SIDES = [
  { x: 11, y: 2, k: 1 },
  { x: 89, y: 2, k: 1 },
  { x: 24, y: 9, k: 0.88 },
  { x: 76, y: 9, k: 0.88 },
]
const SIDE_ORDERS: Record<number, number[]> = { 1: [0], 2: [0, 1], 3: [0, 2, 1], 4: [0, 2, 3, 1] }

/** Répartit la famille : jusqu'à 3, tout le monde au jardin ; au-delà, deux restent au moins dehors,
 *  les autres vont aux fenêtres du bas et sur le pas de la porte. Moi et les petits restent au jardin. */
function arrange(people: HousePerson[], op: Openings): { placed: Placed[]; extra: number } {
  const age = (p: HousePerson) => lookOf(p.m.avatar, p.m.user_id ?? p.m.id).a
  const rank = (p: HousePerson) => (p.me ? 0 : age(p) >= 2 ? 1 : 2)
  const ordered = [...people].sort((a, b) => rank(a) - rank(b))
  const cap = 4 + (op.door ? 1 : 0) + op.win.length
  const shown = ordered.length > cap ? ordered.slice(0, cap - 1) : ordered
  const n = shown.length
  const scale = (p: HousePerson) => AGE_SCALE[age(p)] ?? 1
  if (n <= 3) {
    const order = ORDERS[n] ?? []
    return { placed: shown.map((p, i) => ({ p, i, scale: scale(p), at: { ...SLOTS[order[i]], where: 'jardin' as const } })), extra: 0 }
  }
  const wins = Math.min(op.win.length, n - 2)
  const rest = n - wins
  const door = op.door && rest >= 3 ? 1 : 0
  const garden = rest - door
  const placed = shown.map((p, i): Placed => {
    let at: At
    if (i < garden) at = { ...SIDES[SIDE_ORDERS[garden][i]], where: 'jardin' }
    else if (i < garden + door && op.door) at = { x: op.door.x, y: op.door.y - 1, k: 0.8, where: 'porte' }
    else {
      const w = op.win[i - garden - door]
      at = { x: w.x, y: w.y, k: 1, w: w.w, where: 'fenetre' }
    }
    return { p, i, scale: scale(p), at }
  })
  return { placed, extra: people.length - shown.length }
}

function Jardin({
  people, onTouch, onPerson, poke, scene, act, s = 1, op,
}: {
  people: HousePerson[]
  onTouch: (key: string) => void
  onPerson?: (m: Member) => void
  poke: { key: string; n: number } | null
  scene: HouseScene | null
  act: null | 'aller' | 'geste' | 'retour'
  s?: number
  op: Openings
}) {
  const { placed, extra } = arrange(people, op)
  const from = scene && placed.find((x) => x.p.m.id === scene.from)
  const to = scene && placed.find((x) => x.p.m.id === scene.to)
  const live = from && to && from !== to ? { from, to, side: from.at.x <= to.at.x ? -1 : 1 } : null
  // Vers quelqu'un à sa fenêtre : on va sous la fenêtre et on lui envoie le geste vers le haut.
  // Depuis une fenêtre : on l'envoie de là-haut. Sinon, on va le voir et on le fait pour de vrai.
  const fromWin = live?.from.at.where === 'fenetre'
  const toWin = live?.to.at.where === 'fenetre'
  const thrown = live && (fromWin || toWin)
  const doing = live && act === 'geste' ? scene!.kind : null
  const R = op.R
  const height = (x: Placed, k = x.at.k) => (x.at.where === 'fenetre' ? (x.at.w ?? 10) * R * 1.08 : 14 * k * x.scale * s * 1.6 * R)
  // où va celui qui envoie (s'il bouge)
  const dest: At | null = !live || fromWin ? null : toWin ? { x: live.to.at.x, y: op.ground, k: 1, where: 'jardin' } : { ...live.to.at, x: live.to.at.x + live.side * 8 * live.to.at.k * s, where: 'jardin' }
  // le trajet du geste lancé (bas → fenêtre, ou fenêtre → bas)
  const flight =
    thrown && doing
      ? {
          x0: fromWin ? live.from.at.x : dest!.x,
          y0: fromWin ? live.from.at.y + height(live.from) * 0.5 : dest!.y + height(live.from, 1) * 0.72,
          x1: live.to.at.x,
          y1: toWin ? live.to.at.y + height(live.to) * 0.45 : live.to.at.y + height(live.to) * 0.7,
        }
      : null

  return (
    <>
      {placed.map((x) => {
        const { p, at, i, scale } = x
        const md = moodOf(p.mood)
        const hop = poke?.key === p.m.id
        const isFrom = live?.from.p.m.id === p.m.id
        const isTo = live?.to.p.m.id === p.m.id
        const label = p.me ? (md ? `Moi : ${md.label}. Changer mon humeur` : 'Partager mon humeur') : `${p.label}${at.where === 'fenetre' ? ', à la fenêtre' : at.where === 'porte' ? ', sur le pas de la porte' : ''} : ${md ? md.label : 'pas encore d’humeur aujourd’hui'}. Lui envoyer un câlin`
        const bubble = md ? (
          <span className="relative mb-[3px] flex rounded-full bg-white p-[2px] shadow-[0_3px_8px_rgba(29,26,43,0.2)]" style={{ animation: `flotte ${3.6 + i * 0.5}s ease-in-out infinite` }}>
            <Smiley mood={md.key} size={Math.round(20 * Math.max(0.8, s))} />
            <span className="absolute -bottom-[3px] left-1/2 -z-10 h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-white" />
          </span>
        ) : p.me ? (
          <span className="relative mb-[3px] whitespace-nowrap rounded-full bg-teinte px-[7px] py-[2px] text-[10px] font-semibold leading-[14px] text-white shadow-[0_3px_8px_rgba(102,70,204,0.35)]" style={{ animation: 'flotte 3.6s ease-in-out infinite' }}>
            + Mon humeur
            <span className="absolute -bottom-[3px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-teinte" />
          </span>
        ) : null
        const click = () => {
          onTouch(p.m.id)
          onPerson?.(p.m)
        }

        // ── à la fenêtre : le buste derrière le rebord, dans la lumière de la maison
        if (at.where === 'fenetre') {
          const busy = (isFrom || isTo) && doing
          return (
            <button key={p.m.id} onClick={click} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${at.x}%`, bottom: `${at.y}%`, width: `${at.w}%`, zIndex: 5 }} aria-label={label}>
              {bubble}
              <span className="relative block w-full overflow-hidden" style={{ aspectRatio: '1 / 1.08', borderRadius: '44% 44% 9% 9% / 36% 36% 7% 7%', background: 'radial-gradient(circle at 50% 30%, #FFF4D2 0%, #FFDB8F 52%, #F0B661 100%)' }}>
                <span key={hop ? poke!.n : 0} className="absolute -bottom-[16%] left-[-5%] block w-[110%]" style={{ animation: hop || (isTo && doing) ? 'rebond 0.7s var(--ressort)' : undefined, transformOrigin: '50% 100%' }}>
                  <span className="block" style={{ animation: busy && isFrom ? 'sautille 0.5s ease-in-out infinite' : MOVES[p.mood ?? ''] ?? `respire ${3 + (i % 3) * 0.6}s ease-in-out infinite`, transformOrigin: '50% 100%' }}>
                    <Character look={lookOf(p.m.avatar, p.m.user_id ?? p.m.id)} mood={p.mood} bust blush={doing === 'bisou' && isTo} className="block h-auto w-full" blinkDelay={i * 1.3} />
                  </span>
                </span>
                {/* le cadre de la fenêtre, par-dessus */}
                <span className="pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit', boxShadow: `inset 0 0 0 ${Math.max(1.5, 2.6 * s)}px ${op.frame}, inset 0 6px 10px rgba(255,255,255,0.35)` }} />
              </span>
              {/* le rebord */}
              <span className="block h-[4px] w-[118%] rounded-full shadow-[0_2px_3px_rgba(29,26,43,0.18)]" style={{ background: op.frame }} />
            </button>
          )
        }

        // ── au jardin ou sur le pas de la porte
        const away = isFrom && !!dest && (act === 'aller' || act === 'geste')
        const pos = away ? dest! : at
        const hug = !thrown && doing === 'calin' && (isFrom || isTo)
        const lean = !thrown && doing && (isFrom || (isTo && doing === 'calin')) ? (isFrom ? -live!.side : live!.side) * (doing === 'bisou' ? 11 : 7) : 0
        const walking = isFrom && !!dest && act !== 'geste'
        // sous une fenêtre, on lève la tête et on envoie le geste vers le haut
        const lookUp = isFrom && toWin && doing
        return (
          <button
            key={p.m.id}
            onClick={click}
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{
              left: `${pos.x}%`,
              bottom: `${pos.y}%`,
              width: `${14 * pos.k * scale * s}%`,
              zIndex: isFrom ? 9 : at.where === 'porte' ? 6 : pos.k < 1 ? 7 : 8,
              transition: 'left 1.3s ease-in-out, bottom 1.3s ease-in-out, width 1.3s ease-in-out',
            }}
            aria-label={label}
          >
            {/* la bulle reste discrète pendant qu'on va voir quelqu'un */}
            {away && !md ? null : bubble}
            {/* le personnage : il se promène, respire, cligne des yeux, saute quand on le touche */}
            <span className="relative block w-full" style={{ animation: away || isTo || at.where === 'porte' ? undefined : `marche ${8 + i * 1.7}s ease-in-out ${-i * 2}s infinite`, ['--mx' as string]: `${i % 2 ? -7 : 7}px` }}>
              <span className="absolute bottom-[0.5%] left-1/2 h-[6%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[#1d1a2b]/20 blur-[2px]" />
              <span key={hop || (isTo && thrown && doing) ? `${poke?.n ?? 0}${doing ?? ''}` : 0} className="block" style={{ animation: hop || (isTo && thrown && doing) ? 'rebond 0.7s var(--ressort)' : undefined, transformOrigin: '50% 100%' }}>
                <span
                  className={`block transition-[filter,opacity,transform] duration-500 ${p.me && !md && !isFrom && !isTo ? 'opacity-60 grayscale' : ''}`}
                  style={{
                    animation: walking ? 'sautille 0.42s ease-in-out infinite' : lookUp || (doing === 'courage' && isFrom) ? 'sautille 0.5s ease-in-out infinite' : MOVES[p.mood ?? ''] ?? `respire ${3 + (i % 3) * 0.6}s ease-in-out infinite`,
                    transform: lookUp ? `rotate(${live!.side * 6}deg)` : lean ? `rotate(${lean}deg)` : undefined,
                    transformOrigin: '50% 100%',
                  }}
                >
                  <Character look={lookOf(p.m.avatar, p.m.user_id ?? p.m.id)} mood={p.mood} extras pose={hug ? 'calin' : undefined} blush={doing === 'bisou' && isTo} className="block h-auto w-full" blinkDelay={i * 1.3} />
                </span>
              </span>
            </span>
          </button>
        )
      })}

      {/* le geste lui-même : entre les deux, ou lancé vers la fenêtre (et depuis la fenêtre) */}
      {doing && live && !flight && (
        <span className="pointer-events-none absolute" style={{ left: `${live.to.at.x + live.side * 4 * live.to.at.k - 6 * s}%`, bottom: `${live.to.at.y + 30}%`, width: `${12 * s}%`, zIndex: 10 }}>
          {[0, 1, 2].map((n) => (
            <img
              key={`${scene!.id}${n}`}
              src={`./art/${SCENE_ART[doing] ?? 'geste-coeur'}.webp`}
              alt=""
              className="absolute left-0 top-0 w-full"
              style={{ animation: `jaillit 1.5s ease-out ${n * 0.35}s both`, ['--jx' as string]: `${(n - 1) * 60}%` }}
            />
          ))}
        </span>
      )}
      {doing && flight &&
        [0, 1, 2].map((n) => (
          <img
            key={`${scene!.id}v${n}`}
            src={`./art/${SCENE_ART[doing] ?? 'geste-coeur'}.webp`}
            alt=""
            className="pointer-events-none absolute"
            style={{
              width: `${(n === 1 ? 11 : 8) * s}%`,
              zIndex: 10,
              animation: `envoi 1.5s ease-in-out ${n * 0.4}s both`,
              ['--x0' as string]: `${flight.x0 + (n - 1) * 2}%`,
              ['--y0' as string]: `${flight.y0}%`,
              ['--x1' as string]: `${flight.x1 + (n - 1) * 3}%`,
              ['--y1' as string]: `${flight.y1 + (n - 1) * 1.5}%`,
            }}
          />
        ))}

      {extra > 0 && (
        <span className="absolute bottom-[4%] left-1/2 flex h-[30px] w-[30px] -translate-x-1/2 items-center justify-center rounded-full bg-white/90 text-[12px] font-semibold text-encre shadow-[0_2px_8px_rgba(29,26,43,0.2)]" style={{ zIndex: 8 }}>
          +{extra}
        </span>
      )}
    </>
  )
}

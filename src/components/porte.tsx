// « À deux, on porte ! » : deux porteurs, une planche, un objet fragile et un parcours d'obstacles.
// Trois façons de jouer : à deux sur le même téléphone (un pouce chacun), chacun sur son téléphone
// (en direct, par le canal de « Dessiner à deux »), ou avec le panda roux quand on est seul.
// Le moteur est dans src/lib/porte.ts ; ici, l'écran, les commandes et les nouvelles entre les deux téléphones.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Lock, RotateCcw, Smartphone, Star, UsersRound, X } from 'lucide-react'
import { CORPS } from '../lib/corps'
import { success, tap, warn } from '../lib/haptic'
import { lookOf, type Look } from '../lib/look'
import { MAINS } from '../lib/mains'
import { persoOf } from '../lib/persos'
import {
  animalLa, E_MAX, E_OK, ecart, etoiles, LONG, motDeFin, NIVEAUX, nouveauRobot, nouvellePartie, pas, robot, Seance, sol,
  type Etape, type Niveau, type Partie, type Robot, type Suite, type Zone,
} from '../lib/porte'
import { jouer, precharger, type Son } from '../lib/sons'
import { EN_LIGNE, useHome } from '../lib/store'
import type { LiveEvent, LiveRoom, Member } from '../lib/types'
import { Character } from './Character'
import { GameTile } from './gamePresentation'
import { Avatar, Btn, Confettis, Page } from './ui'

// ───────── Les records : sur le compte (la base), avec une copie sur l'appareil ─────────
// La copie sert tout de suite (les niveaux ouverts, les étoiles affichées) et quand le réseau manque ;
// ce qu'elle a de mieux que le compte y est envoyé à la prochaine ouverture du jeu.

type Records = Record<number, { e: number; t: number }>
const cle = (membre: string) => `nidoo.porte.${membre}`
function lireRecords(membre: string): Records {
  try {
    // (les tout premiers records étaient gardés sans le nom du membre)
    const ancien = localStorage.getItem('nidoo.porte')
    if (ancien && !localStorage.getItem(cle(membre))) localStorage.setItem(cle(membre), ancien)
    if (ancien) localStorage.removeItem('nidoo.porte')
    return JSON.parse(localStorage.getItem(cle(membre)) ?? '{}') as Records
  } catch {
    return {}
  }
}
function ecrireRecords(membre: string, r: Records) {
  try {
    localStorage.setItem(cle(membre), JSON.stringify(r))
  } catch {
    /* tant pis : la copie ne sera pas retenue */
  }
}
const mieux = (x: { e: number; t: number }, y?: { e: number; t: number }) => !y || x.e > y.e || (x.e === y.e && x.t < y.t)
function noterRecord(membre: string, i: number, e: number, t: number) {
  const r = lireRecords(membre)
  const neuf = { e, t: Math.round(t * 10) / 10 }
  if (mieux(neuf, r[i])) r[i] = neuf
  ecrireRecords(membre, r)
  return r
}
/** Le meilleur des deux, niveau par niveau. */
function fusion(x: Records, y: Records): Records {
  const r: Records = { ...x }
  for (const [k, v] of Object.entries(y)) if (mieux(v, r[Number(k)])) r[Number(k)] = v
  return r
}

// ───────── Qui porte ─────────

export type ModePorte =
  /** seul : je porte derrière, le panda roux devant */
  | { k: 'panda' }
  /** à deux sur ce téléphone : moi à gauche, l'autre à droite */
  | { k: 'ensemble'; avec: Member }
  /** chacun sur son téléphone : celui qui invite porte derrière */
  | { k: 'direct'; avec: Member; session: string; hote: boolean }

/** Un porteur à l'écran : sa largeur, la hauteur de ses mains au-dessus du sol. */
type Tenue = { l: number; mains: number; look?: Look }
const PANDA_TENUE: Tenue = { l: 86, mains: 44 }
function tenue(m: Member): Tenue {
  const look = lookOf(m.avatar, m.user_id ?? m.id)
  const p = persoOf(look)
  // les enfants et les bébés sont plus petits que les grands
  const l = 82 * ([1, 0.93, 0.8, 0.66][look.a] ?? 1)
  const h = (l * 440) / 300
  const mn = MAINS[p.id]
  const pieds = CORPS[p.id]?.[4] ?? 0.99
  return { l, mains: mn ? (pieds - (mn[1] + mn[3]) / 2) * h : h * 0.33, look }
}

const STYLE = `
.porte-animal { transition: opacity .28s ease, transform .28s cubic-bezier(.3,1.4,.5,1); transform-origin: 50% 100%; }
.porte-animal[data-etat="non"] { opacity: 0; transform: translateY(14px) scale(.6); }
.porte-animal[data-etat="vient"] { opacity: .6; transform: translateY(5px) scale(.85); }
.porte-animal[data-etat="la"] { opacity: 1; transform: none; }
.porte-alerte { transition: opacity .2s ease, transform .2s ease; }
.porte-alerte[data-on="0"] { opacity: 0; transform: translateY(6px) scale(.8); }
.porte-touche { transition: transform .08s ease, filter .08s ease; -webkit-tap-highlight-color: transparent; touch-action: none; }
.porte-touche[data-appui="1"] { transform: translateY(3px) scale(.985); filter: brightness(.93); }
@keyframes porte-saut { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-16px) } }
.porte-joie { animation: porte-saut .55s ease-in-out 3; }
@keyframes porte-compte { from { transform: scale(1.7); opacity: 0 } 30% { opacity: 1 } to { transform: scale(1); opacity: 1 } }
.porte-compte { animation: porte-compte .5s cubic-bezier(.2,1.3,.4,1) both; }
@media (prefers-reduced-motion: reduce) { .porte-joie, .porte-compte { animation: none; } }
`

const VUE = 400
const CRIS: Record<string, Son> = { chat: 'chat', chien: 'chien', lapin: 'lapin' }
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Le sol : l'herbe, le chemin, et ce qu'il y a dessus (boue, verglas, bosses). */
function Sol({ n, base }: { n: Niveau; base: number }) {
  const x0 = -420
  const x1 = n.long + 760
  const haut = base + 70
  const y = (x: number) => haut - base - sol(n, x).h
  const ligne = (a: number, b: number, dy = 0) => {
    const pts: string[] = []
    for (let x = a; x <= b; x += 12) pts.push(`${(x - x0).toFixed(1)},${(y(x) + dy).toFixed(1)}`)
    pts.push(`${(b - x0).toFixed(1)},${(y(b) + dy).toFixed(1)}`)
    return pts.join(' ')
  }
  return (
    <svg className="absolute bottom-0" style={{ left: x0, width: x1 - x0, height: haut }} viewBox={`0 0 ${x1 - x0} ${haut}`} aria-hidden>
      <polygon points={`0,${haut} ${ligne(x0, x1)} ${x1 - x0},${haut}`} fill={n.herbe} />
      <polyline points={ligne(x0, x1, 1.5)} fill="none" stroke="rgba(29,26,43,0.10)" strokeWidth={3} />
      {/* le chemin */}
      <polyline points={ligne(x0 + 20, x1 - 20, 9)} fill="none" stroke="#F1E3C6" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      {n.zones.map((z, i) => {
        if (z.k === 'boue')
          return (
            <g key={i}>
              <polyline points={ligne(z.x, z.x + z.l, 8)} fill="none" stroke="#8A5A3B" strokeWidth={19} strokeLinecap="round" />
              <polyline points={ligne(z.x + 14, z.x + z.l - 14, 5)} fill="none" stroke="#A8714B" strokeWidth={5} strokeLinecap="round" strokeDasharray="16 22" />
            </g>
          )
        if (z.k === 'glace')
          return (
            <g key={i}>
              <polyline points={ligne(z.x, z.x + z.l, 8)} fill="none" stroke="#BFE6FA" strokeWidth={19} strokeLinecap="round" />
              <polyline points={ligne(z.x + 12, z.x + z.l - 12, 4)} fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" strokeDasharray="22 18" />
            </g>
          )
        if (z.k === 'bosse')
          return (
            <g key={i}>
              <ellipse cx={z.x - x0} cy={y(z.x) + 4} rx={17} ry={10} fill="#C9A06E" />
              <ellipse cx={z.x - x0 - 4} cy={y(z.x) + 1} rx={7} ry={3.5} fill="#DDBB8E" />
            </g>
          )
        return null
      })}
      {/* la ligne d'arrivée, devant la maison */}
      <rect x={n.long - x0 - 5} y={y(n.long) + 1} width={LONG + 10} height={15} rx={4} fill="#fff" opacity={0.9} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={n.long - x0 - 5 + i * 20} y={y(n.long) + 1 + (i % 2 ? 7.5 : 0)} width={20} height={7.5} fill="#2B2540" opacity={0.75} />
      ))}
    </svg>
  )
}

/** Le décor : des arbres, des fleurs, la maison où l'on livre. */
function Decor({ n, base }: { n: Niveau; base: number }) {
  const libre = (x: number) => !n.zones.some((z) => z.k === 'animal' && Math.abs(z.x - x) < 70)
  const arbres: number[] = []
  for (let x = -260, i = 0; x < n.long - 120; x += 310 + ((i * 97) % 130), i++) if (libre(x)) arbres.push(x)
  const neige = n.herbe.startsWith('#E')
  return (
    <>
      {arbres.map((x, i) => (
        <img
          key={x}
          src={`./art/${neige ? 'avent-sapin' : i % 3 === 2 ? 'deco-fleurs' : 'deco-arbre'}.webp`}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: x - (i % 3 === 2 && !neige ? 30 : neige ? 34 : 62), bottom: base + sol(n, x).h - (i % 3 === 2 && !neige ? 2 : 6), width: i % 3 === 2 && !neige ? 60 : neige ? 68 : 124, opacity: 0.96 }}
        />
      ))}
      <img src="./art/maison-maison.webp" alt="" draggable={false} className="absolute max-w-none select-none" style={{ left: n.long + LONG + 60, bottom: base - 16, width: 230 }} />
    </>
  )
}

type Phase = 'attente' | 'decompte' | 'jeu' | 'chute' | 'fin' | 'parti'

/** La partie elle-même, en plein écran. */
export function PorteJeu({ mode, niveau: depart, onClose, onRecords }: { mode: ModePorte; niveau: number; onClose: () => void; onRecords?: (r: Records) => void }) {
  const { state, api, reload } = useHome()
  const { me, family } = state
  const direct = mode.k === 'direct'
  /** en démo, le proche invité est fictif : il joue tout seul, chez nous */
  const fictif = direct && !EN_LIGNE
  const hote = mode.k !== 'direct' || mode.hote
  const session = mode.k === 'direct' ? mode.session : ''
  /** le côté que je porte (à deux sur ce téléphone : les deux) */
  const monCote: 'a' | 'b' = hote ? 'a' : 'b'
  const [idx, setIdx] = useState(depart)
  const n = NIVEAUX[idx]
  const [phase, setPhase] = useState<Phase>(direct ? 'attente' : 'decompte')
  const [compte, setCompte] = useState(3)
  const [bilan, setBilan] = useState<{ gagne: boolean; e: number; temps: number; mot: string; gain: number } | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [sansReponse, setSansReponse] = useState(false)

  // qui est à gauche (derrière), qui est à droite (devant)
  const autre = mode.k === 'panda' ? null : mode.avec
  const gauche = hote ? me : autre!
  const droite = hote ? autre : me
  const tA = useMemo(() => tenue(gauche), [gauche])
  const tB = useMemo(() => (droite ? tenue(droite) : PANDA_TENUE), [droite])

  // ───── l'état du jeu, hors de React (60 images par seconde) ─────
  const g = useRef<Partie>(nouvellePartie())
  const appui = useRef({ a: false, b: false })
  const rb = useRef<Robot>(nouveauRobot())
  /** chacun sur son téléphone : ce qu'on reçoit, ce qu'on envoie (src/lib/porte.ts) */
  const seance = useRef<Seance | null>(null)
  const ph = useRef<Phase>(phase)
  ph.current = phase
  const niv = useRef(n)
  niv.current = n
  const marche = useRef({ a: 0, b: 0 })
  const chute = useRef({ t: 0, x: 0, y: 0, r: 0 })
  const vus = useRef<Record<number, string>>({})

  // en démo seulement : une prise pour les essais automatiques (lire où en est la partie)
  useEffect(() => {
    if (import.meta.env.MODE !== 'demo') return
    const w = window as unknown as { __porte?: unknown }
    w.__porte = { partie: () => g.current, phase: () => ph.current }
    return () => {
      delete w.__porte
    }
  }, [])

  const scene = useRef<HTMLDivElement>(null)
  const monde = useRef<HTMLDivElement>(null)
  const ciel = useRef<HTMLDivElement>(null)
  const loinDecor = useRef<HTMLDivElement>(null)
  const elA = useRef<HTMLDivElement>(null)
  const elB = useRef<HTMLDivElement>(null)
  const planche = useRef<HTMLDivElement>(null)
  const objet = useRef<HTMLImageElement>(null)
  const jauge = useRef<HTMLDivElement>(null)
  const repere = useRef<HTMLDivElement>(null)
  const chrono = useRef<HTMLSpanElement>(null)
  const bulleA = useRef<HTMLDivElement>(null)
  const bulleB = useRef<HTMLDivElement>(null)
  const reve = useRef<HTMLDivElement>(null)
  const animaux = useRef<Record<number, HTMLDivElement | null>>({})

  const ech = dims ? dims.w / VUE : 1
  const base = dims ? Math.round(Math.max(92, Math.min(170, (dims.h / ech) * 0.22))) : 120

  useEffect(() => {
    const el = scene.current
    if (!el) return
    const mesure = () => setDims({ w: el.clientWidth, h: el.clientHeight })
    mesure()
    const ro = new ResizeObserver(mesure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    precharger('etoiles', 'chat', 'chien', 'lapin', 'jouet')
  }, [])

  /** (Re)partir : tout remettre à zéro et compter 3, 2, 1. */
  const lancer = (i: number) => {
    g.current = seance.current ? seance.current.g : nouvellePartie()
    rb.current = nouveauRobot()
    appui.current = { a: false, b: false }
    marche.current = { a: 0, b: 0 }
    vus.current = {}
    setBilan(null)
    setIdx(i)
    setCompte(3)
    setPhase('decompte')
  }

  // le décompte
  useEffect(() => {
    if (phase !== 'decompte') return
    if (compte === 0) {
      const t = window.setTimeout(() => setPhase('jeu'), 450)
      return () => window.clearTimeout(t)
    }
    tap()
    const t = window.setTimeout(() => setCompte((c) => c - 1), 750)
    return () => window.clearTimeout(t)
  }, [phase, compte])

  // ───── chacun sur son téléphone : le canal ─────
  const etape = (): Etape => (ph.current === 'chute' ? 'fin' : ph.current)
  const suivre = (x: Suite) => {
    if (x.lancer !== undefined) lancer(x.lancer)
    if (x.parti && ph.current !== 'fin' && ph.current !== 'chute') setPhase('parti')
  }
  useEffect(() => {
    if (!direct) return
    let r: LiveRoom | null = null
    // en démo, le proche est fictif : il « arrive », puis c'est un robot qui porte son côté
    const s = fictif ? null : new Seance(me.id, hote, depart, (m) => r?.send(m))
    r = api.joinLive(family.id, session, me.id, (e: LiveEvent) => {
      if (!s) return void (e.t === 'hello' && ph.current === 'attente' && lancer(depart))
      if (e.t === 'hello' || e.t === 'bye' || e.t === 'p-go' || e.t === 'p-x' || e.t === 'p-fin' || e.t === 'p-ping' || e.t === 'p-pong') suivre(s.recoit(e, etape(), performance.now()))
    })
    seance.current = s
    s?.arrive()
    // personne ne répond : on le dit
    const t = window.setTimeout(() => ph.current === 'attente' && setSansReponse(true), 40000)
    return () => {
      window.clearTimeout(t)
      s?.part()
      r?.leave()
      seance.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** La partie est finie : les étoiles du niveau, le record, et les étoiles pour la maison. */
  const finir = () => {
    const p = g.current
    const gagne = p.fin === 'gagne'
    const i = NIVEAUX.indexOf(niv.current)
    const e = gagne ? etoiles(niv.current, p.t, p.pic) : 0
    if (gagne) {
      success()
      jouer('etoiles', 0.7)
      onRecords?.(noterRecord(me.id, i, e, p.t))
      // sur le compte : le record, et une étoile pour la maison par étoile gagnée pour la première fois
      // (si ça ne passe pas — pas de réseau, niveau pas encore ouvert sur le compte — ce sera envoyé plus tard)
      api
        .porteFini(family.id, i, e, p.t)
        .then(({ gain }) => {
          if (!gain) return
          setBilan((b) => b && { ...b, gain })
          void reload().catch(() => undefined)
        })
        .catch(() => undefined)
    } else warn()
    setBilan({ gagne, e, temps: p.t, mot: motDeFin(p, niv.current), gain: 0 })
    setPhase('fin')
  }

  // ───── la boucle : faire avancer, puis dessiner ─────
  useEffect(() => {
    if (!dims) return
    let raf = 0
    let avant = performance.now()
    const boucle = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0, (ts - avant) / 1000))
      avant = ts
      const nv = niv.current
      if (seance.current) {
        // chacun sur son téléphone : la séance fait avancer mon côté, et donne de mes nouvelles
        g.current = seance.current.g
        suivre(seance.current.tour(nv, appui.current[monCote], etape(), ts, dt))
      }
      const p = g.current
      if (!seance.current && ph.current === 'jeu' && !p.fin) {
        if (mode.k === 'ensemble') pas(nv, p, appui.current.a, appui.current.b, dt)
        else pas(nv, p, appui.current.a, robot(nv, p, 'b', rb.current, mode.k === 'panda'), dt)
      }
      if (ph.current === 'jeu' && p.fin) {
        if (p.fin === 'tombe') {
          chute.current = { t: 0, x: 0, y: 0, r: 0 }
          ph.current = 'chute'
          setPhase('chute')
          jouer('jouet', 0.6)
        } else {
          ph.current = 'fin'
          finir()
        }
      }
      if (ph.current === 'chute') {
        const c = chute.current
        c.t += dt
        if (c.t > 1.05) {
          ph.current = 'fin'
          finir()
        }
      }
      dessiner(dt)
      raf = requestAnimationFrame(boucle)
    }
    const dessiner = (dt: number) => {
      const p = g.current
      const nv = niv.current
      const sa = sol(nv, p.a.x).h
      const sb = sol(nv, p.b.x).h
      const cam = Math.max(-140, Math.min(nv.long + LONG + 330 - VUE, (p.a.x + p.b.x) / 2 - VUE / 2 + 46))
      if (monde.current) monde.current.style.transform = `translate3d(${(-cam * ech).toFixed(2)}px,0,0) scale(${ech})`
      if (ciel.current) ciel.current.style.transform = `translate3d(${(-cam * ech * 0.18).toFixed(2)}px,0,0)`
      if (loinDecor.current) loinDecor.current.style.transform = `translate3d(${(-(cam + 140) * ech * 0.3).toFixed(2)}px,0,0)`
      // les porteurs : ils se dandinent en marchant
      const mr = marche.current
      mr.a += p.a.v * dt * 0.12
      mr.b += p.b.v * dt * 0.12
      const pose = (el: HTMLDivElement | null, x: number, h: number, l: number, cadence: number, v: number) => {
        if (!el) return
        const bob = v > 4 ? Math.abs(Math.sin(cadence)) * 2.6 : 0
        el.style.transform = `translate3d(${(x - l / 2).toFixed(2)}px,${(-(base + h - 5 + bob)).toFixed(2)}px,0) rotate(${(v > 4 ? Math.sin(cadence) * 1.8 : 0).toFixed(2)}deg)`
      }
      pose(elA.current, p.a.x, sa, tA.l, mr.a, p.a.v)
      pose(elB.current, p.b.x, sb, tB.l, mr.b, p.b.v)
      // la planche, d'une paire de mains à l'autre
      const x1 = p.a.x - 18, y1 = base + sa - 5 + tA.mains
      const x2 = p.b.x + 18, y2 = base + sb - 5 + tB.mains
      const long = Math.hypot(x2 - x1, y2 - y1)
      const angle = Math.atan2(y2 - y1, x2 - x1)
      if (planche.current) {
        planche.current.style.width = `${long.toFixed(1)}px`
        planche.current.style.transform = `translate3d(${x1.toFixed(2)}px,${(-y1 + 5).toFixed(2)}px,0) rotate(${(-angle).toFixed(4)}rad)`
        const tension = Math.min(1, Math.max(0, (Math.abs(ecart(p)) - E_OK) / (E_MAX - E_OK)))
        planche.current.style.filter = tension > 0 ? `saturate(${1 + tension}) hue-rotate(${(-22 * tension).toFixed(0)}deg)` : ''
      }
      // l'objet : il glisse vers celui qui traîne, et tangue quand l'équilibre se perd
      if (objet.current) {
        const e = ecart(p)
        const u = 0.5 - Math.max(-0.3, Math.min(0.3, (e / E_MAX) * 0.3))
        let ox = x1 + (x2 - x1) * u
        let oy = y1 + (y2 - y1) * u + 5
        let rot = (-angle * 180) / Math.PI + Math.sin(p.t * 9) * Math.min(1, p.w) * 15
        if (ph.current === 'chute' || (ph.current === 'fin' && p.fin === 'tombe')) {
          // il bascule et tombe par terre
          const c = chute.current
          const sens = p.cause === 'devant' ? -1 : 1
          const t = Math.min(c.t, 0.75)
          ox += sens * t * 46
          const solIci = base + sol(nv, ox).h - 4
          oy = Math.max(solIci, oy + 60 * t - 520 * t * t)
          rot += sens * Math.min(1, t / 0.6) * 96
        } else if (p.fin === 'gagne') rot = (-angle * 180) / Math.PI
        objet.current.style.transform = `translate3d(${(ox - nv.taille / 2).toFixed(2)}px,${(-oy).toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg)`
      }
      // l'équilibre, le chemin parcouru, le temps
      if (jauge.current) {
        const w = Math.min(1, p.w)
        jauge.current.style.transform = `scaleX(${w.toFixed(3)})`
        jauge.current.style.background = w < 0.4 ? '#3CB179' : w < 0.7 ? '#F5A524' : '#E5484D'
      }
      if (repere.current) repere.current.style.left = `${(Math.max(0, Math.min(1, p.a.x / nv.long)) * 100).toFixed(2)}%`
      if (chrono.current) {
        const txt = fmt(p.t)
        if (chrono.current.textContent !== txt) chrono.current.textContent = txt
      }
      // « Attends-moi ! » au-dessus de celui qui va trop vite
      const e = ecart(p)
      const dit = (el: HTMLDivElement | null, on: boolean) => {
        if (el && el.dataset.on !== (on ? '1' : '0')) el.dataset.on = on ? '1' : '0'
      }
      const joue = ph.current === 'jeu'
      dit(bulleB.current, joue && e > E_OK)
      dit(bulleA.current, joue && e < -E_OK)
      dit(reve.current, joue && mode.k === 'panda' && p.t < rb.current.distrait)
      // les animaux : ils arrivent, s'assoient, repartent
      nv.zones.forEach((z, i) => {
        if (z.k !== 'animal') return
        const el = animaux.current[i]
        if (!el) return
        const { la, vient } = animalLa(z, p.t)
        const etat = ph.current === 'decompte' || ph.current === 'attente' ? 'non' : la ? 'la' : vient ? 'vient' : 'non'
        if (vus.current[i] !== etat) {
          vus.current[i] = etat
          el.dataset.etat = etat
          // son cri quand il s'assoit, si on est tout près
          if (etat === 'la' && joue && Math.abs(z.x - p.b.x) < 260) jouer(CRIS[z.qui], 0.35)
        }
      })
    }
    raf = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, ech, base, tA, tB])

  // ───── les commandes : on appuie pour avancer, on lâche pour s'arrêter ─────
  const [enfonce, setEnfonce] = useState({ a: false, b: false })
  const presser = (c: 'a' | 'b', on: boolean) => {
    if (appui.current[c] === on) return
    appui.current[c] = on
    setEnfonce({ ...appui.current })
  }
  useEffect(() => {
    // au clavier (sur ordinateur) : A ou ← pour la gauche, L ou → pour la droite, espace pour son côté
    const cote = (k: string): 'a' | 'b' | null => {
      const t = k.toLowerCase()
      if (t === ' ') return mode.k === 'ensemble' ? 'a' : monCote
      if (mode.k !== 'ensemble') return ['a', 'q', 'l', 'arrowleft', 'arrowright'].includes(t) ? monCote : null
      return t === 'a' || t === 'q' || t === 'arrowleft' ? 'a' : t === 'l' || t === 'p' || t === 'arrowright' ? 'b' : null
    }
    const bas = (e: KeyboardEvent) => {
      const c = cote(e.key)
      if (!c) return
      e.preventDefault()
      presser(c, true)
    }
    const haut = (e: KeyboardEvent) => {
      const c = cote(e.key)
      if (c) presser(c, false)
    }
    const lache = () => {
      presser('a', false)
      presser('b', false)
    }
    window.addEventListener('keydown', bas)
    window.addEventListener('keyup', haut)
    window.addEventListener('blur', lache)
    return () => {
      window.removeEventListener('keydown', bas)
      window.removeEventListener('keyup', haut)
      window.removeEventListener('blur', lache)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.k, monCote])

  const touche = (c: 'a' | 'b', qui: Member | null, teinte: [string, string], seul: boolean) => (
    <button
      type="button"
      data-appui={enfonce[c] ? '1' : '0'}
      aria-label={`${qui ? qui.display_name : 'Avancer'} : appuyer pour avancer, lâcher pour s’arrêter`}
      aria-pressed={enfonce[c]}
      onPointerDown={(e) => {
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* pas grave */
        }
        presser(c, true)
      }}
      onPointerUp={() => presser(c, false)}
      onPointerCancel={() => presser(c, false)}
      onLostPointerCapture={() => presser(c, false)}
      onContextMenu={(e) => e.preventDefault()}
      className="porte-touche flex h-[104px] min-w-0 flex-1 select-none items-center justify-center gap-3 rounded-[30px] px-4 text-left shadow-[0_10px_24px_-10px_rgba(29,26,43,0.45)]"
      style={{ background: `linear-gradient(160deg, ${teinte[0]}, ${teinte[1]})`, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as CSSProperties}
    >
      {qui && <Avatar m={qui} size={seul ? 56 : 48} ring />}
      <span className="min-w-0">
        <span className="block truncate font-rond text-titre3 text-white drop-shadow-sm">{seul ? 'Appuie pour avancer' : (qui?.display_name ?? 'Avancer')}</span>
        <span className="block text-legende font-semibold text-white/85">{seul ? 'Lâche pour t’arrêter' : c === 'a' ? 'porte derrière' : 'porte devant'}</span>
      </span>
    </button>
  )

  const nomAutre = autre?.display_name ?? 'le panda'
  const suivant = idx + 1 < NIVEAUX.length ? idx + 1 : null
  const rejouer = (i: number) => {
    if (seance.current) suivre(seance.current.relancer(i))
    else lancer(i)
  }

  return (
    <div className="absolute inset-0 z-40 flex select-none flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label={`À deux, on porte ! ${n.nom}`} style={{ background: `linear-gradient(to bottom, ${n.ciel[0]}, ${n.ciel[1]})`, touchAction: 'none' }}>
      <style>{STYLE}</style>
      {/* en haut : quitter, le niveau, le temps ; l'équilibre ; le chemin parcouru */}
      <div className="relative z-10 px-4" style={{ paddingTop: 'calc(var(--sat) + 10px)' }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { tap(); onClose() }} aria-label="Quitter la partie" className="presse grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/80 text-encre shadow-carte">
            <X size={20} strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-rond text-titre3 leading-tight">{n.nom}</p>
            <p className="truncate text-legende text-brume">{mode.k === 'panda' ? 'Avec le panda roux' : `Avec ${nomAutre}`} · niveau {idx + 1}</p>
          </div>
          <span ref={chrono} className="rounded-full bg-white/80 px-3 py-1.5 font-rond text-sous tabular-nums shadow-carte" aria-label="Temps">0:00</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="w-[70px] shrink-0 text-legende font-semibold text-brume">Équilibre</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/70 shadow-[inset_0_0_0_0.5px_rgba(29,26,43,0.08)]" role="meter" aria-label="Équilibre perdu">
            <div ref={jauge} className="h-full w-full origin-left rounded-full" style={{ transform: 'scaleX(0)', background: '#3CB179' }} />
          </div>
        </div>
        <div className="relative mt-3 h-6">
          <div className="absolute inset-x-3 top-[11px] h-[3px] rounded-full bg-white/80" />
          <img src="./art/maison-maison.webp" alt="" className="absolute -right-0.5 -top-1 h-7 w-7 object-contain" />
          <div className="absolute inset-x-3 top-0 h-6">
            <div ref={repere} className="absolute top-0 -ml-3 h-6 w-6" style={{ left: '0%' }}>
              <img src={`./art/${n.objet}.webp`} alt="" className="h-6 w-6 object-contain drop-shadow" />
            </div>
          </div>
        </div>
      </div>

      {/* la scène */}
      <div ref={scene} className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={ciel} className="pointer-events-none absolute inset-y-0 left-0 w-[300%] will-change-transform" aria-hidden>
          {[6, 30, 58, 84].map((x, i) => (
            <img key={x} src="./art/stickers/nuage.webp" alt="" className="absolute opacity-80" style={{ left: `${x / 3}%`, top: `${[16, 5, 22, 9][i]}%`, width: [62, 84, 54, 72][i] }} />
          ))}
        </div>
        {dims && (
          <div ref={loinDecor} className="pointer-events-none absolute left-0 w-[260%] will-change-transform" style={{ bottom: base * ech - 6, height: 150 }} aria-hidden>
            <svg viewBox="0 0 1300 150" preserveAspectRatio="none" className="h-full w-full">
              {[[90, 190, 96], [330, 150, 70], [560, 220, 118], [830, 170, 82], [1060, 210, 104], [1260, 140, 66]].map(([cx, rx, ry]) => (
                <ellipse key={cx} cx={cx} cy={150} rx={rx} ry={ry} fill={n.herbe} opacity={0.42} />
              ))}
            </svg>
          </div>
        )}
        <img src="./art/stickers/soleil.webp" alt="" className="pointer-events-none absolute right-5 top-2 w-[52px] opacity-90" />
        {dims && (
          <div key={idx} ref={monde} className="absolute bottom-0 left-0 h-0 w-0 will-change-transform" style={{ transformOrigin: '0 100%' }}>
            <Decor n={n} base={base} />
            <Sol n={n} base={base} />
            {/* les animaux qui viennent s'asseoir sur le chemin */}
            {n.zones.map((z: Zone, i) =>
              z.k === 'animal' ? (
                <div key={i} ref={(el) => { animaux.current[i] = el }} data-etat="non" className="porte-animal absolute" style={{ left: z.x - 25, bottom: base + sol(n, z.x).h - 6, width: 50 }}>
                  <span className="absolute -top-6 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-white font-rond text-sous text-[#E5484D] shadow-carte">!</span>
                  <img src={`./art/pet-${z.qui}.webp`} alt="" draggable={false} className="block w-full" />
                </div>
              ) : null,
            )}
            {/* derrière : le porteur de gauche ; devant : celui de droite */}
            <div ref={elA} className="absolute bottom-0 left-0 will-change-transform" style={{ width: tA.l, transformOrigin: '50% 100%' }}>
              <div ref={bulleA} data-on="0" className="porte-alerte absolute -top-7 left-1/2 w-max -translate-x-1/2 rounded-full bg-white px-2.5 py-1 text-legende font-semibold text-[#E5484D] shadow-carte">Doucement !</div>
              <div className={bilan?.gagne ? 'porte-joie' : ''}>{tA.look && <Character look={tA.look} still className="block w-full" />}</div>
            </div>
            <div ref={elB} className="absolute bottom-0 left-0 will-change-transform" style={{ width: tB.l, transformOrigin: '50% 100%' }}>
              <div ref={bulleB} data-on="0" className="porte-alerte absolute -top-7 left-1/2 w-max -translate-x-1/2 rounded-full bg-white px-2.5 py-1 text-legende font-semibold text-[#E5484D] shadow-carte">Attends-moi !</div>
              <div ref={reve} data-on="0" className="porte-alerte absolute -top-12 left-1/2 flex w-max -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-legende font-semibold text-teinte-fonce shadow-carte">
                <img src="./art/stickers/papillon.webp" alt="" className="h-5 w-5" /> Oh, un papillon…
              </div>
              <div className={bilan?.gagne ? 'porte-joie' : ''} style={{ animationDelay: '0.12s' }}>
                {tB.look ? <Character look={tB.look} still className="block w-full" /> : <img src="./art/porte-panda.webp" alt="" draggable={false} className="block w-full" />}
              </div>
            </div>
            <div
              ref={planche}
              className="absolute bottom-0 left-0 h-[10px] rounded-full will-change-transform"
              style={{ transformOrigin: '0 50%', background: 'linear-gradient(to bottom, #E2B983, #C99862)', boxShadow: 'inset 0 0 0 1px rgba(120,78,40,0.35), 0 3px 5px -2px rgba(29,26,43,0.35)' }}
            >
              <span className="absolute inset-x-2 top-1/2 block -translate-y-1/2 border-t border-dashed border-white/80" />
            </div>
            <img ref={objet} src={`./art/${n.objet}.webp`} alt="" draggable={false} className="absolute bottom-0 left-0 max-w-none select-none will-change-transform" style={{ width: n.taille, transformOrigin: '50% 100%' }} />
          </div>
        )}

        {phase === 'decompte' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span key={compte} className="porte-compte font-rond text-[92px] leading-none text-white" style={{ textShadow: '0 6px 22px rgba(29,26,43,0.35)' }}>
              {compte || 'Partez !'}
            </span>
          </div>
        )}
        {bilan?.gagne && <Confettis />}
      </div>

      {/* en bas : un bouton par porteur */}
      <div className="relative z-10 flex gap-3 px-4 pt-2" style={{ paddingBottom: 'calc(var(--sab) + 14px)' }}>
        {mode.k === 'ensemble' ? (
          <>
            {touche('a', gauche, ['#A98CF0', '#7C5CE0'], false)}
            {touche('b', droite, ['#FFB088', '#F0845C'], false)}
          </>
        ) : (
          touche(monCote, me, monCote === 'a' ? ['#A98CF0', '#7C5CE0'] : ['#FFB088', '#F0845C'], true)
        )}
      </div>

      {/* on attend l'autre */}
      {phase === 'attente' && autre && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-6 backdrop-blur-sm">
          <div className="anim-pop w-full max-w-[340px] rounded-[32px] bg-fond px-5 pb-5 pt-6 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]">
            <span className="anim-bat mx-auto flex w-fit"><Avatar m={autre} size={76} /></span>
            <p className="mt-4 font-rond text-titre2">{sansReponse ? `${autre.display_name} ne répond pas` : hote ? `On attend ${autre.display_name}…` : `${autre.display_name} prépare la partie…`}</p>
            <p className="mt-1 text-sous text-brume">{sansReponse ? 'Vous pourrez réessayer plus tard, quand vous serez là en même temps.' : hote ? 'L’invitation s’affiche dans NIDOO sur son téléphone. La partie démarre dès qu’il ou elle arrive.' : 'Tu porteras devant, à droite. Ça commence dans un instant.'}</p>
            <Btn kind="gris" className="mt-5" onClick={onClose}>{sansReponse ? 'Fermer' : 'Annuler'}</Btn>
          </div>
        </div>
      )}
      {phase === 'parti' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-6 backdrop-blur-sm">
          <div className="anim-pop w-full max-w-[340px] rounded-[32px] bg-fond px-5 pb-5 pt-6 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]">
            <p className="font-rond text-titre2">{nomAutre} est parti</p>
            <p className="mt-1 text-sous text-brume">La planche est trop lourde pour une seule personne. On réessaie plus tard ?</p>
            <Btn className="mt-5" onClick={onClose}>Fermer</Btn>
          </div>
        </div>
      )}

      {/* la fin : les étoiles, et la suite */}
      {phase === 'fin' && bilan && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/25 px-4" style={{ paddingBottom: 'calc(var(--sab) + 14px)' }}>
          <div className="anim-monte w-full max-w-[420px] rounded-[32px] bg-fond px-5 pb-5 pt-5 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]" role="status">
            <p className="font-rond text-titre1">{bilan.gagne ? 'Livré !' : 'Patatras…'}</p>
            <p className="mt-1 text-sous text-brume">{bilan.mot}</p>
            {bilan.gagne && (
              <>
                <div className="mt-3 flex items-center justify-center gap-2" aria-label={`${bilan.e} étoile${bilan.e > 1 ? 's' : ''} sur 3`}>
                  {[1, 2, 3].map((i) => (
                    <Star key={i} size={40} strokeWidth={1.6} className="anim-pop" style={{ animationDelay: `${i * 0.16}s` }} fill={i <= bilan.e ? '#F5B83D' : 'transparent'} color={i <= bilan.e ? '#E09A1A' : '#C9C4D6'} />
                  ))}
                </div>
                {bilan.gain > 0 && (
                  <p className="anim-pop mx-auto mt-2.5 flex w-fit items-center gap-1.5 rounded-full bg-[#FFF3D6] px-3 py-1 text-sous font-semibold text-[#8A5A00]">
                    <img src="./art/picto-etoile.webp" alt="" className="h-5 w-5" /> +{bilan.gain} étoile{bilan.gain > 1 ? 's' : ''} pour la maison
                  </p>
                )}
                <p className="mt-2 text-note text-brume">
                  {fmt(bilan.temps)} · {bilan.e === 3 ? 'parfait' : bilan.e === 2 ? `moins de ${fmt(n.par)} pour la troisième étoile` : 'sans grosse frayeur pour la deuxième étoile'}
                </p>
              </>
            )}
            {direct && !hote && !fictif ? (
              <p className="mt-4 text-sous text-brume">{nomAutre} choisit la suite…</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {bilan.gagne && suivant !== null && <Btn onClick={() => rejouer(suivant)}>Niveau suivant : {NIVEAUX[suivant].nom.toLowerCase()}</Btn>}
                <Btn kind={bilan.gagne && suivant !== null ? 'teinte' : 'plein'} onClick={() => rejouer(idx)}>
                  <RotateCcw size={18} strokeWidth={2.4} /> {bilan.gagne ? 'Rejouer ce niveau' : 'Réessayer'}
                </Btn>
              </div>
            )}
            <Btn kind="gris" className="mt-2" onClick={onClose}>Quitter</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────── Le choix : avec qui, où, quel niveau ─────────

export function PortePage({ onClose }: { onClose: () => void }) {
  const { state, api, reload, toast } = useHome()
  const { me, members, family } = state
  const autres = members.filter((m) => m.id !== me.id)
  const [avec, setAvec] = useState<string>('panda')
  const [ou, setOu] = useState<'ici' | 'direct'>('ici')
  const [records, setRecords] = useState<Records>(() => lireRecords(me.id))
  // Les records du compte : on prend le meilleur des deux, et ce que l'appareil a de mieux part sur le compte
  // (les livraisons faites avant, ou sans réseau, comptent alors pour la maison).
  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        let compte = await api.porteRecords(family.id, me.id)
        const ici = lireRecords(me.id)
        let gain = 0
        for (let i = 0; i < NIVEAUX.length; i++) {
          if (!ici[i] || !mieux(ici[i], compte[i])) continue
          try {
            gain += (await api.porteFini(family.id, i, ici[i].e, Math.max(5, ici[i].t))).gain
          } catch {
            break
          }
        }
        if (gain) {
          compte = await api.porteRecords(family.id, me.id)
          toast(`+${gain} étoile${gain > 1 ? 's' : ''} pour la maison : vos livraisons comptent.`)
          void reload().catch(() => undefined)
        }
        const tout = fusion(ici, compte)
        ecrireRecords(me.id, tout)
        if (vivant) setRecords(tout)
      } catch {
        /* pas de réseau : on garde la copie de l'appareil */
      }
    })()
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [partie, setPartie] = useState<{ mode: ModePorte; niveau: number } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const proche = autres.find((m) => m.id === avec) ?? null

  const jouerNiveau = async (i: number) => {
    if (occupe) return
    tap()
    setErreur(null)
    if (!proche) return setPartie({ mode: { k: 'panda' }, niveau: i })
    if (ou === 'ici') return setPartie({ mode: { k: 'ensemble', avec: proche }, niveau: i })
    setOccupe(true)
    try {
      const session = await api.inviteLive(family.id, me.id, proche.id, 'porte')
      setPartie({ mode: { k: 'direct', avec: proche, session, hote: true }, niveau: i })
    } catch {
      setErreur(`Impossible de prévenir ${proche.display_name}. Vérifie ta connexion et réessaie.`)
    } finally {
      setOccupe(false)
    }
  }

  const choix = (id: string, label: string, image: ReactNode) => (
    <button
      key={id}
      type="button"
      aria-pressed={avec === id}
      onClick={() => {
        tap()
        setAvec(id)
      }}
      className={`presse flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-[20px] px-1 pb-2 pt-2.5 ${avec === id ? 'bg-white shadow-carte ring-2 ring-teinte' : ''}`}
    >
      {image}
      <span className="w-full truncate text-center text-legende font-semibold">{label}</span>
    </button>
  )

  return (
    <>
      <Page title="À deux, on porte !" onClose={onClose}>
        <div className="mx-4 flex items-center gap-3 overflow-hidden rounded-[24px] px-4 py-3.5 shadow-carte" style={{ background: 'linear-gradient(160deg, #EFE9FF 0%, #FFF1E6 100%)' }}>
          <img src="./art/jeu-porte.webp" alt="" className="h-[84px] w-[84px] shrink-0 object-contain" />
          <p className="text-sous">
            Vous portez ensemble quelque chose de fragile jusqu’à la maison. <b>Appuie pour avancer, lâche pour t’arrêter.</b> Si l’un va plus vite que l’autre, ça tombe : il faut marcher ensemble.
          </p>
        </div>

        <p className="entete mt-6">Avec qui ?</p>
        <div className="mx-4 flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {choix('panda', 'Le panda', <img src="./art/stickers/panda-heureux.webp" alt="" className="h-[52px] w-[52px] rounded-full bg-[#FFEDE2]" />)}
          {autres.map((m) => choix(m.id, m.display_name, <Avatar m={m} size={52} />))}
        </div>

        {proche ? (
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
            {(
              [
                ['ici', 'Même téléphone', 'Un pouce chacun', UsersRound],
                ['direct', 'Chacun le sien', 'En direct, à distance', Smartphone],
              ] as const
            ).map(([k, titre, sous, Icone]) => (
              <button
                key={k}
                type="button"
                aria-pressed={ou === k}
                onClick={() => {
                  tap()
                  setOu(k)
                }}
                className={`presse groupe flex items-center gap-2.5 px-3 py-3 text-left shadow-carte ${ou === k ? 'ring-2 ring-teinte' : ''}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${ou === k ? 'bg-teinte text-white' : 'bg-remplissage text-brume'}`}><Icone size={18} strokeWidth={2.3} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sous font-semibold">{titre}</span>
                  <span className="block truncate text-mini text-brume">{sous}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mx-5 mt-3 text-note text-brume">Le panda porte devant, toi derrière. Suis-le bien : il lui arrive de s’arrêter pour regarder un papillon.</p>
        )}
        {proche && (
          <p className="mx-5 mt-2.5 text-note text-brume">
            {ou === 'ici' ? `Tenez le téléphone à deux : toi à gauche, ${proche.display_name} à droite.` : `${proche.display_name} reçoit une invitation et joue sur son téléphone, en même temps que toi.`}
          </p>
        )}
        {erreur && <p role="alert" className="mx-5 mt-2 text-note font-semibold text-[#C2362F]">{erreur}</p>}

        <p className="entete mt-6">Que porte-t-on ?</p>
        <p className="mx-5 -mt-1 mb-2.5 text-note text-brume">Chaque étoile gagnée pour la première fois rapporte une étoile à la maison.</p>
        <div className="mx-4 grid grid-cols-2 gap-2.5 pb-6">
          {NIVEAUX.map((n, i) => {
            const ouvert = i === 0 || !!records[i - 1]
            const r = records[i]
            return (
              <button
                key={n.nom}
                type="button"
                disabled={!ouvert || occupe}
                onClick={() => void jouerNiveau(i)}
                aria-label={ouvert ? `Niveau ${i + 1} : ${n.nom}${r ? `, ${r.e} étoile${r.e > 1 ? 's' : ''} sur 3` : ''}` : `Niveau ${i + 1} : à débloquer en finissant le précédent`}
                className={`presse groupe relative flex items-center gap-3 px-3 py-3 text-left shadow-carte ${ouvert ? '' : 'opacity-60'}`}
              >
                <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[16px]" style={{ background: `linear-gradient(to bottom, ${n.ciel[0]}, ${n.ciel[1]})` }}>
                  {ouvert ? <img src={`./art/${n.objet}.webp`} alt="" className="h-11 w-11 object-contain" /> : <Lock size={20} className="text-brume" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-mini font-semibold uppercase tracking-wide text-brume">Niveau {i + 1}</span>
                  <span className="line-clamp-2 block text-sous font-semibold leading-tight">{n.nom}</span>
                  <span className="mt-0.5 flex gap-0.5" aria-hidden>
                    {[1, 2, 3].map((k) => (
                      <Star key={k} size={14} strokeWidth={1.8} fill={r && k <= r.e ? '#F5B83D' : 'transparent'} color={r && k <= r.e ? '#E09A1A' : '#C9C4D6'} />
                    ))}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </Page>
      {partie && <PorteJeu key={`${partie.mode.k}-${partie.niveau}-${'session' in partie.mode ? partie.mode.session : ''}`} mode={partie.mode} niveau={partie.niveau} onClose={() => setPartie(null)} onRecords={setRecords} />}
    </>
  )
}

/** La tuile du jeu, dans « Jouer ensemble ». */
export function PorteTuile({ onOpen }: { onOpen: () => void }) {
  return <GameTile kind="porte" art="jeu-porte" name="On porte !" hint="Marcher ensemble" onClick={() => (tap(), onOpen())} />
}

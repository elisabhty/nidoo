import { RotateCcw, RotateCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { select, tap } from '../lib/haptic'
import { PANDA, type PieceTour, type TourState } from '../lib/parties'
import { jouer } from '../lib/sons'
import { BORD, contour, coupDuPanda, FORMES, hauteurDeDepart, LIGNE_CHUTE, Monde, SOCLE, type Piece } from '../lib/tour'
import type { Member, Partie } from '../lib/types'

// La tour : on glisse la forme reçue, on la tourne, on la lâche. La physique tourne ici, dans le téléphone de
// celui qui joue ; une fois tout calmé (ou tombé), la tour posée part à la base.

type Props = { p: Partie; me: string; members?: Member[]; busy: boolean; act: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null> }

const LARGEUR_VUE = 320 // ce qu'on voit de large, en unités du monde
const PAS_ANGLE = Math.PI / 4
const nomDe = (members: Member[], id: string | undefined, me: string) => (id === PANDA ? 'Le panda' : id === me ? 'Toi' : (members.find((m) => m.id === id)?.display_name ?? 'Un proche'))
/** « de Mamie », « de toi », « du panda » */
const deQui = (members: Member[], id: string | undefined, me: string) => (id === PANDA ? 'du panda' : id === me ? 'de toi' : `de ${nomDe(members, id, me)}`)

type Trace = { k: number; pts: { x: number; y: number }[]; dort?: boolean }

/** Une pièce en feutrine : sa couleur, un bord plus foncé et une couture en pointillés. */
function dessinerPiece(ctx: CanvasRenderingContext2D, t: Trace, s: number, ox: number, oy: number, opts: { fantome?: boolean; lueur?: boolean } = {}) {
  const f = FORMES[t.k] ?? FORMES[0]
  const pts = t.pts.map((v) => ({ x: ox + v.x * s, y: oy + v.y * s }))
  const cx = pts.reduce((a, v) => a + v.x, 0) / pts.length
  const cy = pts.reduce((a, v) => a + v.y, 0) / pts.length
  const chemin = (k = 1) => {
    ctx.beginPath()
    pts.forEach((v, i) => {
      const x = cx + (v.x - cx) * k
      const y = cy + (v.y - cy) * k
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
  }
  ctx.save()
  if (opts.fantome) ctx.globalAlpha = 0.92
  if (opts.lueur) {
    ctx.shadowColor = 'rgba(255, 201, 77, 0.95)'
    ctx.shadowBlur = 16 * s
  } else {
    ctx.shadowColor = 'rgba(60, 40, 120, 0.22)'
    ctx.shadowBlur = 6 * s
    ctx.shadowOffsetY = 3 * s
  }
  chemin()
  const haut = Math.min(...pts.map((v) => v.y))
  const bas = Math.max(...pts.map((v) => v.y))
  const g = ctx.createLinearGradient(0, haut, 0, bas)
  g.addColorStop(0, f.couleur)
  g.addColorStop(1, f.fonce + 'D0')
  ctx.fillStyle = g
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2 * s
  ctx.strokeStyle = f.fonce
  ctx.stroke()
  // la couture
  const r = Math.max(...pts.map((v) => Math.hypot(v.x - cx, v.y - cy)))
  chemin(Math.max(0.5, 1 - (6 * s) / r))
  ctx.setLineDash([3.5 * s, 3 * s])
  ctx.lineWidth = 1.4 * s
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.stroke()
  ctx.restore()
}

export function TourJeu({ p, me, members = [], busy, act }: Props) {
  const s0 = p.state as TourState
  const pieces = useMemo(() => s0.pieces ?? [], [s0.pieces])
  const aMoi = p.status === 'en_cours' && p.turn === me
  const canvas = useRef<HTMLCanvasElement>(null)
  const boite = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(358)
  // assez haut pour voir la tour, assez bas pour garder le bouton « Lâcher » à l'écran
  const hauteur = Math.round(Math.min(520, Math.max(330, Math.min(largeur * 1.35, window.innerHeight - 480))))
  const echelle = useRef(1)
  const sommet = useMemo(() => new Monde(pieces).sommet(), [pieces])
  const depart = hauteurDeDepart(sommet)
  const [x, setX] = useState(0)
  const [angle, setAngle] = useState(0)
  const [phase, setPhase] = useState<'vise' | 'chute' | 'envoi'>('vise')
  const [tombe, setTombe] = useState(false)
  const monde = useRef<Monde | null>(null)
  const glisse = useRef<{ id: number; dx: number } | null>(null)
  const arrivee = useRef<{ i: number; t0: number } | null>(null)
  const enChute = useRef(false)
  // le panda joue par ce téléphone quand c'est son tour (un des joueurs regarde la partie)
  const pourPanda = useRef(false)
  const tourPanda = p.status === 'en_cours' && p.turn === PANDA && p.players.includes(me)
  const chute = useRef<number | null>(null)

  // la largeur réelle de l'écran
  useEffect(() => {
    const el = boite.current
    if (!el) return
    const ro = new ResizeObserver(() => setLargeur(Math.round(el.clientWidth)))
    ro.observe(el)
    setLargeur(Math.round(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  // une nouvelle tour (le coup d'un proche) : on repart du début, et la dernière pièce arrive en tombant
  const cle = `${p.id}:${pieces.length}:${p.status}`
  const vu = useRef<string>('')
  useEffect(() => {
    if (vu.current === cle) return
    const premier = !vu.current
    vu.current = cle
    monde.current = null
    enChute.current = false
    chute.current = null
    const pandaVu = pourPanda.current
    pourPanda.current = false
    arrivee.current = null
    setPhase('vise')
    setTombe(!!s0.tombe)
    setX(0)
    setAngle(0)
    if (pieces.length && s0.dernier && s0.dernier !== me && !(s0.dernier === PANDA && pandaVu) && !s0.tombe) arrivee.current = { i: pieces.length - 1, t0: performance.now() + (premier ? 250 : 0) }
  }, [cle, pieces.length, s0.dernier, s0.tombe, me])

  // ── le dessin ──
  const dessiner = (now: number) => {
    const c = canvas.current
    if (!c) return false
    const ctx = c.getContext('2d')
    if (!ctx) return false
    const dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(largeur * dpr) || c.height !== Math.round(hauteur * dpr)) {
      c.width = Math.round(largeur * dpr)
      c.height = Math.round(hauteur * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Un même repère pour la visée tactile, le socle et les pièces en mouvement.
    const m = monde.current
    let anime = false
    let brillante = -1
    const traces = m?.contours() ?? pieces.map((q, i) => {
      let piece: Piece = q
      const ar = arrivee.current
      if (ar?.i === i) {
        const age = now - ar.t0
        const t = Math.min(1, Math.max(0, age / 520))
        piece = { ...q, y: q.y - 190 * (1 - t * t) }
        if (age < 1900) {
          anime = true
          if (t === 1) brillante = i
        } else arrivee.current = null
      }
      return { k: q.k, pts: contour(piece) }
    })
    const rayon = Math.max(...(FORMES[s0.prochaine] ?? FORMES[0]).pts.map(([px, py]) => Math.hypot(px, py)))
    let demiLargeur = Math.max(LARGEUR_VUE / 2, BORD + rayon)
    let haut = depart - rayon
    let bas = SOCLE.epaisseur + 12
    for (const trace of traces) {
      for (const pt of trace.pts) {
        demiLargeur = Math.max(demiLargeur, Math.abs(pt.x))
        haut = Math.min(haut, pt.y)
        bas = Math.max(bas, pt.y)
      }
    }
    const s = Math.min((largeur - 20) / (2 * demiLargeur), (hauteur - 24) / (bas - haut))
    if (s <= 0) return false
    echelle.current = s
    const ox = largeur / 2
    const oy = hauteur - 12 - bas * s

    // le ciel
    const ciel = ctx.createLinearGradient(0, 0, 0, hauteur)
    ciel.addColorStop(0, '#EAE3FF')
    ciel.addColorStop(1, '#FFF4EA')
    ctx.fillStyle = ciel
    ctx.fillRect(0, 0, largeur, hauteur)
    // des repères de hauteur, tous les 100
    ctx.save()
    ctx.strokeStyle = 'rgba(112, 80, 213, 0.13)'
    ctx.fillStyle = 'rgba(102, 70, 204, 0.45)'
    ctx.font = `700 ${11}px Nunito, system-ui, sans-serif`
    ctx.setLineDash([4, 6])
    ctx.textAlign = 'right'
    for (let h = 100; h < 6000; h += 100) {
      const y = oy - h * s
      if (y < -10 || y > hauteur) continue
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(largeur, y)
      ctx.stroke()
      ctx.fillText(`${h / 10} cm`, largeur - 8, y - 4)
    }
    ctx.restore()

    // le socle, sur son pied
    const sl = SOCLE.largeur * s
    const se = SOCLE.epaisseur * s
    ctx.save()
    ctx.fillStyle = '#B98C63'
    ctx.fillRect(ox - sl * 0.18, oy + se - 2, sl * 0.36, hauteur)
    ctx.shadowColor = 'rgba(60, 40, 120, 0.25)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    ctx.fillStyle = '#D9AE82'
    ctx.beginPath()
    ctx.roundRect(ox - sl / 2, oy, sl, se, 9 * s)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.setLineDash([4 * s, 3.5 * s])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = 1.4 * s
    ctx.beginPath()
    ctx.roundRect(ox - sl / 2 + 5 * s, oy + 5 * s, sl - 10 * s, se - 10 * s, 6 * s)
    ctx.stroke()
    ctx.restore()

    // les pièces
    traces.forEach((trace, i) => dessinerPiece(ctx, trace, s, ox, oy, { lueur: i === brillante }))

    // la pièce à lâcher, et son fil d'aplomb
    if (aMoi && phase === 'vise') {
      const pv: Piece = { k: s0.prochaine, x, y: depart, a: angle }
      const xs = ox + x * s
      ctx.save()
      ctx.setLineDash([3, 5])
      ctx.strokeStyle = 'rgba(102, 70, 204, 0.45)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(xs, oy + depart * s)
      ctx.lineTo(xs, hauteur)
      ctx.stroke()
      ctx.restore()
      dessinerPiece(ctx, { k: pv.k, pts: contour(pv) }, s, ox, oy, { fantome: true })
    }
    return anime
  }

  // on redessine à chaque changement, et tant que quelque chose bouge
  useEffect(() => {
    let raf = 0
    const boucle = (now: number) => {
      const m = monde.current
      if (enChute.current && m) {
        m.pas()
        if (chute.current === null && m.tombees().length > 0) {
          // patatras : on laisse encore tomber un peu, pour voir
          chute.current = m.temps
          setTombe(true)
          jouer('jouet', 0.6)
        }
        const fini = chute.current !== null ? m.temps - chute.current > 1.4 : m.calme()
        if (fini || m.temps > 14) {
          enChute.current = false
          setPhase('envoi')
        }
      }
      const encore = dessiner(now)
      if (enChute.current || encore || glisse.current) raf = requestAnimationFrame(boucle)
    }
    raf = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(raf)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // tout s'est calmé (ou la tour est tombée) : on envoie la tour posée
  useEffect(() => {
    if (phase !== 'envoi' || !monde.current) return
    const m = monde.current
    const tomb = m.tombees().length > 0
    void act({ t: 'pose', k: s0.prochaine, tas: m.etat().map((q) => [q.x, q.y, q.a]), tombe: tomb, ...(pourPanda.current ? { pour: 'panda' } : {}) }).then((r) => {
      if (!r) {
        // pas envoyé (réseau) : on peut réessayer
        monde.current = null
        chute.current = null
        pourPanda.current = false
        setTombe(false)
        setPhase('vise')
      }
    })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // au tour du panda : il réfléchit un instant, puis lâche sa pièce sous nos yeux
  useEffect(() => {
    if (!tourPanda || phase !== 'vise' || pourPanda.current) return
    const t = window.setTimeout(() => {
      if (monde.current) return
      pourPanda.current = true
      const piece = coupDuPanda(pieces, s0.prochaine)
      const m = new Monde(pieces)
      m.ajouter(piece)
      monde.current = m
      chute.current = null
      enChute.current = true
      setPhase('chute')
    }, 1300)
    return () => window.clearTimeout(t)
  }, [tourPanda, phase, cle]) // eslint-disable-line react-hooks/exhaustive-deps

  const lacher = () => {
    if (!aMoi || phase !== 'vise' || busy) return
    tap()
    const m = new Monde(pieces)
    m.ajouter({ k: s0.prochaine, x, y: depart, a: angle })
    monde.current = m
    chute.current = null
    enChute.current = true
    setPhase('chute')
  }
  const tourner = (sens: 1 | -1) => {
    select()
    setAngle((a) => a + sens * PAS_ANGLE)
  }

  // glisser la pièce du doigt, n'importe où sur la scène
  const versMonde = (clientX: number) => {
    const r = canvas.current!.getBoundingClientRect()
    return (clientX - r.left - largeur / 2) / echelle.current
  }
  const borne = (v: number) => Math.max(-BORD, Math.min(BORD, v))

  const forme = FORMES[s0.prochaine] ?? FORMES[0]
  const posees = pieces.filter((q) => q.y < LIGNE_CHUTE).length
  const haut = Math.max(0, Math.round(-sommet / 10))
  const dernier = pieces.length ? (pieces[pieces.length - 1] as PieceTour) : null

  return (
    <div>
      <p className="mb-2 text-center text-note text-brume">
        {posees} {posees > 1 ? 'pièces' : 'pièce'} · {haut} cm de haut
        {dernier && !s0.tombe && ` · dernière : ${FORMES[dernier.k]?.nom ?? 'une forme'} ${deQui(members, dernier.par, me)}`}
      </p>
      {aMoi && (
        <p className="mb-2 px-2 text-center text-sous font-semibold text-teinte-fonce">
          Ta forme : {forme.nom}. Glisse-la du doigt, tourne-la, puis lâche-la.
        </p>
      )}
        {tourPanda && phase !== 'envoi' && !tombe && (
          <div className="anim-pop pointer-events-none  mx-auto mb-2 flex w-fit items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-carte">
            <img src="./art/stickers/panda-motive.webp" alt="" className="h-8 w-8" />
            <span className="text-note font-bold text-encre">{phase === 'vise' ? 'Le panda réfléchit…' : 'Le panda lâche sa pièce !'}</span>
          </div>
        )}
        {tombe && (
          <div className="anim-pop pointer-events-none  text-center">
            <span className="rounded-full bg-white/95 px-5 py-2 font-rond text-titre2 text-[#E5484D] shadow-carte">Patatras !</span>
          </div>
        )}
      <div ref={boite} className="relative overflow-hidden rounded-[24px] shadow-carte" style={{ height: hauteur, touchAction: 'none' }}>
        <canvas
          ref={canvas}
          style={{ width: largeur, height: hauteur, display: 'block' }}
          role="img"
          aria-label={`La tour : ${posees} pièces, ${haut} centimètres de haut.${aMoi && phase === 'vise' ? ` Ta forme : ${forme.nom}.` : ''}`}
          onPointerDown={(e) => {
            if (!aMoi || phase !== 'vise') return
            ;(e.target as Element).setPointerCapture(e.pointerId)
            const wx = versMonde(e.clientX)
            // on attrape la pièce où qu'on touche : elle garde son écart avec le doigt
            glisse.current = { id: e.pointerId, dx: Math.abs(wx - x) < 70 ? x - wx : 0 }
            if (!glisse.current.dx) setX(borne(wx))
          }}
          onPointerMove={(e) => {
            if (!glisse.current || glisse.current.id !== e.pointerId) return
            setX(borne(versMonde(e.clientX) + glisse.current.dx))
          }}
          onPointerUp={() => (glisse.current = null)}
          onPointerCancel={() => (glisse.current = null)}
        />

      </div>
      {aMoi && (
        <div className="mt-3 flex items-center gap-2.5">
          <button aria-label="Tourner vers la gauche" disabled={phase !== 'vise' || busy} onClick={() => tourner(-1)} className="presse flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce btn-desactive">
            <RotateCcw size={22} strokeWidth={2.5} />
          </button>
          <button disabled={phase !== 'vise' || busy} onClick={lacher} className="presse ios-primary flex h-[54px] flex-1 items-center justify-center rounded-full text-corps font-bold text-white btn-desactive">
            {phase === 'vise' ? 'Lâcher' : phase === 'chute' ? 'Ça tombe…' : 'Un instant…'}
          </button>
          <button aria-label="Tourner vers la droite" disabled={phase !== 'vise' || busy} onClick={() => tourner(1)} className="presse flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce btn-desactive">
            <RotateCw size={22} strokeWidth={2.5} />
          </button>
        </div>
      )}
      {!aMoi && p.status === 'en_cours' && <p className="mt-3 text-center text-note text-brume">On te préviendra quand ce sera ton tour.</p>}
      <p className="mt-3 text-center text-note text-brume">Chacun son tour : celui qui fait tomber une pièce a perdu.</p>
    </div>
  )
}

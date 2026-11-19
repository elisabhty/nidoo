// La tour : chacun son tour, on lâche une forme en feutrine sur la tour. Celui qui fait tomber une pièce a perdu.
// Ce fichier contient les formes et un petit moteur physique 2D (polygones convexes, impulsions séquentielles,
// comme Box2D Lite) : il tourne dans le téléphone de celui qui joue, qui envoie ensuite la tour posée à la base.
// Sans import (les tests le chargent tel quel).

/** Repère : x vers la droite, y vers le BAS (comme l'écran). Le dessus du socle est en y = 0, centré en x = 0. */
export const SOCLE = { largeur: 230, epaisseur: 30 }
/** Une pièce dont le centre passe sous cette ligne est tombée du socle. */
export const LIGNE_CHUTE = 90
/** Jusqu'où, de chaque côté, on peut placer la pièce avant de la lâcher. */
export const BORD = 145

type P2 = [number, number]
export type Forme = { nom: string; pts: P2[]; couleur: string; fonce: string }

const rect = (w: number, h: number): P2[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
const regulier = (n: number, r: number, depart = -Math.PI / 2): P2[] =>
  Array.from({ length: n }, (_, i) => [r * Math.cos(depart + (i * 2 * Math.PI) / n), r * Math.sin(depart + (i * 2 * Math.PI) / n)])
const demiLune = (r: number, n = 9): P2[] => [...Array.from({ length: n + 1 }, (_, i) => [r * Math.cos(Math.PI + (i * Math.PI) / n), r * Math.sin(Math.PI + (i * Math.PI) / n)] as P2)]

/** Les formes, dans les couleurs pastel de la feutrine de la maison. */
export const FORMES: Forme[] = [
  { nom: 'un carré', pts: rect(46, 46), couleur: '#B9A6F2', fonce: '#8C74D9' },
  { nom: 'une brique', pts: rect(92, 32), couleur: '#F9B490', fonce: '#E58A5E' },
  { nom: 'une planche', pts: rect(128, 20), couleur: '#F7D27A', fonce: '#D9A93E' },
  { nom: 'un triangle', pts: regulier(3, 34), couleur: '#9FDCC0', fonce: '#5FB893' },
  { nom: 'une maisonnette', pts: [[-25, 26], [25, 26], [25, -4], [0, -28], [-25, -4]], couleur: '#F5A3BD', fonce: '#DB6F92' },
  { nom: 'un trapèze', pts: [[-40, 17], [40, 17], [22, -17], [-22, -17]], couleur: '#9CC8F2', fonce: '#5F9CD9' },
  { nom: 'une demi-lune', pts: demiLune(36), couleur: '#FFC98A', fonce: '#E99C45' },
  { nom: 'un hexagone', pts: regulier(6, 27, 0), couleur: '#A8E0D0', fonce: '#62B9A0' },
  { nom: 'un petit carré', pts: rect(32, 32), couleur: '#F2B8E0', fonce: '#D27BB5' },
]

/** Une pièce posée : sa forme, son centre et son angle. */
export type Piece = { k: number; x: number; y: number; a: number }

// ───────── Le moteur ─────────

type V = { x: number; y: number }
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y
const cross = (a: V, b: V) => a.x * b.y - a.y * b.x

class Corps {
  k: number
  loc: V[] = [] // sommets autour du centre de gravité, dans le sens positif
  nloc: V[] = [] // normales sortantes de chaque côté
  x: number
  y: number
  a: number
  vx = 0
  vy = 0
  w = 0
  im: number
  iI: number
  dort = false
  calme = 0
  rayon = 0
  monde: V[] = []
  normales: V[] = []
  constructor(k: number, pts: P2[], x: number, y: number, a: number, fixe = false) {
    this.k = k
    // aire, centre de gravité et inertie du polygone
    let aire = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[(i + 1) % pts.length]
      const c = x1 * y2 - x2 * y1
      aire += c / 2
      cx += ((x1 + x2) * c) / 6
      cy += ((y1 + y2) * c) / 6
    }
    cx /= aire
    cy /= aire
    let p = pts.map(([px, py]) => ({ x: px - cx, y: py - cy }))
    if (aire < 0) p = p.reverse()
    aire = Math.abs(aire)
    let inertie = 0
    for (let i = 0; i < p.length; i++) {
      const a1 = p[i]
      const a2 = p[(i + 1) % p.length]
      const c = Math.abs(cross(a1, a2))
      inertie += (c * (dot(a1, a1) + dot(a1, a2) + dot(a2, a2))) / 12
    }
    this.loc = p
    this.nloc = p.map((v, i) => {
      const n = p[(i + 1) % p.length]
      const dx = n.x - v.x
      const dy = n.y - v.y
      const l = Math.hypot(dx, dy)
      return { x: dy / l, y: -dx / l }
    })
    this.rayon = Math.max(...p.map((v) => Math.hypot(v.x, v.y)))
    // la position donnée est celle du centre de gravité
    this.x = x
    this.y = y
    this.a = a
    const masse = aire * 0.01
    this.im = fixe ? 0 : 1 / masse
    this.iI = fixe ? 0 : 1 / (inertie * 0.01)
    this.maj()
  }
  get fixe() {
    return this.im === 0 && !this.dort
  }
  maj() {
    const c = Math.cos(this.a)
    const s = Math.sin(this.a)
    this.monde = this.loc.map((v) => ({ x: this.x + c * v.x - s * v.y, y: this.y + s * v.x + c * v.y }))
    this.normales = this.nloc.map((n) => ({ x: c * n.x - s * n.y, y: s * n.x + c * n.y }))
  }
}

type Point = { x: number; y: number; sep: number; id: number; pn: number; pt: number; mn: number; mt: number; biais: number; rax: number; ray: number; rbx: number; rby: number }
type Contact = { a: Corps; b: Corps; nx: number; ny: number; pts: Point[]; mu: number }

const MARGE = 1
const PENETRATION_PERMISE = 0.6
const BIAIS = 0.2

function separationMax(p1: Corps, p2: Corps) {
  let meilleur = -Infinity
  let arete = 0
  for (let i = 0; i < p1.monde.length; i++) {
    const n = p1.normales[i]
    const v = p1.monde[i]
    let min = Infinity
    for (const w of p2.monde) min = Math.min(min, n.x * (w.x - v.x) + n.y * (w.y - v.y))
    if (min > meilleur) {
      meilleur = min
      arete = i
    }
  }
  return { sep: meilleur, arete }
}

type CP = { x: number; y: number; id: number }
function couper(e: CP[], nx: number, ny: number, offset: number, idNouveau: number): CP[] {
  const d0 = nx * e[0].x + ny * e[0].y - offset
  const d1 = nx * e[1].x + ny * e[1].y - offset
  const out: CP[] = []
  if (d0 <= 0) out.push(e[0])
  if (d1 <= 0) out.push(e[1])
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1)
    out.push({ x: e[0].x + t * (e[1].x - e[0].x), y: e[0].y + t * (e[1].y - e[0].y), id: idNouveau })
  }
  return out
}

/** Le contact entre deux polygones (SAT, puis découpe de l'arête d'appui), ou null. */
function collision(A: Corps, B: Corps): { nx: number; ny: number; pts: { x: number; y: number; sep: number; id: number }[] } | null {
  const dx = B.x - A.x
  const dy = B.y - A.y
  const r = A.rayon + B.rayon + MARGE
  if (dx * dx + dy * dy > r * r) return null
  const sa = separationMax(A, B)
  if (sa.sep > MARGE) return null
  const sb = separationMax(B, A)
  if (sb.sep > MARGE) return null
  let ref = A
  let inc = B
  let arete = sa.arete
  let inverse = false
  if (sb.sep > sa.sep + 0.05) {
    ref = B
    inc = A
    arete = sb.arete
    inverse = true
  }
  const n = ref.monde.length
  const v1 = ref.monde[arete]
  const v2 = ref.monde[(arete + 1) % n]
  const tl = Math.hypot(v2.x - v1.x, v2.y - v1.y)
  const tx = (v2.x - v1.x) / tl
  const ty = (v2.y - v1.y) / tl
  const nx = ty
  const ny = -tx
  // l'arête de l'autre la plus opposée
  let ie = 0
  let min = Infinity
  for (let i = 0; i < inc.normales.length; i++) {
    const d = nx * inc.normales[i].x + ny * inc.normales[i].y
    if (d < min) {
      min = d
      ie = i
    }
  }
  const m = inc.monde.length
  const i1 = inc.monde[ie]
  const i2 = inc.monde[(ie + 1) % m]
  const base = (inverse ? 1000 : 0) + arete * 100
  let pts: CP[] = [
    { x: i1.x, y: i1.y, id: base + ie },
    { x: i2.x, y: i2.y, id: base + ((ie + 1) % m) },
  ]
  pts = couper(pts, -tx, -ty, -(tx * v1.x + ty * v1.y), base + 50)
  if (pts.length < 2) return null
  pts = couper(pts, tx, ty, tx * v2.x + ty * v2.y, base + 60)
  if (pts.length < 2) return null
  const front = nx * v1.x + ny * v1.y
  const res: { x: number; y: number; sep: number; id: number }[] = []
  for (const p of pts) {
    const sep = nx * p.x + ny * p.y - front
    if (sep <= MARGE) res.push({ x: p.x, y: p.y, sep, id: p.id })
  }
  if (!res.length) return null
  // la normale va toujours de A vers B
  return inverse ? { nx: -nx, ny: -ny, pts: res } : { nx, ny, pts: res }
}

export class Monde {
  corps: Corps[] = []
  socle: Corps
  gravite = 900
  sousPas = 6
  iterations = 8
  private contacts = new Map<string, Contact>()
  temps = 0
  private calmeDepuis = 0

  /** La tour déjà posée : ses pièces dorment jusqu'à ce qu'on les touche. */
  constructor(pieces: Piece[] = []) {
    const { largeur, epaisseur } = SOCLE
    this.socle = new Corps(-1, rect(largeur, epaisseur), 0, epaisseur / 2, 0, true)
    for (const p of pieces) {
      const c = this.creer(p)
      c.dort = true
    }
  }
  private creer(p: Piece) {
    const f = FORMES[p.k] ?? FORMES[0]
    const c = new Corps(p.k, f.pts, p.x, p.y, p.a)
    this.corps.push(c)
    return c
  }
  /** La nouvelle pièce, lâchée. */
  ajouter(p: Piece) {
    const c = this.creer(p)
    this.calmeDepuis = 0
    return c
  }

  /** Une image (1/60 s par défaut), en plusieurs petits pas pour que la tour tienne bien. */
  pas(dt = 1 / 60) {
    const h = dt / this.sousPas
    for (let s = 0; s < this.sousPas; s++) this.sousPasDe(h)
    this.temps += dt
    // calme : plus rien ne bouge depuis un moment
    let bouge = false
    for (const c of this.corps) {
      if (c.dort || c.y > LIGNE_CHUTE) continue
      if (Math.hypot(c.vx, c.vy) > 3 || Math.abs(c.w) > 0.06) bouge = true
    }
    this.calmeDepuis = bouge ? 0 : this.calmeDepuis + dt
  }

  private sousPasDe(h: number) {
    const actifs = this.corps.filter((c) => !c.dort && c.y < 3000)
    // la pesanteur
    for (const c of actifs) c.vy += this.gravite * h
    // les contacts
    const vus = new Set<string>()
    const tous = [this.socle, ...this.corps]
    for (let i = 0; i < tous.length; i++) {
      for (let j = i + 1; j < tous.length; j++) {
        const A = tous[i]
        const B = tous[j]
        const aBouge = !A.dort && A.im > 0
        const bBouge = !B.dort && B.im > 0
        if (!aBouge && !bBouge) continue
        if (A.y > 3000 || B.y > 3000) continue
        const res = collision(A, B)
        const cle = `${i}:${j}`
        if (!res) continue
        // une pièce endormie qu'on touche se réveille
        if (A.dort) A.dort = false
        if (B.dort) B.dort = false
        vus.add(cle)
        const ancien = this.contacts.get(cle)
        const pts: Point[] = res.pts.map((p) => {
          const vieux = ancien?.pts.find((q) => q.id === p.id)
          return { ...p, pn: vieux?.pn ?? 0, pt: vieux?.pt ?? 0, mn: 0, mt: 0, biais: 0, rax: 0, ray: 0, rbx: 0, rby: 0 }
        })
        this.contacts.set(cle, { a: A, b: B, nx: res.nx, ny: res.ny, pts, mu: 0.8 }) // la feutrine accroche
      }
    }
    for (const k of [...this.contacts.keys()]) if (!vus.has(k)) this.contacts.delete(k)

    const contacts = [...this.contacts.values()]
    const masse = (c: Corps) => (c.dort ? 0 : c.im)
    const inertie = (c: Corps) => (c.dort ? 0 : c.iI)
    // préparation et démarrage à chaud (les impulsions de l'image précédente)
    for (const ct of contacts) {
      const { a: A, b: B, nx, ny } = ct
      const tx = ny
      const ty = -nx
      for (const p of ct.pts) {
        p.rax = p.x - A.x
        p.ray = p.y - A.y
        p.rbx = p.x - B.x
        p.rby = p.y - B.y
        const rna = p.rax * ny - p.ray * nx
        const rnb = p.rbx * ny - p.rby * nx
        const kn = masse(A) + masse(B) + inertie(A) * rna * rna + inertie(B) * rnb * rnb
        p.mn = kn > 0 ? 1 / kn : 0
        const rta = p.rax * ty - p.ray * tx
        const rtb = p.rbx * ty - p.rby * tx
        const kt = masse(A) + masse(B) + inertie(A) * rta * rta + inertie(B) * rtb * rtb
        p.mt = kt > 0 ? 1 / kt : 0
        p.biais = (-BIAIS / h) * Math.min(0, p.sep + PENETRATION_PERMISE)
        const px = p.pn * nx + p.pt * tx
        const py = p.pn * ny + p.pt * ty
        if (!A.dort) {
          A.vx -= A.im * px
          A.vy -= A.im * py
          A.w -= A.iI * (p.rax * py - p.ray * px)
        }
        if (!B.dort) {
          B.vx += B.im * px
          B.vy += B.im * py
          B.w += B.iI * (p.rbx * py - p.rby * px)
        }
      }
    }
    // les impulsions, plusieurs fois de suite
    for (let it = 0; it < this.iterations; it++) {
      for (const ct of contacts) {
        const { a: A, b: B, nx, ny, mu } = ct
        const tx = ny
        const ty = -nx
        for (const p of ct.pts) {
          const dvx = B.vx - B.w * p.rby - (A.vx - A.w * p.ray)
          const dvy = B.vy + B.w * p.rbx - (A.vy + A.w * p.rax)
          // le long de la normale : on empêche de s'enfoncer
          const vn = dvx * nx + dvy * ny
          let dpn = p.mn * (-vn + p.biais)
          const pn0 = p.pn
          p.pn = Math.max(pn0 + dpn, 0)
          dpn = p.pn - pn0
          let px = dpn * nx
          let py = dpn * ny
          if (!A.dort) {
            A.vx -= A.im * px
            A.vy -= A.im * py
            A.w -= A.iI * (p.rax * py - p.ray * px)
          }
          if (!B.dort) {
            B.vx += B.im * px
            B.vy += B.im * py
            B.w += B.iI * (p.rbx * py - p.rby * px)
          }
          // le frottement de la feutrine
          const dvx2 = B.vx - B.w * p.rby - (A.vx - A.w * p.ray)
          const dvy2 = B.vy + B.w * p.rbx - (A.vy + A.w * p.rax)
          const vt = dvx2 * tx + dvy2 * ty
          let dpt = p.mt * -vt
          const max = mu * p.pn
          const pt0 = p.pt
          p.pt = Math.max(-max, Math.min(pt0 + dpt, max))
          dpt = p.pt - pt0
          px = dpt * tx
          py = dpt * ty
          if (!A.dort) {
            A.vx -= A.im * px
            A.vy -= A.im * py
            A.w -= A.iI * (p.rax * py - p.ray * px)
          }
          if (!B.dort) {
            B.vx += B.im * px
            B.vy += B.im * py
            B.w += B.iI * (p.rbx * py - p.rby * px)
          }
        }
      }
    }
    // on avance, avec un peu d'amorti (la feutrine ne rebondit pas)
    for (const c of actifs) {
      if (c.im === 0) continue
      c.vx *= 0.9995
      c.vy *= 0.9995
      c.w *= 0.998
      c.x += c.vx * h
      c.y += c.vy * h
      c.a += c.w * h
      c.maj()
    }
  }

  /** Plus rien ne bouge (ou on a assez attendu). */
  calme(minimum = 0.45) {
    return this.calmeDepuis >= minimum || this.temps > 12
  }
  /** Les pièces tombées du socle. */
  tombees() {
    return this.corps.flatMap((c, i) => (c.y > LIGNE_CHUTE ? [i] : []))
  }
  /** Le haut de la tour (en y, donc négatif), ou 0 si rien n'est posé. */
  sommet(sauf?: number) {
    let haut = 0
    this.corps.forEach((c, i) => {
      if (i === sauf || c.y > LIGNE_CHUTE) return
      for (const v of c.monde) haut = Math.min(haut, v.y)
    })
    return haut
  }
  /** Les pièces, telles qu'elles sont (arrondies, pour la base). */
  etat(): Piece[] {
    return this.corps.map((c) => ({ k: c.k, x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100, a: Math.round(c.a * 10000) / 10000 }))
  }
  /** Les sommets de chaque pièce, pour la dessiner. */
  contours() {
    return this.corps.map((c) => ({ k: c.k, pts: c.monde, dort: c.dort }))
  }
}

/** Les sommets d'une pièce à une position donnée (pour dessiner celle qu'on tient). */
export function contour(p: Piece): { x: number; y: number }[] {
  const c = new Corps(p.k, (FORMES[p.k] ?? FORMES[0]).pts, p.x, p.y, p.a)
  return c.monde
}

/** Où apparaît la prochaine pièce : bien au-dessus de la tour. */
export const hauteurDeDepart = (sommet: number) => sommet - 150

/** Lâcher une pièce et attendre que tout se calme, sans rien dessiner (pour les proches de la démo et les tests). */
export function lacher(tour: Piece[], p: Piece, maxImages = 900): { pieces: Piece[]; tombe: boolean } {
  const m = new Monde(tour)
  m.ajouter(p)
  for (let i = 0; i < maxImages; i++) {
    m.pas()
    if (m.tombees().length) {
      // on laisse encore un peu tomber, pour le dessin
      for (let j = 0; j < 30; j++) m.pas()
      return { pieces: m.etat(), tombe: true }
    }
    if (m.calme()) break
  }
  return { pieces: m.etat(), tombe: m.tombees().length > 0 }
}

/**
 * Le coup du panda : il essaie quelques endroits au-dessus de la tour (en faisant tomber la pièce « dans sa tête »)
 * et garde le plus sûr, celui qui bouge le moins la tour. Parfois il est un peu maladroit, pour qu'on puisse le battre.
 */
export function coupDuPanda(tour: Piece[], k: number, hasard: () => number = Math.random): Piece {
  const m = new Monde(tour)
  const y = hauteurDeDepart(m.sommet())
  const debout = tour.filter((q) => q.y < LIGNE_CHUTE)
  const haut = [...debout].sort((u, v) => u.y - v.y)[0]
  const centre = haut ? haut.x : 0
  const essais: Piece[] = [-28, -14, 0, 14, 28].map((dx) => ({ k, x: Math.max(-BORD, Math.min(BORD, centre + dx + (hasard() - 0.5) * 6)), y, a: 0 }))
  // maladroit une fois sur huit : il lâche sans réfléchir
  if (hasard() < 0.125) return essais[Math.floor(hasard() * essais.length)]
  let meilleur = essais[2]
  let score = Infinity
  for (const e of essais) {
    const r = lacher(tour, e, 600)
    const bouge = r.pieces.slice(0, tour.length).reduce((s, q, i) => s + Math.hypot(q.x - tour[i].x, q.y - tour[i].y) + Math.abs(q.a - tour[i].a) * 30, 0)
    const s = (r.tombe ? 10000 : 0) + bouge + Math.abs(e.x) * 0.05
    if (s < score) {
      score = s
      meilleur = e
    }
  }
  return meilleur
}

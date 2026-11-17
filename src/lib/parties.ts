// Jouer en famille, la suite : bataille navale, Qui de nous ?, dessine et devine, devine l'année,
// le téléphone dessiné (table parties), et le mot mystère du jour.
// Les règles sont vérifiées par la base (supabase/migrations/0019_jeux_famille.sql) ; ce fichier les reprend
// pour le mode démo, où les proches fictifs jouent aussi.

export type PartieKind = 'bataille' | 'quidenous' | 'dessin' | 'annee' | 'telephone'

/** Un trait de dessin sur une feuille de 1000 × 750 : couleur, épaisseur, points [x, y, x, y…]. */
export type Trait = { c: number; w: number; p: number[] }
export type Dessin = Trait[]
export const FEUILLE_W = 1000
export const FEUILLE_H = 750
export const ENCRES = ['#2B2540', '#E5484D', '#2F7FE0', '#2F9E5B', '#F5A524', '#8A5CF0']

type Fin = { abandon?: boolean; par?: string }
export type BatailleState = Fin & {
  phase: 'placement' | 'tirs'
  pret: [boolean, boolean]
  /** les tirs reçus sur le plateau de chacun : 0 rien, 1 dans l'eau, 2 touché */
  b1: number[]
  b2: number[]
  /** les bateaux coulés de chacun (leurs cases) */
  s1: number[][]
  s2: number[][]
  dernier?: { c: number; par: 1 | 2 }
}
export type QdnRonde = { q: number; v: Record<string, string>; accord: boolean }
export type QdnState = Fin & { q: number[]; i: number; votes: string[]; rondes: QdnRonde[]; accords: number }
export type DessinRonde = { mot: string; dessin: Dessin; essais: string[]; trouve: boolean; par: string }
export type DessinState = Fin & { n: number; i: number; phase: 'dessin' | 'devine'; dessin: Dessin | null; essais: string[]; rondes: DessinRonde[]; trouves: number }
export type AnneeState = Fin & { photos: string[]; fait: string[]; annees?: number[]; reponses?: Record<string, number[]>; totaux?: Record<string, number> }
export type Etape = { par: string; v: string | Dessin }
export type TelState = Fin & { avance: number[]; album?: Etape[][] }
export type PartieState = BatailleState | QdnState | DessinState | AnneeState | TelState

/** Ce que chacun est seul à voir (public.secret_partie). */
export type Secret = {
  flotte?: number[][]
  vote?: string | null
  mot?: string
  annees?: number[]
  mes?: number[] | null
  etapes?: { k: number; j: number; avant: string | Dessin | null }[]
}

export const PARTIES: Record<PartieKind, { name: string; hint: string; art: string; min: number; max: number }> = {
  bataille: { name: 'Bataille navale', hint: 'Couler la flotte', art: 'jeu-bataille', min: 2, max: 2 },
  dessin: { name: 'Dessine et devine', hint: 'Chacun son tour', art: 'jeu-dessin', min: 2, max: 2 },
  quidenous: { name: 'Qui de nous ?', hint: 'Votez en secret', art: 'jeu-quidenous', min: 2, max: 8 },
  annee: { name: 'Devine l’année', hint: 'Dater une photo', art: 'jeu-annee', min: 2, max: 8 },
  telephone: { name: 'Téléphone', hint: 'Phrase, dessin…', art: 'jeu-telephone', min: 3, max: 8 },
}

export const ANNEE_MIN = 1850
export const ANNEE_PHOTOS = 5

/** Les questions de Qui de nous ? (la base garde seulement leurs numéros). */
export const QUESTIONS_QDN = [
  'mange le plus',
  'ronfle le plus fort',
  'est toujours en retard',
  'pleure devant les films',
  'chante sous la douche',
  'est le plus gourmand',
  'range le moins sa chambre',
  'a le plus de fous rires',
  'est le plus grognon le matin',
  'passe le plus de temps sur son téléphone',
  'ferait le meilleur chef cuisinier',
  'oublie toujours ses clés',
  'raconte les pires blagues',
  'danse le mieux',
  'est le plus mauvais perdant',
  'se lève le plus tôt',
  's’endort devant la télé',
  'a le plus de patience',
  'fait les meilleurs câlins',
  'survivrait le plus longtemps sur une île déserte',
  'est le plus têtu',
  'parle le plus',
  'a la meilleure mémoire',
  'est le plus frileux',
  'mange le plus de chocolat',
  'ferait le meilleur maître d’école',
  'a le plus peur des araignées',
  'chante le plus faux',
  'est le plus organisé',
  'deviendra célèbre',
  'garde le mieux un secret',
  'fait les meilleurs gâteaux',
  'est le plus aventurier',
  'se perd le plus souvent',
  'a le plus d’imagination',
  'rit le plus fort',
  'est le plus curieux',
  'fait le plus de bêtises',
  'est le roi ou la reine du canapé',
  'prend le plus de photos',
  'est le plus sportif',
  'pique les frites dans l’assiette des autres',
  'met le plus de temps à se préparer',
  'ferait le meilleur président',
  'est le plus généreux',
  'a le plus de chance',
  'ronchonne quand il a faim',
  'aime le plus les animaux',
  'oublie les anniversaires',
  'raconte les meilleures histoires',
  'est le plus drôle',
  'a la main verte',
  'gagne toujours aux jeux de société',
  'trouve toujours une excuse',
  'dort le plus',
  'mange le plus lentement',
  'envoie le plus de messages',
  'ferait le meilleur détective',
  'a les meilleures idées de sorties',
  'serait le premier à sauter en parachute',
]
export const QDN_MANCHES = 8

export function quiDeNous(n: number) {
  return n === 2 ? 'Qui de nous deux' : `Qui de nous ${['', '', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit'][n] ?? n}`
}

export function questionsAuHasard(k = QDN_MANCHES) {
  const idx = [...QUESTIONS_QDN.keys()]
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, k)
}

/** Les cases d'un bateau, sur 8 × 8 : case = rangée*8 + colonne. */
export const BN = 8
export const TAILLES = [4, 3, 3, 2]

export function flotte(): number[][] {
  for (;;) {
    const occ = new Set<number>()
    const f: number[][] = []
    let ok = true
    for (const t of TAILLES) {
      let placed = false
      for (let essai = 0; essai < 300 && !placed; essai++) {
        const h = Math.random() < 0.5
        const r0 = Math.floor(Math.random() * (h ? BN : BN + 1 - t))
        const c0 = Math.floor(Math.random() * (h ? BN + 1 - t : BN))
        const cells = Array.from({ length: t }, (_, k) => (r0 + (h ? 0 : k)) * BN + c0 + (h ? k : 0))
        const touche = cells.some((x) => {
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const r = Math.floor(x / BN) + dr
              const c = (x % BN) + dc
              if (r >= 0 && r < BN && c >= 0 && c < BN && occ.has(r * BN + c)) return true
            }
          return false
        })
        if (touche) continue
        cells.forEach((x) => occ.add(x))
        f.push(cells)
        placed = true
      }
      if (!placed) {
        ok = false
        break
      }
    }
    if (ok) return f
  }
}

/** À moi de jouer dans cette partie ? */
export function aMoi(p: { kind: PartieKind; players: string[]; turn: string | null; status: string; state: PartieState }, me: string) {
  if (p.status !== 'en_cours' || !p.players.includes(me)) return false
  const side = p.players.indexOf(me)
  const n = p.players.length
  switch (p.kind) {
    case 'bataille': {
      const s = p.state as BatailleState
      return s.phase === 'placement' ? !s.pret[side] : p.turn === me
    }
    case 'quidenous':
      return !(p.state as QdnState).votes.includes(me)
    case 'dessin':
      return p.turn === me
    case 'annee':
      return side > 0 && !(p.state as AnneeState).fait.includes(me)
    case 'telephone':
      return (p.state as TelState).avance.some((j, k) => j < n && p.players[(k + j) % n] === me)
  }
}

/** Qui doit encore jouer (pour « en attente de… »). */
export function attendus(p: { kind: PartieKind; players: string[]; turn: string | null; state: PartieState }): string[] {
  const n = p.players.length
  switch (p.kind) {
    case 'bataille': {
      const s = p.state as BatailleState
      return s.phase === 'placement' ? p.players.filter((_, i) => !s.pret[i]) : p.turn ? [p.turn] : []
    }
    case 'quidenous':
      return p.players.filter((x) => !(p.state as QdnState).votes.includes(x))
    case 'dessin':
      return p.turn ? [p.turn] : []
    case 'annee':
      return p.players.slice(1).filter((x) => !(p.state as AnneeState).fait.includes(x))
    case 'telephone': {
      const s = p.state as TelState
      return [...new Set(s.avance.flatMap((j, k) => (j < n ? [p.players[(k + j) % n]] : [])))]
    }
  }
}

/** Un mot sans accents ni espaces, comme la base (private.norm). */
export const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')

export function bonneReponse(essai: string, mot: string) {
  const e = norm(essai)
  const m = norm(mot)
  return !!e && (e === m || e === m + 's' || e === m + 'x' || m === e + 's')
}

// ───────── Mot mystère ─────────

export const MOT_ESSAIS = 6
/** Le jour à Paris, AAAA-MM-JJ (le mot change à minuit, heure de Paris, pour toute la famille). */
export const jourParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
/** Les couleurs d'un essai : 2 bien placée, 1 ailleurs dans le mot, 0 absente. */
export function motif(essai: string, mot: string) {
  const res = ['0', '0', '0', '0', '0']
  const reste: string[] = []
  for (let k = 0; k < 5; k++) {
    if (essai[k] === mot[k]) res[k] = '2'
    else reste.push(mot[k])
  }
  for (let k = 0; k < 5; k++) {
    if (res[k] !== '0') continue
    const p = reste.indexOf(essai[k])
    if (p >= 0) {
      res[k] = '1'
      reste.splice(p, 1)
    }
  }
  return res.join('')
}

export type MotMoi = { jour: string; mots: string[]; solution: string | null }
export type MotLigne = { member_id: string; motifs: string[]; trouve: boolean }

// ───────── Pour la démo : des dessins tout faits, des phrases, des mots ─────────

const cercle = (cx: number, cy: number, r: number, n = 28) => Array.from({ length: n + 1 }, (_, i) => [Math.round(cx + r * Math.cos((i / n) * Math.PI * 2)), Math.round(cy + r * Math.sin((i / n) * Math.PI * 2))]).flat()
const t = (c: number, w: number, ...p: number[]): Trait => ({ c, w, p })

export const DESSINS_DEMO: Record<string, Dessin> = {
  soleil: [t(4, 14, ...cercle(500, 375, 120)), ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return t(4, 12, Math.round(500 + 160 * Math.cos(a)), Math.round(375 + 160 * Math.sin(a)), Math.round(500 + 240 * Math.cos(a)), Math.round(375 + 240 * Math.sin(a))) })],
  maison: [t(0, 12, 300, 650, 300, 380, 700, 380, 700, 650, 300, 650), t(1, 12, 260, 400, 500, 180, 740, 400), t(0, 10, 450, 650, 450, 520, 550, 520, 550, 650), t(2, 10, 590, 440, 660, 440, 660, 500, 590, 500, 590, 440)],
  arbre: [t(0, 14, 470, 680, 470, 450), t(0, 14, 530, 680, 530, 450), t(3, 14, ...cercle(500, 330, 160))],
  poisson: [t(2, 12, 250, 375, 400, 260, 600, 300, 700, 375, 600, 450, 400, 490, 250, 375), t(2, 12, 700, 375, 820, 280, 820, 470, 700, 375), t(0, 16, 360, 350, 362, 352)],
  coeur: [t(1, 16, 500, 640, 280, 420, 260, 300, 330, 220, 430, 230, 500, 320, 570, 230, 670, 220, 740, 300, 720, 420, 500, 640)],
  fleur: [t(3, 12, 500, 680, 500, 420), ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return t(5, 12, ...cercle(Math.round(500 + 85 * Math.cos(a)), Math.round(330 + 85 * Math.sin(a)), 55, 18)) }), t(4, 14, ...cercle(500, 330, 40, 16))],
  chat: [t(0, 12, ...cercle(500, 420, 180)), t(0, 12, 360, 300, 340, 160, 440, 250), t(0, 12, 640, 300, 660, 160, 560, 250), t(0, 16, 440, 400, 442, 402), t(0, 16, 560, 400, 562, 402), t(1, 10, 480, 470, 500, 490, 520, 470), t(0, 6, 380, 480, 250, 460), t(0, 6, 380, 500, 250, 520), t(0, 6, 620, 480, 750, 460), t(0, 6, 620, 500, 750, 520)],
  bateau: [t(0, 12, 220, 480, 780, 480, 680, 600, 320, 600, 220, 480), t(0, 10, 500, 480, 500, 150), t(1, 10, 500, 170, 700, 440, 500, 440), t(2, 8, 120, 660, 250, 640, 380, 670, 510, 640, 640, 670, 770, 640, 900, 660)],
  lune: [t(4, 14, 560, 160, 420, 220, 360, 380, 420, 540, 560, 600, 470, 500, 450, 380, 470, 260, 560, 160)],
  nuage: [t(2, 12, 260, 500, 250, 420, 330, 380, 380, 290, 480, 260, 570, 300, 640, 260, 730, 300, 750, 400, 760, 500, 260, 500)],
}
export const PHRASES_DEMO = [
  'Un chat qui fait du ski',
  'Mamie mange une glace géante',
  'Un poisson qui lit le journal',
  'Le soleil qui fait la sieste',
  'Une maison qui s’envole',
  'Un arbre qui danse sous la pluie',
  'Papa qui pêche une baleine',
  'Une fleur qui chante',
]
export const DEVINETTES_DEMO = ['Un gros soleil', 'Une maison', 'Un bateau sur la mer', 'Un chat tout rond', 'Une fleur', 'Un poisson qui sourit', 'Un cœur', 'La lune']

/** Les mots du mot mystère (la vraie liste est dans la base ; celle-ci sert à la démo). */
export const MOTS_DEMO = ['ARBRE', 'AVION', 'BALLE', 'CHIEN', 'FLEUR', 'GLACE', 'LAPIN', 'NEIGE', 'PLAGE', 'POMME', 'SAPIN', 'TABLE', 'TRAIN', 'VACHE', 'PIANO', 'ROBOT', 'CREPE', 'PANDA', 'HIBOU', 'SUCRE']

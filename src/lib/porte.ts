// À deux, on porte ! Deux porteurs, une planche, un objet fragile posé dessus, et un parcours d'obstacles.
// Chacun fait avancer son côté (on appuie pour marcher, on lâche pour s'arrêter). Si l'un va plus vite que
// l'autre, la planche s'étire ou se tasse : l'objet tangue, puis tombe. Il faut marcher ensemble.
// Ce fichier est le moteur du jeu, sans React ni DOM (les tests le chargent tel quel).

/** La planche : l'écart idéal entre les deux porteurs (en points du monde). */
export const LONG = 150
/** L'écart en plus ou en moins qu'on peut avoir sans rien risquer. */
export const E_OK = 14
/** Au-delà, la planche échappe des mains. */
export const E_MAX = 64
/** La vitesse de marche à plat (points par seconde). */
export const V_MAX = 96
/** La vitesse au-dessus de laquelle une bosse secoue. */
export const V_BOSSE = 52
const ACCEL = 240
const FREIN = 380
/** Devant un animal assis sur le chemin, on s'arrête à cette distance. */
const R_ANIMAL = 30

export type Zone =
  /** de la boue : on y marche deux fois moins vite */
  | { k: 'boue'; x: number; l: number }
  /** du verglas : on démarre et on s'arrête mal */
  | { k: 'glace'; x: number; l: number }
  /** une bosse : à passer doucement, sinon ça secoue */
  | { k: 'bosse'; x: number }
  /** un animal qui vient s'asseoir sur le chemin : toutes les `cycle` secondes, il reste `reste` secondes */
  | { k: 'animal'; x: number; qui: 'chat' | 'chien' | 'lapin'; cycle: number; reste: number; phase: number }
  /** une colline : on monte lentement, on descend vite et on freine mal */
  | { k: 'cote'; x: number; l: number; h: number }

export type Niveau = {
  nom: string
  /** l'image de ce qu'on porte (dans public/art) */
  objet: string
  /** sa taille à l'écran, en points */
  taille: number
  /** 1 : solide ; plus : il tangue plus vite */
  fragile: number
  /** la ligne d'arrivée (pour le porteur de derrière) */
  long: number
  /** le temps à battre pour la troisième étoile, en secondes */
  par: number
  ciel: [string, string]
  herbe: string
  zones: Zone[]
}

const animal = (x: number, qui: 'chat' | 'chien' | 'lapin', phase = 0, cycle = 6.5, reste = 2.6): Zone => ({ k: 'animal', x, qui, cycle, reste, phase })

export const NIVEAUX: Niveau[] = [
  {
    nom: 'Le gâteau',
    objet: 'stickers/gateau',
    taille: 56,
    fragile: 0.8,
    long: 1250,
    par: 26,
    ciel: ['#CFE9FF', '#F4FBFF'],
    herbe: '#9AD9A5',
    zones: [{ k: 'bosse', x: 620 }, { k: 'bosse', x: 980 }],
  },
  {
    nom: 'Le cadeau',
    objet: 'stickers/cadeau',
    taille: 56,
    fragile: 0.9,
    long: 1600,
    par: 38,
    ciel: ['#FFE3EC', '#FFF7F0'],
    herbe: '#A8DDA0',
    zones: [{ k: 'boue', x: 520, l: 230 }, { k: 'bosse', x: 1010 }, { k: 'boue', x: 1190, l: 170 }],
  },
  {
    nom: 'Le cupcake',
    objet: 'stickers/cupcake',
    taille: 58,
    fragile: 1,
    long: 1850,
    par: 47,
    ciel: ['#E4E0FF', '#FBF7FF'],
    herbe: '#9FD8B4',
    zones: [{ k: 'bosse', x: 470 }, animal(800, 'chat', 1.5), { k: 'boue', x: 1040, l: 200 }, { k: 'bosse', x: 1500 }],
  },
  {
    nom: 'La citrouille',
    objet: 'citrouille',
    taille: 68,
    fragile: 1,
    long: 2050,
    par: 49,
    ciel: ['#FFE9C9', '#FFF8EC'],
    herbe: '#B5D98A',
    zones: [{ k: 'cote', x: 430, l: 520, h: 54 }, { k: 'bosse', x: 1130 }, { k: 'cote', x: 1300, l: 440, h: 46 }, { k: 'bosse', x: 1860 }],
  },
  {
    nom: 'Le bonhomme de neige',
    objet: 'stickers/bonhomme-neige',
    taille: 60,
    fragile: 1.1,
    long: 2150,
    par: 44,
    ciel: ['#DDEBFA', '#F7FBFF'],
    herbe: '#E9F2FA',
    zones: [{ k: 'glace', x: 440, l: 260 }, { k: 'bosse', x: 900 }, { k: 'glace', x: 1080, l: 220 }, animal(1500, 'lapin', 0.5), { k: 'glace', x: 1700, l: 200 }],
  },
  {
    nom: 'La boule de Noël',
    objet: 'stickers/boule',
    taille: 54,
    fragile: 1.25,
    long: 2400,
    par: 65,
    ciel: ['#D9E4FF', '#F6F4FF'],
    herbe: '#EAF1F8',
    zones: [
      { k: 'bosse', x: 420 },
      { k: 'glace', x: 560, l: 240 },
      animal(1110, 'chien', 2),
      { k: 'boue', x: 1280, l: 200 },
      { k: 'bosse', x: 1620 },
      { k: 'cote', x: 1720, l: 460, h: 50 },
    ],
  },
  {
    nom: 'Le sapin',
    objet: 'avent-sapin',
    taille: 74,
    fragile: 1.3,
    long: 2700,
    par: 69,
    ciel: ['#DCEBDD', '#F6FBF4'],
    herbe: '#A6D3A0',
    zones: [
      { k: 'cote', x: 380, l: 480, h: 56 },
      { k: 'bosse', x: 1040 },
      animal(1200, 'chat', 0.8),
      { k: 'glace', x: 1360, l: 230 },
      { k: 'bosse', x: 1760 },
      { k: 'boue', x: 1900, l: 220 },
      animal(2330, 'chien', 3.2),
    ],
  },
  {
    nom: 'La glace',
    objet: 'stickers/glace',
    taille: 62,
    fragile: 1.45,
    long: 3100,
    par: 84,
    ciel: ['#FFE6D6', '#FFF9F2'],
    herbe: '#A9DDB0',
    zones: [
      { k: 'bosse', x: 380 },
      { k: 'boue', x: 520, l: 190 },
      animal(900, 'lapin', 1),
      { k: 'cote', x: 1040, l: 500, h: 58 },
      { k: 'bosse', x: 1640 },
      { k: 'glace', x: 1780, l: 260 },
      animal(2300, 'chat', 4),
      { k: 'bosse', x: 2470 },
      { k: 'cote', x: 2570, l: 420, h: 48 },
    ],
  },
]

/** La hauteur du sol à cet endroit (les collines), et sa pente. */
export function sol(n: Niveau, x: number): { h: number; pente: number } {
  for (const z of n.zones) {
    if (z.k !== 'cote' || x <= z.x || x >= z.x + z.l) continue
    const u = (x - z.x) / z.l
    const s = Math.sin(Math.PI * u)
    return { h: z.h * s * s, pente: ((z.h * Math.PI) / z.l) * Math.sin(2 * Math.PI * u) }
  }
  return { h: 0, pente: 0 }
}

/** L'animal est-il assis sur le chemin à cet instant ? (`vient` : il arrive dans moins d'une seconde) */
export function animalLa(z: Extract<Zone, { k: 'animal' }>, t: number): { la: boolean; vient: boolean } {
  const u = (((t + z.phase) % z.cycle) + z.cycle) % z.cycle
  return { la: u < z.reste, vient: u > z.cycle - 1 }
}

export type Porteur = { x: number; v: number; bloque: boolean }
export type Fin = null | 'gagne' | 'tombe'
/** Pourquoi c'est tombé : celui de devant est parti trop vite, celui de derrière a poussé, ou trop de secousses. */
export type Cause = 'devant' | 'derriere' | 'secousses'
export type Partie = {
  /** le temps de jeu, en secondes */
  t: number
  /** derrière (à gauche) et devant (à droite) */
  a: Porteur
  b: Porteur
  /** l'équilibre perdu : 0 tout va bien, 1 ça tombe */
  w: number
  /** le pire moment de la partie */
  pic: number
  fin: Fin
  cause?: Cause
}

export const nouvellePartie = (): Partie => ({ t: 0, a: { x: 0, v: 0, bloque: false }, b: { x: LONG, v: 0, bloque: false }, w: 0, pic: 0, fin: null })

/** Où est-on : boue, verglas, ou rien. */
function terrain(n: Niveau, x: number): 'boue' | 'glace' | null {
  for (const z of n.zones) if ((z.k === 'boue' || z.k === 'glace') && x > z.x && x < z.x + z.l) return z.k
  return null
}

/** La vitesse qu'on peut atteindre à cet endroit. */
export function vitesseMax(n: Niveau, x: number) {
  const { pente } = sol(n, x)
  return V_MAX * (terrain(n, x) === 'boue' ? 0.5 : 1) * Math.max(0.55, Math.min(1.3, 1 - 1.5 * pente))
}

/** Un porteur avance d'un pas de temps. Renvoie la secousse qu'il vient de donner (0 : aucune, 1 : une grosse). */
export function pasPorteur(n: Niveau, p: Porteur, appui: boolean, t: number, dt: number): number {
  const sur = terrain(n, p.x)
  const { pente } = sol(n, p.x)
  const cible = appui ? vitesseMax(n, p.x) : 0
  const acc = ACCEL * (sur === 'glace' ? 0.4 : 1)
  const frein = FREIN * (sur === 'glace' ? 0.2 : 1) * (pente < -0.05 ? 0.6 : 1)
  p.v = p.v < cible ? Math.min(cible, p.v + acc * dt) : Math.max(cible, p.v - frein * dt)
  let nx = p.x + p.v * dt
  let secousse = 0
  p.bloque = false
  for (const z of n.zones) {
    if (z.k === 'bosse' && p.x < z.x && nx >= z.x && p.v > V_BOSSE) secousse = Math.max(secousse, Math.min(1, (p.v - V_BOSSE) / (V_MAX - V_BOSSE)))
    if (z.k === 'animal' && p.x <= z.x - R_ANIMAL && nx > z.x - R_ANIMAL && animalLa(z, t).la) {
      // il est assis là : on attend qu'il s'en aille
      nx = z.x - R_ANIMAL
      p.v = 0
      p.bloque = true
    }
  }
  p.x = nx
  return secousse
}

/** L'écart entre les deux porteurs, par rapport à la planche : plus de zéro, celui de devant s'éloigne. */
export const ecart = (g: Partie) => g.b.x - g.a.x - LONG

/** L'objet réagit : il tangue quand les porteurs ne sont plus ensemble, se calme quand ils le sont.
 *  `marge` : un peu de tolérance en plus quand on joue chacun sur son téléphone (les nouvelles de l'autre ont du retard). */
export function pasObjet(n: Niveau, g: Partie, secousse: number, dt: number, marge = 0) {
  const e = ecart(g)
  const hors = Math.max(0, Math.abs(e) - E_OK - marge) / (E_MAX - E_OK)
  const heurt = (Math.abs(g.b.v - g.a.v) / V_MAX) * (hors > 0 ? 0.3 : 0.06)
  // à l'arrêt, un écart fait beaucoup moins tanguer qu'en marchant (on a le temps de se remettre ensemble)
  const allure = 0.2 + 0.8 * Math.min(1, (Math.abs(g.a.v) + Math.abs(g.b.v)) / V_MAX)
  g.w += dt * n.fragile * (hors * 1.5 * allure + heurt) + secousse * 0.4 * n.fragile
  if (hors === 0) g.w -= dt * 0.24
  g.w = Math.max(0, g.w)
  g.pic = Math.max(g.pic, Math.min(1, g.w))
  if (Math.abs(e) >= E_MAX + marge) {
    g.fin = 'tombe'
    g.cause = e > 0 ? 'devant' : 'derriere'
  } else if (g.w >= 1) {
    g.fin = 'tombe'
    // l'équilibre perdu : à cause d'un écart qui a duré, ou des secousses
    g.cause = Math.abs(e) > E_OK + marge ? (e > 0 ? 'devant' : 'derriere') : 'secousses'
  } else if (g.a.x >= n.long) g.fin = 'gagne'
}

/** Un pas de temps quand les deux porteurs sont sur le même téléphone (ou que l'un est le panda). */
export function pas(n: Niveau, g: Partie, appuiA: boolean, appuiB: boolean, dt: number) {
  if (g.fin) return
  g.t += dt
  const s = Math.max(pasPorteur(n, g.a, appuiA, g.t, dt), pasPorteur(n, g.b, appuiB, g.t, dt))
  pasObjet(n, g, s, dt)
}

/** Les étoiles d'une partie gagnée : arrivé ; sans grosse frayeur ; et dans les temps. */
export function etoiles(n: Niveau, temps: number, pic: number) {
  const calme = pic < 0.6
  return 1 + (calme ? 1 : 0) + (calme && temps <= n.par ? 1 : 0)
}

/** Ce qu'on dit à la fin. */
export function motDeFin(g: Partie, n: Niveau): string {
  if (g.fin === 'gagne') return g.pic < 0.25 ? 'Pas une secousse. Quelle équipe !' : g.pic < 0.6 ? 'Livré en bon état !' : 'Ouf… c’était moins une.'
  if (g.cause === 'devant') return 'Celui de devant allait trop vite pour celui de derrière.'
  if (g.cause === 'derriere') return 'Celui de derrière allait trop vite pour celui de devant.'
  return `Trop de secousses pour ${n.nom.toLowerCase()}.`
}

// ───────── Le partenaire qui joue tout seul (le panda roux, ou un proche fictif en démo) ─────────

export type Robot = {
  /** ce qu'il a décidé (on ne change pas d'avis à chaque image : il a un temps de réaction) */
  appui: boolean
  revoir: number
  /** le panda se laisse distraire : jusqu'à quand, et quand ça le reprendra */
  distrait: number
  prochaine: number
}
export const nouveauRobot = (): Robot => ({ appui: false, revoir: 0, distrait: 0, prochaine: 7 })

/**
 * Le robot décide s'il appuie. `cote` : le côté qu'il porte. Il reste avec l'autre, ralentit avant les bosses,
 * et, si `reveur`, s'arrête de temps en temps pour regarder un papillon (à l'autre de l'attendre).
 */
export function robot(n: Niveau, g: Partie, cote: 'a' | 'b', r: Robot, reveur: boolean, hasard: () => number = Math.random): boolean {
  const moi = g[cote]
  if (reveur && g.t >= r.prochaine && g.t > r.distrait) {
    // pas au milieu d'une bosse ni devant l'arrivée
    const calme = !n.zones.some((z) => z.k === 'bosse' && Math.abs(z.x - moi.x) < 90) && moi.x < n.long - 200
    if (calme) {
      r.distrait = g.t + 1.3 + hasard() * 0.6
      r.prochaine = r.distrait + 7 + hasard() * 6
    } else r.prochaine = g.t + 1
  }
  if (g.t < r.distrait) return (r.appui = false)
  // une bosse juste devant : on la passe doucement (là, il ne quitte pas sa vitesse des yeux)
  for (const z of n.zones) {
    if (z.k !== 'bosse') continue
    const d = z.x - moi.x
    if (d > 0 && d < 40) return (r.appui = moi.v < V_BOSSE - 10 && (cote === 'b' ? ecart(g) < E_OK : ecart(g) > -E_OK))
  }
  // un animal assis juste devant, ou qui arrive : on s'arrête en douceur plutôt que de buter dessus
  for (const z of n.zones) {
    if (z.k !== 'animal') continue
    const d = z.x - R_ANIMAL - moi.x
    const { la, vient } = animalLa(z, g.t)
    if (d > 0 && d < 46 && (la || vient)) return (r.appui = false)
  }
  if (g.t < r.revoir) return r.appui
  r.revoir = g.t + 0.12
  const e = ecart(g)
  // rester ensemble : devant, on attend si on s'éloigne ; derrière, on attend si on pousse
  let va = cote === 'b' ? e < 5 : e > -5
  // et on ne laisse jamais la planche s'étirer ou se tasser jusqu'au danger
  if (cote === 'b' && e > E_OK) va = false
  if (cote === 'a' && e < -E_OK) va = false
  if (cote === 'b' && e < -E_OK) va = true
  if (cote === 'a' && e > E_OK) va = true
  return (r.appui = va)
}

// ───────── Chacun sur son téléphone ─────────
// L'hôte (celui qui invite) porte derrière et décide de l'équilibre ; l'invité porte devant.
// Chacun fait avancer son porteur chez lui et dit à l'autre où il en est, huit fois par seconde.

export type MsgPorte =
  /** l'hôte lance le niveau n : chacun compte 3, 2, 1 (m : le numéro de la manche) */
  | { t: 'p-go'; who: string; n: number; m: number }
  /** où j'en suis : position, vitesse, secousse donnée depuis le dernier envoi ; l'hôte ajoute l'équilibre */
  | { t: 'p-x'; who: string; x: number; v: number; j?: number; w?: number; pic?: number }
  | { t: 'p-fin'; who: string; r: 'gagne' | 'tombe'; cause?: Cause; temps: number; pic: number; m: number }
  /** pour mesurer le temps que met un message (aller et retour) */
  | { t: 'p-ping'; who: string; id: number }
  | { t: 'p-pong'; who: string; id: number }

/** Le porteur de l'autre, tel qu'on le montre : il continue sur sa lancée entre deux nouvelles. */
export type Lointain = { x: number; v: number; cible: number; vu: number }
export const nouveauLointain = (x: number): Lointain => ({ x, v: 0, cible: x, vu: 0 })

/** Une nouvelle de l'autre arrive : `retard` est le temps qu'elle a mis (secondes), on en tient compte. */
export function recu(l: Lointain, x: number, v: number, retard: number, maintenant: number) {
  l.cible = x + v * Math.min(0.3, Math.max(0, retard))
  l.v = v
  l.vu = maintenant
}

/** Entre deux nouvelles : il avance à sa vitesse, et on rattrape doucement l'erreur. */
export function pasLointain(l: Lointain, dt: number) {
  l.cible += l.v * dt
  l.x += l.v * dt
  l.x += (l.cible - l.x) * Math.min(1, dt * 9)
}

/** La tolérance en plus quand on joue à distance : plus les nouvelles de l'autre mettent de temps, plus on est indulgent. */
export const margeDistance = (retard: number) => 8 + 60 * Math.min(0.4, Math.max(0, retard))

/** L'hôte : son porteur (derrière) avance chez lui, celui de l'invité est là où on le lui a dit. Renvoie sa secousse. */
export function pasHote(n: Niveau, g: Partie, appui: boolean, invite: Lointain, secousseInvite: number, dt: number, retard = 0.1): number {
  if (g.fin) return 0
  g.t += dt
  const s = pasPorteur(n, g.a, appui, g.t, dt)
  pasLointain(invite, dt)
  g.b.x = invite.x
  g.b.v = invite.v
  pasObjet(n, g, Math.max(s, secousseInvite), dt, margeDistance(retard))
  return s
}

/** L'invité : son porteur (devant) avance chez lui ; l'équilibre, c'est l'hôte qui le lui dit. Renvoie sa secousse. */
export function pasInvite(n: Niveau, g: Partie, appui: boolean, hote: Lointain, dt: number): number {
  if (g.fin) return 0
  g.t += dt
  const s = pasPorteur(n, g.b, appui, g.t, dt)
  pasLointain(hote, dt)
  g.a.x = hote.x
  g.a.v = hote.v
  return s
}

/** Où en est l'écran : on attend l'autre, on compte 3-2-1, on joue, c'est fini. */
export type Etape = 'attente' | 'decompte' | 'jeu' | 'fin' | 'parti'
type Salut = { t: 'hello'; who: string } | { t: 'bye'; who: string }
/** Ce que l'écran doit faire après une nouvelle ou un tour : (re)lancer un niveau, ou dire que l'autre est parti. */
export type Suite = { lancer?: number; parti?: boolean }

/**
 * Une partie « chacun sur son téléphone », vue d'un des deux téléphones : ce qu'il reçoit, ce qu'il envoie.
 * L'écran lui dit où il en est (`etape`) et l'appelle à chaque image ; elle fait avancer `g`.
 */
export class Seance {
  g: Partie = nouvellePartie()
  loin: Lointain
  /** le temps que met une nouvelle à arriver (secondes), mesuré par des allers-retours */
  retard = 0.1
  manche = 0
  private jRecu = 0
  private jMoi = 0
  private envoi = 0
  private ping = 0
  private pings = new Map<number, number>()
  private idPing = 0
  private salue = false
  private finDite: number[] | null = null

  constructor(
    readonly moi: string,
    readonly hote: boolean,
    private depart: number,
    private envoyer: (m: MsgPorte | Salut) => void,
  ) {
    this.loin = nouveauLointain(hote ? LONG : 0)
  }

  /** J'arrive sur le canal. */
  arrive() {
    this.envoyer({ t: 'hello', who: this.moi })
  }

  /** Je m'en vais. */
  part() {
    this.envoyer({ t: 'bye', who: this.moi })
  }

  private zero() {
    this.g = nouvellePartie()
    this.loin = nouveauLointain(this.hote ? LONG : 0)
    this.jRecu = this.jMoi = this.envoi = 0
    this.finDite = null
  }

  /** L'hôte (re)lance un niveau : il prévient l'invité, et l'écran compte 3, 2, 1. */
  relancer(n: number): Suite {
    this.depart = n
    this.zero()
    this.envoyer({ t: 'p-go', who: this.moi, n, m: ++this.manche })
    return { lancer: n }
  }

  /** Une nouvelle de l'autre téléphone. */
  recoit(e: MsgPorte | Salut, etape: Etape, maintenant: number): Suite {
    switch (e.t) {
      case 'hello':
        // l'invité est là : l'hôte lance le niveau choisi (une fois la partie lancée, un second salut ne la relance pas)
        if (this.hote) return etape === 'attente' ? this.relancer(this.depart) : {}
        // l'hôte vient d'arriver après nous : on lui redit qu'on est là
        if (!this.salue) {
          this.salue = true
          this.envoyer({ t: 'hello', who: this.moi })
        }
        return {}
      case 'p-go':
        if (this.hote || e.m === this.manche) return {}
        this.manche = e.m
        this.zero()
        return { lancer: Math.max(0, Math.min(NIVEAUX.length - 1, Math.round(e.n))) }
      case 'p-x':
        recu(this.loin, e.x, e.v, this.retard, maintenant)
        if (this.hote) this.jRecu = Math.max(this.jRecu, e.j ?? 0)
        else if (!this.g.fin) {
          this.g.w = e.w ?? this.g.w
          this.g.pic = e.pic ?? this.g.pic
        }
        return {}
      case 'p-fin':
        // (la fin d'une manche précédente, arrivée en retard, ne compte pas)
        if (this.hote || this.g.fin || e.m !== this.manche) return {}
        this.g.fin = e.r
        this.g.cause = e.cause
        this.g.pic = e.pic
        this.g.t = e.temps
        return {}
      case 'p-ping':
        this.envoyer({ t: 'p-pong', who: this.moi, id: e.id })
        return {}
      case 'p-pong': {
        const parti = this.pings.get(e.id)
        this.pings.delete(e.id)
        if (parti !== undefined) this.retard = this.retard * 0.6 + ((maintenant - parti) / 2000) * 0.4
        return {}
      }
      case 'bye':
        return etape === 'fin' ? {} : { parti: true }
    }
  }

  /** À chaque image : avancer (si on joue), donner de ses nouvelles, et remarquer si l'autre n'en donne plus. */
  tour(n: Niveau, appui: boolean, etape: Etape, maintenant: number, dt: number): Suite {
    const g = this.g
    if (etape === 'jeu' && !g.fin) {
      if (this.hote) {
        pasHote(n, g, appui, this.loin, this.jRecu, dt, this.retard)
        this.jRecu = 0
      } else this.jMoi = Math.max(this.jMoi, pasInvite(n, g, appui, this.loin, dt))
    }
    if (etape === 'jeu' || etape === 'decompte') {
      // huit fois par seconde ; et de temps en temps, on mesure le temps que mettent les nouvelles
      if (maintenant >= this.envoi) {
        this.envoi = maintenant + 125
        const moi = this.hote ? g.a : g.b
        const r = (v: number, k: number) => Math.round(v * k) / k
        this.envoyer({ t: 'p-x', who: this.moi, x: r(moi.x, 10), v: r(moi.v, 10), ...(this.jMoi ? { j: r(this.jMoi, 100) } : {}), ...(this.hote ? { w: r(g.w, 1000), pic: r(g.pic, 1000) } : {}) })
        this.jMoi = 0
      }
      if (maintenant >= this.ping) {
        this.ping = maintenant + 2000
        this.pings.set(++this.idPing, maintenant)
        this.envoyer({ t: 'p-ping', who: this.moi, id: this.idPing })
      }
    }
    // c'est fini : l'hôte le dit trois fois (si l'annonce se perdait, l'invité attendrait pour rien)
    if (this.hote && g.fin) {
      if (!this.finDite) this.finDite = [maintenant, maintenant + 350, maintenant + 1000]
      while (this.finDite.length && maintenant >= this.finDite[0]) {
        this.finDite.shift()
        this.envoyer({ t: 'p-fin', who: this.moi, m: this.manche, r: g.fin, cause: g.cause, temps: Math.round(g.t * 10) / 10, pic: Math.round(g.pic * 1000) / 1000 })
      }
    }
    // plus de nouvelles depuis longtemps : l'autre est parti (ou n'a plus de réseau)
    if (etape === 'jeu' && !this.loin.vu) this.loin.vu = maintenant
    if (etape === 'jeu' && !g.fin && maintenant - this.loin.vu > 5000) return { parti: true }
    return {}
  }
}

// « Nos adresses » (Elisa, 26 novembre : « pouvoir enregistrer des adresses → école, travail, pour qu'on puisse ne pas
// mettre l'adresse complète mais → école par exemple, dans la partie où est ma famille »). Un endroit de la famille a
// un nom, un point et un rayon : dans « Où est la famille », celui qui s'y trouve est « École » au lieu de « Rue André
// Lalande, Évry » ; dans l'agenda, on choisit « École » au lieu de taper l'adresse, et l'itinéraire mène au bon point.
// Rien de natif ni d'écran ici : testé à part (tests/endroits.test.mjs).
import { distance, libelle } from './positions'
import type { Endroit } from './types'

/** Le rayon d'un endroit, en mètres : une école et sa cour, un immeuble et son bout de rue. */
export const RAYON = 150
/** Une position floue (appli fermée, l'iPhone se repère aux antennes) peut tomber à côté : on lui laisse sa précision
 *  en plus du rayon, sans dépasser 200 m. La même règle est écrite en SQL pour les widgets (migration « endroits »). */
export const FLOU_MAX = 200
export const NOM_MAX = 30
/** Au plus 30 adresses par maison. */
export const ENDROITS_MAX = 30
/** Les noms qu'on propose d'un toucher. */
export const NOMS_COURANTS = ['Maison', 'École', 'Travail', 'Crèche', 'Sport', 'Chez Mamie']

/** Pour comparer deux noms ou deux adresses : sans accents, sans majuscules, sans ponctuation. */
export const cle = (x: string) =>
  x
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Le nom tel qu'on le garde : sans espaces en trop, 30 lettres au plus. */
export const nomPropre = (x: string) => x.replace(/\s+/g, ' ').trim().slice(0, NOM_MAX).trim()

/** Ce nom est déjà celui d'une autre adresse de la maison (« École » et « ecole » : le même). */
export const nomPris = (nom: string, endroits: readonly Endroit[], saufId?: string) => {
  const k = cle(nom)
  return !!k && endroits.some((e) => e.id !== saufId && cle(e.nom) === k)
}

/** Les noms courants qui ne sont pas encore pris. */
export const nomsLibres = (endroits: readonly Endroit[]) => NOMS_COURANTS.filter((n) => !nomPris(n, endroits))

type Point = { lat: number; lon: number }

/** L'endroit où se trouve une position : le plus proche parmi ceux dont elle est dans le rayon (null : aucun). */
export function endroitDe(p: Point & { precision_m?: number | null }, endroits: readonly Endroit[]): Endroit | null {
  const flou = Math.min(Math.max(p.precision_m ?? 0, 0), FLOU_MAX)
  let mieux: Endroit | null = null
  let pres = Infinity
  for (const e of endroits) {
    const d = distance(p, e)
    if (d <= e.rayon_m + flou && d < pres) {
      mieux = e
      pres = d
    }
  }
  return mieux
}

/** Ce qu'on lit sous un prénom : le nom de l'endroit où il est, sinon la rue et la ville. */
export const ouEst = (p: Point & { precision_m?: number | null; lieu: string | null; ville: string | null }, endroits: readonly Endroit[]) =>
  endroitDe(p, endroits)?.nom ?? libelle(p)

/** Une adresse précise commence par son numéro (« 15 Rue André Lalande, 91000 Évry-Courcouronnes ») : une rue seule
 *  est trop longue pour dire qu'on parle du même endroit. */
const precise = (adresse: string) => /^\d/.test(adresse.trim())

/** Le lieu d'un événement est-il une de nos adresses ? Par son nom (« École »), ou par son adresse écrite en entier. */
export function endroitNomme(texte: string | null | undefined, endroits: readonly Endroit[]): Endroit | null {
  const k = cle(texte ?? '')
  if (!k) return null
  return endroits.find((e) => cle(e.nom) === k) ?? endroits.find((e) => !!e.adresse && precise(e.adresse) && cle(e.adresse) === k) ?? null
}

/** Le lieu d'un événement tel qu'on l'affiche : le nom de l'adresse enregistrée (et son adresse en dessous), sinon
 *  ce qui a été écrit. */
export function lieuAffiche(texte: string, endroits: readonly Endroit[]): { titre: string; detail: string | null; endroit: Endroit | null } {
  const e = endroitNomme(texte, endroits)
  return e ? { titre: e.nom, detail: e.adresse, endroit: e } : { titre: texte, detail: null, endroit: null }
}

/** Pour le calendrier du téléphone et le partage, où le nom seul ne dit rien : « École, 3 rue des Écoles, Annecy »
 *  (et l'adresse seule quand elle commence déjà par le nom : « École Vaugelas, Avenue d'Albigny »). */
export function lieuComplet(texte: string, endroits: readonly Endroit[]): string {
  const e = endroitNomme(texte, endroits)
  if (!e) return texte
  if (!e.adresse) return e.nom
  return cle(e.adresse).startsWith(cle(e.nom)) ? e.adresse : `${e.nom}, ${e.adresse}`
}

/** Les adresses enregistrées dont le nom commence par (ou contient) ce qu'on tape ; rien de tapé : toutes. */
export function endroitsQuiCollent(q: string, endroits: readonly Endroit[]): Endroit[] {
  const k = cle(q)
  if (!k) return [...endroits]
  const debut = endroits.filter((e) => cle(e.nom).startsWith(k))
  const dedans = endroits.filter((e) => !debut.includes(e) && cle(e.nom).split(' ').some((m) => m.startsWith(k)))
  return [...debut, ...dedans]
}

/** L'image d'un endroit, devinée à son nom (« École » : un cartable, « Bureau de Papa » : une mallette). */
export type GenreEndroit = 'maison' | 'ecole' | 'creche' | 'travail' | 'sport' | 'musique' | 'sante' | 'courses' | 'transport' | 'nature' | 'famille' | 'autre'

// L'ordre compte : « École de danse » est du sport, « Assistante maternelle » une nounou, « Travail de Papa » un
// travail, « Maison de Mamie » la famille.
const GENRES: [GenreEndroit, RegExp][] = [
  ['musique', /\b(musique|conservatoire|solfege|piano|guitare|violon|batterie|chorale|chant)\b/],
  ['sport', /\b(sport|foot|football|judo|danse|piscine|gym|gymnase|tennis|basket|rugby|natation|stade|equitation|poney|karate|escalade|yoga|boxe|hand|handball|volley|athletisme|patinoire|skate|club|dojo)\b/],
  ['creche', /\b(creche|nounou|nourrice|garderie|assistante maternelle|baby sitter|babysitter)\b/],
  ['ecole', /\b(ecole|college|lycee|maternelle|primaire|fac|universite|campus|classe|periscolaire|centre de loisirs|centre aere|etude|internat|cantine)\b/],
  ['travail', /\b(travail|bureau|boulot|taf|job|boutique|cabinet|atelier|usine|entreprise|chantier|labo|agence|coworking)\b/],
  ['sante', /\b(medecin|docteur|pediatre|dentiste|hopital|clinique|orthophoniste|orthodontiste|kine|pharmacie|psy|veterinaire|ophtalmo)\b/],
  ['courses', /\b(courses|supermarche|marche|magasin|carrefour|leclerc|auchan|lidl|intermarche|monoprix|boulangerie|drive|centre commercial)\b/],
  ['transport', /\b(gare|arret|bus|metro|tram|station|aeroport|parking|rer)\b/],
  ['nature', /\b(parc|jardin|square|aire de jeux|foret|plage|lac|montagne|campagne|bois)\b/],
  ['famille', /\b(mamie|mamy|mami|meme|papi|papy|pepe|grand mere|grand pere|grands parents|tata|tatie|tonton|cousin|cousine|parrain|marraine|papa|maman|copain|copine)\b/],
  ['maison', /\b(maison|chez nous|chez moi|domicile|appart|appartement|home|nid)\b/],
  // « Chez Léa », « Chez les Martin » : quelqu'un qu'on aime bien
  ['famille', /^chez\b/],
]

export function genreEndroit(nom: string): GenreEndroit {
  const k = cle(nom)
  return GENRES.find(([, r]) => r.test(k))?.[0] ?? 'autre'
}

/** Deux écritures de la même adresse (la seconde a reçu son code postal, des accents, des virgules) : le point choisi
 *  pour la première vaut encore pour la seconde. */
export const memeAdresse = (a: string, b: string) => {
  const sansCp = (x: string) => cle(x.replace(/(^|\D)\d{5}(?=\D|$)/g, '$1'))
  return sansCp(a) === sansCp(b)
}

/** Le contour de la zone d'un endroit sur la carte : un cercle de `rayon` mètres (longitude d'abord, comme en GeoJSON). */
export function cercle(c: Point, rayon: number, cotes = 48): [number, number][] {
  const m = 111195 // mètres par degré de latitude
  const dLat = rayon / m
  const dLon = rayon / (m * Math.max(0.01, Math.cos((c.lat * Math.PI) / 180)))
  const pts: [number, number][] = []
  for (let i = 0; i <= cotes; i++) {
    const t = (i / cotes) * 2 * Math.PI
    pts.push([c.lon + dLon * Math.sin(t), c.lat + dLat * Math.cos(t)])
  }
  return pts
}

/** Les tailles de zone qu'on propose (en mètres) : une maison, un groupe scolaire, un campus. */
export const TAILLES = [
  { rayon: 100, label: 'Petite' },
  { rayon: RAYON, label: 'Moyenne' },
  { rayon: 300, label: 'Grande' },
] as const

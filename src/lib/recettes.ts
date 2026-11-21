// Les recettes dans la liste de courses : on choisit une recette, on dit pour combien de personnes (la famille,
// d'office ; les enfants comptent pour une plus petite part), et chaque ingrédient arrive dans la liste avec la
// bonne quantité, dans le format qu'on achète (100 g de pâtes × 4 = 400 g → 1 paquet de 500 g).

import { cle, ecrireQte, fiche, memeArticle, type Fiche } from './courses'
import { FORMATS, PIECES, PORTIONS, RECETTES } from './recettesDonnees'

export type Unite = 'g' | 'kg' | 'cl' | 'ml' | 'l' | 'pce' | 'tranche' | 'gousse' | 'botte' | 'rouleau' | 'boule' | 'pot' | 'cas' | 'cac'
export type Ingredient = { nom: string; qty?: number; unit?: Unite; placard?: boolean; base?: boolean; parTete?: boolean }
export type Categorie = 'quotidien' | 'weekend' | 'dessert' | 'fete' | 'liste'
export type Recette = { id: string; nom: string; cat: Categorie; parts: number | null; mois: number[]; emoji: string; mots: string[]; ingredients: Ingredient[] }

export const CATEGORIES: { key: Categorie; label: string }[] = [
  { key: 'quotidien', label: 'Du quotidien' },
  { key: 'weekend', label: 'Du week-end' },
  { key: 'dessert', label: 'Desserts et goûters' },
  { key: 'fete', label: 'Fêtes' },
  { key: 'liste', label: 'Listes' },
]

const RE_INGR = /^(.+?)(?:\s+(\d+(?:\.\d+)?)\s*(g|kg|cl|ml|l|pce|tranche|gousse|botte|rouleau|boule|pot|cas|cac))?((?:\s+[PBH])*)$/
function mois(t: string): number[] {
  const out = new Set<number>()
  for (const part of t.split(',')) {
    const [a, b] = part.trim().split('-').map(Number)
    if (!b) out.add(a)
    else for (let m = a; ; m = (m % 12) + 1) {
      out.add(m)
      if (m === b) break
    }
  }
  return [...out]
}

export const LES_RECETTES: Recette[] = RECETTES.trim()
  .split(/\n(?=# )/)
  .map((bloc) => {
    const [tete, ...lignes] = bloc.trim().split('\n')
    const [id, nom, cat, base, m, emoji, mots] = tete.replace(/^#\s*/, '').split('|').map((x) => x.trim())
    return {
      id,
      nom,
      cat: cat as Categorie,
      parts: base.startsWith('plat:') ? Number(base.slice(5)) : null,
      mois: mois(m),
      emoji,
      mots: (mots ?? '').split(',').map((x) => x.trim()).filter(Boolean),
      ingredients: lignes
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const r = RE_INGR.exec(l)!
          const drapeaux = r[4] ?? ''
          return { nom: r[1], qty: r[2] ? Number(r[2]) : undefined, unit: r[3] as Unite | undefined, placard: drapeaux.includes('P'), base: drapeaux.includes('B'), parTete: drapeaux.includes('H') }
        }),
    }
  })

type Format = { n: number; dim: 'g' | 'cl' | 'pce' | 'tranche' | 'gousse'; label: string; regle: 'sec' | 'frais' | 'creme' }
const LES_FORMATS = new Map<string, Format>(
  FORMATS.trim()
    .split('\n')
    .map((l) => {
      const [nom, c, label, regle] = l.split('|')
      const [n, dim] = c.split(' ')
      return [cle(nom), { n: Number(n), dim: dim as Format['dim'], label, regle: regle as Format['regle'] }]
    }),
)
const LES_PIECES = new Map<string, number>(PIECES.trim().split('\n').map((l) => [cle(l.split('|')[0]), Number(l.split('|')[1])]))
const formatDe = (nom: string, f: Fiche | null) => LES_FORMATS.get(cle(nom)) ?? (f ? LES_FORMATS.get(cle(f.nom)) : undefined)
const pieceDe = (nom: string, f: Fiche | null) => LES_PIECES.get(cle(nom)) ?? (f ? LES_PIECES.get(cle(f.nom)) : undefined)

// ───────── Pour combien de personnes ─────────

/** La famille : combien de personnes (les bébés ne comptent pas) et combien de « parts d'adulte ». */
export function portionsFamille(ages: number[]): { personnes: number; parts: number } {
  const coef = (a: number) => (a === 0 ? PORTIONS.adulte : a === 1 ? PORTIONS.ado : a === 2 ? PORTIONS.enfant : PORTIONS.bebe)
  const vrais = ages.filter((a) => coef(a) > 0)
  return { personnes: Math.max(1, vrais.length), parts: Math.max(1, vrais.reduce((s, a) => s + coef(a), 0)) }
}

// ───────── De la recette à la liste ─────────

export type Ligne = {
  nom: string
  /** ce qu'il faut pour la recette (« 350 g ») */
  besoin: string
  /** ce qu'on met dans la liste, dans l'unité de l'article (« 500 g », « 2 », « 1,5 kg ») */
  qte: string
  /** ce qu'on achète, en clair (« 1 paquet de 500 g ») */
  achat: string
  /** à acheter d'office ; sinon rangé dans « sûrement dans le placard » */
  coche: boolean
  placard: boolean
}

const nb = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${nb(n)} ${n > 1 ? motPluriel : mot}`
/** En grammes, centilitres ou pièces. */
function versBase(qty: number, unit: Unite): { n: number; dim: 'g' | 'cl' | 'pce' | 'tranche' | 'gousse' } {
  switch (unit) {
    case 'kg':
      return { n: qty * 1000, dim: 'g' }
    case 'g':
      return { n: qty, dim: 'g' }
    case 'l':
      return { n: qty * 100, dim: 'cl' }
    case 'ml':
      return { n: qty / 10, dim: 'cl' }
    case 'cas':
      return { n: qty * 1.5, dim: 'cl' }
    case 'cac':
      return { n: qty * 0.5, dim: 'cl' }
    case 'cl':
      return { n: qty, dim: 'cl' }
    case 'tranche':
      return { n: qty, dim: 'tranche' }
    case 'gousse':
      return { n: qty, dim: 'gousse' }
    default:
      return { n: qty, dim: 'pce' }
  }
}
function texteBesoin(n: number, dim: string, unit: Unite): string {
  if (dim === 'g') return n >= 1000 ? `${nb(n / 1000)} kg` : `${Math.round(n)} g`
  if (dim === 'cl') return n >= 100 ? `${nb(n / 100)} L` : `${nb(Math.round(n * 10) / 10)} cl`
  if (dim === 'tranche') return pluriel(Math.ceil(n), 'tranche')
  if (dim === 'gousse') return pluriel(Math.ceil(n), 'gousse')
  const mot = unit === 'rouleau' ? ['rouleau', 'rouleaux'] : unit === 'boule' ? ['boule', 'boules'] : unit === 'pot' ? ['pot', 'pots'] : unit === 'botte' ? ['botte', 'bottes'] : ['pièce', 'pièces']
  const arrondi = Math.ceil(n * 2) / 2
  return `${nb(arrondi)} ${arrondi > 1 ? mot[1] : mot[0]}`
}
const plafond = (x: number, pas: number) => Math.max(pas, Math.ceil(x / pas - 1e-9) * pas)

/** La meilleure combinaison de barquettes (350 g et 500 g de viande hachée) : au moins 90 % du besoin, le moins de surplus. */
function barquettes(g: number, tailles: number[]): number {
  let mieux = Infinity
  const viser = g * 0.9
  const essayer = (total: number, n: number) => {
    if (total >= viser) {
      if (total < mieux) mieux = total
      return
    }
    if (n >= 4) return
    for (const t of tailles) essayer(total + t, n + 1)
  }
  essayer(0, 0)
  return mieux === Infinity ? plafond(g, tailles[tailles.length - 1]) : mieux
}

/** Un ingrédient, pour tant de parts d'adulte (et tant de convives pour ce qui se sert à la pièce). */
export function ligneDe(ing: Ingredient, parts: number, convives: number): Ligne {
  const f = fiche(ing.nom)
  if (ing.qty === undefined || !ing.unit) return { nom: ing.nom, besoin: '', qte: '', achat: '', coche: !ing.placard, placard: !!ing.placard }
  const brut = versBase(ing.qty * (ing.parTete ? convives : parts), ing.unit)
  const besoin = texteBesoin(brut.n, brut.dim, ing.unit)
  // les produits de placard : sans quantité (on vérifie qu'il en reste)
  if (ing.placard) return { nom: ing.nom, besoin, qte: '', achat: '', coche: false, placard: true }
  // un peu de beurre, de lait, un ou deux œufs : on en a sûrement
  const peu = ing.base && ((brut.dim === 'g' && brut.n <= 30) || (brut.dim === 'cl' && brut.n <= 20) || (brut.dim === 'pce' && brut.n <= 2))
  const u = f?.u ?? ''
  const fmt = formatDe(ing.nom, f)
  const piece = pieceDe(ing.nom, f)
  let qte = ''
  let achat = besoin
  if (u === 'kg' || u === 'g') {
    // au poids : les pièces deviennent des grammes (1 oignon ≈ 100 g)
    const g = brut.dim === 'g' ? brut.n : brut.dim === 'cl' ? brut.n * 10 : brut.n * (piece ?? 100)
    if (u === 'kg') {
      const kg = plafond(g / 1000, f!.p)
      qte = ecrireQte({ n: kg, u: 'kg' })
    } else {
      const total = cle(ing.nom) === cle('viande hachée') || f?.nom === 'viande hachée' ? barquettes(g, [350, 500]) : plafond(g * 0.9, f!.p)
      qte = ecrireQte({ n: total, u: 'g' })
    }
    achat = qte
  } else if (u === 'tranche') {
    const n = plafond(brut.n, f!.p)
    qte = ecrireQte({ n, u: 'tranche' })
    achat = qte
  } else if (cle(ing.nom) === cle('œufs') || f?.nom === 'œufs') {
    const n = plafond(brut.n, 6)
    qte = String(n)
    achat = `${n} œufs`
  } else if (fmt && (fmt.dim === brut.dim || (fmt.dim === 'pce' && brut.dim === 'g' && piece) || (fmt.dim === 'g' && brut.dim === 'pce' && piece))) {
    // en paquets, pots, boîtes : combien de formats
    const besoinFmt = fmt.dim === brut.dim ? brut.n : fmt.dim === 'g' ? brut.n * piece! : brut.n / piece!
    const tolerance = fmt.regle === 'frais' ? 0.9 : fmt.regle === 'creme' ? 0.8 : 1
    const n = Math.max(1, Math.ceil((besoinFmt * tolerance) / fmt.n - 1e-9))
    qte = n === 1 ? '' : String(n)
    achat = n === 1 ? `1 ${fmt.label}` : `${n} × ${fmt.label}`
  } else {
    // à la pièce (citrons, poivrons, rouleaux de pâte, boules de mozzarella…), au pas de l'article (steaks par 2)
    const pieces = brut.dim === 'g' && piece ? brut.n / piece : brut.dim === 'g' || brut.dim === 'cl' ? 1 : brut.n
    const n = plafond(pieces, f && !f.u ? f.p : 1)
    qte = n === 1 ? '' : String(n)
    achat = brut.dim === 'g' || brut.dim === 'cl' ? (piece ? texteBesoin(n, 'pce', 'pce') : `${n}`) : texteBesoin(n, brut.dim, ing.unit)
  }
  return { nom: ing.nom, besoin, qte, achat, coche: !peu, placard: !!peu }
}

/** Toute la recette pour tant de personnes ; `ratio` : parts d'adulte par personne (les enfants mangent moins). */
export function lignesDe(r: Recette, personnes: number, ratio = 1): { lignes: Ligne[]; plats: number | null } {
  if (r.parts) {
    // un gâteau, une quiche : des plats entiers (chaque convive, enfant compris, compte pour une part)
    // (un convive de plus que les parts : un seul plat quand même, 7 pour une quiche de 6)
    const plats = Math.max(1, Math.ceil((personnes - 1) / r.parts))
    return { lignes: r.ingredients.map((i) => ligneDe(i, plats, plats)), plats }
  }
  const parts = Math.max(1, Math.ceil(personnes * ratio * 2 - 1e-9) / 2)
  return { lignes: r.ingredients.map((i) => ligneDe(i, parts, personnes)), plats: null }
}

// ───────── Trouver une recette ─────────

const sansArticle = (k: string) => k.replace(/^(?:soiree|repas|diner|dejeuner|menu|recette|pack|idee|pour une|pour un|pour de|pour le|pour la|pour|des|de la|du|une|un|le|la|les)\s+/, '')

/** Une recette reconnue dans ce qu'on tape : « bolognaise », « soirée raclette », « crêpes »… */
export function recetteDe(saisie: string): Recette | null {
  const k = sansArticle(sansArticle(cle(saisie)))
  if (k.length < 3) return null
  return LES_RECETTES.find((r) => cle(r.nom) === k || r.mots.some((m) => cle(m) === k)) ?? null
}

/** Les recettes qui commencent comme ce qu'on tape (pour la recherche). */
export function chercherRecettes(saisie: string): Recette[] {
  const k = cle(saisie)
  if (!k) return LES_RECETTES
  return LES_RECETTES.filter((r) => [r.nom, ...r.mots].some((x) => cle(x).includes(k)) || r.ingredients.some((i) => !i.placard && cle(i.nom).startsWith(k)))
}

/** Les recettes de saison (raclette en hiver, salade niçoise en été…), puis quelques classiques du quotidien. */
export function recettesDuMoment(d = new Date(), max = 6): Recette[] {
  const m = d.getMonth() + 1
  const saison = LES_RECETTES.filter((r) => r.mois.length < 12 && r.mois.includes(m) && r.cat !== 'liste').sort((a, b) => a.mois.length - b.mois.length)
  const classiques = ['Q01', 'Q05', 'Q02', 'D01', 'Q04', 'Q23', 'Q24', 'D04', 'Q11', 'Q10'].map((id) => LES_RECETTES.find((r) => r.id === id)!)
  const jour = Math.floor(d.getTime() / 86400000)
  const out: Recette[] = []
  for (const r of [...saison.slice(0, Math.ceil(max / 2)), ...classiques.map((_, i) => classiques[(i + jour) % classiques.length])]) if (!out.includes(r) && out.length < max) out.push(r)
  return out
}

/** Les recettes qu'on a presque déjà avec ce qu'il y a dans la liste (au moins deux ingrédients à acheter). */
export function recettesAvec(noms: string[], max = 2): { recette: Recette; ont: number; manque: number }[] {
  if (noms.length < 2) return []
  return LES_RECETTES.filter((r) => r.cat !== 'liste')
    .map((recette) => {
      const utiles = recette.ingredients.filter((i) => !i.placard && !i.base)
      const ont = utiles.filter((i) => noms.some((n) => memeArticle(n, i.nom) || (fiche(n) && fiche(n) === fiche(i.nom)))).length
      return { recette, ont, manque: utiles.length - ont, score: ont / Math.max(1, utiles.length) }
    })
    .filter((x) => x.ont >= 2 && x.manque > 0)
    .sort((a, b) => b.score - a.score || b.ont - a.ont)
    .slice(0, max)
    .map(({ recette, ont, manque }) => ({ recette, ont, manque }))
}

// Les courses, plus pratiques (Elisa, 21 novembre).
//
// • La quantité vit dans le nom de l'article, après un point médian : « Lait · 2 », « Farine · 500 g ». Rien ne change
//   dans la base, et le widget « À faire » l'affiche tel quel.
// • Chaque article est reconnu (environ 330 articles, leurs variantes, abréviations et marques) : son rayon,
//   son unité d'achat (kg, g, tranches, pièces…), sa quantité habituelle et le pas du − / + (« Œufs » : 12, de 6 en 6).
// • Ce qu'on tape se comprend : « 2 lait », « 500g de farine », « une douzaine d'œufs », « une livre de cerises »,
//   « jambon x4 », « 1,5 kg de pommes », « pq » (papier toilette).
// • Les idées : ce que la famille ajoute souvent (gardé sur l'appareil), ce qui va avec ce qui est déjà dans la liste
//   (environ 180 associations). Les recettes, avec leurs quantités pour la famille : recettes.ts.

import { ABREGES, ALIAS, ARTICLES, AVEC } from './coursesDonnees'

export type Article = { nom: string; qte: string }

const majuscule = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** « Lait · 2 » → { nom: 'Lait', qte: '2' } ; « Pain » → { nom: 'Pain', qte: '' } */
export function lireArticle(titre: string): Article {
  const i = titre.lastIndexOf(' · ')
  if (i > 0) return { nom: titre.slice(0, i).trim(), qte: titre.slice(i + 3).trim() }
  return { nom: titre.trim(), qte: '' }
}

/** { nom, qte } → « Lait · 2 » (sans quantité, ou « 1 », juste le nom) ; 80 caractères au plus (la base). */
export function ecrireArticle(a: Article): string {
  const q = a.qte.trim()
  const nom = a.nom.trim()
  return (q && q !== '1' ? `${nom} · ${q}` : nom).slice(0, 80)
}

const sansAccent = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
/** La forme qui sert à comparer : minuscules, sans accents, sans pluriel (« Œufs » → « oeuf », « Gâteaux » → « gateau »). */
export const cle = (nom: string) =>
  sansAccent(nom)
    .replace(/['’-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/(eau|eu|ou)x\b/g, '$1')
    .replace(/s\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// ───────── Le référentiel ─────────

export type Unite = '' | 'kg' | 'g' | 'l' | 'cl' | 'ml' | 'tranche' | 'douzaine' | (string & {})
export type Fiche = { nom: string; rayon: string; u: Unite; d: number; p: number }

const CODES: Record<string, string> = { FL: 'fruits', BOUL: 'boulangerie', VIA: 'boucherie', CREM: 'cremerie', EPS: 'epicerie', EPSU: 'sucre', BOI: 'boissons', BEBE: 'bebe', HYG: 'hygiene', ENT: 'maison', ANI: 'animaux', SURG: 'surgeles' }
const UNITES_REF: Record<string, Unite> = { kg: 'kg', g: 'g', l: 'l', tr: 'tranche', dz: 'douzaine', '': '' }

const FICHES = new Map<string, Fiche>()
for (const ligne of ARTICLES.trim().split('\n')) {
  const [nom, code, u, d, p] = ligne.split('|')
  FICHES.set(cle(nom), { nom, rayon: CODES[code] ?? 'autres', u: UNITES_REF[u] ?? '', d: Number(d), p: Number(p) })
}
const lireCorrespondances = (texte: string) => {
  const m = new Map<string, string>()
  for (const ligne of texte.trim().split('\n')) {
    const [gauche, droite] = ligne.split('=')
    for (const x of gauche.split(',')) m.set(cle(x), droite.trim())
  }
  return m
}
const ALIAS_MAP = lireCorrespondances(ALIAS)
const ABREGES_MAP = lireCorrespondances(ABREGES)
/** Toutes les façons connues de nommer un article, des plus longues aux plus courtes (« lait de coco » avant « lait »). */
const TOUTES: [string, Fiche][] = [
  ...[...FICHES].map(([k, f]) => [k, f] as [string, Fiche]),
  ...[...ALIAS_MAP, ...ABREGES_MAP].map(([k, v]) => [k, FICHES.get(cle(v))] as [string, Fiche | undefined]).filter((x): x is [string, Fiche] => !!x[1]),
].sort((a, b) => b[0].length - a[0].length)
const MOTS_SEULS = [...FICHES.keys()].filter((k) => !k.includes(' ') && k.length >= 5)

/** Distance d'édition (lettres ajoutées, retirées ou changées), arrêtée au-delà de `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let avant = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const ligne = [i]
    let mini = i
    for (let j = 1; j <= b.length; j++) {
      ligne[j] = Math.min(avant[j] + 1, ligne[j - 1] + 1, avant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      mini = Math.min(mini, ligne[j])
    }
    if (mini > max) return max + 1
    avant = ligne
  }
  return avant[b.length]
}
/** Une faute de frappe : une lettre d'écart (deux pour les mots de 7 lettres et plus) : « carrote » → carotte. */
const presque = (a: string, b: string) => distance(a, b, a.length >= 7 ? 2 : 1) <= (a.length >= 7 ? 2 : 1)

const cache = new Map<string, Fiche | null>()
/** Ce qu'on sait d'un article : son rayon, son unité, sa quantité habituelle, son pas.
 *  Les fautes de frappe ne se rattrapent que si aucun mot du rayon ne parle déjà (« croquettes » n'est pas « roquette »). */
export function fiche(nom: string): Fiche | null {
  const k = cle(nom)
  if (!k) return null
  if (cache.has(k)) return cache.get(k)!
  const f = ficheExacte(k) ?? (motDeRayon(k) ? null : ficheFloue(k))
  cache.set(k, f)
  return f
}
function ficheExacte(k: string): Fiche | null {
  let f: Fiche | null = FICHES.get(k) ?? null
  if (!f) {
    const v = ALIAS_MAP.get(k) ?? ABREGES_MAP.get(k)
    if (v) f = FICHES.get(cle(v)) ?? null
  }
  if (!f) {
    const n = ` ${k} `
    f = TOUTES.find(([c]) => n.includes(` ${c} `))?.[1] ?? null
  }
  return f
}
/** Le même article, écrit autrement (« Pommes » et « pomme », « PQ » et « Papier toilette », « Yaourts » et « Yaourt nature »). */
export function memeArticle(a: string, b: string): boolean {
  const x = cle(a)
  const y = cle(b)
  if (x === y) return true
  const fx = FICHES.get(x) ?? FICHES.get(cle(ALIAS_MAP.get(x) ?? ABREGES_MAP.get(x) ?? ''))
  return !!fx && fx === (FICHES.get(y) ?? FICHES.get(cle(ALIAS_MAP.get(y) ?? ABREGES_MAP.get(y) ?? '')))
}
function ficheFloue(k: string): Fiche | null {
  for (const mot of k.split(' ')) {
    if (mot.length < 5) continue
    const m = MOTS_SEULS.find((x) => presque(mot, x))
    if (m) return FICHES.get(m)!
  }
  return null
}

// ───────── Les rayons ─────────

export type Rayon = { key: string; label: string; emoji: string; mots: string[] }
/** Dans l'ordre d'un tour de magasin (les surgelés en dernier, pour garder le froid). Les mots : en secours,
 *  pour ce que le référentiel ne connaît pas (« tarte aux pommes » → fruits et légumes). */
export const RAYONS: Rayon[] = [
  { key: 'fruits', label: 'Fruits et légumes', emoji: '🍎', mots: ['fruit', 'legume', 'pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'raisin', 'tomate', 'salade', 'carotte', 'courgette', 'oignon', 'ail', 'champignon', 'chou', 'herbe', 'potiron', 'courge'] },
  { key: 'boulangerie', label: 'Boulangerie', emoji: '🥖', mots: ['pain', 'baguette', 'viennoiserie', 'wrap', 'tarte', 'gateau', 'brioche'] },
  { key: 'boucherie', label: 'Viande et poisson', emoji: '🥩', mots: ['viande', 'boeuf', 'porc', 'veau', 'agneau', 'canard', 'poisson', 'charcuterie', 'saucisse', 'filet', 'roti', 'bacon', 'escalope'] },
  { key: 'cremerie', label: 'Crèmerie', emoji: '🥛', mots: ['lait', 'fromage', 'yaourt', 'creme', 'oeuf', 'dessert', 'kefir'] },
  { key: 'epicerie', label: 'Épicerie salée', emoji: '🥫', mots: ['sauce', 'conserve', 'boite', 'epice', 'huile', 'pate', 'riz', 'apero', 'soupe', 'bocal'] },
  { key: 'sucre', label: 'Épicerie sucrée', emoji: '🍪', mots: ['chocolat', 'biscuit', 'gateau', 'gouter', 'cafe', 'the', 'sucre', 'bonbon', 'confiserie'] },
  { key: 'boissons', label: 'Boissons', emoji: '🧃', mots: ['eau', 'jus', 'boisson', 'vin', 'biere', 'limonade', 'sirop'] },
  { key: 'bebe', label: 'Bébé', emoji: '🍼', mots: ['bebe', 'tetine', 'biberon'] },
  { key: 'hygiene', label: 'Hygiène et beauté', emoji: '🧴', mots: ['savon', 'douche', 'shampoing', 'dent', 'deodorant', 'coton', 'rasoir', 'creme visage', 'maquillage', 'vernis', 'brosse'] },
  { key: 'maison', label: 'Entretien et maison', emoji: '🧽', mots: ['nettoyant', 'menage', 'lessive', 'vaisselle', 'poubelle', 'ampoule', 'pile', 'sac'] },
  { key: 'animaux', label: 'Animaux', emoji: '🐾', mots: ['chat', 'chien', 'croquette', 'litiere', 'patee', 'oiseau', 'poisson rouge'] },
  { key: 'surgeles', label: 'Surgelés', emoji: '🧊', mots: ['surgele', 'glace', 'congele'] },
]
export const AUTRES: Rayon = { key: 'autres', label: 'Autres', emoji: '🛒', mots: [] }

/** Le rayon d'un article : celui du référentiel, sinon le mot le plus long trouvé. */
export function rayonDe(nom: string): Rayon {
  const f = fiche(nom)
  if (f) return RAYONS.find((r) => r.key === f.rayon) ?? AUTRES
  return motDeRayon(cle(nom)) ?? AUTRES
}
/** Le rayon d'après le mot le plus long trouvé (« tarte aux pommes » → fruits et légumes). */
function motDeRayon(k: string): Rayon | null {
  const n = ` ${k} `
  let best: { r: Rayon; l: number } | null = null
  for (const r of RAYONS)
    for (const mot of r.mots) {
      const m = cle(mot)
      if (n.includes(` ${m}`) && (!best || m.length > best.l)) best = { r, l: m.length }
    }
  return best?.r ?? null
}

// ───────── Les quantités ─────────

export type Quantite = { n: number; u: Unite }
const MESURES = ['kg', 'g', 'l', 'cl', 'ml']
const SINGULIERS: Record<string, Unite> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramme: 'kg', kilogrammes: 'kg', g: 'g', gr: 'g', gramme: 'g', grammes: 'g',
  l: 'l', litre: 'l', litres: 'l', cl: 'cl', ml: 'ml', tranche: 'tranche', tranches: 'tranche', tr: 'tranche',
  douzaine: 'douzaine', douzaines: 'douzaine', piece: '', pieces: '', pièce: '', pièces: '', unite: '', unites: '', unité: '', unités: '',
  boite: 'boîte', boites: 'boîte', boîte: 'boîte', boîtes: 'boîte', bocal: 'bocal', bocaux: 'bocal', rouleau: 'rouleau', rouleaux: 'rouleau',
  tete: 'tête', tetes: 'tête', tête: 'tête', têtes: 'tête',
}
/** « bouteilles » → « bouteille », « kilos » → « kg » ; inconnu : null. */
function uniteDe(mot: string): Unite | null {
  const m = mot.toLowerCase().replace(/\.$/, '')
  if (m in SINGULIERS) return SINGULIERS[m]
  const s = m.replace(/s$/, '')
  if (/^(paquet|sachet|pot|brique|bouteille|canette|pack|lot|barquette|botte|filet|tube|flacon|tablette|plaquette|bidon|sac|boule|gousse|part|livre|verre|portion|pavé|pave|bouquet|carton|bombe|recharge|dosette|capsule)$/.test(s)) return s === 'pave' ? 'pavé' : s
  return null
}
const PLURIEL: Record<string, string> = { bocal: 'bocaux', rouleau: 'rouleaux', 'boîte': 'boîtes', 'tête': 'têtes' }
const pluriel = (u: string) => PLURIEL[u] ?? (/[sx]$/.test(u) ? u : `${u}s`)
const nombreTexte = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** « 1,5 kg », « 500 g », « 4 tranches », « 2 » ; vide : un seul. Ce qu'on ne sait pas lire : null. */
export function lireQte(qte: string): Quantite | null {
  const t = qte.trim()
  if (!t) return { n: 1, u: '' }
  const m = /^(\d+(?:[.,]\d+)?)\s*([a-zàâçéèêëîïôûü.]*)$/i.exec(t)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  if (!m[2]) return { n, u: '' }
  const u = uniteDe(m[2])
  return u === null ? null : { n, u }
}

export function ecrireQte(q: Quantite): string {
  const nb = nombreTexte(q.n)
  if (!q.u) return nb
  if (MESURES.includes(q.u)) return `${nb} ${q.u}`
  return `${nb} ${q.n > 1 ? pluriel(q.u) : q.u}`
}

/** La quantité en court, pour le − / + : « 1,5 kg », « 4 tr. », « 12 ». */
export function qteCourte(q: Quantite): string {
  const nb = nombreTexte(q.n)
  if (!q.u) return nb
  if (MESURES.includes(q.u)) return `${nb} ${q.u}`
  const court: Record<string, string> = { tranche: 'tr.', douzaine: 'douz.', bouteille: 'bout.', paquet: 'paq.', barquette: 'barq.', 'boîte': 'bte', sachet: 'sach.', brique: 'briq.', rouleau: 'roul.', plaquette: 'plaq.', tablette: 'tabl.', canette: 'can.' }
  return `${nb} ${court[q.u] ?? (q.n > 1 ? pluriel(q.u) : q.u)}`
}

/** De combien monte et descend le − / + : celui de l'article (œufs : 6, pommes : 0,5 kg), sinon selon l'unité. */
export function pasDe(nom: string, q: Quantite): number {
  const f = fiche(nom)
  if (f && f.u === q.u) return f.p
  switch (q.u) {
    case 'kg':
    case 'l':
      return 0.5
    case 'g':
      return q.n <= 250 ? 50 : q.n <= 1000 ? 100 : 250
    case 'cl':
      return 25
    case 'ml':
      return 50
    case 'tranche':
      return 2
    default:
      return 1
  }
}
const MAX: Record<string, number> = { kg: 50, g: 20000, l: 50, cl: 500, ml: 5000 }
/** + : la quantité suivante (texte). */
export function plusUn(nom: string, qte: string): string | null {
  const q = lireQte(qte)
  if (!q) return null
  const n = Math.min(MAX[q.u] ?? 99, Math.round((q.n + pasDe(nom, q)) * 100) / 100)
  return ecrireQte({ n, u: q.u })
}
/** − : la quantité d'avant, ou null quand il n'y en aurait plus (on retire alors l'article). */
export function moinsUn(nom: string, qte: string): string | null {
  const q = lireQte(qte)
  if (!q) return null
  const pas = pasDe(nom, q)
  // en dessous d'un pas (6 œufs, 0,5 kg, 1 paquet) : l'article part de la liste
  let n = Math.round((q.n - pas) * 100) / 100
  if (n < pas - 1e-9) {
    if (q.n > pas + 1e-9) n = pas
    else return null
  }
  return ecrireQte({ n, u: q.u })
}

/** Une quantité qu'on peut faire monter et descendre d'un toucher : un nombre seul (« 2 »), ou rien (1). */
export function nombre(qte: string): number | null {
  if (!qte) return 1
  return /^\d+$/.test(qte) ? Number(qte) : null
}

/** Deux quantités du même article, additionnées (500 g + 1 kg = 1 500 g). null : unités qui ne s'ajoutent pas. */
export function additionner(a: string, b: string): string | null {
  const x = lireQte(a)
  const y = lireQte(b)
  if (!x || !y) return null
  const base: Record<string, [string, number]> = { kg: ['g', 1000], g: ['g', 1], l: ['ml', 1000], cl: ['ml', 10], ml: ['ml', 1] }
  if (x.u === y.u) return ecrireQte({ n: Math.round((x.n + y.n) * 100) / 100, u: x.u })
  const bx = base[x.u]
  const by = base[y.u]
  if (bx && by && bx[0] === by[0]) {
    const total = x.n * bx[1] + y.n * by[1]
    return ecrireQte({ n: Math.round((total / bx[1]) * 100) / 100, u: x.u })
  }
  return null
}

// ───────── Comprendre ce qu'on tape ─────────

const NOMBRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30 }
const MOT_UNITE = '(?:kg|kilos?|kilogrammes?|g|gr|grammes?|l|litres?|cl|ml|paquets?|sachets?|bo[iî]tes?|pots?|briques?|bouteilles?|canettes?|packs?|lots?|barquettes?|bottes?|filets?|tranches?|rouleaux?|tubes?|flacons?|bocal|bocaux|tablettes?|plaquettes?|bidons?|sacs?|boules?|t[eê]tes?|gousses?|parts?|pi[eè]ces?|unit[eé]s?|douzaines?|livres?|verres?|portions?|pav[eé]s?|bouquets?|cartons?)'
// un nombre, puis une unité collée ou non (« 500g », « 2 kg ») ou un espace ; « 2 lait » n'est pas « 2 l » de « ait »
const RE_DEBUT = new RegExp(`^(\\d+(?:[.,]\\d+)?)(?:\\s*(${MOT_UNITE})\\.?(?=\\s|d['’]|$)|(?=\\s))\\s*(?:de\\s+|d['’]\\s*|des\\s+|du\\s+)?(.+)$`, 'i')
const RE_FIN = new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${MOT_UNITE})\\.?$`, 'i')
const RE_FOIS = /(?:^|\s)(?:[x×*]\s?(\d+)|(\d+)\s?[x×*]|\((\d+)\)|(\d+)\s?fois)(?=\s|$)/i
const RE_PACK = /(\d+)\s?[x×]\s?(\d+(?:[.,]\d+)?)\s?(l|cl|g|kg)\b/i

/** Ce qu'on tape : « 2 lait », « 500g de farine », « œufs x6 », « une douzaine d'œufs » → le nom et la quantité. */
export function comprendre(saisie: string): Article {
  let t = saisie.trim().replace(/\s+/g, ' ')
  const deja = lireArticle(t)
  if (deja.qte) return { nom: majuscule(deja.nom), qte: deja.qte }
  // « pack 6x1,5L » : le format reste dans le nom
  if (RE_PACK.test(t)) return { nom: majuscule(t.replace(RE_PACK, (_, a, b, u) => `${a} × ${b.replace('.', ',')} ${u.toUpperCase() === 'L' ? 'L' : u}`)), qte: '' }
  // les façons de dire une quantité, ramenées à des chiffres
  t = t
    .replace(/^(?:un |une )?demi[- ]kilos?\b/i, '0,5 kg')
    .replace(/^1\/2\s*(kg|l)\b/i, '0,5 $1')
    .replace(/^(?:une )?demi[- ]douzaines?\b/i, '0,5 douzaine')
    .replace(/^(\d+)\s+ou\s+(\d+)\b/, '$2')
    .replace(/^(?:quelques|des|du|de la|les|le|la)\s+|^(?:de l|l)['’]\s*/i, '')
  const mot = /^([a-zéè]+)\b/i.exec(t)?.[1]?.toLowerCase()
  if (mot && mot in NOMBRES && t.length > mot.length + 1) t = `${NOMBRES[mot]}${t.slice(mot.length)}`
  // un multiplicateur : x2, 2x, ×2, (2), 2 fois
  let fois = 1
  const f = RE_FOIS.exec(t)
  if (f) {
    fois = Number(f[1] ?? f[2] ?? f[3] ?? f[4])
    t = (t.slice(0, f.index) + t.slice(f.index + f[0].length)).trim()
  }
  let nom = t
  let q: Quantite | null = null
  let m = RE_DEBUT.exec(t)
  if (m && !/^\d+\s*(?:ans?|h|min)\b/i.test(t)) {
    nom = m[3]
    q = { n: Number(m[1].replace(',', '.')), u: m[2] ? (uniteDe(m[2]) ?? '') : '' }
  } else if ((m = RE_FIN.exec(t))) {
    nom = m[1]
    q = { n: Number(m[2].replace(',', '.')), u: uniteDe(m[3]) ?? '' }
  }
  // « lait 2 » : un petit nombre à la fin d'un article connu
  if (!q && fois === 1) {
    const fin = /^(.+?)\s+(\d{1,2})$/.exec(nom)
    if (fin && Number(fin[2]) >= 1 && ficheExacte(cle(fin[1]))) {
      nom = fin[1]
      q = { n: Number(fin[2]), u: '' }
    }
  }
  nom = nom.replace(/^(?:de |d['’]|des |du )/i, '').trim()
  // les abréviations : « pq » → « Papier toilette »
  const long = ABREGES_MAP.get(cle(nom))
  if (long) nom = long
  // un nombre seul pour ce qui s'achète en tranches (« jambon x4 ») : des tranches
  const parTranches = fiche(nom)?.u === 'tranche'
  if (q) {
    // une livre = 500 g ; une douzaine = 12 (sauf pour ce qui se compte à la douzaine : les huîtres)
    if (q.u === 'livre') q = { n: q.n * 500, u: 'g' }
    if (q.u === 'douzaine' && fiche(nom)?.u !== 'douzaine') q = { n: q.n * 12, u: '' }
    q = { n: q.n * fois, u: !q.u && parTranches ? 'tranche' : q.u }
  } else if (fois > 1) q = { n: fois, u: parTranches ? 'tranche' : '' }
  if (!nom) return { nom: majuscule(t), qte: '' }
  // « un paquet », « une bouteille » : un seul, ça va sans dire
  const seul = q && q.n === 1 && !MESURES.includes(q.u) && q.u !== 'tranche' && q.u !== 'douzaine'
  return { nom: majuscule(nom), qte: q && !seul ? ecrireQte(q) : '' }
}

/** Sans quantité tapée : la quantité habituelle de l'article (« Œufs » → 12, « Pommes » → 1 kg, « Jambon » → 4 tranches). */
export function completer(a: Article): Article {
  if (a.qte) return a
  const f = fiche(a.nom)
  if (!f || (f.d === 1 && !f.u)) return a
  return { nom: a.nom, qte: ecrireQte({ n: f.d, u: f.u }) }
}

// ───────── Ce qui va avec ─────────

const AVEC_MAP = new Map<string, string[]>(
  AVEC.trim()
    .split('\n')
    .map((l) => {
      const [k, v] = l.split('=')
      return [cle(k), v.split(',').map((x) => x.trim())]
    }),
)

/** Les idées « pour aller avec » ce qu'il y a déjà dans la liste (les derniers ajoutés d'abord ; pas ce qui y est déjà). */
export function pourAllerAvec(noms: string[], max = 2): { avec: string; idees: string[] }[] {
  const presents = new Set<string>()
  for (const n of noms) {
    presents.add(cle(n))
    const f = fiche(n)
    if (f) presents.add(cle(f.nom))
  }
  const tout = ` ${noms.map(cle).join(' ')} `
  const deja = (x: string) => {
    const k = cle(x)
    const f = fiche(x)
    return presents.has(k) || (!!f && presents.has(cle(f.nom))) || tout.includes(` ${k} `)
  }
  const vus = new Set<string>()
  const out: { avec: string; idees: string[] }[] = []
  for (const nom of [...noms].reverse()) {
    const f = fiche(nom)
    const idees = AVEC_MAP.get(cle(f?.nom ?? nom)) ?? AVEC_MAP.get(cle(nom)) ?? []
    const reste = idees.filter((x) => !deja(x) && !vus.has(cle(x))).slice(0, 4)
    if (!reste.length) continue
    reste.forEach((x) => vus.add(cle(x)))
    out.push({ avec: nom, idees: reste })
    if (out.length >= max) break
  }
  return out
}

// ───────── Ce que la famille ajoute souvent ─────────

export const IDEES_COURSES = ['Pain', 'Lait', 'Œufs', 'Fruits', 'Légumes', 'Beurre', 'Fromage', 'Yaourts', 'Café', 'Pâtes', 'Riz', 'Papier toilette', 'Lessive']

type Histo = Record<string, { nom: string; n: number; le: number }>
const HISTO = (famille: string) => `nidoo.courses.${famille}`

function lireHisto(famille: string): Histo {
  try {
    return JSON.parse(localStorage.getItem(HISTO(famille)) ?? '{}') as Histo
  } catch {
    return {}
  }
}

/** On retient ce que la famille ajoute (sur cet appareil), pour le proposer en premier. */
export function retenir(famille: string, nom: string) {
  const h = lireHisto(famille)
  const k = cle(nom)
  if (!k) return
  h[k] = { nom, n: (h[k]?.n ?? 0) + 1, le: Date.now() }
  try {
    localStorage.setItem(HISTO(famille), JSON.stringify(h))
  } catch {
    /* sans conséquence */
  }
}

/** Les idées du moment : d'abord ce qu'on ajoute souvent (et ce qui vient d'être acheté), puis les classiques. */
export function souvent(famille: string, dansLaListe: string[], achetes: string[], max = 10): string[] {
  const presents = new Set(dansLaListe.flatMap((n) => [cle(n), cle(fiche(n)?.nom ?? n)]))
  const h = lireHisto(famille)
  const frequents = Object.values(h)
    .sort((a, b) => b.n - a.n || b.le - a.le)
    .map((x) => x.nom)
  const out: string[] = []
  for (const nom of [...frequents, ...achetes, ...IDEES_COURSES]) {
    const k = cle(nom)
    if (!k || presents.has(k) || presents.has(cle(fiche(nom)?.nom ?? nom)) || out.some((x) => cle(x) === k)) continue
    out.push(nom)
    if (out.length >= max) break
  }
  return out
}

// ───────── L'émoji d'un article (les tuiles de suggestions) ─────────

/** Un émoji par article courant (clé « à la cle() » → émoji) ; sinon celui de son rayon. */
const EMOJIS: [string, string][] = ([
  ['pain de mie', '🍞'], ['pain', '🥖'], ['baguette', '🥖'], ['brioche', '🍞'], ['croissant', '🥐'], ['viennoiserie', '🥐'], ['wrap', '🌯'], ['tortilla', '🌮'],
  ['lait', '🥛'], ['oeuf', '🥚'], ['beurre', '🧈'], ['fromage', '🧀'], ['mozzarella', '🧀'], ['parmesan', '🧀'], ['emmental', '🧀'], ['raclette', '🧀'], ['yaourt', '🥄'], ['creme', '🥛'],
  ['poulet', '🍗'], ['dinde', '🍗'], ['viande hachee', '🥩'], ['steak', '🥩'], ['boeuf', '🥩'], ['veau', '🥩'], ['porc', '🥩'], ['agneau', '🥩'], ['jambon', '🍖'], ['lardon', '🥓'], ['bacon', '🥓'],
  ['saucisse', '🌭'], ['merguez', '🌭'], ['saumon', '🐟'], ['thon', '🐟'], ['poisson', '🐟'], ['crevette', '🦐'], ['moule', '🦪'], ['huitre', '🦪'],
  ['pate', '🍝'], ['spaghetti', '🍝'], ['lasagne', '🍝'], ['riz', '🍚'], ['farine', '🌾'], ['semoule', '🌾'], ['cereale', '🥣'], ['sucre', '🍬'], ['sel', '🧂'], ['poivre', '🧂'],
  ['huile', '🫒'], ['olive', '🫒'], ['vinaigre', '🫙'], ['moutarde', '🫙'], ['mayonnaise', '🫙'], ['ketchup', '🍅'], ['sauce tomate', '🥫'], ['tomate concassee', '🥫'], ['conserve', '🥫'],
  ['haricot', '🫘'], ['lentille', '🫘'], ['pois chiche', '🫘'], ['sauce soja', '🍶'], ['bouillon', '🍲'], ['epice', '🌶️'], ['piment', '🌶️'], ['herbe', '🌿'], ['basilic', '🌿'], ['persil', '🌿'],
  ['tomate', '🍅'], ['carotte', '🥕'], ['pomme de terre', '🥔'], ['oignon', '🧅'], ['ail', '🧄'], ['echalote', '🧅'], ['salade', '🥬'], ['poireau', '🥬'], ['chou', '🥬'], ['epinard', '🥬'],
  ['concombre', '🥒'], ['courgette', '🥒'], ['poivron', '🫑'], ['aubergine', '🍆'], ['champignon', '🍄'], ['brocoli', '🥦'], ['mai', '🌽'], ['avocat', '🥑'], ['potiron', '🎃'], ['courge', '🎃'],
  ['gingembre', '🫚'], ['citron', '🍋'], ['pomme', '🍎'], ['poire', '🍐'], ['banane', '🍌'], ['orange', '🍊'], ['clementine', '🍊'], ['mandarine', '🍊'], ['fraise', '🍓'], ['raisin', '🍇'],
  ['cerise', '🍒'], ['peche', '🍑'], ['abricot', '🍑'], ['ananas', '🍍'], ['mangue', '🥭'], ['kiwi', '🥝'], ['melon', '🍈'], ['pasteque', '🍉'], ['noix de coco', '🥥'], ['fruit', '🍎'], ['legume surgele', '🥦'], ['legume', '🥕'],
  ['cafe', '☕'], ['the', '🍵'], ['chocolat', '🍫'], ['biscuit', '🍪'], ['cookie', '🍪'], ['gateau', '🍰'], ['miel', '🍯'], ['confiture', '🍯'], ['pate a tartiner', '🍫'], ['bonbon', '🍬'], ['chip', '🥔'],
  ['noix', '🥜'], ['cacahuete', '🥜'], ['amande', '🥜'], ['glace', '🍨'], ['pizza', '🍕'], ['frite', '🍟'], ['surgele', '🧊'],
  ['eau', '💧'], ['jus', '🧃'], ['soda', '🥤'], ['coca', '🥤'], ['biere', '🍺'], ['vin', '🍷'], ['champagne', '🍾'], ['sirop', '🧃'],
  ['lessive', '🧺'], ['adoucissant', '🧺'], ['liquide vaisselle', '🧽'], ['pastille lave vaisselle', '🧽'], ['eponge', '🧽'], ['papier toilette', '🧻'], ['essuie tout', '🧻'], ['mouchoir', '🧻'], ['sac poubelle', '🗑️'],
  ['savon', '🧼'], ['gel douche', '🧴'], ['shampoing', '🧴'], ['dentifrice', '🪥'], ['brosse a dent', '🪥'], ['coton', '☁️'], ['couche', '👶'], ['lingette', '🧻'], ['petit pot', '🍼'], ['lait infantile', '🍼'],
  ['croquette', '🐾'], ['patee', '🐾'], ['litiere', '🐈'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length)

export function emojiDe(nom: string): string {
  const k = cle(fiche(nom)?.nom ?? nom)
  const kk = cle(nom)
  const debut = (x: string, m: string) => x === m || x.startsWith(m + ' ')
  for (const [m, e] of EMOJIS) if (debut(k, m) || debut(kk, m)) return e
  return rayonDe(nom).emoji
}

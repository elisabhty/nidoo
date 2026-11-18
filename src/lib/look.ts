// Les personnages de la famille : un même visage pour tous, et ce qui rend chacun unique
// (peau, coupe, couleur de cheveux, yeux, lunettes, barbe, grain de beauté, taches de rousseur…).
// Le personnage est rangé dans le champ « avatar » du membre, sous la forme « perso:s2.h5.c3… ».

export const SKINS = ['#FFE6D5', '#F8D3B8', '#EDBB95', '#D69D74', '#B47852', '#8C5A3B', '#5F3C27']
export const HAIR_COLORS: { key: string; label: string; hex: string }[] = [
  { key: 'noir', label: 'Noir', hex: '#2A2224' },
  { key: 'brun', label: 'Brun', hex: '#4B3022' },
  { key: 'chatain', label: 'Châtain', hex: '#7B4E2F' },
  { key: 'blond', label: 'Blond', hex: '#D9AE55' },
  { key: 'platine', label: 'Blond clair', hex: '#EED9A0' },
  { key: 'roux', label: 'Roux', hex: '#C2542A' },
  { key: 'gris', label: 'Gris', hex: '#A9A4AF' },
  { key: 'blanc', label: 'Blanc', hex: '#EEEAF0' },
  { key: 'rose', label: 'Rose', hex: '#EE9BB8' },
  { key: 'bleu', label: 'Bleu nuit', hex: '#3E4C8A' },
]
export const EYES = ['#5A3A22', '#8A6236', '#4C8A5B', '#3E7CC9', '#7B8794', '#2A2230']
export const TOPS = ['#8E6FF0', '#F58B5C', '#5FB277', '#5AA3E0', '#E77BA0', '#F2B33D', '#3B3355', '#F4F1F9']

export const HAIRSTYLES: { key: string; label: string }[] = [
  { key: 'court', label: 'Court' },
  { key: 'raie', label: 'Raie sur le côté' },
  { key: 'boucles', label: 'Bouclés courts' },
  { key: 'longs', label: 'Longs' },
  { key: 'bouclesLongs', label: 'Bouclés longs' },
  { key: 'carre', label: 'Carré' },
  { key: 'chignon', label: 'Chignon' },
  { key: 'queue', label: 'Queue de cheval' },
  { key: 'tresses', label: 'Tresses' },
  { key: 'afro', label: 'Afro' },
  { key: 'rase', label: 'Rasés' },
  { key: 'chauve', label: 'Sans cheveux' },
  { key: 'meche', label: 'Petite mèche' },
]
/** Taille : les grands, les moyens, les petits. */
export const AGES = ['Adulte', 'Ado', 'Enfant', 'Bébé']
/** Largeur relative dans la maison : un bébé est bien plus petit qu'un adulte. */
export const AGE_SCALE = [1, 0.94, 0.82, 0.7]
export const GLASSES = ['Sans', 'Rondes', 'Carrées', 'Soleil']
export const BEARDS = ['Sans', 'Courte', 'Moustache', 'Longue']
export const MOLES = ['Sans', 'Joue gauche', 'Joue droite', 'Au-dessus de la lèvre']
/** Les accessoires achetés à la boutique du centre commercial (clé « mode:<nom> »). */
export const ACCESSORIES = ['', 'bonnet', 'casquette', 'paille', 'fleurs', 'echarpe', 'lunettes', 'couronne', 'noeud', 'boucles', 'manteau', 'bottes', 'baskets', 'fourrure', 'trench', 'blazer', 'robe', 'jupe', 'short', 'colroule', 'chemise', 'mariniere', 'torsade', 'sweat', 'gilet', 'montre', 'jean']

/** Où se porte chaque chose de la boutique : une place par type, pour en porter plusieurs à la fois
 *  (un bonnet, une écharpe, une veste, une jupe et des bottes). Chaque place garde le numéro de l'objet
 *  dans ACCESSORIES (0 : rien). La robe prend la place du haut et du bas. */
export const PLACES = {
  T: ['bonnet', 'casquette', 'paille', 'fleurs', 'couronne', 'noeud'], // la tête
  Y: ['lunettes'], // les yeux
  O: ['boucles'], // les oreilles
  C: ['echarpe'], // le cou
  P: ['montre'], // le poignet
  H: ['colroule', 'chemise', 'mariniere', 'torsade', 'sweat', 'gilet'], // le haut
  R: ['robe'], // la robe (haut et bas)
  V: ['manteau', 'fourrure', 'trench', 'blazer'], // la veste, par-dessus
  B: ['jupe', 'short', 'jean'], // le bas
  S: ['bottes', 'baskets'], // les chaussures
} as const
export type Place = keyof typeof PLACES
export const ORDRE_PLACES = Object.keys(PLACES) as Place[]
export const placeDe = (acc: string): Place | null => ORDRE_PLACES.find((pl) => (PLACES[pl] as readonly string[]).includes(acc)) ?? null
/** Ce qui est porté à une place ('' : rien). */
export const porteA = (look: Look, pl: Place) => ACCESSORIES[look[pl] ?? 0] ?? ''
/** Tout ce qu'on porte. */
export const portes = (look: Look) => ORDRE_PLACES.map((pl) => porteA(look, pl)).filter(Boolean)
/** Mettre un objet : il prend sa place (la robe libère le haut et le bas, et inversement). */
export function mettre(look: Look, acc: string): Look {
  const pl = placeDe(acc)
  if (!pl) return look
  const out: Look = { ...look, v: 0, [pl]: ACCESSORIES.indexOf(acc) }
  if (pl === 'R') out.H = out.B = 0
  if (pl === 'H' || pl === 'B') out.R = 0
  return out
}
export function enlever(look: Look, acc: string): Look {
  const pl = placeDe(acc)
  return pl && porteA(look, pl) === acc ? { ...look, v: 0, [pl]: 0 } : look
}
export const toutEnlever = (look: Look): Look => ({ ...look, v: 0, ...Object.fromEntries(ORDRE_PLACES.map((pl) => [pl, 0])) })

export type Look = {
  s: number // peau
  h: number // coupe
  c: number // couleur des cheveux
  e: number // yeux
  g: number // lunettes
  b: number // barbe
  m: number // grain de beauté
  f: number // taches de rousseur
  o: number // boucles d'oreilles
  l: number // rouge à lèvres
  t: number // haut
  a: number // taille : adulte, ado, enfant, bébé
  p: number // tétine (bébé)
  v?: number // accessoire de la boutique (0 : aucun)
  k?: number // la figurine choisie (1…), 0 : celle qui ressemble le plus à l'ancien personnage dessiné
  // personnaliser la figurine (0 : comme elle est)
  q?: number // couleur de peau : 0 = la sienne, sinon le numéro de l’image (<id>-t<q>.webp, voir peaux.ts)
  x?: number // couleur des cheveux ou du voile
  y?: number // couleur des yeux
  n?: number // nez
  u?: number // bouche
  j?: number // lunettes
  w?: number // couleur des lunettes
  z?: number // blush
  d?: number // fossettes
  // ce qu'on porte, une place par type (voir PLACES)
  T?: number
  Y?: number
  O?: number
  C?: number
  P?: number
  H?: number
  R?: number
  V?: number
  B?: number
  S?: number
  // la silhouette, réglée au curseur (0 : comme la figurine ; 1 à 9, 5 au milieu)
  G?: number // la taille : plus petite … plus grande
  L?: number // la carrure : fine … tout en rondeur
}

/** Combien la taille agrandit (ou réduit) le personnage dans la maison : de -14 % à +14 %. */
export const echelleTaille = (l: Pick<Look, 'G'>) => 1 + ((l.G || 5) - 5) * 0.035
/** Combien la carrure élargit le personnage : de -12 % à +12 % en largeur. */
export const echelleCarrure = (l: Pick<Look, 'L'>) => 1 + ((l.L || 5) - 5) * 0.03
const KEYS: (keyof Look)[] = ['s', 'h', 'c', 'e', 'g', 'b', 'm', 'f', 'o', 'l', 't', 'a', 'p', 'v', 'k', 'q', 'x', 'y', 'n', 'u', 'j', 'w', 'z', 'd', 'T', 'Y', 'O', 'C', 'P', 'H', 'R', 'V', 'B', 'S', 'G', 'L']
/** Les champs de l'ancien personnage dessiné : inutiles une fois la figurine choisie. */
const LEGACY: (keyof Look)[] = ['s', 'h', 'c', 'e', 'g', 'b', 'm', 'o', 't', 'p']
const MAX: Required<Look> = { s: SKINS.length, h: HAIRSTYLES.length, c: HAIR_COLORS.length, e: EYES.length, g: GLASSES.length, b: BEARDS.length, m: MOLES.length, f: 2, o: 2, l: 6, t: TOPS.length, a: AGES.length, p: 2, v: ACCESSORIES.length, k: 256, q: 9, x: 12, y: 7, n: 4, u: 5, j: 4, w: 6, z: 3, d: 2, T: ACCESSORIES.length, Y: ACCESSORIES.length, O: ACCESSORIES.length, C: ACCESSORIES.length, P: ACCESSORIES.length, H: ACCESSORIES.length, R: ACCESSORIES.length, V: ACCESSORIES.length, B: ACCESSORIES.length, S: ACCESSORIES.length, G: 10, L: 10 }

export const encodeLook = (l: Look) =>
  `perso:${KEYS.filter((k) => !(l.k && LEGACY.includes(k)) && (k.match(/[qxynujwzdA-Z]/) ? l[k] : true))
    .map((k) => `${k}${l[k] ?? 0}`)
    .join('.')}`

/** Lit un personnage ; un ancien avatar (animal) devient un personnage stable tiré de son identifiant. */
export function lookOf(avatar: string | undefined, seed = ''): Look {
  if (avatar?.startsWith('perso:')) {
    // les champs ajoutés plus tard (taille, tétine) valent « adulte, sans » par défaut
    const out: Look = { ...randomLook(avatar), a: 0, p: 0, v: 0, k: 0, l: 0, f: 0 }
    for (const part of avatar.slice(6).split('.')) {
      const k = part[0] as keyof Look
      const v = Number(part.slice(1))
      if (KEYS.includes(k) && Number.isInteger(v) && v >= 0 && v < MAX[k]) out[k] = v
    }
    // l'ancien accessoire unique (v) prend sa place
    if (out.v) {
      const acc = ACCESSORIES[out.v]
      const pl = placeDe(acc)
      if (pl && !out[pl]) Object.assign(out, mettre(out, acc))
      out.v = 0
    }
    return out
  }
  return randomLook(`${avatar ?? ''}${seed}`)
}

/** Un personnage au hasard ; avec une graine, toujours le même. */
export function randomLook(seed?: string): Look {
  let x = seed ? [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 2166136261) : (Math.random() * 4294967296) >>> 0
  const r = (n: number) => {
    x = (x * 1664525 + 1013904223) >>> 0
    return x % n
  }
  const hair = r(10) // coupes courantes d'abord
  return {
    s: r(SKINS.length),
    h: hair,
    c: r(6),
    e: r(EYES.length),
    g: r(5) === 0 ? 1 + r(2) : 0,
    b: r(6) === 0 ? 1 + r(3) : 0,
    m: r(4) === 0 ? 1 + r(3) : 0,
    f: 0, // les taches de rousseur se choisissent dans « Maquillage »
    o: r(3) === 0 ? 1 : 0,
    l: 0,
    t: r(TOPS.length - 1),
    a: 0,
    p: 0,
    v: 0,
    k: 0,
  }
}

/** Les proches fictifs du mode démo. */
export const DEMO_LOOKS: Record<string, string> = {
  'Mamie Jo': encodeLook({ s: 1, h: 6, c: 6, e: 3, g: 1, b: 0, m: 3, f: 0, o: 1, l: 1, t: 4, a: 0, p: 0, k: 20 }),
  Papa: encodeLook({ s: 2, h: 1, c: 1, e: 0, g: 0, b: 1, m: 0, f: 0, o: 0, l: 0, t: 3, a: 0, p: 0, k: 26 }),
  Léa: encodeLook({ s: 0, h: 4, c: 5, e: 2, g: 0, b: 0, m: 0, f: 1, o: 1, l: 0, t: 2, a: 1, p: 0, k: 50 }),
  'Cousin Hugo': encodeLook({ s: 5, h: 9, c: 0, e: 0, g: 2, b: 0, m: 0, f: 0, o: 0, l: 0, t: 1, a: 0, p: 0, k: 28 }),
  Noé: encodeLook({ s: 2, h: 2, c: 2, e: 1, g: 0, b: 0, m: 0, f: 1, o: 0, l: 0, t: 5, a: 2, p: 0, k: 62 }),
  'Bébé Lou': encodeLook({ s: 1, h: 12, c: 3, e: 3, g: 0, b: 0, m: 0, f: 0, o: 0, l: 0, t: 4, a: 3, p: 1, k: 73 }),
}

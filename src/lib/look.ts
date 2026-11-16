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
export const ACCESSORIES = ['', 'bonnet', 'casquette', 'paille', 'fleurs', 'echarpe', 'lunettes', 'couronne', 'noeud']

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
}
const KEYS: (keyof Look)[] = ['s', 'h', 'c', 'e', 'g', 'b', 'm', 'f', 'o', 'l', 't', 'a', 'p', 'v']
const MAX: Required<Look> = { s: SKINS.length, h: HAIRSTYLES.length, c: HAIR_COLORS.length, e: EYES.length, g: GLASSES.length, b: BEARDS.length, m: MOLES.length, f: 2, o: 2, l: 2, t: TOPS.length, a: AGES.length, p: 2, v: ACCESSORIES.length }

export const encodeLook = (l: Look) => `perso:${KEYS.map((k) => `${k}${l[k] ?? 0}`).join('.')}`

/** Lit un personnage ; un ancien avatar (animal) devient un personnage stable tiré de son identifiant. */
export function lookOf(avatar: string | undefined, seed = ''): Look {
  if (avatar?.startsWith('perso:')) {
    // les champs ajoutés plus tard (taille, tétine) valent « adulte, sans » par défaut
    const out: Look = { ...randomLook(avatar), a: 0, p: 0, v: 0 }
    for (const part of avatar.slice(6).split('.')) {
      const k = part[0] as keyof Look
      const v = Number(part.slice(1))
      if (KEYS.includes(k) && Number.isInteger(v) && v >= 0 && v < MAX[k]) out[k] = v
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
    f: r(5) === 0 ? 1 : 0,
    o: r(3) === 0 ? 1 : 0,
    l: 0,
    t: r(TOPS.length - 1),
    a: 0,
    p: 0,
    v: 0,
  }
}

/** Les proches fictifs du mode démo. */
export const DEMO_LOOKS: Record<string, string> = {
  'Mamie Jo': encodeLook({ s: 1, h: 6, c: 6, e: 3, g: 1, b: 0, m: 3, f: 0, o: 1, l: 1, t: 4, a: 0, p: 0 }),
  Papa: encodeLook({ s: 2, h: 1, c: 1, e: 0, g: 0, b: 1, m: 0, f: 0, o: 0, l: 0, t: 3, a: 0, p: 0 }),
  Léa: encodeLook({ s: 0, h: 4, c: 5, e: 2, g: 0, b: 0, m: 0, f: 1, o: 1, l: 0, t: 2, a: 1, p: 0 }),
  'Cousin Hugo': encodeLook({ s: 5, h: 9, c: 0, e: 0, g: 2, b: 0, m: 0, f: 0, o: 0, l: 0, t: 1, a: 0, p: 0 }),
  Noé: encodeLook({ s: 2, h: 2, c: 2, e: 1, g: 0, b: 0, m: 0, f: 1, o: 0, l: 0, t: 5, a: 2, p: 0 }),
  'Bébé Lou': encodeLook({ s: 1, h: 12, c: 3, e: 3, g: 0, b: 0, m: 0, f: 0, o: 0, l: 0, t: 4, a: 3, p: 1 }),
}

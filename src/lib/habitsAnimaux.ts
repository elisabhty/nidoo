// Où va ce que porte un compagnon (components/pet.tsx l'affiche). Ce fichier ne fait que des calculs, pour pouvoir
// être vérifié par les tests : chaque habit est posé d'après les repères mesurés de l'animal (lib/animaux.ts).

import { ANIMAUX, type Animal } from './animaux'

/** L'objet dans son image carrée de 320 (public/art/habit-*.webp, sans son ombre : scripts/banc/habits_animaux.py) :
 *  gauche, haut, droite, bas. */
export const OBJET: Record<string, [number, number, number, number]> = {
  'habit:noeud': [14, 145, 293, 307],
  'habit:bandana': [13, 112, 306, 310],
  'habit:bonnet': [12, 62, 299, 310],
  'habit:pull': [10, 70, 306, 299],
}

/** Le buste du pull dans son image (fractions de sa largeur) : ce qui est à gauche et à droite, ce sont ses manches.
 *  Un compagnon assis de face n'a pas de bras à y glisser : on ne garde que le buste, comme un petit pull sans
 *  manches — sinon le bout des manches dépassait sur ses hanches. Ceux qui ont des ailes le long du corps (le
 *  pingouin, le hibou) gardent les manches : elles tombent sur leurs ailes. */
export const BUSTE_DU_PULL: [number, number] = [(10 + 0.14 * 296) / 320, (10 + 0.84 * 296) / 320]
export const pullSansManches = (species: string) => !animal(species).manches

/** Une boîte, en fractions de l'image carrée du compagnon. */
export type Boite = { l: number; t: number; w: number; h: number }

export const animal = (species: string): Animal => ANIMAUX[species] ?? ANIMAUX.chat

/** Le bas de son visage : son menton, sous lequel passe ce qu'il porte au cou. */
export const menton = (a: Animal) => a.ey + a.d * 0.6

/** Où va l'objet lui-même (pas son image, qui a de la marge autour). */
export function boiteHabit(outfit: string, species: string): Boite | null {
  const a = animal(species)
  const cou = menton(a)
  const [x0, y0, x1, y1] = OBJET[outfit] ?? [0, 0, 1, 1]
  const forme = (y1 - y0) / (x1 - x0)
  switch (outfit) {
    case 'habit:noeud': {
      // un petit nœud, juste sous le menton
      const w = a.d * 0.95, h = w * forme
      return { l: a.ex - w / 2, t: cou - h * 0.2, w, h }
    }
    case 'habit:bandana': {
      // noué autour du cou : son nœud glissé sous le menton, sa pointe sur la poitrine
      const w = a.d * 1.5, h = w * forme
      return { l: a.ex - w / 2, t: cou - h * 0.3, w, h }
    }
    case 'habit:bonnet': {
      // sur le crâne, à la largeur de la tête, son bord juste au-dessus des yeux ; un peu tassé (les compagnons
      // ont la tête large et basse), et jamais plus de 0,14 au-dessus du crâne
      const w = Math.min(a.tw * 1.04, a.d * 2.5)
      const bas = a.ey - a.d * 0.42
      const h = Math.min(w * forme * 0.86, bas - (a.crane - 0.14))
      return { l: a.ex - w / 2, t: bas - h, w, h }
    }
    case 'habit:pull': {
      // du menton au haut de ses pattes arrière : l'ouverture du col est glissée sous son menton (sa tête repasse
      // devant) ; le buste du pull (les sept dixièmes de sa largeur, voir BUSTE_DU_PULL) couvre juste son corps, et
      // le pull est découpé à la forme de ce corps
      const w = Math.max(0.5, Math.min(0.9, a.cw / 0.68))
      const t = cou - a.d * 0.3
      return { l: a.xc - w / 2, t, w, h: a.pieds - t }
    }
    default:
      return null
  }
}

/** L'image carrée de l'habit, placée pour que l'objet qu'elle contient occupe cette boîte. */
export function boiteImage(outfit: string, b: Boite): Boite {
  const [x0, y0, x1, y1] = OBJET[outfit]
  const w = (b.w * 320) / (x1 - x0), h = (b.h * 320) / (y1 - y0)
  return { l: b.l - (w * x0) / 320, t: b.t - (h * y0) / 320, w, h }
}

/** Ce qui dépasse en haut de l'image (un bonnet sur un animal à la tête haute) : l'animal et son bonnet rapetissent
 *  ensemble d'autant, posés en bas, pour que rien ne sorte du cadre. */
export function depasse(outfit: string | null | undefined, species: string): number {
  if (outfit !== 'habit:bonnet') return 0
  const b = boiteHabit(outfit, species)
  return b ? Math.max(0, -b.t) : 0
}

/** Le contour de sa tête (tout ce qui est au-dessus de la mâchoire), pour la redessiner devant ce qu'il porte au cou :
 *  les points d'un polygone, en fractions de l'image. */
export function contourTete(a: Animal): [number, number][] {
  const cy = a.ey + a.d * 0.05, ry = menton(a) - cy, rx = a.d * 1.42
  const pts: [number, number][] = [[0, 0], [1, 0], [1, cy]]
  for (let k = 0; k <= 20; k++) {
    const t = (Math.PI * k) / 20
    pts.push([a.ex + rx * Math.cos(t), cy + ry * Math.sin(t)])
  }
  pts.push([0, cy])
  return pts
}

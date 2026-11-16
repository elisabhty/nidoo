import type { CSSProperties } from 'react'
import type { Pet } from '../lib/types'

// Le compagnon dessiné, avec sa tenue posée au bon endroit selon l'animal.
// neck : hauteur du cou (fraction de l'image, depuis le haut) ; head : haut de la tête.
const ANCHORS: Record<string, { neck: number; head: number; hw: number }> = {
  chat: { neck: 0.56, head: 0.14, hw: 0.56 },
  chien: { neck: 0.58, head: 0.08, hw: 0.6 },
  lapin: { neck: 0.62, head: 0.3, hw: 0.52 },
  renard: { neck: 0.56, head: 0.13, hw: 0.56 },
  panda: { neck: 0.56, head: 0.1, hw: 0.6 },
  koala: { neck: 0.56, head: 0.12, hw: 0.56 },
  pingouin: { neck: 0.5, head: 0.06, hw: 0.56 },
  hibou: { neck: 0.52, head: 0.1, hw: 0.6 },
}

/** Où va chaque vêtement : largeur, centre, et haut (fractions de l'image du compagnon).
 *  Les images des vêtements sont carrées, l'objet posé en bas : t = où commence l'objet. */
function outfitBox(outfit: string, species: string): CSSProperties | null {
  const a = ANCHORS[species] ?? ANCHORS.chat
  const box = (w: number, top: number): CSSProperties => ({ width: `${w * 100}%`, left: `${(0.5 - w / 2) * 100}%`, top: `${top * 100}%` })
  // au milieu du cou
  const atNeck = (w: number, t: number) => box(w, a.neck - w * (t + (1 - t) / 2))
  switch (outfit) {
    case 'habit:noeud':
      return atNeck(0.34, 0.41)
    case 'habit:bandana':
      return atNeck(0.5, 0.21)
    case 'habit:bonnet': {
      const w = a.hw * 0.95
      return box(w, a.head + 0.16 - w)
    }
    case 'habit:pull': {
      const w = 0.78
      return box(w, a.neck - 0.05 - w * 0.19)
    }
    default:
      return null
  }
}

export function PetFigure({ pet, className = '', style, filter }: { pet: Pick<Pet, 'species' | 'outfit'>; className?: string; style?: CSSProperties; filter?: string }) {
  const box = pet.outfit ? outfitBox(pet.outfit, pet.species) : null
  return (
    <span className={`relative block aspect-square ${className}`} style={{ ...style, filter }}>
      <img src={`./art/pet-${pet.species}.webp`} alt="" className="absolute inset-0 block h-full w-full" draggable={false} />
      {box && <img src={`./art/${pet.outfit!.replace(':', '-')}.webp`} alt="" className="absolute block h-auto" style={box} draggable={false} />}
    </span>
  )
}

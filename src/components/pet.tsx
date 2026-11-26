import type { CSSProperties } from 'react'
import { animal, boiteHabit, boiteImage, BUSTE_DU_PULL, contourTete, depasse, OBJET, pullSansManches, type Boite } from '../lib/habitsAnimaux'
import type { Pet } from '../lib/types'

// Le compagnon dessiné, avec ce qu'il porte. Jusqu'au 26 novembre 2026 l'habit était simplement posé par-dessus,
// d'après trois repères approximatifs : le nœud et le bandana lui couvraient la bouche, le bonnet flottait au-dessus
// de ses oreilles et sortait de l'image, le pull était un bloc plus large que lui, et chaque habit traînait son
// ombre grise (dessinée dans l'image) comme une languette blanche. Maintenant :
// - chaque animal a ses repères mesurés (lib/animaux.ts) : ses yeux, son crâne, son corps, ses pattes ;
// - ce qu'il porte au cou ou sur le corps passe SOUS son menton : sa tête est redessinée par-dessus ;
// - le pull est découpé à la forme de son corps, sans sa queue (public/art/pet-<espèce>-corps.webp), et s'arrête
//   au-dessus de ses pattes ; il est sans manches (un compagnon assis de face n'a pas de bras à y glisser), sauf
//   pour ceux qui ont des ailes le long du corps, où elles tombent ;
// - le bonnet se pose sur son crâne, à la largeur de sa tête ; s'il dépasse de l'image, l'animal et son bonnet
//   rapetissent ensemble juste ce qu'il faut : rien ne sort jamais du cadre.
// Les calculs sont dans lib/habitsAnimaux.ts (vérifiés par tests/animaux.test.mjs).

const pct = (b: Boite): CSSProperties => ({ left: `${b.l * 100}%`, top: `${b.t * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` })

export function PetFigure({ pet, className = '', style, filter }: { pet: Pick<Pet, 'species' | 'outfit'>; className?: string; style?: CSSProperties; filter?: string }) {
  const src = `./art/pet-${pet.species}.webp`
  const outfit = pet.outfit && OBJET[pet.outfit] ? pet.outfit : null
  const objet = outfit ? boiteHabit(outfit, pet.species) : null
  const surLaTete = outfit === 'habit:bonnet'
  // le pull sans ses manches (voir BUSTE_DU_PULL)
  const sansManches = outfit === 'habit:pull' && pullSansManches(pet.species) ? { clipPath: `inset(0 ${(1 - BUSTE_DU_PULL[1]) * 100}% 0 ${BUSTE_DU_PULL[0] * 100}%)` } : null
  const habit = outfit && objet && <img src={`./art/${outfit.replace(':', '-')}.webp`} alt="" className="absolute block max-w-none" style={{ ...pct(boiteImage(outfit, objet)), ...sansManches }} draggable={false} />
  const trop = depasse(outfit, pet.species)
  // son corps sans sa queue (scripts/banc/animaux.py) : le pull ne déborde ni de lui ni sur sa queue
  const masque = `url("./art/pet-${pet.species}-corps.webp")`
  const tete = `polygon(${contourTete(animal(pet.species)).map(([x, y]) => `${x * 100}% ${y * 100}%`).join(', ')})`
  return (
    <span className={`relative block aspect-square ${className}`} style={{ ...style, filter }}>
      <span className="absolute inset-0 block" style={trop ? { transform: `scale(${1 / (1 + trop)})`, transformOrigin: '50% 100%' } : undefined}>
        <img src={src} alt="" className="absolute inset-0 block h-full w-full" draggable={false} />
        {habit && surLaTete && habit}
        {habit && !surLaTete && (
          <>
            {outfit === 'habit:pull' ? (
              <span className="absolute inset-0 block" style={{ WebkitMaskImage: masque, maskImage: masque, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }}>
                {habit}
              </span>
            ) : (
              habit
            )}
            {/* sa tête repasse devant : ce qu'il porte se glisse sous son menton */}
            <img src={src} alt="" className="absolute inset-0 block h-full w-full" style={{ clipPath: tete }} draggable={false} />
          </>
        )}
      </span>
    </span>
  )
}

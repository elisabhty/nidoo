// L'image d'une de nos adresses, devinée à son nom : « École » a son cartable, « Bureau de Papa » sa mallette,
// « Chez Mamie » un cœur. Personne n'a d'icône à choisir : on écrit le nom, l'image suit.
import { Baby, Backpack, Briefcase, Heart, House, MapPin, Music, ShoppingBasket, Stethoscope, TrainFront, Trees, Volleyball, type LucideIcon } from 'lucide-react'
import { endroitNomme, genreEndroit, type GenreEndroit } from '../lib/endroits'
import type { Endroit } from '../lib/types'

const IMAGES: Record<GenreEndroit, { Icone: LucideIcon; fond: string; trait: string }> = {
  maison: { Icone: House, fond: 'bg-teinte-doux', trait: 'text-teinte-fonce' },
  ecole: { Icone: Backpack, fond: 'bg-[#E3F1FD]', trait: 'text-[#2F7FD0]' },
  creche: { Icone: Baby, fond: 'bg-[#FDE8F1]', trait: 'text-[#D4578C]' },
  travail: { Icone: Briefcase, fond: 'bg-[#E9EAF4]', trait: 'text-[#565B8C]' },
  sport: { Icone: Volleyball, fond: 'bg-peche-doux', trait: 'text-peche-fonce' },
  musique: { Icone: Music, fond: 'bg-teinte-doux', trait: 'text-teinte-fonce' },
  sante: { Icone: Stethoscope, fond: 'bg-[#E2F6F3]', trait: 'text-[#1F9485]' },
  courses: { Icone: ShoppingBasket, fond: 'bg-[#FFF3D6]', trait: 'text-[#B5810F]' },
  transport: { Icone: TrainFront, fond: 'bg-[#E9EAF4]', trait: 'text-[#565B8C]' },
  nature: { Icone: Trees, fond: 'bg-[#E4F5E4]', trait: 'text-[#3C9645]' },
  famille: { Icone: Heart, fond: 'bg-[#FDE8F1]', trait: 'text-[#D4578C]' },
  autre: { Icone: MapPin, fond: 'bg-[#E3F1FD]', trait: 'text-[#2F7FD0]' },
}

/** L'icône seule, à glisser dans une ligne de texte (elle prend la couleur de son genre, sauf `sobre`). */
export function IconeEndroit({ nom, size = 14, sobre = false, className = '' }: { nom: string; size?: number; sobre?: boolean; className?: string }) {
  const { Icone, trait } = IMAGES[genreEndroit(nom)]
  return <Icone size={size} strokeWidth={2.4} className={`shrink-0 ${sobre ? '' : trait} ${className}`} aria-hidden="true" />
}

/** La pastille d'une adresse : l'icône sur son fond doux. `vivante` : elle saute quand l'image change (on tape le nom). */
export function PastilleEndroit({ nom, size = 44, vivante = false }: { nom: string; size?: number; vivante?: boolean }) {
  const genre = genreEndroit(nom)
  const { Icone, fond, trait } = IMAGES[genre]
  return (
    <span key={vivante ? genre : undefined} className={`flex shrink-0 items-center justify-center rounded-full ${vivante ? 'anim-pop' : ''} ${fond} ${trait}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icone size={Math.round(size * 0.48)} strokeWidth={2.3} />
    </span>
  )
}

/** Le lieu d'un événement dans une liste : une de nos adresses avec son image et son nom (« École »), sinon le texte. */
export function LieuEvt({ lieu, endroits }: { lieu: string; endroits: readonly Endroit[] }) {
  const e = endroitNomme(lieu, endroits)
  return (
    <span className="mt-0.5 flex items-start gap-1 text-note text-teinte-fonce">
      {e ? <IconeEndroit nom={e.nom} size={12} sobre className="mt-[3px]" /> : <MapPin size={12} strokeWidth={2.4} className="mt-[3px] shrink-0" />}
      <span className={`min-w-0 break-words ${e ? 'font-semibold' : ''}`}>{e ? e.nom : lieu}</span>
    </span>
  )
}

// L'accueil quand on est seul dans la maison (Elisa, 26 novembre : « répétition », puis « c'est pas du tout UI UX ») :
// une seule invitation, et qui donne envie. Moi, et trois places qui attendent mes proches ; ce que la maison devient
// quand ils arrivent ; le bouton pour les inviter ; le code, pour le donner de vive voix ; et les petits sans téléphone,
// qu'on ajoute soi-même (la carte reste tant que personne d'autre, avec un téléphone, n'est arrivé).
import { Baby, Check, ChevronRight, Copy, Plus, Send } from 'lucide-react'
import type { Member } from '../lib/types'
import { LettresCode, useCopie } from './copie'
import { Avatar } from './ui'

export function InvitationAccueil({ me, code, onInviter, onPetit }: { me: Member; code: string | null; onInviter: () => void; onPetit: () => void }) {
  // le code copié : il le dit lui-même (la vague, « Code copié ! », des étincelles), pas de bandeau
  const { copie, vague, copier } = useCopie()
  return (
    <section className="mx-5 mt-3 rounded-[22px] bg-carte px-5 pb-5 pt-5 text-center shadow-carte" aria-label="Inviter mes proches">
      {/* moi, et les places qui attendent (elles flottent doucement, comme les bulles de la maison) */}
      <button onClick={onInviter} className="presse mx-auto flex -space-x-2.5" aria-label="Inviter mes proches">
        <span className="rounded-full ring-[3px] ring-carte">
          <Avatar m={me} size={52} />
        </span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-dashed border-teinte/40 bg-teinte-doux text-teinte ring-[3px] ring-carte"
            style={{ animation: `flotte ${3.2 + i * 0.45}s ease-in-out ${i * 0.35}s infinite` }}
          >
            <Plus size={20} strokeWidth={2.6} />
          </span>
        ))}
      </button>
      <h2 className="mt-3.5 font-rond text-titre3">Ta maison attend tes proches</h2>
      <p className="mx-auto mt-1 max-w-[300px] text-sous text-brume">Dès qu’ils arrivent, elle s’anime : vos humeurs, vos petits mots, vos photos et l’agenda, ensemble.</p>
      <button onClick={onInviter} className="presse ios-primary mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full text-corps font-bold text-white">
        <Send size={18} strokeWidth={2.5} /> Inviter mes proches
      </button>
      {/* le code, pour le donner de vive voix ou par message (le responsable seulement) */}
      {code && (
        <button
          onClick={(e) => void copier(code, e.currentTarget)}
          className={`presse relative mt-3 inline-flex min-h-9 items-center gap-2 rounded-full py-1.5 pl-3.5 pr-3 transition-colors duration-300 ${copie ? 'bg-[#E3F5EC]' : 'bg-doux'}`}
          aria-label={copie ? 'Code copié' : `Copier le code d’invitation ${code}`}
        >
          {/* copié : le bouton le dit lui-même, à la place de « Ou donne le code » (la même place : rien ne bouge) */}
          <span className="grid text-note" aria-hidden="true">
            <span className={`col-start-1 row-start-1 text-brume transition-opacity duration-200 ${copie ? 'opacity-0' : ''}`}>Ou donne le code</span>
            {copie && (
              <span key={vague} className="anim-pop col-start-1 row-start-1 text-center font-extrabold text-[#15803D]">
                Code copié !
              </span>
            )}
          </span>
          <LettresCode code={code} vague={vague} className="font-rond text-[15px] tracking-[0.16em] text-encre" />
          {copie ? (
            <span key="ok" className="anim-pop flex items-center text-[#15803D]">
              <Check size={15} strokeWidth={3} />
            </span>
          ) : (
            <Copy size={14} strokeWidth={2.4} className="text-teinte" />
          )}
        </button>
      )}
      {/* les petits qui n'ont pas de téléphone : pas d'invitation, on les ajoute soi-même (les cinq familles :
          les Martin et leurs deux enfants, Inès et la petite Lou, cherchaient où le faire) */}
      <button onClick={onPetit} className="presse mt-4 flex w-full items-center gap-3 border-t border-trait pt-4 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-peche-doux text-peche-fonce" aria-hidden="true">
          <Baby size={20} strokeWidth={2.3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-appel font-bold text-teinte">Ajouter un enfant ou un bébé</span>
          <span className="block text-note text-brume">Pour les petits sans téléphone</span>
        </span>
        <ChevronRight size={18} strokeWidth={2.6} className="shrink-0 text-pale" aria-hidden="true" />
      </button>
    </section>
  )
}

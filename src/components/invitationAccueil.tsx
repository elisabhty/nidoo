// L'accueil quand on est seul dans la maison (Elisa, 26 novembre : « répétition », puis « c'est pas du tout UI UX ») :
// une seule invitation, et qui donne envie. Moi, et trois places qui attendent mes proches ; ce que la maison devient
// quand ils arrivent ; le bouton pour les inviter ; et le code, pour le donner de vive voix.
import { Check, Copy, Plus, Send } from 'lucide-react'
import { useState } from 'react'
import { tap } from '../lib/haptic'
import { copy } from '../lib/share'
import type { Member } from '../lib/types'
import { Avatar } from './ui'

export function InvitationAccueil({ me, code, onInviter }: { me: Member; code: string | null; onInviter: () => void }) {
  // le code copié : il le dit lui-même un instant (pas de bandeau)
  const [copie, setCopie] = useState(false)
  const copier = async () => {
    if (!code) return
    tap()
    if (!(await copy(code))) return
    setCopie(true)
    window.setTimeout(() => setCopie(false), 1600)
  }
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
        <button onClick={() => void copier()} className="presse mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-doux py-1.5 pl-3.5 pr-3" aria-label={copie ? 'Code copié' : `Copier le code d’invitation ${code}`}>
          <span className="text-note text-brume">Ou donne le code</span>
          <span className="font-rond text-[15px] tracking-[0.16em] text-encre">{code}</span>
          {copie ? (
            <span key="ok" className="anim-pop flex items-center text-vert">
              <Check size={15} strokeWidth={3} />
            </span>
          ) : (
            <Copy size={14} strokeWidth={2.4} className="text-teinte" />
          )}
        </button>
      )}
    </section>
  )
}

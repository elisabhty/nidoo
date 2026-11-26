// Copier le code d'invitation, et le voir (Elisa, 26 novembre : « il faut une micro-interaction quand on copie ») : le
// téléphone vibre, des étincelles partent du bouton, les lettres du code font la vague en passant au vert, et
// « Code copié ! » jaillit au-dessus. Pas de bandeau en haut de l'écran : tout se passe là où on a touché.
import { useEffect, useRef, useState } from 'react'
import { petille } from '../lib/fete'
import { success } from '../lib/haptic'
import { copy } from '../lib/share'

/** `copie` : vrai pendant le retour (deux secondes) ; `copier(texte, bouton)` : copie, puis le retour. */
export function useCopie(duree = 2000) {
  const [copie, setCopie] = useState(0)
  const fin = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(fin.current), [])
  const copier = async (texte: string, el?: Element | null) => {
    if (!(await copy(texte))) return false
    success()
    petille(el)
    // recopié aussitôt : la vague repart (le compteur sert de clé aux lettres)
    setCopie((n) => n + 1)
    window.clearTimeout(fin.current)
    fin.current = window.setTimeout(() => setCopie(0), duree)
    return true
  }
  return { copie: copie > 0, vague: copie, copier }
}

/** Les lettres du code : elles font la vague, l'une après l'autre, quand on vient de le copier. */
export function LettresCode({ code, vague, className = '' }: { code: string; vague: number; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {[...code].map((l, i) => (
        <span key={`${vague}-${i}`} className="inline-block" style={vague ? { animation: `vagueCode 0.62s ${i * 55}ms cubic-bezier(0.3, 0.7, 0.4, 1) both` } : undefined}>
          {l}
        </span>
      ))}
    </span>
  )
}

/** « Code copié ! » : une bulle verte qui jaillit au-dessus du bouton (le bouton doit être en `relative`). */
export function BulleCopie({ vague, texte = 'Code copié !' }: { vague: number; texte?: string }) {
  if (!vague) return null
  return (
    // la place (centrée au-dessus), puis la bulle qui jaillit : le saut ne doit pas écraser le centrage
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2" role="status">
      <span key={vague} className="anim-pop relative block whitespace-nowrap rounded-full bg-[#14955A] px-3 py-1 text-[13px] font-extrabold text-white shadow-[0_4px_10px_rgba(20,149,90,0.4)]">
        {texte}
        <span className="absolute -bottom-[3px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-[#14955A]" aria-hidden="true" />
      </span>
    </span>
  )
}

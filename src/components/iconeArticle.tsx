import { memo } from 'react'
import { emojiDe, iconeDe } from '../lib/courses'

/** L'icône d'un article de courses : en feutrine quand on en a une (public/art/courses), sinon son emoji. */
export const IconeArticle = memo(function IconeArticle({ nom, taille = 28, className = '' }: { nom: string; taille?: number; className?: string }) {
  const f = iconeDe(nom)
  if (f) return <img src={`./art/courses/${f}.webp`} alt="" width={taille} height={taille} draggable={false} decoding="async" className={`pointer-events-none shrink-0 select-none object-contain ${className}`} style={{ width: taille, height: taille }} />
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} style={{ width: taille, height: taille, fontSize: Math.round(taille * 0.78) }}>
      {emojiDe(nom)}
    </span>
  )
})

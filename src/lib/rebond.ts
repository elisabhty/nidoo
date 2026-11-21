// Un petit rebond joué sur l'élément lui-même (Web Animations : sur le processeur graphique, fluide sur iPhone),
// au lieu de recréer l'élément pour relancer une animation CSS (une image recréée clignotait).
const calme = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function rebond(el: Element | null | undefined, force = 1) {
  if (!el || calme() || typeof (el as HTMLElement).animate !== 'function') return
  ;(el as HTMLElement).animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${1 - 0.1 * force})` }, { transform: `scale(${1 + 0.07 * force})` }, { transform: 'scale(1)' }],
    { duration: 460, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' },
  )
}

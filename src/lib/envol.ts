/** Publier, c'est voir sa publication s'envoler de la feuille jusqu'en haut du fil (Elisa, 28 novembre : « micro-
 *  interaction quand on ajoute la publication sur le fil, très waouh, très joli »). Une copie figée de la carte
 *  qu'on vient d'écrire (le texte en texte, les photos en images dessinées, sans les boutons) part en arc et se pose
 *  à la place de la vraie, qui apparaît dessous avec un halo et des étincelles. */

function copieFigee(carte: HTMLElement): HTMLElement {
  const c = carte.cloneNode(true) as HTMLElement
  // ce qui ne fait pas partie de la publication : boutons, idées
  c.querySelectorAll('[data-pas-envol]').forEach((n) => n.remove())
  // le texte tapé (un champ ne garde pas sa valeur dans une copie)
  const champs = carte.querySelectorAll('textarea')
  c.querySelectorAll('textarea').forEach((t, i) => {
    const d = document.createElement('div')
    d.className = t.className
    d.style.cssText = t.style.cssText
    d.style.whiteSpace = 'pre-wrap'
    d.style.overflow = 'hidden'
    d.textContent = champs[i]?.value ?? ''
    t.replaceWith(d)
  })
  // les images (leurs adresses provisoires disparaissent avec la feuille) : dessinées une fois pour toutes
  const imgs = carte.querySelectorAll('img')
  c.querySelectorAll('img').forEach((ci, i) => {
    const im = imgs[i]
    if (!im || !im.complete || !im.naturalWidth) return
    try {
      const cv = document.createElement('canvas')
      const k = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight))
      cv.width = Math.round(im.naturalWidth * k)
      cv.height = Math.round(im.naturalHeight * k)
      cv.getContext('2d')?.drawImage(im, 0, 0, cv.width, cv.height)
      cv.className = im.className
      cv.style.cssText = im.style.cssText
      cv.style.width = `${im.offsetWidth}px`
      cv.style.height = `${im.offsetHeight}px`
      cv.style.objectFit = 'cover'
      ci.replaceWith(cv)
    } catch {
      /* une image qu'on ne peut pas recopier : la copie garde l'originale */
    }
  })
  return c
}

/** Fait voler la carte jusqu'à `cible` (le haut de la liste du fil, mesuré une fois l'écran remonté). */
export function envoler(carte: HTMLElement | null | undefined, cible: () => { left: number; top: number; width: number } | null) {
  if (!carte || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = carte.getBoundingClientRect()
  if (!r.width || !r.height) return
  const c = copieFigee(carte)
  Object.assign(c.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0',
    zIndex: '95', pointerEvents: 'none', transformOrigin: '0 0', willChange: 'transform, opacity',
    boxShadow: '0 28px 60px -22px rgba(64, 40, 150, 0.55)',
  })
  c.setAttribute('aria-hidden', 'true')
  document.body.appendChild(c)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const t = cible()
      if (!t) return c.remove()
      const s = t.width / r.width
      const dx = t.left - r.left
      const dy = t.top - r.top
      const a = c.animate(
        [
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(0, -18px) scale(1.03) rotate(-1.2deg)`, opacity: 1, offset: 0.18 },
          { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 26}px) scale(${(1 + s) / 2}) rotate(1deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, opacity: 1, offset: 0.86 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 },
        ],
        { duration: 760, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' },
      )
      a.onfinish = () => c.remove()
      a.oncancel = () => c.remove()
      window.setTimeout(() => c.remove(), 1500)
    }),
  )
}

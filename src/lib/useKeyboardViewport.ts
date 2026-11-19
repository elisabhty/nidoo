import { useEffect, useState } from 'react'

/** La zone qui défile autour d'un élément (pas la page entière). */
function zoneDe(el: Element | null): HTMLElement | null {
  if (!(el instanceof HTMLElement)) return null
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  return box
}

/** Quand le clavier se ferme, la zone qui défile grandit d'autant ; Safari garde parfois l'ancienne position,
 *  au-delà du bas : on voit alors un grand vide sous le contenu (et la barre d'écriture au milieu de l'écran).
 *  On la ramène dans les limites, et la page entière à sa place. */
function recaler(box: HTMLElement | null) {
  if (box) {
    const max = Math.max(0, box.scrollHeight - box.clientHeight)
    if (box.scrollTop > max) box.scrollTop = max
    else box.scrollTop = box.scrollTop // force Safari à recalculer
  }
  if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || (window.visualViewport?.offsetTop ?? 0) > 1) {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

/** Fait défiler la zone qui contient le champ (pas la page entière) pour qu'il soit bien visible au-dessus du clavier. */
function montrer(el: Element | null) {
  if (!(el instanceof HTMLElement)) return
  let box = el.parentElement
  while (box && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement
  if (!box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (r.top < b.top + 12 || r.bottom > b.bottom - 12) box.scrollTop += r.top - b.top - (b.height - r.height) / 2
}

/** Keep the active sheet inside the visible area when the software keyboard opens.
 *  Renvoie `keyboard` (clavier ouvert) et `decale` (l'appli suit la zone visible). */
export function useKeyboardViewport() {
  const [keyboard, setKeyboard] = useState(false)
  const [decale, setDecale] = useState(false)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    let referenceHeight = window.innerHeight
    let referenceWidth = window.innerWidth
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]') ?? false
        if (window.innerWidth !== referenceWidth) {
          referenceWidth = window.innerWidth
          referenceHeight = window.innerHeight
        }
        const open = editing && Math.max(referenceHeight, window.innerHeight) - viewport.height > 120
        if (!editing) referenceHeight = window.innerHeight
        // iOS 26 : une fois le clavier fermé, Safari laisse parfois la zone visible décalée vers le bas
        // (offsetTop qui ne revient pas à 0). L'appli, fixée à la page, paraît alors remontée :
        // la barre d'écriture au milieu de l'écran et un grand vide dessous. On suit donc la zone
        // visible tant que ce décalage reste (sauf pendant un zoom à deux doigts).
        const zoom = Math.abs((viewport.scale ?? 1) - 1) > 0.01
        const coince = !open && !zoom && viewport.offsetTop > 1
        setKeyboard(open)
        setDecale(open || coince)
        document.documentElement.style.setProperty('--app-height', open || coince ? `${viewport.height}px` : '100%')
        // Safari décale aussi la zone visible vers le bas (offsetTop) pour montrer le champ :
        // on suit ce décalage, sinon on voit le bas de l'appli puis un grand vide gris.
        document.documentElement.style.setProperty('--app-top', open || coince ? `${Math.max(0, viewport.offsetTop)}px` : '0px')
        if (open && !wasOpen) {
          zone = zoneDe(document.activeElement)
          window.setTimeout(() => montrer(document.activeElement), 80)
        }
        if (!open && wasOpen) {
          // le clavier se ferme : on recale la zone d'écriture et la page une fois la mise en page refaite,
          // puis on remesure (Safari annonce parfois la vraie zone visible avec du retard)
          const box = zone
          for (const t of [0, 120, 350, 700]) window.setTimeout(() => { recaler(box); update() }, t)
        }
        wasOpen = open
      })
    }
    let wasOpen = false
    let zone: HTMLElement | null = null
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      document.documentElement.style.removeProperty('--app-height')
      document.documentElement.style.removeProperty('--app-top')
    }
  }, [])
  return { keyboard, decale }
}

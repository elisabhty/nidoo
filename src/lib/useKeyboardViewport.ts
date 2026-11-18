import { useEffect, useState } from 'react'

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

/** Keep the active sheet inside the visible area when the software keyboard opens. */
export function useKeyboardViewport() {
  const [keyboard, setKeyboard] = useState(false)
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
        setKeyboard(open)
        document.documentElement.style.setProperty('--app-height', open ? `${viewport.height}px` : '100%')
        // Safari décale parfois la zone visible vers le bas (offsetTop) pour montrer le champ :
        // on suit ce décalage, sinon on voit le bas de l'appli puis un grand vide gris.
        document.documentElement.style.setProperty('--app-top', open ? `${Math.max(0, viewport.offsetTop)}px` : '0px')
        if (open && !wasOpen) window.setTimeout(() => montrer(document.activeElement), 80)
        wasOpen = open
      })
    }
    let wasOpen = false
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
  return keyboard
}

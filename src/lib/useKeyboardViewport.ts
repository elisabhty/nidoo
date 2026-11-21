import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { useEffect, useState } from 'react'

/** Dans l'appli iPhone, le clavier est géré comme dans Requête (13 novembre ; Elisa, 21 novembre : « ça bug au niveau
 *  du clavier et il y a des flashs ») : la vue de l'appli ne change plus de taille ni ne défile quand il s'ouvre
 *  (mode « none », défilement coupé). C'est l'appli qui se cale au-dessus de lui dès qu'il s'annonce, une seule fois,
 *  et suit son mouvement (0,26 s, la courbe du clavier d'iOS) : plus de saut en deux temps, plus d'image de travers.
 *  Sous le clavier, la couleur du bas de l'écran (le violet de l'accueil). */
const NATIF = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

export function preparerClavier() {
  if (!NATIF) return
  document.documentElement.classList.add('natif')
  Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => undefined)
  Keyboard.setScroll({ isDisabled: true }).catch(() => undefined)
  // plus de barre « ˄ ˅ OK » grise au-dessus du clavier (Elisa, 21 novembre : « améliorer le clavier ») :
  // Entrée passe à la suite, et faire défiler ferme le clavier (plus bas)
  Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined)
}

/** Faire défiler (de haut en bas) ferme le clavier, comme dans Messages : plus besoin de bouton « OK ».
 *  Pas quand on glisse dans le champ lui-même (sélectionner du texte), ni pour un glissé de côté (les idées). */
export function fermerClavierEnDefilant(): () => void {
  let depart: EventTarget | null = null
  let x0 = 0
  let y0 = 0
  const debut = (e: TouchEvent) => {
    depart = e.target
    x0 = e.touches[0]?.clientX ?? 0
    y0 = e.touches[0]?.clientY ?? 0
  }
  const bouge = (e: TouchEvent) => {
    const champ = document.activeElement
    if (!(champ instanceof HTMLElement) || !champ.matches('input:not([type="date"]):not([type="time"]), textarea')) return
    if (depart instanceof Node && champ.contains(depart)) return
    const dx = Math.abs((e.touches[0]?.clientX ?? 0) - x0)
    const dy = Math.abs((e.touches[0]?.clientY ?? 0) - y0)
    if (dy > 14 && dy > dx * 1.5) champ.blur()
  }
  document.addEventListener('touchstart', debut, { passive: true, capture: true })
  document.addEventListener('touchmove', bouge, { passive: true, capture: true })
  return () => {
    document.removeEventListener('touchstart', debut, { capture: true })
    document.removeEventListener('touchmove', bouge, { capture: true })
  }
}

/** La couleur du bas de l'écran, à mettre sous le clavier. */
function fondDuBas(): string {
  const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 4)
  const marque = el?.closest<HTMLElement>('[data-fond-clavier]')
  if (marque) return marque.dataset.fondClavier!
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor
    if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c
  }
  return '#F8F7FC'
}

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
// Le doigt est sur l'écran (on fait défiler une liste) : on ne touche à rien, sinon la liste saute sous le doigt
// (Elisa, 21 novembre : « quand on cherche et qu'on fait défiler la liste, ça commence à sauter »).
let doigtPose = false
let dernierDefile = 0
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', () => (doigtPose = true), { passive: true, capture: true })
  const leve = () => {
    doigtPose = false
  }
  window.addEventListener('touchend', leve, { passive: true, capture: true })
  window.addEventListener('touchcancel', leve, { passive: true, capture: true })
  window.addEventListener('scroll', () => (dernierDefile = Date.now()), { passive: true, capture: true })
}
// (un simple toucher, pour écrire dans un champ, ne compte pas : seul un vrai défilement, ou son élan)
const onDefile = () => (doigtPose && Date.now() - dernierDefile < 400) || Date.now() - dernierDefile < 250

function recaler(box: HTMLElement | null) {
  // seulement s'il reste un vide sous le contenu, et jamais pendant qu'on fait défiler (l'élan continue)
  if (box && !onDefile()) {
    const max = Math.max(0, box.scrollHeight - box.clientHeight)
    if (box.scrollTop > max) box.scrollTop = max
  }
  if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || (window.visualViewport?.offsetTop ?? 0) > 1) {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

/** Fait défiler la zone qui contient le champ (pas la page entière) juste assez pour qu'il soit visible au-dessus
 *  du clavier, sans jamais dépasser le bas du contenu (Elisa, 21 novembre : un grand vide restait sous la fiche).
 *  On s'arrête à la première zone qui défile : jamais la page derrière une fenêtre. */
function montrer(el: Element | null) {
  if (!(el instanceof HTMLElement) || onDefile()) return
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  if (!box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  const marge = 16
  const delta = r.bottom > b.bottom - marge ? r.bottom - (b.bottom - marge) : r.top < b.top + marge ? r.top - (b.top + marge) : 0
  if (!delta) return
  const max = Math.max(0, box.scrollHeight - box.clientHeight)
  box.scrollTo({ top: Math.min(max, Math.max(0, box.scrollTop + delta)), behavior: 'smooth' })
}

/** Keep the active sheet inside the visible area when the software keyboard opens.
 *  Renvoie `keyboard` (clavier ouvert) et `decale` (l'appli suit la zone visible). */
export function useKeyboardViewport() {
  const [keyboard, setKeyboard] = useState(false)
  const [decale, setDecale] = useState(false)
  useEffect(() => fermerClavierEnDefilant(), [])
  // l'appli iPhone : le clavier s'annonce (sa hauteur), l'appli se cale au-dessus de lui
  useEffect(() => {
    if (!NATIF) return
    const root = document.documentElement
    let ouvert = false
    let zone: HTMLElement | null = null
    let fin = 0
    const montre = Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      window.clearTimeout(fin)
      if (!ouvert) root.style.setProperty('--fond-clavier', fondDuBas())
      ouvert = true
      zone = zoneDe(document.activeElement)
      root.classList.add('kb-ouvert', 'kb-visible')
      root.style.setProperty('--app-height', `${window.innerHeight - Math.max(0, Math.round(keyboardHeight))}px`)
      setKeyboard(true)
      // le champ, bien visible au-dessus du clavier, une fois l'appli calée ; puis on vérifie que la zone n'est pas
      // restée défilée au-delà du bas (le clavier change parfois de hauteur : barre de suggestions, émojis…)
      window.setTimeout(() => montrer(document.activeElement), 280)
      window.setTimeout(() => recaler(zone), 650)
    })
    const cache = Keyboard.addListener('keyboardWillHide', () => {
      ouvert = false
      // tout de suite (pas 0,3 s après) : le bouton du bas revient en même temps que le clavier descend
      root.classList.remove('kb-visible')
      root.style.setProperty('--app-height', `${window.innerHeight}px`)
      setKeyboard(false)
      const box = zone
      fin = window.setTimeout(() => {
        if (ouvert) return
        root.classList.remove('kb-ouvert')
        root.style.removeProperty('--app-height')
        recaler(box)
      }, 300)
    })
    return () => {
      window.clearTimeout(fin)
      void montre.then((h) => h.remove())
      void cache.then((h) => h.remove())
      root.classList.remove('kb-ouvert', 'kb-visible')
      root.style.removeProperty('--app-height')
    }
  }, [])
  useEffect(() => {
    if (NATIF) return
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
        // la première fois qu'on le voit coincé, on tente de le décoincer (un défilement « à vide » suffit
        // parfois à Safari pour remettre la zone visible à sa place) ; sinon on la suit, comme ci-dessous
        if (coince && !tente) {
          tente = true
          window.scrollTo(0, window.scrollY)
          recaler(null)
          window.setTimeout(update, 150)
        }
        if (!coince) tente = false
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
    let tente = false
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

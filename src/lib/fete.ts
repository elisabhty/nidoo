// Les petites fêtes de l'accueil (Elisa, 21 novembre : « beaucoup plus d'animation, de micro-interactions…
// que ça soit cosy, que ça soit waouh : des feux d'artifice, des confettis »).
// Un seul calque par-dessus tout l'écran, qui ne prend jamais le toucher. Rien quand l'iPhone demande moins d'animations.
import confetti from 'canvas-confetti'

const COULEURS = ['#FFC94D', '#FF8FB1', '#A98BFF', '#7A5AE0', '#6FD3A8', '#FFFFFF']
const calme = () => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

let tir: confetti.CreateTypes | null = null
function canon(): confetti.CreateTypes {
  if (!tir) {
    const c = document.createElement('canvas')
    c.setAttribute('aria-hidden', 'true')
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000'
    document.body.appendChild(c)
    tir = confetti.create(c, { resize: true, useWorker: true })
  }
  return tir
}

/** Le centre d'un élément, en fractions de l'écran (là d'où partent les confettis). */
function depuis(el?: Element | null, x = 0.5, y = 0.45) {
  if (!el) return { x, y }
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
}

let coeur: confetti.Shape | null = null
let etoile: confetti.Shape | null = null
const formes = () => {
  try {
    coeur ??= confetti.shapeFromText({ text: '💗', scalar: 2 })
    etoile ??= confetti.shapeFromText({ text: '✨', scalar: 2 })
  } catch {
    /* un vieux navigateur : des ronds */
  }
}

/** Un petit pétillement là où on vient de toucher (un choix fait). */
export function petille(el?: Element | null) {
  if (calme()) return
  canon()({ particleCount: 16, spread: 75, startVelocity: 17, ticks: 70, gravity: 0.85, scalar: 0.7, decay: 0.9, origin: depuis(el), colors: COULEURS, shapes: ['circle', 'star'] })
}

/** Des confettis qui jaillissent d'un élément (une chose faite, un article dans le panier). */
export function bravo(el?: Element | null) {
  if (calme()) return
  canon()({ particleCount: 34, spread: 88, startVelocity: 23, ticks: 95, gravity: 0.9, scalar: 0.82, decay: 0.9, origin: depuis(el), colors: COULEURS, shapes: ['circle', 'square'] })
}

/** Les petits émojis de chaque humeur (Elisa, 21 novembre : « des émojis en micro au lieu des cœurs, selon
 *  l'humeur ») et leur façon de bouger : la joie jaillit, le zen flotte, la fatigue monte en « zzz », le coup de mou
 *  tombe en pluie… */
const HUMEURS: Record<string, { emojis: string[]; tir: confetti.Options }> = {
  heureux: { emojis: ['☀️', '✨', '😄'], tir: { spread: 75, startVelocity: 22, gravity: 0.7, ticks: 110 } },
  serein: { emojis: ['🍃', '🌿', '🫧'], tir: { spread: 100, startVelocity: 9, gravity: 0.22, drift: 0.4, ticks: 170 } },
  motive: { emojis: ['⚡', '🔥', '💪'], tir: { spread: 55, startVelocity: 28, gravity: 0.9, ticks: 100 } },
  fete: { emojis: ['🎉', '🎊', '🥳'], tir: { spread: 90, startVelocity: 25, gravity: 0.75, ticks: 120 } },
  fatigue: { emojis: ['💤', '😴', '🌙'], tir: { spread: 40, startVelocity: 7, gravity: -0.18, drift: 0.25, ticks: 160, angle: 90 } },
  stresse: { emojis: ['💦', '😬', '🌀'], tir: { spread: 140, startVelocity: 16, gravity: 0.8, ticks: 90 } },
  nostalgique: { emojis: ['🍂', '💭', '📷'], tir: { spread: 80, startVelocity: 10, gravity: 0.35, drift: -0.4, ticks: 170 } },
  triste: { emojis: ['🌧️', '💧', '☁️'], tir: { spread: 50, startVelocity: 5, gravity: 0.9, ticks: 120, angle: 270 } },
}
const formesEmoji = new Map<string, confetti.Shape>()
function formeDe(e: string): confetti.Shape | null {
  try {
    if (!formesEmoji.has(e)) formesEmoji.set(e, confetti.shapeFromText({ text: e, scalar: 2.2 }))
    return formesEmoji.get(e)!
  } catch {
    return null
  }
}
/** Les émojis d'une humeur qui partent d'un élément (une humeur choisie, puis partagée : n plus grand). */
export function humeurEnVol(el: Element | null | undefined, humeur: string, n = 7) {
  if (calme()) return
  const h = HUMEURS[humeur]
  if (!h) return coeurs(el, n)
  const shapes = h.emojis.map(formeDe).filter((x): x is confetti.Shape => !!x)
  canon()({ particleCount: n, decay: 0.92, scalar: 1.7, flat: true, origin: depuis(el), ...h.tir, shapes: shapes.length ? shapes : ['circle'] })
}

/** Des cœurs qui s'envolent d'un élément (un proche choisi, le panda caressé, un bisou). */
export function coeurs(el?: Element | null, n = 9) {
  if (calme()) return
  formes()
  canon()({ particleCount: n, spread: 60, startVelocity: 20, ticks: 90, gravity: 0.55, scalar: 1.5, decay: 0.92, flat: true, origin: depuis(el), shapes: coeur ? [coeur] : ['circle'], colors: ['#FF6F9C'] })
}

/** Une pluie de confettis des deux côtés de l'écran (un personnage trouvé, les notifications activées). */
export function confettis() {
  if (calme()) return
  const t = canon()
  const base = { particleCount: 55, spread: 62, startVelocity: 52, ticks: 220, gravity: 1, scalar: 0.95, colors: COULEURS }
  t({ ...base, angle: 60, origin: { x: 0, y: 0.8 } })
  t({ ...base, angle: 120, origin: { x: 1, y: 0.8 } })
  formes()
  if (etoile) window.setTimeout(() => t({ particleCount: 12, spread: 100, startVelocity: 30, ticks: 140, scalar: 1.6, flat: true, shapes: [etoile!], origin: { x: 0.5, y: 0.4 } }), 180)
}

/** Des feux d'artifice pendant quelques secondes (la maison est prête !). */
export function feuxDArtifice(duree = 2800) {
  if (calme()) return
  const t = canon()
  const fin = Date.now() + duree
  const bouquet = () => {
    const reste = fin - Date.now()
    if (reste <= 0) return
    const x = 0.15 + Math.random() * 0.7, y = 0.12 + Math.random() * 0.3
    t({ particleCount: 46, spread: 360, startVelocity: 24, ticks: 75, gravity: 0.7, decay: 0.92, scalar: 0.85, origin: { x, y }, colors: [COULEURS[Math.floor(Math.random() * COULEURS.length)], '#FFFFFF', '#FFC94D'] })
    window.setTimeout(bouquet, 260 + Math.random() * 260)
  }
  bouquet()
}

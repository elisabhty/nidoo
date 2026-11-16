import { drawStickers } from './stickers'
import type { DrawingData, DrawTool, Stroke } from './types'

/** Feuille de dessin : 1000 × 467, la forme d'un widget moyen d'iPhone (338 × 158). */
export const DRAW_W = 1000
export const DRAW_H = 467
export const DRAW_RATIO = DRAW_W / DRAW_H
/** Au-delà, la feuille est pleine (la base refuse les dessins trop lourds). */
export const MAX_POINTS = 14000

export const INKS = ['#1D1A2B', '#E5484D', '#F76B15', '#FFC53D', '#46A758', '#12A594', '#3E9BE9', '#6E56CF', '#D6409F', '#8D6E63', '#FFFFFF']
export const PAPERS: { key: string; label: string; bg: string }[] = [
  { key: 'blanc', label: 'Blanc', bg: '#FFFFFF' },
  { key: 'creme', label: 'Crème', bg: '#FFF6E5' },
  { key: 'rose', label: 'Rose', bg: '#FFE9EF' },
  { key: 'ciel', label: 'Ciel', bg: '#E6F2FF' },
  { key: 'nuit', label: 'Nuit', bg: '#1E1B33' },
]
export const WIDTHS: Record<DrawTool, [number, number, number]> = {
  crayon: [5, 10, 18],
  feutre: [11, 22, 42],
  arcenciel: [9, 18, 34],
  paillettes: [14, 26, 46],
  coeurs: [28, 44, 68],
  gomme: [26, 52, 96],
}

export const pointCount = (d: Pick<DrawingData, 's'>) => d.s.reduce((n, s) => n + s.p.length / 2, 0)

// ───────── Grain du crayon de couleur ─────────
// Une petite texture de papier teintée par couleur, pour que le trait accroche comme un vrai crayon.
const grains = new Map<string, HTMLCanvasElement>()
function grain(color: string): HTMLCanvasElement {
  let g = grains.get(color)
  if (g) return g
  g = document.createElement('canvas')
  g.width = g.height = 48
  const c = g.getContext('2d')!
  c.fillStyle = color
  c.fillRect(0, 0, 48, 48)
  const img = c.getImageData(0, 0, 48, 48)
  // Bruit déterministe : le même dessin a toujours le même grain.
  let seed = [...color].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let i = 3; i < img.data.length; i += 4) {
    const r = rnd()
    img.data[i] = r < 0.14 ? 40 : 150 + Math.floor(rnd() * 105)
  }
  c.putImageData(img, 0, 0)
  grains.set(color, g)
  return g
}

// ───────── Pinceaux rigolos : arc-en-ciel, paillettes, tampon cœurs ─────────
// Leur petit hasard dépend du trait lui-même : le dessin est identique chez tout le monde et à chaque relecture.

const seedOf = (p: number[]) => (Math.imul(p[0] | 0, 73856093) ^ Math.imul(p[1] | 0, 19349663) ^ p.length) >>> 0
function rng(seed: number) {
  let s = seed || 1
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

/** Des points posés à intervalle régulier le long des `n` premiers points du trait. */
function along(p: number[], n: number, step: number): [number, number][] {
  const out: [number, number][] = [[p[0], p[1]]]
  let left = step
  for (let i = 1; i < n; i++) {
    let x0 = p[i * 2 - 2], y0 = p[i * 2 - 1]
    const x1 = p[i * 2], y1 = p[i * 2 + 1]
    let d = Math.hypot(x1 - x0, y1 - y0)
    while (d >= left) {
      const k = left / d
      x0 += (x1 - x0) * k
      y0 += (y1 - y0) * k
      out.push([x0, y0])
      d -= left
      left = step
    }
    left -= d
  }
  return out
}

function smooth(ctx: CanvasRenderingContext2D, p: number[], n: number) {
  ctx.beginPath()
  ctx.moveTo(p[0], p[1])
  if (n === 1) ctx.lineTo(p[0] + 0.01, p[1])
  else {
    // Courbes passant par le milieu des segments : un trait lisse, sans angles.
    for (let i = 1; i < n - 1; i++) {
      const x = p[i * 2]
      const y = p[i * 2 + 1]
      ctx.quadraticCurveTo(x, y, (x + p[i * 2 + 2]) / 2, (y + p[i * 2 + 3]) / 2)
    }
    ctx.lineTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1])
  }
}

/** Un cœur centré en (x, y), de largeur `w`. */
export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const h = w * 0.92
  ctx.moveTo(x, y + h * 0.42)
  ctx.bezierCurveTo(x - w * 0.62, y + h * 0.02, x - w * 0.42, y - h * 0.62, x, y - h * 0.24)
  ctx.bezierCurveTo(x + w * 0.42, y - h * 0.62, x + w * 0.62, y + h * 0.02, x, y + h * 0.42)
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.quadraticCurveTo(x, y, x, y + r)
  ctx.quadraticCurveTo(x, y, x - r, y)
  ctx.quadraticCurveTo(x, y, x, y - r)
}

function fancy(ctx: CanvasRenderingContext2D, s: Stroke, n: number) {
  const p = s.p
  const rnd = rng(seedOf(p))
  if (s.o === 'arcenciel') {
    // la couleur tourne le long du trait
    const h0 = seedOf(p) % 360
    let dist = 0
    ctx.lineWidth = s.w
    for (let i = 0; i < n; i++) {
      const x0 = p[Math.max(0, i - 1) * 2], y0 = p[Math.max(0, i - 1) * 2 + 1]
      const x1 = p[i * 2], y1 = p[i * 2 + 1]
      dist += Math.hypot(x1 - x0, y1 - y0)
      ctx.strokeStyle = `hsl(${(h0 + dist * 0.45) % 360} 92% 62%)`
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(i ? x1 : x1 + 0.01, y1)
      ctx.stroke()
    }
    return
  }
  if (s.o === 'paillettes') {
    // un trait fin de la couleur, couvert de paillettes et de petites étoiles
    ctx.strokeStyle = s.c
    ctx.lineWidth = s.w * 0.62
    smooth(ctx, p, n)
    ctx.stroke()
    // un reflet brillant au milieu du trait
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = s.w * 0.18
    smooth(ctx, p, n)
    ctx.stroke()
    ctx.globalAlpha = 1
    const couleurs = ['#FFFFFF', '#FFE27A', '#FFFFFF', '#FFC1D9', '#BFF1FF']
    for (const [x, y] of along(p, n, Math.max(4, s.w * 0.3))) {
      for (let j = 0; j < 2; j++) {
        const a = rnd() * Math.PI * 2
        const d = rnd() * s.w * 0.7
        const r = s.w * (0.05 + rnd() * 0.09)
        const c = couleurs[Math.floor(rnd() * couleurs.length)]
        const star = rnd() < 0.14
        ctx.fillStyle = c
        ctx.beginPath()
        if (star) sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, s.w * (0.32 + rnd() * 0.2))
        else ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return
  }
  // tampon cœurs
  const pts = along(p, n, s.w * 1.2)
  pts.forEach(([x, y], i) => {
    const a = ((i % 2 ? 1 : -1) * 0.2 + (rnd() - 0.5) * 0.25)
    const w = s.w * (0.85 + rnd() * 0.3)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a)
    ctx.fillStyle = s.c
    ctx.beginPath()
    heartPath(ctx, 0, 0, w)
    ctx.fill()
    if (s.c !== '#FFFFFF') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.ellipse(-w * 0.2, -w * 0.12, w * 0.09, w * 0.06, -0.6, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = 'rgba(29,26,43,0.18)'
      ctx.lineWidth = 2
      ctx.beginPath()
      heartPath(ctx, 0, 0, w)
      ctx.stroke()
    }
    ctx.restore()
  })
}

/**
 * Trace un trait (ou ses `n` premiers points) dans un contexte déjà mis à l'échelle de la feuille.
 * La gomme efface pour de vrai (on revoit la photo ou le papier dessous) ; en aperçu, elle se montre en blanc voilé.
 */
export function strokePath(ctx: CanvasRenderingContext2D, s: Stroke, _bg: string, n = s.p.length / 2, live = false) {
  const p = s.p
  if (n < 1) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = s.w
  if (s.o === 'arcenciel' || s.o === 'paillettes' || s.o === 'coeurs') {
    fancy(ctx, s, n)
    ctx.restore()
    return
  }
  if (s.o === 'gomme') {
    if (live) ctx.strokeStyle = 'rgba(255,255,255,0.72)'
    else {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'
    }
  }
  else if (s.o === 'crayon') {
    const pat = ctx.createPattern(grain(s.c), 'repeat')
    pat?.setTransform(new DOMMatrix().scale(0.5))
    ctx.strokeStyle = pat ?? s.c
  } else ctx.strokeStyle = s.c
  smooth(ctx, p, n)
  ctx.stroke()
  ctx.restore()
}

/** Prépare un canvas à sa taille affichée (écrans Retina compris) et renvoie un contexte en unités de feuille. */
export function fit(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const r = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const w = Math.max(1, Math.round(r.width * dpr))
  const h = Math.max(1, Math.round(r.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(w / DRAW_W, 0, 0, h / DRAW_H, 0, 0)
  return ctx
}

// Les traits sont peints sur un calque à part, posé ensuite sur la photo ou le papier.
const layers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
function layerOf(c: HTMLCanvasElement) {
  let l = layers.get(c)
  if (!l) {
    l = document.createElement('canvas')
    layers.set(c, l)
  }
  if (l.width !== c.width || l.height !== c.height) {
    l.width = c.width
    l.height = c.height
  }
  return l
}

/** La photo couvre toute la feuille ; py choisit la hauteur gardée (0 : le haut, 1 : le bas). */
export function photoBox(img: { width: number; height: number }, py = 0.5) {
  const r = img.width / img.height
  if (r >= DRAW_RATIO) {
    const w = DRAW_H * r
    return { x: (DRAW_W - w) / 2, y: 0, w, h: DRAW_H, overflow: 0 }
  }
  const h = DRAW_W / r
  return { x: 0, y: -(h - DRAW_H) * py, w: DRAW_W, h, overflow: (h - DRAW_H) / DRAW_H }
}

/**
 * Peint la photo ou le papier, puis le dessin entier ou seulement ses `upto` premiers points, puis les stickers.
 * `stickers` : false pour ne pas les coller (on les montre à part pendant qu'on les déplace), ou 0 → 1 pour les faire apparaître.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  d: DrawingData,
  upto = Infinity,
  withBg = true,
  photo?: HTMLImageElement | null,
  opts: { stickers?: number | false; onLoad?: () => void } = {},
) {
  const c = ctx.canvas
  const m = ctx.getTransform()
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.restore()
  if (withBg) {
    if (photo) {
      const b = photoBox(photo, d.py ?? 0.5)
      ctx.drawImage(photo, b.x, b.y, b.w, b.h)
    } else {
      ctx.fillStyle = d.bg
      ctx.fillRect(0, 0, DRAW_W, DRAW_H)
    }
  }
  const l = layerOf(c)
  const lc = l.getContext('2d')!
  lc.setTransform(1, 0, 0, 1, 0, 0)
  lc.clearRect(0, 0, l.width, l.height)
  lc.setTransform(m)
  let left = upto
  for (const s of d.s) {
    if (left <= 0) break
    const n = s.p.length / 2
    strokePath(lc, s, d.bg, Math.min(n, left))
    left -= n
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(l, 0, 0)
  ctx.restore()
  if (d.k?.length && opts.stickers !== false) drawStickers(ctx, d.k, opts.stickers ?? 1, opts.onLoad)
}

// Photos des instants : chargées une fois, partagées entre toutes les toiles.
const photos = new Map<string, HTMLImageElement>()
export function loadPhoto(url: string, onLoad: () => void): HTMLImageElement | null {
  let img = photos.get(url)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.src = url
    photos.set(url, img)
  }
  if (img.complete && img.naturalWidth) return img
  img.addEventListener('load', onLoad, { once: true })
  return null
}

/** Durée de la « relecture » : assez longue pour voir le geste, jamais interminable ; puis les stickers se collent un à un. */
export function replayParts(d: DrawingData) {
  const traits = pointCount(d) ? Math.min(6000, Math.max(2200, pointCount(d) * 6)) : 0
  const n = d.k?.length ?? 0
  const stickers = n ? Math.min(1600, 450 + n * 110) : 0
  return { traits, stickers, total: Math.max(600, traits + stickers) }
}
export const replayMs = (d: DrawingData) => replayParts(d).total

// ───────── Dessins de démonstration ─────────
// Tracés à la main (un peu tremblés) par les proches fictifs du mode démo.

function wobble(points: [number, number][], amp: number, seed: number): number[] {
  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2
  return points.flatMap(([x, y]) => [Math.round(x + rnd() * amp), Math.round(y + rnd() * amp)])
}
const curve = (n: number, f: (t: number) => [number, number]) => Array.from({ length: n + 1 }, (_, i) => f(i / n))
const heart = (cx: number, cy: number, r: number): [number, number][] =>
  curve(64, (t) => {
    const a = t * Math.PI * 2
    return [cx + r * 16 * Math.sin(a) ** 3 / 16, cy - (r * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))) / 16]
  })
const circle = (cx: number, cy: number, r: number, from = 0, to = Math.PI * 2, n = 48): [number, number][] =>
  curve(n, (t) => [cx + r * Math.cos(from + (to - from) * t), cy + r * Math.sin(from + (to - from) * t)])

export type DemoArt = 'coeurs' | 'soleil' | 'fleur' | 'maison'
export function demoDrawing(kind: DemoArt, seed = 1): DrawingData {
  const S = (o: DrawTool, c: string, w: number, pts: [number, number][], amp = 3): Stroke => ({ o, c, w, p: wobble(pts, amp, seed++) })
  switch (kind) {
    case 'coeurs':
      return {
        v: 1,
        bg: '#FFE9EF',
        s: [
          S('feutre', '#E5484D', 26, heart(500, 250, 140)),
          S('crayon', '#E5484D', 18, heart(500, 250, 112), 4),
          S('feutre', '#D6409F', 14, heart(230, 150, 54)),
          S('feutre', '#F76B15', 14, heart(780, 140, 46)),
          S('feutre', '#6E56CF', 12, heart(820, 350, 38)),
          S('feutre', '#D6409F', 12, heart(170, 360, 34)),
        ],
      }
    case 'soleil':
      return {
        v: 1,
        bg: '#E6F2FF',
        s: [
          S('feutre', '#FFC53D', 30, circle(500, 230, 105), 2),
          S('crayon', '#FFC53D', 80, circle(500, 230, 40, 0, Math.PI * 2, 40), 2),
          ...Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return S('feutre', '#F76B15', 14, [[500 + Math.cos(a) * 140, 230 + Math.sin(a) * 140], [500 + Math.cos(a) * 200, 230 + Math.sin(a) * 200]], 4)
          }),
          S('feutre', '#1D1A2B', 14, circle(462, 205, 4, 0, Math.PI * 2, 8), 1),
          S('feutre', '#1D1A2B', 14, circle(538, 205, 4, 0, Math.PI * 2, 8), 1),
          S('feutre', '#1D1A2B', 11, circle(500, 238, 42, 0.2 * Math.PI, 0.8 * Math.PI, 20), 2),
          S('feutre', '#FFFFFF', 18, curve(20, (t) => [110 + t * 150, 90 + Math.sin(t * Math.PI) * -28]), 3),
          S('feutre', '#FFFFFF', 18, curve(20, (t) => [760 + t * 150, 380 + Math.sin(t * Math.PI) * -24]), 3),
        ],
      }
    case 'fleur':
      return {
        v: 1,
        bg: '#FFF6E5',
        s: [
          S('feutre', '#46A758', 16, curve(30, (t) => [500 + Math.sin(t * 3) * 18, 230 + t * 230]), 2),
          S('feutre', '#46A758', 14, curve(20, (t) => [505 + t * 90, 360 - Math.sin(t * Math.PI) * 50]), 2),
          ...Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2
            return S('feutre', '#D6409F', 18, circle(500 + Math.cos(a) * 62, 180 + Math.sin(a) * 62, 42, 0, Math.PI * 2, 36), 3)
          }),
          S('crayon', '#FFC53D', 52, circle(500, 180, 18, 0, Math.PI * 2, 24), 2),
          S('crayon', '#3E9BE9', 10, curve(30, (t) => [130 + t * 160, 120 + Math.sin(t * Math.PI * 4) * 22]), 3),
          S('crayon', '#3E9BE9', 10, curve(30, (t) => [710 + t * 170, 110 + Math.sin(t * Math.PI * 4) * 20]), 3),
        ],
      }
    case 'maison':
      return {
        v: 1,
        bg: '#FFFFFF',
        s: [
          S('feutre', '#8D6E63', 16, [[380, 420], [380, 230], [620, 230], [620, 420], [380, 420]], 3),
          S('feutre', '#E5484D', 18, [[350, 245], [500, 110], [650, 245]], 3),
          S('feutre', '#6E56CF', 12, [[470, 420], [470, 330], [530, 330], [530, 420]], 2),
          S('crayon', '#3E9BE9', 30, [[415, 270], [450, 270], [450, 305], [415, 305], [415, 270]], 2),
          S('crayon', '#3E9BE9', 30, [[550, 270], [585, 270], [585, 305], [550, 305], [550, 270]], 2),
          S('feutre', '#E5484D', 10, heart(760, 150, 40)),
          S('feutre', '#46A758', 12, curve(40, (t) => [60 + t * 880, 430 + Math.sin(t * 30) * 6]), 2),
        ],
      }
  }
}

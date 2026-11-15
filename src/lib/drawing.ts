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

/** Trace un trait (ou ses `n` premiers points) dans un contexte déjà mis à l'échelle de la feuille. */
export function strokePath(ctx: CanvasRenderingContext2D, s: Stroke, bg: string, n = s.p.length / 2) {
  const p = s.p
  if (n < 1) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = s.w
  if (s.o === 'gomme') ctx.strokeStyle = bg
  else if (s.o === 'crayon') {
    const pat = ctx.createPattern(grain(s.c), 'repeat')
    pat?.setTransform(new DOMMatrix().scale(0.5))
    ctx.strokeStyle = pat ?? s.c
  } else ctx.strokeStyle = s.c
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

/** Peint le dessin entier, ou seulement ses `upto` premiers points (pour le voir se dessiner). */
export function paint(ctx: CanvasRenderingContext2D, d: DrawingData, upto = Infinity, withBg = true) {
  ctx.clearRect(0, 0, DRAW_W, DRAW_H)
  if (withBg) {
    ctx.fillStyle = d.bg
    ctx.fillRect(0, 0, DRAW_W, DRAW_H)
  }
  let left = upto
  for (const s of d.s) {
    if (left <= 0) break
    const n = s.p.length / 2
    strokePath(ctx, s, d.bg, Math.min(n, left))
    left -= n
  }
}

/** Durée de la « relecture » : assez longue pour voir le geste, jamais interminable. */
export const replayMs = (d: DrawingData) => Math.min(6000, Math.max(2200, pointCount(d) * 6))

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

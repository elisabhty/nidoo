import { peindreCadre } from './cadres'
import { drawStickers, prechargerStickers } from './stickers'
import type { Sticker } from './types'

/**
 * Les filtres photo et la « cuisson » des stickers sur une photo.
 * Les filtres sont calculés pixel par pixel (ctx.filter n'existe pas partout sur iPhone),
 * une seule fois quand on choisit, et la photo envoyée est déjà filtrée.
 */

export type FiltreKey = 'aucun' | 'doux' | 'pop' | 'nb' | 'retro' | 'reve'
export const FILTRES: { key: FiltreKey; label: string }[] = [
  { key: 'aucun', label: 'Normal' },
  { key: 'doux', label: 'Doux' },
  { key: 'pop', label: 'Pop' },
  { key: 'nb', label: 'N&B' },
  { key: 'retro', label: 'Rétro' },
  { key: 'reve', label: 'Rêve' },
]

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

export function appliquerFiltre(img: ImageData, f: FiltreKey) {
  if (f === 'aucun') return
  const d = img.data
  const W = img.width
  const H = img.height
  const cx = W / 2
  const cy = H / 2
  const rmax = Math.hypot(cx, cy)
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    if (f === 'doux') {
      // plus chaud, plus tendre : les noirs se lèvent un peu
      r = r * 0.9 + 22
      g = g * 0.9 + 14
      b = b * 0.86 + 12
      const m = 0.299 * r + 0.587 * g + 0.114 * b
      r = m + (r - m) * 0.9
      g = m + (g - m) * 0.9
      b = m + (b - m) * 0.9
    } else if (f === 'pop') {
      // couleurs vives et contrastées
      r = l + (r - l) * 1.45
      g = l + (g - l) * 1.45
      b = l + (b - l) * 1.45
      r = (r - 128) * 1.14 + 132
      g = (g - 128) * 1.14 + 130
      b = (b - 128) * 1.14 + 128
    } else if (f === 'nb') {
      const v = (l - 128) * 1.16 + 130
      r = g = b = v
    } else if (f === 'retro') {
      // sépia doux, noirs délavés et coins assombris
      const sr = 0.393 * r + 0.769 * g + 0.189 * b
      const sg = 0.349 * r + 0.686 * g + 0.168 * b
      const sb = 0.272 * r + 0.534 * g + 0.131 * b
      r = (r * 0.35 + sr * 0.65) * 0.86 + 24
      g = (g * 0.35 + sg * 0.65) * 0.86 + 20
      b = (b * 0.35 + sb * 0.65) * 0.86 + 18
      const p = i / 4
      const x = p % W
      const y = (p - x) / W
      const k = 1 - 0.38 * (Math.hypot(x - cx, y - cy) / rmax) ** 2
      r *= k
      g *= k
      b *= k
    } else if (f === 'reve') {
      // pastel rosé et lumineux
      const m = l
      r = m + (r - m) * 0.8
      g = m + (g - m) * 0.8
      b = m + (b - m) * 0.8
      r = (r - 128) * 0.88 + 128 + 26
      g = (g - 128) * 0.88 + 128 + 10
      b = (b - 128) * 0.88 + 128 + 24
    }
    d[i] = clamp(r)
    d[i + 1] = clamp(g)
    d[i + 2] = clamp(b)
  }
}

export function chargerImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('IMAGE_ILLISIBLE'))
    }
    i.src = url
  })
}

const versBlob = (c: HTMLCanvasElement, q = 0.88) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('IMAGE_ILLISIBLE'))), 'image/jpeg', q))

/**
 * La photo telle qu'elle partira : filtrée, avec ses stickers collés par-dessus.
 * Les stickers sont en unités d'une feuille de 1000 de large (la hauteur suit la photo).
 */
export async function photoFinale(blob: Blob, f: FiltreKey, k: Sticker[] = [], cadre?: string): Promise<Blob> {
  if (f === 'aucun' && !k.length && !cadre) return blob
  const img = await chargerImage(blob)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(img.src)
  if (f !== 'aucun') {
    const data = ctx.getImageData(0, 0, c.width, c.height)
    appliquerFiltre(data, f)
    ctx.putImageData(data, 0, 0)
  }
  if (cadre) {
    const z = c.width / 1000
    const H = c.height / z
    ctx.setTransform(z, 0, 0, z, 0, 0)
    // le cadre peut avoir besoin d'images (fleurs, ballons) : on attend qu'elles soient là
    await new Promise<void>((res) => {
      const essai = () => {
        const t = document.createElement('canvas').getContext('2d')!
        if (peindreCadre(t, cadre, 1000, H, essai)) res()
      }
      essai()
      setTimeout(res, 4000)
    })
    peindreCadre(ctx, cadre, 1000, H)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  if (k.length) {
    // les images des stickers sont déjà là (on vient de les montrer) ; au cas où, on attend qu'elles arrivent
    await new Promise<void>((res) => {
      const essai = () => {
        if (prechargerStickers(k, essai)) res()
      }
      essai()
      setTimeout(res, 4000)
    })
    const z = c.width / 1000
    ctx.setTransform(z, 0, 0, z, 0, 0)
    drawStickers(ctx, k)
  }
  return versBlob(c)
}

/** Les petites vignettes des filtres, calculées sur une photo réduite. */
export async function vignettesFiltres(blob: Blob, taille = 96): Promise<Record<FiltreKey, string>> {
  const img = await chargerImage(blob)
  const c = document.createElement('canvas')
  const s = Math.min(img.naturalWidth, img.naturalHeight)
  c.width = c.height = taille
  const ctx = c.getContext('2d')!
  const out = {} as Record<FiltreKey, string>
  for (const { key } of FILTRES) {
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, taille, taille)
    const d = ctx.getImageData(0, 0, taille, taille)
    appliquerFiltre(d, key)
    ctx.putImageData(d, 0, 0)
    out[key] = c.toDataURL('image/jpeg', 0.8)
  }
  URL.revokeObjectURL(img.src)
  return out
}

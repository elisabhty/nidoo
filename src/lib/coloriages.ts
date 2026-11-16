/**
 * Les coloriages : un dessin au trait (généré avec ElevenLabs) posé par-dessus ce qu'on colorie,
 * et sa carte des zones (public/art/coloriages/<clé>-z.png, calculée par scripts/coloriages.py) :
 * chaque zone fermée a son numéro (rouge + vert × 256), pour le pot de peinture.
 * Tout est à la taille de la feuille : 1000 × 467.
 */

export const COLORIAGES: { key: string; label: string }[] = [
  { key: 'maison', label: 'La maison' },
  { key: 'panda', label: 'Le panda roux' },
  { key: 'chats', label: 'Les chatons' },
  { key: 'licorne', label: 'La licorne' },
  { key: 'dino', label: 'Le bébé dino' },
  { key: 'fusee', label: 'La fusée' },
  { key: 'mer', label: 'Sous la mer' },
  { key: 'jardin', label: 'Le potager' },
  { key: 'ferme', label: 'La ferme' },
  { key: 'gateau', label: 'L’anniversaire' },
  { key: 'noel', label: 'Noël' },
]

export const coloriageUrl = (k: string) => `./art/coloriages/${k}.webp`
const zonesUrl = (k: string) => `./art/coloriages/${k}-z.png`

export type Page = {
  art: HTMLImageElement
  w: number
  h: number
  lab: Uint16Array
  /** le cadre de chaque zone : x0, y0, x1, y1 */
  box: Map<number, [number, number, number, number]>
}

const pages = new Map<string, Page>()
const attente = new Map<string, Set<() => void>>()

function charger(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.decoding = 'async'
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('IMAGE_ILLISIBLE'))
    i.src = src
  })
}

/** La page prête (dessin et zones), ou null : `onLoad` sera appelé quand elle le sera. */
export function pageColoriage(k: string, onLoad?: () => void): Page | null {
  const p = pages.get(k)
  if (p) return p
  let w = attente.get(k)
  if (!w) {
    w = new Set()
    attente.set(k, w)
    void Promise.all([charger(coloriageUrl(k)), charger(zonesUrl(k))])
      .then(([art, z]) => {
        const c = document.createElement('canvas')
        c.width = z.naturalWidth
        c.height = z.naturalHeight
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(z, 0, 0)
        const d = ctx.getImageData(0, 0, c.width, c.height).data
        const lab = new Uint16Array(c.width * c.height)
        const box = new Map<number, [number, number, number, number]>()
        for (let i = 0, y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++, i++) {
            const L = d[i * 4] + d[i * 4 + 1] * 256
            lab[i] = L
            const b = box.get(L)
            if (!b) box.set(L, [x, y, x, y])
            else {
              if (x < b[0]) b[0] = x
              if (x > b[2]) b[2] = x
              if (y > b[3]) b[3] = y
            }
          }
        }
        pages.set(k, { art, w: c.width, h: c.height, lab, box })
        const subs = attente.get(k)
        attente.delete(k)
        subs?.forEach((f) => f())
      })
      .catch(() => attente.delete(k))
  }
  if (onLoad) w.add(onLoad)
  return null
}

/** Le numéro de la zone sous un point de la feuille (W × H unités). */
export function zoneEn(p: Page, x: number, y: number, W: number, H: number) {
  const px = Math.max(0, Math.min(p.w - 1, Math.round((x / W) * p.w)))
  const py = Math.max(0, Math.min(p.h - 1, Math.round((y / H) * p.h)))
  return p.lab[py * p.w + px]
}

const masques = new Map<string, HTMLCanvasElement>()

/** Remplit la zone sous (x, y) avec la couleur, dans un contexte en unités de feuille. */
export function remplirZone(ctx: CanvasRenderingContext2D, key: string, p: Page, x: number, y: number, color: string, W: number, H: number) {
  const L = zoneEn(p, x, y, W, H)
  const b = p.box.get(L)
  if (!b) return
  const cle = `${key}:${L}:${color}`
  let m = masques.get(cle)
  if (!m) {
    const [x0, y0, x1, y1] = b
    m = document.createElement('canvas')
    m.width = x1 - x0 + 1
    m.height = y1 - y0 + 1
    const mc = m.getContext('2d')!
    const img = mc.createImageData(m.width, m.height)
    const n = parseInt(color.slice(1), 16)
    const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        if (p.lab[yy * p.w + xx] !== L) continue
        const j = ((yy - y0) * m.width + (xx - x0)) * 4
        img.data[j] = r
        img.data[j + 1] = g
        img.data[j + 2] = bl
        img.data[j + 3] = 255
      }
    }
    mc.putImageData(img, 0, 0)
    if (masques.size > 300) masques.delete(masques.keys().next().value!)
    masques.set(cle, m)
  }
  ctx.drawImage(m, (b[0] / p.w) * W, (b[1] / p.h) * H, (m.width / p.w) * W, (m.height / p.h) * H)
}

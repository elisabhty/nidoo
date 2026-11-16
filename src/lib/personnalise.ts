// Personnaliser une figurine.
// La peau : chaque figurine existe en plusieurs couleurs de peau, de vraies images refaites par l'IA à partir
// de la figurine (public/art/persos/<id>-t<k>.webp, liste dans peaux.ts). On ne recolore jamais la peau
// pixel par pixel : ça laissait des taches autour des lunettes, des joues et des mains.
// Les cheveux (ou le voile) et les yeux, eux, sont recolorés dans le navigateur grâce aux
// masques de la figurine (public/art/persos/<id>-m.webp : vert = cheveux, bleu 255 = iris, 170 = bouche,
// 85 = sourcils), qui servent aussi pour ses autres peaux (elles sont recalées dessus). Le relief de la
// feutrine est gardé : on décale la couleur moyenne, pas la texture. Nez, bouche, taches de rousseur, blush
// et lunettes sont dessinés par-dessus (voir Character).

import { lookOf, type Look } from './look'
import { persoOf, type Perso } from './persos'
import { PEAUX, type Peau } from './peaux'
import { VISAGES } from './visages'

export type Teinte = { label: string; lab: [number, number, number] }

/** La clarté habituelle de chaque série de peaux (pour retrouver la plus proche sur une autre figurine). */
const CLARTE: Record<number, number> = { 1: 82, 2: 77, 3: 63, 4: 55, 5: 24, 6: 44 }

/** Le nom d'une couleur de peau, d'après sa clarté. */
export function nomPeau(L: number) {
  if (L >= 80) return 'Très claire'
  if (L >= 73) return 'Claire'
  if (L >= 63) return 'Dorée'
  if (L >= 53) return 'Caramel'
  if (L >= 36) return 'Brune'
  return 'Foncée'
}

/** Les peaux d'une figurine : la sienne (t = 0) puis les autres, de la plus claire à la plus foncée. */
export function peauxDe(p: Perso): Peau[] {
  const sk = VISAGES[p.id]?.sk ?? [75, 12, 28]
  return [{ t: 0, lab: sk, b: p.t }, ...(PEAUX[p.id] ?? [])]
}

/** La peau affichée : celle demandée si la figurine l'a, sinon la plus proche (0 = la sienne). */
export function peauOf(p: Perso, look: Look): number {
  const q = look.q ?? 0
  if (!q) return 0
  const list = PEAUX[p.id] ?? []
  if (list.some((x) => x.t === q)) return q
  const L = CLARTE[q] ?? 70
  const best = peauxDe(p).reduce((a, b) => (Math.abs(b.lab[0] - L) < Math.abs(a.lab[0] - L) ? b : a))
  return best.t
}

/** Pour passer d'une figurine à une autre en gardant à peu près la même peau. */
export function peauProche(p: Perso, lab: [number, number, number]): number {
  return peauxDe(p).reduce((a, b) => (Math.abs(b.lab[0] - lab[0]) < Math.abs(a.lab[0] - lab[0]) ? b : a)).t
}

/** L'image de la figurine avec cette peau. */
export const persoImg = (p: Perso, t: number) => `./art/persos/${p.id}${t ? `-t${t}` : ''}.webp`
export const CHEVEUX: Teinte[] = [
  { label: 'Noirs', lab: [13, 2, 3] },
  { label: 'Bruns', lab: [22, 8, 13] },
  { label: 'Châtains', lab: [42, 15, 29] },
  { label: 'Blonds', lab: [71, 11, 33] },
  { label: 'Blond clair', lab: [81, 5, 27] },
  { label: 'Roux', lab: [47, 28, 40] },
  { label: 'Gris', lab: [68, 1, 5] },
  { label: 'Blancs', lab: [88, 1, 6] },
  { label: 'Roses', lab: [72, 32, 2] },
  { label: 'Bleus', lab: [44, 6, -36] },
  { label: 'Violets', lab: [48, 30, -30] },
]
export const VOILES: Teinte[] = [
  { label: 'Rose', lab: [72, 17, 13] },
  { label: 'Bleu marine', lab: [23, 4, -12] },
  { label: 'Beige', lab: [74, 6, 20] },
  { label: 'Lilas', lab: [66, 15, -4] },
  { label: 'Sauge', lab: [66, -13, 15] },
  { label: 'Bordeaux', lab: [32, 32, 10] },
  { label: 'Noir', lab: [16, 1, 1] },
  { label: 'Blanc', lab: [91, 1, 6] },
  { label: 'Moutarde', lab: [70, 8, 55] },
  { label: 'Ciel', lab: [72, -6, -22] },
]
export const YEUX: Teinte[] = [
  { label: 'Marron', lab: [26, 13, 22] },
  { label: 'Noisette', lab: [38, 11, 32] },
  { label: 'Verts', lab: [40, -24, 20] },
  { label: 'Bleus', lab: [42, -2, -34] },
  { label: 'Gris', lab: [48, -2, -7] },
  { label: 'Noirs', lab: [8, 2, 2] },
]
export const MONTURES: { label: string; hex: string }[] = [
  { label: 'Noire', hex: '#2B2540' },
  { label: 'Écaille', hex: '#7A4A2A' },
  { label: 'Dorée', hex: '#C9A23F' },
  { label: 'Rouge', hex: '#C8323F' },
  { label: 'Bleue', hex: '#3E6FC9' },
  { label: 'Rose', hex: '#E77BA0' },
]
export const LUNETTES = ['Sans', 'Rondes', 'Carrées', 'Papillon']
export const NEZ = ['Le sien', 'Bouton', 'Rond', 'Retroussé']
export const BOUCHES = ['La sienne', 'Grand sourire', 'Petit sourire', 'Rire', 'Bisou']
export const BLUSH = ['Sans', 'Léger', 'Bien rose']

// ───────── couleurs ─────────

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const fl = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
const fi = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)

export function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255)
  const x = fl((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047)
  const y = fl(R * 0.2126 + G * 0.7152 + B * 0.0722)
  const z = fl((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
export function lab2rgb(L: number, a: number, b: number): [number, number, number] {
  const y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200
  const X = fi(x) * 0.95047, Y = fi(y), Z = fi(z) * 1.08883
  const R = gam(X * 3.2406 + Y * -1.5372 + Z * -0.4986)
  const G = gam(X * -0.9689 + Y * 1.8758 + Z * 0.0415)
  const B = gam(X * 0.0557 + Y * -0.204 + Z * 1.057)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return [c(R), c(G), c(B)]
}
export const labHex = (lab: [number, number, number]) => `#${lab2rgb(...lab).map((v) => v.toString(16).padStart(2, '0')).join('')}`

// ───────── le rendu ─────────

/** Ce qui change les pixels de la figurine (le reste se dessine par-dessus). */
export function pixelKey(p: Perso, look: Look) {
  const v = VISAGES[p.id]
  if (!v) return ''
  const x = v.ha ? look.x ?? 0 : 0, y = look.y ?? 0
  const feat = v.bouche && ((look.n ?? 0) > 0 || (look.u ?? 0) > 0)
  if (!x && !y && !feat) return ''
  return `${p.id}.${peauOf(p, look)}.${x}.${y}.${feat ? 1 : 0}.${(look.u ?? 0) > 0 ? 1 : 0}`
}

/** La couleur de peau affichée (pour dessiner le nez et le blush par-dessus). */
export function skinLab(p: Perso, look: Look): [number, number, number] {
  const t = peauOf(p, look)
  return (t && PEAUX[p.id]?.find((x) => x.t === t)?.lab) || VISAGES[p.id]?.sk || [75, 12, 28]
}

const cache = new Map<string, Promise<string>>()
const done = new Map<string, string>()
const load = (src: string) =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = ko
    im.src = src
  })

export function cachedSrc(key: string) {
  return done.get(key)
}

export function renderPerso(p: Perso, look: Look): Promise<string> {
  const key = pixelKey(p, look)
  const t = peauOf(p, look)
  if (!key) return Promise.resolve(persoImg(p, t))
  const hit = cache.get(key)
  if (hit) return hit
  const job = (async () => {
    const v = VISAGES[p.id]
    const feat = v.bouche && ((look.n ?? 0) > 0 || (look.u ?? 0) > 0)
    const [base, mask, patch] = await Promise.all([
      load(persoImg(p, t)),
      load(`./art/persos/${p.id}-m.webp`),
      feat ? load(`./art/persos/${p.id}${t ? `-t${t}` : ''}-v.webp`) : Promise.resolve(null),
    ])
    const W = base.naturalWidth, H = base.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(base, 0, 0)
    // un autre nez ou une autre bouche : on efface d'abord ceux de la figurine
    if (patch) ctx.drawImage(patch, v.p[0], v.p[1])
    const img = ctx.getImageData(0, 0, W, H)
    const mc = document.createElement('canvas')
    mc.width = W
    mc.height = H
    const mctx = mc.getContext('2d', { willReadFrequently: true })!
    mctx.drawImage(mask, 0, 0)
    const m = mctx.getImageData(0, 0, W, H).data
    const d = img.data
    const x = v.ha ? look.x ?? 0 : 0, y = look.y ?? 0
    const hT = x ? (p.c === 'voile' ? VOILES : CHEVEUX)[x - 1]?.lab : null
    const eT = y ? YEUX[y - 1]?.lab : null
    const ha = v.ha, ir = v.ir
    // les cheveux sombres qui deviennent clairs gagnent du relief, et inversement
    const hs = hT && ha ? Math.max(0.55, Math.min(2.4, (hT[0] + 10) / (ha[0] + 10))) : 1
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue
      const wh = m[i + 1] / 255, cls = m[i + 2]
      const iris = cls > 230
      const brow = cls > 60 && cls < 110
      const wHair = hT ? wh : 0
      const wBrow = hT && brow ? 0.85 : 0
      const wEye = eT && iris ? 1 : 0
      if (!wHair && !wEye && !wBrow) continue
      const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
      let nL = L, nA = A, nB = B
      // garde-fou : la raie, un bout de peau, un bijou classés « cheveux » gardent leur couleur
      const wH = wHair && ha ? wHair * Math.max(0, Math.min(1, (26 - Math.hypot(A - ha[1], B - ha[2])) / 9)) : 0
      if (wH && ha) {
        nL += wH * (hT![0] + (L - ha[0]) * hs - nL)
        nA += wH * (hT![1] + (A - ha[1]) * 0.6 - nA)
        nB += wH * (hT![2] + (B - ha[2]) * 0.6 - nB)
      }
      // les sourcils prennent la couleur des cheveux
      // (un peu plus foncés que les cheveux, comme de vrais sourcils)
      if (wBrow) {
        nL += wBrow * (hT![0] * 0.72 + (L - 50) * 0.3 - nL)
        nA += wBrow * (hT![1] * 0.75 - nA)
        nB += wBrow * (hT![2] * 0.75 - nB)
      }
      if (wEye) {
        nL = eT![0] + (L - ir[0]) * 1.1
        nA = eT![1] + (A - ir[1]) * 0.5
        nB = eT![2] + (B - ir[2]) * 0.5
      }
      const [r, g, b] = lab2rgb(nL, nA, nB)
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
    }
    ctx.putImageData(img, 0, 0)
    const url = await new Promise<string>((ok) => cv.toBlob((bl) => ok(bl ? URL.createObjectURL(bl) : cv.toDataURL()), 'image/webp', 0.9))
    done.set(key, url)
    return url
  })()
  cache.set(key, job)
  job.catch(() => cache.delete(key))
  return job
}

/** La main (en feutrine) de la bonne couleur pour caresser : celle de la peau de son personnage (1 très claire … 5 foncée). */
export function teinteMain(avatar?: string | null): number {
  if (!avatar) return 2
  const look = lookOf(avatar)
  const L = skinLab(persoOf(look), look)[0]
  return L >= 78 ? 1 : L >= 68 ? 2 : L >= 55 ? 3 : L >= 38 ? 4 : 5
}

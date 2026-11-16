// Personnaliser une figurine : la peau, les cheveux (ou le voile) et les yeux sont recolorés dans le navigateur,
// pixel par pixel, grâce aux masques calculés pour chaque figurine (public/art/persos/<id>-m.webp :
// rouge = peau, vert = cheveux, bleu 255 = iris, 170 = bouche). Le relief de la feutrine est gardé :
// on décale la couleur moyenne, pas la texture. Nez, bouche, taches de rousseur, blush et lunettes
// sont dessinés par-dessus (voir Character).

import type { Look } from './look'
import type { Perso } from './persos'
import { VISAGES } from './visages'

export type Teinte = { label: string; lab: [number, number, number] }

export const TEINTS: Teinte[] = [
  { label: 'Très clair', lab: [83, 8, 19] },
  { label: 'Clair', lab: [77, 11, 26] },
  { label: 'Doré', lab: [71, 14, 32] },
  { label: 'Mat', lab: [65, 17, 36] },
  { label: 'Caramel', lab: [57, 19, 37] },
  { label: 'Brun', lab: [48, 19, 34] },
  { label: 'Foncé', lab: [38, 17, 28] },
  { label: 'Ébène', lab: [29, 13, 20] },
]
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
export const LEVRES: Teinte[] = [
  { label: 'Rose', lab: [60, 46, 8] },
  { label: 'Rouge', lab: [42, 56, 32] },
  { label: 'Corail', lab: [63, 42, 38] },
  { label: 'Prune', lab: [34, 30, -3] },
  { label: 'Nude', lab: [63, 22, 20] },
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
  const q = look.q ?? 0, x = v.ha ? look.x ?? 0 : 0, y = look.y ?? 0, l = look.l ?? 0
  const feat = v.bouche && ((look.n ?? 0) > 0 || (look.u ?? 0) > 0)
  if (!q && !x && !y && !l && !feat) return ''
  return `${p.id}.${q}.${x}.${y}.${l}.${feat ? 1 : 0}.${(look.u ?? 0) > 0 ? 1 : 0}`
}

/** La couleur de peau affichée (pour dessiner le nez et le blush par-dessus). */
export function skinLab(p: Perso, look: Look): [number, number, number] {
  const q = look.q ?? 0
  return q ? TEINTS[q - 1].lab : VISAGES[p.id]?.sk ?? [75, 12, 28]
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
  if (!key) return Promise.resolve(`./art/persos/${p.id}.webp`)
  const hit = cache.get(key)
  if (hit) return hit
  const job = (async () => {
    const v = VISAGES[p.id]
    const feat = v.bouche && ((look.n ?? 0) > 0 || (look.u ?? 0) > 0)
    const [base, mask, patch] = await Promise.all([
      load(`./art/persos/${p.id}.webp`),
      load(`./art/persos/${p.id}-m.webp`),
      feat ? load(`./art/persos/${p.id}-v.webp`) : Promise.resolve(null),
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
    const q = look.q ?? 0, x = v.ha ? look.x ?? 0 : 0, y = look.y ?? 0, l = look.l ?? 0
    const sT = q ? TEINTS[q - 1].lab : null
    const hT = x ? (p.c === 'voile' ? VOILES : CHEVEUX)[x - 1]?.lab : null
    const eT = y ? YEUX[y - 1]?.lab : null
    const lT = l ? LEVRES[l - 1]?.lab : null
    const sk = v.sk, ha = v.ha, ir = v.ir
    // les cheveux sombres qui deviennent clairs gagnent du relief, et inversement
    const hs = hT && ha ? Math.max(0.55, Math.min(2.4, (hT[0] + 10) / (ha[0] + 10))) : 1
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue
      const ws = m[i] / 255, wh = m[i + 1] / 255, cls = m[i + 2]
      const mouth = cls > 150 && cls < 200
      const iris = cls > 230
      const brow = cls > 60 && cls < 110
      let wSkin = sT ? ws : 0
      // la bouche suit la peau (elle reste plus foncée), sauf si on met du rouge à lèvres
      const mouthSkin = !!sT && mouth && !feat && !lT
      if (mouth && !feat) wSkin = mouthSkin ? 1 : 0
      const wHair = hT ? wh : 0
      const wBrow = hT && brow ? 0.85 : 0
      const wEye = eT && iris ? 1 : 0
      const wLip = lT && mouth && !feat ? 0.85 : 0
      if (!wSkin && !wHair && !wEye && !wLip && !wBrow) continue
      const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
      let nL = L, nA = A, nB = B
      // garde-fou : un pixel bien trop loin de la peau (une mèche classée peau par erreur) n'est pas recoloré
      if (wSkin && !mouthSkin) {
        const far = Math.hypot(A - sk[1], B - sk[2])
        wSkin *= Math.max(0, Math.min(1, (28 - far) / 10))
      }
      if (wSkin) {
        const k = (sT![0] + 12) / (sk[0] + 12)
        nL += wSkin * (sT![0] + (L - sk[0]) * Math.min(1, Math.max(0.62, k)) - L)
        nA += wSkin * (sT![1] + (A - sk[1]) * 0.9 - A)
        nB += wSkin * (sT![2] + (B - sk[2]) * 0.9 - B)
      }
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
      if (wLip) {
        nL += wLip * (lT![0] + (L - 45) * 0.45 - nL)
        nA += wLip * (lT![1] - nA)
        nB += wLip * (lT![2] - nB)
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

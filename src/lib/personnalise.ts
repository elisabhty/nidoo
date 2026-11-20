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
import { CORPS } from './corps'
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
export const NEZ = ['D’origine', 'Bouton', 'Rond', 'Retroussé']
export const BOUCHES = ['D’origine', 'Grand sourire', 'Petit sourire', 'Rire', 'Bisou']
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
    // un autre nez ou une autre bouche : on efface d'abord ceux de la figurine — seulement ce qui change
    // (la pièce efface le nez et la bouche ; changer le nez seul ne doit pas enlever la bouche, et inversement)
    if (patch) {
      const nez = (look.n ?? 0) > 0, bouche = (look.u ?? 0) > 0
      const milieu = ((v.no[1] + v.mo[1]) / 2) * H
      ctx.save()
      if (nez !== bouche) {
        ctx.beginPath()
        if (nez) ctx.rect(0, 0, W, milieu)
        else ctx.rect(0, milieu, W, H - milieu)
        ctx.clip()
      }
      ctx.drawImage(patch, v.p[0], v.p[1])
      ctx.restore()
    }
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

/** Ce qui repasse devant un vêtement de la boutique (écharpe, manteau) : les cheveux et la barbe, partout
 *  (ils tombent sur les épaules), et la peau de la tête jusqu'à la hauteur `cut` (fraction de la toile),
 *  effacée en douceur juste dessous (avec les yeux, la bouche et les sourcils). Le vêtement passe ainsi sous le menton et sous les cheveux : il a l'air
 *  porté, pas collé par-dessus. Les masques de la figurine : vert = cheveux, rouge = peau. */
const dessus = new Map<string, Promise<string>>()
const dessusFait = new Map<string, string>()
/** `mains` : la peau repasse aussi devant sur les côtés (bras et mains), plus loin que `demi` du centre `cx`
 *  (fractions de la largeur) — pour une robe, une jupe ou un short, que les bras longent. */
export type Mains = { cx: number; demi: number; depuis?: number }
/** `cou` : le cou reste devant ce qui se porte (un col ouvert), jusqu'à `bas` (fraction de la toile). */
export type Cou = { cx: number; demi: number; bas: number }
const cleDessus = (src: string, cut: number, mains?: Mains | null, cou?: Cou | null) =>
  `${src}|${cut.toFixed(3)}|${mains ? `${mains.cx.toFixed(3)},${mains.demi.toFixed(3)},${mains.depuis ?? 0}` : ''}|${cou ? `${cou.cx.toFixed(3)},${cou.demi.toFixed(3)},${cou.bas.toFixed(3)}` : ''}`
export const dessusPret = (src: string, cut: number, mains?: Mains | null, cou?: Cou | null) => dessusFait.get(cleDessus(src, cut, mains, cou))
export function renderDessus(p: Perso, src: string, cut: number, mains?: Mains | null, cou?: Cou | null): Promise<string> {
  const key = cleDessus(src, cut, mains, cou)
  const hit = dessus.get(key)
  if (hit) return hit
  const job = (async () => {
    const [im, mask] = await Promise.all([load(src), load(`./art/persos/${p.id}-m.webp`)])
    const W = im.naturalWidth, H = im.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(mask, 0, 0, W, H)
    const m = ctx.getImageData(0, 0, W, H).data
    // l'opacité de ce qui repasse devant, adoucie d'un pixel (les masques ont des bords nets)
    const a = new Float32Array(W * H)
    const y0 = cut * H, fondu = 0.018 * H
    const mx = mains ? mains.cx * W : 0, md = mains ? mains.demi * W : 0
    for (let y = 0; y < H; y++) {
      const haut = y < y0 ? 1 : Math.max(0, 1 - (y - y0) / fondu)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        // sur les côtés, les bras et les mains (fondu sur quelques pixels)
        const cote = mains && y >= (mains.depuis ?? 0) * H ? Math.max(0, Math.min(1, (Math.abs(x - mx) - md) / (0.02 * W))) : 0
        // le cou, devant un col ouvert (chemise, veste) : sinon le dos du col passerait dessus
        const devant = cou && y < (cou.bas + 0.02) * H ? Math.max(0, Math.min(1, (cou.demi * W - Math.abs(x - cou.cx * W)) / (0.015 * W))) * Math.max(0, Math.min(1, (cou.bas * H - y) / (0.02 * H) + 1)) : 0
        const peau = Math.max(haut, cote, devant)
        // la peau, et les yeux, la bouche et les sourcils (bleu), qui sont dans le visage
        a[y * W + x] = Math.max(m[i + 1] / 255, (Math.max(m[i], haut && m[i + 2] > 40 ? 255 : 0) / 255) * peau)
      }
    }
    const b = new Float32Array(W * H)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0, n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx
            if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue
            s += a[yy * W + xx]
            n++
          }
        b[y * W + x] = s / n
      }
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(im, 0, 0)
    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data
    // le bord adouci déborde d'un pixel sur ce qui est à côté (l'ancien habit, caché sous le nouveau) : ce pixel prend
    // la couleur de ses voisins qui repassent devant, sinon un liseré de l'ancien habit suivrait les cheveux
    const o = new Uint8ClampedArray(d)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = y * W + x
        if (a[k] >= 0.5 || b[k] <= 0) continue
        let r = 0, g = 0, bl = 0, n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx
            if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue
            const w = a[yy * W + xx] * (o[(yy * W + xx) * 4 + 3] / 255)
            if (w < 0.5) continue
            r += o[(yy * W + xx) * 4] * w
            g += o[(yy * W + xx) * 4 + 1] * w
            bl += o[(yy * W + xx) * 4 + 2] * w
            n += w
          }
        if (!n) continue
        d[k * 4] = r / n
        d[k * 4 + 1] = g / n
        d[k * 4 + 2] = bl / n
      }
    for (let k = 0; k < W * H; k++) d[k * 4 + 3] = Math.round(d[k * 4 + 3] * b[k])
    ctx.putImageData(img, 0, 0)
    const url = await new Promise<string>((ok) => cv.toBlob((bl) => ok(bl ? URL.createObjectURL(bl) : cv.toDataURL()), 'image/png'))
    dessusFait.set(key, url)
    return url
  })()
  dessus.set(key, job)
  job.catch(() => dessus.delete(key))
  return job
}

/** Changer de bas (jupe, short, robe) : sous l'ourlet `ourlet` (fraction de la toile), le pantalon ou la jupe de
 *  la figurine est retiré jusqu'aux chaussures, et des jambes nues en feutrine sont redessinées derrière
 *  (public/art/persos/jambe.webp, prise sur une figurine en short, teintée de la couleur de ses mains).
 *  Le nouvel habit remplace ainsi son bas au lieu de se poser par-dessus. */
const JAMBE_LAB: [number, number, number] = [79.1, 10, 26.1]
const jambes = new Map<string, Promise<string>>()
const jambesFait = new Map<string, string>()
/** `haut` (une robe) : le haut de la figurine est retiré aussi, du menton à l'ourlet, et on redessine ses épaules,
 *  le haut de sa poitrine et ses bras nus jusqu'aux mains (`haut` = le haut des bretelles, `menton`). */
export type HautNu = { menton: number; bretelles: number }
const cleJambes = (src: string, ourlet: number, haut?: HautNu | null) => `${src}|${ourlet.toFixed(3)}|${haut ? haut.bretelles.toFixed(3) : ''}`
export const jambesPret = (src: string, ourlet: number, haut?: HautNu | null) => jambesFait.get(cleJambes(src, ourlet, haut))
export function renderJambes(p: Perso, src: string, ourlet: number, haut?: HautNu | null): Promise<string> {
  const key = cleJambes(src, ourlet, haut)
  const hit = jambes.get(key)
  if (hit) return hit
  const corps = CORPS[p.id]
  if (!corps) return Promise.resolve(src)
  const job = (async () => {
    const [im, mask, jambe] = await Promise.all([load(src), load(`./art/persos/${p.id}-m.webp`), load('./art/persos/jambe.webp')])
    const W = im.naturalWidth, H = im.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(mask, 0, 0, W, H)
    const m = ctx.getImageData(0, 0, W, H).data
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(im, 0, 0)
    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data
    const [pl, wl, pr, wr, yb, bx, bw, hy] = corps
    // la couleur de sa peau, prise sur ses mains (peau, à hauteur des hanches)
    let sL = 0, sA = 0, sB = 0, n = 0
    for (let y = Math.round((hy - 0.14) * H); y < Math.min(H, Math.round((hy + 0.12) * H)); y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        if (m[i] < 160 || d[i + 3] < 220) continue
        const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
        sL += L
        sA += A
        sB += B
        n++
      }
    const peau: [number, number, number] = n > 20 ? [sL / n, sA / n, sB / n] : VISAGES[p.id]?.sk ?? [75, 12, 28]
    const y0 = Math.max(0, Math.round((ourlet - 0.025) * H))
    const ybas = Math.round(yb * H)
    const pieds = [[pl, wl], [pr, wr]].map(([cx, fw]) => {
      const x0 = Math.round((cx - fw * 0.36) * W), x1 = Math.round((cx + fw * 0.36) * W)
      const ligne = (y: number) => {
        let r = 0, g = 0, b = 0, k = 0
        for (let x = x0; x <= x1; x++) {
          const i = (y * W + x) * 4
          if (d[i + 3] < 200) continue
          r += d[i]
          g += d[i + 1]
          b += d[i + 2]
          k++
        }
        return k ? [r / k, g / k, b / k] : null
      }
      // le haut de la chaussure : en remontant depuis la semelle, la première ligne qui n'a plus sa couleur
      const ref = [0, 0, 0]
      let kr = 0
      for (let y = ybas - Math.round(0.03 * H); y < ybas - Math.round(0.012 * H); y++) {
        const c = ligne(y)
        if (!c) continue
        ref[0] += c[0]
        ref[1] += c[1]
        ref[2] += c[2]
        kr++
      }
      if (kr) ref.forEach((_, j) => (ref[j] /= kr))
      let haut = ybas - Math.round(0.06 * H)
      let ecart = 0
      for (let y = ybas - Math.round(0.03 * H); y > ybas - Math.round(0.14 * H); y--) {
        const c = ligne(y)
        const diff = c ? Math.hypot(c[0] - ref[0], c[1] - ref[1], c[2] - ref[2]) : 999
        ecart = diff > 55 ? ecart + 1 : 0
        if (ecart >= 2) {
          haut = y + 2
          break
        }
      }
      return { cx, fw, haut }
    })
    // on retire l'ancien bas, entre l'ourlet et les chaussures
    for (const { cx, fw, haut } of pieds) {
      const x0 = Math.max(0, Math.round((cx - fw * 0.8) * W)), x1 = Math.min(W - 1, Math.round((cx + fw * 0.8) * W))
      for (let y = y0; y < haut; y++)
        for (let x = x0; x <= x1; x++) {
          const i = (y * W + x) * 4
          // les cheveux qui descendraient jusque-là restent
          if (m[i + 1] > 128) continue
          d[i + 3] = 0
        }
    }
    // une robe : le haut aussi s'en va (tout ce qui n'est ni peau ni cheveux, du menton à l'ourlet)
    let mainsTrouvees: { x: number; y: number }[] = []
    if (haut) {
      const ya = Math.max(0, Math.round((haut.menton - 0.035) * H)), yz = Math.round(ourlet * H)
      // les cheveux à protéger, élargis de quelques pixels (les perles des tresses ne sont pas dans le masque)
      const cheveux = new Uint8Array(W * H)
      const r = 3
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (m[(y * W + x) * 4 + 1] < 128) continue
          for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++)
            for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) cheveux[yy * W + xx] = 1
        }
      const xa = Math.max(0, Math.round((bx - bw * 0.64) * W)), xz = Math.min(W - 1, Math.round((bx + bw * 0.64) * W))
      // ses mains : la peau la plus haute de chaque côté, à hauteur des hanches (le poignet)
      for (const side of [-1, 1]) {
        let top = -1, sx = 0, k = 0
        for (let y = Math.round((hy - 0.2) * H); y < Math.round((hy + 0.12) * H) && top < 0; y++)
          for (let x = xa; x <= xz; x++) {
            if ((x - bx * W) * side < bw * 0.18 * W) continue
            const i = (y * W + x) * 4
            if (m[i] > 160 && d[i + 3] > 200) {
              top = y
              break
            }
          }
        if (top >= 0)
          for (let y = top; y < top + 0.02 * H; y++)
            for (let x = xa; x <= xz; x++) {
              if ((x - bx * W) * side < bw * 0.18 * W) continue
              const i = (y * W + x) * 4
              if (m[i] > 160 && d[i + 3] > 200) {
                sx += x
                k++
              }
            }
        mainsTrouvees.push(k ? { x: sx / k, y: top } : { x: (bx + side * bw * 0.42) * W, y: (hy - 0.02) * H })
      }
      // la couleur de son haut, au milieu de la poitrine : ce qui a cette couleur part, même collé aux cheveux
      let hL = 0, hA = 0, hB = 0, hk = 0
      const yc = Math.round((haut.menton + (hy - haut.menton) * 0.4) * H)
      for (let y = yc - 3; y <= yc + 3; y++)
        for (let x = Math.round((bx - bw * 0.08) * W); x <= Math.round((bx + bw * 0.08) * W); x++) {
          const i = (y * W + x) * 4
          if (d[i + 3] < 200 || m[i] > 128 || m[i + 1] > 128) continue
          const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
          hL += L
          hA += A
          hB += B
          hk++
        }
      const hautLab = hk ? [hL / hk, hA / hk, hB / hk] : null
      for (let y = ya; y < yz; y++)
        for (let x = xa; x <= xz; x++) {
          const i = (y * W + x) * 4
          if (hautLab && !(m[i + 1] > 128) && d[i + 3] > 0) {
            const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
            if (Math.hypot(L - hautLab[0], A - hautLab[1], B - hautLab[2]) < 16 && Math.hypot(L - peau[0], A - peau[1], B - peau[2]) > 20) {
              d[i + 3] = 0
              continue
            }
          }
          // autour du cou, sous le menton : tout part (col, ombre du cou) sauf les cheveux et la barbe exacts ;
          // le cou et les épaules sont redessinés derrière
          const cou = Math.abs(x - bx * W) < bw * 0.45 * W && y < (haut.menton + 0.06) * H
          if (cou) {
            // au-dessus du menton, le visage (masque peau) reste ; le col qui monte jusque-là part
            if (m[i + 1] > 128 || (y < haut.menton * H && m[i] > 128)) continue
            d[i + 3] = 0
            continue
          }
          if (cheveux[y * W + x]) continue
          if (m[i] > 128) {
            // « peau » d'après le masque : on vérifie la couleur (un col collé au cou y est parfois classé)
            if (y < haut.menton * H) continue
            const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
            if (Math.hypot(L - peau[0], A - peau[1], B - peau[2]) < 28) continue
          }
          d[i + 3] = 0
        }
    }
    ctx.putImageData(img, 0, 0)
    // une jambe teintée à la couleur de sa peau
    const jw = jambe.naturalWidth, jh = jambe.naturalHeight
    const tc = document.createElement('canvas')
    tc.width = jw
    tc.height = jh
    const tctx = tc.getContext('2d', { willReadFrequently: true })!
    tctx.drawImage(jambe, 0, 0)
    const jd = tctx.getImageData(0, 0, jw, jh)
    for (let i = 0; i < jd.data.length; i += 4) {
      if (!jd.data[i + 3]) continue
      const [L, A, B] = rgb2lab(jd.data[i], jd.data[i + 1], jd.data[i + 2])
      const [r, g, b] = lab2rgb(peau[0] + (L - JAMBE_LAB[0]) * 0.9, peau[1] + (A - JAMBE_LAB[1]) * 0.6, peau[2] + (B - JAMBE_LAB[2]) * 0.6)
      jd.data[i] = r
      jd.data[i + 1] = g
      jd.data[i + 2] = b
    }
    tctx.putImageData(jd, 0, 0)
    // derrière ce qui reste (les chaussures passent devant)
    ctx.globalCompositeOperation = 'destination-over'
    for (const { cx, fw, haut } of pieds) {
      const lw = fw * 0.82 * W
      ctx.drawImage(tc, cx * W - lw / 2, y0 - 0.01 * H, lw, haut - y0 + 0.02 * H)
    }
    if (haut) {
      // les bras nus, de l'épaule au poignet, puis les épaules et le haut de la poitrine
      const ys = (haut.menton + (hy - haut.menton) * 0.1) * H
      const aw = bw * 0.17 * W
      mainsTrouvees.forEach((mn, j) => {
        const side = j ? 1 : -1
        const xs = (bx + side * bw * 0.3) * W
        const dx = mn.x - xs, dy = mn.y + 0.012 * H - ys
        const len = Math.hypot(dx, dy)
        ctx.save()
        ctx.translate(xs, ys)
        ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2)
        ctx.drawImage(tc, -aw / 2, -aw * 0.3, aw, len + aw * 0.3)
        ctx.restore()
      })
      // le cou, qui s'évase en épaules arrondies, puis le haut de la poitrine
      const top = (haut.menton - 0.01) * H, bas = (haut.bretelles + 0.08) * H
      const cw = bw * 0.62 * W, nw = bw * 0.26 * W, cx = bx * W
      const base = (haut.menton + 0.018) * H
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx - nw / 2, top)
      ctx.lineTo(cx - nw / 2, base)
      ctx.quadraticCurveTo(cx - nw / 2, ys - 0.004 * H, cx - cw / 2, ys + 0.02 * H)
      ctx.lineTo(cx - cw / 2, bas)
      ctx.lineTo(cx + cw / 2, bas)
      ctx.lineTo(cx + cw / 2, ys + 0.02 * H)
      ctx.quadraticCurveTo(cx + nw / 2, ys - 0.004 * H, cx + nw / 2, base)
      ctx.lineTo(cx + nw / 2, top)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(tc, cx - cw / 2, top, cw, bas - top)
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'
    const url = await new Promise<string>((ok) => cv.toBlob((bl) => ok(bl ? URL.createObjectURL(bl) : cv.toDataURL()), 'image/png'))
    jambesFait.set(key, url)
    return url
  })()
  jambes.set(key, job)
  job.catch(() => jambes.delete(key))
  return job
}

/** Remplacer un habit de la figurine par un nouveau (`pieces` : images posées dans leurs boîtes, fractions de la toile).
 *  Dans la bande `[y0, y1]`, ce qui dépasse du nouvel habit et n'est ni peau ni cheveux (c'était l'ancien) est retiré :
 *  - `etendue` : on garde tout ce qui est entre ses bords sur chaque ligne (l'encolure creuse d'un pull garde le cou) ;
 *  - `forme` : on garde seulement ce qu'il couvre (deux chaussures, et rien entre elles).
 *  `jambes` : les trous laissés (un pantalon raccourci au-dessus de chaussures plus basses) montrent des jambes nues. */
export type PieceHabit = { art: string; l: number; t: number; w: number; h: number; flip?: boolean }
export type Remplacement = { pieces: PieceHabit[]; y0: number; y1: number; regle: 'etendue' | 'forme'; jambes?: boolean }
const sans = new Map<string, Promise<string>>()
const sansFait = new Map<string, string>()
const cleSans = (src: string, r: Remplacement) =>
  `${src}|${r.regle}|${r.y0.toFixed(3)},${r.y1.toFixed(3)}|${r.jambes ? 1 : 0}|${r.pieces.map((q) => `${q.art},${q.l.toFixed(3)},${q.t.toFixed(3)},${q.w.toFixed(3)},${q.h.toFixed(3)},${q.flip ? 1 : 0}`).join(';')}`
export const sansPret = (src: string, r: Remplacement) => sansFait.get(cleSans(src, r))
export function renderSans(p: Perso, src: string, r: Remplacement): Promise<string> {
  const key = cleSans(src, r)
  const hit = sans.get(key)
  if (hit) return hit
  const job = (async () => {
    const arts = [...new Set(r.pieces.map((q) => q.art))]
    const [im, mask, jambe, ...imgs] = await Promise.all([load(src), load(`./art/persos/${p.id}-m.webp`), load('./art/persos/jambe.webp'), ...arts.map((a) => load(`./art/persos/${a}.webp`))])
    const W = im.naturalWidth, H = im.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(mask, 0, 0, W, H)
    const m = ctx.getImageData(0, 0, W, H).data
    ctx.clearRect(0, 0, W, H)
    for (const q of r.pieces) {
      const hab = imgs[arts.indexOf(q.art)]
      ctx.save()
      if (q.flip) {
        ctx.translate((q.l * 2 + q.w) * W, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(hab, q.l * W, q.t * H, q.w * W, q.h * H)
      ctx.restore()
    }
    const n = ctx.getImageData(0, 0, W, H).data
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(im, 0, 0)
    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data
    const ya = Math.max(0, Math.round(r.y0 * H)), yz = Math.min(H, Math.round(r.y1 * H))
    // les cheveux, élargis de 3 pixels (les perles des tresses ne sont pas dans le masque)
    const cheveux = new Uint8Array(W * H)
    for (let y = Math.max(0, ya - 3); y < Math.min(H, yz + 3); y++)
      for (let x = 0; x < W; x++) {
        if (m[(y * W + x) * 4 + 1] < 128) continue
        for (let yy = Math.max(0, y - 3); yy <= Math.min(H - 1, y + 3); yy++)
          for (let xx = Math.max(0, x - 3); xx <= Math.min(W - 1, x + 3); xx++) cheveux[yy * W + xx] = 1
      }
    let troue = false
    for (let y = ya; y < yz; y++) {
      let x0 = W, x1 = -1
      if (r.regle === 'etendue')
        for (let x = 0; x < W; x++)
          if (n[(y * W + x) * 4 + 3] > 60) {
            if (x < x0) x0 = x
            x1 = x
          }
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        if (r.regle === 'etendue' ? x >= x0 && x <= x1 : n[i + 3] > 60) continue
        if (!d[i + 3] || m[i] > 128 || cheveux[y * W + x] || m[i + 2] > 40) continue
        d[i + 3] = 0
        troue = true
      }
    }
    ctx.putImageData(img, 0, 0)
    const corps = CORPS[p.id]
    if (r.jambes && troue && corps) {
      // des jambes nues derrière, teintées comme ses mains, là où l'ancien bas a été raccourci
      const [pl, wl, pr, wr, , , , hy] = corps
      let sL = 0, sA = 0, sB = 0, k = 0
      for (let y = Math.round((hy - 0.14) * H); y < Math.min(H, Math.round((hy + 0.12) * H)); y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          if (m[i] < 160 || d[i + 3] < 220) continue
          const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
          sL += L
          sA += A
          sB += B
          k++
        }
      const peau: [number, number, number] = k > 20 ? [sL / k, sA / k, sB / k] : VISAGES[p.id]?.sk ?? [75, 12, 28]
      const tc = document.createElement('canvas')
      tc.width = jambe.naturalWidth
      tc.height = jambe.naturalHeight
      const tctx = tc.getContext('2d', { willReadFrequently: true })!
      tctx.drawImage(jambe, 0, 0)
      const jd = tctx.getImageData(0, 0, tc.width, tc.height)
      for (let i = 0; i < jd.data.length; i += 4) {
        if (!jd.data[i + 3]) continue
        const [L, A, B] = rgb2lab(jd.data[i], jd.data[i + 1], jd.data[i + 2])
        const [rr, gg, bb] = lab2rgb(peau[0] + (L - JAMBE_LAB[0]) * 0.9, peau[1] + (A - JAMBE_LAB[1]) * 0.6, peau[2] + (B - JAMBE_LAB[2]) * 0.6)
        jd.data[i] = rr
        jd.data[i + 1] = gg
        jd.data[i + 2] = bb
      }
      tctx.putImageData(jd, 0, 0)
      ctx.globalCompositeOperation = 'destination-over'
      for (const [cx, fw] of [[pl, wl], [pr, wr]]) {
        const lw = fw * 0.82 * W
        ctx.drawImage(tc, cx * W - lw / 2, ya - 0.03 * H, lw, yz - ya + 0.02 * H)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    const url = await new Promise<string>((ok) => cv.toBlob((bl) => ok(bl ? URL.createObjectURL(bl) : cv.toDataURL()), 'image/png'))
    sansFait.set(key, url)
    return url
  })()
  sans.set(key, job)
  job.catch(() => sans.delete(key))
  return job
}

/** Enfiler un haut ou une veste « porté » (hab-<nom>.webp, manches le long du corps) : l'ancien haut de la figurine
 *  ne doit plus dépasser. Dans la bande du nouvel habit, ce qui n'est ni peau ni cheveux et qu'il ne couvre pas :
 *  - au-dessus de lui, au milieu (l'encolure) : devient de la peau sous un haut (`peau`), reste sous une veste (`garde`,
 *    on voit le haut porté dessous) ;
 *  - au-dessus de lui, sur les côtés (une épaule plus haute que celle du nouvel habit) : prend son tissu ;
 *  - sur les côtés (anciennes manches, entre le bras et le corps) : s'en va ;
 *  - sous son ourlet (`peau` seulement) : un ancien haut un peu plus long est « rentré » — le bas de la figurine
 *    remonte jusqu'à l'ourlet. Un haut vraiment plus long (robe, tunique) reste visible dessous. */
export type Enfile = { piece: PieceHabit; mode: 'peau' | 'garde'; menton: number; buste?: [number, number]; poignets?: number }
const enfile = new Map<string, Promise<string>>()
const enfileFait = new Map<string, string>()
const cleEnfile = (src: string, e: Enfile) => `${src}|${e.mode}|${e.menton.toFixed(3)}|${e.buste?.map((v) => v.toFixed(3)).join(',') ?? ''},${e.poignets?.toFixed(3) ?? ''}|${e.piece.art},${e.piece.l.toFixed(4)},${e.piece.t.toFixed(4)},${e.piece.w.toFixed(4)},${e.piece.h.toFixed(4)}`
export const enfilePret = (src: string, e: Enfile) => enfileFait.get(cleEnfile(src, e))
export function renderEnfile(p: Perso, src: string, e: Enfile): Promise<string> {
  const key = cleEnfile(src, e)
  const hit = enfile.get(key)
  if (hit) return hit
  const job = (async () => {
    const q = e.piece
    const [im, mask, hab] = await Promise.all([load(src), load(`./art/persos/${p.id}-m.webp`), load(`./art/persos/${q.art}.webp`)])
    const W = im.naturalWidth, H = im.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(mask, 0, 0, W, H)
    const m = ctx.getImageData(0, 0, W, H).data
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(hab, q.l * W, q.t * H, q.w * W, q.h * H)
    const n = ctx.getImageData(0, 0, W, H).data
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(im, 0, 0)
    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data
    // la bande où l'on travaille : jamais plus haut que le menton (le visage, les lunettes ne sont pas un habit)
    const ya = Math.max(0, Math.round(Math.max(q.t - 0.05, e.menton - 0.03) * H)), yz = Math.min(H, Math.round((q.t + q.h + 0.012) * H))
    const xa = Math.max(0, Math.floor(q.l * W) - 2), xz = Math.min(W, Math.ceil((q.l + q.w) * W) + 2)
    const cx = (q.l + q.w / 2) * W
    const max0 = Math.round(0.11 * H)
    // la demi-largeur du cou (pas celle de l'encolure, plus large)
    const nuque = 0.06 * W
    const cou = q.w * W * 0.17
    // couvert : sous le nouvel habit, là où il est bien opaque (sous son bord adouci, l'ancien se verrait au travers)
    const couvert = (x: number, y: number) => n[(y * W + x) * 4 + 3] > 215
    // les cheveux (sans marge : un liseré de l'ancien habit resterait le long des cheveux)
    const cheveux = new Uint8Array(W * H)
    for (let y = ya; y < Math.min(H, yz + max0 + 6); y++)
      for (let x = 0; x < W; x++) {
        if (m[(y * W + x) * 4 + 1] < 128) continue
        cheveux[y * W + x] = 1
      }
    /** ce qu'on a retiré : derrière, s'il y a des cheveux juste à côté, ils continuent (voir plus bas) */
    const vide = new Uint8Array(W * H)
    const oter = (x: number, y: number) => {
      d[(y * W + x) * 4 + 3] = 0
      vide[y * W + x] = 1
    }
    // le bord des cheveux contre l'ancien habit (deux pixels, où les deux se mélangent) va avec l'habit
    const rogne = new Uint8Array(W * H)
    for (let tour = 0; tour < 2; tour++) {
      const habit = (x: number, y: number) => {
        if (x < 0 || x >= W || y < 0 || y >= H) return false
        if (rogne[y * W + x]) return true
        const i = (y * W + x) * 4
        return d[i + 3] > 200 && m[i] <= 128 && m[i + 2] <= 40 && m[i + 1] < 128 && !cheveux[y * W + x]
      }
      const bord: number[] = []
      for (let y = ya; y < yz; y++)
        for (let x = xa; x < xz; x++)
          if (cheveux[y * W + x] && (habit(x - 1, y) || habit(x + 1, y) || habit(x, y - 1) || habit(x, y + 1))) bord.push(y * W + x)
      for (const k of bord) {
        cheveux[k] = 0
        rogne[k] = 1
        m[k * 4 + 1] = 0
        if (n[k * 4 + 3] > 215) d[k * 4 + 3] = 0
      }
    }
    /** un pixel de l'ancien habit : opaque, ni peau, ni cheveux, ni trait du visage */
    const ancien = (x: number, y: number) => {
      const i = (y * W + x) * 4
      return d[i + 3] > 0 && m[i] <= 128 && !cheveux[y * W + x] && m[i + 2] <= 40
    }
    // par colonne : où le nouvel habit commence et où il finit
    const debut = new Int32Array(W).fill(-1), fin = new Int32Array(W).fill(-1)
    for (let x = xa; x < xz; x++)
      for (let y = 0; y < H; y++)
        if (couvert(x, y)) {
          if (debut[x] < 0) debut[x] = y
          fin[x] = y
        }
    // l'ourlet du corps de l'habit (au milieu), et par ligne le corps de l'habit : le morceau qui contient le milieu.
    // Près de l'ourlet (qui s'arrondit, se fend…) et dessous, on garde celui d'un peu plus haut.
    const cxi = Math.round(cx)
    let ourlet = -1
    for (let x = Math.max(xa, Math.round(cx - cou)); x < Math.min(xz, Math.round(cx + cou)); x++) ourlet = Math.max(ourlet, fin[x])
    const yRef = Math.max(ya, ourlet - Math.round(0.03 * H))
    const tx0 = new Int32Array(H).fill(-1), tx1 = new Int32Array(H).fill(-1)
    const morceau = (y: number): [number, number] => {
      // on part du milieu ; s'il est dans une ouverture (encolure, veste ouverte), on cherche le tissu de chaque côté
      let g = cxi, r = cxi
      while (g > xa && !couvert(g, y) && cxi - g < cou * 1.6) g--
      while (r < xz - 1 && !couvert(r, y) && r - cxi < cou * 1.6) r++
      if (!couvert(g, y) && !couvert(r, y)) return [-1, -1]
      let a = couvert(g, y) ? g : r, b = couvert(r, y) ? r : g
      while (a > xa && couvert(a - 1, y)) a--
      while (b < xz - 1 && couvert(b + 1, y)) b++
      return [a, b]
    }
    const [r0, r1] = morceau(yRef)
    for (let y = ya; y < yz; y++) {
      const [a, b] = y <= yRef ? morceau(y) : [r0, r1]
      tx0[y] = a
      tx1[y] = b
    }
    // les colonnes du buste (entre les mains) : sous l'ourlet, seul ce qui est là peut rester
    const b0 = Math.max(r0, Math.round((e.buste?.[0] ?? 0) * W)), b1 = Math.min(r1, Math.round((e.buste?.[1] ?? 1) * W))
    // la couleur du cou
    let sr = 0, sg = 0, sb = 0, k = 0
    const yc = Math.round(e.menton * H)
    for (let y = Math.max(0, yc - Math.round(0.01 * H)); y < Math.min(H, yc + Math.round(0.05 * H)); y++)
      for (let x = Math.max(0, Math.round(cx - cou)); x < Math.min(W, Math.round(cx + cou)); x++) {
        const i = (y * W + x) * 4
        if (m[i] < 200 || d[i + 3] < 250) continue
        sr += d[i]
        sg += d[i + 1]
        sb += d[i + 2]
        k++
      }
    const peau = k > 12 ? [sr / k, sg / k, sb / k] : lab2rgb(...(VISAGES[p.id]?.sk ?? [75, 12, 28]))
    const rentre: number[] = []
    const poitrine = (q.t + q.h * 0.5) * H
    const sousMenton = e.menton * H - 2
    const enPeau = (i: number) => {
      // la peau du cou, un peu dans l'ombre du menton
      d[i] = peau[0] * 0.95
      d[i + 1] = peau[1] * 0.94
      d[i + 2] = peau[2] * 0.93
    }
    for (let y = ya; y < yz; y++)
      for (let x = xa; x < xz; x++) {
        if (couvert(x, y) || !ancien(x, y)) continue
        const i = (y * W + x) * 4
        // le cou, qui se resserre au-dessus du menton (derrière la tête)
        const milieu = Math.abs(x - cx) < nuque * Math.max(0.35, Math.min(1, 1 - (sousMenton - y) / (0.035 * H)))
        if (debut[x] < 0) oter(x, y)
        else if (y < debut[x]) {
          // au-dessus du nouvel habit : la peau du cou au milieu ; sur les côtés, une épaule plus haute que la sienne s'en va
          if (!milieu) oter(x, y)
          else if (e.mode === 'peau') enPeau(i)
        } else if (y > fin[x]) {
          // sous le nouvel habit : sous les manches, l'ancienne s'en va ; sous l'ourlet, on verra s'il faut le rentrer
          if (e.mode === 'peau') rentre.push(x)
          else if (x < b0 || x > b1) oter(x, y)
        } else if (tx0[y] >= 0 && x > tx0[y] && x < tx1[y]) {
          // dans une ouverture du corps de l'habit : un col ouvert laisse voir la peau, une veste le haut porté dessous
          if (e.mode === 'peau' && y < poitrine) enPeau(i)
        } else oter(x, y) // entre le bras et le corps
      }
    // sous l'ourlet : un ancien haut un peu plus long est rentré (le bas remonte, en miroir, jusqu'à l'ourlet).
    // On le décide pour tout l'habit, pas colonne par colonne (sinon des rayures) : d'abord où finit l'ancien haut
    // dans chaque colonne, puis une ligne d'ourlet lissée ; un haut vraiment long (tunique, robe) reste dessous.
    const max = max0
    const cols = [...new Set(rentre)].sort((u, v) => u - v)
    const finAncien = new Map<number, number>()
    const teintes: [number, number, number][] = []
    for (const x of cols) {
      const y0 = fin[x] + 1
      // les couleurs de l'ancien haut dans cette colonne (sous le nouvel habit)
      const refs: [number, number, number][] = []
      for (let f = 0.35; f <= 0.9; f += 0.11) {
        const y = Math.round(debut[x] + (fin[x] - debut[x]) * f)
        if (ancien(x, y)) {
          const i = (y * W + x) * 4
          refs.push(rgb2lab(d[i], d[i + 1], d[i + 2]))
        }
      }
      const meme = (y: number) => {
        const i = (y * W + x) * 4
        if (!ancien(x, y)) return false
        const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
        return refs.some(([l, a, b]) => Math.hypot((L - l) * 0.6, A - a, B - b) < 13)
      }
      let y1 = y0, rate = 0
      for (let y = y0; y < Math.min(H, y0 + max * 2); y++) {
        if (meme(y)) {
          y1 = y + 1
          rate = 0
        } else if (++rate >= 3) break
      }
      if (y1 > y0) finAncien.set(x, y1)
      if (teintes.length < 160) teintes.push(...refs.slice(0, 2))
    }
    /** de la couleur de l'ancien haut */
    const duHaut = (x: number, y: number) => {
      const i = (y * W + x) * 4
      const [L, A, B] = rgb2lab(d[i], d[i + 1], d[i + 2])
      return teintes.some(([l, a, b]) => Math.hypot((L - l) * 0.6, A - a, B - b) < 11)
    }
    const mediane = (v: number[]) => [...v].sort((u, w) => u - w)[v.length >> 1]
    const longs = cols.filter((x) => x >= b0 && x <= b1 && finAncien.has(x)).map((x) => finAncien.get(x)! - fin[x] - 1)
    // une tunique, une robe (un ourlet bien plus bas que les poignets) ne se rentre pas : elle reste dessous
    const ourlets = cols.filter((x) => x >= b0 && x <= b1 && finAncien.has(x)).map((x) => finAncien.get(x)!)
    const tunique = e.poignets != null && ourlets.length > 0 && mediane(ourlets) > (e.poignets + 0.05) * H
    const rentrer = longs.length > 0 && mediane(longs) <= max && !tunique
    for (const x of cols) {
      const y0 = fin[x] + 1
      const buste = x >= b0 && x <= b1
      // la ligne de l'ancien ourlet, lissée sur les colonnes voisines
      const autour: number[] = []
      for (let k = -4; k <= 4; k++) if (finAncien.has(x + k)) autour.push(finAncien.get(x + k)!)
      const y1 = autour.length ? mediane(autour) : y0
      if (!rentrer || y1 - y0 > max || y1 <= y0) {
        // hors du buste (sous une manche), ce qui ne peut pas être rentré s'en va
        if (!buste) for (let y = y0; y < yz; y++) if (ancien(x, y)) oter(x, y)
        continue
      }
      for (let y = y0; y < y1; y++) {
        if (!ancien(x, y)) continue
        // en miroir autour de l'ancien ourlet : le haut du pantalon (ou de la jupe) remonte
        const ys = Math.min(H - 1, y1 + 1 + (y1 - 1 - y))
        const j = (ys * W + x) * 4, i = (y * W + x) * 4
        if (d[j + 3] < 200 || m[j] > 128 || cheveux[ys * W + x]) {
          if (!buste) oter(x, y)
          continue
        }
        d[i] = d[j]
        d[i + 1] = d[j + 1]
        d[i + 2] = d[j + 2]
      }
      // sous une manche, plus bas que l'ourlet lissé : un coin de l'ancien haut qui pendrait encore s'en va
      if (!buste) for (let y = y1; y < yz; y++) if (ancien(x, y) && duHaut(x, y)) oter(x, y)
    }
    // derrière ce qu'on a retiré, les cheveux longs continuent : là où ils touchent le trou du côté extérieur, ils le
    // remplissent (en miroir de leur bord), au lieu de laisser un jour entre la nouvelle manche et les cheveux
    const loin = Math.round(0.08 * W)
    const estCheveu = (x: number, y: number) => x >= 0 && x < W && m[(y * W + x) * 4 + 1] >= 128 && d[(y * W + x) * 4 + 3] > 200
    for (let y = ya; y < yz; y++)
      for (let x = xa; x < xz; x++) {
        if (!vide[y * W + x]) continue
        const s = x < cx ? -1 : 1
        let xh = -1
        for (let k = 1; k <= loin; k++) {
          const xx = x + s * k
          if (xx < 0 || xx >= W) break
          if (estCheveu(xx, y)) {
            xh = xx
            break
          }
          if (!vide[y * W + xx] && d[(y * W + xx) * 4 + 3] > 40 && !cheveux[y * W + xx]) break
        }
        if (xh < 0) continue
        // pris à quelques pixels de leur bord (une mèche fine n'a que ça)
        let xs = xh
        for (let k = Math.min(Math.abs(xh - x), 4); k > 0; k--)
          if (estCheveu(xh + s * k, y)) {
            xs = xh + s * k
            break
          }
        const j = (y * W + xs) * 4, i = (y * W + x) * 4
        // un peu dans l'ombre : ils passent derrière le bras
        d[i] = d[j] * 0.93
        d[i + 1] = d[j + 1] * 0.92
        d[i + 2] = d[j + 2] * 0.91
        d[i + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
    const url = await new Promise<string>((ok) => cv.toBlob((bl) => ok(bl ? URL.createObjectURL(bl) : cv.toDataURL()), 'image/png'))
    enfileFait.set(key, url)
    return url
  })()
  enfile.set(key, job)
  job.catch(() => enfile.delete(key))
  return job
}

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
const cleDessus = (src: string, cut: number, mains?: Mains | null) => `${src}|${cut.toFixed(3)}|${mains ? `${mains.cx.toFixed(3)},${mains.demi.toFixed(3)},${mains.depuis ?? 0}` : ''}`
export const dessusPret = (src: string, cut: number, mains?: Mains | null) => dessusFait.get(cleDessus(src, cut, mains))
export function renderDessus(p: Perso, src: string, cut: number, mains?: Mains | null): Promise<string> {
  const key = cleDessus(src, cut, mains)
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
        const peau = Math.max(haut, cote)
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

import type { Sticker } from './types'

/**
 * Les stickers à coller sur un dessin ou une photo.
 * - les stickers en feutrine : de vraies images (ElevenLabs), détourées avec leur bord blanc, dans public/art/stickers/
 * - les petits mots : dessinés par le téléphone, en lettres rondes avec un bord blanc de sticker
 * Un sticker posé garde sa clé, son centre, sa largeur et sa rotation (unités de la feuille).
 */

export const MAX_STICKERS = 40

export type Cat = { key: string; label: string; items: string[] }

const MOTS: Record<string, { t: string; c: string; d: string }> = {
  coucou: { t: 'Coucou !', c: '#FF8FB1', d: '#D6407A' },
  jetaime: { t: 'Je t’aime', c: '#FF6B81', d: '#C9184A' },
  bisous: { t: 'Bisous', c: '#F78FD0', d: '#B5179E' },
  bravo: { t: 'Bravo !', c: '#FFC53D', d: '#E07B00' },
  merci: { t: 'Merci', c: '#7BD389', d: '#2F8F46' },
  tropbien: { t: 'Trop bien', c: '#6FC3FF', d: '#1F6FC7' },
  miam: { t: 'Miam !', c: '#FFA06B', d: '#D9480F' },
  bonnenuit: { t: 'Bonne nuit', c: '#A58BFF', d: '#5B3CC4' },
  manques: { t: 'Tu me\nmanques', c: '#FF9EAD', d: '#C2255C' },
  anniv: { t: 'Joyeux\nanniversaire', c: '#FFB547', d: '#D9480F' },
  calin: { t: 'Câlin', c: '#C9A0FF', d: '#7B2FBF' },
  wouah: { t: 'Wouah !', c: '#5ED3C9', d: '#0C8599' },
  courage: { t: 'Courage !', c: '#8CE07F', d: '#2B8A3E' },
  fier: { t: 'Trop fier\nde toi', c: '#7FB8FF', d: '#1C5FB8' },
  noel: { t: 'Joyeux\nNoël', c: '#FF6B6B', d: '#B02A37' },
  fetes: { t: 'Bonnes\nfêtes', c: '#7BD389', d: '#2F8F46' },
}

export const CATS: Cat[] = [
  { key: 'amour', label: 'Amour', items: ['coeur', 'coeurs', 'bisou', 'lettre', 'maison', 'pouce'] },
  { key: 'mots', label: 'Petits mots', items: Object.keys(MOTS).map((k) => `mot:${k}`) },
  { key: 'noel', label: 'Noël', items: ['sapin', 'boule', 'etoile-noel', 'cadeau-noel', 'chaussette', 'sucre-orge', 'pain-epice', 'bonhomme-neige', 'pomme-pin', 'mot:noel', 'mot:fetes'] },
  { key: 'fete', label: 'Fête', items: ['ballons', 'gateau', 'cadeau', 'chapeau', 'couronne', 'notes', 'cupcake'] },
  { key: 'deguise', label: 'Déguisements', items: ['lunettes', 'moustache', 'oreilles', 'noeud', 'fleurs', 'couronne', 'chapeau'] },
  { key: 'nature', label: 'Nature', items: ['soleil', 'arcenciel', 'nuage', 'fleur', 'lune', 'etoile', 'papillon', 'coccinelle', 'trefle', 'avion'] },
  { key: 'animaux', label: 'Animaux', items: ['panda', 'chat', 'chien', 'patte', 'papillon', 'coccinelle'] },
  { key: 'miam', label: 'Miam', items: ['glace', 'cafe', 'cookie', 'pizza', 'cupcake', 'gateau'] },
]

export const NOMS: Record<string, string> = {
  coeur: 'Cœur', coeurs: 'Deux cœurs', bisou: 'Bisou', lettre: 'Lettre d’amour', maison: 'Maison', pouce: 'Pouce levé',
  ballons: 'Ballons', gateau: 'Gâteau', cadeau: 'Cadeau', chapeau: 'Chapeau de fête', couronne: 'Couronne', notes: 'Notes de musique', cupcake: 'Cupcake',
  lunettes: 'Lunettes cœur', moustache: 'Moustache', oreilles: 'Oreilles de chat', noeud: 'Nœud', fleurs: 'Couronne de fleurs',
  soleil: 'Soleil', arcenciel: 'Arc-en-ciel', nuage: 'Nuage', fleur: 'Fleur', lune: 'Lune', etoile: 'Étoile', papillon: 'Papillon', coccinelle: 'Coccinelle', trefle: 'Trèfle', avion: 'Avion en papier',
  panda: 'Panda roux', chat: 'Chat', chien: 'Chien', patte: 'Patte',
  glace: 'Glace', cafe: 'Café', cookie: 'Cookie', pizza: 'Pizza',
  sapin: 'Sapin', boule: 'Boule de Noël', 'etoile-noel': 'Étoile du sapin', 'cadeau-noel': 'Cadeau de Noël', chaussette: 'Chaussette de Noël',
  'sucre-orge': 'Sucre d’orge', 'pain-epice': 'Bonhomme en pain d’épice', 'bonhomme-neige': 'Bonhomme de neige', 'pomme-pin': 'Pomme de pin',
}
export const nomSticker = (k: string) => (k.startsWith('mot:') ? (MOTS[k.slice(4)]?.t.replace('\n', ' ') ?? 'Petit mot') : (NOMS[k] ?? 'Sticker'))

// ───────── Les mots qu'on écrit soi-même ─────────

export const PERSO = 'mot:perso'
export const MAX_MOT = 40
/** Les couleurs des mots écrits soi-même : la couleur du milieu, puis le liseré foncé. */
export const COULEURS_MOT: [string, string][] = [
  ['#FF8FB1', '#D6407A'],
  ['#FF6B6B', '#C92A2A'],
  ['#FFA06B', '#D9480F'],
  ['#FFC53D', '#E07B00'],
  ['#7BD389', '#2F8F46'],
  ['#6FC3FF', '#1F6FC7'],
  ['#A58BFF', '#5B3CC4'],
  ['#5ED3C9', '#0C8599'],
]

/** Coupe un mot en lignes de 13 lettres environ (3 lignes au plus), en gardant les retours à la ligne voulus. */
export function lignesMot(t: string): string[] {
  const out: string[] = []
  for (const para of t.trim().split('\n')) {
    let cur = ''
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (cur && (cur + ' ' + w).length > 13) {
        out.push(cur)
        cur = w
      } else cur = cur ? `${cur} ${w}` : w
    }
    if (cur) out.push(cur)
  }
  return out.slice(0, 3)
}

/** La clé de dessin d'un sticker : sa clé, ou son texte et sa couleur pour un mot écrit soi-même. */
export const cleSticker = (st: Pick<Sticker, 'i' | 't' | 'c'>) => (st.i === PERSO ? `perso:${st.c ?? 0}:${(st.t ?? '').slice(0, MAX_MOT)}` : st.i)
export const nomDe = (st: Pick<Sticker, 'i' | 't'>) => (st.i === PERSO ? (st.t ?? 'Petit mot').replace(/\n/g, ' ') : nomSticker(st.i))

/** Largeur de départ d'un sticker (unités de la feuille, 1000 de large). */
export function largeurDepart(k: string, t?: string) {
  if (k === PERSO) {
    const l = lignesMot(t ?? '')
    const long = Math.max(0, ...l.map((x) => x.length))
    return Math.round(Math.min(420, Math.max(200, long * 30)))
  }
  if (!k.startsWith('mot:')) return 200
  const m = MOTS[k.slice(4)]
  return m && m.t.includes('\n') ? 330 : 300
}

// ───────── Images ─────────

type Src = HTMLImageElement | HTMLCanvasElement
const ready = new Map<string, Src>()
const waiting = new Map<string, Set<() => void>>()

const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito Variable", "Arial Rounded MT Bold", system-ui, sans-serif'

/** Les petits mots : lettres rondes et grasses, dégradé, liseré foncé et gros bord blanc de sticker. */
function motCanvas(k: string): HTMLCanvasElement {
  let m = MOTS[k] ?? { t: k, c: '#FF8FB1', d: '#D6407A' }
  let lines = m.t.split('\n')
  if (k.startsWith('perso:')) {
    // perso:<couleur>:<texte>
    const [, ci, ...rest] = k.split(':')
    const [c, d] = COULEURS_MOT[Number(ci)] ?? COULEURS_MOT[0]
    m = { t: rest.join(':'), c, d }
    lines = lignesMot(m.t)
    if (!lines.length) lines = ['…']
  }
  const fs = 120
  const lh = fs * 1.02
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `900 ${fs}px ${FONT}`
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const pad = 40
  c.width = Math.ceil(w + pad * 2)
  c.height = Math.ceil(lh * lines.length + pad * 2 - (lh - fs) + 10)
  ctx.font = `900 ${fs}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const cx = c.width / 2
  const ys = lines.map((_, i) => pad + fs / 2 + i * lh + 4)
  // le gros bord blanc du sticker (l'ombre est ajoutée au moment de le coller)
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 44
  lines.forEach((l, i) => ctx.strokeText(l, cx, ys[i]))
  // le liseré foncé puis la couleur, plus claire en haut
  ctx.strokeStyle = m.d
  ctx.lineWidth = 12
  lines.forEach((l, i) => ctx.strokeText(l, cx, ys[i]))
  lines.forEach((l, i) => {
    const g = ctx.createLinearGradient(0, ys[i] - fs / 2, 0, ys[i] + fs / 2)
    g.addColorStop(0, '#FFFFFF')
    g.addColorStop(0.18, m.c)
    g.addColorStop(1, m.d)
    ctx.fillStyle = g
    ctx.fillText(l, cx, ys[i])
  })
  return c
}

let fonts: Promise<unknown> | null = null
function fontsReady() {
  if (!fonts) fonts = Promise.race([document.fonts?.load(`900 120px ${FONT}`) ?? Promise.resolve(), new Promise((r) => setTimeout(r, 800))]).catch(() => undefined)
  return fonts
}

export const stickerUrl = (k: string) => `./art/stickers/${k}.webp`

/** L'image d'un sticker si elle est prête ; sinon null, et `onLoad` sera appelé quand elle le sera. */
export function stickerSrc(k: string, onLoad?: () => void): Src | null {
  const r = ready.get(k)
  if (r) return r
  let w = waiting.get(k)
  if (!w) {
    w = new Set()
    waiting.set(k, w)
    const done = (s: Src) => {
      ready.set(k, s)
      const subs = waiting.get(k)
      waiting.delete(k)
      subs?.forEach((f) => f())
    }
    if (k.startsWith('mot:')) void fontsReady().then(() => done(motCanvas(k.slice(4))))
    else if (k.startsWith('perso:')) void fontsReady().then(() => done(motCanvas(k)))
    else {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => done(img)
      img.onerror = () => waiting.delete(k)
      img.src = stickerUrl(k)
    }
  }
  if (onLoad) w.add(onLoad)
  return null
}

/** Hauteur / largeur du sticker (1 tant qu'il n'est pas chargé). */
export function ratioSticker(k: string) {
  const s = ready.get(k)
  if (!s) return 1
  const w = s instanceof HTMLImageElement ? s.naturalWidth : s.width
  const h = s instanceof HTMLImageElement ? s.naturalHeight : s.height
  return w ? h / w : 1
}

/** Une URL affichable dans une balise <img> (les petits mots deviennent une image). */
const dataUrls = new Map<string, string>()
export function stickerImgUrl(k: string): string | null {
  if (!k.startsWith('mot:') && !k.startsWith('perso:')) return stickerUrl(k)
  const s = ready.get(k)
  if (!s) return null
  let u = dataUrls.get(k)
  if (!u) {
    u = (s as HTMLCanvasElement).toDataURL('image/png')
    dataUrls.set(k, u)
  }
  return u
}

const easeBack = (t: number) => {
  const c = 1.7
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

/**
 * Colle les stickers dans un contexte en unités de feuille.
 * `pop` (0 → 1) les fait apparaître un par un avec un petit rebond ; renvoie false s'il en manque un (pas encore chargé).
 */
export function drawStickers(ctx: CanvasRenderingContext2D, k: Sticker[], pop = 1, onLoad?: () => void): boolean {
  let ok = true
  const n = k.length
  k.forEach((st, j) => {
    const cle = cleSticker(st)
    const src = stickerSrc(cle, onLoad)
    if (!src) {
      ok = false
      return
    }
    let sc = 1
    if (pop < 1) {
      const t0 = n > 1 ? (j / n) * 0.55 : 0
      const t = Math.max(0, Math.min(1, (pop - t0) / 0.45))
      if (t <= 0) return
      sc = easeBack(t)
    }
    const w = st.s * sc
    const h = w * ratioSticker(cle)
    ctx.save()
    // une petite ombre douce, comme un vrai sticker collé (les ombres du canvas ne suivent pas l'échelle)
    const m = ctx.getTransform()
    const z = Math.hypot(m.a, m.b)
    ctx.shadowColor = 'rgba(29,26,43,0.22)'
    ctx.shadowBlur = 9 * z
    ctx.shadowOffsetY = 3.5 * z
    ctx.translate(st.x, st.y)
    ctx.rotate((st.r * Math.PI) / 180)
    ctx.drawImage(src, -w / 2, -h / 2, w, h)
    ctx.restore()
  })
  return ok
}

/** Tous les stickers d'un dessin chargés d'avance (pour l'aperçu des envois). */
export function prechargerStickers(k: Sticker[] | undefined, onLoad: () => void) {
  let manque = 0
  for (const st of k ?? []) if (!stickerSrc(cleSticker(st), onLoad)) manque++
  return manque === 0
}

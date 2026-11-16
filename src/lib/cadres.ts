import { stickerSrc } from './stickers'

/**
 * Les cadres : dessinés par le téléphone, ils s'adaptent à toutes les tailles (le widget, une photo en long ou en large).
 * Ils se posent sur la photo ou le papier, sous les traits (on peut écrire sur le bas d'un Polaroid) et sous les stickers.
 * W × H : la feuille, en unités (1000 de large).
 */

export type CadreKey =
  | 'aucun'
  | 'polaroid'
  | 'scotch'
  | 'pellicule'
  | 'dentelle'
  | 'postale'
  | 'coeurs'
  | 'fanions'
  | 'fleurs'
  | 'etoiles'
  | 'arcenciel'
  | 'noel'
  | 'neige'
  | 'or'
  | 'ballons'

export const CADRES: { key: CadreKey; label: string }[] = [
  { key: 'aucun', label: 'Sans' },
  { key: 'polaroid', label: 'Polaroid' },
  { key: 'scotch', label: 'Scotché' },
  { key: 'pellicule', label: 'Pellicule' },
  { key: 'dentelle', label: 'Dentelle' },
  { key: 'postale', label: 'Carte postale' },
  { key: 'coeurs', label: 'Cœurs' },
  { key: 'fanions', label: 'Fanions' },
  { key: 'ballons', label: 'Anniversaire' },
  { key: 'fleurs', label: 'Fleurs' },
  { key: 'arcenciel', label: 'Arc-en-ciel' },
  { key: 'etoiles', label: 'Étoiles' },
  { key: 'or', label: 'Doré' },
  { key: 'noel', label: 'Noël' },
  { key: 'neige', label: 'Neige' },
]

const rng = (seed: number) => {
  let s = seed || 1
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

// roundRect n'existe pas sur les vieux iPhone : un rectangle simple suffit alors
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h)
  }
}

/** Un bandeau tout autour : le rectangle entier moins l'intérieur. */
function bande(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, r: number, b = t, l = t, rr = 0) {
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.roundRect(l, t, W - l - r, H - t - b, rr)
  ctx.fill('evenodd')
}

function coeur(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const h = w * 0.92
  ctx.moveTo(x, y + h * 0.42)
  ctx.bezierCurveTo(x - w * 0.62, y + h * 0.02, x - w * 0.42, y - h * 0.62, x, y - h * 0.24)
  ctx.bezierCurveTo(x + w * 0.42, y - h * 0.62, x + w * 0.62, y + h * 0.02, x, y + h * 0.42)
}

function etoile(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
}

function flocon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3
    const ex = x + Math.cos(a) * r
    const ey = y + Math.sin(a) * r
    ctx.moveTo(x, y)
    ctx.lineTo(ex, ey)
    // les petites branches
    for (const k of [0.55, 0.78]) {
      const bx = x + Math.cos(a) * r * k
      const by = y + Math.sin(a) * r * k
      for (const s of [-1, 1]) {
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + Math.cos(a + s * 0.7) * r * 0.28, by + Math.sin(a + s * 0.7) * r * 0.28)
      }
    }
  }
}

/** Des points répartis le long du bord, au milieu d'un bandeau d'épaisseur t. */
function autour(W: number, H: number, t: number, pas: number): [number, number][] {
  const out: [number, number][] = []
  const x0 = t / 2, y0 = t / 2, x1 = W - t / 2, y1 = H - t / 2
  const per = 2 * (x1 - x0) + 2 * (y1 - y0)
  const n = Math.max(8, Math.round(per / pas))
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per
    if (d < x1 - x0) out.push([x0 + d, y0])
    else if ((d -= x1 - x0) < y1 - y0) out.push([x1, y0 + d])
    else if ((d -= y1 - y0) < x1 - x0) out.push([x1 - d, y1])
    else out.push([x0, y1 - (d - (x1 - x0))])
  }
  return out
}

function scotch(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, a: number, col: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.beginPath()
  // bouts déchirés en zigzag
  const z = w / 6
  ctx.moveTo(-len / 2, -w / 2)
  ctx.lineTo(len / 2, -w / 2)
  for (let i = 0; i <= 6; i++) ctx.lineTo(len / 2 + (i % 2 ? z * 0.6 : 0), -w / 2 + i * z)
  ctx.lineTo(-len / 2, w / 2)
  for (let i = 6; i >= 0; i--) ctx.lineTo(-len / 2 - (i % 2 ? z * 0.6 : 0), -w / 2 + i * z)
  ctx.closePath()
  ctx.globalAlpha = 0.82
  ctx.fillStyle = col
  ctx.fill()
  ctx.clip()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#FFFFFF'
  for (let i = -len; i < len; i += w * 0.5) ctx.fillRect(i, -w, w * 0.18, w * 2)
  ctx.restore()
}

function ruban(ctx: CanvasRenderingContext2D, W: number, y0: number, m: number, seed: number) {
  // une guirlande de fanions qui pend en haut
  const rnd = rng(seed)
  const couleurs = ['#FF6B81', '#FFC53D', '#5ED3C9', '#A58BFF', '#7BD389', '#FFA06B']
  const n = Math.max(7, Math.round(W / (m * 0.13)))
  const sag = m * 0.07
  const yAt = (x: number) => y0 + Math.sin((x / W) * Math.PI) * sag
  ctx.strokeStyle = '#8D6E63'
  ctx.lineWidth = m * 0.006
  ctx.beginPath()
  for (let x = 0; x <= W; x += W / 40) (x ? ctx.lineTo(x, yAt(x)) : ctx.moveTo(x, yAt(x)))
  ctx.stroke()
  const fw = W / n
  for (let i = 0; i < n; i++) {
    const xa = i * fw + fw * 0.1
    const xb = xa + fw * 0.8
    const xm = (xa + xb) / 2
    ctx.fillStyle = couleurs[i % couleurs.length]
    ctx.beginPath()
    ctx.moveTo(xa, yAt(xa))
    ctx.lineTo(xb, yAt(xb))
    ctx.lineTo(xm, yAt(xm) + fw * (0.9 + rnd() * 0.1))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.arc(xm, yAt(xm) + fw * 0.32, fw * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }
}

function confettis(ctx: CanvasRenderingContext2D, W: number, H: number, m: number, seed: number, n = 40) {
  const rnd = rng(seed)
  const couleurs = ['#FF6B81', '#FFC53D', '#5ED3C9', '#A58BFF', '#7BD389', '#FFA06B', '#3E9BE9']
  for (let i = 0; i < n; i++) {
    // surtout près des bords
    const side = rnd()
    const e = rnd() * m * 0.12
    const x = side < 0.5 ? rnd() * W : side < 0.75 ? e : W - e
    const y = side < 0.25 ? e : side < 0.5 ? H - e : rnd() * H
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rnd() * Math.PI)
    ctx.fillStyle = couleurs[Math.floor(rnd() * couleurs.length)]
    if (rnd() < 0.5) ctx.fillRect(-m * 0.011, -m * 0.005, m * 0.022, m * 0.01)
    else {
      ctx.beginPath()
      ctx.arc(0, 0, m * 0.007, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

/** Dessine le cadre dans ctx (unités de la feuille) ; renvoie false s'il manque une image (onLoad sera appelé). */
function dessiner(ctx: CanvasRenderingContext2D, key: CadreKey, W: number, H: number, onLoad?: () => void): boolean {
  const m = Math.min(W, H)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (key) {
    case 'polaroid':
    case 'scotch': {
      const t = m * 0.055
      const b = m * 0.19
      ctx.fillStyle = '#FFFDF7'
      bande(ctx, W, H, t, t, b, t)
      ctx.strokeStyle = 'rgba(29,26,43,0.14)'
      ctx.lineWidth = m * 0.004
      ctx.strokeRect(t, t, W - 2 * t, H - t - b)
      if (key === 'scotch') {
        scotch(ctx, m * 0.1, m * 0.06, m * 0.36, m * 0.09, -0.62, '#FFB3C7')
        scotch(ctx, W - m * 0.1, m * 0.06, m * 0.36, m * 0.09, 0.62, '#A8E0FF')
      }
      return true
    }
    case 'pellicule': {
      const t = m * 0.12
      ctx.fillStyle = '#1D1A2B'
      bande(ctx, W, H, t, m * 0.025, t, m * 0.025)
      // les trous de la pellicule
      ctx.globalCompositeOperation = 'destination-out'
      const hw = m * 0.045, hh = m * 0.05, pas = m * 0.085
      for (let x = pas / 2; x < W; x += pas) {
        for (const y of [t / 2, H - t / 2]) {
          ctx.beginPath()
          ctx.roundRect(x - hw / 2, y - hh / 2, hw, hh, m * 0.01)
          ctx.fill()
        }
      }
      ctx.globalCompositeOperation = 'source-over'
      return true
    }
    case 'dentelle': {
      const t = m * 0.07
      const r = m * 0.028
      ctx.fillStyle = '#FFFFFF'
      bande(ctx, W, H, t, t)
      // festons vers l'intérieur et petits trous de dentelle
      ctx.beginPath()
      for (const [x, y] of autour(W, H, 2 * t, r * 1.8)) {
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      for (const [x, y] of autour(W, H, t, r * 1.8)) {
        ctx.moveTo(x + r * 0.3, y)
        ctx.arc(x, y, r * 0.3, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      return true
    }
    case 'postale': {
      const t = m * 0.06
      // bord « par avion » : rayures rouges et bleues en biais, sur du blanc
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, H)
      ctx.rect(t, t, W - 2 * t, H - 2 * t)
      ctx.clip('evenodd')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, W, H)
      const s = m * 0.045
      let k = 0
      for (let i = -H; i < W + H; i += s * 2, k++) {
        ctx.fillStyle = k % 2 ? '#3E6FD8' : '#E5484D'
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + s, 0)
        ctx.lineTo(i + s - H, H)
        ctx.lineTo(i - H, H)
        ctx.fill()
      }
      ctx.restore()
      // un liseré blanc côté photo
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.rect(t * 0.7, t * 0.7, W - 1.4 * t, H - 1.4 * t)
      ctx.rect(t, t, W - 2 * t, H - 2 * t)
      ctx.fill('evenodd')
      // le timbre dentelé et son tampon
      const sw = m * 0.2, sh = m * 0.24
      const sx = W - t - sw - m * 0.03, sy = t + m * 0.03
      const z = Math.hypot(ctx.getTransform().a, ctx.getTransform().b)
      ctx.save()
      ctx.translate(sx + sw / 2, sy + sh / 2)
      ctx.rotate(0.06)
      ctx.save()
      ctx.shadowColor = 'rgba(29,26,43,0.25)'
      ctx.shadowBlur = m * 0.012 * z
      ctx.shadowOffsetY = m * 0.004 * z
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh)
      ctx.restore()
      ctx.globalCompositeOperation = 'destination-out'
      const dr = m * 0.011
      ctx.beginPath()
      for (let x = -sw / 2; x <= sw / 2 + 0.1; x += dr * 2.6) for (const y of [-sh / 2, sh / 2]) (ctx.moveTo(x + dr, y), ctx.arc(x, y, dr, 0, Math.PI * 2))
      for (let y = -sh / 2; y <= sh / 2 + 0.1; y += dr * 2.6) for (const x of [-sw / 2, sw / 2]) (ctx.moveTo(x + dr, y), ctx.arc(x, y, dr, 0, Math.PI * 2))
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#FFE1E8'
      ctx.fillRect(-sw / 2 + m * 0.022, -sh / 2 + m * 0.022, sw - m * 0.044, sh - m * 0.044)
      ctx.fillStyle = '#FF6B81'
      ctx.beginPath()
      coeur(ctx, 0, 0, sw * 0.5)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = 'rgba(70,60,120,0.5)'
      ctx.lineWidth = m * 0.007
      ctx.beginPath()
      const cx = sx - m * 0.02, cy = sy + sh * 0.62
      ctx.moveTo(cx + m * 0.08, cy)
      ctx.arc(cx, cy, m * 0.08, 0, Math.PI * 2)
      ctx.moveTo(cx + m * 0.055, cy)
      ctx.arc(cx, cy, m * 0.055, 0, Math.PI * 2)
      for (let j = 0; j < 3; j++) {
        const y = sy + sh * 0.5 + j * m * 0.035
        ctx.moveTo(cx - m * 0.09, y)
        for (let x = 0; x <= m * 0.26; x += m * 0.02) ctx.lineTo(cx - m * 0.09 + x, y + Math.sin(x / (m * 0.02)) * m * 0.008)
      }
      ctx.stroke()
      return true
    }
    case 'coeurs': {
      const t = m * 0.075
      ctx.fillStyle = '#FFD6E0'
      bande(ctx, W, H, t, t)
      const pts = autour(W, H, t, m * 0.085)
      pts.forEach(([x, y], i) => {
        ctx.fillStyle = ['#FF6B81', '#FF9EB5', '#E5484D'][i % 3]
        ctx.beginPath()
        coeur(ctx, x, y + t * 0.04, t * 0.62)
        ctx.fill()
      })
      return true
    }
    case 'fanions':
      ruban(ctx, W, m * 0.02, m, 3)
      confettis(ctx, W, H, m, 7, 26)
      return true
    case 'ballons': {
      ruban(ctx, W, m * 0.02, m, 5)
      confettis(ctx, W, H, m, 9, 34)
      // des ballons en feutrine dans les coins du bas
      const a = stickerSrc('ballons', onLoad)
      const g = stickerSrc('gateau', onLoad)
      if (!a || !g) return false
      const w = m * 0.34
      ctx.save()
      ctx.translate(w * 0.42, H - w * 0.5)
      ctx.rotate(-0.12)
      ctx.drawImage(a, -w / 2, -w * 0.58, w, w * (a.height / a.width))
      ctx.restore()
      const w2 = m * 0.28
      ctx.save()
      ctx.translate(W - w2 * 0.5, H - w2 * 0.48)
      ctx.rotate(0.1)
      ctx.drawImage(g, -w2 / 2, -w2 / 2, w2, w2 * (g.height / g.width))
      ctx.restore()
      return true
    }
    case 'fleurs': {
      const t = m * 0.03
      ctx.fillStyle = '#FFFFFF'
      bande(ctx, W, H, t, t)
      const f1 = stickerSrc('fleurs', onLoad)
      const f2 = stickerSrc('fleur', onLoad)
      const f3 = stickerSrc('papillon', onLoad)
      const f4 = stickerSrc('coccinelle', onLoad)
      if (!f1 || !f2 || !f3 || !f4) return false
      const pose = (img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, a: number) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(a)
        ctx.drawImage(img, -w / 2, -(w * img.height) / img.width / 2, w, (w * img.height) / img.width)
        ctx.restore()
      }
      pose(f1, m * 0.13, m * 0.13, m * 0.3, -0.2)
      pose(f2, W - m * 0.11, H - m * 0.17, m * 0.2, 0.25)
      pose(f3, W - m * 0.12, m * 0.11, m * 0.2, 0.3)
      pose(f4, m * 0.1, H - m * 0.1, m * 0.15, -0.3)
      return true
    }
    case 'arcenciel': {
      const t = m * 0.07
      const cols = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA']
      cols.forEach((c, i) => {
        ctx.fillStyle = c
        const e = (t / cols.length) * i
        ctx.beginPath()
        ctx.rect(e, e, W - 2 * e, H - 2 * e)
        ctx.roundRect(e + t / cols.length, e + t / cols.length, W - 2 * (e + t / cols.length), H - 2 * (e + t / cols.length), i === cols.length - 1 ? m * 0.03 : 0)
        ctx.fill('evenodd')
      })
      return true
    }
    case 'etoiles': {
      const t = m * 0.075
      ctx.fillStyle = '#1E1B33'
      bande(ctx, W, H, t, t, t, t, m * 0.03)
      const rnd = rng(11)
      for (const [x, y] of autour(W, H, t, m * 0.07)) {
        ctx.fillStyle = rnd() < 0.7 ? '#FFD43B' : '#FFFFFF'
        ctx.beginPath()
        etoile(ctx, x + (rnd() - 0.5) * t * 0.3, y + (rnd() - 0.5) * t * 0.3, t * (0.2 + rnd() * 0.18), rnd())
        ctx.fill()
      }
      return true
    }
    case 'or': {
      const t = m * 0.045
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#B8860B')
      g.addColorStop(0.3, '#F7D774')
      g.addColorStop(0.55, '#C9971C')
      g.addColorStop(0.8, '#FBE7A1')
      g.addColorStop(1, '#B07D12')
      ctx.fillStyle = g
      bande(ctx, W, H, t, t)
      ctx.strokeStyle = g
      ctx.lineWidth = m * 0.006
      ctx.strokeRect(t + m * 0.022, t + m * 0.022, W - 2 * (t + m * 0.022), H - 2 * (t + m * 0.022))
      for (const [x, y] of [[t + m * 0.022, t + m * 0.022], [W - t - m * 0.022, t + m * 0.022], [t + m * 0.022, H - t - m * 0.022], [W - t - m * 0.022, H - t - m * 0.022]]) {
        ctx.fillStyle = g
        ctx.beginPath()
        etoile(ctx, x, y, m * 0.028)
        ctx.fill()
      }
      return true
    }
    case 'noel': {
      const t = m * 0.07
      ctx.fillStyle = '#2F6B3A'
      bande(ctx, W, H, t, t)
      const rnd = rng(21)
      for (const [x, y] of autour(W, H, t, m * 0.06)) {
        const a = rnd() * Math.PI * 2
        ctx.fillStyle = rnd() < 0.5 ? '#3E8E4C' : '#4FA65E'
        for (const s of [-1, 1]) {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(a + (s * Math.PI) / 4)
          ctx.beginPath()
          ctx.ellipse(t * 0.28, 0, t * 0.3, t * 0.13, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        ctx.fillStyle = '#E03131'
        for (let k = 0; k < 3; k++) {
          ctx.beginPath()
          ctx.arc(x + Math.cos(k * 2.1 + a) * t * 0.09, y + Math.sin(k * 2.1 + a) * t * 0.09, t * 0.08, 0, Math.PI * 2)
          ctx.fill()
        }
        if (rnd() < 0.2) {
          ctx.fillStyle = '#FFD43B'
          ctx.beginPath()
          etoile(ctx, x, y, t * 0.22)
          ctx.fill()
        }
      }
      // un peu de neige
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      for (let i = 0; i < 40; i++) {
        ctx.beginPath()
        ctx.arc(rnd() * W, rnd() * H < H / 2 ? rnd() * t : H - rnd() * t, m * 0.005, 0, Math.PI * 2)
        ctx.fill()
      }
      return true
    }
    case 'neige': {
      // un voile de givre sur les bords, et des flocons
      const t = m * 0.16
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
        [0, 0, 0, t, 0, 0, W, t],
        [0, H, 0, H - t, 0, H - t, W, t],
        [0, 0, t, 0, 0, 0, t, H],
        [W, 0, W - t, 0, W - t, 0, t, H],
      ]) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1)
        g.addColorStop(0, 'rgba(255,255,255,0.85)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(rx, ry, rw, rh)
      }
      const rnd = rng(31)
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = m * 0.006
      ctx.beginPath()
      for (const [x, y] of autour(W, H, t * 0.6, m * 0.11)) flocon(ctx, x + (rnd() - 0.5) * t * 0.5, y + (rnd() - 0.5) * t * 0.5, m * (0.02 + rnd() * 0.025), rnd())
      ctx.stroke()
      ctx.strokeStyle = 'rgba(160,200,255,0.8)'
      ctx.lineWidth = m * 0.0025
      ctx.stroke()
      return true
    }
    default:
      return true
  }
}

const calques = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

/** Pose le cadre sur ctx (déjà à l'échelle de la feuille), dans un calque à part pour pouvoir y percer des trous. */
export function peindreCadre(ctx: CanvasRenderingContext2D, key: string | undefined, W: number, H: number, onLoad?: () => void): boolean {
  if (!key || key === 'aucun' || !CADRES.some((c) => c.key === key)) return true
  const c = ctx.canvas as HTMLCanvasElement
  let l = calques.get(c)
  if (!l) {
    l = document.createElement('canvas')
    calques.set(c, l)
  }
  if (l.width !== c.width || l.height !== c.height) {
    l.width = c.width
    l.height = c.height
  }
  const lc = l.getContext('2d')!
  lc.setTransform(1, 0, 0, 1, 0, 0)
  lc.clearRect(0, 0, l.width, l.height)
  lc.setTransform(ctx.getTransform())
  lc.save()
  const ok = dessiner(lc, key as CadreKey, W, H, onLoad)
  lc.restore()
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(l, 0, 0)
  ctx.restore()
  return ok
}

/** Les petites vignettes des cadres, sur une image de fond (la photo) ou une couleur (le papier). */
export async function vignettesCadres(W: number, H: number, fond: CanvasImageSource | string, taille = 120): Promise<Record<string, string>> {
  const c = document.createElement('canvas')
  c.width = taille
  c.height = Math.round((taille * H) / W)
  const ctx = c.getContext('2d')!
  const out: Record<string, string> = {}
  // les images des cadres à fleurs et à ballons
  await new Promise<void>((res) => {
    let n = 0
    const fini = () => ++n >= 6 && res()
    for (const k of ['fleurs', 'fleur', 'papillon', 'coccinelle', 'ballons', 'gateau']) (stickerSrc(k, fini) ? fini() : null)
    setTimeout(res, 3000)
  })
  for (const { key } of CADRES) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    if (typeof fond === 'string') {
      ctx.fillStyle = fond
      ctx.fillRect(0, 0, c.width, c.height)
    } else {
      const f = fond as HTMLImageElement
      const r = f.width / f.height
      const cr = c.width / c.height
      const [sw, sh] = r > cr ? [f.height * cr, f.height] : [f.width, f.width / cr]
      ctx.drawImage(f, (f.width - sw) / 2, (f.height - sh) / 2, sw, sh, 0, 0, c.width, c.height)
    }
    ctx.setTransform(c.width / W, 0, 0, c.width / W, 0, 0)
    peindreCadre(ctx, key, W, H)
    out[key] = c.toDataURL('image/jpeg', 0.82)
  }
  return out
}

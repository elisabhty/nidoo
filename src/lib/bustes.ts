// Photographie d'un personnage : ce que le composant Character montre à l'écran (la figurine recolorée, ses habits,
// leurs ombres, le visage qui repasse devant…) redessiné sur une toile, pour en faire une image.
// Les widgets iOS ne savent pas composer une figurine : l'appli leur donne le buste de chaque proche tout prêt.
// On relit la mise en page réelle (positions, retournements, découpes, masques) plutôt que de la recalculer :
// l'image est celle de l'écran, quoi que le composant devienne.

const charger = (src: string) =>
  new Promise<HTMLImageElement | null>((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ok(null)
    i.src = src
  })

type Cadre = { base: DOMRect; k: number; W: number; H: number }

/** Dessine `racine` (et tout ce qu'il contient) sur une toile de `cote` pixels de large ; renvoie un PNG (data URL). */
export async function photographier(racine: HTMLElement, cote: number): Promise<string> {
  const base = racine.getBoundingClientRect()
  if (!base.width || !base.height) throw new Error('RIEN_A_DESSINER')
  const k = cote / base.width
  const toile = document.createElement('canvas')
  toile.width = cote
  toile.height = Math.round(base.height * k)
  const ctx = toile.getContext('2d')
  if (!ctx) throw new Error('TOILE')
  await peindre(ctx, racine, { base, k, W: toile.width, H: toile.height }, false)
  return toile.toDataURL('image/png')
}

async function peindre(ctx: CanvasRenderingContext2D, el: Element, c: Cadre, miroir: boolean): Promise<void> {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return
  const opacite = Number.parseFloat(cs.opacity || '1')
  if (!(opacite > 0)) return
  // un retournement (scaleX(-1)) : tout ce qui est dedans se dessine en miroir
  const m = /^matrix\(\s*(-?[\d.e+-]+)/.exec(cs.transform || '')
  if (m && Number.parseFloat(m[1]) < 0) miroir = !miroir
  const masque = [cs.maskImage, (cs as unknown as { webkitMaskImage?: string }).webkitMaskImage].find((v) => v && v !== 'none') ?? ''
  if (!masque && opacite >= 1) return contenu(ctx, el, cs, c, miroir)
  // un masque ou une transparence : sur un calque à part, posé ensuite d'un seul coup
  const calque = document.createElement('canvas')
  calque.width = c.W
  calque.height = c.H
  const x2 = calque.getContext('2d')
  if (!x2) return
  await contenu(x2, el, cs, c, miroir)
  if (masque) await masquer(x2, el, masque, c)
  ctx.save()
  ctx.globalAlpha = opacite
  ctx.drawImage(calque, 0, 0)
  ctx.restore()
}

const boite = (el: Element, c: Cadre) => {
  const r = el.getBoundingClientRect()
  return { x: (r.left - c.base.left) * c.k, y: (r.top - c.base.top) * c.k, w: r.width * c.k, h: r.height * c.k }
}

async function contenu(ctx: CanvasRenderingContext2D, el: Element, cs: CSSStyleDeclaration, c: Cadre, miroir: boolean): Promise<void> {
  if (el instanceof HTMLImageElement) {
    if (!el.complete || !el.naturalWidth) await el.decode().catch(() => undefined)
    if (!el.naturalWidth) return
    const { x, y, w, h } = boite(el, c)
    ctx.save()
    // clip-path: inset(haut droite bas gauche), dans le repère de l'image avant retournement
    const decoupe = /^inset\(([^)]*)\)/.exec(cs.clipPath || '')
    if (decoupe) {
      const v = decoupe[1].trim().split(/\s+/)
      const de = (t: string | undefined, sur: number) => (!t ? 0 : t.endsWith('%') ? (Number.parseFloat(t) / 100) * sur : Number.parseFloat(t) * c.k || 0)
      const haut = de(v[0], h)
      let droite = de(v[1] ?? v[0], w)
      const bas = de(v[2] ?? v[0], h)
      let gauche = de(v[3] ?? v[1] ?? v[0], w)
      if (miroir) [gauche, droite] = [droite, gauche]
      ctx.beginPath()
      ctx.rect(x + gauche, y + haut, w - gauche - droite, h - haut - bas)
      ctx.clip()
    }
    if (miroir) {
      ctx.translate(x + w, y)
      ctx.scale(-1, 1)
      ctx.drawImage(el, 0, 0, w, h)
    } else ctx.drawImage(el, x, y, w, h)
    ctx.restore()
    return
  }
  if (el instanceof SVGSVGElement) return dessinVectoriel(ctx, el, c)
  for (const enfant of Array.from(el.children)) await peindre(ctx, enfant, c, miroir)
}

/** Un dessin vectoriel (le nez, la bouche, les lunettes) : ses formes d'abord, puis ses images, chacune à sa place. */
async function dessinVectoriel(ctx: CanvasRenderingContext2D, svg: SVGSVGElement, c: Cadre): Promise<void> {
  const r = svg.getBoundingClientRect()
  if (!r.width || !r.height) return
  const copie = svg.cloneNode(true) as SVGSVGElement
  copie.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copie.setAttribute('width', String(r.width))
  copie.setAttribute('height', String(r.height))
  copie.removeAttribute('class')
  copie.removeAttribute('style')
  // les images incrustées sont dessinées à part : une image dans un dessin lui-même chargé comme image
  // n'est pas toujours prête au premier affichage (Safari)
  for (const im of Array.from(copie.querySelectorAll('image'))) im.remove()
  const { x, y, w, h } = boite(svg, c)
  const formes = await charger(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copie))}`)
  if (formes) ctx.drawImage(formes, x, y, w, h)
  for (const im of Array.from(svg.querySelectorAll('image'))) {
    const href = im.getAttribute('href') ?? im.getAttribute('xlink:href')
    const m = (im as SVGImageElement).getScreenCTM()
    if (!href || !m) continue
    const img = await charger(new URL(href, document.baseURI).href)
    if (!img) continue
    const nombre = (a: string) => Number.parseFloat(im.getAttribute(a) ?? '0') || 0
    ctx.save()
    ctx.setTransform(c.k * m.a, c.k * m.b, c.k * m.c, c.k * m.d, c.k * (m.e - c.base.left), c.k * (m.f - c.base.top))
    ctx.drawImage(img, nombre('x'), nombre('y'), nombre('width') || img.naturalWidth, nombre('height') || img.naturalHeight)
    ctx.restore()
  }
}

/** Ne garde du calque que ce que le masque laisse voir (une image à la taille de l'élément, ou un fondu vers le bas). */
async function masquer(ctx: CanvasRenderingContext2D, el: Element, masque: string, c: Cadre): Promise<void> {
  const { x, y, w, h } = boite(el, c)
  const url = /url\((['"]?)(.+?)\1\)/.exec(masque)
  if (url) {
    const img = await charger(url[2])
    if (!img) return
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
    return
  }
  // linear-gradient(rgb(0, 0, 0) 23%, rgba(0, 0, 0, 0) 26%) : opaque en haut, effacé en dessous
  const arrets = [...masque.matchAll(/(-?[\d.]+)%/g)].map((a) => Math.min(1, Math.max(0, Number.parseFloat(a[1]) / 100)))
  if (!masque.startsWith('linear-gradient') || arrets.length < 2) return
  const fondu = ctx.createLinearGradient(0, y, 0, y + h)
  fondu.addColorStop(arrets[0], 'rgba(0,0,0,1)')
  fondu.addColorStop(Math.max(arrets[0], arrets[1]), 'rgba(0,0,0,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = fondu
  ctx.fillRect(0, 0, c.W, c.H)
  ctx.restore()
}

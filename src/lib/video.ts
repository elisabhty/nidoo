// Les vidéos du fil et des albums (Elisa, 27 novembre : « optimiser les vidéos, pour la partie fil surtout »).
// Avant l'envoi, le téléphone prépare la vidéo : 720p, environ 2 Mbit/s, la première minute au plus dans le fil.
// Elle pèse alors 3 à 4 fois moins (une vidéo de 30 s : ~7 Mo au lieu de ~25). Le travail est fait par la puce vidéo
// du téléphone (WebCodecs, iOS 16.4 et après), avec la bibliothèque Mediabunny, chargée seulement à ce moment-là.
// Si le téléphone ne sait pas faire, la vidéo d'origine part telle quelle (25 Mo au plus).

export const VIDEO_FIL_MAX_S = 60
export const VIDEO_MAX_OCTETS = 25 * 1024 * 1024
const COTE_MAX = 1280
const DEBIT = 2_000_000

export type Preparation = {
  blob: Blob
  /** une image de la vidéo, pour l'afficher dans le fil sans rien télécharger d'autre */
  affiche: Blob | null
  duree: number
  largeur: number
  hauteur: number
  /** false : c'est la vidéo d'origine (le téléphone n'a pas su la préparer, ou elle était déjà légère) */
  compressee: boolean
}

/** Une erreur qu'on peut dire à la personne. */
export class ErreurVideo extends Error {
  constructor(
    readonly code: 'ILLISIBLE' | 'TROP_LONGUE' | 'TROP_LOURDE' | 'ANNULEE' | 'COUPE_IMPOSSIBLE',
    readonly duree = 0,
  ) {
    super(code)
  }
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
export const dureeEnMots = (s: number) => {
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return m ? `${m} min${r ? ` ${String(r).padStart(2, '0')}` : ''}` : `${r} s`
}

/** La durée et la taille d'une vidéo, lues par le navigateur. */
export function infosVideo(f: Blob): Promise<{ duree: number; largeur: number; hauteur: number }> {
  return new Promise((res, rej) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(f)
    const fin = (e?: unknown) => {
      window.clearTimeout(minuteur)
      v.removeAttribute('src')
      v.load()
      URL.revokeObjectURL(url)
      if (e) rej(e)
    }
    const minuteur = window.setTimeout(() => fin(new ErreurVideo('ILLISIBLE')), 10000)
    v.preload = 'metadata'
    v.muted = true
    v.playsInline = true
    v.onloadedmetadata = () => {
      const r = { duree: Number.isFinite(v.duration) ? v.duration : 0, largeur: v.videoWidth, hauteur: v.videoHeight }
      fin()
      res(r)
    }
    v.onerror = () => fin(new ErreurVideo('ILLISIBLE'))
    v.src = url
  })
}

const pair = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** Une image de la vidéo (vers 0,1 s), en JPEG de 720 px au plus ; null si le téléphone n'y arrive pas. */
async function afficheAvecLaBalise(f: Blob): Promise<Blob | null> {
  return new Promise((res) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(f)
    let fini = false
    const fin = (b: Blob | null) => {
      if (fini) return
      fini = true
      window.clearTimeout(minuteur)
      v.removeAttribute('src')
      v.load()
      URL.revokeObjectURL(url)
      res(b)
    }
    const minuteur = window.setTimeout(() => fin(null), 8000)
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.1, (v.duration || 1) / 2)
    }
    v.onseeked = () => {
      try {
        const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(v.videoWidth * k))
        c.height = Math.max(1, Math.round(v.videoHeight * k))
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
        c.toBlob((b) => fin(b), 'image/jpeg', 0.78)
      } catch {
        fin(null)
      }
    }
    v.onerror = () => fin(null)
    v.src = url
  })
}

type Mb = typeof import('mediabunny')
const enUrl = async (c: HTMLCanvasElement | OffscreenCanvas) =>
  c instanceof HTMLCanvasElement ? c.toDataURL('image/jpeg', 0.7) : URL.createObjectURL(await c.convertToBlob({ type: 'image/jpeg', quality: 0.7 }))
let mediabunny: Promise<Mb> | null = null
const charger = () => (mediabunny ??= import('mediabunny'))

/** L'affiche avec Mediabunny (le décodeur vidéo du téléphone), sinon avec une balise <video>. */
async function affiche(f: Blob): Promise<Blob | null> {
  try {
    const mb = await charger()
    const input = new mb.Input({ source: new mb.BlobSource(f), formats: mb.ALL_FORMATS })
    try {
      const piste = await input.getPrimaryVideoTrack()
      if (!piste || !(await piste.canDecode())) throw new Error('decodeur')
      const w = await piste.getDisplayWidth()
      const h = await piste.getDisplayHeight()
      const k = Math.min(1, 720 / Math.max(w, h))
      const sink = new mb.CanvasSink(piste, { width: pair(w * k), height: pair(h * k), fit: 'contain' })
      const debut = await piste.getFirstTimestamp().catch(() => 0)
      const img = await sink.getCanvas(debut + 0.1)
      if (!img) throw new Error('image')
      const c = img.canvas
      const b = 'convertToBlob' in c ? await c.convertToBlob({ type: 'image/jpeg', quality: 0.78 }) : await new Promise<Blob | null>((r) => (c as HTMLCanvasElement).toBlob(r, 'image/jpeg', 0.78))
      if (b) return b
    } finally {
      input.dispose()
    }
  } catch {
    /* on essaie autrement */
  }
  return afficheAvecLaBalise(f)
}

/** Le passage qu'on garde d'une vidéo, en secondes. */
export type Extrait = { debut: number; fin: number }

/** Réduire la vidéo (720p, ~2 Mbit/s), en ne gardant que `extrait` (sinon les `maxS` premières secondes, si elle est
 *  plus longue). Lève une erreur si le téléphone ne sait pas faire, pour que l'appelant envoie la vidéo d'origine. */
async function compresser(f: Blob, maxS: number | null, extrait: Extrait | null, onProgres: (p: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; duree: number; largeur: number; hauteur: number } | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') throw new Error('WEBCODECS_ABSENT')
  const mb = await charger()
  const input = new mb.Input({ source: new mb.BlobSource(f), formats: mb.ALL_FORMATS })
  try {
    const piste = await input.getPrimaryVideoTrack()
    if (!piste) throw new ErreurVideo('ILLISIBLE')
    const w = await piste.getDisplayWidth()
    const h = await piste.getDisplayHeight()
    const duree = await input.computeDuration()
    const k = Math.min(1, COTE_MAX / Math.max(w, h))
    const largeur = pair(w * k)
    const hauteur = pair(h * k)
    const passage = extrait ?? (maxS !== null && duree > maxS + 0.25 ? { debut: 0, fin: maxS } : null)
    const couper = !!passage && (passage.debut > 0.05 || passage.fin < duree - 0.05)
    const debut = couper ? Math.max(0, passage!.debut) : 0
    const fin = couper ? Math.min(duree, passage!.fin) : duree
    // déjà légère et assez courte : on la garde comme elle est
    if (!couper && k === 1 && (f.size * 8) / Math.max(duree, 0.1) <= DEBIT * 1.4) return null
    const codec = (await mb.canEncodeVideo('avc', { width: largeur, height: hauteur, bitrate: DEBIT })) ? 'avc' : (await mb.canEncodeVideo('hevc', { width: largeur, height: hauteur, bitrate: DEBIT })) ? 'hevc' : null
    if (!codec) throw new Error('ENCODEUR_ABSENT')
    // Les iPhone filment en HDR : on redessine chaque image dans une toile classique pour qu'elle garde des couleurs
    // justes une fois en vidéo ordinaire.
    const hdr = await piste.hasHighDynamicRange().catch(() => false)
    let toile: OffscreenCanvas | HTMLCanvasElement | null = null
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: {
        width: largeur,
        height: hauteur,
        fit: 'contain',
        codec,
        quality: new mb.Quality({ bitrate: DEBIT }),
        forceTranscode: true,
        ...(hdr
          ? {
              process: (s) => {
                toile ??= typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(largeur, hauteur) : Object.assign(document.createElement('canvas'), { width: largeur, height: hauteur })
                const ctx = toile.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
                s.draw(ctx, 0, 0, largeur, hauteur)
                return toile
              },
              processedWidth: largeur,
              processedHeight: hauteur,
            }
          : {}),
      },
      ...(couper ? { trim: { start: debut, end: fin } } : {}),
    })
    // une piste perdue (le son, le plus souvent, sur un téléphone qui ne sait pas l'encoder) : on n'envoie pas une
    // vidéo muette, on garde l'originale
    if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.type === 'video' || d.track.type === 'audio')) throw new Error('CONVERSION_IMPOSSIBLE')
    conversion.onProgress = (p) => onProgres(Math.min(0.99, p))
    const stop = () => void conversion.cancel()
    signal?.addEventListener('abort', stop)
    try {
      await conversion.execute()
    } catch (e) {
      if (signal?.aborted) throw new ErreurVideo('ANNULEE')
      throw e
    } finally {
      signal?.removeEventListener('abort', stop)
    }
    const buffer = output.target.buffer
    if (!buffer) throw new Error('VIDEO_VIDE')
    return { blob: new Blob([buffer], { type: 'video/mp4' }), duree: fin - debut, largeur, hauteur }
  } finally {
    input.dispose()
  }
}

const typeVideo = (f: Blob) => {
  const t = f.type.split(';')[0].toLowerCase()
  if (t === 'video/mp4' || t === 'video/quicktime' || t === 'video/webm') return t
  const ext = f instanceof File ? f.name.split('.').pop()?.toLowerCase() : ''
  return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4'
}

/**
 * Préparer une vidéo avant de l'envoyer. `maxS` : la durée maximale (null : pas de limite, comme dans les albums).
 * `extrait` : le passage choisi (comme sur Snap). Sans extrait, une vidéo trop longue lève ErreurVideo('TROP_LONGUE')
 * avec sa durée, pour qu'on puisse la faire couper.
 */
export async function preparerVideo(f: Blob, o: { maxS: number | null; extrait?: Extrait | null; onProgres?: (p: number) => void; signal?: AbortSignal }): Promise<Preparation> {
  const infos = await infosVideo(f).catch(() => null)
  const extrait = o.extrait ?? null
  if (infos && o.maxS !== null && infos.duree > o.maxS + 0.25 && !extrait) throw new ErreurVideo('TROP_LONGUE', infos.duree)
  let faite: Awaited<ReturnType<typeof compresser>> = null
  let echec = false
  try {
    faite = await compresser(f, o.maxS, extrait, o.onProgres ?? (() => undefined), o.signal)
  } catch (e) {
    if (e instanceof ErreurVideo && e.code === 'ANNULEE') throw e
    echec = true
  }
  if (o.signal?.aborted) throw new ErreurVideo('ANNULEE')
  if (faite && faite.blob.size < f.size) {
    o.onProgres?.(1)
    return { blob: faite.blob, affiche: await affiche(faite.blob), duree: faite.duree, largeur: faite.largeur, hauteur: faite.hauteur, compressee: true }
  }
  // la vidéo d'origine : seulement si elle tient (pas de coupe possible sans le téléphone)
  if (!infos) throw new ErreurVideo('ILLISIBLE')
  // sans le téléphone, pas de coupe : seulement si le passage choisi est la vidéo entière
  if (echec && extrait && (extrait.debut > 0.25 || extrait.fin < infos.duree - 0.25)) throw new ErreurVideo('COUPE_IMPOSSIBLE', infos.duree)
  if (echec && o.maxS !== null && infos.duree > o.maxS + 0.25) throw new ErreurVideo('TROP_LONGUE', infos.duree)
  if (f.size > VIDEO_MAX_OCTETS) throw new ErreurVideo('TROP_LOURDE', infos.duree)
  o.onProgres?.(1)
  const blob = f.type ? f : new Blob([f], { type: typeVideo(f) })
  return { blob, affiche: await affiche(blob), duree: infos.duree, largeur: infos.largeur, hauteur: infos.hauteur, compressee: false }
}

/** Le message à montrer pour une vidéo qu'on n'a pas pu préparer. */
export function texteErreurVideo(e: unknown, maxS: number | null) {
  if (e instanceof ErreurVideo) {
    if (e.code === 'TROP_LONGUE') return `Cette vidéo dure ${dureeEnMots(e.duree)}. Coupe-la à ${maxS === 60 ? '1 minute' : dureeEnMots(maxS ?? 60)} dans Photos (Modifier), puis réessaie.`
    if (e.code === 'COUPE_IMPOSSIBLE') return 'Ce téléphone ne sait pas couper la vidéo. Coupe-la dans Photos (Modifier), puis réessaie.'
    if (e.code === 'TROP_LOURDE') return 'Cette vidéo est trop lourde pour ce téléphone (25 Mo au plus). Essaie une vidéo plus courte.'
    if (e.code === 'ANNULEE') return ''
  }
  return 'Cette vidéo ne s’ouvre pas. Essaie une autre vidéo.'
}

/** Les images de la bande pour couper (comme sur Snap) : `n` images réparties sur la vidéo, `h` pixels de haut.
 *  Elles arrivent l'une après l'autre (onImage) ; d'abord avec le décodeur vidéo, sinon avec une balise <video>. */
export async function vignettes(f: Blob, n: number, h: number, onImage: (i: number, url: string) => void, signal?: AbortSignal) {
  const instants = (duree: number, debut = 0) => Array.from({ length: n }, (_, i) => debut + (duree - debut) * ((i + 0.5) / n))
  let faites = 0
  try {
    const mb = await charger()
    const input = new mb.Input({ source: new mb.BlobSource(f), formats: mb.ALL_FORMATS })
    try {
      const piste = await input.getPrimaryVideoTrack()
      if (!piste || !(await piste.canDecode())) throw new Error('decodeur')
      const w = await piste.getDisplayWidth()
      const hh = await piste.getDisplayHeight()
      const sink = new mb.CanvasSink(piste, { width: pair((h * 2 * w) / hh), height: pair(h * 2), fit: 'cover' })
      const debut = await piste.getFirstTimestamp().catch(() => 0)
      let i = 0
      for await (const c of sink.canvasesAtTimestamps(instants(await input.computeDuration(), debut))) {
        if (signal?.aborted) return
        if (c) onImage(i, await enUrl(c.canvas))
        i++
        faites = i
      }
      if (faites >= n) return
    } finally {
      input.dispose()
    }
  } catch {
    /* avec la balise <video> */
  }
  await new Promise<void>((res) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(f)
    const c = document.createElement('canvas')
    let i = faites
    let ts: number[] = []
    const fin = () => {
      window.clearTimeout(minuteur)
      v.removeAttribute('src')
      v.load()
      URL.revokeObjectURL(url)
      res()
    }
    const minuteur = window.setTimeout(fin, 20000)
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => {
      ts = instants(v.duration || 1)
      c.height = h * 2
      c.width = Math.max(2, Math.round((h * 2 * v.videoWidth) / Math.max(1, v.videoHeight)))
      if (i < n) v.currentTime = ts[i]
      else fin()
    }
    v.onseeked = () => {
      if (signal?.aborted) return fin()
      try {
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
        onImage(i, c.toDataURL('image/jpeg', 0.7))
      } catch {
        /* image suivante */
      }
      i++
      if (i < n) v.currentTime = ts[i]
      else fin()
    }
    v.onerror = fin
    v.src = url
  })
}

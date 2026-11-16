import { Brush, Camera, Eraser, Heart, Images, Move, Pencil, Rainbow, RotateCcw, Sparkles, Sticker as StickerIcon, Trash2, Undo2, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { demoDrawing, DRAW_H, DRAW_W, fit, INKS, loadPhoto, MAX_POINTS, paint, PAPERS, photoBox, pointCount, replayParts, strokePath, WIDTHS } from '../lib/drawing'
import { photoFinale, vignettesFiltres, type FiltreKey } from '../lib/filtres'
import { select, success, tap } from '../lib/haptic'
import { MAX_STICKERS } from '../lib/stickers'
import { useHome } from '../lib/store'
import type { Drawing, DrawingData, DrawTool, FamilyState, Member, Sticker, Stroke } from '../lib/types'
import { ago, compressImage, errorText } from '../lib/util'
import { FilterRow, nouveauSticker, StickerStage, StickerTray } from './stickers'
import { Avatar, Btn, choisir, confirmer, Sheet } from './ui'

const RATIO = `${DRAW_W} / ${DRAW_H}`

// ═════════════════════════ Dessins déjà vus (sur cet appareil) ═════════════════════════

const SEEN = 'nidoo.dessins.vus'
let seen = new Set<string>()
try {
  seen = new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[])
} catch {
  /* rien de mémorisé */
}
let version = 0
const subs = new Set<() => void>()
export function markDrawingsSeen(ids: string[]) {
  if (!ids.some((id) => !seen.has(id))) return
  for (const id of ids) seen.add(id)
  try {
    localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-300)))
  } catch {
    /* la mémoire de session suffit */
  }
  version++
  subs.forEach((s) => s())
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))

/** Dessins reçus pas encore regardés, du plus ancien au plus récent. */
export function useUnseenDrawings(state: FamilyState | null): Drawing[] {
  useSyncExternalStore(subscribe, () => version)
  if (!state) return []
  const { me } = state
  return state.drawings
    .filter(
      (d) =>
        d.from_member !== me.id &&
        (d.to_member === null || d.to_member === me.id) &&
        d.created_at >= me.joined_at &&
        Date.now() - new Date(d.created_at).getTime() < 3 * 86400000 &&
        !seen.has(d.id),
    )
    .reverse()
}

export const forWhom = (d: Drawing, me: Member, members: Member[]) => {
  const from = members.find((m) => m.id === d.from_member)
  const to = d.to_member ? members.find((m) => m.id === d.to_member) : null
  const fromName = d.from_member === me.id ? 'Toi' : (from?.display_name ?? 'Un ancien membre')
  const toName = !d.to_member ? 'toute la famille' : d.to_member === me.id ? 'toi' : (to?.display_name ?? 'un ancien membre')
  return { from, fromName, toName }
}

// ═════════════════════════ Toile ═════════════════════════

/** La photo de fond d'un instant, une fois chargée. */
export function usePhoto(url: string | null | undefined): HTMLImageElement | null {
  const [, bump] = useState(0)
  if (!url) return null
  return loadPhoto(url, () => bump((n) => n + 1))
}

/** Ce que contient un instant : une photo, une photo dessinée ou un dessin. */
export const whatOf = (d: Pick<Drawing, 'photo_path' | 'photo_url' | 'data'>) =>
  d.photo_path || d.photo_url ? (d.data.s.length ? 'une photo dessinée' : d.data.k?.length ? 'une photo décorée' : 'une photo') : 'un dessin'
export const sentText = (d: Drawing, fromName: string) =>
  d.to_member ? `${fromName} t’a envoyé ${whatOf(d)}` : `${fromName} a envoyé ${whatOf(d)} à la famille`

/** Affiche un instant (photo et/ou dessin). Chaque fois que `play` change (et n'est pas 0), le dessin se refait trait par trait sur la photo. */
export function DrawingCanvas({ data, id, play = 0, className = '', label, photo }: { data: DrawingData; id?: string; play?: number; className?: string; label?: string; photo?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const img = usePhoto(photo)
  // Les données sont relues à chaque rafraîchissement de la maison : on ne recommence le dessin que si c'en est un autre.
  const latest = useRef(data)
  latest.current = data
  useEffect(() => {
    const data = latest.current
    const c = ref.current
    if (!c) return
    let upto = Infinity
    let pop = 1
    let raf = 0
    const draw = () => {
      const ctx = fit(c)
      paint(ctx, data, upto, true, img, { stickers: pop, onLoad: () => requestAnimationFrame(draw) })
      if (upto !== Infinity) {
        // la pointe du crayon, pendant que le dessin se fait
        let left = upto
        for (const s of data.s) {
          const n = s.p.length / 2
          if (left <= n) {
            const i = Math.max(0, Math.min(n, left) - 1) * 2
            ctx.beginPath()
            ctx.arc(s.p[i], s.p[i + 1], Math.max(9, s.w * 0.55), 0, Math.PI * 2)
            ctx.fillStyle = s.o === 'gomme' ? '#B9B4C8' : s.c
            ctx.strokeStyle = '#FFFFFF'
            ctx.lineWidth = 4
            ctx.fill()
            ctx.stroke()
            break
          }
          left -= n
        }
      }
    }
    if (play) {
      // d'abord les traits, puis les stickers se collent un à un
      const total = pointCount(data)
      const { traits, stickers, total: dur } = replayParts(data)
      const t0 = performance.now()
      const step = (now: number) => {
        const e = now - t0
        if (e < traits) {
          upto = Math.max(1, Math.ceil((e / traits) * total))
          pop = 0
        } else {
          upto = Infinity
          pop = stickers ? Math.min(1, (e - traits) / stickers) : 1
        }
        draw()
        if (e < dur) raf = requestAnimationFrame(step)
      }
      upto = traits ? 1 : Infinity
      pop = 0
      raf = requestAnimationFrame(step)
    }
    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(c)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [id ?? data, play, img]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className={`block h-full w-full ${className}`} role="img" aria-label={label ?? 'Dessin'} />
}

/** Petit cœur dessiné au crayon, sur un pense-bête : l'icône du dessin en direct. */
export function DoodleIcon({ size = 46 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const inner = size * 0.78
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    c.width = c.height = Math.round(inner * dpr)
    const ctx = c.getContext('2d')!
    const k = (inner * dpr) / 330
    ctx.setTransform(k, 0, 0, k, -335 * k, -85 * k)
    const d = demoDrawing('coeurs', 3)
    strokePath(ctx, { ...d.s[0], w: 30 }, d.bg)
    strokePath(ctx, { ...d.s[1], w: 22 }, d.bg)
  }, [size])
  return (
    <span className="flex items-center justify-center rounded-[13px] bg-[#FFF6E5] shadow-[0_6px_14px_-6px_rgba(29,26,43,0.35)]" style={{ width: size, height: size, transform: 'rotate(-6deg)' }} aria-hidden>
      <canvas ref={ref} style={{ width: size * 0.78, height: size * 0.78 }} />
    </span>
  )
}

// ═════════════════════════ Le widget moyen ═════════════════════════

/** Widget moyen (forme 338 × 158) : le dernier dessin reçu, qui se dessine sous tes yeux quand il arrive. */
export function DrawingWidget({ onOpen, onDraw, compact = false }: { onOpen: (d: Drawing) => void; onDraw: () => void; compact?: boolean }) {
  const { state } = useHome()
  const { me, members } = state
  const latest = state.drawings.find((d) => d.from_member !== me.id) ?? state.drawings[0]
  // Rejoue le dessin quand un nouveau arrive pendant qu'on regarde.
  const first = useRef(latest?.id)
  const [play, setPlay] = useState(0)
  useEffect(() => {
    if (latest && latest.id !== first.current) {
      first.current = latest.id
      setPlay((n) => n + 1)
    }
  }, [latest])

  if (!latest) {
    return (
      <button onClick={onDraw} className="presse relative block w-full overflow-hidden rounded-[26px] bg-carte text-left shadow-carte" style={{ aspectRatio: RATIO }}>
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#FFE9EF,transparent_55%),radial-gradient(circle_at_85%_80%,#E6F2FF,transparent_55%)]" />
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="flex items-center gap-1.5 text-teinte">
            <Camera size={24} strokeWidth={2} />
            <Pencil size={22} strokeWidth={2} />
          </span>
          <span className="text-appel font-semibold">Créer une attention</span>
          <span className="text-note text-brume">Une photo, un dessin, en direct chez un proche</span>
        </span>
      </button>
    )
  }
  const { from, fromName, toName } = forWhom(latest, me, members)
  // Une nouvelle photo ou un nouveau dessin remplace l'ancien, qui disparaît du widget.
  return (
    <div className="relative w-full overflow-hidden rounded-[26px] shadow-carte" style={{ aspectRatio: RATIO }}>
      <button
        key={latest.id}
        style={{ background: latest.data.bg }}
        onClick={() => {
          tap()
          onOpen(latest)
        }}
        className={`absolute inset-0 ${play ? 'anim-remplace' : ''}`}
        aria-label={`${whatOf(latest)} de ${fromName} pour ${toName}, ${ago(latest.created_at)}`}
      >
        <DrawingCanvas data={latest.data} id={latest.id} play={play} photo={latest.photo_url} />
      </button>
      {/* juste la tête de celui qui l'a envoyé */}
      {from && (
        <span key={`a${latest.id}`} className={`pointer-events-none absolute bottom-2 left-2 flex rounded-full bg-white p-[2px] shadow-[0_2px_8px_rgba(29,26,43,0.25)] ${play ? 'anim-pop' : ''}`}>
          <Avatar m={from} size={compact ? 30 : 34} />
        </span>
      )}
      <button
        onClick={() => {
          tap()
          onDraw()
        }}
        className="presse absolute right-2 top-2 flex h-9 items-center gap-1 rounded-full bg-teinte px-2.5 text-white shadow-flottant"
        aria-label="Créer une attention"
      >
        <Camera size={16} strokeWidth={2.4} />
        <Pencil size={15} strokeWidth={2.4} />
      </button>
    </div>
  )
}

// ═════════════════════════ La planche à dessin ═════════════════════════

type Outil = DrawTool | 'cadrer'
const TOOLS: { key: DrawTool; label: string; icon: typeof Pencil }[] = [
  { key: 'crayon', label: 'Crayon', icon: Pencil },
  { key: 'feutre', label: 'Feutre', icon: Brush },
  { key: 'arcenciel', label: 'Arc-en-ciel', icon: Rainbow },
  { key: 'paillettes', label: 'Paillettes', icon: Sparkles },
  { key: 'coeurs', label: 'Tampon cœurs', icon: Heart },
  { key: 'gomme', label: 'Gomme', icon: Eraser },
]
const ARC = 'linear-gradient(135deg, #FF6B6B, #FFC53D, #46A758, #3E9BE9, #6E56CF)'

/** La photo de fond : celle qu'on montre (filtrée), l'originale et son filtre. */
type Pic = { blob: Blob; url: string; orig: Blob; f: FiltreKey }
const attentionDrafts = new Map<string, { strokes: Stroke[]; stickers: Sticker[]; pic: Pic | null; bg: string; py: number; to: string | null }>()

export function DrawSheet({ to: initialTo = null, onClose }: { to?: string | null; onClose: () => void }) {
  const { state, run, toast } = useHome()
  const { me, members, family } = state
  const others = members.filter((m) => m.id !== me.id)
  const draftKey = `${family.id}:${me.id}:${initialTo ?? 'famille'}`
  const draft = attentionDrafts.get(draftKey)
  const [to, setTo] = useState<string | null>(draft?.to ?? initialTo)
  const [phase, setPhase] = useState<'destinataire' | 'format' | 'edition'>(() => draft?.strokes.length || draft?.stickers.length || draft?.pic ? 'edition' : initialTo ? 'format' : 'destinataire')
  const [sent, setSent] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>(() => draft?.strokes ?? [])
  const [stickers, setStickers] = useState<Sticker[]>(() => draft?.stickers ?? [])
  const [sel, setSel] = useState<number | null>(null)
  const [tray, setTray] = useState(false)
  const [tool, setTool] = useState<Outil>('feutre')
  // la photo de fond (facultative), son filtre et la hauteur gardée
  const [pic, setPic] = useState<Pic | null>(() => draft?.pic ?? null)
  const [vignettes, setVignettes] = useState<Record<FiltreKey, string> | null>(null)
  const [filtering, setFiltering] = useState(false)
  const [py, setPy] = useState(draft?.py ?? 0.5)
  const img = usePhoto(pic?.url)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const drag = useRef<{ id: number; y: number; py: number } | null>(null)

  const [size, setSize] = useState<0 | 1 | 2>(1)
  const [color, setColor] = useState(INKS[1])
  const [bg, setBg] = useState(draft?.bg ?? PAPERS[0].bg)
  const [busy, setBusy] = useState(false)
  const base = useRef<HTMLCanvasElement>(null)
  const live = useRef<HTMLCanvasElement>(null)
  const current = useRef<{ id: number; s: Stroke } | null>(null)
  const raf = useRef(0)
  const total = useMemo(() => pointCount({ s: strokes }), [strokes])
  const full = useRef(false)
  const chips = useRef<HTMLDivElement>(null)
  // Le destinataire choisi d'avance reste visible, même en bout de liste.
  useEffect(() => {
    chips.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  // Toile du dessous : la photo ou le papier, et les traits terminés (les stickers sont posés par-dessus, à part).
  useEffect(() => {
    if (base.current) paint(fit(base.current), { v: 1, bg, s: strokes, py }, Infinity, true, img)
  }, [strokes, bg, img, py, phase])
  useEffect(() => {
    const ro = new ResizeObserver(() => base.current && paint(fit(base.current), { v: 1, bg, s: strokes, py }, Infinity, true, img))
    if (base.current) ro.observe(base.current)
    return () => ro.disconnect()
  }, [strokes, bg, img, py, phase])

  // Annuler : on garde les états précédents (traits et stickers ensemble).
  const hist = useRef<{ s: Stroke[]; k: Sticker[] }[]>([])
  const [, setHistN] = useState(0)
  const now = useRef({ s: strokes, k: stickers })
  now.current = { s: strokes, k: stickers }
  const snap = () => {
    hist.current.push(now.current)
    if (hist.current.length > 100) hist.current.shift()
    setHistN(hist.current.length)
  }
  const undo = () => {
    const h = hist.current.pop()
    if (h) {
      setStrokes(h.s)
      setStickers(h.k)
      setSel(null)
    }
    setHistN(hist.current.length)
  }

  // Les vignettes des filtres, une fois par photo.
  useEffect(() => {
    if (!pic) return setVignettes(null)
    let live = true
    vignettesFiltres(pic.orig).then((v) => live && setVignettes(v)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [pic?.orig]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtrer = async (f: FiltreKey) => {
    if (!pic || pic.f === f || filtering) return
    setFiltering(true)
    try {
      const blob = await photoFinale(pic.orig, f)
      URL.revokeObjectURL(pic.url)
      setPic({ ...pic, blob, url: URL.createObjectURL(blob), f })
    } catch (e) {
      toast(errorText(e), 'err')
    }
    setFiltering(false)
  }

  const addSticker = (key: string) => {
    if (stickers.length >= MAX_STICKERS) {
      toast('Ta feuille est couverte de stickers, envoie-la !', 'err')
      return
    }
    snap()
    setStickers([...stickers, nouveauSticker(key, DRAW_W, DRAW_H, stickers.length)])
    setSel(stickers.length)
    setTray(false)
    if (tool === 'cadrer') setTool('feutre')
  }

  const pick = async (file?: File) => {
    if (!file) return
    try {
      const blob = await compressImage(file, 1400, 0.82)
      if (pic) URL.revokeObjectURL(pic.url)
      setPic({ blob, url: URL.createObjectURL(blob), orig: blob, f: 'aucun' })
      setPy(0.5)
      if (tool === 'gomme') setTool('feutre')
      success()
      return true
    } catch (e) {
      toast(errorText(e), 'err')
      return false
    }
  }
  const photoMenu = async () => {
    const actions = [{ label: 'Prendre une photo' }, { label: 'Choisir dans la photothèque' }, ...(pic ? [{ label: 'Retirer la photo', destructive: true }] : [])]
    const i = await choisir({ title: pic ? 'Photo de fond' : 'Ajouter une photo', actions })
    if (i === 0) camera.current?.click()
    if (i === 1) gallery.current?.click()
    if (i === 2) {
      setPic(null)
      if (tool === 'cadrer') setTool('feutre')
    }
  }

  // Toile du dessus : le trait en cours, redessiné à chaque image.
  const drawLive = () => {
    raf.current = 0
    const c = live.current
    if (!c) return
    const ctx = fit(c)
    ctx.clearRect(0, 0, DRAW_W, DRAW_H)
    if (current.current) strokePath(ctx, current.current.s, bg, undefined, true)
  }
  const pos = (c: HTMLCanvasElement, e: { clientX: number; clientY: number }) => {
    const r = c.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * DRAW_W), Math.round(((e.clientY - r.top) / r.height) * DRAW_H)] as const
  }

  useEffect(() => {
    if (!sent) attentionDrafts.set(draftKey, { strokes, stickers, pic, bg, py, to })
  }, [draftKey, strokes, stickers, pic, bg, py, to, sent])

  const recipient = to ? members.find((m) => m.id === to) : null
  const empty = !strokes.length && !stickers.length && !pic
  const send = async () => {
    if (empty || busy) return
    if (to && !recipient) { toast('Ce proche ne fait plus partie de la maison. Choisis un autre destinataire.', 'err'); setPhase('destinataire'); return }
    const confirmed = to ? true : await confirmer({title: recipient ? `Envoyer à ${recipient.display_name} ?` : 'Envoyer à toute la famille ?', message: recipient ? 'Cette attention sera partagée uniquement avec ce proche.' : 'Tous les membres de cette maison pourront voir cette attention.', confirm: 'Envoyer mon attention'})
    if (!confirmed) return
    setBusy(true)
    const what = pic ? (strokes.length || stickers.length ? 'Photo décorée envoyée' : 'Photo envoyée') : 'Dessin envoyé'
    const ok = await run(
      (api) => api.sendDrawing(family.id, me.id, to, { v: 1, bg, s: strokes, ...(stickers.length ? { k: stickers } : {}), ...(pic ? { py: Math.round(py * 1000) / 1000 } : {}) }, pic?.blob ?? null),
      recipient ? `${what} à ${recipient.display_name}` : `${what} à toute la famille`,
    )
    setBusy(false)
    if (ok) {
      success()
      attentionDrafts.delete(draftKey)
      setSent(true)
    }
  }

  if (sent) return <Sheet title="Attention envoyée" onClose={onClose}>
    <div className="flex flex-col items-center py-8 text-center"><img src="./art/geste-coeur.webp" alt="" className="h-24 w-24 object-contain" /><h3 className="mt-5 font-rond text-titre1">Un petit geste qui compte.</h3><p className="mt-3 text-corps text-brume">{recipient ? `Ton attention est envoyée à ${recipient.display_name}.` : 'Ton attention est envoyée à toute la famille.'}</p></div><Btn onClick={onClose}>C’est fait</Btn>
  </Sheet>

  if (phase === 'destinataire') return <Sheet title="À qui penses-tu ?" onClose={onClose}>
    <p className="mb-5 text-corps text-brume">Choisis à qui laisser une petite attention.</p>
    <div className="space-y-2">
      {others.map(m => <button key={m.id} onClick={() => {setTo(m.id); setPhase('format')}} className="presse flex min-h-[72px] w-full items-center gap-4 rounded-[20px] bg-white p-3 text-left"><Avatar m={m} size={46} /><span className="text-corps font-semibold">{m.display_name}</span></button>)}
      <button onClick={() => {setTo(null); setPhase('format')}} className="presse flex min-h-[72px] w-full items-center gap-4 rounded-[20px] bg-teinte-doux p-3 text-left"><UsersRound size={34} className="text-teinte-fonce" /><span><span className="block text-corps font-semibold">Toute la famille</span><span className="text-note text-brume">Visible par les membres de cette maison</span></span></button>
    </div>
  </Sheet>

  if (phase === 'format') return <Sheet title={recipient ? `Pour ${recipient.display_name}` : 'Pour toute la famille'} onClose={onClose}>
    <button onClick={() => setPhase('destinataire')} className="mb-4 min-h-11 text-sous font-semibold text-teinte-fonce">Changer de destinataire</button>
    <h3 className="mb-2 font-rond text-titre1">Un petit geste, à ta façon.</h3>
    <p className="mb-6 text-corps text-brume">Une photo de ton quotidien ou un dessin fait pour eux.</p>
    <Btn onClick={() => {setPhase('edition'); setTool('feutre')}}><Pencil size={20} />Faire un dessin</Btn>
    <Btn kind="teinte" className="mt-3" onClick={() => void photoMenu()}><Images size={20} />Une photo</Btn>
    <input ref={gallery} type="file" accept="image/*" hidden onChange={e => { const file=e.target.files?.[0]; if(file) void pick(file).then(ok => { if(ok) setPhase('edition') }); e.target.value='' }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => { const file=e.target.files?.[0]; if(file) void pick(file).then(ok => { if(ok) setPhase('edition') }); e.target.value='' }} />
  </Sheet>

  return (
    <Sheet title="Créer une attention" onClose={() => { if (!busy) onClose() }} tall footer={<>
      <Btn onClick={send} disabled={empty || busy}>{busy ? 'Envoi…' : recipient ? `Envoyer à ${recipient.display_name}` : 'Envoyer à toute la famille'}</Btn>
      <p className="pt-2 text-center text-note text-brume">{recipient ? `Une attention pour ${recipient.display_name}.` : 'Visible par toute la famille.'}</p>
    </>}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <button onClick={() => setPhase('destinataire')} className="mb-3 min-h-11 text-sous font-semibold text-teinte-fonce">{recipient ? `Pour ${recipient.display_name}` : 'Pour toute la famille'} · Modifier</button>
      {/* une photo en fond (ou le papier), des stickers */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            tap()
            void photoMenu()
          }}
          className="presse flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-carte px-3 text-sous font-semibold text-teinte shadow-carte"
        >
          <Images size={17} strokeWidth={2.3} className="shrink-0" /> <span className="truncate">{pic ? 'Photo' : 'Ajouter une photo'}</span>
        </button>
        <button
          onClick={() => {
            select()
            setTray(!tray)
            setSel(null)
          }}
          aria-pressed={tray}
          className={`presse flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sous font-semibold shadow-carte transition-colors ${tray ? 'bg-teinte text-white' : 'bg-carte text-teinte'}`}
        >
          <StickerIcon size={17} strokeWidth={2.3} /> Stickers
        </button>
        {pic ? (
          <button
            onClick={() => {
              select()
              setTool(tool === 'cadrer' ? 'feutre' : 'cadrer')
              setSel(null)
            }}
            aria-pressed={tool === 'cadrer'}
            className={`presse flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sous font-semibold shadow-carte transition-colors ${tool === 'cadrer' ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
          >
            <Move size={16} strokeWidth={2.3} /> Cadrer
          </button>
        ) : null}
      </div>

      {/* la feuille, à la forme exacte du widget */}
      <div className="relative -mx-1.5 mt-3 overflow-hidden rounded-[26px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: pic ? '#1D1A2B' : bg }}>
        <canvas ref={base} className="absolute inset-0 h-full w-full" />
        <canvas
          ref={live}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label="Feuille de dessin"
          onPointerDown={(e) => {
            if (sel !== null) setSel(null)
            if (tray) setTray(false)
            if (tool === 'cadrer') {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { id: e.pointerId, y: e.clientY, py }
              return
            }
            if (current.current) return
            if (total >= MAX_POINTS) {
              toast('Ta feuille est pleine, envoie-la !', 'err')
              return
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            const [x, y] = pos(e.currentTarget, e)
            current.current = { id: e.pointerId, s: { o: tool as DrawTool, c: color, w: WIDTHS[tool as DrawTool][size], p: [x, y] } }
            full.current = false
            drawLive()
          }}
          onPointerMove={(e) => {
            const dg = drag.current
            if (dg && dg.id === e.pointerId && img) {
              // glisser vers le bas montre le haut de la photo
              const over = photoBox(img).overflow
              if (over > 0) setPy(Math.max(0, Math.min(1, dg.py - (e.clientY - dg.y) / e.currentTarget.getBoundingClientRect().height / over)))
              return
            }
            const cur = current.current
            if (!cur || cur.id !== e.pointerId) return
            const evs = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
            for (const ev of evs.length ? evs : [e.nativeEvent]) {
              const [x, y] = pos(e.currentTarget, ev)
              const p = cur.s.p
              if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 2.5) continue
              if (total + p.length / 2 >= MAX_POINTS) {
                if (!full.current) toast('Ta feuille est pleine, envoie-la !', 'err')
                full.current = true
                break
              }
              p.push(x, y)
            }
            if (!raf.current) raf.current = requestAnimationFrame(drawLive)
          }}
          onPointerUp={(e) => {
            if (drag.current?.id === e.pointerId) {
              drag.current = null
              return
            }
            const cur = current.current
            if (!cur || cur.id !== e.pointerId) return
            current.current = null
            snap()
            setStrokes((s) => [...s, cur.s])
            requestAnimationFrame(drawLive)
          }}
          onPointerCancel={() => {
            drag.current = null
            current.current = null
            requestAnimationFrame(drawLive)
          }}
        />
        <StickerStage
          W={DRAW_W}
          H={DRAW_H}
          k={stickers}
          setK={setStickers}
          sel={sel}
          setSel={setSel}
          begin={snap}
          end={(changed) => {
            if (!changed) {
              hist.current.pop()
              setHistN(hist.current.length)
            }
          }}
        />
        {empty && (
          <p className={`pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sous font-medium ${bg === '#1E1B33' ? 'text-white/75' : 'text-brume'}`}>Dessine ici avec ton doigt, ajoute une photo ou des stickers</p>
        )}
        {tool === 'cadrer' && (
          <p className="verre pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-legende font-semibold text-encre">
            <Move size={13} strokeWidth={2.4} /> Glisse pour cadrer la photo
          </p>
        )}
      </div>

      {tray ? (
        <StickerTray onPick={addSticker} onClose={() => setTray(false)} />
      ) : (
        <>
          {/* outils */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex rounded-full bg-remplissage p-[3px]">
              {TOOLS.map((t) => {
                const on = tool === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      select()
                      setTool(t.key)
                      setSel(null)
                    }}
                    aria-pressed={on}
                    aria-label={t.label}
                    title={t.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${on ? 'bg-white text-encre shadow-[0_2px_6px_rgba(0,0,0,0.1)]' : 'text-brume'}`}
                  >
                    <t.icon size={17} strokeWidth={2.3} />
                  </button>
                )
              })}
            </div>
            <div className="flex flex-1 items-center justify-end">
              {([0, 1, 2] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => {
                    select()
                    setSize(i)
                  }}
                  aria-label={['Fin', 'Moyen', 'Épais'][i]}
                  aria-pressed={size === i}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${size === i ? 'bg-teinte-doux' : ''}`}
                >
                  <span
                    className="rounded-full"
                    style={{ width: [6, 11, 17][i], height: [6, 11, 17][i], background: tool === 'gomme' ? '#B9B4C8' : tool === 'arcenciel' ? ARC : color, boxShadow: color === '#FFFFFF' && tool !== 'gomme' && tool !== 'arcenciel' ? 'inset 0 0 0 1px #CFCADB' : undefined }}
                  />
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 px-1 text-legende font-medium text-brume">{tool === 'cadrer' ? 'Glisse la photo pour la cadrer' : TOOLS.find((t) => t.key === tool)?.label}{tool === 'arcenciel' ? ' : les couleurs changent toutes seules' : ''}</p>

          <div className="no-bar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 py-1">
            {INKS.map((c) => {
              const on = color === c && tool !== 'gomme' && tool !== 'arcenciel'
              return (
                <button
                  key={c}
                  onClick={() => {
                    select()
                    setColor(c)
                    if (tool === 'gomme' || tool === 'cadrer' || tool === 'arcenciel') setTool('feutre')
                  }}
                  aria-label={`Couleur ${c}`}
                  aria-pressed={on}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ boxShadow: on ? `0 0 0 2.5px #F4F1F9, 0 0 0 4.5px ${c === '#FFFFFF' ? '#CFCADB' : c}` : undefined }}
                >
                  <span className="h-[30px] w-[30px] rounded-full" style={{ background: c, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #CFCADB' : 'inset 0 -3px 6px rgba(0,0,0,0.12)' }} />
                </button>
              )
            })}
          </div>

          {pic && (
            <div className="mt-2">
              <p className="mb-1 px-1 text-note font-medium text-brume">Filtre</p>
              <FilterRow f={pic.f} setF={(f) => void filtrer(f)} vignettes={vignettes} busy={filtering} />
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <span className={`text-note font-medium text-brume ${pic ? 'hidden' : ''}`}>Fond</span>
            <div className={`flex flex-1 gap-1.5 ${pic ? 'invisible' : ''}`}>
              {PAPERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    select()
                    setBg(p.bg)
                  }}
                  aria-label={`Fond ${p.label}`}
                  aria-pressed={bg === p.bg}
                  className={`h-7 w-7 rounded-full ring-1 ring-black/10 ${bg === p.bg ? 'outline outline-2 outline-offset-2 outline-teinte' : ''}`}
                  style={{ background: p.bg }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                tap()
                undo()
              }}
              disabled={!hist.current.length}
              className="presse flex h-9 w-9 items-center justify-center rounded-full bg-carte text-encre shadow-carte disabled:opacity-35"
              aria-label="Annuler"
            >
              <Undo2 size={17} strokeWidth={2.4} />
            </button>
            <button
              onClick={async () => {
                if ((strokes.length > 3 || stickers.length > 1) && !(await confirmer({ title: 'Tout effacer ?', message: 'Les traits et les stickers. Tu pourras revenir en arrière.', confirm: 'Tout effacer', destructive: true }))) return
                snap()
                setStrokes([])
                setStickers([])
                setSel(null)
              }}
              disabled={!strokes.length && !stickers.length}
              className="presse flex h-9 w-9 items-center justify-center rounded-full bg-carte text-rouge shadow-carte disabled:opacity-35"
              aria-label="Tout effacer"
            >
              <Trash2 size={16} strokeWidth={2.4} />
            </button>
          </div>
        </>
      )}

    </Sheet>
  )
}

// ═════════════════════════ Les dessins reçus et envoyés ═════════════════════════

export function DrawingsSheet({ start, onClose, onDraw }: { start?: Drawing; onClose: () => void; onDraw: (to: string | null) => void }) {
  const { state, run } = useHome()
  const { me, members, drawings } = state
  const [id, setId] = useState(start?.id ?? drawings[0]?.id)
  const [play, setPlay] = useState(1)
  const d = drawings.find((x) => x.id === id) ?? drawings[0]
  useEffect(() => { if (d) markDrawingsSeen([d.id]) }, [d?.id])
  if (!d) return null
  const { from, fromName, toName } = forWhom(d, me, members)
  const mine = d.from_member === me.id

  return (
    <Sheet title="Nos attentions" onClose={onClose} tall>
      <div className="-mx-1.5 overflow-hidden rounded-[26px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.data.bg }}>
        <DrawingCanvas data={d.data} id={d.id} play={play} photo={d.photo_url} label={`${whatOf(d)} de ${fromName}`} />
      </div>
      <div className="mt-3 flex items-center gap-3 px-1">
        {from && <Avatar m={from} size={40} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-corps font-semibold">{mine ? `Toi, pour ${toName}` : `${fromName}, pour ${toName}`}</p>
          <p className="text-note text-brume">{ago(d.created_at)}</p>
        </div>
        <button
          onClick={() => {
            tap()
            setPlay((n) => n + 1)
          }}
          className="presse flex h-10 items-center gap-1.5 rounded-full bg-carte px-3.5 text-sous font-semibold text-teinte shadow-carte"
        >
          <RotateCcw size={15} strokeWidth={2.6} /> Revoir
        </button>
        {mine && (
          <button
            onClick={async () => {
              if (!(await confirmer({ title: 'Supprimer cette attention ?', message: 'Elle disparaîtra aussi chez ceux qui l’ont reçue.', confirm: 'Supprimer', destructive: true }))) return
              const next = drawings.find((x) => x.id !== d.id)
              if (await run((api) => api.deleteDrawing(d.id), 'Attention supprimée')) {
                if (next) setId(next.id)
                else onClose()
              }
            }}
            className="presse flex h-10 w-10 items-center justify-center rounded-full bg-carte text-rouge shadow-carte"
            aria-label="Supprimer cette attention"
          >
            <Trash2 size={16} strokeWidth={2.4} />
          </button>
        )}
      </div>
      <Btn className="mt-4" onClick={() => onDraw(mine ? d.to_member : d.to_member === null ? null : d.from_member)}>
        <Pencil size={17} strokeWidth={2.4} /> {mine ? 'Créer une autre attention' : d.to_member === null ? 'Répondre à la famille' : `Répondre à ${fromName}`}
      </Btn>

      {drawings.length > 1 && (
        <>
          <p className="entete mt-6 !px-1">Récents</p>
          <div className="grid grid-cols-2 gap-2.5">
            {drawings.map((x) => {
              const w = forWhom(x, me, members)
              return (
                <button
                  key={x.id}
                  onClick={() => {
                    tap()
                    setId(x.id)
                    setPlay((n) => n + 1)
                  }}
                  className={`presse text-left ${x.id === d.id ? 'opacity-100' : 'opacity-90'}`}
                >
                  <span className={`block overflow-hidden rounded-[16px] ring-1 ${x.id === d.id ? 'ring-2 ring-teinte' : 'ring-black/5'}`} style={{ aspectRatio: RATIO, background: x.data.bg }}>
                    <DrawingCanvas data={x.data} id={x.id} photo={x.photo_url} />
                  </span>
                  <span className="mt-1 block truncate text-legende text-brume">
                    <span className="font-semibold text-encre">{w.fromName}</span> → {w.toName}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}

// ═════════════════════════ Réception ═════════════════════════

/** Le dessin arrive : il se dessine tout seul, puis on peut répondre. */
export function IncomingDrawing({ d, more, onReply, onSeen, onLater }: { d: Drawing; more: number; onReply: () => void; onSeen: () => void; onLater?: () => void }) {
  const { state } = useHome()
  const { from, fromName } = forWhom(d, state.me, state.members)
  useEffect(() => success(), [d.id])
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label="Attention reçue">
      <div className="anim-fondu absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div className="anim-pop relative w-full max-w-[380px] rounded-[34px] bg-fond px-4 pb-4 pt-5 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]">
        <div className="flex items-center justify-center gap-2.5">
          {from && <Avatar m={from} size={44} />}
          <p className="text-left font-rond text-titre3 leading-tight">
            {sentText(d, fromName)}
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-[24px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.data.bg }}>
          <DrawingCanvas data={d.data} id={d.id} play={1} photo={d.photo_url} label={`${whatOf(d)} de ${fromName}`} />
        </div>
        {onLater && <button onClick={onLater} className="mt-2 min-h-11 text-sous text-teinte-fonce">Plus tard</button>}
        <Btn className="mt-4" onClick={onReply}>
          <Camera size={17} strokeWidth={2.4} />
          <Pencil size={15} strokeWidth={2.4} />
          {d.to_member ? `Répondre à ${fromName}` : 'Répondre à la famille'}
        </Btn>
        <Btn kind="gris" className="mt-2" onClick={onSeen}>
          {more > 0 ? `Suivant (${more} de plus)` : 'Merci'}
        </Btn>
      </div>
    </div>
  )
}

/** Bandeau discret sur les autres onglets : un dessin vient d'arriver. */
export function DrawingBanner({ onOpen }: { onOpen: () => void }) {
  const { state } = useHome()
  const unseen = useUnseenDrawings(state)
  const d = unseen[unseen.length - 1]
  const [hidden, setHidden] = useState<string | null>(null)
  useEffect(() => {
    if (!d) return
    const t = window.setTimeout(() => setHidden(d.id), 7000)
    return () => window.clearTimeout(t)
  }, [d])
  if (!d || hidden === d.id) return null
  const { from, fromName } = forWhom(d, state.me, state.members)
  return (
    <button
      onClick={() => {
        tap()
        onOpen()
      }}
      className="anim-hud verre absolute inset-x-3 z-50 flex items-center gap-3 rounded-[22px] p-2.5 pr-3 text-left shadow-flottant"
      style={{ top: 'calc(var(--sat) + 6px)' }}
    >
      {from && <Avatar m={from} size={38} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sous font-semibold">{sentText(d, fromName)}</span>
        <span className="block truncate text-note text-brume">Touche pour le voir</span>
      </span>
      <span className="h-[34px] shrink-0 overflow-hidden rounded-[9px] ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.data.bg }}>
        <DrawingCanvas data={d.data} id={d.id} photo={d.photo_url} />
      </span>
    </button>
  )
}

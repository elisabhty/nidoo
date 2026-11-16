import { Brush, Eraser, Frame, Gift, Heart, Images, LoaderCircle, Move, PaintBucket, Palette, Pencil, Rainbow, Sparkles, Sticker as StickerIcon, Trash2, Undo2, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CADRES, vignettesCadres } from '../lib/cadres'
import { carteDe, CARTES, prenom } from '../lib/cartes'
import { coloriageUrl, COLORIAGES } from '../lib/coloriages'
import { DRAW_H, DRAW_W, fit, INKS, MAX_POINTS, paint, PAPERS, photoBox, pointCount, setPageCourante, strokePath, WIDTHS } from '../lib/drawing'
import { photoFinale, vignettesFiltres, type FiltreKey } from '../lib/filtres'
import { select, success, tap } from '../lib/haptic'
import { MAX_STICKERS } from '../lib/stickers'
import { useHome } from '../lib/store'
import type { DrawingData, DrawTool, LiveEvent, LiveInvite, LiveRoom, Sticker, Stroke } from '../lib/types'
import { compressImage, errorText, uid } from '../lib/util'
import { DrawingCanvas, usePhoto } from './drawing'
import { FilterRow, nouveauSticker, StickerStage, StickerTray } from './stickers'
import { Avatar, Btn, choisir, confirmer, Sheet } from './ui'

const RATIO = `${DRAW_W} / ${DRAW_H}`

type Outil = DrawTool | 'cadrer'
const TOOLS: { key: DrawTool; label: string; icon: typeof Pencil }[] = [
  { key: 'crayon', label: 'Crayon', icon: Pencil },
  { key: 'feutre', label: 'Feutre', icon: Brush },
  { key: 'arcenciel', label: 'Arc-en-ciel', icon: Rainbow },
  { key: 'paillettes', label: 'Paillettes', icon: Sparkles },
  { key: 'coeurs', label: 'Tampon cœurs', icon: Heart },
  { key: 'gomme', label: 'Gomme', icon: Eraser },
]
const POT = { key: 'remplir' as DrawTool, label: 'Pot de peinture', icon: PaintBucket }
const ARC = 'linear-gradient(135deg, #FF6B6B, #FFC53D, #46A758, #3E9BE9, #6E56CF)'
/** Des couleurs douces en plus pour colorier */
const COULEURS_COLORIAGE = ['#FFB3C7', '#FFD8A8', '#FFF3A3', '#B2F2BB', '#A5D8FF', '#D0BFFF', '#C8A27A', '#F1F3F5']

/** La photo de fond : celle qu'on montre (filtrée), l'originale et son filtre. */
type Pic = { blob: Blob; url: string; orig: Blob; f: FiltreKey }
type Brouillon = { strokes: Stroke[]; stickers: Sticker[]; pic: Pic | null; bg: string; py: number; to: string | null; fr?: string; col?: string }
const attentionDrafts = new Map<string, Brouillon>()

/** Dessiner à deux : la séance, le proche, et qui a lancé l'invitation. */
export type Live = { session: string; partner: string; hote: boolean }

type Phase = 'destinataire' | 'format' | 'cartes' | 'coloriages' | 'edition'

export function DrawSheet({ to: initialTo = null, onClose, carte, live: liveInit }: { to?: string | null; onClose: () => void; carte?: string; live?: Live }) {
  const { state, run, toast, api } = useHome()
  const { me, members, family } = state
  const others = members.filter((m) => m.id !== me.id)
  const draftKey = `${family.id}:${me.id}:${initialTo ?? 'famille'}`
  const draft = liveInit || carte ? undefined : attentionDrafts.get(draftKey)
  const nomDe = (id: string | null) => (id ? members.find((m) => m.id === id)?.display_name : undefined)
  const modele = carte ? carteDe(carte)?.data(initialTo ? prenom(nomDe(initialTo) ?? '') : undefined) : undefined

  const [to, setTo] = useState<string | null>(liveInit?.partner ?? draft?.to ?? initialTo)
  const [phase, setPhase] = useState<Phase>(() =>
    liveInit || modele || draft?.strokes.length || draft?.stickers.length || draft?.pic ? 'edition' : initialTo ? 'format' : 'destinataire',
  )
  const [sent, setSent] = useState<false | 'moi' | 'partenaire'>(false)
  const [strokes, setStrokes] = useState<Stroke[]>(() => draft?.strokes ?? [])
  const [stickers, setStickers] = useState<Sticker[]>(() => draft?.stickers ?? modele?.k ?? [])
  const [sel, setSel] = useState<number | null>(null)
  const [panel, setPanel] = useState<null | 'stickers' | 'cadres'>(null)
  const [tool, setTool] = useState<Outil>('feutre')
  const [pic, setPic] = useState<Pic | null>(() => draft?.pic ?? null)
  const [vignettes, setVignettes] = useState<Record<FiltreKey, string> | null>(null)
  const [filtering, setFiltering] = useState(false)
  const [py, setPy] = useState(draft?.py ?? 0.5)
  const [fr, setFr] = useState<string | undefined>(draft?.fr ?? modele?.fr)
  const [col, setCol] = useState<string | undefined>(draft?.col)
  const img = usePhoto(pic?.url)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const drag = useRef<{ id: number; y: number; py: number } | null>(null)

  const [size, setSize] = useState<0 | 1 | 2>(1)
  const [color, setColor] = useState(INKS[1])
  const [bg, setBg] = useState(draft?.bg ?? modele?.bg ?? PAPERS[0].bg)
  const [busy, setBusy] = useState(false)
  const base = useRef<HTMLCanvasElement>(null)
  const remote = useRef<HTMLCanvasElement>(null)
  const liveCanvas = useRef<HTMLCanvasElement>(null)
  const current = useRef<{ id: number; s: Stroke } | null>(null)
  const raf = useRef(0)
  const total = useMemo(() => pointCount({ s: strokes }), [strokes])
  const full = useRef(false)
  const [charge, bump] = useState(0)

  // Toile du dessous : la photo ou le papier, le cadre, les traits terminés, le trait du coloriage
  // (les stickers sont posés par-dessus, à part, pour qu'on puisse les déplacer).
  useEffect(() => {
    const data: DrawingData = { v: 1, bg, s: strokes, py, ...(fr ? { fr } : {}), ...(col ? { col } : {}) }
    const repaint = () => base.current && paint(fit(base.current), data, Infinity, true, img, { stickers: false, onLoad: () => bump((n) => n + 1) })
    repaint()
    const ro = new ResizeObserver(() => repaint())
    if (base.current) ro.observe(base.current)
    return () => ro.disconnect()
  }, [strokes, bg, img, py, fr, col, phase, charge])

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

  // ───────── Dessiner à deux ─────────
  const [live, setLive] = useState<Live | null>(liveInit ?? null)
  const [partnerHere, setPartnerHere] = useState(false)
  const room = useRef<LiveRoom | null>(null)
  const ids = useRef(new WeakMap<Stroke, string>())
  const miens = useRef<string[]>([])
  const autres = useRef(new Map<string, Stroke>())
  const curseur = useRef<[number, number, string] | null>(null)
  const envoi = useRef<{ id: string; from: number; timer: number } | null>(null)
  const partner = live ? members.find((m) => m.id === live.partner) : null
  const send = (e: LiveEvent) => room.current?.send(e)
  const etat = (): LiveEvent => ({
    t: 'state',
    who: me.id,
    s: now.current.s.map((s) => ({ ...s, id: ids.current.get(s) ?? uid() })),
    k: now.current.k,
    bg: bgRef.current,
    ...(frRef.current ? { fr: frRef.current } : {}),
    ...(colRef.current ? { col: colRef.current } : {}),
  })
  const bgRef = useRef(bg)
  bgRef.current = bg
  const frRef = useRef(fr)
  frRef.current = fr
  const colRef = useRef(col)
  colRef.current = col

  const drawRemote = () => {
    const c = remote.current
    if (!c) return
    const ctx = fit(c)
    ctx.clearRect(0, 0, DRAW_W, DRAW_H)
    setPageCourante(colRef.current)
    for (const s of autres.current.values()) if (s.p.length) strokePath(ctx, s, bgRef.current, undefined, true)
    const k = curseur.current
    if (k) {
      ctx.beginPath()
      ctx.arc(k[0], k[1], 13, 0, Math.PI * 2)
      ctx.fillStyle = k[2]
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 5
      ctx.fill()
      ctx.stroke()
    }
  }

  useEffect(() => {
    if (!live) return
    const r = api.joinLive(family.id, live.session, me.id, (e) => {
      if (e.who === me.id) return
      switch (e.t) {
        case 'hello':
          setPartnerHere(true)
          success()
          // celui qui a invité (ou qui a déjà quelque chose sur la feuille) la renvoie en entier
          if (live.hote || now.current.s.length || now.current.k.length) r.send(etat())
          break
        case 'bye':
          setPartnerHere(false)
          break
        case 'pt': {
          setPartnerHere(true)
          let s = autres.current.get(e.id)
          if (!s) {
            s = { o: e.s?.o ?? 'feutre', c: e.s?.c ?? '#1D1A2B', w: e.s?.w ?? 22, p: [] }
            autres.current.set(e.id, s)
          }
          s.p.push(...e.p)
          curseur.current = [s.p[s.p.length - 2], s.p[s.p.length - 1], s.o === 'gomme' ? '#B9B4C8' : s.c]
          requestAnimationFrame(drawRemote)
          break
        }
        case 'end': {
          const s = autres.current.get(e.id)
          autres.current.delete(e.id)
          curseur.current = null
          if (s) {
            ids.current.set(s, e.id)
            setStrokes((x) => [...x, s])
          }
          requestAnimationFrame(drawRemote)
          break
        }
        case 'undo':
          setStrokes((x) => x.filter((s) => ids.current.get(s) !== e.id))
          break
        case 'k':
          setStickers(e.k)
          setSel(null)
          break
        case 'fond':
          setBg(e.bg)
          setFr(e.fr)
          break
        case 'state':
          setStrokes(
            e.s.map(({ id, ...s }) => {
              ids.current.set(s, id)
              return s
            }),
          )
          setStickers(e.k)
          setBg(e.bg)
          setFr(e.fr)
          setCol(e.col)
          if (e.col) setTool('remplir')
          break
        case 'fin':
          setSent('partenaire')
          break
      }
    })
    room.current = r
    r.send({ t: 'hello', who: me.id })
    return () => {
      r.send({ t: 'bye', who: me.id })
      r.leave()
      room.current = null
    }
  }, [live?.session]) // eslint-disable-line react-hooks/exhaustive-deps

  const startLive = async () => {
    if (!to) return
    try {
      const session = await api.inviteLive(family.id, me.id, to)
      setLive({ session, partner: to, hote: true })
      setPhase('edition')
      setTool('feutre')
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }

  // les points du trait en cours partent par petits paquets
  const flush = () => {
    const env = envoi.current
    const cur = current.current
    if (!env || !cur) return
    const p = cur.s.p
    if (p.length > env.from) {
      send({ t: 'pt', who: me.id, id: env.id, p: p.slice(env.from) })
      env.from = p.length
    }
  }
  const envoyerStickers = () => requestAnimationFrame(() => send({ t: 'k', who: me.id, k: now.current.k }))

  const undo = () => {
    if (live) {
      // à deux, on retire seulement son dernier trait
      const id = miens.current.pop()
      if (id) {
        setStrokes((x) => x.filter((s) => ids.current.get(s) !== id))
        send({ t: 'undo', who: me.id, id })
      }
      setHistN((n) => n + 1)
      return
    }
    const h = hist.current.pop()
    if (h) {
      setStrokes(h.s)
      setStickers(h.k)
      setSel(null)
    }
    setHistN(hist.current.length)
  }

  // Les vignettes des filtres, une fois par photo ; celles des cadres, sur la photo ou le papier.
  useEffect(() => {
    if (!pic) return setVignettes(null)
    let on = true
    vignettesFiltres(pic.orig).then((v) => on && setVignettes(v)).catch(() => undefined)
    return () => {
      on = false
    }
  }, [pic?.orig]) // eslint-disable-line react-hooks/exhaustive-deps
  const [vCadres, setVCadres] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    if (panel !== 'cadres') return
    let on = true
    vignettesCadres(DRAW_W, DRAW_H, img ?? (col ? '#FFFFFF' : bg), 150).then((v) => on && setVCadres(v))
    return () => {
      on = false
    }
  }, [panel, img, bg, col])

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

  const addSticker = (key: string, t?: string, c?: number) => {
    if (stickers.length >= MAX_STICKERS) {
      toast('Ta feuille est couverte de stickers, envoie-la !', 'err')
      return
    }
    snap()
    setStickers([...stickers, nouveauSticker(key, DRAW_W, DRAW_H, stickers.length, t, c)])
    setSel(stickers.length)
    setPanel(null)
    if (tool === 'cadrer') setTool('feutre')
    if (live) envoyerStickers()
  }
  const choisirCadre = (k: string) => {
    select()
    const v = k === 'aucun' ? undefined : k
    setFr(v)
    if (live) send({ t: 'fond', who: me.id, bg, ...(v ? { fr: v } : {}) })
  }
  const choisirFond = (b: string) => {
    select()
    setBg(b)
    if (live) send({ t: 'fond', who: me.id, bg: b, ...(fr ? { fr } : {}) })
  }

  const pick = async (file?: File) => {
    if (!file) return
    try {
      const blob = await compressImage(file, 1400, 0.82)
      if (pic) URL.revokeObjectURL(pic.url)
      setPic({ blob, url: URL.createObjectURL(blob), orig: blob, f: 'aucun' })
      setPy(0.5)
      setCol(undefined)
      if (tool === 'gomme' || tool === 'remplir') setTool('feutre')
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
    const c = liveCanvas.current
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
    if (!sent && !live) attentionDrafts.set(draftKey, { strokes, stickers, pic, bg, py, to, fr, col })
  }, [draftKey, strokes, stickers, pic, bg, py, to, sent, fr, col, live])

  const recipient = to ? members.find((m) => m.id === to) : null
  const empty = !strokes.length && !stickers.length && !pic
  const envoyer = async () => {
    if (empty || busy) return
    if (to && !recipient) {
      toast('Ce proche ne fait plus partie de la maison. Choisis un autre destinataire.', 'err')
      setPhase('destinataire')
      return
    }
    const confirmed = to
      ? true
      : await confirmer({ title: 'Envoyer à toute la famille ?', message: 'Tous les membres de cette maison pourront voir cette attention.', confirm: 'Envoyer mon attention' })
    if (!confirmed) return
    setBusy(true)
    const what = live ? 'Votre dessin à deux est envoyé' : pic ? (strokes.length || stickers.length ? 'Photo décorée envoyée' : 'Photo envoyée') : col ? 'Coloriage envoyé' : 'Dessin envoyé'
    const ok = await run(
      (api) =>
        api.sendDrawing(
          family.id,
          me.id,
          to,
          { v: 1, bg, s: strokes, ...(stickers.length ? { k: stickers } : {}), ...(pic ? { py: Math.round(py * 1000) / 1000 } : {}), ...(fr ? { fr } : {}), ...(col ? { col } : {}) },
          pic?.blob ?? null,
        ),
      live ? what : recipient ? `${what} à ${recipient.display_name}` : `${what} à toute la famille`,
    )
    setBusy(false)
    if (ok) {
      success()
      send({ t: 'fin', who: me.id })
      attentionDrafts.delete(draftKey)
      setSent('moi')
    }
  }

  if (sent)
    return (
      <Sheet title={live ? 'Dessin à deux' : 'Attention envoyée'} onClose={onClose}>
        <div className="flex flex-col items-center py-8 text-center">
          <img src="./art/geste-coeur.webp" alt="" className="h-24 w-24 object-contain" />
          <h3 className="mt-5 font-rond text-titre1">{live ? 'Un dessin fait à quatre mains.' : 'Un petit geste qui compte.'}</h3>
          <p className="mt-3 text-corps text-brume">
            {sent === 'partenaire'
              ? `${partner?.display_name ?? 'Ton proche'} a envoyé votre dessin. Il est dans vos attentions.`
              : live
                ? `Votre dessin est envoyé à ${recipient?.display_name ?? 'ton proche'}.`
                : recipient
                  ? `Ton attention est envoyée à ${recipient.display_name}.`
                  : 'Ton attention est envoyée à toute la famille.'}
          </p>
        </div>
        <Btn onClick={onClose}>C’est fait</Btn>
      </Sheet>
    )

  if (phase === 'destinataire')
    return (
      <Sheet title="À qui penses-tu ?" onClose={onClose}>
        <p className="mb-5 text-corps text-brume">Choisis à qui laisser une petite attention.</p>
        <div className="space-y-2">
          {others.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setTo(m.id)
                setPhase('format')
              }}
              className="presse flex min-h-[72px] w-full items-center gap-4 rounded-[20px] bg-white p-3 text-left"
            >
              <Avatar m={m} size={46} />
              <span className="text-corps font-semibold">{m.display_name}</span>
            </button>
          ))}
          <button
            onClick={() => {
              setTo(null)
              setPhase('format')
            }}
            className="presse flex min-h-[72px] w-full items-center gap-4 rounded-[20px] bg-teinte-doux p-3 text-left"
          >
            <UsersRound size={34} className="text-teinte-fonce" />
            <span>
              <span className="block text-corps font-semibold">Toute la famille</span>
              <span className="text-note text-brume">Visible par les membres de cette maison</span>
            </span>
          </button>
        </div>
      </Sheet>
    )

  const titre = recipient ? `Pour ${recipient.display_name}` : 'Pour toute la famille'
  const prenomCarte = recipient ? prenom(recipient.display_name) : undefined

  // une nouvelle feuille, quand on choisit ce qu'on veut faire
  const vierge = () => {
    setStrokes([])
    setStickers([])
    setFr(undefined)
    setCol(undefined)
    setPic(null)
    setBg(PAPERS[0].bg)
    setSel(null)
    setPanel(null)
    hist.current = []
    setHistN(0)
  }

  if (phase === 'format') {
    const tuiles: { k: string; label: string; hint: string; icon: typeof Pencil; tint: string; go: () => void; off?: string }[] = [
      { k: 'dessin', label: 'Un dessin', hint: 'Sur une feuille vierge', icon: Pencil, tint: '#7A5AE0', go: () => (vierge(), setPhase('edition'), setTool('feutre')) },
      { k: 'photo', label: 'Une photo', hint: 'À décorer', icon: Images, tint: '#3E9BE9', go: () => (vierge(), void photoMenu()) },
      { k: 'carte', label: 'Une carte', hint: 'Anniversaire, merci…', icon: Gift, tint: '#E5484D', go: () => setPhase('cartes') },
      { k: 'coloriage', label: 'Un coloriage', hint: 'Avec le pot de peinture', icon: Palette, tint: '#F76B15', go: () => setPhase('coloriages') },
      {
        k: 'deux',
        label: 'Dessiner à deux',
        hint: recipient ? `En direct avec ${recipient.display_name}` : 'Choisis un seul proche',
        icon: UsersRound,
        tint: '#12A594',
        go: () => (vierge(), void startLive()),
        off: recipient ? undefined : 'Pour dessiner à deux, choisis un seul proche.',
      },
    ]
    return (
      <Sheet title={titre} onClose={onClose}>
        <button onClick={() => setPhase('destinataire')} className="mb-3 min-h-11 text-sous font-semibold text-teinte-fonce">
          Changer de destinataire
        </button>
        <h3 className="mb-1 font-rond text-titre1">Un petit geste, à ta façon.</h3>
        <p className="mb-5 text-corps text-brume">Une photo, un dessin, une carte toute prête…</p>
        <div className="grid grid-cols-2 gap-2.5">
          {tuiles.map((t) => (
            <button
              key={t.k}
              onClick={() => {
                tap()
                if (t.off) return toast(t.off, 'err')
                t.go()
              }}
              className={`presse flex rounded-[22px] bg-carte p-3.5 text-left shadow-carte ${t.k === 'deux' ? 'col-span-2 min-h-[76px] items-center gap-3' : 'min-h-[104px] flex-col items-start justify-between'} ${t.off ? 'opacity-60' : ''}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-white" style={{ background: t.tint }}>
                <t.icon size={21} strokeWidth={2.3} />
              </span>
              <span className={t.k === 'deux' ? 'min-w-0 flex-1' : 'mt-2'}>
                <span className="block text-appel font-semibold">{t.label}</span>
                <span className="block text-note text-brume">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void pick(file).then((ok) => { if (ok) setPhase('edition') }); e.target.value = '' }} />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void pick(file).then((ok) => { if (ok) setPhase('edition') }); e.target.value = '' }} />
      </Sheet>
    )
  }

  if (phase === 'cartes')
    return (
      <Sheet title="Une carte" onClose={onClose} tall>
        <button onClick={() => setPhase('format')} className="mb-3 min-h-11 text-sous font-semibold text-teinte-fonce">
          Retour
        </button>
        <p className="mb-4 text-corps text-brume">{prenomCarte ? `Le prénom de ${prenomCarte} s’écrit tout seul quand il le faut. ` : ''}Tu pourras tout bouger, ajouter une photo ou dessiner dessus.</p>
        <div className="grid grid-cols-2 gap-3">
          {CARTES.map((c) => {
            const d = c.data(prenomCarte)
            return (
              <button
                key={c.key}
                onClick={() => {
                  tap()
                  setBg(d.bg)
                  setFr(d.fr)
                  setStickers(d.k ?? [])
                  setStrokes([])
                  setCol(undefined)
                  setPic(null)
                  setTool('feutre')
                  setPhase('edition')
                }}
                className="presse text-left"
              >
                <span className="block overflow-hidden rounded-[16px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.bg }}>
                  <DrawingCanvas data={d} label={`Carte ${c.label}`} />
                </span>
                <span className="mt-1 block px-1 text-note font-semibold">{c.label}</span>
              </button>
            )
          })}
        </div>
      </Sheet>
    )

  if (phase === 'coloriages')
    return (
      <Sheet title="Un coloriage" onClose={onClose} tall>
        <button onClick={() => setPhase('format')} className="mb-3 min-h-11 text-sous font-semibold text-teinte-fonce">
          Retour
        </button>
        <p className="mb-4 text-corps text-brume">Touche une zone avec le pot de peinture pour la remplir, ou colorie au feutre.</p>
        <div className="grid grid-cols-2 gap-3">
          {COLORIAGES.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                tap()
                setCol(c.key)
                setBg('#FFFFFF')
                setFr(undefined)
                setStrokes([])
                setStickers([])
                setPic(null)
                setTool('remplir')
                setColor('#FFB3C7')
                setPhase('edition')
              }}
              className="presse text-left"
            >
              <span className="block overflow-hidden rounded-[16px] bg-white shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO }}>
                <img src={coloriageUrl(c.key)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
              <span className="mt-1 block px-1 text-note font-semibold">{c.label}</span>
            </button>
          ))}
        </div>
      </Sheet>
    )

  const outils = col ? [POT, ...TOOLS] : TOOLS
  const encres = col ? [...COULEURS_COLORIAGE, ...INKS] : INKS
  const outilNom = tool === 'cadrer' ? 'Glisse la photo pour la cadrer' : outils.find((t) => t.key === tool)?.label

  return (
    <Sheet
      title={live ? 'Dessiner à deux' : col ? 'Coloriage' : 'Créer une attention'}
      onClose={() => {
        if (!busy) onClose()
      }}
      tall
      footer={
        <>
          <Btn onClick={envoyer} disabled={empty || busy}>
            {busy ? 'Envoi…' : live ? `Envoyer notre dessin à ${recipient?.display_name ?? 'ton proche'}` : recipient ? `Envoyer à ${recipient.display_name}` : 'Envoyer à toute la famille'}
          </Btn>
          <p className="pt-2 text-center text-note text-brume">{live ? 'Vous dessinez sur la même feuille, en direct.' : recipient ? `Une attention pour ${recipient.display_name}.` : 'Visible par toute la famille.'}</p>
        </>
      }
    >
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />

      {live ? (
        <div className={`flex items-center gap-3 rounded-[18px] px-3 py-2.5 ${partnerHere ? 'bg-[#E6F7F4]' : 'bg-remplissage'}`}>
          {partner && <Avatar m={partner} size={36} />}
          <p className="min-w-0 flex-1 text-sous font-semibold">
            {partnerHere ? `${partner?.display_name ?? 'Ton proche'} dessine avec toi` : `On attend ${partner?.display_name ?? 'ton proche'}…`}
            <span className="block text-note font-normal text-brume">{partnerHere ? 'Tout ce que vous tracez apparaît chez l’autre.' : 'L’invitation est partie, la feuille est déjà ouverte.'}</span>
          </p>
          {partnerHere ? <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#12A594]" /> : <LoaderCircle size={18} className="shrink-0 animate-spin text-brume" />}
        </div>
      ) : (
        <button onClick={() => setPhase('destinataire')} className="min-h-11 text-sous font-semibold text-teinte-fonce">
          {titre} · Modifier
        </button>
      )}

      {/* photo, stickers, cadres */}
      <div className="mt-3 flex gap-2">
        {!live && !col && (
          <button
            onClick={() => {
              tap()
              void photoMenu()
            }}
            className="presse flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-carte px-2 text-sous font-semibold text-teinte shadow-carte"
          >
            <Images size={17} strokeWidth={2.3} className="shrink-0" /> <span className="truncate">Photo</span>
          </button>
        )}
        {(
          [
            ['stickers', 'Stickers', StickerIcon],
            ['cadres', 'Cadres', Frame],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => {
              select()
              setPanel(panel === k ? null : k)
              setSel(null)
            }}
            aria-pressed={panel === k}
            className={`presse flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sous font-semibold shadow-carte transition-colors ${panel === k ? 'bg-teinte text-white' : 'bg-carte text-teinte'}`}
          >
            <Icon size={17} strokeWidth={2.3} className="shrink-0" /> <span className="truncate">{label}</span>
          </button>
        ))}
        {pic ? (
          <button
            onClick={() => {
              select()
              setTool(tool === 'cadrer' ? 'feutre' : 'cadrer')
              setSel(null)
            }}
            aria-pressed={tool === 'cadrer'}
            aria-label="Cadrer la photo"
            className={`presse flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-carte transition-colors ${tool === 'cadrer' ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
          >
            <Move size={17} strokeWidth={2.3} />
          </button>
        ) : null}
      </div>

      {/* la feuille, à la forme exacte du widget */}
      <div className="relative -mx-1.5 mt-3 overflow-hidden rounded-[26px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: pic ? '#1D1A2B' : bg }}>
        <canvas ref={base} className="absolute inset-0 h-full w-full" />
        {live && <canvas ref={remote} className="pointer-events-none absolute inset-0 h-full w-full" />}
        <canvas
          ref={liveCanvas}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label="Feuille de dessin"
          onPointerDown={(e) => {
            if (sel !== null) setSel(null)
            if (panel) setPanel(null)
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
            const [x, y] = pos(e.currentTarget, e)
            const t = tool as DrawTool
            if (t === 'remplir') {
              // pot de peinture : la zone se remplit tout de suite
              const s: Stroke = { o: 'remplir', c: color, w: 1, p: [x, y] }
              const id = uid()
              ids.current.set(s, id)
              snap()
              setStrokes((x) => [...x, s])
              if (live) {
                miens.current.push(id)
                send({ t: 'pt', who: me.id, id, s: { o: 'remplir', c: color, w: 1 }, p: [x, y] })
                send({ t: 'end', who: me.id, id })
              }
              select()
              return
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            const s: Stroke = { o: t, c: color, w: WIDTHS[t][size], p: [x, y] }
            current.current = { id: e.pointerId, s }
            full.current = false
            if (live) {
              const id = uid()
              ids.current.set(s, id)
              send({ t: 'pt', who: me.id, id, s: { o: s.o, c: s.c, w: s.w }, p: [x, y] })
              envoi.current = { id, from: 2, timer: window.setInterval(flush, 60) }
            }
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
            if (envoi.current) {
              flush()
              window.clearInterval(envoi.current.timer)
              send({ t: 'end', who: me.id, id: envoi.current.id })
              miens.current.push(envoi.current.id)
              envoi.current = null
            }
            current.current = null
            snap()
            setStrokes((s) => [...s, cur.s])
            requestAnimationFrame(drawLive)
          }}
          onPointerCancel={() => {
            drag.current = null
            if (envoi.current) {
              window.clearInterval(envoi.current.timer)
              send({ t: 'end', who: me.id, id: envoi.current.id })
              envoi.current = null
            }
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
            } else if (live) envoyerStickers()
          }}
        />
        {empty && !col && (
          <p className={`pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sous font-medium ${bg === '#1E1B33' ? 'text-white/75' : 'text-brume'}`}>
            {live ? 'Dessinez ici, chacun avec son doigt' : 'Dessine ici avec ton doigt, ajoute une photo ou des stickers'}
          </p>
        )}
        {tool === 'cadrer' && (
          <p className="verre pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-legende font-semibold text-encre">
            <Move size={13} strokeWidth={2.4} /> Glisse pour cadrer la photo
          </p>
        )}
      </div>

      {panel === 'stickers' ? (
        <StickerTray onPick={addSticker} onClose={() => setPanel(null)} />
      ) : panel === 'cadres' ? (
        <div className="anim-fondu mt-3 rounded-[22px] bg-carte p-2.5 shadow-carte">
          <div className="flex items-center justify-between px-1">
            <p className="text-sous font-semibold">Cadres</p>
            <button onClick={() => setPanel(null)} className="h-8 rounded-full px-2 text-note font-semibold text-teinte-fonce">
              Fermer
            </button>
          </div>
          <div className="mt-1.5 grid max-h-[230px] grid-cols-3 gap-2 overflow-y-auto">
            {CADRES.map((c) => {
              const on = (fr ?? 'aucun') === c.key
              return (
                <button key={c.key} onClick={() => choisirCadre(c.key)} aria-pressed={on} className="presse flex flex-col items-center gap-1">
                  <span className={`block w-full overflow-hidden rounded-[10px] bg-remplissage ${on ? 'ring-[2.5px] ring-teinte' : 'ring-1 ring-black/5'}`} style={{ aspectRatio: RATIO }}>
                    {vCadres ? <img src={vCadres[c.key]} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className={`text-legende ${on ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>{c.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          {/* outils */}
          <div className="mt-4 flex items-center gap-2">
            <div className="no-bar flex min-w-0 overflow-x-auto rounded-full bg-remplissage p-[3px]">
              {outils.map((t) => {
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
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${on ? 'bg-white text-encre shadow-[0_2px_6px_rgba(0,0,0,0.1)]' : 'text-brume'}`}
                  >
                    <t.icon size={17} strokeWidth={2.3} />
                  </button>
                )
              })}
            </div>
            <div className={`flex flex-1 items-center justify-end ${tool === 'remplir' ? 'invisible' : ''}`}>
              {([0, 1, 2] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => {
                    select()
                    setSize(i)
                  }}
                  aria-label={['Fin', 'Moyen', 'Épais'][i]}
                  aria-pressed={size === i}
                  className={`flex h-9 w-8 items-center justify-center rounded-full ${size === i ? 'bg-teinte-doux' : ''}`}
                >
                  <span
                    className="rounded-full"
                    style={{ width: [6, 11, 17][i], height: [6, 11, 17][i], background: tool === 'gomme' ? '#B9B4C8' : tool === 'arcenciel' ? ARC : color, boxShadow: color === '#FFFFFF' && tool !== 'gomme' && tool !== 'arcenciel' ? 'inset 0 0 0 1px #CFCADB' : undefined }}
                  />
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 px-1 text-legende font-medium text-brume">
            {outilNom}
            {tool === 'arcenciel' ? ' : les couleurs changent toutes seules' : tool === 'remplir' ? ' : touche une zone pour la remplir' : ''}
          </p>

          <div className="no-bar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 py-1">
            {encres.map((c) => {
              const on = color === c && tool !== 'gomme' && tool !== 'arcenciel'
              return (
                <button
                  key={c}
                  onClick={() => {
                    select()
                    setColor(c)
                    if (tool === 'gomme' || tool === 'cadrer' || tool === 'arcenciel') setTool(col ? 'remplir' : 'feutre')
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
            <span className={`text-note font-medium text-brume ${pic || col ? 'hidden' : ''}`}>Fond</span>
            <div className={`flex flex-1 gap-1.5 ${pic || col ? 'invisible' : ''}`}>
              {PAPERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => choisirFond(p.bg)}
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
              disabled={live ? !miens.current.length : !hist.current.length}
              className="presse flex h-9 w-9 items-center justify-center rounded-full bg-carte text-encre shadow-carte disabled:opacity-35"
              aria-label={live ? 'Retirer mon dernier trait' : 'Annuler'}
            >
              <Undo2 size={17} strokeWidth={2.4} />
            </button>
            <button
              onClick={async () => {
                if ((strokes.length > 3 || stickers.length > 1) && !(await confirmer({ title: 'Tout effacer ?', message: live ? 'La feuille sera vide chez vous deux.' : 'Les traits et les stickers. Tu pourras revenir en arrière.', confirm: 'Tout effacer', destructive: true }))) return
                snap()
                setStrokes([])
                setStickers([])
                setSel(null)
                miens.current = []
                if (live) send({ t: 'state', who: me.id, s: [], k: [], bg, ...(fr ? { fr } : {}), ...(col ? { col } : {}) })
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

// ═════════════════════════ L'invitation à dessiner à deux ═════════════════════════

/** Partout dans l'appli : un proche nous invite à dessiner à deux, on le rejoint d'un geste. */
export function LiveInvites() {
  const { state, api } = useHome()
  const [inv, setInv] = useState<LiveInvite | null>(null)
  const [open, setOpen] = useState<Live | null>(null)
  const fid = state.family.id
  const me = state.me.id
  useEffect(() => api.onLiveInvite(fid, me, (i) => setInv(i)), [api, fid, me])
  useEffect(() => {
    if (inv) success()
  }, [inv])
  if (open) return <DrawSheet live={open} to={open.partner} onClose={() => setOpen(null)} />
  if (!inv) return null
  const from = state.members.find((m) => m.id === inv.from)
  if (!from) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label="Invitation à dessiner à deux">
      <div className="anim-fondu absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div className="anim-pop relative w-full max-w-[360px] rounded-[34px] bg-fond px-5 pb-5 pt-6 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]">
        <span className="anim-bat mx-auto flex w-fit">
          <Avatar m={from} size={84} />
        </span>
        <p className="mt-4 font-rond text-titre2">{from.display_name} t’invite à dessiner à deux</p>
        <p className="mt-1 text-sous text-brume">Vous dessinez sur la même feuille, chacun sur son téléphone, et vous voyez les traits de l’autre en direct.</p>
        <Btn
          className="mt-5"
          onClick={() => {
            setOpen({ session: inv.session, partner: inv.from, hote: false })
            setInv(null)
          }}
        >
          <UsersRound size={18} strokeWidth={2.4} /> Dessiner avec {from.display_name}
        </Btn>
        <Btn kind="gris" className="mt-2" onClick={() => setInv(null)}>
          Pas maintenant
        </Btn>
      </div>
    </div>
  )
}

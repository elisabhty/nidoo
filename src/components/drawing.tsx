import { Camera, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { demoDrawing, DRAW_H, DRAW_W, fit, loadPhoto, paint, pointCount, replayParts, strokePath } from '../lib/drawing'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Drawing, DrawingData, FamilyState, Member } from '../lib/types'
import { ago } from '../lib/util'
import { Avatar, Btn, confirmer, Sheet } from './ui'

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

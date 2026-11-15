import { Brush, Eraser, Pencil, RotateCcw, Trash2, Undo2, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DRAW_H, DRAW_W, fit, INKS, MAX_POINTS, paint, PAPERS, pointCount, replayMs, strokePath, WIDTHS } from '../lib/drawing'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Drawing, DrawingData, DrawTool, FamilyState, Member, Stroke } from '../lib/types'
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

/** Affiche un dessin. Chaque fois que `play` change (et n'est pas 0), il se redessine trait par trait. */
export function DrawingCanvas({ data, id, play = 0, className = '', label }: { data: DrawingData; id?: string; play?: number; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Les données sont relues à chaque rafraîchissement de la maison : on ne recommence le dessin que si c'en est un autre.
  const latest = useRef(data)
  latest.current = data
  useEffect(() => {
    const data = latest.current
    const c = ref.current
    if (!c) return
    let upto = Infinity
    let raf = 0
    const draw = () => {
      const ctx = fit(c)
      paint(ctx, data, upto)
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
      const total = pointCount(data)
      const dur = replayMs(data)
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur)
        upto = k >= 1 ? Infinity : Math.max(1, Math.ceil(k * total))
        draw()
        if (k < 1) raf = requestAnimationFrame(step)
      }
      upto = 1
      raf = requestAnimationFrame(step)
    }
    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(c)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [id ?? data, play]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className={`block h-full w-full ${className}`} role="img" aria-label={label ?? 'Dessin'} />
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
          <Pencil size={26} strokeWidth={2} className="text-teinte" />
          <span className="text-appel font-semibold">Fais un premier dessin</span>
          <span className="text-note text-brume">Il arrive en direct chez un proche</span>
        </span>
      </button>
    )
  }
  const { from, fromName, toName } = forWhom(latest, me, members)
  const dark = latest.data.bg === '#1E1B33'
  return (
    <div className="relative w-full overflow-hidden rounded-[26px] shadow-carte" style={{ aspectRatio: RATIO, background: latest.data.bg }}>
      <button
        onClick={() => {
          tap()
          onOpen(latest)
        }}
        className="absolute inset-0"
        aria-label={`Dessin de ${fromName} pour ${toName}`}
      >
        <DrawingCanvas data={latest.data} id={latest.id} play={play} />
      </button>
      <span className={`pointer-events-none absolute bottom-2 left-2 flex h-7 max-w-[70%] items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 ${dark ? 'bg-white/15 text-white' : 'verre text-encre'}`}>
        {from && <Avatar m={from} size={24} />}
        <span className="truncate text-legende font-semibold">
          {fromName}
          {!compact && <span className="font-normal opacity-70"> · {toName === 'toi' ? 'pour toi' : toName === 'toute la famille' ? 'pour la famille' : `pour ${toName}`} · {ago(latest.created_at)}</span>}
        </span>
      </span>
      <button
        onClick={() => {
          tap()
          onDraw()
        }}
        className="presse absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-teinte text-white shadow-flottant"
        aria-label="Dessiner"
      >
        <Pencil size={17} strokeWidth={2.4} />
      </button>
    </div>
  )
}

// ═════════════════════════ La planche à dessin ═════════════════════════

const TOOLS: { key: DrawTool; label: string; icon: typeof Pencil }[] = [
  { key: 'crayon', label: 'Crayon', icon: Pencil },
  { key: 'feutre', label: 'Feutre', icon: Brush },
  { key: 'gomme', label: 'Gomme', icon: Eraser },
]

export function DrawSheet({ to: initialTo = null, onClose }: { to?: string | null; onClose: () => void }) {
  const { state, run, toast } = useHome()
  const { me, members, family } = state
  const others = members.filter((m) => m.id !== me.id)
  const [to, setTo] = useState<string | null>(initialTo)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [tool, setTool] = useState<DrawTool>('feutre')
  const [size, setSize] = useState<0 | 1 | 2>(1)
  const [color, setColor] = useState(INKS[1])
  const [bg, setBg] = useState(PAPERS[0].bg)
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

  // Toile du dessous : les traits terminés.
  useEffect(() => {
    if (base.current) paint(fit(base.current), { v: 1, bg, s: strokes })
  }, [strokes, bg])
  useEffect(() => {
    const ro = new ResizeObserver(() => base.current && paint(fit(base.current), { v: 1, bg, s: strokes }))
    if (base.current) ro.observe(base.current)
    return () => ro.disconnect()
  }, [strokes, bg])

  // Toile du dessus : le trait en cours, redessiné à chaque image.
  const drawLive = () => {
    raf.current = 0
    const c = live.current
    if (!c) return
    const ctx = fit(c)
    ctx.clearRect(0, 0, DRAW_W, DRAW_H)
    if (current.current) strokePath(ctx, current.current.s, bg)
  }
  const pos = (c: HTMLCanvasElement, e: { clientX: number; clientY: number }) => {
    const r = c.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * DRAW_W), Math.round(((e.clientY - r.top) / r.height) * DRAW_H)] as const
  }

  const recipient = to ? members.find((m) => m.id === to) : null
  const send = async () => {
    if (!strokes.length || busy) return
    setBusy(true)
    const ok = await run((api) => api.sendDrawing(family.id, me.id, to, { v: 1, bg, s: strokes }), recipient ? `Dessin envoyé à ${recipient.display_name}` : 'Dessin envoyé à toute la famille')
    setBusy(false)
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet title="Nouveau dessin" onClose={onClose} tall>
      {/* pour qui */}
      <div ref={chips} className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {[null, ...others.map((m) => m.id)].map((id) => {
          const m = id ? members.find((x) => x.id === id)! : null
          const on = to === id
          return (
            <button
              key={id ?? 'famille'}
              onClick={() => {
                select()
                setTo(id)
              }}
              aria-pressed={on}
              className={`presse flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3.5 text-sous font-semibold transition-colors ${on ? 'bg-teinte text-white' : 'bg-carte text-encre shadow-carte'}`}
            >
              {m ? (
                <Avatar m={m} size={32} />
              ) : (
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${on ? 'bg-white/20' : 'bg-teinte-doux text-teinte'}`}>
                  <UsersRound size={16} strokeWidth={2.4} />
                </span>
              )}
              {m ? m.display_name : 'Toute la famille'}
            </button>
          )
        })}
      </div>

      {/* la feuille, à la forme exacte du widget */}
      <div className="relative -mx-1.5 mt-3.5 overflow-hidden rounded-[26px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: bg }}>
        <canvas ref={base} className="absolute inset-0 h-full w-full" />
        <canvas
          ref={live}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label="Feuille de dessin"
          onPointerDown={(e) => {
            if (current.current) return
            if (total >= MAX_POINTS) {
              toast('Ta feuille est pleine, envoie-la !', 'err')
              return
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            const [x, y] = pos(e.currentTarget, e)
            current.current = { id: e.pointerId, s: { o: tool, c: color, w: WIDTHS[tool][size], p: [x, y] } }
            full.current = false
            drawLive()
          }}
          onPointerMove={(e) => {
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
            const cur = current.current
            if (!cur || cur.id !== e.pointerId) return
            current.current = null
            setStrokes((s) => [...s, cur.s])
            requestAnimationFrame(drawLive)
          }}
          onPointerCancel={() => {
            current.current = null
            requestAnimationFrame(drawLive)
          }}
        />
        {!strokes.length && (
          <p className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sous font-medium ${bg === '#1E1B33' ? 'text-white/45' : 'text-pale'}`}>Dessine ici avec ton doigt</p>
        )}
      </div>

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
                }}
                aria-pressed={on}
                aria-label={t.label}
                className={`flex h-9 items-center gap-1 rounded-full px-3 text-note font-semibold transition-colors ${on ? 'bg-white text-encre shadow-[0_2px_6px_rgba(0,0,0,0.1)]' : 'text-brume'}`}
              >
                <t.icon size={16} strokeWidth={2.3} />
                {on && t.label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-1 items-center justify-end gap-1">
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
              <span className="rounded-full" style={{ width: [6, 11, 17][i], height: [6, 11, 17][i], background: tool === 'gomme' ? '#B9B4C8' : color, boxShadow: color === '#FFFFFF' && tool !== 'gomme' ? 'inset 0 0 0 1px #CFCADB' : undefined }} />
            </button>
          ))}
        </div>
      </div>

      <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 py-1">
        {INKS.map((c) => {
          const on = color === c && tool !== 'gomme'
          return (
            <button
              key={c}
              onClick={() => {
                select()
                setColor(c)
                if (tool === 'gomme') setTool('feutre')
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

      <div className="mt-3 flex items-center gap-2">
        <span className="text-note font-medium text-brume">Fond</span>
        <div className="flex flex-1 gap-1.5">
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
            setStrokes((s) => s.slice(0, -1))
          }}
          disabled={!strokes.length}
          className="presse flex h-9 w-9 items-center justify-center rounded-full bg-carte text-encre shadow-carte disabled:opacity-35"
          aria-label="Annuler le dernier trait"
        >
          <Undo2 size={17} strokeWidth={2.4} />
        </button>
        <button
          onClick={async () => {
            if (strokes.length > 3 && !(await confirmer({ title: 'Effacer tout le dessin ?', confirm: 'Tout effacer', destructive: true }))) return
            setStrokes([])
          }}
          disabled={!strokes.length}
          className="presse flex h-9 w-9 items-center justify-center rounded-full bg-carte text-rouge shadow-carte disabled:opacity-35"
          aria-label="Tout effacer"
        >
          <Trash2 size={16} strokeWidth={2.4} />
        </button>
      </div>

      <Btn className="mt-5" onClick={send} disabled={!strokes.length || busy}>
        {busy ? 'Envoi…' : recipient ? `Envoyer à ${recipient.display_name}` : 'Envoyer à toute la famille'}
      </Btn>
      <p className="px-2 pt-2 text-center text-note text-brume">
        {recipient ? `Il apparaît tout de suite chez ${recipient.display_name} et se redessine sous ses yeux.` : 'Il apparaît tout de suite chez chacun et se redessine sous leurs yeux.'}
      </p>
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
  useEffect(() => markDrawingsSeen(drawings.map((x) => x.id)), [drawings])
  if (!d) return null
  const { from, fromName, toName } = forWhom(d, me, members)
  const mine = d.from_member === me.id

  return (
    <Sheet title="Dessins" onClose={onClose} tall>
      <div className="-mx-1.5 overflow-hidden rounded-[26px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.data.bg }}>
        <DrawingCanvas data={d.data} id={d.id} play={play} label={`Dessin de ${fromName}`} />
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
              if (!(await confirmer({ title: 'Supprimer ce dessin ?', message: 'Il disparaîtra aussi chez ceux qui l’ont reçu.', confirm: 'Supprimer', destructive: true }))) return
              const next = drawings.find((x) => x.id !== d.id)
              if (await run((api) => api.deleteDrawing(d.id), 'Dessin supprimé')) {
                if (next) setId(next.id)
                else onClose()
              }
            }}
            className="presse flex h-10 w-10 items-center justify-center rounded-full bg-carte text-rouge shadow-carte"
            aria-label="Supprimer ce dessin"
          >
            <Trash2 size={16} strokeWidth={2.4} />
          </button>
        )}
      </div>
      <Btn className="mt-4" onClick={() => onDraw(mine ? d.to_member : d.to_member === null ? null : d.from_member)}>
        <Pencil size={17} strokeWidth={2.4} /> {mine ? 'Faire un autre dessin' : d.to_member === null ? 'Répondre à la famille' : `Répondre à ${fromName}`}
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
                    <DrawingCanvas data={x.data} id={x.id} />
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
export function IncomingDrawing({ d, more, onReply, onSeen }: { d: Drawing; more: number; onReply: () => void; onSeen: () => void }) {
  const { state } = useHome()
  const { from, fromName } = forWhom(d, state.me, state.members)
  useEffect(() => success(), [d.id])
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label="Dessin reçu">
      <div className="anim-fondu absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div className="anim-pop relative w-full max-w-[380px] rounded-[34px] bg-fond px-4 pb-4 pt-5 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]">
        <div className="flex items-center justify-center gap-2.5">
          {from && <Avatar m={from} size={44} />}
          <p className="text-left font-rond text-titre3 leading-tight">
            {d.to_member ? `${fromName} t’a fait un dessin` : `${fromName} a dessiné pour la famille`}
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-[24px] shadow-carte ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.data.bg }}>
          <DrawingCanvas data={d.data} id={d.id} play={1} label={`Dessin de ${fromName}`} />
        </div>
        <Btn className="mt-4" onClick={onReply}>
          <Pencil size={17} strokeWidth={2.4} /> Répondre par un dessin
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
        <span className="block truncate text-sous font-semibold">{d.to_member ? `${fromName} t’a fait un dessin` : `${fromName} a dessiné pour la famille`}</span>
        <span className="block truncate text-note text-brume">Touche pour le voir se dessiner</span>
      </span>
      <span className="h-[34px] shrink-0 overflow-hidden rounded-[9px] ring-1 ring-black/5" style={{ aspectRatio: RATIO, background: d.data.bg }}>
        <DrawingCanvas data={d.data} id={d.id} />
      </span>
    </button>
  )
}

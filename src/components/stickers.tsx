import { RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FILTRES, type FiltreKey } from '../lib/filtres'
import { select, tap } from '../lib/haptic'
import { CATS, largeurDepart, nomSticker, stickerImgUrl, stickerSrc } from '../lib/stickers'
import type { Sticker } from '../lib/types'

// ═════════════════════════ Les stickers posés, qu'on déplace du doigt ═════════════════════════

type Geste = {
  i: number
  ptrs: Map<number, [number, number]>
  base: Sticker
  // repère du geste en cours : un doigt (déplacer), deux doigts (pincer, tourner) ou la poignée
  mode: 'un' | 'deux' | 'poignee'
  ref: { x: number; y: number; d: number; a: number; cx: number; cy: number }
  bouge: boolean
}

/**
 * Les stickers par-dessus une feuille de W × H unités : un doigt les déplace, deux doigts (ou la poignée)
 * les agrandissent et les tournent, la croix les enlève. Le sticker touché passe devant les autres.
 * `begin` est appelé avant chaque changement (pour pouvoir l'annuler), `end(changed)` à la fin du geste.
 */
export function StickerStage({
  W,
  H,
  k,
  setK,
  sel,
  setSel,
  begin,
  end,
}: {
  W: number
  H: number
  k: Sticker[]
  setK: (k: Sticker[]) => void
  sel: number | null
  setSel: (i: number | null) => void
  begin: () => void
  end: (changed: boolean) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const geste = useRef<Geste | null>(null)
  const kRef = useRef(k)
  kRef.current = k
  const [, bump] = useState(0)

  const unit = () => W / Math.max(1, box.current?.getBoundingClientRect().width ?? 1)
  const centreEcran = (st: Sticker) => {
    const r = box.current!.getBoundingClientRect()
    return [r.left + (st.x / W) * r.width, r.top + (st.y / H) * r.height] as const
  }

  const rebase = (g: Geste) => {
    const st = kRef.current[g.i]
    g.base = { ...st }
    const pts = [...g.ptrs.values()]
    const [cx, cy] = centreEcran(st)
    if (g.mode === 'poignee') {
      const [x, y] = pts[0]
      g.ref = { x, y, d: Math.hypot(x - cx, y - cy), a: Math.atan2(y - cy, x - cx), cx, cy }
    } else if (pts.length >= 2) {
      g.mode = 'deux'
      const [[x1, y1], [x2, y2]] = pts
      g.ref = { x: (x1 + x2) / 2, y: (y1 + y2) / 2, d: Math.hypot(x2 - x1, y2 - y1), a: Math.atan2(y2 - y1, x2 - x1), cx, cy }
    } else {
      g.mode = 'un'
      g.ref = { x: pts[0][0], y: pts[0][1], d: 1, a: 0, cx, cy }
    }
  }

  const move = (e: PointerEvent) => {
    const g = geste.current
    if (!g || !g.ptrs.has(e.pointerId)) return
    e.preventDefault()
    g.ptrs.set(e.pointerId, [e.clientX, e.clientY])
    const u = unit()
    const b = g.base
    const pts = [...g.ptrs.values()]
    let next: Sticker
    if (g.mode === 'poignee') {
      const [x, y] = pts[0]
      const d = Math.hypot(x - g.ref.cx, y - g.ref.cy)
      const a = Math.atan2(y - g.ref.cy, x - g.ref.cx)
      next = { ...b, s: b.s * (d / Math.max(8, g.ref.d)), r: b.r + ((a - g.ref.a) * 180) / Math.PI }
    } else if (g.mode === 'deux' && pts.length >= 2) {
      const [[x1, y1], [x2, y2]] = pts
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const d = Math.hypot(x2 - x1, y2 - y1)
      const a = Math.atan2(y2 - y1, x2 - x1)
      next = { ...b, x: b.x + (mx - g.ref.x) * u, y: b.y + (my - g.ref.y) * u, s: b.s * (d / Math.max(8, g.ref.d)), r: b.r + ((a - g.ref.a) * 180) / Math.PI }
    } else {
      const [x, y] = pts[0]
      next = { ...b, x: b.x + (x - g.ref.x) * u, y: b.y + (y - g.ref.y) * u }
    }
    // bien droit quand on en est tout près ; jamais perdu hors de la feuille
    let r = ((next.r % 360) + 540) % 360 - 180
    if (Math.abs(r) < 3.5) r = 0
    next = {
      ...next,
      x: Math.round(Math.max(0, Math.min(W, next.x))),
      y: Math.round(Math.max(0, Math.min(H, next.y))),
      s: Math.round(Math.max(48, Math.min(W * 0.95, next.s))),
      r: Math.round(r * 10) / 10,
    }
    if (!g.bouge && Math.hypot(next.x - b.x, next.y - b.y) + Math.abs(next.s - b.s) + Math.abs(next.r - b.r) > 2) g.bouge = true
    const all = kRef.current.slice()
    all[g.i] = next
    kRef.current = all
    setK(all)
  }

  const up = (e: PointerEvent) => {
    const g = geste.current
    if (!g || !g.ptrs.has(e.pointerId)) return
    g.ptrs.delete(e.pointerId)
    if (g.ptrs.size === 0 || g.mode === 'poignee') {
      geste.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('pointerdown', down2, true)
      end(g.bouge)
      return
    }
    rebase(g)
  }

  // un deuxième doigt posé n'importe où pendant qu'on tient un sticker : on pince
  const down2 = (e: PointerEvent) => {
    const g = geste.current
    if (!g || g.mode === 'poignee' || g.ptrs.has(e.pointerId) || g.ptrs.size >= 2) return
    e.preventDefault()
    e.stopPropagation()
    g.ptrs.set(e.pointerId, [e.clientX, e.clientY])
    rebase(g)
  }

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('pointerdown', down2, true)
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const start = (i: number, e: React.PointerEvent, poignee = false) => {
    e.stopPropagation()
    e.preventDefault()
    if (geste.current) return
    begin()
    // le sticker touché passe devant
    let all = kRef.current
    let j = i
    if (i !== all.length - 1) {
      all = [...all.slice(0, i), ...all.slice(i + 1), all[i]]
      j = all.length - 1
      kRef.current = all
      setK(all)
    }
    if (sel !== j) select()
    setSel(j)
    const g: Geste = { i: j, ptrs: new Map([[e.pointerId, [e.clientX, e.clientY]]]), base: all[j], mode: poignee ? 'poignee' : 'un', ref: { x: 0, y: 0, d: 1, a: 0, cx: 0, cy: 0 }, bouge: i !== j }
    geste.current = g
    rebase(g)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('pointerdown', down2, true)
  }

  return (
    <div ref={box} className="pointer-events-none absolute inset-0">
      {k.map((st, i) => {
        const url = stickerImgUrl(st.i)
        if (!url) {
          stickerSrc(st.i, () => bump((n) => n + 1))
          return null
        }
        const on = sel === i
        return (
          <div
            key={`${i}-${st.i}`}
            className="pointer-events-auto absolute touch-none select-none"
            style={{ left: `${(st.x / W) * 100}%`, top: `${(st.y / H) * 100}%`, width: `${(st.s / W) * 100}%`, transform: `translate(-50%, -50%) rotate(${st.r}deg)` }}
            onPointerDown={(e) => start(i, e)}
            role="img"
            aria-label={`Sticker ${nomSticker(st.i)}`}
          >
            <img src={url} alt="" draggable={false} className="pointer-events-none block w-full" style={{ filter: 'drop-shadow(0 1.5px 3px rgba(29,26,43,0.24))' }} />
            {on && (
              <>
                <span className="pointer-events-none absolute -inset-1.5 rounded-[12px] border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(29,26,43,0.25)]" />
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    tap()
                    begin()
                    setK(kRef.current.filter((_, j) => j !== i))
                    setSel(null)
                    end(true)
                  }}
                  className="absolute -left-4 -top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-rouge shadow-[0_2px_8px_rgba(29,26,43,0.3)]"
                  style={{ transform: `rotate(${-st.r}deg)` }}
                  aria-label="Enlever ce sticker"
                >
                  <X size={16} strokeWidth={2.8} />
                </button>
                <span
                  onPointerDown={(e) => start(i, e, true)}
                  className="absolute -bottom-4 -right-4 flex h-8 w-8 items-center justify-center rounded-full bg-teinte text-white shadow-[0_2px_8px_rgba(29,26,43,0.3)]"
                  role="button"
                  aria-label="Agrandir ou tourner le sticker"
                >
                  <RotateCw size={15} strokeWidth={2.8} />
                </span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═════════════════════════ La planche de stickers ═════════════════════════

export function StickerTray({ onPick, onClose }: { onPick: (key: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState(CATS[0].key)
  const [, bump] = useState(0)
  const items = CATS.find((c) => c.key === cat)?.items ?? []
  const mots = cat === 'mots'
  return (
    <div className="anim-fondu mt-3 rounded-[22px] bg-carte p-2.5 shadow-carte">
      <div className="flex items-center gap-2">
        <div className="no-bar -ml-1 flex flex-1 gap-1.5 overflow-x-auto px-1 py-0.5">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                select()
                setCat(c.key)
              }}
              aria-pressed={cat === c.key}
              className={`h-8 shrink-0 rounded-full px-3 text-note font-semibold transition-colors ${cat === c.key ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="h-8 shrink-0 rounded-full px-2 text-note font-semibold text-teinte-fonce">
          Fermer
        </button>
      </div>
      <div className={`mt-2 grid ${mots ? 'grid-cols-3' : 'grid-cols-5'} max-h-[200px] gap-1.5 overflow-y-auto`}>
        {items.map((key) => {
          const url = stickerImgUrl(key)
          if (!url) stickerSrc(key, () => bump((n) => n + 1))
          return (
            <button
              key={key}
              onClick={() => {
                tap()
                onPick(key)
              }}
              className={`presse flex items-center justify-center rounded-[14px] bg-fond p-1 ${mots ? 'h-14' : 'aspect-square'}`}
              aria-label={`Coller ${nomSticker(key)}`}
            >
              {url ? <img src={url} alt="" draggable={false} className="max-h-full max-w-full object-contain" style={{ filter: 'drop-shadow(0 1px 2px rgba(29,26,43,0.2))' }} /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Un nouveau sticker, posé vers le milieu, un peu de travers comme collé à la main. */
export function nouveauSticker(key: string, W: number, H: number, deja: number): Sticker {
  const j = deja % 5
  return {
    i: key,
    x: Math.round(W / 2 + [0, -0.18, 0.18, -0.1, 0.1][j] * W),
    y: Math.round(H / 2 + [0, -0.1, 0.1, 0.16, -0.16][j] * H),
    s: Math.round(largeurDepart(key) * (W / 1000)),
    r: Math.round((Math.random() * 20 - 10) * 10) / 10,
  }
}

// ═════════════════════════ Les filtres photo ═════════════════════════

export function FilterRow({ f, setF, vignettes, busy }: { f: FiltreKey; setF: (f: FiltreKey) => void; vignettes: Record<FiltreKey, string> | null; busy?: boolean }) {
  return (
    <div className="no-bar -mx-5 flex gap-2.5 overflow-x-auto px-5 py-1" aria-busy={busy}>
      {FILTRES.map((x) => {
        const on = f === x.key
        return (
          <button
            key={x.key}
            onClick={() => {
              select()
              setF(x.key)
            }}
            aria-pressed={on}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <span className={`block h-12 w-12 overflow-hidden rounded-[14px] bg-remplissage ${on ? 'ring-[2.5px] ring-teinte ring-offset-2 ring-offset-fond' : 'ring-1 ring-black/5'}`}>
              {vignettes ? <img src={vignettes[x.key]} alt="" className="h-full w-full object-cover" /> : null}
            </span>
            <span className={`text-legende ${on ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>{x.label}</span>
          </button>
        )
      })}
    </div>
  )
}

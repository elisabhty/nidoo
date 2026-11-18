import { Eraser, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { select, tap } from '../lib/haptic'
import { ENCRES, FEUILLE_H, FEUILLE_W, type Dessin, type Trait } from '../lib/parties'

// Une petite ardoise pour dessiner du doigt (dessine et devine, téléphone dessiné),
// et de quoi afficher un dessin. Les traits sont gardés en points sur une feuille de 1000 × 750.

const EPAISSEURS = [7, 14, 28]
const MAX_POINTS = 6000

const pts = (p: number[]) => {
  const q = p.length === 2 ? [p[0], p[1], p[0] + 0.5, p[1] + 0.5] : p
  let s = ''
  for (let i = 0; i < q.length; i += 2) s += `${q[i]},${q[i + 1]} `
  return s
}

export function DessinVue({ d, className = '', fond = '#FFFDF8' }: { d: Dessin | null | undefined; className?: string; fond?: string }) {
  return (
    <svg viewBox={`0 0 ${FEUILLE_W} ${FEUILLE_H}`} className={`block w-full rounded-[18px] ${className}`} style={{ background: fond, aspectRatio: `${FEUILLE_W} / ${FEUILLE_H}` }} role="img" aria-label="Un dessin">
      {(d ?? []).map((t, i) => (
        <polyline key={i} points={pts(t.p)} fill="none" stroke={ENCRES[t.c] ?? ENCRES[0]} strokeWidth={t.w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

export function Ardoise({ value, onChange }: { value: Dessin; onChange: (d: Dessin) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [encre, setEncre] = useState(0)
  const [ep, setEp] = useState(1)
  const [cur, setCur] = useState<Trait | null>(null)
  const curRef = useRef<Trait | null>(null)
  const total = value.reduce((n, t) => n + t.p.length / 2, 0)
  // Sur iPhone, la page défilait pendant qu'on dessinait : on bloque le geste natif sur l'ardoise
  // (les écouteurs de React sont « passifs », il faut un vrai preventDefault).
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const stop = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * FEUILLE_W), Math.round(((e.clientY - r.top) / r.height) * FEUILLE_H)]
  }
  const down = (e: React.PointerEvent) => {
    if (total >= MAX_POINTS) return
    svg.current?.setPointerCapture(e.pointerId)
    const t: Trait = { c: encre, w: EPAISSEURS[ep], p: point(e) }
    curRef.current = t
    setCur(t)
  }
  const move = (e: React.PointerEvent) => {
    const t = curRef.current
    if (!t) return
    const [x, y] = point(e)
    const n = t.p.length
    if (Math.hypot(x - t.p[n - 2], y - t.p[n - 1]) < 6 || total + n / 2 >= MAX_POINTS) return
    const next = { ...t, p: [...t.p, Math.max(0, Math.min(FEUILLE_W, x)), Math.max(0, Math.min(FEUILLE_H, y))] }
    curRef.current = next
    setCur(next)
  }
  const up = () => {
    const t = curRef.current
    curRef.current = null
    setCur(null)
    if (t) onChange([...value, t])
  }

  return (
    <div>
      <svg
        ref={svg}
        viewBox={`0 0 ${FEUILLE_W} ${FEUILLE_H}`}
        className="block w-full touch-none select-none rounded-[20px] shadow-carte ring-1 ring-black/5"
        style={{ background: '#FFFDF8', aspectRatio: `${FEUILLE_W} / ${FEUILLE_H}`, touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="img"
        aria-label="L’ardoise : dessine avec le doigt"
      >
        {[...value, ...(cur ? [cur] : [])].map((t, i) => (
          <polyline key={i} points={pts(t.p)} fill="none" stroke={ENCRES[t.c]} strokeWidth={t.w} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="mt-2.5 flex items-center gap-1.5">
        {ENCRES.map((c, i) => (
          <button
            key={c}
            aria-label={`Couleur ${i + 1}`}
            aria-pressed={encre === i}
            onClick={() => {
              select()
              setEncre(i)
            }}
            className="presse flex h-9 w-9 items-center justify-center rounded-full"
          >
            <span className="block h-7 w-7 rounded-full" style={{ background: c, boxShadow: encre === i ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${c}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
          </button>
        ))}
        <span className="flex-1" />
        {EPAISSEURS.map((w, i) => (
          <button
            key={w}
            aria-label={['Trait fin', 'Trait moyen', 'Trait épais'][i]}
            aria-pressed={ep === i}
            onClick={() => {
              select()
              setEp(i)
            }}
            className={`presse flex h-9 w-9 items-center justify-center rounded-full ${ep === i ? 'bg-teinte-doux' : ''}`}
          >
            <span className="block rounded-full" style={{ width: 6 + i * 6, height: 6 + i * 6, background: ENCRES[encre] }} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          disabled={!value.length}
          onClick={() => {
            tap()
            onChange(value.slice(0, -1))
          }}
          className="presse flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-carte text-sous font-semibold text-teinte shadow-carte disabled:opacity-40"
        >
          <Undo2 size={17} /> Annuler
        </button>
        <button
          disabled={!value.length}
          onClick={() => {
            tap()
            onChange([])
          }}
          className="presse flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-carte text-sous font-semibold text-rouge shadow-carte disabled:opacity-40"
        >
          <Eraser size={17} /> Tout effacer
        </button>
      </div>
    </div>
  )
}

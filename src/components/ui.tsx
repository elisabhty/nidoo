import { Check, ChevronLeft, ChevronRight, CircleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { COLORS } from '../lib/data'
import { select, tap, warn } from '../lib/haptic'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'
import { lookOf } from '../lib/look'
import { isToday } from '../lib/util'
import { Character } from './Character'

/** Illustration 3D de la bibliothèque NIDOO (public/art). */
export function Art({ name, size, className = '', alt = '' }: { name: string; size?: number; className?: string; alt?: string }) {
  return <img src={`./art/${name}.webp`} alt={alt} width={size} height={size} draggable={false} className={`select-none object-contain ${className}`} style={size ? { width: size, height: size } : undefined} />
}

/** Le personnage d'un proche en pastille ronde ; avec mood, son visage prend son humeur du jour. */
export function Avatar({ m, size = 44, mood = false, ring = false }: { m: Pick<Member, 'avatar' | 'color'> & Partial<Member>; size?: number; mood?: boolean; ring?: boolean }) {
  const c = COLORS[m.color] ?? COLORS.lavande
  const md = mood && isToday(m.mood_at ?? null) && m.mood ? m.mood : null
  const look = useMemo(() => lookOf(m.avatar, m.user_id ?? m.id ?? ''), [m.avatar, m.user_id, m.id])
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="block h-full w-full overflow-hidden rounded-full"
        style={{ background: `linear-gradient(160deg, ${c.bg}, ${c.deep})`, boxShadow: ring ? `0 0 0 2.5px #fff, 0 0 0 5px ${c.ring}` : 'inset 0 0 0 0.5px rgba(29,26,43,0.06)' }}
      >
        <Character look={look} mood={md} bust still={size < 44} className="block h-full w-full" blinkDelay={(size % 7) * 0.6} />
      </span>
    </span>
  )
}

/** Bouton rond en verre, comme les boutons de barre d'iOS. */
export function Rond({ children, onClick, label, tint = false }: { children: ReactNode; onClick: () => void; label: string; tint?: boolean }) {
  return (
    <button
      onClick={() => {
        tap()
        onClick()
      }}
      aria-label={label}
      className={`presse flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-appel font-semibold ${tint ? 'bg-teinte text-white shadow-flottant' : 'verre text-encre'}`}
    >
      {children}
    </button>
  )
}

/** Écran à grand titre : le titre se replie dans une barre floutée au défilement. */
export function Screen({ title, trailing, leading, children }: { title: string; trailing?: ReactNode; leading?: ReactNode; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  return (
    <div className="relative h-full">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'border-b border-trait bg-fond/80 backdrop-blur-2xl backdrop-saturate-150' : 'border-b border-transparent'}`}
        style={{ paddingTop: 'var(--sat)' }}
      >
        <div className="relative flex h-[52px] items-center justify-between px-4">
          <div className="pointer-events-auto flex items-center gap-2">{leading}</div>
          <p className={`absolute inset-x-24 truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{title}</p>
          <div className="pointer-events-auto flex items-center gap-2">{trailing}</div>
        </div>
      </div>
      <div
        className="no-bar h-full overflow-y-auto overscroll-contain pb-[120px]"
        style={{ paddingTop: 'calc(var(--sat) + 52px)' }}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 34)}
      >
        <h1 className="px-5 pb-2 font-rond text-grand">{title}</h1>
        {children}
      </div>
    </div>
  )
}

/** Page iOS qui glisse par-dessus l'écran : « Retour » en haut à gauche, grand titre qui se replie au défilement. */
export function Page({ title, back = 'Retour', onClose, trailing, children }: { title: string; back?: string; onClose: () => void; trailing?: ReactNode; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="anim-glisse absolute inset-0 z-40 bg-fond shadow-[-8px_0_30px_rgba(29,26,43,0.12)]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'border-b border-trait bg-fond/80 backdrop-blur-2xl backdrop-saturate-150' : 'border-b border-transparent'}`}
        style={{ paddingTop: 'var(--sat)' }}
      >
        <div className="relative flex h-[52px] items-center justify-between pl-1.5 pr-4">
          <button
            onClick={() => {
              tap()
              onClose()
            }}
            className="presse relative z-10 flex h-11 items-center pr-2 text-corps text-teinte"
          >
            <ChevronLeft size={30} strokeWidth={2.3} className="-mr-0.5" /> {back}
          </button>
          <p className={`absolute inset-x-28 truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{title}</p>
          <div className="relative z-10 flex items-center gap-2">{trailing}</div>
        </div>
      </div>
      <div
        className="no-bar h-full overflow-y-auto overscroll-contain"
        style={{ paddingTop: 'calc(var(--sat) + 52px)', paddingBottom: 'calc(var(--sab) + 28px)' }}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 34)}
      >
        <h1 className="px-5 pb-2 font-rond text-grand">{title}</h1>
        {children}
      </div>
    </div>
  )
}

/** Feuille modale iOS : poignée, glisser vers le bas pour fermer. */
export function Sheet({ title, onClose, children, tall = false }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const end = () => {
    if (dy > 110) onClose()
    start.current = null
    setDy(0)
  }
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="anim-fondu absolute inset-0 bg-black/30" style={{ opacity: Math.max(0.3, 1 - dy / 400) }} onClick={onClose} aria-label="Fermer" />
      <div
        className={`anim-monte relative flex flex-col rounded-t-feuille bg-fond shadow-[0_-10px_40px_rgba(29,26,43,0.18)] ${tall ? 'h-[92%]' : 'max-h-[92%]'}`}
        style={{ paddingBottom: 'calc(var(--sab) + 14px)', transform: dy ? `translateY(${dy}px)` : undefined, transition: start.current === null ? 'transform 0.35s var(--ressort)' : 'none' }}
      >
        <div
          className="touch-none"
          onPointerDown={(e) => {
            start.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => start.current !== null && setDy(Math.max(0, e.clientY - start.current))}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="mx-auto mt-[6px] h-[5px] w-9 rounded-full bg-pale" />
          <div className="relative flex h-[52px] items-center justify-center px-5">
            <h2 className="text-corps font-semibold">{title}</h2>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="presse absolute right-4 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-remplissage text-brume"
              aria-label="Fermer"
            >
              <X size={16} strokeWidth={2.8} />
            </button>
          </div>
        </div>
        <div className="no-bar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1">{children}</div>
      </div>
    </div>
  )
}

export function Btn({
  children, onClick, kind = 'plein', disabled, className = '', type = 'button',
}: { children: ReactNode; onClick?: () => void; kind?: 'plein' | 'teinte' | 'gris' | 'blanc'; disabled?: boolean; className?: string; type?: 'button' | 'submit' }) {
  const styles = {
    plein: 'bg-teinte text-white',
    teinte: 'bg-teinte-doux text-teinte-fonce',
    gris: 'bg-remplissage text-encre',
    blanc: 'bg-white text-teinte-fonce',
  }[kind]
  return (
    <button
      type={type}
      onClick={() => {
        tap()
        onClick?.()
      }}
      disabled={disabled}
      className={`presse flex h-[50px] w-full items-center justify-center gap-2 rounded-full px-5 text-corps font-semibold disabled:opacity-35 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Section({ title, hint, action, children, className = '' }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-7 ${className}`}>
      <div className="flex items-baseline justify-between px-5">
        <h3 className="font-rond text-titre2">{title}</h3>
        {action}
      </div>
      {hint ? <p className="mb-2.5 px-5 text-note text-brume">{hint}</p> : <div className="mb-2.5" />}
      {children}
    </section>
  )
}

export function Lien({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="presse text-corps text-teinte">
      {children}
    </button>
  )
}

/** Ligne de liste groupée façon Réglages. */
export function Row({
  icon, tint = '#7A5AE0', label, hint, value, onClick, danger, chevron = true, last,
}: { icon?: ReactNode; tint?: string; label: string; hint?: string; value?: ReactNode; onClick?: () => void; danger?: boolean; chevron?: boolean; last?: boolean }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`flex w-full items-center gap-3 pl-4 text-left ${onClick ? 'presse-ligne' : ''}`}>
      {icon && (
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-white" style={{ background: danger ? '#FF453A' : tint }}>
          {icon}
        </span>
      )}
      <span className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-2 py-2 pr-4 ${last ? '' : 'border-b border-trait'}`}>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-corps ${danger ? 'text-rouge' : ''}`}>{label}</span>
          {hint && <span className="block truncate text-note text-brume">{hint}</span>}
        </span>
        {value && <span className="shrink-0 text-corps text-brume">{value}</span>}
        {onClick && chevron && <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />}
      </span>
    </Tag>
  )
}

export function Vide({ art, title, text, children }: { art: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-10 pb-4 pt-10 text-center">
      <Art name={art} size={96} />
      <p className="mt-4 font-rond text-titre3">{title}</p>
      <p className="mt-1 text-sous text-brume">{text}</p>
      {children && <div className="mt-5 w-full max-w-[240px]">{children}</div>}
    </div>
  )
}

/** Notifications discrètes en haut d'écran, comme les bandeaux système. */
export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none absolute inset-x-0 z-[70] flex flex-col items-center gap-2 px-6" style={{ top: 'calc(var(--sat) + 8px)' }} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="anim-hud verre flex min-h-[44px] max-w-full items-center gap-2.5 rounded-full py-2 pl-2.5 pr-4 text-sous font-semibold text-encre">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${t.tone === 'err' ? 'bg-rouge' : 'bg-vert'}`}>
            {t.tone === 'err' ? <CircleAlert size={17} strokeWidth={2.6} /> : <Check size={17} strokeWidth={3} />}
          </span>
          <span className="min-w-0">{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export function Segments<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  const i = Math.max(0, options.findIndex((o) => o.key === value))
  return (
    <div className="relative flex h-9 rounded-full bg-remplissage p-[2px]" role="tablist">
      <span
        className="absolute bottom-[2px] top-[2px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)] transition-transform duration-300"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${i * 100}%)`, transitionTimingFunction: 'var(--ressort)' }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => {
            select()
            onChange(o.key)
          }}
          className={`relative z-10 flex-1 rounded-full text-note ${value === o.key ? 'font-semibold text-encre' : 'font-medium text-encre/80'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Envolée d'illustrations, jouée quand une attention arrive ou part. */
export function Envol({ art = 'geste-coeur', count = 14 }: { art?: string; count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const size = 30 + ((i * 7) % 26)
        const style = {
          left: `${4 + ((i * 53) % 86)}%`,
          bottom: '-60px',
          width: size,
          height: size,
          animation: `envol ${2.4 + ((i * 3) % 10) / 8}s ease-out ${i * 0.08}s both`,
          '--dx': `${((i * 37) % 80) - 40}px`,
          '--s': `${0.9 + ((i * 11) % 8) / 10}`,
          '--r': `${((i * 29) % 50) - 25}deg`,
        } as CSSProperties
        return <img key={i} src={`./art/${art}.webp`} alt="" className="absolute" style={style} />
      })}
    </div>
  )
}

/** Interrupteur iOS. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        select()
        onChange(!on)
      }}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-vert' : 'bg-[rgba(120,120,128,0.24)]'}`}
    >
      <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ${on ? 'translate-x-[20px]' : ''}`} />
    </button>
  )
}

// ───────── Feuille d'actions (menu et confirmation) ─────────

type Action = { label: string; destructive?: boolean }
type Ask = { title?: string; message?: string; actions: Action[]; resolve: (index: number) => void }
let push: ((a: Ask) => void) | null = null

/** Propose plusieurs actions dans une feuille iOS ; renvoie l'indice choisi, ou -1 si annulé. */
export function choisir(o: Omit<Ask, 'resolve'>): Promise<number> {
  return new Promise((resolve) => {
    if (!push) return resolve(-1)
    push({ ...o, resolve })
  })
}

/** Demande une confirmation avec une feuille d'actions iOS. */
export async function confirmer(o: { title: string; message?: string; confirm: string; destructive?: boolean }): Promise<boolean> {
  if (!push) return window.confirm(o.title)
  warn()
  return (await choisir({ title: o.title, message: o.message, actions: [{ label: o.confirm, destructive: o.destructive }] })) === 0
}

export function ActionSheetHost() {
  const [ask, setAsk] = useState<Ask | null>(null)
  useEffect(() => {
    push = setAsk
    return () => {
      push = null
    }
  }, [])
  if (!ask) return null
  const done = (i: number) => {
    ask.resolve(i)
    setAsk(null)
  }
  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end px-2.5" style={{ paddingBottom: 'calc(var(--sab) + 10px)' }} role="alertdialog" aria-modal="true" aria-label={ask.title ?? 'Actions'}>
      <button className="anim-fondu absolute inset-0 bg-black/30" onClick={() => done(-1)} aria-label="Annuler" />
      <div className="anim-monte relative">
        <div className="verre overflow-hidden rounded-[26px] bg-white/85">
          {(ask.title || ask.message) && (
            <div className="border-b border-trait px-5 py-3.5 text-center">
              {ask.title && <p className="text-note font-semibold text-brume">{ask.title}</p>}
              {ask.message && <p className="mt-0.5 text-note text-brume">{ask.message}</p>}
            </div>
          )}
          {ask.actions.map((a, i) => (
            <button key={a.label} onClick={() => done(i)} className={`presse-ligne h-[56px] w-full text-titre3 font-normal ${i > 0 ? 'border-t border-trait' : ''} ${a.destructive ? 'text-rouge' : 'text-teinte'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <button onClick={() => done(-1)} className="presse-ligne verre mt-2 h-[56px] w-full rounded-[26px] bg-white text-titre3 font-semibold text-teinte">
          Annuler
        </button>
      </div>
    </div>
  )
}

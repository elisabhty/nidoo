import { Check, ChevronLeft, ChevronRight, CircleAlert, Search, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { COLORS } from '../lib/data'
import { select, tap, warn } from '../lib/haptic'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'
import { lookOf } from '../lib/look'
import { isToday } from '../lib/util'
import { Character } from './Character'
import { Smiley } from './Smiley'

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
        <Character look={look} mood={md} bust recul={1.22} still={size < 44} className="block h-full w-full" blinkDelay={(size % 7) * 0.6} />
      </span>
      {/* l'humeur du jour, en petit smiley sur la pastille */}
      {md && size >= 36 && (
        <span className="absolute -bottom-0.5 -right-0.5 flex rounded-full bg-white p-[1.5px] shadow-[0_2px_5px_rgba(29,26,43,0.18)]">
          <Smiley mood={md} size={Math.round(size * 0.34)} />
        </span>
      )}
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
      className={`presse flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-appel font-semibold ${tint ? 'glass-tinted text-white' : 'glass-control text-encre'}`}
    >
      {children}
    </button>
  )
}

/** Écran à grand titre : le titre se replie dans une barre floutée au défilement. */
/** Rend une fenêtre au niveau de l'onglet, comme les autres : sinon, posée dans une zone qui défile,
 *  elle passe sous la barre du haut et sous les onglets sur iPhone (Elisa, 21 novembre : « regarde en haut »). */
export function AuDessus({ children }: { children: ReactNode }) {
  const ancre = useRef<HTMLSpanElement>(null)
  const [cible, setCible] = useState<Element | null>(null)
  useLayoutEffect(() => setCible(ancre.current?.closest('[data-tab]') ?? ancre.current?.closest('.app-frame') ?? null), [])
  return (
    <>
      <span ref={ancre} hidden />
      {cible && createPortal(children, cible)}
    </>
  )
}

export function Screen({ title, trailing, leading, children, compact = false }: { title: string; trailing?: ReactNode; leading?: ReactNode; children: ReactNode; compact?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  return (
    <div className="relative h-full">
      <div
        className={`ios-topbar pointer-events-none absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${compact || scrolled ? 'ios-toolbar-active' : 'border-b border-transparent'}`}
        style={{ paddingTop: 'var(--sat)' }}
      >
        <div className="relative flex h-[52px] items-center justify-between px-4">
          <div className="pointer-events-auto flex items-center gap-2">{leading}</div>
          {compact ? <h1 className="absolute inset-x-20 truncate text-center text-corps font-bold tracking-[-0.2px]">{title}</h1> : <p className={`absolute inset-x-24 truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{title}</p>}
          <div className="pointer-events-auto flex items-center gap-2">{trailing}</div>
        </div>
      </div>
      <div
        className={`no-bar overflow-y-auto overscroll-contain pb-[120px] ${compact ? 'absolute inset-x-0 bottom-0' : 'h-full'}`}
        style={compact ? { top: 'calc(var(--sat) + 52px)' } : { paddingTop: 'calc(var(--sat) + 52px)' }}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 34)}
      >
        {!compact && <h1 className="px-5 pb-3 pt-2 tracking-[-0.8px] font-sans text-grand">{title}</h1>}
        {children}
      </div>
    </div>
  )
}

/** Page iOS qui glisse par-dessus l'écran : « Retour » en haut à gauche, grand titre qui se replie au défilement. */
export function Page({ title, back = 'Retour', onClose, trailing, children, scrollKey }: { title: string; back?: string; onClose: () => void; trailing?: ReactNode; children: ReactNode; scrollKey?: string }) {
  const [scrolled, setScrolled] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  // un nouveau contenu (par exemple juste après l'adoption) repart du haut
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [scrollKey])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).filter((el) => el.getClientRects().length > 0)
      if (dialogs[dialogs.length - 1] !== page.current) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div ref={page} className="anim-glisse absolute inset-0 z-40 bg-fond shadow-[-8px_0_30px_rgba(29,26,43,0.12)]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`ios-topbar absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'ios-toolbar-active' : 'border-b border-transparent'}`}
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
        ref={body}
        className="no-bar h-full overflow-y-auto overscroll-contain"
        style={{ paddingTop: 'calc(var(--sat) + 52px)', paddingBottom: 'calc(var(--sab) + 28px)' }}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 34)}
      >
        <h1 className="px-5 pb-3 pt-2 tracking-[-0.8px] font-sans text-grand">{title}</h1>
        {children}
      </div>
    </div>
  )
}

/** Feuille modale iOS : poignée, glisser vers le bas pour fermer. */
export function Sheet({ title, onClose, children, tall = false, footer }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean; footer?: ReactNode }) {
  const [dy, setDy] = useState(0)
  const [contentScrolled, setContentScrolled] = useState(false)
  const dragStarted = useRef(0)
  const start = useRef<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => panel.current?.focus({preventScroll:true}))
    const onKey = (e: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).filter(el => el.getClientRects().length > 0)
      if (dialogs[dialogs.length - 1] !== root.current) return
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab') return
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0)
      if (!controls.length) { e.preventDefault(); return }
      const first = controls[0], last = controls[controls.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {e.preventDefault(); last.focus()}
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {e.preventDefault(); first.focus()}
    }
    window.addEventListener('keydown', onKey)
    return () => {cancelAnimationFrame(frame); window.removeEventListener('keydown',onKey); if(previous?.isConnected) previous.focus({preventScroll:true})}
  }, [])
  const end = (e: {clientY: number}) => {
    const distance = start.current === null ? 0 : Math.max(0,e.clientY - start.current)
    const velocity = distance / Math.max(1,performance.now() - dragStarted.current)
    if (distance > 110 || (distance > 40 && velocity > .65)) close.current()
    start.current = null
    setDy(0)
  }
  return (
    <div ref={root} className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="anim-fondu absolute inset-0 bg-black/30" style={{ opacity: Math.max(0.3, 1 - dy / 400) }} onClick={onClose} aria-label="Fermer" />
      <div
        ref={panel}
        tabIndex={-1}
        className={`ios-sheet anim-monte relative outline-none flex flex-col rounded-t-feuille bg-fond text-encre ${tall ? 'h-[92%]' : 'max-h-[92%]'}`}
        style={{ paddingBottom: 'calc(var(--sab) + 14px)', transform: dy ? `translateY(${dy}px)` : undefined, transition: start.current === null ? 'transform 0.35s var(--ressort)' : 'none' }}
      >
        <div
          className={`sheet-header touch-none shrink-0 ${contentScrolled ? 'sheet-header-scrolled' : ''}`}
          onPointerDown={(e) => {
            dragStarted.current = performance.now()
            start.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => start.current !== null && setDy(Math.max(0, e.clientY - start.current))}
          onPointerUp={end}
          onPointerCancel={() => {start.current = null; setDy(0)}}
        >
          <div className="mx-auto mt-[6px] h-[5px] w-9 rounded-full bg-pale" />
          <div className="relative flex min-h-[60px] items-center justify-center px-5 py-2">
            <h2 className="px-12 text-center text-corps font-semibold leading-snug">{title}</h2>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="presse absolute right-4 flex h-11 w-11 items-center justify-center rounded-full glass-control text-encre/70"
              aria-label="Fermer"
            >
              <X size={16} strokeWidth={2.8} />
            </button>
          </div>
        </div>
        {/* de l'air sous le dernier champ : il ne colle plus au bouton du bas, même clavier ouvert (Elisa, 21 novembre) */}
        <div className={`no-bar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-8' : 'pb-4'}`} onScroll={e => setContentScrolled(e.currentTarget.scrollTop > 8)}>{children}</div>
        {footer && <div className="sheet-footer shrink-0 px-5 pt-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Btn({
  children, onClick, kind = 'plein', disabled, className = '', type = 'button', manque, onManque,
}: {
  children: ReactNode; onClick?: () => void; kind?: 'plein' | 'teinte' | 'gris' | 'blanc'; disabled?: boolean; className?: string; type?: 'button' | 'submit'
  /** Ce qui manque pour pouvoir valider (« le nom de l'événement ») : le bouton a l'air grisé mais se touche, et le dit
   *  (Elisa, 21 novembre : « ne dit pas ce qu'il manque »). onManque : par exemple aller au champ à remplir. */
  manque?: string | null
  onManque?: () => void
}) {
  const styles = {
    plein: 'ios-primary text-white',
    teinte: 'bg-teinte-doux text-teinte-fonce',
    gris: 'bg-remplissage text-encre',
    blanc: 'bg-white text-teinte-fonce',
  }[kind]
  const [dit, setDit] = useState(0)
  useEffect(() => {
    if (!dit) return
    const t = window.setTimeout(() => setDit(0), 2600)
    return () => window.clearTimeout(t)
  }, [dit])
  const incomplet = !disabled && !!manque
  return (
    <div className={`relative w-full ${className}`}>
      {incomplet && dit > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2 flex justify-center">
          <p key={dit} role="alert" className="anim-pop rounded-full bg-encre px-3.5 py-1.5 text-center text-note font-bold text-white shadow-[0_6px_16px_-6px_rgba(29,26,43,0.5)]">
            Il manque {manque}
          </p>
        </div>
      )}
      <button
        key={incomplet ? `m${dit}` : 'ok'}
        type={type}
        onClick={() => {
          if (incomplet) {
            warn()
            setDit((d) => d + 1)
            onManque?.()
            return
          }
          tap()
          onClick?.()
        }}
        disabled={disabled}
        aria-disabled={incomplet || undefined}
        className={`presse flex min-h-[52px] py-3 leading-snug shrink-0 w-full items-center justify-center gap-2 rounded-full px-5 text-corps font-bold btn-desactive ${incomplet ? 'btn-incomplet' : ''} ${incomplet && dit ? 'secoue' : ''} ${styles}`}
      >
        {children}
      </button>
    </div>
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
    <button onClick={onClick} className="presse min-h-11 text-sous font-semibold text-teinte-fonce">
      {children}
    </button>
  )
}

/** Search stays in context and can be cancelled without leaving its screen. */
export function SearchField({value,onChange,placeholder='Rechercher',label=placeholder}: {value:string;onChange:(value:string)=>void;placeholder?:string;label?:string}) {
  const input = useRef<HTMLInputElement>(null)
  const [editing,setEditing] = useState(false)
  return <div className="ios-search mx-4 mb-5 flex items-center gap-3">
    <div className={`flex min-h-[46px] min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-remplissage pl-3 ${editing ? 'ring-2 ring-teinte/20' : ''}`}>
      <Search size={18} strokeWidth={2.2} className="shrink-0 text-brume" />
      <input ref={input} type="search" enterKeyHint="search" autoComplete="off" aria-label={label} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} onFocus={()=>setEditing(true)} onKeyDown={e=>{if(e.key==='Enter') input.current?.blur();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onChange('');setEditing(false);input.current?.blur()}}} className="min-w-0 flex-1 appearance-none bg-transparent py-3 text-corps text-encre outline-none placeholder:text-brume" />
      {value ? <button aria-label="Effacer la recherche" onPointerDown={e=>e.preventDefault()} onClick={()=>{onChange('');input.current?.focus()}} className="flex h-11 w-11 shrink-0 items-center justify-center text-brume"><span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brume text-white"><X size={12} strokeWidth={3} /></span></button> : <span className="w-3" />}
    </div>
    {editing && <button onPointerDown={e=>e.preventDefault()} onClick={()=>{onChange('');setEditing(false);input.current?.blur()}} className="presse min-h-11 shrink-0 text-corps text-teinte-fonce">Annuler</button>}
  </div>
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
    <div className="ios-segments relative isolate flex min-h-11 rounded-full p-[3px]" role="tablist">
      <span
        className="absolute bottom-[3px] top-[3px] rounded-full bg-white shadow-[0_2px_6px_rgba(29,26,43,0.08)] transition-transform duration-300"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${i * 100}%)`, transitionTimingFunction: 'var(--ressort)' }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          tabIndex={value === o.key ? 0 : -1}
          onKeyDown={(e) => {
            const current = options.findIndex((option) => option.key === o.key)
            const next = e.key === 'ArrowRight' ? (current + 1) % options.length : e.key === 'ArrowLeft' ? (current - 1 + options.length) % options.length : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : -1
            if (next < 0) return
            e.preventDefault()
            onChange(options[next].key)
            const tabs = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
            tabs?.[next]?.focus()
          }}
          onClick={() => {
            select()
            onChange(o.key)
          }}
          className={`relative z-10 min-h-11 min-w-0 flex-1 rounded-full px-2 py-2 text-note ${value === o.key ? 'font-semibold text-encre' : 'font-medium text-encre/80'}`}
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
      <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.06)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.3,1.5,0.5,1)] ${on ? 'translate-x-[20px]' : ''}`} />
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
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ask) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const controls = () => Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([tabindex="-1"])') ?? [])
    const frame = requestAnimationFrame(() => controls()[0]?.focus({preventScroll:true}))
    const cancel = () => {ask.resolve(-1); setAsk(null)}
    const onKey = (e: KeyboardEvent) => {
      if(e.key === 'Escape') {e.preventDefault(); cancel(); return}
      if(e.key !== 'Tab') return
      const list = controls(), first = list[0], last = list[list.length - 1]
      if(e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus()}
      else if(!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus()}
    }
    window.addEventListener('keydown',onKey)
    return () => {cancelAnimationFrame(frame);window.removeEventListener('keydown',onKey);if(previous?.isConnected)previous.focus({preventScroll:true})}
  }, [ask])
  if (!ask) return null
  const done = (i: number) => {
    ask.resolve(i)
    setAsk(null)
  }
  return (
    <div ref={dialog} className="absolute inset-0 z-[60] flex flex-col justify-end px-2.5" style={{ paddingBottom: 'calc(var(--sab) + 10px)' }} role="alertdialog" aria-modal="true" aria-label={ask.title ?? 'Actions'}>
      <button className="anim-fondu absolute inset-0 bg-black/30" onClick={() => done(-1)} tabIndex={-1} aria-label="Annuler" />
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

/** Une pluie de confettis (une seule fois), quand on vient de gagner. */
export function Confettis() {
  const bouts = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        x: (i * 37) % 100,
        d: 0.9 + ((i * 13) % 9) / 10,
        r: (i * 47) % 360,
        c: ['#8E6CF0', '#F58B5C', '#FFC93C', '#3FBF7F', '#F06BAA', '#5B9FE0'][i % 6],
        l: (i * 7) % 5,
      })),
    [],
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {bouts.map((b, i) => (
        <span key={i} className="absolute top-[-20px] block h-3 w-2 rounded-[2px]" style={{ left: `${b.x}%`, background: b.c, transform: `rotate(${b.r}deg)`, animation: `confetti ${b.d + 1.2}s ${b.l * 0.08}s cubic-bezier(0.3, 0.6, 0.5, 1) forwards` }} />
      ))}
    </div>
  )
}

/** Sous le résultat : une phrase qui garde sa place (le plateau ne saute plus d'un tour à l'autre). */
export function LigneSous({ children }: { children?: ReactNode }) {
  return <p className="mt-0.5 min-h-[20px] px-6 text-center text-note text-brume">{children}</p>
}

/** Avant de dépenser les étoiles de toute la famille : une question, pour éviter les achats par erreur. */
export const confirmerAchat = (nom: string, cout: number) =>
  confirmer({ title: `Acheter ${nom} ?`, message: `${cout} étoile${cout > 1 ? 's' : ''} de la maison. Elles sont à toute la famille.`, confirm: `Acheter · ${cout} étoile${cout > 1 ? 's' : ''}` })

/** Un champ obligatoire, présenté partout pareil (dossier, événement, prénom, maison) : son nom à gauche,
 *  « Obligatoire » à droite, un cadre teinté, et une ligne qui dit ce qu'il débloque. */
export function ChampRequis({ id, label, aide, children, className = '', compact = false }: { id: string; label: string; aide: string; children: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
        <label htmlFor={id} className={`${compact ? 'text-sous' : 'text-corps'} font-semibold text-encre`}>
          {label}
        </label>
        <span className="text-note font-semibold text-teinte-fonce">Obligatoire</span>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-teinte/25 bg-carte focus-within:border-teinte focus-within:ring-2 focus-within:ring-teinte/15">{children}</div>
      <p id={`${id}-aide`} className="mt-1.5 px-1 text-note text-brume">
        {aide}
      </p>
    </div>
  )
}
/** Le style du champ texte dans un ChampRequis. */
export const CHAMP_REQUIS = 'h-[52px] w-full bg-transparent px-4 text-corps text-encre outline-none placeholder:text-brume'

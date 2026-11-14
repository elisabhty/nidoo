import { X } from 'lucide-react'
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { avatarEmoji, COLORS, moodOf } from '../lib/data'
import { useStore } from '../lib/store'
import type { Member } from '../lib/types'
import { isToday } from '../lib/util'

export function Avatar({ m, size = 48, mood = false, ring = false }: { m: Pick<Member, 'avatar' | 'color'> & Partial<Member>; size?: number; mood?: boolean; ring?: boolean }) {
  const c = COLORS[m.color] ?? COLORS.lavande
  const md = mood && isToday(m.mood_at ?? null) ? moodOf(m.mood ?? null) : null
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{ background: c.bg, fontSize: size * 0.52, boxShadow: ring ? `0 0 0 2.5px #fff, 0 0 0 5px ${c.ring}` : undefined }}
        aria-hidden
      >
        {avatarEmoji(m.avatar)}
      </span>
      {md && (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-white shadow-carte"
          style={{ width: size * 0.46, height: size * 0.46, fontSize: size * 0.28 }}
          aria-label={md.label}
        >
          {md.emoji}
        </span>
      )}
    </span>
  )
}

export function Sheet({ title, onClose, children, tall = false }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="anim-fondu absolute inset-0 bg-encre/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Fermer" />
      <div
        className={`anim-monte relative flex flex-col rounded-t-4xl bg-creme shadow-doux ${tall ? 'h-[88%]' : 'max-h-[88%]'}`}
        style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-lavande-200" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="titre text-[22px]">{title}</h2>
          <button onClick={onClose} className="appui flex h-9 w-9 items-center justify-center rounded-full bg-white text-brume shadow-carte" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="no-bar min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
      </div>
    </div>
  )
}

export function Btn({
  children, onClick, kind = 'plein', disabled, className = '', type = 'button',
}: { children: ReactNode; onClick?: () => void; kind?: 'plein' | 'doux' | 'fantome'; disabled?: boolean; className?: string; type?: 'button' | 'submit' }) {
  const styles = {
    plein: 'bg-encre text-white shadow-doux',
    doux: 'bg-lavande-100 text-lavande-600',
    fantome: 'bg-white text-encre shadow-carte',
  }[kind]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`appui flex h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-[16px] font-bold disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-end justify-between px-5">
        <h3 className="titre text-[19px]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Lien({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[14px] font-bold text-lavande-600">
      {children}
    </button>
  )
}

export function Vide({ emoji, title, text, children }: { emoji: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-5 rounded-3xl border border-dashed border-lavande-200 bg-white/60 px-6 py-8 text-center">
      <div className="text-4xl" aria-hidden>{emoji}</div>
      <p className="titre mt-2 text-[18px]">{title}</p>
      <p className="mx-auto mt-1 max-w-[260px] text-[14px] leading-snug text-brume">{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none absolute inset-x-0 z-50 flex flex-col items-center gap-2 px-6" style={{ top: 'calc(var(--sat) + 12px)' }} aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-pop rounded-full px-4 py-2.5 text-[14px] font-bold shadow-doux ${t.tone === 'err' ? 'bg-peche-500 text-white' : 'bg-encre text-white'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Segments<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div className="flex rounded-full bg-lavande-100/80 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`h-10 flex-1 rounded-full text-[14px] font-bold transition-colors ${value === o.key ? 'bg-white text-encre shadow-carte' : 'text-brume'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Pluie de cœurs, jouée quand une attention arrive ou part. */
export function Coeurs({ emoji = '💜', count = 16 }: { emoji?: string; count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const left = 6 + ((i * 53) % 88)
        const style = {
          left: `${left}%`,
          bottom: '-40px',
          fontSize: `${22 + ((i * 7) % 20)}px`,
          animation: `coeur ${2.2 + ((i * 3) % 10) / 8}s ease-out ${i * 0.07}s both`,
          '--dx': `${((i * 37) % 80) - 40}px`,
          '--s': `${0.9 + ((i * 11) % 8) / 10}`,
          '--r': `${((i * 29) % 50) - 25}deg`,
        } as CSSProperties
        return (
          <span key={i} className="absolute" style={style}>
            {emoji}
          </span>
        )
      })}
    </div>
  )
}

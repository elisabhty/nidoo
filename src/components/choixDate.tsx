// Le calendrier de l'appli, à la place de celui de l'iPhone. Celui de l'iPhone est translucide (on voyait la fiche à
// travers) et restait parfois à l'écran après « valider », parce que le champ qui l'avait ouvert était redessiné
// entre-temps (Elisa, 25 novembre : « quand on appuie sur la date et qu'on fait valider, le calendrier reste en fond »).
// Ici : une carte blanche et opaque, on touche un jour, c'est choisi et la carte se ferme.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { select, tap } from '../lib/haptic'
import { decalerMois, grilleDuMois, isoDe, moisDe } from '../lib/moisGrille'
import { AuDessus } from './ui'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function ChoixDate({ titre, value, min, sansAnnee = false, onChoisir, onClose }: {
  titre: string
  /** La date choisie, « 2026-11-22 ». */
  value: string
  /** Pas avant cette date (une fin ne précède pas le début). */
  min?: string
  /** Un anniversaire : le jour et le mois seulement, on tourne dans la même année. */
  sansAnnee?: boolean
  onChoisir: (iso: string) => void
  onClose: () => void
}) {
  const aujourdhui = isoDe(new Date())
  const [vue, setVue] = useState(() => moisDe(value || aujourdhui))
  const [choisi, setChoisi] = useState(value)
  const [sens, setSens] = useState(0)
  const cases = useMemo(() => grilleDuMois(vue.a, vue.m), [vue])
  const carte = useRef<HTMLDivElement>(null)
  const glisse = useRef<{ x: number; y: number } | null>(null)
  const fermer = useRef(onClose)
  fermer.current = onClose

  useEffect(() => {
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const image = requestAnimationFrame(() => (carte.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? carte.current)?.focus({ preventScroll: true }))
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      fermer.current()
    }
    window.addEventListener('keydown', touche, true)
    return () => {
      cancelAnimationFrame(image)
      window.removeEventListener('keydown', touche, true)
      if (avant?.isConnected) avant.focus({ preventScroll: true })
    }
  }, [])

  const bouger = (d: number) => {
    tap()
    setSens(d)
    setVue((v) => decalerMois(v, d, sansAnnee))
  }
  const choisir = (iso: string) => {
    select()
    setChoisi(iso)
    onChoisir(iso)
    // le temps de voir le jour s'allumer
    window.setTimeout(() => fermer.current(), 160)
  }
  const nomDuMois = new Date(vue.a, vue.m, 1).toLocaleDateString('fr-FR', sansAnnee ? { month: 'long' } : { month: 'long', year: 'numeric' })
  const rond = 'presse flex h-10 w-10 items-center justify-center rounded-full bg-doux text-teinte-fonce'

  return (
    <AuDessus>
      <div className="absolute inset-0 z-[70] flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-label={titre}>
        <button className="anim-fondu absolute inset-0 bg-black/40" onClick={onClose} tabIndex={-1} aria-label="Fermer le calendrier" />
        <div ref={carte} tabIndex={-1} className="anim-pop relative w-full max-w-[352px] rounded-[28px] bg-carte px-3.5 pb-3 pt-4 text-encre shadow-[0_24px_60px_-18px_rgba(29,26,43,0.5)] outline-none">
          <p className="px-2 text-note font-semibold text-brume">{titre}</p>
          <div className="mt-0.5 flex items-center justify-between pl-2">
            <p key={`${vue.a}-${vue.m}`} className="anim-entre font-rond text-titre3 first-letter:uppercase" aria-live="polite">{nomDuMois}</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => bouger(-1)} className={rond} aria-label="Mois précédent"><ChevronLeft size={20} strokeWidth={2.6} /></button>
              <button type="button" onClick={() => bouger(1)} className={rond} aria-label="Mois suivant"><ChevronRight size={20} strokeWidth={2.6} /></button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-pale" aria-hidden="true">
            {JOURS.map((j) => <span key={j}>{j}</span>)}
          </div>
          <div
            key={`${vue.a}-${vue.m}`}
            className="mois-glisse mt-1 grid grid-cols-7 gap-y-0.5"
            style={{ '--sens': sens } as React.CSSProperties}
            onTouchStart={(e) => (glisse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
              const d = glisse.current
              glisse.current = null
              if (!d) return
              const dx = e.changedTouches[0].clientX - d.x
              const dy = e.changedTouches[0].clientY - d.y
              if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) bouger(dx < 0 ? 1 : -1)
            }}
          >
            {cases.map((iso, i) => {
              if (!iso) return <span key={i} className="h-11" />
              const on = iso === choisi
              const jour = iso === aujourdhui
              const interdit = !!min && iso < min
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={interdit}
                  aria-pressed={on}
                  aria-label={new Date(`${iso}T12:00`).toLocaleDateString('fr-FR', sansAnnee ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  onClick={() => choisir(iso)}
                  className="group flex h-11 items-center justify-center disabled:opacity-30"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full text-corps tabular-nums transition-transform duration-150 group-active:scale-90 ${on ? 'bg-teinte font-bold text-white shadow-[0_4px_10px_-3px_rgba(112,80,213,0.6)]' : jour ? 'bg-teinte-doux font-bold text-teinte-fonce' : 'font-medium'}`}>
                    {Number(iso.slice(8))}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-trait/70 pt-2">
            <button type="button" disabled={!!min && aujourdhui < min} onClick={() => choisir(aujourdhui)} className="presse min-h-11 rounded-full px-3 text-sous font-bold text-teinte-fonce disabled:opacity-40">Aujourd’hui</button>
            <button type="button" onClick={onClose} className="presse min-h-11 rounded-full px-3 text-sous font-semibold text-brume">Annuler</button>
          </div>
        </div>
      </div>
    </AuDessus>
  )
}

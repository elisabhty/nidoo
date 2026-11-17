import { Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { avent, CASES, decoDe, etoilesDe, type AventAction } from '../lib/avent'
import { DECO_PLACES, DECO_TAILLE } from '../lib/aventSapin'
import { success, tap } from '../lib/haptic'
import { jouer } from '../lib/sons'
import { useHome } from '../lib/store'
import { ago } from '../lib/util'
import { StarsPill } from './compagnon'
import { Art, Avatar, Btn, Page, Sheet } from './ui'

// Le calendrier de l'Avent : 24 cases à ouvrir en famille, du 1er au 24 décembre.
// Chaque case ouverte accroche sa décoration sur le sapin commun (positions dans aventSapin.ts)
// et donne une petite mission pour la journée. Visible seulement quand l'interrupteur « avent » est allumé.

/** Les couleurs des cases, comme des poches de feutrine : le fond, puis le chiffre. */
const POCHES: [string, string][] = [
  ['#FFC2B8', '#B4483A'],
  ['#C6EAD7', '#2F7A57'],
  ['#DDD2FF', '#5B3CC4'],
  ['#FFE3A3', '#A0670A'],
]

export function useAvent() {
  const { state } = useHome()
  return useMemo(() => avent(state), [state])
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function AventPage({ onClose, onAction }: { onClose: () => void; onAction?: (a: AventAction) => void }) {
  const { state, run } = useHome()
  const a = useAvent()
  const [vue, setVue] = useState<number | null>(null)
  const [juste, setJuste] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const ouvertes = a.doors.size

  const ouvrir = async (day: number) => {
    if (busy) return
    if (a.doors.has(day)) {
      tap()
      setVue(day)
      return
    }
    setBusy(true)
    const ok = await run((api) => api.openAdvent(state.family.id, day))
    setBusy(false)
    if (!ok) return
    jouer('avent')
    success()
    setJuste(day)
    window.setTimeout(() => setVue(day), 650)
  }

  const intro =
    a.today > 0
      ? 'Une case par jour, à ouvrir en famille. Chaque case ouverte accroche une décoration sur notre sapin.'
      : a.dans > 0
        ? `Rendez-vous le 1er décembre, dans ${a.dans} jour${a.dans > 1 ? 's' : ''} : chaque jour, une case à ouvrir en famille.`
        : 'Le calendrier est terminé : merci d’avoir décoré le sapin ensemble, et joyeuses fêtes !'

  return (
    <Page title="Calendrier de l’Avent" onClose={onClose} trailing={<StarsPill />}>
      <p className="-mt-1 px-5 text-sous text-brume">{intro}</p>

      {/* le sapin de la famille */}
      <div className="relative mx-4 mt-4 overflow-hidden rounded-[30px] px-4 pb-4 pt-5 shadow-carte" style={{ background: 'linear-gradient(170deg, #E4F0FF 0%, #F3EEFF 62%, #FFF6EC 100%)' }}>
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute -top-2 rounded-full bg-white"
            style={{ left: `${(i * 37 + 7) % 100}%`, width: 4 + (i % 3), height: 4 + (i % 3), opacity: 0.9, animation: `neige ${8 + (i % 5) * 1.7}s linear ${-i * 1.1}s infinite`, ['--nx' as string]: `${i % 2 ? 20 : -16}px` }}
          />
        ))}
        <div className="relative mx-auto" style={{ width: 'min(62%, 230px)', aspectRatio: '412 / 720' }}>
          <img src="./art/avent-sapin.webp" alt="Le sapin de la famille" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          {[...a.doors.keys()].map((day) => {
            const [x, y] = DECO_PLACES[day - 1]
            return (
              <img
                key={day}
                src={`./art/avent-${decoDe(day)}.webp`}
                alt=""
                draggable={false}
                className="absolute select-none"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${DECO_TAILLE}%`,
                  transform: 'translate(-50%, -50%)',
                  filter: 'drop-shadow(0 2px 2px rgba(40,60,40,0.25))',
                  animation: juste === day ? 'pop 0.6s var(--ressort) 0.25s both' : undefined,
                }}
              />
            )
          })}
        </div>
        <p className="relative mt-2 text-center font-rond text-appel">
          {ouvertes === 0 ? 'Le sapin attend sa première décoration' : ouvertes === 24 ? 'Le sapin est complet. Joyeux Noël !' : `${ouvertes} décoration${ouvertes > 1 ? 's' : ''} sur 24`}
        </p>
      </div>

      {/* les 24 cases */}
      <div className="mx-4 mt-4 grid grid-cols-4 gap-2.5">
        {Array.from({ length: 24 }, (_, i) => {
          const day = i + 1
          const door = a.doors.get(day)
          const can = !door && day <= a.today
          const locked = !door && !can
          const [bg, fg] = POCHES[(i + Math.floor(i / 4)) % POCHES.length]
          const qui = door?.opened_by ? state.members.find((m) => m.id === door.opened_by) : undefined
          const aujourdhui = day === a.today && can
          return (
            <button
              key={day}
              disabled={locked || busy}
              onClick={() => void ouvrir(day)}
              aria-label={door ? `Case ${day}, ouverte` : can ? `Ouvrir la case ${day}` : `Case ${day}, pas encore`}
              className="presse relative aspect-square rounded-[18px] disabled:cursor-default"
              style={{
                background: door ? '#FFFFFF' : bg,
                boxShadow: door
                  ? '0 3px 10px rgba(60,40,140,0.10)'
                  : `inset 0 -5px 0 rgba(0,0,0,0.07), inset 0 0 0 2px rgba(255,255,255,0.55)${can ? `, 0 0 0 3px #FFFFFF, 0 0 0 5.5px ${fg}` : ''}`,
                opacity: locked ? 0.55 : 1,
                animation: aujourdhui ? 'caseDuJour 2.2s ease-in-out infinite' : undefined,
              }}
            >
              {door ? (
                <>
                  <img src={`./art/avent-${decoDe(day)}.webp`} alt="" className="absolute inset-[14%] h-[72%] w-[72%] object-contain" style={{ animation: juste === day ? 'pop 0.5s var(--ressort) both' : undefined }} />
                  <span className="absolute left-1.5 top-1 text-mini font-bold text-brume">{day}</span>
                  {qui && (
                    <span className="absolute -bottom-1 -right-1">
                      <Avatar m={qui} size={22} />
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-rond text-[28px] font-bold leading-none" style={{ color: fg }}>
                    {day}
                  </span>
                  {locked && <Lock size={12} strokeWidth={2.6} className="absolute bottom-1.5 right-1.5" style={{ color: fg, opacity: 0.6 }} />}
                </>
              )}
            </button>
          )
        })}
      </div>
      <p className="mx-6 mb-4 mt-4 text-center text-note text-brume">
        Une case s’ouvre à partir de son jour, pour toute la maison. Elle rapporte une étoile (trois pour celle du 24). Une case oubliée peut s’ouvrir plus tard.
      </p>

      {vue != null && (
        <CaseSheet
          day={vue}
          mine={juste === vue}
          onClose={() => setVue(null)}
          onAction={
            onAction && CASES[vue - 1].action
              ? (k) => {
                  setVue(null)
                  onAction(k)
                }
              : undefined
          }
        />
      )}
    </Page>
  )
}

function CaseSheet({ day, mine, onClose, onAction }: { day: number; mine: boolean; onClose: () => void; onAction?: (a: AventAction) => void }) {
  const { state } = useHome()
  const a = useAvent()
  const c = CASES[day - 1]
  const door = a.doors.get(day)
  const qui = door?.opened_by ? state.members.find((m) => m.id === door.opened_by) : undefined
  return (
    <Sheet
      title={`${day} ${MOIS[11]}`}
      onClose={onClose}
      footer={
        c.action && onAction ? (
          <Btn onClick={() => onAction(c.action!.k)}>{c.action.label}</Btn>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center px-2 pb-2 text-center">
        <Art name={`avent-${decoDe(day)}`} size={104} className="anim-pop" />
        <p className="mt-2 font-rond text-titre2">{c.titre}</p>
        <p className="mt-1.5 text-corps text-brume">{c.texte}</p>
        {mine ? (
          <p className="mt-4 flex items-center gap-1.5 rounded-full bg-[#FFF6DA] px-3.5 py-1.5 text-sous font-semibold text-[#A0670A]">
            +{etoilesDe(day)} <Art name="picto-etoile" size={18} /> pour la maison
          </p>
        ) : (
          qui &&
          door && (
            <p className="mt-4 flex items-center gap-2 text-sous text-brume">
              <Avatar m={qui} size={26} /> Ouverte par {qui.id === state.me.id ? 'toi' : qui.display_name} · {ago(door.opened_at)}
            </p>
          )
        )}
      </div>
    </Sheet>
  )
}

/** L'entrée du calendrier dans « À vivre ensemble ». */
export function AventCard({ onOpen }: { onOpen: () => void }) {
  const a = useAvent()
  if (!a.visible) return null
  const n = a.aOuvrir.length
  return (
    <button
      onClick={() => {
        tap()
        onOpen()
      }}
      className="presse mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[28px] p-3.5 text-left shadow-carte"
      style={{ background: 'linear-gradient(160deg, #E8F5EE, #F3EEFF)' }}
    >
      <Art name="avent-sapin-mini" size={52} />
      <span className="min-w-0 flex-1">
        <span className="block font-rond text-titre3">Calendrier de l’Avent</span>
        <span className={`block text-note ${n ? 'font-semibold text-[#2F7A57]' : 'text-brume'}`}>{aventHint(a)}</span>
      </span>
      {n > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rouge px-1.5 text-mini font-bold text-white">{n}</span>}
    </button>
  )
}

/** Une phrase pour dire où en est le calendrier. */
export function aventHint(a: ReturnType<typeof avent>) {
  if (a.today === 0) return a.dans > 0 ? `Il ouvre dans ${a.dans} jour${a.dans > 1 ? 's' : ''}` : `${a.doors.size} décorations sur le sapin`
  if (a.aOuvrir.includes(a.today)) return `La case du ${a.today === 1 ? '1er' : a.today} décembre vous attend`
  if (a.aOuvrir.length) return `${a.aOuvrir.length} case${a.aOuvrir.length > 1 ? 's' : ''} à rattraper`
  return `${a.doors.size} décoration${a.doors.size > 1 ? 's' : ''} sur le sapin`
}

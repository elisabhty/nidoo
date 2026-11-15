import { CalendarDays, Folder, Gamepad2, House as HouseIcon, UsersRound } from 'lucide-react'
import { useState } from 'react'
import Guide from './components/Guide'
import { Incoming } from './components/sheets'
import { ActionSheetHost, Btn, Toasts } from './components/ui'
import { select } from './lib/haptic'
import { useStore } from './lib/store'
import Family from './screens/Family'
import Home from './screens/Home'
import Dossiers, { type DossiersSeg } from './screens/Folders'
import Onboarding from './screens/Onboarding'
import Organize from './screens/Organize'
import Play from './screens/Play'

const GUIDE = 'nidoo.guide.vu'

export type Tab = 'maison' | 'moments' | 'jouer' | 'organiser' | 'famille'
/** « fil » ouvre l'onglet Dossiers directement sur le fil de la famille. */
export type Go = Tab | 'fil'

const TABS: { key: Tab; label: string; icon: typeof HouseIcon }[] = [
  { key: 'maison', label: 'Maison', icon: HouseIcon },
  { key: 'moments', label: 'Dossiers', icon: Folder },
  { key: 'jouer', label: 'Jouer', icon: Gamepad2 },
  { key: 'organiser', label: 'Organiser', icon: CalendarDays },
  { key: 'famille', label: 'Famille', icon: UsersRound },
]

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-fond px-8 text-center">
      <img src="./panda.webp" alt="" className="h-[120px] w-[120px] rounded-[28px] shadow-[0_24px_50px_-18px_rgba(102,70,204,0.55)]" />
      {children}
    </div>
  )
}

export default function App() {
  const { status, error, state, retry } = useStore()
  const [tab, setTab] = useState<Tab>('maison')
  const [seg, setSeg] = useState<DossiersSeg>('dossiers')
  const go = (g: Go) => {
    if (g === 'fil') {
      setSeg('fil')
      setTab('moments')
    } else setTab(g)
  }
  const [guide, setGuide] = useState(() => {
    try {
      return !localStorage.getItem(GUIDE)
    } catch {
      return false
    }
  })
  const closeGuide = () => {
    setGuide(false)
    try {
      localStorage.setItem(GUIDE, '1')
    } catch {
      /* le guide reviendra au prochain lancement, sans gravité */
    }
  }
  const unseen = state ? state.thoughts.filter((t) => t.to_member === state.me.id && !t.seen_at).length : 0

  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-full w-full overflow-hidden bg-fond sm:h-[min(880px,96vh)] sm:max-w-[410px] sm:rounded-[48px] sm:shadow-[0_40px_100px_-30px_rgba(29,26,43,0.45)]">
        {status === 'loading' && <Splash />}
        {status === 'error' && (
          <Splash>
            <p className="mt-6 font-rond text-titre2">Connexion impossible</p>
            <p className="mt-1 max-w-[270px] text-sous text-brume">{error}</p>
            <Btn className="mt-6 max-w-[220px]" onClick={retry}>Réessayer</Btn>
          </Splash>
        )}
        {status === 'ready' && !state && <Onboarding />}
        {status === 'ready' && state && (
          <>
            <div className="h-full" key={state.family.id}>
              {tab === 'maison' && <Home go={go} />}
              {tab === 'moments' && <Dossiers seg={seg} setSeg={setSeg} />}
              {tab === 'jouer' && <Play />}
              {tab === 'organiser' && <Organize />}
              {tab === 'famille' && <Family onGuide={() => setGuide(true)} />}
            </div>

            {/* Barre d'onglets flottante en verre */}
            <nav className="verre absolute inset-x-5 z-30 flex h-[62px] items-center rounded-full p-1" style={{ bottom: 'calc(var(--sab) + 8px)' }} aria-label="Navigation principale">
              {TABS.map((t) => {
                const on = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      select()
                      setTab(t.key)
                    }}
                    aria-current={on ? 'page' : undefined}
                    className={`relative flex h-full flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-colors duration-200 ${on ? 'bg-encre/[0.07] text-teinte' : 'text-encre/70'}`}
                  >
                    <t.icon size={23} strokeWidth={on ? 2.4 : 2} fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.18 : 0} />
                    <span className={`text-[10px] leading-none tracking-normal ${on ? 'font-semibold' : 'font-medium'}`}>{t.label}</span>
                    {t.key === 'maison' && unseen > 0 && !on && <span className="absolute right-[24%] top-2 h-2.5 w-2.5 rounded-full bg-rouge ring-2 ring-white" />}
                  </button>
                )
              })}
            </nav>

            {tab === 'maison' && !guide && <Incoming />}
            {guide && <Guide onClose={closeGuide} />}
          </>
        )}
        <ActionSheetHost />
        <Toasts />
      </div>
    </div>
  )
}

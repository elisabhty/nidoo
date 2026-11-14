import { CalendarHeart, Gamepad2, Home as HomeIcon, Images, Users } from 'lucide-react'
import { useState } from 'react'
import { Incoming } from './components/sheets'
import { Btn, Toasts } from './components/ui'
import { useStore } from './lib/store'
import Family from './screens/Family'
import Home from './screens/Home'
import Moments from './screens/Moments'
import Onboarding from './screens/Onboarding'
import Organize from './screens/Organize'
import Play from './screens/Play'

export type Tab = 'maison' | 'moments' | 'jouer' | 'organiser' | 'famille'

const TABS: { key: Tab; label: string; icon: typeof HomeIcon }[] = [
  { key: 'maison', label: 'Maison', icon: HomeIcon },
  { key: 'moments', label: 'Moments', icon: Images },
  { key: 'jouer', label: 'Jouer', icon: Gamepad2 },
  { key: 'organiser', label: 'Organiser', icon: CalendarHeart },
  { key: 'famille', label: 'Famille', icon: Users },
]

function Splash({ children }: { children?: React.ReactNode }) {
  return (
    <div className="fond flex h-full flex-col items-center justify-center px-8 text-center">
      <img src="./panda.webp" alt="" className="anim-flotte h-32 w-32 rounded-[2.2rem] shadow-doux" />
      <p className="titre mt-5 text-[30px]">NIDOO</p>
      {children}
    </div>
  )
}

export default function App() {
  const { status, error, state, retry } = useStore()
  const [tab, setTab] = useState<Tab>('maison')
  const unseen = state ? state.thoughts.filter((t) => t.to_member === state.me.id && !t.seen_at).length : 0

  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-full w-full overflow-hidden bg-creme sm:h-[min(900px,96vh)] sm:max-w-[420px] sm:rounded-[2.6rem] sm:shadow-doux">
        {status === 'loading' && <Splash />}
        {status === 'error' && (
          <Splash>
            <p className="mt-2 max-w-[260px] text-[15px] text-brume">{error}</p>
            <Btn className="mt-6 max-w-[220px]" onClick={retry}>Réessayer</Btn>
          </Splash>
        )}
        {status === 'ready' && !state && <Onboarding />}
        {status === 'ready' && state && (
          <>
            <div className="fond h-full" key={state.family.id}>
              {tab === 'maison' && <Home go={setTab} />}
              {tab === 'moments' && <Moments />}
              {tab === 'jouer' && <Play />}
              {tab === 'organiser' && <Organize />}
              {tab === 'famille' && <Family />}
            </div>

            <nav
              className="absolute inset-x-3 z-30 flex items-center justify-between rounded-[2rem] bg-white/95 px-2 shadow-doux backdrop-blur"
              style={{ bottom: 'calc(var(--sab) + 10px)', height: 66 }}
              aria-label="Navigation principale"
            >
              {TABS.map((t) => {
                const on = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    aria-current={on ? 'page' : undefined}
                    className="appui relative flex h-full flex-1 flex-col items-center justify-center gap-0.5"
                  >
                    <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${on ? 'bg-lavande-100 text-lavande-600' : 'text-brume'}`}>
                      <t.icon size={21} strokeWidth={on ? 2.5 : 2} />
                    </span>
                    <span className={`text-[11px] ${on ? 'font-extrabold text-encre' : 'font-semibold text-brume'}`}>{t.label}</span>
                    {t.key === 'maison' && unseen > 0 && !on && <span className="absolute right-[26%] top-2 h-2.5 w-2.5 rounded-full bg-peche-500 ring-2 ring-white" />}
                  </button>
                )
              })}
            </nav>

            {tab === 'maison' && <Incoming />}
          </>
        )}
        <Toasts />
      </div>
    </div>
  )
}

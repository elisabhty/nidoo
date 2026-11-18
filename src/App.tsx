import { BookHeart, CalendarDays, House as HouseIcon, UsersRound, ChevronLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { DrawingBanner, useUnseenDrawings } from './components/drawing'
import { LiveInvites } from './components/planche'
import Guide from './components/Guide'
import { Incoming } from './components/sheets'
import { ActionSheetHost, Btn, Toasts } from './components/ui'
import { useKeyboardViewport } from './lib/useKeyboardViewport'
import { select } from './lib/haptic'
import { useStore } from './lib/store'
import Family from './screens/Family'
import Home from './screens/Home'
import Dossiers, { type DossiersSeg } from './screens/Folders'
import Onboarding from './screens/Onboarding'
import Organize from './screens/Organize'
import Play from './screens/Play'
import Waiting from './screens/Waiting'

const GUIDE = 'nidoo.guide.vu'

export type Tab = 'maison' | 'moments' | 'organiser' | 'famille'
/** « fil » ouvre l'onglet Dossiers directement sur le fil de la famille. */
export type Go = Tab | 'fil' | 'jouer' | 'recus'

const TABS: { key: Tab; label: string; icon: typeof HouseIcon }[] = [
  { key: 'maison', label: 'Maison', icon: HouseIcon },
  { key: 'moments', label: 'Souvenirs', icon: BookHeart },
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
  const keyboard = useKeyboardViewport()
  const { status, error, state, retry, requests } = useStore()
  const [tab, setTab] = useState<Tab>('maison')
  const [visited, setVisited] = useState<Tab[]>(['maison'])
  const panes = useRef<HTMLDivElement>(null)
  const navigate = (next: Tab) => {
    if(next === tab) {
      const scroll = Array.from(panes.current?.querySelectorAll<HTMLElement>(`[data-tab="${next}"] .no-bar`) ?? []).find(el => el.getClientRects().length > 0 && el.scrollHeight > el.clientHeight)
      scroll?.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'})
    }
    setVisited(current => current.includes(next) ? current : [...current, next])
    setTab(next)
  }
  const [showIncoming, setShowIncoming] = useState(false)
  const [activity, setActivity] = useState(false)
  const [seg, setSeg] = useState<DossiersSeg>('dossiers')
  const go = (g: Go) => {
    if (g === 'recus') {setShowIncoming(true); return}
    if (g === 'jouer') { setActivity(true); return }
    if (g === 'fil') {
      setSeg('fil')
      navigate('moments')
    } else navigate(g)
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
  const drawingsUnseen = useUnseenDrawings(state).length
  const unseen = (state ? state.thoughts.filter((t) => t.to_member === state.me.id && !t.seen_at).length : 0) + drawingsUnseen

  return (
    <div className="flex items-center justify-center" style={{ height: 'var(--app-height, 100%)', transform: keyboard ? 'translateY(var(--app-top, 0px))' : undefined }} data-keyboard={keyboard || undefined}>
      <div className="relative h-full w-full overflow-hidden bg-fond sm:h-[min(880px,96vh)] sm:max-w-[410px] sm:rounded-[48px] sm:shadow-[0_40px_100px_-30px_rgba(29,26,43,0.45)]" style={{maxHeight:'100%'}}>
        {status === 'loading' && <Splash />}
        {status === 'error' && (
          <Splash>
            <p className="mt-6 font-rond text-titre2">Connexion impossible</p>
            <p className="mt-1 max-w-[270px] text-sous text-brume">{error}</p>
            <Btn className="mt-6 max-w-[220px]" onClick={retry}>Réessayer</Btn>
          </Splash>
        )}
        {status === 'ready' && !state && (requests.length ? <Waiting /> : <Onboarding />)}
        {status === 'ready' && state && (
          <>
            <div ref={panes} className="h-full" key={state.family.id}>
              <div id="nidoo-tab-maison" data-tab="maison" hidden={tab !== 'maison'} className="h-full"><Home go={go} active={tab === 'maison'} /></div>
              {visited.includes('moments') && <div id="nidoo-tab-moments" data-tab="moments" hidden={tab !== 'moments'} className="h-full"><Dossiers seg={seg} setSeg={setSeg} /></div>}
              {visited.includes('organiser') && <div id="nidoo-tab-organiser" data-tab="organiser" hidden={tab !== 'organiser'} className="h-full"><Organize /></div>}
              {visited.includes('famille') && <div id="nidoo-tab-famille" data-tab="famille" hidden={tab !== 'famille'} className="h-full"><Family onGuide={() => setGuide(true)} onActivities={() => setActivity(true)} /></div>}
            </div>

            {/* Barre d'onglets flottante en verre */}
            <nav hidden={keyboard} className="ios-tabbar absolute inset-x-5 z-30 flex h-[66px] items-center rounded-full p-1.5" style={{ bottom: 'calc(var(--sab) + 8px)' }} aria-label="Navigation principale">
              <span aria-hidden="true" className="ios-tab-selection" style={{transform:`translateX(${TABS.findIndex(t => t.key === tab) * 100}%)`}} />
              {TABS.map((t) => {
                const on = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      select()
                      navigate(t.key)
                    }}
                    aria-current={on ? 'page' : undefined}
                    aria-controls={`nidoo-tab-${t.key}`}
                    className={`relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-colors duration-200 ${on ? 'text-teinte-fonce' : 'text-encre/60'}`}
                  >
                    <t.icon size={23} strokeWidth={on ? 2.4 : 2} fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.18 : 0} />
                    <span className={`text-[12px] leading-none tracking-normal ${on ? 'font-semibold' : 'font-medium'}`}>{t.label}</span>
                    {((t.key === 'maison' && unseen > 0) || (t.key === 'famille' && state.requests.length > 0)) && !on && (
                      <span className="absolute right-[24%] top-2 h-2.5 w-2.5 rounded-full bg-rouge ring-2 ring-white" />
                    )}
                  </button>
                )
              })}
            </nav>

            {activity && <div className="absolute inset-0 z-40 flex flex-col bg-fond" role="dialog" aria-modal="true" aria-label="À vivre ensemble" style={{paddingTop:'var(--sat)'}}>
              <button onClick={() => setActivity(false)} className="presse flex min-h-[52px] shrink-0 items-center gap-1 px-4 text-corps text-teinte-fonce"><ChevronLeft size={22} />Retour</button>
              <div className="min-h-0 flex-1"><Play /></div>
            </div>}
            {tab === 'maison' && showIncoming && !guide && !activity && <Incoming onClose={() => setShowIncoming(false)} />}
            {tab !== 'maison' && !guide && <DrawingBanner onOpen={() => navigate('maison')} />}
            {guide && <Guide onClose={closeGuide} />}
            <LiveInvites />
          </>
        )}
        <ActionSheetHost />
        <Toasts />
      </div>
    </div>
  )
}

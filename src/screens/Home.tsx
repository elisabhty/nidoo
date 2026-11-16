import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { pettedToday, useCare, usePet } from '../components/care'
import { DecorPage, GoneSheet, useGone } from '../components/decor'
import { DrawingsSheet, DrawSheet, useUnseenDrawings } from '../components/drawing'
import House, { type HouseScene } from '../components/House'
import { useLieux } from '../components/lieux'
import { PetFigure } from '../components/pet'
import { MoodSheet, ThoughtSheet } from '../components/sheets'
import { StarsSheet } from '../components/stars'
import { Art, Avatar } from '../components/ui'
import { moodOf } from '../lib/data'
import { feel, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Drawing, Member } from '../lib/types'
import { greeting, isToday, nextOccurrence, season } from '../lib/util'
import type { Go } from '../App'

type Open =
  | null
  | { k: 'humeur' }
  | { k: 'pensee'; to?: Member }
  | { k: 'dessin'; to?: string | null }
  | { k: 'dessins'; start?: Drawing }
  | { k: 'etoiles' }
  | { k: 'decor'; food?: boolean }

export function upcoming(events: ReturnType<typeof useHome>['state']['events'], limit = 3) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return events
    .map((e) => ({ e, at: nextOccurrence(e.starts_at, e.yearly) }))
    .filter((x) => x.at >= start)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit)
}

const PLAYED = 'nidoo.scenes.jouees'

export default function Home({ go, active = true }: { go: (t: Go) => void; active?: boolean }) {
  const { state } = useHome()
  const [sheet, setSheet] = useState<Open>(null)
  const [scene, setScene] = useState<HouseScene | null>(null)
  const houseRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const { family, me, members, houseItems } = state
  const received = useUnseenDrawings(state)
  const pendingThoughts = state.thoughts.filter(t => t.to_member === me.id && !t.seen_at)
  const nextSender = pendingThoughts[pendingThoughts.length - 1]?.from_member ?? received[0]?.from_member
  const others = members.filter((m) => m.id !== me.id)
  // les photos partagées avec toute la famille (fil et instants), les plus récentes d'abord
  const photos = [
    ...state.moments.filter((m) => m.image_url).map((m) => ({ at: m.created_at, url: m.image_url! })),
    ...state.drawings.filter((d) => !d.to_member && d.photo_url).map((d) => ({ at: d.created_at, url: d.photo_url! })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)
    .map((x) => x.url)
  const now = season()
  const care = useCare(() => setSheet({ k: 'decor', food: true }))
  const petAnimal = usePet()
  const petted = pettedToday(state.starLog, me.id)
  const lieux = useLieux()
  const gone = useGone()
  // Un câlin envoyé ou reçu se joue dans le jardin : l'un va voir l'autre et le fait vraiment.
  useEffect(() => {
    if (!active || scene || sheet) return
    let played: string[] = []
    try {
      played = JSON.parse(localStorage.getItem(PLAYED) ?? '[]') as string[]
    } catch {
      /* rien de mémorisé */
    }
    const t = state.thoughts
      .filter((x) => Date.now() - new Date(x.created_at).getTime() < 15 * 60000 && !played.includes(x.id) && (x.from_member === me.id || (x.to_member === me.id && x.seen_at)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    if (!t) return
    try {
      localStorage.setItem(PLAYED, JSON.stringify([...played, t.id].slice(-60)))
    } catch {
      /* tant pis : la scène pourra se rejouer */
    }
    const r = houseRef.current?.getBoundingClientRect()
    if (r && (r.top < 60 || r.bottom > window.innerHeight - 90)) houseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setScene({ id: t.id, from: t.from_member, to: t.to_member, kind: t.kind })
    const v = window.setTimeout(() => feel(t.kind), 1300)
    return () => window.clearTimeout(v)
  }, [state.thoughts, sheet, scene, me.id, active])

  return (
    <>
      <div className="relative h-full">
        <div
          className={`ios-topbar pointer-events-none absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'ios-toolbar-active' : 'border-b border-transparent'}`}
          style={{ paddingTop: 'var(--sat)' }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-4">
            <button onClick={() => setSheet({ k: 'humeur' })} className="presse pointer-events-auto" aria-label="Mon humeur du jour">
              <Avatar m={me} size={38} mood />
            </button>
            <p className={`absolute inset-x-24 truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>Famille {family.name}</p>
            <button
              onClick={() => {
                tap()
                setSheet({ k: 'etoiles' })
              }}
              className="presse verre pointer-events-auto flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold"
              aria-label={`${family.stars} étoiles : comment en gagner`}
            >
              <Art name="picto-etoile" size={24} /> {family.stars}
            </button>
          </div>
        </div>

        <div
          className="no-bar h-full overflow-y-auto overscroll-contain pb-[120px]"
          style={{ paddingTop: 'calc(var(--sat) + 56px)' }}
          onScroll={(e) => {
            const y = e.currentTarget.scrollTop
            setScrolled(y > 60)
            e.currentTarget.style.setProperty('--par', String(Math.max(0, Math.min(y, 400))))
          }}
        >
          <div className="px-5">
            <p className="text-sous font-medium text-brume">{greeting()} {me.display_name}</p>
            <h1 className="break-words font-rond text-grand">Notre maison</h1>
            <p className="mt-1 text-sous text-brume">Famille {family.name}</p>
          </div>



          {received.length > 0 || pendingThoughts.length > 0 ? <button onClick={() => go('recus')} className="presse mx-5 mt-5 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-[22px] bg-teinte-doux p-4 text-left">
            <Art name="geste-coeur" size={36} /><span className="flex-1"><span className="block text-corps font-semibold">{members.find(m => m.id === nextSender)?.display_name ?? 'Un proche'} pense à toi</span><span className="mt-1 block text-sous text-brume">Découvrir son attention</span></span><ChevronRight size={20} />
          </button> : others.length === 0 ? <div className="mx-5 mt-5 rounded-[24px] bg-white p-5 shadow-carte"><h2 className="font-rond text-titre2">Votre histoire commence ici.</h2><p className="mt-2 text-corps text-brume">Ta maison est prête. Invite un proche pour commencer à vous laisser des attentions.</p></div> : null}

          {/* La maison et les proches restent au cœur de l’accueil. */}
          <div className="mx-4 mt-5">
            <div ref={houseRef} className="overflow-hidden rounded-[22px]">
              <House
                className="!aspect-[16/10]"
                type={family.house_type}
                items={houseItems}
                photos={photos}
                season={now}
                people={members.map((m) => ({ m, mood: isToday(m.mood_at) ? m.mood : null, label: m.id === me.id ? 'Moi' : m.display_name, me: m.id === me.id }))}
                onPerson={(m) => setSheet(m.id === me.id ? { k: 'humeur' } : { k: 'pensee', to: m })}
                scene={scene}
                onSceneEnd={() => setScene(null)}
                cares={state.cares}
                onCare={care}
                since={state.houseSince}
                petted={petted}
                onPet={petAnimal}
                pet={state.pet}
                plots={state.plots}
                gold={state.owned.includes('gamelle:or')}
              />
            </div>
          </div>
          {/* les lieux de la maison : le compagnon, le potager, le centre commercial */}
          <div className="no-bar mt-3 flex gap-2 overflow-x-auto px-5" aria-label="Les lieux de la maison">
            {[
              {
                k: 'compagnon' as const,
                label: state.pet ? state.pet.name : 'Un compagnon',
                icon: state.pet ? <PetFigure pet={state.pet} className="w-[30px]" /> : <img src="./art/pet-chat.webp" alt="" className="h-[30px] w-[30px]" />,
              },
              { k: 'potager' as const, label: 'Le potager', icon: <img src={`./art/${state.plots[0] ? state.plots[0].plant : 'plant-pousse'}.webp`} alt="" className="h-[30px] w-[30px]" /> },
              { k: 'centre' as const, label: 'Centre commercial', icon: <img src="./art/centre-commercial.webp" alt="" className="h-[26px] w-[44px] object-contain" /> },
            ].map((x) => (
              <button
                key={x.k}
                onClick={() => {
                  tap()
                  lieux.open({ k: x.k })
                }}
                className="presse flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white pl-1.5 pr-3.5 text-sous font-semibold shadow-carte"
              >
                {x.icon} {x.label}
              </button>
            ))}
          </div>
          <div className="no-bar mx-5 mt-4 flex gap-5 overflow-x-auto pb-2" aria-label="Les humeurs de la famille">
            {members.map((m) => (
              <button key={m.id} onClick={() => setSheet(m.id === me.id ? { k: 'humeur' } : { k: 'pensee', to: m })} className="presse flex w-[68px] shrink-0 flex-col items-center gap-1">
                <Avatar m={m} size={58} mood />
                <span className="w-full truncate text-sous font-semibold">{m.id === me.id ? 'Moi' : m.display_name}</span>
                <span className="w-full truncate text-note text-brume">{isToday(m.mood_at) && m.mood ? moodOf(m.mood)?.label ?? 'À partager' : m.id === me.id ? 'Mon humeur' : 'Faire signe'}</span>
              </button>
            ))}
          </div>
          <div className="mx-5 mt-4">
            <button onClick={() => others.length ? setSheet({ k: 'dessin' }) : go('famille')} className="presse ios-primary flex min-h-[54px] w-full items-center justify-center rounded-full text-corps font-semibold text-white">{others.length ? 'Créer une attention' : 'Inviter un proche'}</button>

          </div>

          <p className="mx-5 mt-3 text-center text-note text-brume">Touche un proche pour lui faire signe.</p>
          <button onClick={() => go('moments')} className="presse mx-5 mt-5 flex min-h-11 w-[calc(100%-2.5rem)] items-center justify-center gap-2 text-sous text-teinte-fonce">Retrouver nos souvenirs <ChevronRight size={16} /></button>

        </div>
      </div>

      {sheet?.k === 'humeur' && <MoodSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'pensee' && <ThoughtSheet to={sheet.to} onClose={() => setSheet(null)} />}
      {sheet?.k === 'dessin' && <DrawSheet to={sheet.to} onClose={() => setSheet(null)} />}
      {sheet?.k === 'dessins' && <DrawingsSheet start={sheet.start} onClose={() => setSheet(null)} onDraw={(to) => setSheet({ k: 'dessin', to })} />}
      {sheet?.k === 'etoiles' && (
        <StarsSheet
          onClose={() => setSheet(null)}
          onDecorate={() => setSheet({ k: 'decor' })}
        />
      )}
      {sheet?.k === 'decor' && <DecorPage food={sheet.food} onClose={() => setSheet(null)} />}
      {!sheet && gone && (
        <GoneSheet
          entry={gone.entry}
          onClose={gone.seen}
          onAdopt={() => {
            gone.seen()
            if (gone.entry.reason.startsWith('parti:compagnon')) lieux.open({ k: 'compagnon' })
            else setSheet({ k: 'decor' })
          }}
        />
      )}
      {lieux.node}
    </>
  )
}

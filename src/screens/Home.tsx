import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animalMood, BagIcon, careTodo, CareIcon, HandIcon, hungerOf, pettedToday, useCare, usePet } from '../components/care'
import { DecorPage, GoneSheet, useGone } from '../components/decor'
import { DoodleIcon, DrawingsSheet, DrawingWidget, DrawSheet } from '../components/drawing'
import House, { type HouseScene } from '../components/House'
import { JoinRequests } from '../components/requests'
import { eventArt, MoodSheet, ThoughtSheet } from '../components/sheets'
import { StarsSheet } from '../components/stars'
import { Art, Avatar, Lien, Section } from '../components/ui'
import { WeeklyChallenge } from '../components/weekly'
import { ANIMALS, CARE, DECOS, moodOf, questionOfDay } from '../lib/data'
import { feel, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Drawing, Member } from '../lib/types'
import { dayLabel, greeting, isToday, nextOccurrence, season, SEASON_LABEL, timeLabel } from '../lib/util'
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

type Ligne = { key: string; icon: ReactNode; title: string; text: string; act: () => void; tint?: string }

export default function Home({ go }: { go: (t: Go) => void }) {
  const { state, run } = useHome()
  const [sheet, setSheet] = useState<Open>(null)
  const [scene, setScene] = useState<HouseScene | null>(null)
  const houseRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const { family, me, members, houseItems } = state
  const others = members.filter((m) => m.id !== me.id)
  const myMood = isToday(me.mood_at) ? moodOf(me.mood) : null
  const level = houseItems.length + 1
  const nextDeco = DECOS.find((d) => !houseItems.includes(d.key))
  const toGo = nextDeco ? Math.max(0, nextDeco.cost - family.stars) : 0
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
  const todo = careTodo(houseItems, state.cares)
  const animals = ANIMALS.filter((k) => houseItems.includes(k))
  const gone = useGone()
  // Un animal oublié : triste (pas mangé hier), déprimé (deux jours) ; au 4e jour sans repas il s'en va.
  const careText = (k: string) => {
    const c = CARE[k]
    const mood = ANIMALS.includes(k) ? animalMood(hungerOf(k, state.cares, state.houseSince)) : 'bien'
    const Who = c.who.replace(/^./, (x) => x.toUpperCase())
    if (mood === 'deprime') return { text: `${Who} ${c.plural ? 'dépriment' : 'déprime'} : demain, ${c.plural ? 'ils partent' : 'il part'}`, tint: 'text-rouge' }
    if (mood === 'triste') return { text: `${Who} ${c.plural ? 'sont tristes' : 'est triste'} : pas mangé hier`, tint: 'text-peche-fonce' }
    return { text: `${c.need} · +${c.stars} étoile${c.stars > 1 ? 's' : ''} pour la maison` }
  }
  // On s'occupe du chat depuis la liste : la maison revient à l'écran pour voir le « +3 ».
  const careFromList = (key: string) => {
    const r = houseRef.current?.getBoundingClientRect()
    if (r && (r.top < 60 || r.bottom > window.innerHeight - 90)) houseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => care(key), r && (r.top < 60 || r.bottom > window.innerHeight - 90) ? 450 : 0)
  }

  // Un câlin envoyé ou reçu se joue dans le jardin : l'un va voir l'autre et le fait vraiment.
  useEffect(() => {
    if (scene || sheet) return
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
  }, [state.thoughts, sheet, scene, me.id])
  const home = members.filter((m) => isToday(m.mood_at))

  // ── Aujourd'hui en famille : ce qui compte maintenant, dans une seule liste.
  const cared = (m: Member) => state.thoughts.some((t) => t.from_member === me.id && t.to_member === m.id && isToday(t.created_at))
  const low = others.find((m) => isToday(m.mood_at) && ['triste', 'stresse', 'fatigue'].includes(m.mood ?? '') && !cared(m))
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 2)
  const soon = upcoming(state.events, 4).filter((x) => x.at < tomorrow).slice(0, 2)
  const missions = state.items.filter((i) => i.kind === 'tache' && !i.done && (!i.assigned_to || i.assigned_to === me.id)).slice(0, 3)
  const answered = state.answers.some((a) => a.member_id === me.id)
  const today: Ligne[] = [
    ...(low
      ? [{ key: 'low', icon: <img src="./panda.webp" alt="" className="h-10 w-10 rounded-[12px]" />, title: `${low.display_name} a une petite mine`, text: 'Envoie-lui un câlin, ça prend une seconde', act: () => setSheet({ k: 'pensee', to: low }) }]
      : []),
    ...todo.map((k) => ({
      key: `soin-${k}`,
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-teinte-doux">
          <CareIcon k={k} size={28} />
        </span>
      ),
      title: CARE[k].verb,
      ...careText(k),
      act: () => careFromList(k),
    })),
    ...(animals.length && family.food <= 2
      ? [
          {
            key: 'croquettes',
            icon: (
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-peche-doux">
                <BagIcon size={28} empty={family.food === 0} />
              </span>
            ),
            title: family.food ? `Plus que ${family.food} repas de croquettes` : 'Plus de croquettes',
            text: 'Un sac de 10 repas : 15 étoiles',
            tint: family.food ? undefined : 'text-rouge',
            act: () => setSheet({ k: 'decor', food: true }),
          },
        ]
      : []),
    ...(animals.length && !petted && !animals.some((k) => todo.includes(k))
      ? [
          {
            key: 'caresse',
            icon: (
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#FFE4EC]">
                <HandIcon size={30} />
              </span>
            ),
            title: `Caresser ${CARE[animals[0]].who}`,
            text: 'Une caresse par jour · +1 étoile',
            act: () => {
              houseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              window.setTimeout(() => houseRef.current?.querySelector<HTMLButtonElement>('button[aria-label^="Caresser"]')?.click(), 500)
            },
          },
        ]
      : []),
    ...(!myMood ? [{ key: 'humeur', icon: <Art name="humeur-heureux" size={40} />, title: 'Partager mon humeur', text: 'Ta famille voit comment tu te sens', act: () => setSheet({ k: 'humeur' }) }] : []),
    ...soon.map(({ e, at }) => ({
      key: e.id,
      icon: <Art name={eventArt(e.kind)} size={40} />,
      title: e.title,
      text: `${dayLabel(at)}${e.all_day ? '' : ` · ${timeLabel(at)}`} · ${whoText(e.members, members, me.id)}`,
      act: () => go('organiser'),
      tint: dayLabel(at) === 'Aujourd’hui' ? 'text-peche-fonce' : undefined,
    })),
    ...missions.map((i) => ({
      key: i.id,
      icon: <span className="mx-[7px] block h-[26px] w-[26px] rounded-full border-[1.5px] border-pale" />,
      title: i.title,
      text: 'Mission du jour · +1 étoile',
      act: () => {
        success()
        void run((api) => api.toggleItem(i, me.id), 'Mission accomplie, 1 étoile gagnée')
      },
    })),
    ...(!answered ? [{ key: 'question', icon: <Art name="picto-bulle" size={40} />, title: questionOfDay().text, text: 'Question du jour · +2 étoiles', act: () => go('jouer') }] : []),
  ]

  const tiles = [
    { label: 'Un câlin', icon: <Art name="geste-calin" size={52} />, on: () => setSheet({ k: 'pensee' }) },
    {
      label: 'Créer une attention',
      icon: (
        <span className="relative block h-[52px] w-[64px]">
          <Art name="picto-photo" size={50} className="absolute left-0 top-0" />
          <span className="absolute -bottom-0.5 right-0">
            <DoodleIcon size={30} />
          </span>
        </span>
      ),
      on: () => setSheet({ k: 'dessin' }),
    },
  ]

  return (
    <>
      <div className="relative h-full">
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'border-b border-trait bg-fond/80 backdrop-blur-2xl backdrop-saturate-150' : 'border-b border-transparent'}`}
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
            <button onClick={() => go('famille')} className="presse mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce">Famille {family.name}<ChevronRight size={16} /></button>
          </div>



          {/* Notre petit monde : la maison, son niveau et la prochaine surprise */}
          <div className="mx-4 mt-5">
            <div ref={houseRef} className="overflow-hidden rounded-[22px]">
              <House
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
              />
            </div>
          </div>
          <div className="no-bar mx-5 mt-5 flex gap-5 overflow-x-auto pb-2" aria-label="Les humeurs de la famille">
            {members.map((m) => (
              <button key={m.id} onClick={() => setSheet(m.id === me.id ? { k: 'humeur' } : { k: 'pensee', to: m })} className="presse flex w-[68px] shrink-0 flex-col items-center gap-1">
                <Avatar m={m} size={58} mood />
                <span className="w-full truncate text-sous font-semibold">{m.id === me.id ? 'Moi' : m.display_name}</span>
                <span className="w-full truncate text-note text-brume">{isToday(m.mood_at) && m.mood ? moodOf(m.mood)?.label ?? 'À partager' : 'Mon humeur'}</span>
              </button>
            ))}
          </div>
          <div className="mx-5 mt-4">
            <button onClick={() => setSheet({ k: 'dessin' })} className="presse flex min-h-[54px] w-full items-center justify-center rounded-full bg-teinte text-corps font-semibold text-white">Créer une attention</button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => setSheet({ k: 'humeur' })} className="presse min-h-[50px] rounded-[18px] bg-teinte-doux text-sous font-semibold text-teinte-fonce">Mon humeur</button>
              <button onClick={() => setSheet({ k: 'pensee' })} className="presse min-h-[50px] rounded-[18px] bg-teinte-doux text-sous font-semibold text-teinte-fonce">Un câlin</button>
            </div>
          </div>

          <button onClick={() => setSheet({ k: 'decor' })} className="presse mx-5 mt-4 flex min-h-11 items-center gap-2 text-sous text-teinte-fonce">Décorer notre maison <ChevronRight size={16} /></button>
          {state.requests.length > 0 && <button onClick={() => go('famille')} className="presse mx-5 mt-2 min-h-11 text-sous text-brume">{state.requests.length} demande(s) à examiner <ChevronRight className="inline" size={16} /></button>}
          <Section title="Aujourd’hui en famille" action={<Lien onClick={() => go('organiser')}>Voir tout</Lien>}>
            <div className="groupe mx-4 shadow-carte">
              {today.length === 0 && <p className="px-4 py-4 text-sous text-brume">Rien de prévu aujourd’hui. Profitez-en !</p>}
              {today.map((l, i) => (
                <button
                  key={l.key}
                  onClick={() => {
                    tap()
                    l.act()
                  }}
                  className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left"
                >
                  <span className="flex w-10 shrink-0 justify-center">{l.icon}</span>
                  <span className={`flex min-h-[62px] min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 ${i < today.length - 1 ? 'border-b border-trait' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-corps font-semibold">{l.title}</span>
                      <span className={`block truncate text-note ${l.tint ?? 'text-brume'}`}>{l.text}</span>
                    </span>
                    <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <WeeklyChallenge className="mt-6" />

          <Section
            title="Créer une attention"
            hint="Une photo, un dessin, ou les deux : elle apparaît en direct chez un proche ou toute la famille."
            action={state.drawings.length ? <Lien onClick={() => setSheet({ k: 'dessins' })}>Tout voir</Lien> : undefined}
          >
            <div className="px-4">
              <DrawingWidget onOpen={(d) => setSheet({ k: 'dessins', start: d })} onDraw={() => setSheet({ k: 'dessin' })} />
            </div>
          </Section>
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
      {!sheet && gone && <GoneSheet entry={gone.entry} onClose={gone.seen} onAdopt={() => (gone.seen(), setSheet({ k: 'decor' }))} />}
    </>
  )
}

/** « Le chat a faim et les fleurs ont soif : touche-les pour t’en occuper. » */
function careHint(keys: string[]) {
  const parts = keys.map((k) => CARE[k].need.replace(' attendent leurs graines', ' ont faim'))
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1].replace(/^L/, 'l')}` : parts[0]
  return `${list.replace(/, L/g, ', l')} : touche-${keys.length > 1 ? 'les' : keys[0] === 'potager' || keys[0] === 'chat' ? 'le' : 'les'} pour t’en occuper.`
}

/** « toute la famille », « Léa et toi », « Papa, Léa et Noé » */
function whoText(ids: string[] | undefined, members: Member[], meId: string) {
  const names = members.filter((m) => ids?.includes(m.id)).map((m) => (m.id === meId ? 'toi' : m.display_name))
  if (!names.length) return 'toute la famille'
  const mine = names.indexOf('toi')
  if (mine > -1) names.push(names.splice(mine, 1)[0])
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0]
}

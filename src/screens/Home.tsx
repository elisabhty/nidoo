import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DoodleIcon, DrawingsSheet, DrawingWidget, DrawSheet } from '../components/drawing'
import House, { type HouseScene } from '../components/House'
import { JoinRequests } from '../components/requests'
import { ComposeSheet, eventArt, MoodSheet, ThoughtSheet } from '../components/sheets'
import { StarsSheet } from '../components/stars'
import { Art, Avatar, Lien, Section } from '../components/ui'
import { WeeklyChallenge } from '../components/weekly'
import { DECOS, moodOf, questionOfDay } from '../lib/data'
import { feel, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Drawing, Member } from '../lib/types'
import { dayLabel, greeting, isToday, nextOccurrence, season, SEASON_LABEL, timeLabel } from '../lib/util'
import type { Go } from '../App'

type Open =
  | null
  | { k: 'humeur' }
  | { k: 'photo' }
  | { k: 'pensee'; to?: Member }
  | { k: 'dessin'; to?: string | null }
  | { k: 'dessins'; start?: Drawing }
  | { k: 'etoiles' }

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
  const photos = state.moments.filter((m) => m.image_url).slice(0, 6).map((m) => m.image_url!)
  const now = season()

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
    ...(!myMood ? [{ key: 'humeur', icon: <Art name="humeur-heureux" size={40} />, title: 'Partager mon humeur', text: 'Ta famille voit comment tu te sens', act: () => setSheet({ k: 'humeur' }) }] : []),
    ...soon.map(({ e, at }) => ({
      key: e.id,
      icon: <Art name={eventArt(e.kind)} size={40} />,
      title: e.title,
      text: `${dayLabel(at)}${e.all_day ? '' : ` · ${timeLabel(at)}`} · toute la famille`,
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
    { label: 'Un câlin', icon: <Art name="geste-calin" size={50} />, on: () => setSheet({ k: 'pensee' }) },
    { label: 'Une photo', icon: <Art name="picto-photo" size={50} />, on: () => setSheet({ k: 'photo' }) },
    { label: 'Un dessin', icon: <DoodleIcon size={44} />, on: () => setSheet({ k: 'dessin' }) },
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
            <h1 className="break-words font-rond text-grand">Famille {family.name}</h1>
          </div>

          <JoinRequests className="mt-3" />

          {/* Notre petit monde : la maison, son niveau et la prochaine surprise */}
          <div className="groupe mx-4 mt-4 p-3 shadow-carte">
            <div className="flex items-center justify-between px-1.5 pb-2.5 pt-0.5">
              <p className="font-rond text-titre3">Notre petit monde</p>
              <span className="flex items-center gap-1.5">
                <span className="rounded-full bg-remplissage px-2.5 py-1 text-legende font-semibold text-brume">{SEASON_LABEL[now]}</span>
                <span className="rounded-full bg-teinte-doux px-2.5 py-1 text-legende font-semibold text-teinte-fonce">Niveau {level}</span>
              </span>
            </div>
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
              />
            </div>
            <p className="px-1.5 pt-2 text-note text-brume">
              {home.length === members.length ? 'Tout le monde a partagé son humeur aujourd’hui. ' : home.length ? `${home.length} sur ${members.length} ont partagé leur humeur aujourd’hui. ` : ''}
              Touche un proche pour lui envoyer un câlin{myMood ? '.' : ', ou toi pour partager ton humeur.'}
            </p>
            <button
              onClick={() => {
                tap()
                go('jouer')
              }}
              className="presse block w-full px-1.5 pb-1 pt-3 text-left"
            >
              <span className="flex items-center justify-between gap-2 text-sous font-medium">
                <span className="min-w-0 flex-1">
                  {!nextDeco
                    ? 'Votre maison est complète, bravo à toute la famille !'
                    : toGo > 0
                      ? `Plus que ${toGo} étoile${toGo > 1 ? 's' : ''} avant la prochaine surprise`
                      : `De quoi installer une nouvelle décoration : ${nextDeco.name}`}
                </span>
                <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />
              </span>
              {nextDeco && (
                <span className="mt-2 block h-[7px] overflow-hidden rounded-full bg-remplissage">
                  <span className="block h-full rounded-full bg-teinte transition-[width] duration-700" style={{ width: `${Math.min(100, (family.stars / nextDeco.cost) * 100)}%` }} />
                </span>
              )}
              <span className="mt-1.5 block text-note text-brume">Chaque petit geste embellit votre maison.</span>
            </button>
          </div>

          {/* les trois gestes du quotidien */}
          <div className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
            {tiles.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  tap()
                  t.on()
                }}
                className="presse groupe flex h-[104px] flex-col items-center justify-center gap-1.5 shadow-carte"
              >
                <span className="flex h-[52px] items-center">{t.icon}</span>
                <span className="text-sous font-semibold">{t.label}</span>
              </button>
            ))}
          </div>

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
            title="Dessin en direct"
            hint="Il arrive chez un proche et se dessine sous ses yeux."
            action={state.drawings.length ? <Lien onClick={() => setSheet({ k: 'dessins' })}>Tout voir</Lien> : undefined}
          >
            <div className="px-4">
              <DrawingWidget onOpen={(d) => setSheet({ k: 'dessins', start: d })} onDraw={() => setSheet({ k: 'dessin' })} />
            </div>
          </Section>
        </div>
      </div>

      {sheet?.k === 'humeur' && <MoodSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'photo' && <ComposeSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'pensee' && <ThoughtSheet to={sheet.to} onClose={() => setSheet(null)} />}
      {sheet?.k === 'dessin' && <DrawSheet to={sheet.to} onClose={() => setSheet(null)} />}
      {sheet?.k === 'dessins' && <DrawingsSheet start={sheet.start} onClose={() => setSheet(null)} onDraw={(to) => setSheet({ k: 'dessin', to })} />}
      {sheet?.k === 'etoiles' && (
        <StarsSheet
          onClose={() => setSheet(null)}
          onDecorate={() => {
            setSheet(null)
            go('jouer')
          }}
        />
      )}
    </>
  )
}

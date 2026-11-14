import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import House from '../components/House'
import { ComposeSheet, eventArt, MoodSheet, ThoughtSheet } from '../components/sheets'
import { Art, Avatar, Lien, Section } from '../components/ui'
import { DECOS, moodOf, questionOfDay } from '../lib/data'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Member } from '../lib/types'
import { ago, dayLabel, greeting, isToday, nextOccurrence, timeLabel } from '../lib/util'
import type { Tab } from '../App'

type Open = null | { k: 'humeur' } | { k: 'photo' } | { k: 'mot' } | { k: 'pensee'; to?: Member }

export function upcoming(events: ReturnType<typeof useHome>['state']['events'], limit = 3) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return events
    .map((e) => ({ e, at: nextOccurrence(e.starts_at, e.yearly) }))
    .filter((x) => x.at >= start)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit)
}

export default function Home({ go }: { go: (t: Tab) => void }) {
  const { state, run } = useHome()
  const [sheet, setSheet] = useState<Open>(null)
  const [scrolled, setScrolled] = useState(false)
  const { family, me, members } = state
  const others = members.filter((m) => m.id !== me.id)
  const myMood = isToday(me.mood_at) ? moodOf(me.mood) : null
  const next = upcoming(state.events)
  const last = state.moments[0]
  const lastBy = last && members.find((m) => m.id === last.member_id)
  const missions = state.items.filter((i) => i.kind === 'tache' && !i.done && (!i.assigned_to || i.assigned_to === me.id)).slice(0, 3)
  const answered = state.answers.some((a) => a.member_id === me.id)
  const level = state.houseItems.length + 1
  const home = members.filter((m) => isToday(m.mood_at))

  // Ce que dit Nidoo : un proche qui a besoin d'une attention passe avant le reste.
  const cared = (m: Member) => state.thoughts.some((t) => t.from_member === me.id && t.to_member === m.id && isToday(t.created_at))
  const low = others.find((m) => isToday(m.mood_at) && ['triste', 'stresse', 'fatigue'].includes(m.mood ?? '') && !cared(m))
  const soon = next.find((x) => (x.at.getTime() - Date.now()) / 3600000 < 36)
  const nidoo: { title: string; text: string; act?: () => void } = low
    ? { title: `${low.display_name} a une petite mine`, text: 'Envoie-lui un câlin, ça prend une seconde.', act: () => setSheet({ k: 'pensee', to: low }) }
    : !myMood
      ? { title: 'Quelle est ta météo ?', text: 'Dis à ta famille comment tu vas aujourd’hui.', act: () => setSheet({ k: 'humeur' }) }
      : soon
        ? { title: soon.e.title, text: `${dayLabel(soon.at)}${soon.e.all_day ? '' : ` à ${timeLabel(soon.at)}`}`, act: () => go('organiser') }
        : { title: 'La maison est paisible', text: 'Rien à signaler, profitez de la journée.' }

  const actions = [
    { label: 'Photo', art: 'picto-photo', on: () => setSheet({ k: 'photo' }) },
    { label: 'Pensée', art: 'geste-coeur', on: () => setSheet({ k: 'pensee' }) },
    { label: myMood ? myMood.label : 'Météo', art: `humeur-${myMood ? myMood.key : 'heureux'}`, on: () => setSheet({ k: 'humeur' }) },
    { label: 'Petit mot', art: 'geste-mot', on: () => setSheet({ k: 'mot' }) },
  ]

  return (
    <>
      <div className="relative h-full">
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'border-b border-trait bg-fond/80 backdrop-blur-2xl backdrop-saturate-150' : 'border-b border-transparent'}`}
          style={{ paddingTop: 'var(--sat)' }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-4">
            <button onClick={() => setSheet({ k: 'humeur' })} className="presse pointer-events-auto" aria-label="Ma météo du jour">
              <Avatar m={me} size={38} mood />
            </button>
            <p className={`absolute inset-x-24 truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>Famille {family.name}</p>
            <button onClick={() => go('jouer')} className="presse verre pointer-events-auto flex h-10 items-center gap-1.5 rounded-full pl-2 pr-3.5 text-appel font-semibold" aria-label={`${family.stars} étoiles`}>
              <Art name="picto-etoile" size={24} /> {family.stars}
            </button>
          </div>
        </div>

        <div className="no-bar h-full overflow-y-auto overscroll-contain pb-[120px]" style={{ paddingTop: 'calc(var(--sat) + 56px)' }} onScroll={(e) => {
            const y = e.currentTarget.scrollTop
            setScrolled(y > 60)
            e.currentTarget.style.setProperty('--par', String(Math.max(0, Math.min(y, 400))))
          }}
        >
          <div className="px-5">
            <p className="text-sous font-medium text-brume">{greeting()} {me.display_name}</p>
            <h1 className="break-words font-rond text-grand">Famille {family.name}</h1>
          </div>

          <button
            onClick={() => {
              tap()
              nidoo.act?.()
            }}
            disabled={!nidoo.act}
            className="presse groupe mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 p-2.5 pr-3.5 text-left shadow-carte"
          >
            <img src="./panda.webp" alt="" className="h-[52px] w-[52px] rounded-[15px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-appel font-semibold">{nidoo.title}</span>
              <span className="block truncate text-note text-brume">{nidoo.text}</span>
            </span>
            {nidoo.act && <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />}
          </button>

          <div className="mt-4 grid grid-cols-4 gap-2.5 px-4">
            {actions.map((a) => (
              <button
                key={a.art + a.label}
                onClick={() => {
                  tap()
                  a.on()
                }}
                className="presse groupe flex flex-col items-center gap-1 px-1 pb-2.5 pt-3 shadow-carte"
              >
                <Art name={a.art} size={42} />
                <span className="w-full truncate text-center text-legende font-medium">{a.label}</span>
              </button>
            ))}
          </div>

          <div className="mx-4 mt-4 overflow-hidden rounded-[28px] bg-carte shadow-carte">
            <House type={family.house_type} items={state.houseItems} />
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex -space-x-2">
                {(home.length ? home : members).slice(0, 4).map((m) => (
                  <span key={m.id} className={`rounded-full ring-2 ring-white ${home.length ? '' : 'opacity-45'}`}>
                    <Avatar m={m} size={30} />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sous font-semibold">Niveau {level}</p>
                <p className="truncate text-note text-brume">{state.houseItems.length} décoration{state.houseItems.length > 1 ? 's' : ''} sur {DECOS.length}</p>
              </div>
              <button onClick={() => go('jouer')} className="presse h-9 shrink-0 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce">
                Décorer
              </button>
            </div>
          </div>

          <Section title="Nos humeurs">
            <div className="no-bar flex gap-2.5 overflow-x-auto px-4 pb-1">
              {members.map((m) => {
                const md = isToday(m.mood_at) ? moodOf(m.mood) : null
                const mine = m.id === me.id
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      tap()
                      setSheet(mine ? { k: 'humeur' } : { k: 'pensee', to: m })
                    }}
                    className="presse groupe flex w-[118px] shrink-0 flex-col items-center px-2.5 pb-3 pt-3.5 text-center shadow-carte"
                  >
                    <Avatar m={m} size={56} mood />
                    <span className="mt-2 w-full truncate text-sous font-semibold">{mine ? 'Moi' : m.display_name}</span>
                    <span className={`w-full truncate text-note ${md ? 'text-teinte' : 'text-pale'}`}>{md ? md.label : mine ? 'Dire ma météo' : 'Pas de nouvelles'}</span>
                    {md && m.mood_note && <span className="mt-1 line-clamp-2 text-legende text-brume">{m.mood_note}</span>}
                  </button>
                )
              })}
            </div>
          </Section>

          {last && lastBy && (
            <Section title="Notre instant" action={<Lien onClick={() => go('moments')}>Tout voir</Lien>}>
              <button onClick={() => go('moments')} className="presse groupe mx-4 block w-[calc(100%-2rem)] text-left shadow-carte">
                {last.image_url && <img src={last.image_url} alt={last.body ?? `Photo de ${lastBy.display_name}`} className="aspect-[4/3] w-full object-cover" />}
                <div className="flex items-center gap-3 p-3.5">
                  <Avatar m={lastBy} size={40} />
                  <div className="min-w-0">
                    {last.body && <p className="line-clamp-2 text-appel">{last.body}</p>}
                    <p className="text-note text-brume">{lastBy.display_name} · {ago(last.created_at)}</p>
                  </div>
                </div>
              </button>
            </Section>
          )}

          <Section title="À venir" action={<Lien onClick={() => go('organiser')}>Agenda</Lien>}>
            <div className="groupe mx-4 shadow-carte">
              {next.length === 0 && (
                <button onClick={() => go('organiser')} className="presse-ligne w-full px-4 py-4 text-left text-sous text-brume">
                  Rien de prévu. Ajoute un anniversaire ou un dîner de famille.
                </button>
              )}
              {next.map(({ e, at }, i) => (
                <div key={e.id} className="flex items-center gap-3 pl-3.5">
                  <Art name={eventArt(e.kind)} size={36} />
                  <div className={`min-w-0 flex-1 py-2.5 pr-4 ${i < next.length - 1 ? 'border-b border-trait' : ''}`}>
                    <p className="truncate text-corps">{e.title}</p>
                    <p className={`text-note ${dayLabel(at) === 'Aujourd’hui' ? 'font-semibold text-peche-fonce' : 'text-brume'}`}>
                      {dayLabel(at)}{e.all_day ? '' : ` · ${timeLabel(at)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Nos missions" action={<Lien onClick={() => go('jouer')}>Jouer</Lien>}>
            <div className="groupe mx-4 shadow-carte">
              {!answered && (
                <button onClick={() => go('jouer')} className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left">
                  <Art name="picto-bulle" size={36} />
                  <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 ${missions.length ? 'border-b border-trait' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-corps">{questionOfDay().text}</span>
                      <span className="block text-note text-teinte">Question du jour · 2 étoiles</span>
                    </span>
                    <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />
                  </span>
                </button>
              )}
              {missions.map((i, k) => (
                <button
                  key={i.id}
                  onClick={() => {
                    success()
                    void run((api) => api.toggleItem(i, me.id), 'Mission accomplie, 1 étoile gagnée')
                  }}
                  className="presse-ligne flex w-full items-center gap-3 pl-4 text-left"
                >
                  <span className="h-[24px] w-[24px] shrink-0 rounded-full border-[1.5px] border-pale" />
                  <span className={`min-w-0 flex-1 truncate py-3.5 pr-4 text-corps ${k < missions.length - 1 ? 'border-b border-trait' : ''}`}>{i.title}</span>
                </button>
              ))}
              {answered && missions.length === 0 && <p className="px-4 py-4 text-sous text-brume">Tout est fait pour aujourd’hui.</p>}
            </div>
          </Section>
        </div>
      </div>

      {sheet?.k === 'humeur' && <MoodSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'photo' && <ComposeSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'mot' && <ComposeSheet startWith="mot" onClose={() => setSheet(null)} />}
      {sheet?.k === 'pensee' && <ThoughtSheet to={sheet.to} onClose={() => setSheet(null)} />}
    </>
  )
}

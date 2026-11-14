import { Camera, CloudSun, Heart, PenLine, Sparkles, Star } from 'lucide-react'
import { useState } from 'react'
import House from '../components/House'
import { ComposeSheet, eventEmoji, MoodSheet, ThoughtSheet } from '../components/sheets'
import { Avatar, Lien, Section } from '../components/ui'
import { DECOS, moodOf, questionOfDay } from '../lib/data'
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
  const { family, me, members } = state
  const others = members.filter((m) => m.id !== me.id)
  const myMood = isToday(me.mood_at) ? moodOf(me.mood) : null
  const next = upcoming(state.events)
  const last = state.moments[0]
  const lastBy = last && members.find((m) => m.id === last.member_id)
  const missions = state.items.filter((i) => i.kind === 'tache' && !i.done && (!i.assigned_to || i.assigned_to === me.id)).slice(0, 3)
  const answered = state.answers.some((a) => a.member_id === me.id)
  const level = state.houseItems.length + 1
  const lit = members.filter((m) => isToday(m.mood_at)).length

  // Ce que dit Nidoo : un proche qui a besoin d'une attention passe avant le reste.
  const cared = (m: Member) => state.thoughts.some((t) => t.from_member === me.id && t.to_member === m.id && isToday(t.created_at))
  const low = others.find((m) => isToday(m.mood_at) && ['triste', 'stresse', 'fatigue'].includes(m.mood ?? '') && !cared(m))
  const soon = next.find((x) => (x.at.getTime() - Date.now()) / 3600000 < 36)
  const bubble: { text: string; act?: () => void } = low
    ? { text: `${low.display_name} a une petite mine. Un câlin ?`, act: () => setSheet({ k: 'pensee', to: low }) }
    : !myMood
      ? { text: `${greeting()} ${me.display_name} ! Quelle est ta météo ?`, act: () => setSheet({ k: 'humeur' }) }
      : soon
        ? { text: `${dayLabel(soon.at)} : ${soon.e.title}`, act: () => go('organiser') }
        : { text: `${greeting()} ${me.display_name} ! La maison est paisible.` }

  const actions = [
    { label: 'Photo surprise', icon: Camera, on: () => setSheet({ k: 'photo' }) },
    { label: 'On pense à toi', icon: Heart, on: () => setSheet({ k: 'pensee' }) },
    { label: myMood ? `${myMood.emoji} ${myMood.label}` : 'Ma météo', icon: myMood ? null : CloudSun, on: () => setSheet({ k: 'humeur' }) },
    { label: 'Petit mot', icon: PenLine, on: () => setSheet({ k: 'mot' }) },
  ]

  return (
    <>
      <div className="no-bar h-full overflow-y-auto pb-32" style={{ paddingTop: 'calc(var(--sat) + 10px)' }}>
        <div className="flex items-center justify-between px-5">
          <button onClick={() => setSheet({ k: 'humeur' })} className="appui" aria-label="Ma météo du jour">
            <Avatar m={me} size={44} mood />
          </button>
          <button onClick={() => go('jouer')} className="appui flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[15px] font-extrabold shadow-carte" aria-label={`${family.stars} étoiles`}>
            <Star size={17} className="fill-[#F6B93B] text-[#F6B93B]" /> {family.stars}
          </button>
        </div>

        <div className="relative mt-3 flex min-h-[132px] items-end justify-between px-5">
          <h1 className="titre pb-2 text-[34px] leading-[1.05]">
            Famille
            <br />
            <span className="break-words">{family.name}</span>
          </h1>
          <button onClick={bubble.act} disabled={!bubble.act} className="relative mb-1 flex shrink-0 flex-col items-end" aria-label={bubble.text}>
            <span className="anim-pop relative mb-2 max-w-[172px] rounded-2xl rounded-br-md bg-encre px-3.5 py-2 text-left text-[13.5px] font-bold leading-snug text-white">
              {bubble.text}
            </span>
            <img src="./panda.webp" alt="" className="anim-flotte h-[84px] w-[84px] rounded-[1.6rem] shadow-doux" />
          </button>
        </div>

        <div className="no-bar mt-4 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {actions.map((a) => (
            <button key={a.label} onClick={a.on} className="appui flex h-11 shrink-0 items-center gap-2 rounded-full border border-lavande-200 bg-white/80 px-4 text-[14.5px] font-bold text-encre">
              {a.icon && <a.icon size={17} className="text-lavande-500" />}
              {a.label}
            </button>
          ))}
        </div>

        <div className="mx-5 mt-4 overflow-hidden rounded-4xl bg-white shadow-doux">
          <House type={family.house_type} members={members} items={state.houseItems} className="block w-full" />
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[15px] font-extrabold">Niveau {level}</p>
              <p className="text-[13px] text-brume">
                {state.houseItems.length}/{DECOS.length} décorations · {lit} fenêtre{lit > 1 ? 's' : ''} allumée{lit > 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={() => go('jouer')} className="appui flex h-10 items-center gap-1.5 rounded-full bg-lavande-100 px-4 text-[14px] font-extrabold text-lavande-600">
              <Sparkles size={16} /> Décorer
            </button>
          </div>
        </div>

        <Section title="Nos humeurs">
          <div className="no-bar flex gap-3 overflow-x-auto px-5 pb-1">
            {members.map((m) => {
              const md = isToday(m.mood_at) ? moodOf(m.mood) : null
              const mine = m.id === me.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSheet(mine ? { k: 'humeur' } : { k: 'pensee', to: m })}
                  className="appui carte flex w-[124px] shrink-0 flex-col items-center px-2.5 pb-3 pt-3.5 text-center"
                >
                  <Avatar m={m} size={54} mood />
                  <span className="mt-2 w-full truncate text-[14px] font-extrabold">{mine ? 'Moi' : m.display_name}</span>
                  <span className={`text-[12.5px] font-bold ${md ? 'text-lavande-600' : 'text-brume/70'}`}>{md ? md.label : mine ? 'Dire ma météo' : 'Pas de nouvelles'}</span>
                  {md && m.mood_note && <span className="mt-1 line-clamp-2 text-[11.5px] leading-tight text-brume">« {m.mood_note} »</span>}
                </button>
              )
            })}
          </div>
        </Section>

        {last && lastBy && (
          <Section title="Notre instant" action={<Lien onClick={() => go('moments')}>Tout voir</Lien>}>
            <button onClick={() => go('moments')} className="appui carte mx-5 block w-[calc(100%-2.5rem)] overflow-hidden text-left">
              {last.image_url && <img src={last.image_url} alt={last.body ?? `Photo de ${lastBy.display_name}`} className="aspect-[4/3] w-full object-cover" />}
              <div className="flex items-center gap-3 p-3.5">
                <Avatar m={lastBy} size={38} />
                <div className="min-w-0">
                  {last.body && <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{last.body}</p>}
                  <p className="text-[12.5px] text-brume">{lastBy.display_name} · {ago(last.created_at)}</p>
                </div>
              </div>
            </button>
          </Section>
        )}

        <Section title="À venir" action={<Lien onClick={() => go('organiser')}>Agenda</Lien>}>
          <div className="mx-5 space-y-2">
            {next.length === 0 && (
              <button onClick={() => go('organiser')} className="carte w-full px-4 py-4 text-left text-[14.5px] text-brume">
                Rien de prévu. Ajoute un anniversaire ou un dîner de famille.
              </button>
            )}
            {next.map(({ e, at }) => (
              <div key={e.id} className={`flex items-center gap-3 rounded-3xl px-3.5 py-3 ${dayLabel(at) === 'Aujourd’hui' ? 'bg-peche-100' : 'bg-white shadow-carte'}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-creme text-[20px]">{eventEmoji(e.kind)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-titre text-[16px] font-semibold">{e.title}</p>
                  <p className="text-[13px] text-brume">{dayLabel(at)}{e.all_day ? '' : ` · ${timeLabel(at)}`}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Nos missions" action={<Lien onClick={() => go('jouer')}>Jouer</Lien>}>
          <div className="mx-5 space-y-2">
            {!answered && (
              <button onClick={() => go('jouer')} className="appui flex w-full items-center gap-3 rounded-3xl bg-lavande-100 px-3.5 py-3 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[20px]">💬</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-extrabold text-lavande-600">Question du jour · +2 étoiles</span>
                  <span className="block truncate text-[15px] font-bold">{questionOfDay().text}</span>
                </span>
              </button>
            )}
            {missions.map((i) => (
              <button
                key={i.id}
                onClick={() => run((api) => api.toggleItem(i, me.id), 'Mission accomplie, +1 étoile')}
                className="appui carte flex w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <span className="h-6 w-6 shrink-0 rounded-full border-2 border-lavande-300" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{i.title}</span>
              </button>
            ))}
            {answered && missions.length === 0 && <p className="carte px-4 py-4 text-[14.5px] text-brume">Tout est fait pour aujourd’hui. Profitez-en.</p>}
          </div>
        </Section>
      </div>

      {sheet?.k === 'humeur' && <MoodSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'photo' && <ComposeSheet onClose={() => setSheet(null)} />}
      {sheet?.k === 'mot' && <ComposeSheet startWith="mot" onClose={() => setSheet(null)} />}
      {sheet?.k === 'pensee' && <ThoughtSheet to={sheet.to} onClose={() => setSheet(null)} />}
    </>
  )
}

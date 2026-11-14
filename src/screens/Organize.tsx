import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { EventSheet, eventArt } from '../components/sheets'
import { Art, Avatar, Btn, confirmer, Rond, Screen, Segments, Vide } from '../components/ui'
import { select, success } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { ListKind } from '../lib/types'
import { dayLabel, nextOccurrence, timeLabel } from '../lib/util'

type Seg = 'agenda' | 'course' | 'tache'

function Liste({ kind }: { kind: ListKind }) {
  const { state, run } = useHome()
  const { me, members, family } = state
  const [title, setTitle] = useState('')
  const [to, setTo] = useState<string | null>(null)
  const items = state.items.filter((i) => i.kind === kind)
  const todo = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const tache = kind === 'tache'

  const add = async () => {
    const t = title.trim()
    if (!t) return
    setTitle('')
    await run((api) => api.addItem(family.id, me.id, kind, t, tache ? to : null))
  }

  return (
    <>
      <form
        className="groupe mx-4 flex items-center gap-3 pl-4 pr-2 shadow-carte"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Plus size={22} strokeWidth={2.4} className="shrink-0 text-teinte" />
        <input className="h-[50px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-pale" placeholder={tache ? 'Nouvelle mission' : 'Ajouter un article'} maxLength={80} enterKeyHint="done" value={title} onChange={(e) => setTitle(e.target.value)} />
        {title.trim() && <button type="submit" className="presse h-9 rounded-full bg-teinte px-4 text-sous font-semibold text-white">Ajouter</button>}
      </form>
      {tache && (
        <div className="no-bar mt-2.5 flex gap-2 overflow-x-auto px-4">
          <button
            onClick={() => {
              select()
              setTo(null)
            }}
            aria-pressed={to === null}
            className={`h-9 shrink-0 rounded-full px-3.5 text-sous font-medium ${to === null ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
          >
            Pour tous
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                select()
                setTo(m.id)
              }}
              aria-pressed={to === m.id}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3.5 text-sous font-medium ${to === m.id ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
            >
              <Avatar m={m} size={28} /> {m.id === me.id ? 'Moi' : m.display_name}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <Vide
          art={tache ? 'picto-missions' : 'picto-courses'}
          title={tache ? 'Aucune mission' : 'La liste est vide'}
          text={tache ? 'Chaque mission terminée rapporte une étoile à la maison.' : 'Tout le monde la voit et peut cocher en direct au magasin.'}
        />
      )}

      {todo.length > 0 && (
        <div className="groupe mx-4 mt-4 shadow-carte">
          {todo.map((i, k) => {
            const who = members.find((m) => m.id === i.assigned_to)
            return (
              <div key={i.id} className="flex items-center gap-3 pl-4">
                <button
                  onClick={() => {
                    success()
                    void run((api) => api.toggleItem(i, me.id), tache ? 'Mission accomplie, 1 étoile gagnée' : undefined)
                  }}
                  className="presse -m-2 p-2"
                  aria-label={`Cocher ${i.title}`}
                >
                  <span className="block h-[24px] w-[24px] rounded-full border-[1.5px] border-pale" />
                </button>
                <div className={`flex min-h-[50px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 ${k < todo.length - 1 ? 'border-b border-trait' : ''}`}>
                  <span className="min-w-0 flex-1 text-corps">{i.title}</span>
                  {who && <Avatar m={who} size={28} />}
                  <button onClick={() => run((api) => api.deleteItem(i.id))} className="presse px-1.5 text-sous text-pale" aria-label={`Supprimer ${i.title}`}>
                    Retirer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="mt-6 flex items-baseline justify-between px-5">
            <p className="entete !px-0">{tache ? 'Terminées' : 'Dans le panier'}</p>
            <button
              onClick={() =>
                run(async (api) => {
                  for (const d of done) await api.deleteItem(d.id)
                })
              }
              className="presse text-sous text-teinte"
            >
              Tout effacer
            </button>
          </div>
          <div className="groupe mx-4 shadow-carte">
            {done.map((i, k) => (
              <button key={i.id} onClick={() => run((api) => api.toggleItem(i, me.id))} className="presse-ligne flex w-full items-center gap-3 pl-4 text-left">
                <span className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-teinte text-white"><Check size={15} strokeWidth={3.2} /></span>
                <span className={`min-w-0 flex-1 py-3.5 pr-4 text-corps text-pale line-through ${k < done.length - 1 ? 'border-b border-trait' : ''}`}>{i.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default function Organize() {
  const { state, run } = useHome()
  const [seg, setSeg] = useState<Seg>('agenda')
  const [adding, setAdding] = useState(false)

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const coming = state.events
    .map((e) => ({ e, at: nextOccurrence(e.starts_at, e.yearly) }))
    .filter((x) => x.at >= start)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  const groups = new Map<string, typeof coming>()
  for (const x of coming) {
    const k = x.at.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    groups.set(k, [...(groups.get(k) ?? []), x])
  }

  return (
    <>
      <Screen title="Organiser" trailing={seg === 'agenda' ? <Rond label="Nouvel événement" tint onClick={() => setAdding(true)}><Plus size={21} strokeWidth={2.4} /></Rond> : undefined}>
        <p className="-mt-1 px-5 text-sous text-brume">
          {seg === 'agenda' ? 'Les dates importantes, visibles par toute la famille.' : seg === 'course' ? 'Une liste commune : chacun ajoute et coche en direct.' : 'Les petites tâches de la maison. Assigne-les à quelqu’un ou à tout le monde.'}
        </p>
        <div className="mx-4 mb-4 mt-3">
          <Segments value={seg} onChange={setSeg} options={[{ key: 'agenda', label: 'Agenda' }, { key: 'course', label: 'Courses' }, { key: 'tache', label: 'Missions' }]} />
        </div>

        {seg === 'agenda' ? (
          coming.length === 0 ? (
            <Vide art="picto-agenda" title="L’agenda est libre" text="Anniversaires, rendez-vous, dîners : tout le monde les verra au même endroit.">
              <Btn onClick={() => setAdding(true)}>Nouvel événement</Btn>
            </Vide>
          ) : (
            [...groups.entries()].map(([month, list]) => (
              <div key={month} className="mb-6">
                <p className="entete">{month}</p>
                <div className="groupe mx-4 shadow-carte">
                  {list.map(({ e, at }, k) => {
                    const today = dayLabel(at) === 'Aujourd’hui'
                    return (
                      <button
                        key={e.id}
                        onClick={async () => (await confirmer({ title: e.title, message: `${dayLabel(at)}${e.yearly ? ', chaque année' : ''}`, confirm: 'Supprimer l’événement', destructive: true })) && run((api) => api.deleteEvent(e.id))}
                        className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left"
                      >
                        <span className="flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[12px] bg-fond leading-none">
                          <span className={`text-[10px] font-semibold uppercase ${today ? 'text-peche-fonce' : 'text-rouge'}`}>{at.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
                          <span className="mt-0.5 font-rond text-[19px] font-semibold">{at.getDate()}</span>
                        </span>
                        <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3.5 ${k < list.length - 1 ? 'border-b border-trait' : ''}`}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-corps">{e.title}</span>
                            <span className={`block text-note ${today ? 'font-semibold text-peche-fonce' : 'text-brume'}`}>
                              {dayLabel(at)}{e.all_day ? '' : ` · ${timeLabel(at)}`}{e.yearly ? ' · chaque année' : ''}
                            </span>
                          </span>
                          <Art name={eventArt(e.kind)} size={30} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )
        ) : (
          <Liste key={seg} kind={seg} />
        )}
      </Screen>
      {adding && <EventSheet onClose={() => setAdding(false)} />}
    </>
  )
}

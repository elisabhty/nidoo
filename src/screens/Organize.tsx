import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EventSheet, eventEmoji } from '../components/sheets'
import { Avatar, Segments, Vide } from '../components/ui'
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
    <div className="px-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input className="champ flex-1" placeholder={tache ? 'Nouvelle mission…' : 'Ajouter un article…'} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" disabled={!title.trim()} className="appui flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-encre text-white disabled:opacity-40" aria-label="Ajouter">
          <Plus size={22} />
        </button>
      </form>
      {tache && (
        <div className="no-bar -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5">
          <button onClick={() => setTo(null)} aria-pressed={to === null} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${to === null ? 'bg-lavande-200 text-encre' : 'bg-white text-brume shadow-carte'}`}>
            Pour tout le monde
          </button>
          {members.map((m) => (
            <button key={m.id} onClick={() => setTo(m.id)} aria-pressed={to === m.id} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-[13px] font-bold ${to === m.id ? 'bg-lavande-200 text-encre' : 'bg-white text-brume shadow-carte'}`}>
              <Avatar m={m} size={28} /> {m.id === me.id ? 'Moi' : m.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <div className="-mx-5">
            <Vide
              emoji={tache ? '🧹' : '🧺'}
              title={tache ? 'Aucune mission' : 'La liste est vide'}
              text={tache ? 'Chaque mission terminée rapporte une étoile à la maison.' : 'Tout le monde la voit et peut cocher en direct au magasin.'}
            />
          </div>
        )}
        {todo.map((i) => {
          const who = members.find((m) => m.id === i.assigned_to)
          return (
            <div key={i.id} className="carte flex items-center gap-3 py-2 pl-3.5 pr-2">
              <button onClick={() => run((api) => api.toggleItem(i, me.id), tache ? 'Mission accomplie, +1 étoile' : undefined)} className="appui h-7 w-7 shrink-0 rounded-full border-2 border-lavande-300" aria-label={`Cocher ${i.title}`} />
              <span className="min-w-0 flex-1 py-1.5 text-[15.5px] font-bold leading-snug">{i.title}</span>
              {who && <Avatar m={who} size={28} />}
              <button onClick={() => run((api) => api.deleteItem(i.id))} className="flex h-9 w-9 items-center justify-center text-brume/60" aria-label={`Supprimer ${i.title}`}>
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
        {done.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-3">
              <p className="text-[13px] font-extrabold text-brume">{tache ? 'Terminées' : 'Dans le panier'} ({done.length})</p>
              <button onClick={() => run(async (api) => { for (const d of done) await api.deleteItem(d.id) })} className="text-[13px] font-bold text-lavande-600">
                Tout effacer
              </button>
            </div>
            {done.map((i) => (
              <button key={i.id} onClick={() => run((api) => api.toggleItem(i, me.id))} className="flex w-full items-center gap-3 rounded-3xl bg-white/60 px-3.5 py-3 text-left">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavande-300 text-white"><Check size={16} strokeWidth={3} /></span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold text-brume line-through">{i.title}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default function Organize() {
  const { state, run } = useHome()
  const [seg, setSeg] = useState<Seg>('agenda')
  const [adding, setAdding] = useState(false)

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const all = state.events.map((e) => ({ e, at: nextOccurrence(e.starts_at, e.yearly) }))
  const coming = all.filter((x) => x.at >= start).sort((a, b) => a.at.getTime() - b.at.getTime())
  const groups = new Map<string, typeof coming>()
  for (const x of coming) {
    const k = x.at.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    groups.set(k, [...(groups.get(k) ?? []), x])
  }

  return (
    <>
      <div className="no-bar h-full overflow-y-auto pb-32" style={{ paddingTop: 'calc(var(--sat) + 14px)' }}>
        <div className="flex items-end justify-between px-5">
          <h1 className="titre text-[32px] leading-none">Organiser</h1>
          {seg === 'agenda' && (
            <button onClick={() => setAdding(true)} className="appui flex h-11 items-center gap-1.5 rounded-full bg-encre px-4 text-[14.5px] font-bold text-white shadow-doux">
              <Plus size={18} /> Ajouter
            </button>
          )}
        </div>
        <div className="mx-5 mt-4">
          <Segments value={seg} onChange={setSeg} options={[{ key: 'agenda', label: 'Agenda' }, { key: 'course', label: 'Courses' }, { key: 'tache', label: 'Missions' }]} />
        </div>

        <div className="mt-5">
          {seg === 'agenda' ? (
            coming.length === 0 ? (
              <Vide emoji="🗓️" title="L’agenda est libre" text="Anniversaires, rendez-vous, dîners : tout le monde les verra au même endroit." />
            ) : (
              [...groups.entries()].map(([month, list]) => (
                <div key={month} className="mb-5 px-5">
                  <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-brume">{month}</p>
                  <div className="space-y-2">
                    {list.map(({ e, at }) => (
                      <div key={e.id} className={`flex items-center gap-3 rounded-3xl py-2.5 pl-3 pr-1.5 ${dayLabel(at) === 'Aujourd’hui' ? 'bg-peche-100' : 'bg-white shadow-carte'}`}>
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-creme leading-none">
                          <span className="text-[10.5px] font-extrabold uppercase text-peche-500">{at.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
                          <span className="font-titre text-[19px] font-semibold">{at.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-titre text-[16.5px] font-semibold">{eventEmoji(e.kind)} {e.title}</p>
                          <p className="text-[13px] text-brume">
                            {dayLabel(at)}{e.all_day ? '' : ` · ${timeLabel(at)}`}{e.yearly ? ' · chaque année' : ''}
                          </p>
                        </div>
                        <button onClick={() => window.confirm(`Supprimer « ${e.title} » ?`) && run((api) => api.deleteEvent(e.id))} className="flex h-10 w-10 items-center justify-center text-brume/60" aria-label={`Supprimer ${e.title}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            <Liste key={seg} kind={seg} />
          )}
        </div>
      </div>
      {adding && <EventSheet onClose={() => setAdding(false)} />}
    </>
  )
}

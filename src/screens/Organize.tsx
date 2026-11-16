import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { MemberStack } from '../components/folder'
import { EventDetailSheet, EventSheet, eventArt } from '../components/sheets'
import { Art, Avatar, Btn, Rond, Screen, Segments, Vide } from '../components/ui'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { FamEvent, ListKind } from '../lib/types'
import { dayLabel, nextOccurrence, timeLabel, todayKey } from '../lib/util'

type Seg = 'agenda' | 'course' | 'tache'
type Vue = 'liste' | 'semaine'
type Ouvert = { e: FamEvent; at: Date }

/** Lundi de la semaine de d (à minuit). */
function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}
/** L'événement tombe-t-il ce jour-là ? (les anniversaires reviennent chaque année) */
function occursOn(e: FamEvent, day: Date): Date | null {
  const d = new Date(e.starts_at)
  if (e.yearly ? d.getMonth() === day.getMonth() && d.getDate() === day.getDate() && day.getFullYear() >= d.getFullYear() : todayKey(d) === todayKey(day)) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), d.getHours(), d.getMinutes())
  }
  return null
}

function Semaine({ onOpen, onAdd }: { onOpen: (o: Ouvert) => void; onAdd: (day: Date) => void }) {
  const { state } = useHome()
  const [offset, setOffset] = useState(0)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const monday = mondayOf(new Date())
  monday.setDate(monday.getDate() + offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
  const today = todayKey()
  const byDay = days.map((day) =>
    state.events
      .map((e) => ({ e, at: occursOn(e, day) }))
      .filter((x): x is Ouvert => !!x.at)
      .sort((a, b) => Number(b.e.all_day) - Number(a.e.all_day) || a.at.getTime() - b.at.getTime()),
  )
  const sunday = days[6]
  const range =
    monday.getMonth() === sunday.getMonth()
      ? `${monday.getDate()} – ${sunday.getDate()} ${sunday.toLocaleDateString('fr-FR', { month: 'long' })}`
      : `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  const total = byDay.reduce((n, l) => n + l.length, 0)

  return (
    <>
      <div className="groupe mx-4 p-3 shadow-carte">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              select()
              setOffset((o) => o - 1)
            }}
            className="presse flex h-9 w-9 items-center justify-center rounded-full text-teinte"
            aria-label="Semaine précédente"
          >
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>
          <div className="text-center">
            <p className="text-corps font-semibold">{offset === 0 ? 'Cette semaine' : offset === 1 ? 'La semaine prochaine' : offset === -1 ? 'La semaine dernière' : range}</p>
            <p className="text-note text-brume">
              {offset === 0 || Math.abs(offset) === 1 ? `${range} · ` : ''}
              {total ? `${total} événement${total > 1 ? 's' : ''}` : 'Rien de prévu'}
            </p>
          </div>
          <button
            onClick={() => {
              select()
              setOffset((o) => o + 1)
            }}
            className="presse flex h-9 w-9 items-center justify-center rounded-full text-teinte"
            aria-label="Semaine suivante"
          >
            <ChevronRight size={22} strokeWidth={2.4} />
          </button>
        </div>
        {/* les 7 jours, avec un point par événement */}
        <div className="mt-2.5 grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const k = todayKey(day)
            const now = k === today
            return (
              <button
                key={k}
                onClick={() => {
                  tap()
                  refs.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="presse flex flex-col items-center gap-1 rounded-[14px] py-1.5"
                aria-label={`${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}, ${byDay[i].length || 'aucun'} événement${byDay[i].length > 1 ? 's' : ''}`}
              >
                <span className={`text-legende font-semibold uppercase ${now ? 'text-teinte' : 'text-brume'}`}>{day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full font-rond text-[17px] font-semibold ${now ? 'bg-teinte text-white' : ''}`}>{day.getDate()}</span>
                <span className="flex h-[6px] items-center gap-[3px]">
                  {byDay[i].slice(0, 3).map((x) => (
                    <span key={x.e.id} className={`h-[6px] w-[6px] rounded-full ${x.e.kind === 'anniversaire' ? 'bg-peche' : x.e.kind === 'rdv' ? 'bg-[#3E9BE9]' : 'bg-teinte'}`} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        {offset !== 0 && (
          <button onClick={() => setOffset(0)} className="presse mx-auto mt-1 block text-sous font-medium text-teinte">
            Revenir à aujourd’hui
          </button>
        )}
      </div>

      {/* la semaine entière, jour par jour */}
      <div className="mt-4 space-y-3">
        {days.map((day, i) => {
          const k = todayKey(day)
          const now = k === today
          const past = k < today
          const list = byDay[i]
          return (
            <div key={k} ref={(el) => void (refs.current[k] = el)} className="scroll-mt-[110px]">
              <div className="flex items-center justify-between px-5 pb-1.5">
                <p className={`text-sous font-semibold ${now ? 'text-teinte' : past ? 'text-pale' : 'text-brume'}`}>
                  {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())}
                  {now && ' · aujourd’hui'}
                </p>
                {!past && (
                <button
                  onClick={() => {
                    tap()
                    onAdd(day)
                  }}
                  className="presse -mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-teinte"
                  aria-label={`Ajouter un événement le ${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                >
                  <Plus size={19} strokeWidth={2.5} />
                </button>
                )}
              </div>
              {list.length ? (
                <div className={`groupe mx-4 shadow-carte ${past ? 'opacity-60' : ''}`}>
                  {list.map(({ e, at }, n) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        tap()
                        onOpen({ e, at })
                      }}
                      className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left"
                    >
                      <Art name={eventArt(e.kind)} size={34} />
                      <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3.5 ${n < list.length - 1 ? 'border-b border-trait' : ''}`}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-corps">{e.title}</span>
                          <span className="block truncate text-note text-brume">
                            {e.all_day ? 'Toute la journée' : timeLabel(at)}
                            {e.description ? ` · ${e.description}` : ''}
                          </span>
                        </span>
                        {!!e.members?.length && <MemberStack ids={e.members} size={26} max={3} />}
                        <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={`mx-4 rounded-[18px] border border-dashed border-trait px-4 py-2.5 text-sous text-pale ${past ? 'opacity-60' : ''}`}>Rien de prévu</p>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Liste({ kind }: { kind: ListKind }) {
  const { state, run } = useHome()
  const { me, members, family } = state
  const [title, setTitle] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [to, setTo] = useState<string | null>(null)
  const items = state.items.filter((i) => i.kind === kind)
  const todo = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const tache = kind === 'tache'

  const add = async () => {
    const t = title.trim()
    if (!t || addingItem) return
    setAddingItem(true)
    const added = await run((api) => api.addItem(family.id, me.id, kind, t, tache ? to : null))
    if (added) setTitle((current) => current.trim() === t ? '' : current)
    setAddingItem(false)
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
        <input aria-label={tache ? 'Nouvelle mission' : 'Ajouter un article'} className="h-[54px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-brume" placeholder={tache ? 'Nouvelle mission' : 'Ajouter un article'} maxLength={80} enterKeyHint="done" value={title} onChange={(e) => setTitle(e.target.value)} />
        {title.trim() && <button type="submit" disabled={addingItem} className="presse min-h-11 disabled:opacity-50 rounded-full bg-teinte px-4 text-sous font-semibold text-white">{addingItem ? 'Ajout…' : 'Ajouter'}</button>}
      </form>
      {tache && (
        <div className="no-bar mt-2.5 flex gap-2 overflow-x-auto px-4">
          <button
            onClick={() => {
              select()
              setTo(null)
            }}
            aria-pressed={to === null}
            className={`min-h-11 shrink-0 rounded-full px-3.5 text-sous font-medium ${to === null ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
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
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3.5 text-sous font-medium ${to === m.id ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
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

      <p className="mx-5 mt-5 text-note font-semibold text-brume" role="status">{todo.length} {tache ? `mission${todo.length > 1 ? 's' : ''} à faire` : `article${todo.length > 1 ? 's' : ''} à prendre`}{done.length > 0 ? ` · ${done.length} ${tache ? `terminée${done.length > 1 ? 's' : ''}` : 'dans le panier'}` : ''}</p>
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
                  <button onClick={() => run((api) => api.deleteItem(i.id))} className="presse min-h-11 px-2 text-note text-brume" aria-label={`Supprimer ${i.title}`}>
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
  const { state } = useHome()
  const [seg, setSeg] = useState<Seg>('agenda')
  const [vue, setVue] = useState<Vue>('liste')
  const [adding, setAdding] = useState<{ day?: Date } | null>(null)
  const [open, setOpen] = useState<Ouvert | null>(null)

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
      <Screen title="Organiser" trailing={seg === 'agenda' ? <Rond label="Nouvel événement" tint onClick={() => setAdding({})}><Plus size={21} strokeWidth={2.4} /></Rond> : undefined}>
        <p className="-mt-1 px-5 text-sous text-brume">
          {seg === 'agenda' ? 'Moins de choses à retenir, plus de temps ensemble.' : seg === 'course' ? 'Une liste commune : chacun ajoute et coche en direct.' : 'Les petites tâches de la maison. Assigne-les à quelqu’un ou à tout le monde.'}
        </p>
        <div className="mx-4 mb-4 mt-3">
          <Segments value={seg} onChange={setSeg} options={[{ key: 'agenda', label: 'Agenda' }, { key: 'course', label: 'Courses' }, { key: 'tache', label: 'Missions' }]} />
        </div>

        {seg === 'agenda' && <div className="mx-5 mb-5"><Btn onClick={() => setAdding({})}>Ajouter un événement</Btn></div>}
        {seg === 'agenda' && (
          <div className="-mt-1 mb-4 flex gap-2 px-4">
            {(
              [
                ['liste', 'À venir'],
                ['semaine', 'Semaine'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  select()
                  setVue(k)
                }}
                aria-pressed={vue === k}
                className={`min-h-11 rounded-full px-4 text-sous font-medium ${vue === k ? 'bg-encre text-white' : 'bg-carte text-encre shadow-carte'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {seg === 'agenda' && vue === 'semaine' ? (
          <Semaine onOpen={setOpen} onAdd={(day) => setAdding({ day })} />
        ) : seg === 'agenda' ? (
          coming.length === 0 ? (
            <Vide art="picto-agenda" title="L’agenda est libre" text="Anniversaires, rendez-vous, dîners : tout le monde les verra au même endroit.">
              <Btn onClick={() => setAdding({})}>Nouvel événement</Btn>
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
                        onClick={() => {
                          tap()
                          setOpen({ e, at })
                        }}
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
                            {e.description && <span className="block truncate text-note text-brume">{e.description}</span>}
                          </span>
                          {e.members?.length ? <MemberStack ids={e.members} size={28} max={3} /> : <Art name={eventArt(e.kind)} size={30} />}
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
      {adding && <EventSheet day={adding.day} onClose={() => setAdding(null)} />}
      {open && <EventDetailSheet key={open.e.id} event={state.events.find((x) => x.id === open.e.id) ?? open.e} at={open.at} onClose={() => setOpen(null)} />}
    </>
  )
}

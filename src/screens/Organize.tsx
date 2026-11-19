import { ListPages, useListPage } from '../components/listNavigation'
import { Check, ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { MemberStack } from '../components/folder'
import { EventDetailSheet, EventSheet, EventIcon, TYPES_AGENDA } from '../components/sheets'
import { Art, Avatar, Rond, Screen, Segments, Vide } from '../components/ui'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { EventKind, FamEvent, ListItem, ListKind } from '../lib/types'
import { dayLabel, errorText, finDe, nextOccurrence, occursOn, rythme, timeLabel, todayKey } from '../lib/util'

type Seg = 'agenda' | 'course' | 'tache'
type Vue = 'liste' | 'semaine'
type Ouvert = { e: FamEvent; at: Date }

/** Lundi de la semaine de d (à minuit). */
function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
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
                      <EventIcon event={e} size={34} className="shrink-0" />
                      <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3.5 ${n < list.length - 1 ? 'border-b border-trait' : ''}`}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-corps">{e.title}</span>
                          <span className="block truncate text-note text-brume">
                            {e.all_day ? (rythme(e, at) && !e.weekly ? rythme(e, at) : 'Toute la journée') : timeLabel(at)}
                            {e.weekly ? ' · chaque semaine' : ''}
                            {e.lieu ? ` · ${e.lieu}` : e.description ? ` · ${e.description}` : ''}
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

/** Idées pour les courses, en un toucher (celles déjà dans la liste ne sont pas proposées). */
const IDEES_COURSES = ['Pain', 'Lait', 'Œufs', 'Fruits', 'Légumes', 'Beurre', 'Fromage', 'Yaourts', 'Café', 'Pâtes', 'Riz', 'Papier toilette', 'Lessive']

/** Le rond à cocher (il saute un peu quand on coche). */
function Coche({ fait }: { fait: boolean }) {
  return fait ? (
    <span className="anim-pop flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-teinte text-white">
      <Check size={16} strokeWidth={3.2} />
    </span>
  ) : (
    <span className="block h-[26px] w-[26px] shrink-0 rounded-full border-2 border-pale" />
  )
}

/** Une ligne qu'on fait glisser vers la gauche pour la retirer (et qu'on peut toujours toucher pour cocher). */
function Glisse({ children, onRetirer, label }: { children: ReactNode; onRetirer: () => void; label: string }) {
  const [dx, setDx] = useState(0)
  const [part, setPart] = useState(false)
  const depart = useRef<{ x: number; y: number; actif: boolean } | null>(null)
  const aGlisse = useRef(false) // un glissé n'est pas un toucher : on ne coche pas en lâchant
  const fini = () => {
    if (dx < -90) {
      select()
      setPart(true)
      window.setTimeout(onRetirer, 180)
    } else setDx(0)
    depart.current = null
  }
  return (
    <div className={`relative overflow-hidden transition-[max-height,opacity] duration-200 ${part ? 'max-h-0 opacity-0' : 'max-h-[120px]'}`}>
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-rouge pr-5 text-sous font-semibold text-white" style={{ width: Math.max(0, -dx) + 8 }} aria-hidden="true">
        {dx < -40 && 'Retirer'}
      </div>
      <div
        className="relative bg-carte"
        style={{ transform: `translateX(${part ? -400 : dx}px)`, transition: depart.current?.actif ? 'none' : 'transform 0.2s ease', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          depart.current = { x: e.clientX, y: e.clientY, actif: false }
          aGlisse.current = false
        }}
        onPointerMove={(e) => {
          const d = depart.current
          if (!d) return
          const mx = e.clientX - d.x
          if (!d.actif && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(e.clientY - d.y)) {
            d.actif = true
            aGlisse.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          if (d.actif) setDx(Math.min(0, Math.max(-220, mx)))
        }}
        onPointerUp={() => (depart.current?.actif ? fini() : (depart.current = null))}
        onPointerCancel={() => {
          depart.current = null
          setDx(0)
        }}
        onClickCapture={(e) => {
          if (aGlisse.current) {
            aGlisse.current = false
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        {children}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

/**
 * Les courses et les choses à faire. Tout répond tout de suite : la ligne se coche, s'ajoute ou part à l'écran
 * pendant que l'enregistrement se fait en arrière-plan (en cas d'erreur, elle revient comme avant).
 */
function Liste({ kind }: { kind: ListKind }) {
  const { state, api, reload, toast } = useHome()
  const { me, members, family } = state
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState(false)
  const [to, setTo] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const tache = kind === 'tache'
  const [filtre, setFiltre] = useState('toutes')
  // ce qu'on vient de faire, affiché sans attendre le serveur
  const [ajouts, setAjouts] = useState<(ListItem & { connus: Set<string> })[]>([])
  const [changes, setChanges] = useState<Record<string, { done?: boolean; parti?: boolean }>>({})
  const champ = useRef<HTMLInputElement>(null)

  const reels = state.items.filter((i) => i.kind === kind)
  const enAttente = ajouts.filter((a) => !reels.some((i) => !a.connus.has(i.id) && i.title === a.title))
  const items = [
    ...reels
      .filter((i) => !changes[i.id]?.parti)
      .map((i) => (changes[i.id]?.done !== undefined ? { ...i, done: changes[i.id].done!, done_by: changes[i.id].done ? me.id : null } : i)),
    ...enAttente,
  ]
  const todo = items.filter((i) => !i.done)
  if (tache) todo.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const done = items.filter((i) => i.done)
  const choisies = filtre === 'terminees' ? done : todo.filter((i) => filtre === 'toutes' || (filtre === 'moi' ? i.assigned_to === me.id : filtre === 'libres' ? !i.assigned_to : !!i.assigned_to && i.assigned_to !== me.id))
  const navigation = useListPage(choisies, 5, kind + filtre)
  const todoVisible = tache ? (filtre === 'terminees' ? [] : navigation.visible) : todo
  const doneVisible = tache ? (filtre === 'terminees' ? navigation.visible : []) : done
  const idees = tache ? [] : IDEES_COURSES.filter((x) => !todo.some((i) => i.title.toLowerCase() === x.toLowerCase())).slice(0, 8)

  /** Enregistre en arrière-plan ; en cas d'échec on remet comme avant. */
  const fond = async (op: () => Promise<unknown>, annuler: () => void, apres: () => void) => {
    try {
      await op()
    } catch (e) {
      annuler()
      toast(errorText(e), 'err')
      return
    }
    await reload().catch(() => undefined)
    apres()
  }
  const oublier = (id: string) =>
    setChanges((c) => {
      const n = { ...c }
      delete n[id]
      return n
    })

  const ajouter = (texte?: string) => {
    const t = (texte ?? title).trim().slice(0, 80)
    if (!t) return
    tap()
    if (!texte) setTitle('')
    const tmp = { id: `attente-${Date.now()}-${Math.random()}`, family_id: family.id, kind, title: t, done: false, done_by: null, assigned_to: tache ? to : null, created_by: me.id, created_at: new Date().toISOString(), connus: new Set(state.items.map((i) => i.id)) }
    setAjouts((a) => [...a, tmp])
    if (tache) { setFiltre('toutes'); navigation.setPage(1) }
    const pour = tache ? to : null
    if (tache) { setTo(null); setAssigning(false) } // la tâche suivante repart « pour tous » : pas de mauvaise personne par erreur
    champ.current?.focus()
    void fond(
      () => api.addItem(family.id, me.id, kind, t, pour),
      () => {
        setAjouts((a) => a.filter((x) => x.id !== tmp.id))
        if (!texte) setTitle(t)
      },
      () => setAjouts((a) => a.filter((x) => x.id !== tmp.id)),
    )
  }
  const basculer = (i: ListItem) => {
    if (i.id.startsWith('attente-')) return
    const fait = !i.done
    if (fait) success()
    else tap()
    setChanges((c) => ({ ...c, [i.id]: { ...c[i.id], done: fait } }))
    if (tache && fait) toast('C’est fait ✓')
    void fond(
      () => api.toggleItem(i, me.id),
      () => oublier(i.id),
      () => oublier(i.id),
    )
  }
  const retirer = (ids: string[]) => {
    const vrais = ids.filter((id) => !id.startsWith('attente-'))
    setChanges((c) => ({ ...c, ...Object.fromEntries(vrais.map((id) => [id, { ...c[id], parti: true }])) }))
    void fond(
      async () => {
        for (const id of vrais) await api.deleteItem(id)
      },
      () => vrais.forEach(oublier),
      () => vrais.forEach(oublier),
    )
  }

  return (
    <>
      <form
        className="groupe mx-4 flex items-center gap-3 pl-4 pr-2 shadow-carte"
        onSubmit={(e) => {
          e.preventDefault()
          ajouter()
        }}
      >
        <Plus size={22} strokeWidth={2.4} className="shrink-0 text-teinte" />
        <input
          ref={champ}
          aria-label={tache ? 'Ajouter une chose à faire' : 'Ajouter un article'}
          className="h-[54px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-brume"
          placeholder={tache ? 'Ajouter une chose à faire' : 'Ajouter un article'}
          maxLength={80}
          enterKeyHint="done"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {title.trim() && (
          <button type="submit" className="presse anim-pop min-h-11 rounded-full bg-teinte px-4 text-sous font-semibold text-white">
            Ajouter
          </button>
        )}
      </form>
      {/* courses : des idées en un toucher ; à faire : attribution facultative */}
      {idees.length > 0 && (
        <div className="no-bar mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Idées à ajouter">
          {idees.map((x) => (
            <button key={x} onClick={() => ajouter(x)} className="presse flex min-h-[38px] shrink-0 items-center gap-1 rounded-full bg-carte px-3.5 text-sous font-medium text-encre shadow-carte">
              <Plus size={14} strokeWidth={2.6} className="text-teinte" /> {x}
            </button>
          ))}
        </div>
      )}
      {tache && <button onClick={() => setAssigning(v => !v)} aria-expanded={assigning} className="presse mx-5 mt-2 flex min-h-11 items-center gap-1 text-sous font-medium text-teinte-fonce">{to ? `Pour ${members.find(m => m.id === to)?.display_name ?? 'un proche'}` : 'Attribuer à un proche (facultatif)'}<ChevronRight size={16} className={assigning ? 'rotate-90' : ''} /></button>}
      {tache && assigning && (
        <div className="no-bar mt-1 flex gap-2 overflow-x-auto px-4">
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
          title={tache ? 'Rien à faire pour l’instant' : 'La liste est vide'}
          text={tache ? 'Ajoute les choses à ne pas oublier, puis coche-les au fur et à mesure.' : 'Tout le monde la voit et peut cocher en direct au magasin.'}
        />
      )}

      {items.length > 0 && (
        <div className="mx-5 mt-4 flex min-h-11 items-center justify-between gap-3">
          <p className="text-note font-semibold text-brume" role="status">
            {todo.length} {tache ? `chose${todo.length > 1 ? 's' : ''} à faire` : `article${todo.length > 1 ? 's' : ''} à prendre`}
            {done.length > 0 ? ` · ${done.length} ${tache ? `terminée${done.length > 1 ? 's' : ''}` : 'dans le panier'}` : ''}
          </p>
          <button onClick={() => setEditing((v) => !v)} className="presse min-h-11 text-sous font-semibold text-teinte-fonce">
            {editing ? 'Terminé' : 'Modifier'}
          </button>
        </div>
      )}
      {tache && <div role="group" aria-label="Filtrer les tâches" className="no-bar mx-4 mt-3 mb-3 flex gap-1.5 overflow-x-auto">
        {[['toutes', 'À faire'], ['moi', 'Pour moi'], ['autres', 'Pour les autres'], ['libres', 'Sans responsable'], ['terminees', 'Terminées']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filtre === id} onClick={() => setFiltre(id)} className={`presse min-h-11 shrink-0 rounded-full px-3 text-note font-semibold ${filtre === id ? 'bg-teinte text-white' : 'bg-carte text-brume'}`}>{label}</button>
        ))}
      </div>}
      {tache && items.length > 0 && choisies.length === 0 && <p role="status" className="mx-5 py-6 text-center text-note text-brume">Aucune tâche dans cette catégorie.</p>}
      {todoVisible.length > 0 && (
        <div className="groupe mx-4 mt-1 overflow-hidden shadow-carte">
          {todoVisible.map((i, k) => {
            const who = members.find((m) => m.id === i.assigned_to)
            const attente = i.id.startsWith('attente-')
            return (
              <Glisse key={i.id} onRetirer={() => retirer([i.id])} label={`Glisse vers la gauche pour retirer ${i.title}`}>
                <div className={`flex items-center ${attente ? 'anim-pop opacity-60' : ''}`}>
                  <button onClick={() => basculer(i)} className="presse-ligne flex min-w-0 flex-1 items-center gap-3 pl-4 text-left" aria-label={`Cocher ${i.title}`}>
                    <Coche fait={false} />
                    <span className={`flex min-h-[54px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 ${k < todoVisible.length - 1 ? 'border-b border-trait' : ''}`}>
                      <span className="min-w-0 flex-1 text-corps">{i.title}</span>
                      {who && <Avatar m={who} size={28} />}
                    </span>
                  </button>
                  {editing && (
                    <button onClick={() => retirer([i.id])} className="presse mr-2 flex min-h-11 items-center rounded-full bg-rouge/10 px-3 text-note font-semibold text-rouge" aria-label={`Retirer ${i.title}`}>
                      Retirer
                    </button>
                  )}
                </div>
              </Glisse>
            )
          })}
        </div>
      )}
      {todo.length > 0 && !tache && <p className="mt-2 px-5 text-mini text-pale">Touche pour cocher · glisse vers la gauche pour retirer</p>}

      {doneVisible.length > 0 && (
        <>
          <div className="mt-6 flex items-baseline justify-between px-5">
            <p className="entete !px-0">{tache ? 'Terminées' : 'Dans le panier'}</p>
            <button onClick={() => retirer(done.map((d) => d.id))} className="presse min-h-11 text-sous font-semibold text-teinte">
              {tache ? 'Tout effacer' : 'Vider le panier'}
            </button>
          </div>
          <div className="groupe mx-4 overflow-hidden shadow-carte">
            {doneVisible.map((i, k) => {
              const who = members.find((m) => m.id === i.assigned_to)
              return (
                <Glisse key={i.id} onRetirer={() => retirer([i.id])} label={`Glisse vers la gauche pour retirer ${i.title}`}>
                  <button onClick={() => basculer(i)} className="presse-ligne flex w-full items-center gap-3 pl-4 text-left" aria-label={`Décocher ${i.title}`}>
                    <Coche fait />
                    <span className={`flex min-h-[50px] min-w-0 flex-1 items-center gap-2 py-2 pr-3 ${k < doneVisible.length - 1 ? 'border-b border-trait' : ''}`}>
                      <span className="min-w-0 flex-1 text-corps text-pale line-through">{i.title}</span>
                      {who && (
                        <span className="opacity-70">
                          <Avatar m={who} size={26} />
                        </span>
                      )}
                    </span>
                  </button>
                </Glisse>
              )
            })}
          </div>
        </>
      )}
      {tache && <ListPages {...navigation} label="Pages des tâches" />}
    </>
  )
}

/** Ce qu'on peut mettre dans l'agenda, en un toucher. */
function Ajouter({ onAdd }: { onAdd: (kind: EventKind) => void }) {
  return (
    <div className="mx-4 mb-5">
      <p className="mb-2 px-1 text-sous font-semibold">Ajouter à l’agenda</p>
      <div className="flex gap-2">
        {TYPES_AGENDA.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              tap()
              onAdd(t.key)
            }}
            className="presse flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[18px] bg-carte px-1 py-3 shadow-carte"
          >
            <Art name={t.art} size={28} />
            <span className="max-w-full truncate text-note font-semibold">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Organize() {
  const { state } = useHome()
  const [seg, setSeg] = useState<Seg>('agenda')
  const [vue, setVue] = useState<Vue>('liste')
  const [adding, setAdding] = useState<{ day?: Date; kind?: EventKind } | null>(null)
  const [open, setOpen] = useState<Ouvert | null>(null)

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const coming = state.events
    .map((e) => ({ e, at: nextOccurrence(e) }))
    .filter((x) => finDe(x.e, x.at) >= start) // un week-end commencé hier compte encore
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
          {seg === 'agenda' ? 'Moins de choses à retenir, plus de temps ensemble.' : seg === 'course' ? 'Une liste commune : chacun ajoute et coche en direct.' : 'La liste des choses à faire : ajoute, coche et avance à ton rythme.'}
        </p>
        <div className="mx-4 mb-4 mt-3">
          <Segments value={seg} onChange={setSeg} options={[{ key: 'agenda', label: 'Agenda' }, { key: 'tache', label: 'À faire' }, { key: 'course', label: 'Courses' }]} />
        </div>

        {seg === 'agenda' && <Ajouter onAdd={(kind) => setAdding({ kind })} />}

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
            <>
              <Vide art="picto-agenda" title="L’agenda est libre" text="Anniversaires, rendez-vous, dîners : tout le monde les verra au même endroit." />
            </>
          ) : (
            <>
            {[...groups.entries()].map(([month, list]) => (
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
                              {(() => {
                                // « Demain · 10:00 · Tous les jeudis », « Du 28 au 29 novembre », « Samedi · chaque année »
                                const r = rythme(e, at)
                                const quand = `${at < start ? 'En ce moment' : dayLabel(at)}${e.all_day ? '' : ` · ${timeLabel(at)}`}`
                                if (e.weekly) return `${quand} · ${r}`
                                if (r) return at < start ? `En ce moment · ${r}` : r
                                return `${quand}${e.yearly ? ' · chaque année' : ''}`
                              })()}
                            </span>
                            {e.lieu && (
                              <span className="flex items-center gap-1 text-note text-teinte-fonce">
                                <MapPin size={12} strokeWidth={2.4} className="shrink-0" />
                                <span className="truncate">{e.lieu}</span>
                              </span>
                            )}
                            {e.description && <span className="block truncate text-note text-brume">{e.description}</span>}
                          </span>
                          {e.members?.length ? <MemberStack ids={e.members} size={24} max={2} /> : null}<EventIcon event={e} size={32} className="shrink-0" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            </>
          )
        ) : (
          <Liste key={seg} kind={seg} />
        )}
      </Screen>
      {adding && <EventSheet day={adding.day} kind={adding.kind} onClose={() => setAdding(null)} />}
      {open && <EventDetailSheet key={open.e.id} event={state.events.find((x) => x.id === open.e.id) ?? open.e} at={open.at} onClose={() => setOpen(null)} />}
    </>
  )
}

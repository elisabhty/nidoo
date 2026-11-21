import { ListPages, useListPage } from '../components/listNavigation'
import { Check, ChevronLeft, ChevronRight, MapPin, Plus, Users } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { AUTRES, cle, comprendre, ecrireArticle, lireArticle, nombre, pourAllerAvec, RAYONS, rayonDe, retenir, souvent } from '../lib/courses'
import { MemberStack } from '../components/folder'
import { EventDetailSheet, EventSheet, EventIcon, TYPES_AGENDA } from '../components/sheets'
import { Art, Avatar, Rond, Screen, Segments, Vide } from '../components/ui'
import { select, success, tap } from '../lib/haptic'
import { confettis, petille } from '../lib/fete'
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
            className="presse flex h-11 w-11 items-center justify-center rounded-full text-teinte"
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
            className="presse flex h-11 w-11 items-center justify-center rounded-full text-teinte"
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
                  className="presse -mr-1.5 flex h-11 w-11 items-center justify-center rounded-full text-teinte"
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

/** Un bouton qui ne prend pas le clavier : toucher une idée pendant qu'on écrit ne ferme pas le clavier
 *  (avant, le clavier se fermait puis se rouvrait : tout l'écran sautait). */
const garderLeClavier = (e: React.PointerEvent) => e.preventDefault()

/** Le titre d'une partie de la liste, avec son illustration (comme dans « Nouvel événement »). */
function TitrePartie({ emoji, children, n }: { emoji: string; children: ReactNode; n?: number }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-2 px-5">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-carte text-[15px] ring-1 ring-inset ring-trait" aria-hidden="true">{emoji}</span>
      <p className="flex-1 text-sous font-bold">{children}</p>
      {n !== undefined && <span className="text-note font-semibold text-brume">{n}</span>}
    </div>
  )
}

/** − 2 + : la quantité d'un article, d'un toucher. */
function Quantite({ qte, onChange, nom }: { qte: string; onChange: (q: string) => void; nom: string }) {
  const n = nombre(qte)
  if (n === null)
    return <span className="mr-3 shrink-0 rounded-full bg-teinte-doux px-2.5 py-1 text-note font-bold text-teinte-fonce">{qte}</span>
  return (
    <span className="mr-2 flex shrink-0 items-center rounded-full bg-remplissage p-0.5" role="group" aria-label={`Quantité de ${nom}`}>
      <button type="button" onPointerDown={garderLeClavier} onClick={() => (select(), onChange(String(Math.max(1, n - 1))))} disabled={n <= 1} aria-label={`Un ${nom} de moins`} className="presse flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold text-teinte-fonce disabled:opacity-30">−</button>
      <span key={n} className="anim-pop min-w-[22px] text-center text-sous font-extrabold text-encre" aria-live="polite">{n}</span>
      <button type="button" onPointerDown={garderLeClavier} onClick={() => (select(), onChange(String(Math.min(99, n + 1))))} aria-label={`Un ${nom} de plus`} className="presse flex h-8 w-8 items-center justify-center rounded-full bg-carte text-[18px] font-bold text-teinte-fonce">+</button>
    </span>
  )
}

/**
 * Les courses et les choses à faire. Tout répond tout de suite : la ligne se coche, s'ajoute ou part à l'écran
 * pendant que l'enregistrement se fait en arrière-plan (en cas d'erreur, elle revient comme avant).
 * Courses : la quantité de chaque article, rangé dans son rayon ; des idées (souvent ajoutés, pour aller avec).
 * À faire : pour qui, choisi dans la carte où l'on écrit ; les filtres au-dessus de la liste.
 */
function Liste({ kind }: { kind: ListKind }) {
  const { state, api, reload, toast } = useHome()
  const { me, members, family } = state
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState(false)
  const [to, setTo] = useState<string | null>(null)
  const tache = kind === 'tache'
  const [filtre, setFiltre] = useState('toutes')
  // ce qu'on vient de faire, affiché sans attendre le serveur
  const [ajouts, setAjouts] = useState<(ListItem & { connus: Set<string> })[]>([])
  const [changes, setChanges] = useState<Record<string, { done?: boolean; parti?: boolean; titre?: string }>>({})
  const champ = useRef<HTMLInputElement>(null)

  const reels = state.items.filter((i) => i.kind === kind)
  const enAttente = ajouts.filter((a) => !reels.some((i) => !a.connus.has(i.id) && i.title === a.title))
  const items = [
    ...reels
      .filter((i) => !changes[i.id]?.parti)
      .map((i) => {
        const c = changes[i.id]
        if (!c) return i
        return { ...i, ...(c.done !== undefined ? { done: c.done, done_by: c.done ? me.id : null } : {}), ...(c.titre ? { title: c.titre } : {}) }
      }),
    ...enAttente,
  ]
  const todo = items.filter((i) => !i.done)
  if (tache) todo.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const done = items.filter((i) => i.done)
  const choisies = filtre === 'terminees' ? done : todo.filter((i) => filtre === 'toutes' || (filtre === 'moi' ? i.assigned_to === me.id : filtre === 'libres' ? !i.assigned_to : !!i.assigned_to && i.assigned_to !== me.id))
  const navigation = useListPage(choisies, 5, kind + filtre)
  const todoVisible = tache ? (filtre === 'terminees' ? [] : navigation.visible) : todo
  const doneVisible = tache ? (filtre === 'terminees' ? navigation.visible : []) : done

  // courses : les idées, et la liste rangée par rayon
  const nomsListe = todo.map((i) => lireArticle(i.title).nom)
  const idees = tache ? [] : souvent(family.id, nomsListe, done.map((i) => lireArticle(i.title).nom), 10)
  const avec = tache ? [] : pourAllerAvec(nomsListe)
  const rayons = tache
    ? []
    : [...RAYONS, AUTRES]
        .map((r) => ({ r, items: todo.filter((i) => rayonDe(lireArticle(i.title).nom).key === r.key) }))
        .filter((x) => x.items.length)
  const saisie = !tache && title.trim() ? comprendre(title) : null

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

  /** depuisLeChamp : on a écrit et validé (le clavier reste ouvert pour la suite) ; sinon, une idée touchée. */
  const ajouter = (texte?: string) => {
    const brut = (texte ?? title).trim()
    if (!brut) return
    // une course : sa quantité (« 2 lait » → « Lait · 2 »), et si elle est déjà dans la liste, on en reprend
    const t = tache ? brut.slice(0, 80) : ecrireArticle(comprendre(brut))
    if (!tache) {
      const a = comprendre(brut)
      const deja = todo.find((i) => cle(lireArticle(i.title).nom) === cle(a.nom) && !i.id.startsWith('attente-'))
      if (deja) {
        const avant = lireArticle(deja.title)
        const n1 = nombre(avant.qte), n2 = nombre(a.qte)
        if (n1 !== null && n2 !== null) {
          if (!texte) setTitle('')
          changerQuantite(deja, String(Math.min(99, n1 + n2)))
          retenir(family.id, a.nom)
          return
        }
      }
      retenir(family.id, a.nom)
    }
    tap()
    if (!texte) setTitle('')
    const tmp = { id: `attente-${Date.now()}-${Math.random()}`, family_id: family.id, kind, title: t, done: false, done_by: null, assigned_to: tache ? to : null, created_by: me.id, created_at: new Date().toISOString(), connus: new Set(state.items.map((i) => i.id)) }
    setAjouts((a) => [...a, tmp])
    if (tache) { setFiltre('toutes'); navigation.setPage(1) }
    const pour = tache ? to : null
    void fond(
      () => api.addItem(family.id, me.id, kind, t, pour),
      () => {
        setAjouts((a) => a.filter((x) => x.id !== tmp.id))
        if (!texte) setTitle(brut)
      },
      () => setAjouts((a) => a.filter((x) => x.id !== tmp.id)),
    )
  }
  const changerQuantite = (i: ListItem, q: string) => {
    if (i.id.startsWith('attente-')) return
    const titre = ecrireArticle({ nom: lireArticle(i.title).nom, qte: q })
    setChanges((c) => ({ ...c, [i.id]: { ...c[i.id], titre } }))
    void fond(
      () => api.renameItem(i.id, titre),
      () => oublier(i.id),
      () => oublier(i.id),
    )
  }
  const basculer = (i: ListItem, el?: Element | null) => {
    if (i.id.startsWith('attente-')) return
    const fait = !i.done
    if (fait) success()
    else tap()
    setChanges((c) => ({ ...c, [i.id]: { ...c[i.id], done: fait } }))
    // cocher fait pétiller ; la dernière de la liste, c'est la fête
    if (fait) petille(el)
    const derniere = fait && todo.filter((x) => !x.id.startsWith('attente-')).length === 1
    if (derniere) {
      window.setTimeout(confettis, 180)
      toast(tache ? 'Tout est fait, bravo ! 🎉' : 'Tout est dans le panier ! 🛒')
    } else if (tache && fait) toast('C’est fait ✓')
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

  const idee = (x: string, k: string) => (
    <button key={k} type="button" onPointerDown={garderLeClavier} onClick={() => ajouter(x)} className="presse flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-fond px-3 text-sous font-semibold text-encre">
      <Plus size={14} strokeWidth={2.8} className="text-teinte" /> {x}
    </button>
  )

  /** Une ligne de la liste : le rond à cocher, le nom, et (courses) la quantité. */
  const ligne = (i: ListItem, dernier: boolean) => {
    const who = members.find((m) => m.id === i.assigned_to)
    const attente = i.id.startsWith('attente-')
    const art = lireArticle(i.title)
    return (
      <Glisse key={i.id} onRetirer={() => retirer([i.id])} label={`Glisse vers la gauche pour retirer ${i.title}`}>
        <div className={`flex items-center ${attente ? 'anim-pop opacity-60' : ''} ${dernier ? '' : 'border-b border-trait'}`}>
          <button onClick={(e) => basculer(i, e.currentTarget.firstElementChild)} className="presse-ligne flex min-h-[54px] min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2 text-left" aria-label={`Cocher ${i.title}`}>
            <Coche fait={false} />
            <span className="min-w-0 flex-1 text-corps">{tache ? i.title : art.nom}</span>
            {who && <Avatar m={who} size={28} />}
          </button>
          {!tache && !editing && !attente && <Quantite qte={art.qte} nom={art.nom} onChange={(q) => changerQuantite(i, q)} />}
          {editing && (
            <button onClick={() => retirer([i.id])} className="presse mr-2 flex min-h-11 items-center rounded-full bg-rouge/10 px-3 text-note font-semibold text-rouge" aria-label={`Retirer ${i.title}`}>
              Retirer
            </button>
          )}
        </div>
      </Glisse>
    )
  }

  return (
    <>
      {/* la carte où l'on écrit : ce qu'on ajoute, et juste dessous les idées (courses) ou pour qui (à faire) */}
      <div className="mx-4 rounded-[22px] bg-carte p-3 shadow-carte">
        <form
          className="flex items-center gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            ajouter()
          }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-teinte-doux text-teinte-fonce" aria-hidden="true">
            <Art name={tache ? 'picto-missions' : 'picto-courses'} size={26} />
          </span>
          <input
            ref={champ}
            aria-label={tache ? 'Ajouter une chose à faire' : 'Ajouter un article'}
            className="h-11 min-w-0 flex-1 bg-transparent text-corps font-semibold outline-none placeholder:font-normal placeholder:text-brume"
            placeholder={tache ? 'Ajouter une chose à faire' : 'Ajouter un article (ex. 2 baguettes)'}
            maxLength={80}
            enterKeyHint="done"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {title.trim() && (
            <button type="submit" onPointerDown={garderLeClavier} className="presse anim-pop min-h-11 shrink-0 rounded-full bg-teinte px-4 text-sous font-semibold text-white">
              Ajouter
            </button>
          )}
        </form>
        {saisie && (
          <p className="anim-entre mt-1.5 flex items-center gap-1.5 px-1 text-note font-semibold text-teinte-fonce">
            <span aria-hidden="true">{rayonDe(saisie.nom).emoji}</span>
            {saisie.nom}
            {saisie.qte && <span className="rounded-full bg-teinte-doux px-2 py-0.5">{nombre(saisie.qte) !== null ? `× ${saisie.qte}` : saisie.qte}</span>}
            <span className="font-medium text-brume">· {rayonDe(saisie.nom).label}</span>
          </p>
        )}
        {!tache && idees.length > 0 && (
          <>
            <p className="mb-1.5 mt-3 px-1 text-note font-bold text-brume">Souvent dans la liste</p>
            <div className="no-bar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5" aria-label="Idées à ajouter">
              {idees.map((x) => idee(x, x))}
            </div>
          </>
        )}
        {avec.map((g) => (
          <div key={g.avec}>
            <p className="mb-1.5 mt-3 px-1 text-note font-bold text-brume">Pour aller avec {g.avec.toLowerCase()}</p>
            <div className="no-bar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">{g.idees.map((x) => idee(x, `${g.avec}-${x}`))}</div>
          </div>
        ))}
        {tache && (
          <>
            <p className="mb-1.5 mt-3 px-1 text-note font-bold text-brume">Pour qui ?</p>
            <div className="no-bar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5" role="group" aria-label="Pour qui">
              <button type="button" onPointerDown={garderLeClavier} onClick={() => (select(), setTo(null))} aria-pressed={to === null} className={`presse flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sous font-semibold ${to === null ? 'bg-teinte text-white' : 'bg-fond text-encre'}`}>
                <Users size={15} strokeWidth={2.4} /> Tout le monde
              </button>
              {members.map((m) => (
                <button key={m.id} type="button" onPointerDown={garderLeClavier} onClick={() => (select(), setTo(m.id))} aria-pressed={to === m.id} className={`presse flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-sous font-semibold ${to === m.id ? 'bg-teinte text-white' : 'bg-fond text-encre'}`}>
                  <Avatar m={m} size={28} /> {m.id === me.id ? 'Moi' : m.display_name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* à faire : les filtres, sur une ligne, au-dessus de la liste */}
      {tache && items.length > 0 && (
        <div role="group" aria-label="Filtrer les tâches" className="no-bar mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {[['toutes', 'À faire', todo.length], ['moi', 'Pour moi'], ['autres', 'Pour les autres'], ['libres', 'Pour tout le monde'], ['terminees', 'Terminées', done.length]].map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={filtre === id} onClick={() => (select(), setFiltre(id as string))} className={`presse flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-note font-bold ${filtre === id ? 'bg-teinte text-white' : 'bg-carte text-encre ring-1 ring-inset ring-trait'}`}>
              {label}
              {n !== undefined && Number(n) > 0 && <span className={`rounded-full px-1.5 text-[11px] ${filtre === id ? 'bg-white/25' : 'bg-teinte-doux text-teinte-fonce'}`}>{n}</span>}
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
        <div className="mx-5 mt-3 flex min-h-11 items-center justify-between gap-3">
          <p className="text-note font-semibold text-brume" role="status">
            {todo.length} {tache ? `chose${todo.length > 1 ? 's' : ''} à faire` : `article${todo.length > 1 ? 's' : ''} à prendre`}
            {done.length > 0 ? ` · ${done.length} ${tache ? `terminée${done.length > 1 ? 's' : ''}` : 'dans le panier'}` : ''}
          </p>
          <button onClick={() => setEditing((v) => !v)} className="presse min-h-11 text-sous font-semibold text-teinte-fonce">
            {editing ? 'Terminé' : 'Modifier'}
          </button>
        </div>
      )}
      {tache && items.length > 0 && choisies.length === 0 && <p role="status" className="mx-5 py-6 text-center text-note text-brume">Aucune tâche dans cette catégorie.</p>}

      {/* courses : par rayon, dans l'ordre d'un magasin */}
      {!tache &&
        rayons.map(({ r, items: dans }) => (
          <div key={r.key}>
            <TitrePartie emoji={r.emoji} n={dans.length}>{r.label}</TitrePartie>
            <div className="groupe mx-4 overflow-hidden shadow-carte">{dans.map((i, k) => ligne(i, k === dans.length - 1))}</div>
          </div>
        ))}
      {tache && todoVisible.length > 0 && <div className="groupe mx-4 mt-1 overflow-hidden shadow-carte">{todoVisible.map((i, k) => ligne(i, k === todoVisible.length - 1))}</div>}
      {todo.length > 0 && !tache && <p className="mt-2 px-5 text-mini text-pale">Touche pour cocher · − et + pour la quantité · glisse vers la gauche pour retirer</p>}

      {doneVisible.length > 0 && (
        <>
          <div className="mt-6 flex items-baseline justify-between px-5">
            <p className="entete !px-0">{tache ? 'Terminées' : 'Dans le panier'}</p>
            <button onClick={() => retirer(done.map((d) => d.id))} className="presse min-h-11 text-sous font-semibold text-teinte">
              {tache ? 'Effacer les tâches terminées' : 'Vider le panier'}
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
                      <span className="min-w-0 flex-1 text-corps text-pale line-through">{tache ? i.title : lireArticle(i.title).nom}</span>
                      {!tache && lireArticle(i.title).qte && <span className="text-note font-semibold text-pale">{lireArticle(i.title).qte}</span>}
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

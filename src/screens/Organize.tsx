import { ListPages, useListPage } from '../components/listNavigation'
import { BookOpen, Check, ChevronLeft, ChevronRight, MapPin, Minus, Plus, Trash2, Users } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { additionner, AUTRES, cle, completer, comprendre, ecrireArticle, lireArticle, memeArticle, lireQte, moinsUn, plusUn, pourAllerAvec, qteCourte, RAYONS, rayonDe, retenir, souvent } from '../lib/courses'
import { recetteDe, recettesAvec, recettesDuMoment, type Recette } from '../lib/recettes'
import { evenementsAVenir, jourCourt, useLienTaches } from '../lib/lienTaches'
import { RecetteSheet, RecettesSheet } from '../components/recettes'
import { MemberStack } from '../components/folder'
import { EventDetailSheet, EventSheet, EventIcon, TYPES_AGENDA } from '../components/sheets'
import { Art, AuDessus, Avatar, Rond, Screen, Segments, Vide } from '../components/ui'
import { choc, select, success, tap } from '../lib/haptic'
import { bravo, confettis } from '../lib/fete'
import { useHome } from '../lib/store'
import type { EventKind, FamEvent, ListItem, ListKind } from '../lib/types'
import { dayLabel, errorText, finDe, nextOccurrence, occursOn, repeteDe, rythme, timeLabel, todayKey } from '../lib/util'

type Seg = 'agenda' | 'course' | 'tache'
type Vue = 'liste' | 'semaine'
type Ouvert = { e: FamEvent; at: Date }

/** L'ordre de l'agenda (Elisa, 21 novembre : « bien ranger dans l'ordre ») : jour par jour ; dans une journée,
 *  les anniversaires, puis ce qui dure toute la journée, puis le reste à l'heure ; à égalité, par nom. */
const rangDe = (e: FamEvent) => (e.kind === 'anniversaire' ? 0 : e.all_day ? 1 : 2)
const jourDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const ordreAgenda = (a: Ouvert, b: Ouvert) =>
  jourDe(a.at) - jourDe(b.at) || rangDe(a.e) - rangDe(b.e) || (rangDe(a.e) === 2 ? a.at.getTime() - b.at.getTime() : 0) || a.e.title.localeCompare(b.e.title, 'fr')

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
      .sort(ordreAgenda),
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
                            {e.all_day ? (rythme(e, at) && !repeteDe(e) ? rythme(e, at) : 'Toute la journée') : timeLabel(at)}
                            {repeteDe(e) && repeteDe(e) !== 'annee' ? ` · ${rythme(e, at)?.toLowerCase()}` : repeteDe(e) === 'annee' && e.kind !== 'anniversaire' ? ' · chaque année' : ''}
                            {!e.lieu && e.description ? ` · ${e.description}` : ''}
                          </span>
                          {e.lieu && (
                            <span className="mt-0.5 flex items-start gap-1 text-note text-teinte-fonce">
                              <MapPin size={12} strokeWidth={2.4} className="mt-[3px] shrink-0" />
                              <span className="min-w-0 break-words">{e.lieu}</span>
                            </span>
                          )}
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
function Glisse({ children, onRetirer, label, partant = false, range = false }: { children: ReactNode; onRetirer: () => void; label: string; partant?: boolean; range?: boolean }) {
  const [dx, setDx] = useState(0)
  const [glisse, setPart] = useState(false)
  // qui part (glissée, poubelle ou « Retirer ») : elle file vers la gauche et la place se referme
  const part = glisse || partant
  const depart = useRef<{ x: number; y: number; actif: boolean } | null>(null)
  const aGlisse = useRef(false) // un glissé n'est pas un toucher : on ne coche pas en lâchant
  const fini = () => {
    if (dx < -90) {
      choc()
      setPart(true)
      window.setTimeout(onRetirer, 180)
    } else setDx(0)
    depart.current = null
  }
  return (
    <div className={`relative overflow-hidden transition-[max-height,opacity] duration-300 ${part || range ? 'max-h-0 opacity-0' : 'max-h-[120px]'}`}>
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-rouge pr-5 text-sous font-semibold text-white" style={{ width: Math.max(0, -dx) + 8 }} aria-hidden="true">
        {dx < -40 && 'Retirer'}
      </div>
      <div
        className="relative bg-carte"
        style={{ transform: `translateX(${part ? -400 : dx}px)`, transition: depart.current?.actif ? 'none' : 'transform 0.28s cubic-bezier(0.4, 0, 0.6, 1)', touchAction: 'pan-y' }}
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

/** − 2 + : la quantité d'un article, d'un toucher, au pas de l'article (œufs de 6 en 6, pommes de 0,5 kg en 0,5 kg).
 *  Au plus bas, le − devient une poubelle : il retire l'article (Elisa, 21 novembre : « à 1, le − ne fait rien »). */
function Quantite({ qte, nom, onChange, onRetirer }: { qte: string; nom: string; onChange: (q: string) => void; onRetirer: () => void }) {
  const q = lireQte(qte)
  if (!q) return <span className="ml-2.5 mr-3 shrink-0 rounded-full bg-teinte-doux px-2.5 py-1 text-note font-bold text-teinte-fonce">{qte}</span>
  const moins = moinsUn(nom, qte)
  const plus = plusUn(nom, qte)
  return (
    <span className="ml-2.5 mr-2.5 flex shrink-0 items-center rounded-full bg-remplissage p-0.5" role="group" aria-label={`Quantité de ${nom}`}>
      <button
        type="button"
        onPointerDown={garderLeClavier}
        onClick={() => (select(), moins === null ? onRetirer() : onChange(moins))}
        aria-label={moins === null ? `Retirer ${nom} de la liste` : `Moins de ${nom}`}
        className={`presse flex h-8 w-8 items-center justify-center rounded-full ${moins === null ? 'text-rouge' : 'text-teinte-fonce'}`}
      >
        {moins === null ? <Trash2 key="poubelle" size={15} strokeWidth={2.4} className="anim-pop" /> : <Minus size={16} strokeWidth={3} />}
      </button>
      <span key={qte} className="anim-pop min-w-[24px] whitespace-nowrap px-0.5 text-center text-sous font-extrabold text-encre" aria-live="polite">{qteCourte(q)}</span>
      <button type="button" onPointerDown={garderLeClavier} onClick={() => plus && (select(), onChange(plus))} aria-label={`Plus de ${nom}`} className="presse flex h-8 w-8 items-center justify-center rounded-full bg-carte text-teinte-fonce shadow-[0_1px_2px_rgba(29,26,43,0.08)]">
        <Plus size={16} strokeWidth={3} />
      </button>
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
  // à faire : liée à un événement de l'agenda (facultatif)
  const [pourEvt, setPourEvt] = useState<string | null>(null)
  const [filtre, setFiltre] = useState('toutes')
  // ce qu'on vient de faire, affiché sans attendre le serveur
  const [ajouts, setAjouts] = useState<(ListItem & { connus: Set<string> })[]>([])
  const [changes, setChanges] = useState<Record<string, { done?: boolean; parti?: boolean; titre?: string }>>({})
  const champ = useRef<HTMLInputElement>(null)

  const reels = state.items.filter((i) => i.kind === kind)
  const peutLier = useLienTaches(api, state.items)
  const aVenir = tache && peutLier ? evenementsAVenir(state.events) : []
  const evtDe = (id?: string | null) => (id ? state.events.find((e) => e.id === id) : undefined)
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
  const choisies = filtre === 'terminees' ? done : todo.filter((i) => filtre === 'toutes' || i.assigned_to === me.id)
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
  const saisie = !tache && title.trim() ? completer(comprendre(title)) : null
  // les recettes : tapées (« bolognaise »), de saison, ou celles qu'on a presque avec ce qu'il y a dans la liste
  const [recette, setRecette] = useState<Recette | null>(null)
  const [toutesRecettes, setToutesRecettes] = useState(false)
  const recetteTapee = tache || !title.trim() ? null : recetteDe(title)
  const saisons = tache ? [] : recettesDuMoment()
  const presque = tache ? [] : recettesAvec(nomsListe)
  // « Pour compléter » : les idées de tous les articles récents, réunies (sans doublon)
  const sources = avec.map((g) => g.avec)
  const completer8 = [...new Set(avec.flatMap((g) => g.idees))].slice(0, 8)
  const recettesIdees = [...presque.map((p) => ({ r: p.recette, manque: p.manque })), ...saisons.filter((r) => !presque.some((p) => p.recette.id === r.id)).map((r) => ({ r, manque: 0 }))].slice(0, 3)
  type Onglet = 'souvent' | 'completer' | 'recettes'
  const ongletsIdees = tache ? [] : ([
    idees.length ? { k: 'souvent', label: 'Souvent', emoji: '⭐' } : null,
    completer8.length ? { k: 'completer', label: 'Compléter', emoji: '🧩' } : null,
    { k: 'recettes', label: 'Recettes', emoji: '📖' },
  ].filter(Boolean) as { k: Onglet; label: string; emoji: string }[])
  const [onglet, setOnglet] = useState<Onglet>('souvent')
  const ongletVu = ongletsIdees.some((o) => o.k === onglet) ? onglet : ongletsIdees[0]?.k
  const dansLaListe = (nom: string) => todo.some((i) => memeArticle(lireArticle(i.title).nom, nom))
  const ajouterRecette = (r: Recette, articles: { nom: string; qte: string }[]) => {
    for (const a of articles) ajouter(ecrireArticle(a), { exact: true, discret: true })
    success()
    confettis()
    toast(`${articles.length} article${articles.length > 1 ? 's' : ''} pour : ${r.nom} 🛒`)
    setRecette(null)
    setToutesRecettes(false)
    setTitle('')
  }

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
  const ajouter = (texte?: string, o: { exact?: boolean; discret?: boolean } = {}) => {
    const brut = (texte ?? title).trim()
    if (!brut) return
    // une course : sa quantité (« 2 lait » → « Lait · 2 » ; rien de tapé : la quantité habituelle, « Œufs » → 12) ;
    // déjà dans la liste : on en reprend (la quantité tapée, sinon un pas de plus).
    // exact : la quantité vient d'une recette (rien = un seul paquet), on ne met pas la quantité habituelle.
    const tape = tache ? null : comprendre(brut)
    const t = tache ? brut.slice(0, 80) : ecrireArticle(o.exact ? tape! : completer(tape!))
    if (tape) {
      const deja = todo.find((i) => !i.id.startsWith('attente-') && memeArticle(lireArticle(i.title).nom, tape.nom))
      if (deja) {
        const avant = lireArticle(deja.title)
        const somme = tape.qte ? additionner(avant.qte, tape.qte) : o.exact ? additionner(avant.qte, '1') : plusUn(avant.nom, avant.qte)
        if (somme) {
          if (!texte) setTitle('')
          if (!o.discret) tap()
          marquerArrivee(avant.nom)
          changerQuantite(deja, somme)
          retenir(family.id, tape.nom)
          if (!o.discret) toast(`${avant.nom} : ${somme}`)
          return
        }
      }
      retenir(family.id, tape.nom)
    }
    if (!o.discret) tap()
    if (!texte) setTitle('')
    marquerArrivee(tache ? t : lireArticle(t).nom)
    const evt = tache && peutLier ? pourEvt : null
    const tmp = { id: `attente-${Date.now()}-${Math.random()}`, family_id: family.id, kind, title: t, done: false, done_by: null, assigned_to: tache ? to : null, created_by: me.id, created_at: new Date().toISOString(), event_id: evt, connus: new Set(state.items.map((i) => i.id)) }
    setAjouts((a) => [...a, tmp])
    if (tache) { setFiltre('toutes'); navigation.setPage(1) }
    const pour = tache ? to : null
    void fond(
      () => api.addItem(family.id, me.id, kind, t, pour, evt),
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
  // cocher (Elisa, 21 novembre) : le rond se coche, le nom se barre lentement, des confettis jaillissent,
  // puis la ligne se range et part dans « terminées » / le panier. Décocher reste immédiat.
  const [barres, setBarres] = useState<string[]>([])
  const [ranges, setRanges] = useState<string[]>([])
  const basculer = (i: ListItem, el?: Element | null) => {
    if (i.id.startsWith('attente-') || barres.includes(i.id)) return
    const fait = !i.done
    if (!fait) {
      tap()
      setChanges((c) => ({ ...c, [i.id]: { ...c[i.id], done: false } }))
      void fond(() => api.toggleItem(i, me.id), () => oublier(i.id), () => oublier(i.id))
      return
    }
    select()
    setBarres((b) => [...b, i.id])
    const derniere = todo.filter((x) => !x.id.startsWith('attente-') && !barres.includes(x.id)).length === 1
    window.setTimeout(() => {
      success()
      bravo(el?.firstElementChild ?? el) // le rond coché (la ligne est toujours là)
    }, 650)
    window.setTimeout(() => setRanges((r) => [...r, i.id]), 1050)
    window.setTimeout(() => {
      setChanges((c) => ({ ...c, [i.id]: { ...c[i.id], done: true } }))
      setBarres((b) => b.filter((x) => x !== i.id))
      setRanges((r) => r.filter((x) => x !== i.id))
      if (derniere) {
        confettis()
        toast(tache ? 'Tout est fait, bravo ! 🎉' : 'Tout est dans le panier ! 🛒')
      } else if (tache) toast('C’est fait ✓')
      void fond(() => api.toggleItem(i, me.id), () => oublier(i.id), () => oublier(i.id))
    }, 1350)
  }
  // ajouter et retirer se sentent et se voient (Elisa, 21 novembre) : la ligne qui arrive s'éclaire un instant,
  // celle qui part vibre, file vers la gauche et la place se referme
  const [partants, setPartants] = useState<string[]>([])
  const [arrivees, setArrivees] = useState<string[]>([])
  const marquerArrivee = (nom: string) => {
    const k = cle(nom)
    setArrivees((a) => [...a.filter((x) => x !== k), k])
    window.setTimeout(() => setArrivees((a) => a.filter((x) => x !== k)), 1500)
  }
  const retirerAnime = (ids: string[]) => {
    choc()
    setPartants((p) => [...p, ...ids])
    window.setTimeout(() => {
      retirer(ids)
      setPartants((p) => p.filter((x) => !ids.includes(x)))
    }, 300)
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

  const [sortants, setSortants] = useState<string[]>([])
  const prendre = (x: string) => {
    if (sortants.includes(x)) return
    select()
    setSortants((o) => [...o, x])
    window.setTimeout(() => {
      ajouter(x, { discret: true })
      setSortants((o) => o.filter((y) => y !== x))
    }, 220)
  }
  const idee = (x: string, k: string, n = 0) => (
    <button key={k} type="button" onPointerDown={garderLeClavier} onClick={() => prendre(x)} className={`presse ligne-arrive-pop flex min-h-[36px] items-center gap-1 rounded-full bg-doux px-3 text-sous font-semibold text-encre ${sortants.includes(x) ? 'idee-part' : ''}`} style={{ animationDelay: `${n * 30}ms` }}>
      <Plus size={14} strokeWidth={2.8} className="text-teinte" /> {x}
    </button>
  )

  /** Une ligne de la liste : le rond à cocher, le nom, et (courses) la quantité. */
  const ligne = (i: ListItem, dernier: boolean) => {
    const who = members.find((m) => m.id === i.assigned_to)
    const attente = i.id.startsWith('attente-')
    const art = lireArticle(i.title)
    return (
      <Glisse key={i.id} onRetirer={() => retirer([i.id])} partant={partants.includes(i.id)} range={ranges.includes(i.id)} label={`Glisse vers la gauche pour retirer ${i.title}`}>
        <div className={`flex items-center ${attente ? 'ligne-arrive-pop opacity-70' : ''} ${arrivees.includes(cle(tache ? i.title : art.nom)) ? 'ligne-arrive' : ''} ${dernier ? '' : 'border-b border-trait'}`}>
          {/* le gris du toucher s'arrête avant la quantité, avec un peu d'air (Elisa, 21 novembre) */}
          <button onClick={(e) => basculer(i, e.currentTarget)} className={`presse-ligne flex min-h-[54px] min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-3 text-left ${!tache && !editing ? 'rounded-r-[16px]' : ''}`} aria-label={`Cocher ${i.title}`}>
            {barres.includes(i.id) ? <span className="coche-saut flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-teinte text-white"><Check size={16} strokeWidth={3.2} /></span> : <Coche fait={false} />}
            <span className="min-w-0 flex-1">
              <span className="block text-corps"><span className={barres.includes(i.id) ? 'barre-lente' : ''}>{tache ? i.title : art.nom}</span></span>
              {tache && evtDe(i.event_id) && (
                <span className="mt-0.5 flex items-center gap-1 text-note font-semibold text-teinte-fonce">
                  <EventIcon event={evtDe(i.event_id)!} size={15} />
                  <span className="truncate">{evtDe(i.event_id)!.kind === 'anniversaire' ? `Anniversaire de ${evtDe(i.event_id)!.title}` : evtDe(i.event_id)!.title} · {jourCourt(nextOccurrence(evtDe(i.event_id)!))}</span>
                </span>
              )}
            </span>
            {who && <Avatar m={who} size={28} />}
          </button>
          {!tache && !editing && !attente && <Quantite qte={art.qte} nom={art.nom} onChange={(q) => changerQuantite(i, q)} onRetirer={() => retirerAnime([i.id])} />}
          {!tache && attente && art.qte && <span className="ml-2.5 mr-3 shrink-0 text-note font-bold text-brume">{art.qte}</span>}
          {editing && (
            <button onClick={() => retirerAnime([i.id])} className="presse mr-2 flex min-h-11 items-center rounded-full bg-rouge/10 px-3 text-note font-semibold text-rouge" aria-label={`Retirer ${i.title}`}>
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
            placeholder={tache ? 'Ajouter une chose à faire' : 'Un article ou un repas (ex. raclette)'}
            maxLength={80}
            // Entrée ajoute et garde le clavier pour la suite ; champ vide : le clavier se ferme
            enterKeyHint="next"
            // les courses : pas de suggestions d'iOS (parfois en anglais) au-dessus du clavier, ce sont celles de Nidoo
            {...(tache ? {} : { autoCorrect: 'off', spellCheck: false, autoComplete: 'off', name: 'nidoo-article' })}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !title.trim()) {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
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
            {saisie.qte && <span className="rounded-full bg-teinte-doux px-2 py-0.5">{saisie.qte}</span>}
            <span className="font-medium text-brume">· {rayonDe(saisie.nom).label}</span>
          </p>
        )}
        {recetteTapee && (
          <button type="button" onPointerDown={garderLeClavier} onClick={() => (select(), setRecette(recetteTapee))} className="presse anim-entre mt-3 flex w-full items-center gap-3 rounded-[18px] bg-peche-doux p-2.5 pr-3 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-carte text-[24px] shadow-carte" aria-hidden="true">{recetteTapee.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sous font-bold text-encre">Recette : {recetteTapee.nom}</span>
              <span className="block text-note text-peche-fonce">Tous les ingrédients, aux bonnes quantités pour la famille</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-peche-fonce" />
          </button>
        )}
        {/* courses : les idées rangées en trois onglets (Elisa, 21 novembre : « bien réfléchir à l'UI/UX de cette
            partie ») — une seule rangée à la fois, tout se voit en entier, la liste reste juste en dessous */}
        {!tache && !title.trim() && ongletsIdees.length > 0 && (
          <div className="mt-3">
            <div className="flex gap-1 rounded-full bg-doux p-1" role="tablist" aria-label="Idées">
              {ongletsIdees.map((o) => {
                const on = ongletVu === o.k
                return (
                  <button key={o.k} type="button" role="tab" aria-selected={on} onPointerDown={garderLeClavier} onClick={() => (select(), setOnglet(o.k))}
                    className={`presse flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-full px-2 text-note font-bold transition-[background-color,color,box-shadow] duration-200 ${on ? 'bg-carte text-teinte-fonce shadow-[0_1px_3px_rgba(29,26,43,0.1)]' : 'text-brume'}`}>
                    <span aria-hidden="true">{o.emoji}</span> {o.label}
                  </button>
                )
              })}
            </div>
            <div key={ongletVu} role="tabpanel" className="pt-3">
              {ongletVu === 'souvent' && <div className="flex flex-wrap gap-1.5">{idees.slice(0, 8).map((x, n) => idee(x, x, n))}</div>}
              {ongletVu === 'completer' && (
                <>
                  <p className="mb-2 px-1 text-note text-brume">Avec {sources.map((x) => x.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' et $1')} :</p>
                  <div className="flex flex-wrap gap-1.5">{completer8.map((x, n) => idee(x, `c-${x}`, n))}</div>
                </>
              )}
              {ongletVu === 'recettes' && (
                <div className="flex flex-col gap-1.5">
                  {recettesIdees.map(({ r, manque }, n) => (
                    <button key={r.id} type="button" onPointerDown={garderLeClavier} onClick={() => (select(), setRecette(r))} className="presse ligne-arrive-pop flex items-center gap-3 rounded-[16px] bg-[#FFF5EF] p-2 pr-3 text-left" style={{ animationDelay: `${n * 45}ms` }}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-carte text-[22px]" aria-hidden="true">{r.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sous font-bold text-encre">{r.nom}</span>
                        <span className="block text-note text-peche-fonce">{manque ? `Il manque ${manque} article${manque > 1 ? 's' : ''}` : 'De saison · tout pour le repas'}</span>
                      </span>
                      <ChevronRight size={17} className="shrink-0 text-peche-fonce" />
                    </button>
                  ))}
                  <button type="button" onPointerDown={garderLeClavier} onClick={() => (select(), setToutesRecettes(true))} className="presse mt-0.5 flex min-h-[44px] items-center justify-center gap-1.5 rounded-full text-sous font-bold text-teinte-fonce">
                    <BookOpen size={16} strokeWidth={2.4} /> Toutes les recettes <ChevronRight size={16} strokeWidth={2.6} className="fleche-signe" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
            {aVenir.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 px-1 text-note font-bold text-brume">Pour un événement ? <span className="font-medium">(facultatif)</span></p>
                <div className="no-bar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5" role="group" aria-label="Lier à un événement">
                  {aVenir.map(({ e, at }) => (
                    <button key={e.id} type="button" onPointerDown={garderLeClavier} onClick={() => (select(), setPourEvt(pourEvt === e.id ? null : e.id))} aria-pressed={pourEvt === e.id} className={`presse choix-pop flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-sous font-semibold ${pourEvt === e.id ? 'bg-teinte text-white' : 'bg-fond text-encre'}`}>
                      <EventIcon event={e} size={24} />
                      <span className="max-w-[150px] truncate">{e.kind === 'anniversaire' ? `Anniv. ${e.title}` : e.title}</span>
                      <span className={`font-medium ${pourEvt === e.id ? 'text-white/80' : 'text-brume'}`}>{jourCourt(at)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* à faire : les filtres, sur une ligne, au-dessus de la liste */}
      {tache && items.length > 0 && (
        <div role="group" aria-label="Filtrer les tâches" className="no-bar mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {/* trois filtres, pas plus (Elisa, 21 novembre) */}
          {[['toutes', 'À faire', todo.length], ['terminees', 'Terminées', done.length], ['moi', 'Pour moi', todo.filter((i) => i.assigned_to === me.id).length]].map(([id, label, n]) => (
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
            <button onClick={() => retirerAnime(done.map((d) => d.id))} className="presse min-h-11 text-sous font-semibold text-teinte">
              {tache ? 'Effacer les tâches terminées' : 'Vider le panier'}
            </button>
          </div>
          <div className="groupe mx-4 overflow-hidden shadow-carte">
            {doneVisible.map((i, k) => {
              const who = members.find((m) => m.id === i.assigned_to)
              return (
                <Glisse key={i.id} onRetirer={() => retirer([i.id])} partant={partants.includes(i.id)} label={`Glisse vers la gauche pour retirer ${i.title}`}>
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
      <AuDessus>
        {recette && <RecetteSheet key={recette.id} recette={recette} onClose={() => setRecette(null)} onAjouter={(a) => ajouterRecette(recette, a)} dejaDansLaListe={dansLaListe} />}
        {toutesRecettes && !recette && <RecettesSheet onClose={() => setToutesRecettes(false)} onChoisir={setRecette} />}
      </AuDessus>
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
    .sort(ordreAgenda)
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
                    const suite = k > 0 && jourDe(list[k - 1].at) === jourDe(at)
                    const finDuJour = k === list.length - 1 || jourDe(list[k + 1].at) !== jourDe(at)
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          tap()
                          setOpen({ e, at })
                        }}
                        className={`presse-ligne flex w-full items-center gap-3 pl-3.5 text-left ${k < list.length - 1 && finDuJour ? 'border-b border-trait' : ''}`}
                      >
                        {/* le jour une seule fois : les suivants du même jour se rangent dessous */}
                        {suite ? <span className="w-[44px] shrink-0" aria-hidden="true" /> : (
                        <span className="flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[12px] bg-fond leading-none">
                          <span className={`text-[10px] font-semibold uppercase ${today ? 'text-peche-fonce' : 'text-rouge'}`}>{at.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
                          <span className="mt-0.5 font-rond text-[19px] font-semibold">{at.getDate()}</span>
                        </span>
                        )}
                        <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3.5 ${k < list.length - 1 && !finDuJour ? 'border-b border-trait/60' : ''}`}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-corps">{e.title}</span>
                            <span className={`block text-note ${today ? 'font-semibold text-peche-fonce' : 'text-brume'}`}>
                              {(() => {
                                // « Demain · 10h00 · Tous les jeudis », « Du 28 au 29 novembre », « Samedi · chaque année » ;
                                // sous le premier du jour, le jour n'est plus répété : « 12h00 », « Toute la journée »
                                const r = rythme(e, at)
                                const rep = repeteDe(e)
                                const heure = e.all_day ? '' : timeLabel(at)
                                const quand = suite ? heure || (e.kind === 'anniversaire' ? '' : 'Toute la journée') : [at < start ? 'En ce moment' : dayLabel(at), heure].filter(Boolean).join(' · ')
                                const t = rep && rep !== 'annee' ? [quand, r].filter(Boolean).join(' · ') : r ? (at < start ? `En ce moment · ${r}` : r) : [quand, e.yearly ? 'chaque année' : ''].filter(Boolean).join(' · ')
                                return t.charAt(0).toUpperCase() + t.slice(1)
                              })()}
                            </span>
                            {e.lieu && (
                              <span className="mt-0.5 flex items-start gap-1 text-note text-teinte-fonce">
                                <MapPin size={12} strokeWidth={2.4} className="mt-[3px] shrink-0" />
                                <span className="min-w-0 break-words">{e.lieu}</span>
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

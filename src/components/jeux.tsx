import { Check, Heart, ImagePlus, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { select, success, tap } from '../lib/haptic'
import { COLS, dropCell, GAMES, isMemory, MEMORY_MAX, MEMORY_MIN, ROWS, type GameKind, type GridState, type MemoryState } from '../lib/jeux'
import { jouer } from '../lib/sons'
import { useHome } from '../lib/store'
import type { FamilyState, Game, Member, Partie } from '../lib/types'
import { aMoi, PARTIES, type PartieKind } from '../lib/parties'
import { MotCarte, MotPage } from './motmystere'
import { NewPartie, PartieView, statutPartie } from './parties'
import { ago, errorText } from '../lib/util'
import { Avatar, Btn, confirmer, Page, Sheet } from './ui'

// Jouer ensemble : Puissance 4, morpion et memory photos, contre un proche de la famille.
// On joue chacun son tour, quand on veut (la partie attend) ; si l'autre est là, ses coups arrivent en direct.

const P1 = '#FF8A7A' // corail : celui qui a invité
const P2 = '#FFC93C' // soleil : l'autre
const color = (side: number) => (side === 1 ? P1 : P2)

/** Les parties où c'est à moi de jouer. */
export const myTurns = (state: FamilyState): (Game | Partie)[] => [
  ...state.games.filter((g) => g.status === 'en_cours' && g.turn === state.me.id),
  ...state.parties.filter((p) => aMoi(p, state.me.id)),
]

const nameOf = (members: Member[], id: string | null, me: string) => (id === me ? 'Toi' : (members.find((m) => m.id === id)?.display_name ?? 'Un proche'))

function statusLine(g: Game, members: Member[], me: string) {
  const other = g.p1 === me ? g.p2 : g.p1
  const st = g.state as GridState & MemoryState
  if (g.status === 'fini') {
    if (st.abandon) {
      const quitter = g.winner === g.p1 ? g.p2 : g.winner === g.p2 ? g.p1 : null
      return !quitter ? 'Partie arrêtée' : quitter === me ? 'Tu as abandonné' : `${nameOf(members, quitter, me)} a abandonné`
    }
    if (!g.winner) return 'Égalité !'
    return g.winner === me ? 'Tu as gagné !' : `${nameOf(members, g.winner, me)} a gagné`
  }
  if (![g.p1, g.p2].includes(me)) return `Au tour de ${nameOf(members, g.turn, me)}`
  if (g.turn === me) return 'À toi de jouer'
  return `Au tour de ${nameOf(members, other, me)}`
}

// ───────── La page des jeux ─────────

type Item = { t: 'g'; g: Game } | { t: 'p'; p: Partie }
const A_DEUX: (GameKind | PartieKind)[] = ['puissance4', 'morpion', 'memory', 'bataille', 'dessin']
// (« Devine l'année » a été retiré du menu ; les parties déjà lancées s'affichent encore.)
const EN_FAMILLE: PartieKind[] = ['quidenous', 'telephone']
const meta = (k: GameKind | PartieKind) => (k in GAMES ? GAMES[k as GameKind] : PARTIES[k as PartieKind])

export function JeuxPage({ onClose, start }: { onClose: () => void; start?: string }) {
  const { state } = useHome()
  const { members, me } = state
  const [open, setOpen] = useState<string | null>(start ?? null)
  const [nouveau, setNouveau] = useState<{ k: GameKind; against?: string } | null>(null)
  const [nouvelle, setNouvelle] = useState<{ k: PartieKind; avec?: string[] } | null>(null)
  const [mot, setMot] = useState(start === 'mot')
  const items: Item[] = [...state.games.map((g) => ({ t: 'g' as const, g })), ...state.parties.map((p) => ({ t: 'p' as const, p }))].sort((a, b) =>
    (b.t === 'g' ? b.g.updated_at : b.p.updated_at).localeCompare(a.t === 'g' ? a.g.updated_at : a.p.updated_at),
  )
  const joue = (x: Item) => (x.t === 'g' ? [x.g.p1, x.g.p2].includes(me.id) : x.p.players.includes(me.id))
  const enCours = (x: Item) => (x.t === 'g' ? x.g.status : x.p.status) === 'en_cours'
  const aMoiItem = (x: Item) => (x.t === 'g' ? x.g.turn === me.id : aMoi(x.p, me.id))
  const mine = items.filter(joue)
  const aJouer = mine.filter((x) => enCours(x) && aMoiItem(x))
  const attente = mine.filter((x) => enCours(x) && !aMoiItem(x))
  const famille = items.filter((x) => enCours(x) && !joue(x))
  const finies = mine.filter((x) => !enCours(x)).slice(0, 8)
  const game = open ? state.games.find((g) => g.id === open) : null
  const partie = open ? state.parties.find((p) => p.id === open) : null

  const row = (x: Item, i: number, list: Item[]) => {
    const id = x.t === 'g' ? x.g.id : x.p.id
    const kind = x.t === 'g' ? x.g.kind : x.p.kind
    const joueurs = x.t === 'g' ? [x.g.p1, x.g.p2] : x.p.players
    const autres = joue(x) ? joueurs.filter((y) => y !== me.id) : joueurs
    const mineTurn = enCours(x) && aMoiItem(x)
    return (
      <button
        key={id}
        onClick={() => {
          tap()
          setOpen(id)
        }}
        className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left"
      >
        <span className="flex -space-x-3">
          {autres.slice(0, 3).map((y) => {
            const m = members.find((z) => z.id === y)
            return m ? <Avatar key={y} m={m} size={40} /> : null
          })}
        </span>
        <span className={`flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 ${i < list.length - 1 ? 'border-b border-trait' : ''}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sous font-semibold">
              {meta(kind).name}
              {joue(x) ? ` avec ${autres.map((y) => nameOf(members, y, me.id)).join(', ')}` : ` · ${joueurs.map((y) => nameOf(members, y, me.id)).join(', ')}`}
            </span>
            <span className={`block truncate text-note ${mineTurn ? 'font-semibold text-teinte' : 'text-brume'}`}>
              {x.t === 'g' ? statusLine(x.g, members, me.id) : statutPartie(x.p, members, me.id)} · {ago(x.t === 'g' ? x.g.updated_at : x.p.updated_at)}
            </span>
          </span>
          <img src={`./art/${meta(kind).art}.webp`} alt="" className="h-10 w-10 shrink-0 object-contain" />
        </span>
      </button>
    )
  }
  const group = (title: string, list: Item[]) =>
    list.length > 0 && (
      <>
        <p className="entete mt-6">{title}</p>
        <div className="groupe mx-4 shadow-carte">{list.map(row)}</div>
      </>
    )
  const tuile = (k: GameKind | PartieKind) => (
    <button
      key={k}
      onClick={() => {
        tap()
        if (k in GAMES) setNouveau({ k: k as GameKind })
        else setNouvelle({ k: k as PartieKind })
      }}
      className="presse groupe flex flex-col items-center px-1.5 pb-3 pt-3 text-center shadow-carte"
    >
      <img src={`./art/${meta(k).art}.webp`} alt="" className="h-[64px] w-[64px] object-contain" />
      <span className="mt-1.5 w-full truncate text-legende font-semibold">{meta(k).name}</span>
      <span className="w-full truncate text-mini text-brume">{meta(k).hint}</span>
    </button>
  )

  return (
    <>
      <Page title="Jouer ensemble" onClose={onClose}>
        <p className="-mt-1 px-5 text-sous text-brume">Chacun joue quand il veut : la partie vous attend. Et si vous êtes là en même temps, ça se joue en direct.</p>
        <MotCarte onOpen={() => setMot(true)} />
        {group('À toi de jouer', aJouer)}
        <p className="entete mt-6">À deux</p>
        <div className="mx-4 grid grid-cols-3 gap-2.5">{A_DEUX.map(tuile)}</div>
        <p className="entete mt-6">En famille</p>
        <div className="mx-4 grid grid-cols-3 gap-2.5">{EN_FAMILLE.map(tuile)}</div>
        {group('En attente', attente)}
        {group('Dans la famille', famille)}
        {group('Terminées', finies)}
        {!mine.length && !famille.length && <p className="mx-8 mb-4 mt-8 text-center text-note text-brume">Choisis un jeu, puis avec qui jouer. Une partie gagnée rapporte des étoiles à la maison.</p>}
      </Page>
      {game && <GameView game={game} onClose={() => setOpen(null)} onRematch={(k, against) => setNouveau({ k, against })} onOpen={setOpen} />}
      {partie && <PartieView partie={partie} onClose={() => setOpen(null)} onOpen={setOpen} onNouvelle={(k, avec) => setNouvelle({ k, avec })} />}
      {mot && <MotPage onClose={() => setMot(false)} />}
      {nouveau && (
        <NewGame
          kind={nouveau.k}
          against={nouveau.against}
          onClose={() => setNouveau(null)}
          onStarted={(id) => {
            setNouveau(null)
            setOpen(id)
          }}
        />
      )}
      {nouvelle && (
        <NewPartie
          kind={nouvelle.k}
          avec={nouvelle.avec}
          onClose={() => setNouvelle(null)}
          onStarted={(id) => {
            setNouvelle(null)
            setOpen(id)
          }}
        />
      )}
    </>
  )
}

// ───────── Nouvelle partie : contre qui, et au memory, avec quelles photos ─────────

type Pick = { key: string; url: string; blob?: Blob }

function NewGame({ kind, onClose, onStarted, against }: { kind: GameKind; onClose: () => void; onStarted: (id: string) => void; against?: string }) {
  const { state, api, reload, toast } = useHome()
  const { me, members } = state
  const players = members.filter((m) => m.user_id && m.id !== me.id)
  const [who, setWho] = useState<string | null>(against ?? (players.length === 1 ? players[0].id : null))
  const [picks, setPicks] = useState<Pick[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const memory = kind === 'memory'
  // Les photos déjà partagées dans la famille (le fil, les instants, la question du jour).
  const family = useMemo(() => {
    const urls = [
      ...state.moments.map((m) => m.image_url),
      ...state.drawings.map((d) => d.photo_url),
      ...state.answers.map((a) => a.photo_url),
      ...state.folderItems.map((i) => i.image_url),
    ].filter((u): u is string => !!u)
    return [...new Set(urls)].slice(0, 24)
  }, [state])
  useEffect(() => () => picks.forEach((p) => p.blob && URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (p: Pick) => {
    select()
    setPicks((all) => (all.some((x) => x.key === p.key) ? all.filter((x) => x.key !== p.key) : all.length >= MEMORY_MAX ? all : [...all, p]))
  }
  const start = async () => {
    if (!who || busy) return
    setBusy(true)
    try {
      let blobs: Blob[] | undefined
      if (memory) blobs = await Promise.all(picks.map(async (p) => p.blob ?? (await (await fetch(p.url)).blob())))
      const id = await api.startGame(state.family.id, who, kind, blobs)
      await reload()
      success()
      onStarted(id)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }
  const ready = !!who && (!memory || picks.length >= MEMORY_MIN)

  return (
    <Sheet
      title={GAMES[kind].name}
      onClose={onClose}
      tall={memory}
      footer={
        <Btn onClick={() => void start()} disabled={!ready || busy}>
          {busy ? 'Un instant…' : !who ? 'Choisis un proche' : memory && picks.length < MEMORY_MIN ? `Encore ${MEMORY_MIN - picks.length} photo${MEMORY_MIN - picks.length > 1 ? 's' : ''}` : 'Lancer la partie'}
        </Btn>
      }
    >
      <p className="text-center text-sous text-brume">Contre qui ?</p>
      {players.length ? (
        <div className="no-bar mt-3 flex justify-center gap-4 overflow-x-auto pb-1">
          {players.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                select()
                setWho(m.id)
              }}
              aria-pressed={who === m.id}
              className="presse flex w-[70px] shrink-0 flex-col items-center gap-1"
            >
              <span className={`rounded-full ${who === m.id ? 'ring-[3px] ring-teinte ring-offset-2' : ''}`}>
                <Avatar m={m} size={58} />
              </span>
              <span className={`w-full truncate text-sous ${who === m.id ? 'font-semibold text-teinte-fonce' : ''}`}>{m.display_name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-center text-note text-brume">Invite d’abord un proche dans la maison (Famille › Inviter) : il faut l’appli sur son téléphone pour jouer.</p>
      )}

      {memory && (
        <>
          <p className="mt-6 text-center text-sous font-semibold">Les photos des cartes</p>
          <p className="mt-0.5 text-center text-note text-brume">
            Choisis de {MEMORY_MIN} à {MEMORY_MAX} photos à partager : chacune fera une paire. {picks.length > 0 && `${picks.length} choisie${picks.length > 1 ? 's' : ''}.`}
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <button
              onClick={() => {
                tap()
                input.current?.click()
              }}
              className="presse flex aspect-square flex-col items-center justify-center gap-1 rounded-[14px] bg-teinte-doux text-teinte-fonce"
            >
              <ImagePlus size={24} />
              <span className="text-mini font-semibold">Mon téléphone</span>
            </button>
            {[...picks.filter((p) => p.blob), ...family.map((url) => ({ key: url, url }))].map((p) => {
              const on = picks.some((x) => x.key === p.key)
              return (
                <button key={p.key} onClick={() => toggle(p)} aria-pressed={on} className="presse relative aspect-square overflow-hidden rounded-[14px] bg-remplissage">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-teinte text-white shadow">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  )}
                  {!on && picks.length >= MEMORY_MAX && <span className="absolute inset-0 bg-white/50" />}
                </button>
              )
            })}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              setPicks((all) => [...all, ...files.slice(0, Math.max(0, MEMORY_MAX - all.length)).map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, url: URL.createObjectURL(f), blob: f }))])
            }}
          />
        </>
      )}
    </Sheet>
  )
}

// ───────── Une partie ─────────

const CSS = `
@keyframes p4tombe { from { transform: translateY(var(--de)); } 70% { transform: translateY(4%); } to { transform: translateY(0); } }
@keyframes jeupop { from { transform: scale(0.3); opacity: 0; } 70% { transform: scale(1.12); } to { transform: scale(1); opacity: 1; } }
@keyframes jeubrille { 0%, 100% { box-shadow: 0 0 0 3px #fff, 0 0 0 6px rgba(255,255,255,0); } 50% { box-shadow: 0 0 0 3px #fff, 0 0 14px 6px rgba(255,255,255,0.9); } }
`

function GameView({ game: g, onClose, onRematch, onOpen }: { game: Game; onClose: () => void; onRematch: (k: GameKind, against?: string) => void; onOpen: (id: string) => void }) {
  const { state, api, run, reload, toast } = useHome()
  const { members, me } = state
  const [busy, setBusy] = useState(false)
  const playing = [g.p1, g.p2].includes(me.id)
  const myTurn = g.status === 'en_cours' && g.turn === me.id
  const p1 = members.find((m) => m.id === g.p1)
  const p2 = members.find((m) => m.id === g.p2)
  const mem = isMemory(g.state) ? g.state : null

  // Un coup de l'autre arrive : un petit « pop » ; une victoire : le carillon.
  const seen = useRef(g.updated_at)
  useEffect(() => {
    if (seen.current === g.updated_at) return
    seen.current = g.updated_at
    if (g.status === 'fini') {
      if (g.winner === me.id) {
        success()
        jouer('etoiles')
      }
    } else jouer('geste-mot', 0.5)
  }, [g.updated_at, g.status, g.winner, me.id])

  const move = async (m: number) => {
    if (!myTurn || busy) return
    tap()
    setBusy(true)
    try {
      await api.playGame(g, m)
      await reload()
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }
  const rematch = async () => {
    const other = g.p1 === me.id ? g.p2 : g.p1
    // au memory, on choisit de nouvelles photos
    if (g.kind === 'memory') return onRematch('memory', other)
    try {
      const id = await api.startGame(state.family.id, other, g.kind)
      await reload()
      onOpen(id)
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }

  const chip = (m: Member | undefined, side: 1 | 2) => {
    const turn = g.status === 'en_cours' && g.turn === m?.id
    const score = mem ? mem.score[side - 1] : null
    return (
      <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-3 ${turn ? 'bg-white shadow-carte' : 'bg-remplissage/60'}`} style={turn ? { boxShadow: `0 0 0 2.5px ${color(side)}` } : undefined}>
        {m && <Avatar m={m} size={36} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sous font-semibold">{m ? (m.id === me.id ? 'Toi' : m.display_name) : 'Un proche'}</span>
          <span className="flex items-center gap-1 text-mini text-brume">
            {g.kind === 'morpion' ? (side === 1 ? <Heart size={11} fill={P1} color={P1} /> : <Star size={11} fill={P2} color={P2} />) : <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color(side) }} />}
            {score != null ? `${score} paire${score > 1 ? 's' : ''}` : side === 1 ? 'Commence' : 'Deuxième'}
          </span>
        </span>
      </div>
    )
  }

  return (
    <Page title={GAMES[g.kind].name} onClose={onClose} scrollKey={g.id}>
      <style>{CSS}</style>
      <div className="mx-4 flex items-center gap-2">
        {chip(p1, 1)}
        <span className="text-note font-semibold text-brume">contre</span>
        {chip(p2, 2)}
      </div>
      <p className={`mt-4 text-center font-rond text-titre3 ${myTurn ? 'text-teinte-fonce' : ''}`}>{statusLine(g, members, me.id)}</p>
      {g.status === 'en_cours' && playing && !myTurn && <p className="mt-0.5 text-center text-note text-brume">Pas besoin d’attendre ici : la partie te garde ta place.</p>}
      {g.status === 'fini' && g.winner === me.id && !(g.state as GridState).abandon && <p className="mt-0.5 text-center text-note text-brume">+2 étoiles pour la maison</p>}

      <div className="mx-4 mt-4">
        {g.kind === 'puissance4' && <Puissance4 st={g.state as GridState} canPlay={myTurn && !busy} onPlay={(c) => void move(c)} />}
        {g.kind === 'morpion' && <Morpion st={g.state as GridState} canPlay={myTurn && !busy} onPlay={(i) => void move(i)} />}
        {mem && <Memory st={mem} photos={g.photos ?? []} canPlay={myTurn && !busy} onPlay={(i) => void move(i)} members={[p1, p2]} />}
      </div>

      <div className="mx-4 mt-6 flex flex-col gap-2.5">
        {g.status === 'fini' && playing && <Btn onClick={() => void rematch()}>Revanche</Btn>}
        {g.status === 'en_cours' && playing && (
          <Btn
            kind="gris"
            onClick={async () => {
              if (await confirmer({ title: 'Abandonner la partie ?', message: 'L’autre joueur gagne.', confirm: 'Abandonner', destructive: true })) await run((a) => a.quitGame(g.id))
            }}
          >
            Abandonner
          </Btn>
        )}
      </div>
      {!playing && <p className="mx-8 mt-4 text-center text-note text-brume">Tu regardes la partie : encourage-les !</p>}
    </Page>
  )
}

function Puissance4({ st, canPlay, onPlay }: { st: GridState; canPlay: boolean; onPlay: (col: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="relative mx-auto max-w-[420px] rounded-[26px] p-2.5" style={{ background: 'linear-gradient(160deg, #A08BF0, #7A5AE0)', boxShadow: '0 10px 24px rgba(90,60,190,0.28), inset 0 2px 0 rgba(255,255,255,0.35)' }}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {st.g.map((v, i) => {
          const row = Math.floor(i / COLS)
          const col = i % COLS
          const win = st.line?.includes(i)
          const last = st.last === i
          const style: CSSProperties = v
            ? {
                background: `radial-gradient(circle at 35% 30%, #fff8 0, transparent 38%), ${color(v)}`,
                boxShadow: win ? undefined : 'inset 0 -3px 0 rgba(0,0,0,0.12)',
                animation: [last ? 'p4tombe 0.45s cubic-bezier(.3,.6,.4,1)' : '', win ? 'jeubrille 1.4s ease-in-out infinite' : ''].filter(Boolean).join(', ') || undefined,
                ['--de' as string]: `-${(row + 1) * 115}%`,
              }
            : { background: hover === col && canPlay ? 'rgba(255,255,255,0.55)' : 'rgba(40,20,110,0.35)', boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.25)' }
          return <span key={i} className="block aspect-square rounded-full" style={style} />
        })}
      </div>
      {/* une colonne entière se touche */}
      <div className="absolute inset-2.5 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            aria-label={`Colonne ${c + 1}`}
            disabled={!canPlay || dropCell(st.g, c) < 0}
            onPointerEnter={() => setHover(c)}
            onPointerLeave={() => setHover(null)}
            onClick={() => onPlay(c)}
            className="h-full w-full disabled:cursor-default"
          />
        ))}
      </div>
      <span className="sr-only">{ROWS} rangées</span>
    </div>
  )
}

function Morpion({ st, canPlay, onPlay }: { st: GridState; canPlay: boolean; onPlay: (cell: number) => void }) {
  return (
    <div className="mx-auto grid max-w-[340px] grid-cols-3 gap-2 rounded-[26px] p-2.5" style={{ background: '#BFE6D2', boxShadow: '0 10px 24px rgba(40,120,90,0.18)' }}>
      {st.g.map((v, i) => {
        const win = st.line?.includes(i)
        return (
          <button
            key={i}
            disabled={!canPlay || v !== 0}
            onClick={() => onPlay(i)}
            aria-label={v ? (v === 1 ? 'Cœur' : 'Étoile') : `Case ${i + 1}`}
            className="presse flex aspect-square items-center justify-center rounded-[18px] bg-[#FFF8EC] disabled:cursor-default"
            style={{ boxShadow: win ? '0 0 0 3px #fff, 0 0 18px rgba(255,255,255,0.9)' : 'inset 0 -3px 0 rgba(0,0,0,0.06)' }}
          >
            {v !== 0 && (
              <span className="block" style={{ animation: st.last === i ? 'jeupop 0.35s ease-out' : undefined }}>
                {v === 1 ? <Heart size={54} fill={P1} color="#E8695A" strokeWidth={1.5} /> : <Star size={56} fill={P2} color="#E6A800" strokeWidth={1.5} />}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Memory({ st, photos, canPlay, onPlay, members }: { st: MemoryState; photos: (string | null)[]; canPlay: boolean; onPlay: (i: number) => void; members: (Member | undefined)[] }) {
  const cols = 4
  return (
    <div className="mx-auto grid max-w-[420px] gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {st.found.map((card, i) => {
        const open = st.open.find((o) => o.i === i)
        const face = card ? card.f : open ? open.f : null
        const who = card ? members[card.p - 1] : null
        return (
          <button
            key={i}
            disabled={!canPlay || !!card || !!(open && st.open.length === 1)}
            onClick={() => onPlay(i)}
            aria-label={face != null ? `Carte retournée ${i + 1}` : `Carte ${i + 1}`}
            className="presse relative aspect-[3/4] overflow-hidden rounded-[14px] disabled:cursor-default"
            style={{
              background: face != null ? '#fff' : 'linear-gradient(150deg, #B9A6F5, #7A5AE0)',
              boxShadow: open && !card ? `0 0 0 3px ${color(st.open.length === 2 && st.open[0].f !== st.open[1].f ? 1 : 2)}` : '0 4px 10px rgba(60,40,140,0.18)',
              opacity: card ? 0.92 : 1,
            }}
          >
            {face != null ? (
              <img src={photos[face] ?? ''} alt="" className="h-full w-full object-cover" style={{ animation: open ? 'jeupop 0.3s ease-out' : undefined }} />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <img src="./panda.webp" alt="" className="h-[46%] w-[46%] rounded-[10px] opacity-90 shadow" />
              </span>
            )}
            {who && (
              <span className="absolute bottom-1 right-1">
                <Avatar m={who} size={22} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ───────── L'entrée « Jouer ensemble » (carte) ─────────

export function JeuxCard({ onOpen }: { onOpen: () => void }) {
  const { state } = useHome()
  const turns = myTurns(state)
  const live = state.games.filter((g) => g.status === 'en_cours' && [g.p1, g.p2].includes(state.me.id)).length + state.parties.filter((p) => p.status === 'en_cours' && p.players.includes(state.me.id)).length
  return (
    <button
      onClick={() => {
        tap()
        onOpen()
      }}
      className="presse mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[28px] bg-white p-4 text-left shadow-carte"
    >
      <span className="flex -space-x-4">
        {(Object.keys(GAMES) as GameKind[]).map((k) => (
          <img key={k} src={`./art/${GAMES[k].art}.webp`} alt="" className="h-12 w-12 object-contain" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-rond text-titre3">Jouer ensemble</span>
        <span className={`block text-note ${turns.length ? 'font-semibold text-teinte' : 'text-brume'}`}>
          {turns.length ? `${turns.length} partie${turns.length > 1 ? 's' : ''} t’attend${turns.length > 1 ? 'ent' : ''}` : live ? `${live} partie${live > 1 ? 's' : ''} en cours` : 'Mot mystère, bataille navale, Qui de nous ?…'}
        </span>
      </span>
      {turns.length > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rouge px-1.5 text-mini font-bold text-white">{turns.length}</span>}
    </button>
  )
}

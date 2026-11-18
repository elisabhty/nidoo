import { Check, ImagePlus, Lightbulb, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { select, success, tap } from '../lib/haptic'
import {
  aMoi,
  ANNEE_PHOTOS,
  attendus,
  BN,
  PARTIES,
  PHRASES_DEMO,
  questionsAuHasard,
  QUESTIONS_QDN,
  quiDeNous,
  type AnneeState,
  type BatailleState,
  type Dessin,
  type DessinState,
  type PartieKind,
  type QdnState,
  type Secret,
  type TelState,
} from '../lib/parties'
import { jouer } from '../lib/sons'
import { shareInvite } from '../lib/share'
import { useHome } from '../lib/store'
import type { Member, Partie } from '../lib/types'
import { errorText } from '../lib/util'
import { Ardoise, DessinVue } from './ardoise'
import { Avatar, Btn, confirmer, Confettis, LigneSous, Page, Sheet } from './ui'

// Les jeux à plusieurs : bataille navale, Qui de nous ?, dessine et devine, devine l'année, téléphone dessiné.
// Chacun joue quand il veut ; ce qui doit rester caché (bateaux, mot à dessiner, votes, années, carnets)
// arrive par secretPartie, seulement pour soi.

const VIOLET = '#7A5AE0'
const CORAIL = '#FF8A7A'

const nom = (members: Member[], id: string | null | undefined, me: string) => (id === me ? 'Toi' : (members.find((m) => m.id === id)?.display_name ?? 'Un proche'))
const noms = (ids: string[], members: Member[], me: string) => {
  const l = ids.map((x) => nom(members, x, me))
  return l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`
}

/** Une phrase pour dire où en est une partie. */
export function statutPartie(p: Partie, members: Member[], me: string) {
  const s = p.state as { abandon?: boolean; par?: string }
  if (p.status === 'fini') {
    if (s.abandon) return s.par === me ? 'Tu as arrêté la partie' : `${nom(members, s.par, me)} a arrêté la partie`
    if (p.kind === 'quidenous') return `Terminée · ${(p.state as QdnState).accords} fois tous d’accord`
    if (p.kind === 'dessin') return `Terminée · ${(p.state as DessinState).trouves} dessins trouvés sur ${(p.state as DessinState).n}`
    if (p.kind === 'telephone') return 'L’album est prêt !'
    if (!p.winner) return 'Égalité !'
    return p.winner === me ? 'Tu as gagné !' : `${nom(members, p.winner, me)} a gagné`
  }
  if (aMoi(p, me)) return 'À toi de jouer'
  if (PARTIES[p.kind].max === 2 && p.turn && p.turn !== me) return `Au tour de ${nom(members, p.turn, me)}`
  const att = attendus(p).filter((x) => x !== me)
  return att.length ? `En attente de ${noms(att, members, me)}` : 'En cours'
}

// ───────── Nouvelle partie ─────────

type Pick = { key: string; url: string; blob?: Blob; annee: number }

export function NewPartie({ kind, onClose, onStarted, avec }: { kind: PartieKind; onClose: () => void; onStarted: (id: string) => void; avec?: string[] }) {
  const { state, api, reload, toast } = useHome()
  const { me, members } = state
  const meta = PARTIES[kind]
  const proches = members.filter((m) => m.user_id && m.id !== me.id)
  const seul = meta.max === 2
  const [who, setWho] = useState<string[]>(avec ?? (seul && proches.length === 1 ? [proches[0].id] : !seul ? proches.slice(0, meta.max - 1).map((m) => m.id) : []))
  const [picks, setPicks] = useState<Pick[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const annee = kind === 'annee'
  const family = useMemo(() => {
    const urls = [...state.moments.map((m) => m.image_url), ...state.folderItems.map((i) => i.image_url), ...state.answers.map((a) => a.photo_url)].filter((u): u is string => !!u)
    return [...new Set(urls)].slice(0, 24)
  }, [state])
  useEffect(() => () => picks.forEach((p) => p.blob && URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleWho = (id: string) => {
    select()
    if (seul) return setWho([id])
    setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length >= meta.max - 1 ? w : [...w, id]))
  }
  const togglePick = (p: Pick) => {
    select()
    setPicks((all) => (all.some((x) => x.key === p.key) ? all.filter((x) => x.key !== p.key) : all.length >= ANNEE_PHOTOS ? all : [...all, p]))
  }
  const an = new Date().getFullYear()
  const nbJoueurs = who.length + 1
  const ready = nbJoueurs >= meta.min && nbJoueurs <= meta.max && (!annee || picks.length >= 1)

  const start = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      let blobs: Blob[] | undefined
      let setup: Record<string, unknown> = {}
      if (annee) {
        blobs = await Promise.all(picks.map(async (p) => p.blob ?? (await (await fetch(p.url)).blob())))
        setup = { annees: picks.map((p) => p.annee) }
      }
      if (kind === 'quidenous') setup = { q: questionsAuHasard() }
      const id = await api.startPartie(state.family.id, kind, who, setup, blobs)
      await reload()
      success()
      onStarted(id)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  const manque = meta.min - nbJoueurs
  // pas assez de proches dans la maison pour ce jeu (le téléphone se joue à 3 ou plus)
  const pasAssez = proches.length < meta.min - 1
  const inviter = async () => {
    tap()
    const f = state.family
    if (!f.invite_code || new Date(f.invite_expires_at).getTime() < Date.now()) return toast('Le code a expiré : crée-en un nouveau dans Famille.')
    if ((await shareInvite(f.name, f.invite_code)) === 'copie') toast('Invitation copiée')
  }
  return (
    <Sheet
      title={meta.name}
      onClose={onClose}
      tall={annee}
      footer={
        pasAssez ? (
          <Btn onClick={() => void inviter()}>Inviter mes proches</Btn>
        ) : (
        <Btn onClick={() => void start()} disabled={!ready || busy}>
          {busy ? 'Un instant…' : manque > 0 ? `Choisis encore ${manque} proche${manque > 1 ? 's' : ''}` : annee && !picks.length ? 'Choisis au moins une photo' : 'Lancer la partie'}
        </Btn>
        )
      }
    >
      {pasAssez && proches.length > 0 && (
        <p className="mb-4 rounded-[18px] bg-teinte-doux px-4 py-3 text-center text-sous text-teinte-fonce">
          Ce jeu se joue à {meta.min} ou plus, toi compris. Il manque encore {meta.min - 1 - proches.length} proche{meta.min - 1 - proches.length > 1 ? 's' : ''} dans la maison : invite-les, puis revenez jouer !
        </p>
      )}
      <p className="text-center text-sous text-brume">{seul ? 'Avec qui ?' : `Qui joue ? (${meta.min} joueurs ou plus, toi compris)`}</p>
      {proches.length ? (
        <div className="no-bar mt-3 flex justify-center gap-4 overflow-x-auto pb-1">
          {proches.map((m) => {
            const on = who.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggleWho(m.id)} aria-pressed={on} className="presse flex w-[70px] shrink-0 flex-col items-center gap-1">
                <span className={`relative rounded-full ${on ? 'ring-[3px] ring-teinte ring-offset-2' : ''}`}>
                  <Avatar m={m} size={58} />
                  {on && !seul && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-teinte text-white ring-2 ring-white">
                      <Check size={12} strokeWidth={3.2} />
                    </span>
                  )}
                </span>
                <span className={`w-full truncate text-sous ${on ? 'font-semibold text-teinte-fonce' : ''}`}>{m.display_name}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-3 text-center text-note text-brume">Invite d’abord des proches dans la maison (Famille › Inviter) : il faut l’appli sur son téléphone pour jouer.</p>
      )}
      {kind === 'quidenous' && <p className="mt-5 text-center text-note text-brume">{QUESTIONS_QDN.length > 0 && `${quiDeNous(nbJoueurs)} ${QUESTIONS_QDN[0]} ?`} Huit questions, chacun retourne en secret la carte de quelqu’un, puis on découvre les choix.</p>}
      {kind === 'telephone' && <p className="mt-5 text-center text-note text-brume">Chacun écrit une phrase, le suivant la dessine, le suivant devine le dessin… À la fin, on découvre ce que sont devenues les phrases.</p>}
      {kind === 'dessin' && <p className="mt-5 text-center text-note text-brume">Quatre manches : l’un dessine un mot, l’autre a trois essais pour le deviner, puis on échange.</p>}
      {kind === 'bataille' && <p className="mt-5 text-center text-note text-brume">Chacun place ses 4 bateaux (au hasard, on peut mélanger), puis on tire chacun son tour. Le premier qui coule toute la flotte gagne.</p>}

      {annee && (
        <>
          <p className="mt-6 text-center text-sous font-semibold">Les photos à dater</p>
          <p className="mt-0.5 text-center text-note text-brume">De 1 à {ANNEE_PHOTOS} photos. Indique l’année de chacune : elle reste secrète jusqu’aux réponses.</p>
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
            {[...picks.filter((p) => p.blob), ...family.map((url) => ({ key: url, url, annee: 2000 }))].map((p) => {
              const on = picks.some((x) => x.key === p.key)
              return (
                <button key={p.key} onClick={() => togglePick(p)} aria-pressed={on} className="presse relative aspect-square overflow-hidden rounded-[14px] bg-remplissage">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-teinte text-white shadow">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {picks.map((p, i) => (
            <div key={p.key} className="groupe mt-2.5 flex items-center gap-3 p-2 shadow-carte">
              <img src={p.url} alt="" className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
              <AnneePicker value={p.annee} max={an} onChange={(y) => setPicks((all) => all.map((x, k) => (k === i ? { ...x, annee: y } : x)))} />
            </div>
          ))}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              setPicks((all) => [...all, ...files.slice(0, Math.max(0, ANNEE_PHOTOS - all.length)).map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, url: URL.createObjectURL(f), blob: f, annee: 2000 }))])
            }}
          />
        </>
      )}
    </Sheet>
  )
}

function AnneePicker({ value, onChange, max }: { value: number; onChange: (y: number) => void; max: number }) {
  const set = (d: number) => {
    select()
    onChange(Math.min(max, Math.max(1850, value + d)))
  }
  const b = 'presse flex h-9 min-w-9 items-center justify-center rounded-full bg-teinte-doux px-2 text-sous font-semibold text-teinte-fonce'
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
      <button className={b} onClick={() => set(-10)} aria-label="Dix ans plus tôt">−10</button>
      <button className={b} onClick={() => set(-1)} aria-label="Un an plus tôt">−1</button>
      <span className="min-w-[64px] text-center font-rond text-titre2 tabular-nums">{value}</span>
      <button className={b} onClick={() => set(1)} aria-label="Un an plus tard">+1</button>
      <button className={b} onClick={() => set(10)} aria-label="Dix ans plus tard">+10</button>
    </div>
  )
}

// ───────── Une partie ─────────

export function PartieView({ partie: p, onClose, onOpen, onNouvelle }: { partie: Partie; onClose: () => void; onOpen: (id: string) => void; onNouvelle: (k: PartieKind, avec: string[]) => void }) {
  const { state, api, run, reload, toast } = useHome()
  const { members, me } = state
  const [sec, setSec] = useState<Secret>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const playing = p.players.includes(me.id)

  const refresh = useCallback(async () => {
    if (!playing) return
    try {
      setSec(await api.secretPartie(p))
    } catch {
      /* le secret reviendra au prochain coup */
    }
  }, [api, p, playing])
  useEffect(() => {
    void refresh()
  }, [refresh, p.updated_at])

  const seen = useRef(p.updated_at)
  useEffect(() => {
    if (seen.current === p.updated_at) return
    seen.current = p.updated_at
    if (p.status === 'fini' && p.winner === me.id) {
      success()
      jouer('etoiles')
    } else if (p.status !== 'fini') jouer('geste-mot', 0.5)
  }, [p.updated_at, p.status, p.winner, me.id])

  const act = async (a: Record<string, unknown>) => {
    if (busy) return null
    setBusy(true)
    try {
      const r = await api.actPartie(p, a)
      await reload()
      await refresh()
      return r
    } catch (e) {
      toast(errorText(e), 'err')
      return null
    } finally {
      setBusy(false)
    }
  }
  const dire = (t: string) => {
    setMsg(t)
    window.setTimeout(() => setMsg((m) => (m === t ? null : m)), 2600)
  }
  const autres = p.players.filter((x) => x !== me.id)
  const revanche = async () => {
    if (p.kind === 'annee') return onNouvelle('annee', autres)
    try {
      const id = await api.startPartie(state.family.id, p.kind, autres, p.kind === 'quidenous' ? { q: questionsAuHasard() } : {})
      await reload()
      onOpen(id)
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }
  const att = attendus(p)
  const deux = PARTIES[p.kind].max === 2
  const finiAuDebut = useRef(p.status === 'fini')

  return (
    <Page title={PARTIES[p.kind].name} onClose={onClose} scrollKey={p.id}>
      <style>{CSS}</style>
      <div className="mx-4 flex flex-wrap justify-center gap-2 pb-1">
        {p.players.map((x) => {
          const m = members.find((y) => y.id === x)
          const doit = p.status === 'en_cours' && att.includes(x)
          return (
            <div key={x} className={`flex shrink-0 items-center gap-2 rounded-full bg-white p-1 pr-3 ${doit ? 'shadow-carte' : ''}`} style={doit ? { boxShadow: `0 0 0 2.5px ${VIOLET}` } : undefined}>
              {m && <Avatar m={m} size={34} />}
              <span className="text-sous font-semibold">{nom(members, x, me.id)}</span>
              {p.status === 'en_cours' && !doit && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teinte text-white" aria-label="a joué">
                  <Check size={12} strokeWidth={3.2} />
                </span>
              )}
            </div>
          )
        })}
      </div>
      {p.status === 'en_cours' && !deux && <p className="mt-1 text-center text-mini text-brume">Entouré : doit jouer · ✓ : a déjà joué</p>}
      <p className={`mt-4 px-4 text-center font-rond text-titre3 ${aMoi(p, me.id) ? 'text-teinte-fonce' : ''}`}>{statutPartie(p, members, me.id)}</p>
      {p.status === 'fini' && p.winner && !(p.state as { abandon?: boolean }).abandon && (
        <LigneSous>{p.winner === me.id ? 'Bravo ! +2 étoiles pour la maison' : 'Bien joué ! La maison gagne quand même 2 étoiles'}</LigneSous>
      )}
      {p.status === 'fini' && p.winner === me.id && !(p.state as { abandon?: boolean }).abandon && !finiAuDebut.current && <Confettis />}
      {msg && <p className="anim-pop mx-auto mt-2 w-fit rounded-full bg-teinte px-4 py-1.5 text-sous font-semibold text-white">{msg}</p>}

      <div className="mx-4 mt-4">
        {p.kind === 'bataille' && <Bataille p={p} sec={sec} me={me.id} members={members} busy={busy} act={act} dire={dire} />}
        {p.kind === 'quidenous' && <QuiDeNous p={p} sec={sec} me={me.id} members={members} busy={busy} act={act} dire={dire} />}
        {p.kind === 'dessin' && <DessineDevine p={p} sec={sec} me={me.id} members={members} busy={busy} act={act} dire={dire} />}
        {p.kind === 'annee' && <DevineAnnee p={p} sec={sec} me={me.id} members={members} busy={busy} act={act} />}
        {p.kind === 'telephone' && <Telephone p={p} sec={sec} me={me.id} members={members} busy={busy} act={act} />}
      </div>

      <div className="mx-4 mb-4 mt-6 flex flex-col gap-2.5">
        {p.status === 'fini' && playing && <Btn onClick={() => void revanche()}>{deux ? 'Revanche' : 'Rejouer'}</Btn>}
        {p.status === 'fini' && (
          <Btn kind="gris" onClick={onClose}>
            Autres jeux
          </Btn>
        )}
        {p.status === 'en_cours' && playing && (
          <Btn
            kind="gris"
            onClick={async () => {
              const ok = await confirmer(
                deux
                  ? { title: 'Abandonner la partie ?', message: 'L’autre joueur gagne.', confirm: 'Abandonner', destructive: true }
                  : { title: 'Arrêter la partie ?', message: 'Elle s’arrête pour tout le monde.', confirm: 'Arrêter', destructive: true },
              )
              if (ok) await run((a) => a.quitPartie(p.id))
            }}
          >
            {deux ? 'Abandonner' : 'Arrêter la partie'}
          </Btn>
        )}
      </div>
      {!playing && <p className="mx-8 mb-4 text-center text-note text-brume">Tu regardes la partie : encourage-les !</p>}
    </Page>
  )
}

const CSS = `
@keyframes carteRetourne { from { transform: rotateY(90deg); } to { transform: rotateY(0deg); } }
@keyframes plouf { 0% { transform: scale(0.2); opacity: 0; } 60% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(1); } }
`

type Props = { p: Partie; sec: Secret; me: string; busy: boolean; act: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>; members?: Member[]; dire?: (t: string) => void }

// ───────── Bataille navale ─────────

function Plateau({ tirs, flotte, coules, dernier, onTir, titre, petit }: { tirs: number[]; flotte?: number[][]; coules: number[][]; dernier?: number | null; onTir?: (c: number) => void; titre: string; petit?: boolean }) {
  const bateau = new Set((flotte ?? []).flat())
  const coule = new Set(coules.flat())
  return (
    <div>
      <p className="mb-1.5 text-center text-note font-semibold uppercase tracking-[0.04em] text-brume">{titre}</p>
      <div className={`mx-auto grid gap-[3px] rounded-[18px] p-2 ${petit ? 'max-w-[230px]' : 'max-w-[360px]'}`} style={{ gridTemplateColumns: `repeat(${BN}, 1fr)`, background: 'linear-gradient(160deg, #8EC9F2, #5B9FE0)', boxShadow: '0 8px 20px rgba(40,100,180,0.25)' }}>
        {tirs.map((v, i) => {
          const b = bateau.has(i)
          const k = coule.has(i)
          const bg = k ? '#C9483B' : v === 2 ? CORAIL : b ? '#F4E7D3' : 'rgba(255,255,255,0.22)'
          return (
            <button
              key={i}
              disabled={!onTir || v !== 0}
              onClick={() => onTir?.(i)}
              aria-label={`Case ${String.fromCharCode(65 + Math.floor(i / BN))}${(i % BN) + 1}${v === 1 ? ', dans l’eau' : v === 2 ? ', touché' : ''}`}
              className="relative flex aspect-square items-center justify-center rounded-[6px] disabled:cursor-default"
              style={{ background: bg, boxShadow: dernier === i ? '0 0 0 2px #fff' : b && !v ? 'inset 0 -2px 0 rgba(120,80,40,0.25)' : undefined }}
            >
              {v === 1 && <span className="block h-[30%] w-[30%] rounded-full bg-white" style={{ animation: dernier === i ? 'plouf 0.4s ease-out' : undefined }} />}
              {v === 2 && <span className="text-[13px] font-black leading-none text-white" style={{ animation: dernier === i ? 'plouf 0.4s ease-out' : undefined }}>✕</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Bataille({ p, sec, me, members, busy, act, dire }: Props) {
  const s = p.state as BatailleState
  const side = p.players.indexOf(me) + 1
  const other = 3 - side
  if (!side) {
    return (
      <div className="flex flex-col gap-4">
        <Plateau titre="Plateau 1" tirs={s.b1} coules={s.s1} />
        <Plateau titre="Plateau 2" tirs={s.b2} coules={s.s2} />
      </div>
    )
  }
  const mesTirs = other === 1 ? s.b1 : s.b2
  const sesTirs = side === 1 ? s.b1 : s.b2
  if (s.phase === 'placement') {
    const pret = s.pret[side - 1]
    return (
      <div>
        <Plateau titre="Tes bateaux" tirs={sesTirs} flotte={sec.flotte} coules={[]} />
        {!pret ? (
          <div className="mt-4 flex gap-2.5">
            <Btn kind="teinte" className="flex-1" disabled={busy} onClick={() => void act({ t: 'melanger' }).then(() => tap())}>
              <RotateCcw size={17} /> Mélanger
            </Btn>
            <Btn className="flex-1" disabled={busy || !sec.flotte} onClick={() => void act({ t: 'pret' })}>
              Je suis prêt
            </Btn>
          </div>
        ) : (
          <p className="mt-4 text-center text-note text-brume">Tes bateaux sont prêts. La bataille commence dès que l’autre est prêt aussi.</p>
        )}
      </div>
    )
  }
  const tir = async (c: number) => {
    tap()
    const r = await act({ t: 'tir', c })
    if (!r) return
    if (r.gagne) return
    if (r.r === 'coule') {
      jouer('geste-courage', 0.7)
      dire?.('Coulé !')
    } else if (r.r === 'touche') {
      jouer('geste-coeur', 0.6)
      dire?.('Touché !')
    } else {
      jouer('arrosage', 0.5)
      dire?.('Dans l’eau…')
    }
  }
  const monTour = p.status === 'en_cours' && p.turn === me && !busy
  const coulesChezLui = (other === 1 ? s.s1 : s.s2).length
  const coulesChezMoi = (side === 1 ? s.s1 : s.s2).length
  return (
    <div className="flex flex-col gap-5">
      {p.status === 'en_cours' && (
        <p className="-mb-2 text-center text-note text-brume">
          {monTour ? 'Touche une case de la grande grille pour tirer.' : 'Tu tireras au prochain tour.'} ● dans l’eau · ✕ touché · rouge : coulé
        </p>
      )}
      <Plateau titre={`Les bateaux de ${nom(members ?? [], p.players[other - 1], me)} · ${coulesChezLui} coulé${coulesChezLui > 1 ? 's' : ''} sur 4`} tirs={mesTirs} coules={other === 1 ? s.s1 : s.s2} dernier={s.dernier?.par === side ? s.dernier.c : null} onTir={monTour ? (c) => void tir(c) : undefined} />
      <Plateau petit titre={`Tes bateaux · ${coulesChezMoi} coulé${coulesChezMoi > 1 ? 's' : ''} sur 4`} tirs={sesTirs} flotte={sec.flotte} coules={side === 1 ? s.s1 : s.s2} dernier={s.dernier?.par === other ? s.dernier.c : null} />
    </div>
  )
}

// ───────── Qui de nous ? ─────────

function Carte({ m, me, face = true, on = false, dim = false, small = false, onClick, disabled, children }: { m?: Member; me: string; face?: boolean; on?: boolean; dim?: boolean; small?: boolean; onClick?: () => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`presse relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-[18px] p-2 transition-opacity disabled:cursor-default ${dim ? 'opacity-40' : ''}`}
      style={{
        background: face ? '#FFFDF8' : 'linear-gradient(150deg, #B9A6F5, #7A5AE0)',
        boxShadow: on ? `0 0 0 3px #fff, 0 0 0 6px ${VIOLET}` : '0 6px 14px rgba(60,40,140,0.16), inset 0 -3px 0 rgba(0,0,0,0.05)',
        animation: 'carteRetourne 0.35s ease-out',
      }}
    >
      {face && m ? (
        <>
          <Avatar m={m} size={small ? 42 : 64} />
          <span className="w-full truncate text-center text-sous font-semibold">{m.id === me ? 'Moi' : m.display_name}</span>
        </>
      ) : (
        <span className="font-rond text-[40px] font-bold text-white/90">?</span>
      )}
      {children}
    </button>
  )
}

function QuiDeNous({ p, sec, me, members = [], busy, act, dire }: Props) {
  const s = p.state as QdnState
  const n = p.players.length
  const joueurs = p.players.map((x) => members.find((m) => m.id === x))
  const aVote = s.votes.includes(me)
  const derniere = s.rondes[s.rondes.length - 1]
  const playing = p.players.includes(me)

  const vote = async (cible: string) => {
    select()
    const r = await act({ t: 'vote', cible })
    if (r && !r.revele) dire?.('C’est noté ! Ton choix reste secret.')
    if (r?.revele && r.accord) jouer('etoiles', 0.6)
  }

  const resultat = (r: typeof derniere, titre: string) => {
    const parCible = new Map<string, string[]>()
    for (const [voteur, cible] of Object.entries(r.v)) parCible.set(cible, [...(parCible.get(cible) ?? []), voteur])
    return (
      <div className="groupe mt-4 p-3.5 shadow-carte">
        <p className="text-note font-semibold uppercase tracking-[0.04em] text-brume">{titre}</p>
        <p className="mt-0.5 font-rond text-appel">
          {quiDeNous(n)} {QUESTIONS_QDN[r.q] ?? '…'}{'\u00a0'}?
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[...parCible.entries()]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([cible, voteurs]) => (
              <div key={cible} className="flex flex-col items-center">
                <Carte m={members.find((m) => m.id === cible)} me={me} small />
                <span className="mt-1 flex -space-x-2">
                  {voteurs.map((v) => {
                    const m = members.find((x) => x.id === v)
                    return m ? <Avatar key={v} m={m} size={22} /> : null
                  })}
                </span>
              </div>
            ))}
        </div>
        <p className={`mt-3 text-center text-sous font-semibold ${r.accord ? 'text-teinte-fonce' : 'text-brume'}`}>{r.accord ? 'Tous d’accord ! +1 étoile pour la maison' : 'Les avis sont partagés'}</p>
      </div>
    )
  }

  if (p.status === 'fini') {
    const total = new Map<string, number>()
    for (const r of s.rondes) for (const c of Object.values(r.v)) total.set(c, (total.get(c) ?? 0) + 1)
    const top = [...total.entries()].sort((a, b) => b[1] - a[1])[0]
    return (
      <div>
        {top && (
          <div className="flex flex-col items-center">
            <div className="w-[120px]">
              <Carte m={members.find((m) => m.id === top[0])} me={me} />
            </div>
            <p className="mt-2 text-center text-sous text-brume">La personne la plus désignée : {nom(members, top[0], me)} ({top[1]} fois)</p>
          </div>
        )}
        {[...s.rondes].reverse().map((r, i) => (
          <div key={i}>{resultat(r, `Question ${s.rondes.length - i}`)}</div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-[26px] px-5 py-5 text-center shadow-carte" style={{ background: 'linear-gradient(160deg, #F3EEFF, #FFF1EC)' }}>
        <p className="text-note font-semibold uppercase tracking-[0.04em] text-teinte">
          Question {s.i + 1} sur {s.q.length}
        </p>
        <p className="mt-1 font-rond text-titre2">
          {quiDeNous(n)} {QUESTIONS_QDN[s.q[s.i]] ?? '…'}{'\u00a0'}?
        </p>
      </div>
      {playing && !aVote && <p className="mt-4 text-center text-sous text-brume">Touche la carte de ton choix : personne ne la verra avant que tout le monde ait choisi.</p>}
      {playing && aVote && <p className="mt-4 text-center text-sous text-brume">C’est noté ! Les cartes se dévoilent quand tout le monde a choisi.</p>}
      <div className={`mt-3 grid gap-2 ${n <= 2 ? 'grid-cols-2 px-8' : n === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {joueurs.map((m, i) => {
          const choisi = sec.vote === p.players[i]
          return (
            <Carte key={p.players[i]} m={m} me={me} small={n > 3} on={choisi} dim={aVote && !choisi} disabled={!playing || aVote || busy} onClick={() => void vote(p.players[i])}>
              {aVote && choisi && <span className="mt-0.5 rounded-full bg-teinte px-2 py-0.5 text-mini font-bold text-white">Ton choix</span>}
            </Carte>
          )
        })}
      </div>
      {derniere && resultat(derniere, 'La question d’avant')}
    </div>
  )
}

// ───────── Dessine et devine ─────────

function DessineDevine({ p, sec, me, members = [], busy, act, dire }: Props) {
  const s = p.state as DessinState
  const [d, setD] = useState<Dessin>([])
  const [essai, setEssai] = useState('')
  const dessinateur = p.players[s.i % 2]
  const moiDessine = dessinateur === me
  const monTour = p.status === 'en_cours' && p.turn === me

  const devine = async () => {
    if (!essai.trim()) return
    const r = await act({ t: 'devine', mot: essai })
    setEssai('')
    if (!r) return
    if (r.trouve) {
      jouer('etoiles', 0.6)
      dire?.(`Bravo, c’était « ${String(r.mot)} » !`)
    } else if (r.mot) dire?.(`Raté… c’était « ${String(r.mot)} »`)
    else dire?.(`Non… encore ${String(r.reste)} essai${Number(r.reste) > 1 ? 's' : ''}`)
  }

  return (
    <div>
      {p.status === 'en_cours' && (
        <p className="mb-3 text-center text-note text-brume">
          Manche {s.i + 1} sur {s.n} · {s.trouves} trouvé{s.trouves > 1 ? 's' : ''}
        </p>
      )}
      {p.status === 'en_cours' && s.phase === 'dessin' && moiDessine && monTour && (
        <div>
          <div className="mb-3 flex items-center gap-3 rounded-[22px] bg-[#FFF6DA] p-3 pl-4">
            <span className="min-w-0 flex-1">
              <span className="block text-note text-[#A0670A]">Dessine, sans écrire de lettres :</span>
              <span className="block font-rond text-titre2">{sec.mot ?? '…'}</span>
            </span>
            <button
              disabled={busy}
              onClick={() => {
                tap()
                setD([])
                void act({ t: 'autre' })
              }}
              className="presse h-9 shrink-0 rounded-full bg-white px-3.5 text-sous font-semibold text-[#A0670A] shadow-carte"
            >
              Autre mot
            </button>
          </div>
          <Ardoise value={d} onChange={setD} />
          <p className="mt-2 text-center text-note text-brume">Ensuite, {nom(members, p.players.find((x) => x !== me), me)} voit ton dessin et a 3 essais pour trouver le mot.</p>
          <Btn
            className="mt-3"
            disabled={!d.length || busy}
            onClick={async () => {
              if (await act({ t: 'dessin', d })) {
                setD([])
                success()
              }
            }}
          >
            Envoyer le dessin
          </Btn>
        </div>
      )}
      {p.status === 'en_cours' && s.phase === 'dessin' && !moiDessine && <p className="py-8 text-center text-sous text-brume">{nom(members, dessinateur, me)} dessine… Tu devineras dès que c’est envoyé.</p>}
      {p.status === 'en_cours' && s.phase === 'devine' && (
        <div>
          <DessinVue d={s.dessin} className="shadow-carte" />
          {s.essais.length > 0 && (
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              {s.essais.map((e, i) => (
                <span key={i} className="rounded-full bg-remplissage px-3 py-1 text-note text-brume line-through">
                  {e}
                </span>
              ))}
            </div>
          )}
          {monTour ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void devine()
              }}
            >
              <input value={essai} onChange={(e) => setEssai(e.target.value)} placeholder="C’est…" maxLength={40} className="h-12 min-w-0 flex-1 rounded-full bg-remplissage px-4 text-corps outline-none" aria-label="Ta réponse" />
              <button type="submit" disabled={!essai.trim() || busy} className="presse ios-primary h-12 shrink-0 rounded-full px-5 text-sous font-semibold text-white disabled:opacity-40">
                Proposer
              </button>
            </form>
          ) : (
            // celui qui devine, en direct : son personnage, ses propositions, et « … » pendant qu'il cherche
            <div className="mt-4">
              <div className="flex items-end gap-2.5">
                {(() => {
                  const g = members.find((x) => x.id === p.turn)
                  return g ? <Avatar m={g} size={44} /> : null
                })()}
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-1.5">
                  {s.essais.map((e, i) => (
                    <span key={i} className="anim-pop rounded-[18px] rounded-bl-md bg-white px-3.5 py-2 text-sous font-semibold text-encre shadow-carte">
                      <span className="line-through decoration-[#FF8A7A] decoration-2">{e}</span> <span className="text-[#E0604F]">✗</span>
                    </span>
                  ))}
                  <span className="flex h-9 items-center gap-1 rounded-[18px] rounded-bl-md bg-white px-3.5 shadow-carte" aria-label={`${nom(members, p.turn, me)} cherche`}>
                    {[0, 1, 2].map((k) => (
                      <span key={k} className="h-2 w-2 rounded-full bg-brume" style={{ animation: `points 1.2s ${k * 0.18}s ease-in-out infinite` }} />
                    ))}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-center text-note text-brume">
                {nom(members, p.turn, me)} cherche ton dessin · {3 - s.essais.length} essai{3 - s.essais.length > 1 ? 's' : ''} restant{3 - s.essais.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
          {monTour && <p className="mt-1.5 text-center text-note text-brume">{3 - s.essais.length} essai{3 - s.essais.length > 1 ? 's' : ''} pour trouver</p>}
        </div>
      )}
      {s.rondes.length > 0 && (
        <>
          <p className="entete mt-6">Les dessins</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[...s.rondes].reverse().map((r, i) => (
              <div key={i} className="groupe p-2 shadow-carte">
                <DessinVue d={r.dessin} />
                <p className="mt-1.5 truncate text-sous font-semibold">{r.mot}</p>
                <p className={`text-mini ${r.trouve ? 'text-teinte' : 'text-brume'}`}>
                  par {nom(members, r.par, me)} · {r.trouve ? 'trouvé' : 'pas trouvé'}
                </p>
                {r.essais?.length > 0 && <p className="mt-0.5 truncate text-mini text-brume">Propositions : {r.essais.join(', ')}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ───────── Devine l'année ─────────

function DevineAnnee({ p, sec, me, members = [], busy, act }: Props) {
  const s = p.state as AnneeState
  const hote = p.players[0] === me
  const an = new Date().getFullYear()
  const [rep, setRep] = useState<number[]>(() => s.photos.map(() => 2000))
  const photo = (i: number) => p.photos?.[i] ?? null

  if (p.status === 'fini' && s.annees) {
    const classement = Object.entries(s.totaux ?? {}).sort((a, b) => a[1] - b[1])
    return (
      <div>
        {classement.length > 0 && (
          <div className="groupe p-3.5 shadow-carte">
            <p className="text-note font-semibold uppercase tracking-[0.04em] text-brume">Le classement (écart total)</p>
            {classement.map(([id, tot], k) => {
              const m = members.find((x) => x.id === id)
              return (
                <div key={id} className="mt-2 flex items-center gap-2.5">
                  <span className="w-5 text-center font-rond text-appel text-brume">{k + 1}</span>
                  {m && <Avatar m={m} size={32} />}
                  <span className="min-w-0 flex-1 truncate text-sous font-semibold">{nom(members, id, me)}</span>
                  <span className="text-sous text-brume">{tot === 0 ? 'pile !' : `${tot} an${tot > 1 ? 's' : ''}`}</span>
                </div>
              )
            })}
          </div>
        )}
        {s.photos.map((_, i) => (
          <div key={i} className="groupe mt-3 overflow-hidden shadow-carte">
            {photo(i) && <img src={photo(i)!} alt="" className="max-h-[300px] w-full object-cover" />}
            <div className="p-3">
              <p className="font-rond text-titre3">C’était en {s.annees![i]}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(s.reponses ?? {}).map(([id, r]) => (
                  <span key={id} className="rounded-full bg-remplissage px-2.5 py-1 text-note">
                    {nom(members, id, me)} : {r[i]}
                    {r[i] === s.annees![i] ? ' · pile !' : ` · à ${Math.abs(r[i] - s.annees![i])} an${Math.abs(r[i] - s.annees![i]) > 1 ? 's' : ''}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (hote) {
    return (
      <div>
        <p className="text-center text-sous text-brume">
          {s.fait.length} réponse{s.fait.length > 1 ? 's' : ''} sur {p.players.length - 1}. Les années restent secrètes jusqu’à la fin.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {s.photos.map((_, i) => (
            <div key={i} className="groupe overflow-hidden shadow-carte">
              {photo(i) && <img src={photo(i)!} alt="" className="aspect-square w-full object-cover" />}
              <p className="p-2 text-center font-rond text-appel">{sec.annees?.[i] ?? '…'}</p>
            </div>
          ))}
        </div>
        {p.status === 'en_cours' && s.fait.length > 0 && s.fait.length < p.players.length - 1 && (
          <Btn kind="teinte" className="mt-4" disabled={busy} onClick={() => void act({ t: 'reveler' })}>
            Dévoiler sans attendre les autres
          </Btn>
        )}
      </div>
    )
  }
  const fait = s.fait.includes(me)
  return (
    <div>
      <p className="text-center text-sous text-brume">{fait ? 'Tes réponses sont envoyées. On découvre les années quand tout le monde a répondu.' : `${nom(members, p.players[0], me)} a partagé ${s.photos.length > 1 ? 'ces photos' : 'cette photo'}. En quelle année ?`}</p>
      {s.photos.map((_, i) => (
        <div key={i} className="groupe mt-3 overflow-hidden shadow-carte">
          {photo(i) && <img src={photo(i)!} alt="" className="max-h-[320px] w-full object-cover" />}
          <div className="p-3">
            {fait ? (
              <p className="text-center font-rond text-titre3">Ta réponse : {sec.mes?.[i] ?? '…'}</p>
            ) : (
              <AnneePicker value={rep[i]} max={an} onChange={(y) => setRep((r) => r.map((x, k) => (k === i ? y : x)))} />
            )}
          </div>
        </div>
      ))}
      {!fait && p.status === 'en_cours' && (
        <Btn className="mt-4" disabled={busy} onClick={() => void act({ t: 'reponses', r: rep }).then((r) => r && success())}>
          Envoyer {s.photos.length > 1 ? 'mes réponses' : 'ma réponse'}
        </Btn>
      )}
    </div>
  )
}

// ───────── Le téléphone dessiné ─────────

function Telephone({ p, sec, me, members = [], busy, act }: Props) {
  const s = p.state as TelState
  const n = p.players.length
  const etape = sec.etapes?.[0]
  const [txt, setTxt] = useState('')
  const [d, setD] = useState<Dessin>([])
  const envoyer = async (v: string | Dessin) => {
    if (!etape) return
    if (await act({ t: 'etape', k: etape.k, v })) {
      setTxt('')
      setD([])
      success()
    }
  }

  if (p.status === 'fini' && s.album) {
    return (
      <div className="flex flex-col gap-4">
        {s.album.map((carnet, k) => (
          <div key={k} className="groupe p-3 shadow-carte">
            <p className="text-note font-semibold uppercase tracking-[0.04em] text-brume">{p.players[k] === me ? 'Ton carnet' : `Le carnet de ${nom(members, p.players[k], me)}`}</p>
            {carnet.map((e, j) => {
              const m = members.find((x) => x.id === e.par)
              return (
                <div key={j} className="mt-2.5 flex gap-2">
                  {m && <Avatar m={m} size={28} />}
                  {typeof e.v === 'string' ? (
                    <p className={`min-w-0 flex-1 rounded-[16px] px-3 py-2 text-corps ${j === 0 ? 'bg-teinte-doux font-semibold' : 'bg-remplissage'}`}>{e.v}</p>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <DessinVue d={e.v} className="ring-1 ring-black/5" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-3">
        {s.avance.map((j, k) => {
          const m = members.find((x) => x.id === p.players[k])
          return (
            <div key={k} className="flex flex-col items-center gap-1">
              {m && <Avatar m={m} size={30} />}
              <span className="flex gap-0.5">
                {Array.from({ length: n }, (_, x) => (
                  <span key={x} className="block h-1.5 w-1.5 rounded-full" style={{ background: x < j ? VIOLET : '#DDD8EA' }} />
                ))}
              </span>
            </div>
          )
        })}
      </div>
      {etape ? (
        <div className="mt-5">
          {etape.j === 0 && (
            <>
              <p className="text-center text-sous font-semibold">Commence ton carnet : une phrase à faire dessiner</p>
              <div className="mt-2 flex gap-2">
                <input value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={90} placeholder="Un chat qui fait du ski…" className="h-12 min-w-0 flex-1 rounded-full bg-remplissage px-4 text-corps outline-none" aria-label="Ta phrase" />
                <button
                  aria-label="Une idée"
                  onClick={() => {
                    tap()
                    setTxt(PHRASES_DEMO[Math.floor(Math.random() * PHRASES_DEMO.length)])
                  }}
                  className="presse flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF6DA] text-[#A0670A]"
                >
                  <Lightbulb size={20} />
                </button>
              </div>
            </>
          )}
          {etape.j % 2 === 1 && (
            <>
              <p className="text-center text-note text-brume">Dessine cette phrase :</p>
              <p className="mb-3 mt-0.5 text-center font-rond text-titre3">« {String(etape.avant ?? '')} »</p>
              <Ardoise value={d} onChange={setD} />
            </>
          )}
          {etape.j > 0 && etape.j % 2 === 0 && (
            <>
              <p className="mb-2 text-center text-sous font-semibold">Qu’est-ce que ce dessin représente ?</p>
              <DessinVue d={etape.avant as Dessin} className="shadow-carte" />
              <input value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={90} placeholder="Je dirais…" className="mt-3 h-12 w-full rounded-full bg-remplissage px-4 text-corps outline-none" aria-label="Ta devinette" />
            </>
          )}
          <Btn className="mt-3" disabled={busy || (etape.j % 2 === 1 ? !d.length : txt.trim().length < 2)} onClick={() => void envoyer(etape.j % 2 === 1 ? d : txt)}>
            {etape.j % 2 === 1 ? 'Envoyer le dessin' : 'Envoyer'}
          </Btn>
          {(sec.etapes?.length ?? 0) > 1 && <p className="mt-2 text-center text-note text-brume">Encore {(sec.etapes?.length ?? 1) - 1} carnet{(sec.etapes?.length ?? 1) > 2 ? 's' : ''} après celui-ci.</p>}
        </div>
      ) : (
        p.status === 'en_cours' && <p className="mt-6 text-center text-sous text-brume">Les carnets circulent… On découvrira l’album quand chacun sera passé dans tous les carnets.</p>
      )}
    </div>
  )
}

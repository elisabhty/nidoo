import { AlignLeft, Cake, CalendarDays, CalendarPlus, Camera, Check, Plus, ChevronDown, ChevronRight, Clock, X, Images, MapPin, Navigation, PenLine, Repeat, Share, Sticker as StickerIcon, Trash2, Undo2, Users } from 'lucide-react'
import { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react'
import { rebond } from '../lib/rebond'
import { moodOf, MOODS, THOUGHTS, thoughtOf } from '../lib/data'
import { Smiley } from './Smiley'
import { coeurs, confettis } from '../lib/fete'
import { feel, select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import { partagerTexte } from '../lib/share'
import { ouvrirLieu } from '../lib/plans'
import { useLienTaches } from '../lib/lienTaches'
import { ChampLieu } from './champLieu'
import type { EventKind, FamEvent, Member, Repete, Sticker, ThoughtKind } from '../lib/types'
import { chargerImage, photoFinale, vignettesFiltres, type FiltreKey } from '../lib/filtres'
import { MAX_STICKERS } from '../lib/stickers'
import { CadreCanvas, CadreRow, FilterRow, nouveauSticker, StickerStage, StickerImg, StickerTray } from './stickers'
import { vignettesCadres } from '../lib/cadres'
import { compressImage, errorText, finDe, isToday, joursEnPlus, nextOccurrence, repeteDe, REPETITIONS, rythme, timeLabel } from '../lib/util'
import { useRepetitions } from '../lib/repeter'
import { ajouterAuCalendrier, titreCalendrier } from '../lib/calendrier'
import { estFerie, prochainsJoursSpeciaux } from '../lib/joursSpeciaux'
import { anniversaireDe } from '../lib/naissance'
import { IncomingDrawing, markDrawingsSeen, useUnseenDrawings } from './drawing'
import { DrawSheet } from './planche'
import { Art, Avatar, Btn, confirmer, Envol, Segments, Sheet, Switch, ChampRequis, CHAMP_REQUIS } from './ui'

// ───────── Humeur du jour ─────────

export function MoodSheet({ onClose, member }: { onClose: () => void; member?: Member }) {
  const { state, run } = useHome()
  const who = member ?? state.me
  const mine = who.id === state.me.id
  const current = isToday(who.mood_at) ? who.mood : null
  const [mood, setMood] = useState<string | null>(current)
  const [note, setNote] = useState(current ? (who.mood_note ?? '') : '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const ok = await run((api) => api.setMood(who.id, mood, note.trim() || null), mood ? (mine ? 'Ton humeur est partagée' : `Humeur de ${who.display_name} partagée`) : 'Humeur effacée')
    setBusy(false)
    if (ok) {
      success()
      if (mood) coeurs(null, 14)
      onClose()
    }
  }

  return (
    <Sheet title={mine ? 'Mon humeur du jour' : `Humeur de ${who.display_name}`} onClose={onClose}>
      <p className="text-center text-sous text-brume">{mine ? 'Ta famille la verra sur la maison. Aucune obligation, juste des nouvelles.' : `${who.display_name} n’a pas de téléphone : dis à la famille comment il ou elle va aujourd’hui.`}</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {MOODS.map((m) => {
          const on = mood === m.key
          return (
            <button
              key={m.key}
              onClick={(e) => {
                select()
                if (!on) coeurs(e.currentTarget, 6)
                setMood(on ? null : m.key)
              }}
              aria-pressed={on}
              className={`presse flex flex-col items-center gap-1 rounded-[20px] pb-2.5 pt-2 ${on ? 'bg-teinte-doux ring-2 ring-teinte' : 'bg-carte'}`}
            >
              <span className="flex h-14 w-14 items-center justify-center">
                <span key={on ? 'on' : 'off'} className={on ? 'saut' : ''}><Smiley mood={m.key} size={44} /></span>
              </span>
              <span className={`text-legende ${on ? 'font-semibold text-teinte-fonce' : 'font-medium text-encre'}`}>{m.label}</span>
            </button>
          )
        })}
      </div>
      <input className="champ mt-4 !bg-carte" placeholder="Un petit mot pour aller avec (facultatif)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
      <Btn className="mt-4" onClick={save} disabled={busy || (!mood && !current)}>
        {mood ? (mine ? 'Partager mon humeur' : 'Partager son humeur') : current ? 'Effacer l’humeur' : mine ? 'Choisis ton humeur' : 'Choisis son humeur'}
      </Btn>
    </Sheet>
  )
}

// ───────── Photo surprise / petit mot au mur ─────────

export function ComposeSheet({ onClose, challenge, startWith = 'photo' }: { onClose: () => void; challenge?: string; startWith?: 'photo' | 'mot' }) {
  const { state, run, toast } = useHome()
  // la photo d'origine ; celle qu'on montre est filtrée, les stickers sont collés au moment d'envoyer
  const [orig, setOrig] = useState<Blob | null>(null)
  const [shown, setShown] = useState<Blob | null>(null)
  const [ratio, setRatio] = useState(4 / 3)
  const [f, setF] = useState<FiltreKey>('aucun')
  const [vignettes, setVignettes] = useState<Record<FiltreKey, string> | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [tray, setTray] = useState(false)
  const [fr, setFr] = useState<string | undefined>()
  const [onglet, setOnglet] = useState<'filtres' | 'cadres'>('filtres')
  const [vCadres, setVCadres] = useState<Record<string, string> | null>(null)
  const hist = useRef<Sticker[][]>([])
  const [, setHistN] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (shown ? URL.createObjectURL(shown) : null), [shown])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  // la feuille des stickers : 1000 de large, la hauteur suit la photo
  const SW = 1000
  const SH = Math.round(SW / ratio)

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const blob = await compressImage(file)
      const img = await chargerImage(blob)
      setRatio(img.naturalWidth / img.naturalHeight)
      URL.revokeObjectURL(img.src)
      setOrig(blob)
      setShown(blob)
      setF('aucun')
      setFr(undefined)
      chargerImage(blob)
        .then((im) => vignettesCadres(1000, Math.round(1000 / (im.naturalWidth / im.naturalHeight)), im, 90).finally(() => URL.revokeObjectURL(im.src)))
        .then(setVCadres)
        .catch(() => setVCadres(null))
      setStickers([])
      hist.current = []
      setHistN(0)
      setSel(null)
      vignettesFiltres(blob).then(setVignettes).catch(() => setVignettes(null))
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }
  const filtrer = async (k: FiltreKey) => {
    if (!orig || k === f) return
    try {
      setShown(await photoFinale(orig, k))
      setF(k)
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }
  const snap = () => {
    hist.current.push(stickers)
    setHistN(hist.current.length)
  }
  const addSticker = (key: string, t?: string, c?: number) => {
    if (stickers.length >= MAX_STICKERS) return toast('Ta photo est couverte de stickers !', 'err')
    snap()
    setStickers([...stickers, nouveauSticker(key, SW, SH, stickers.length, t, c)])
    setSel(stickers.length)
    setTray(false)
  }
  const send = async () => {
    setBusy(true)
    let blob: Blob | undefined
    try {
      blob = orig ? await photoFinale(orig, f, stickers, fr) : undefined
    } catch (e) {
      toast(errorText(e), 'err')
      setBusy(false)
      return
    }
    const ok = await run(
      (api) => api.postMoment(state.family.id, state.me.id, { blob, body, challenge }),
      blob ? 'Photo partagée avec la famille' : 'Petit mot partagé',
    )
    setBusy(false)
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet title={challenge ? 'Défi photo' : startWith === 'mot' ? 'Petit mot' : 'Photo surprise'} onClose={onClose}>
      {challenge && (
        <div className="mb-3 flex items-center gap-3 rounded-[18px] bg-peche-doux px-3.5 py-3">
          <Art name="picto-photo" size={36} />
          <p className="text-sous font-semibold">{challenge}</p>
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0]).then(() => (e.target.value = ''))} />

      {preview ? (
        <>
          <div
            className="relative mx-auto overflow-hidden rounded-groupe bg-remplissage"
            style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(46vh * ${ratio}))` }}
            onPointerDown={() => {
              setSel(null)
              setTray(false)
            }}
          >
            <img src={preview} alt="Aperçu de la photo" className="absolute inset-0 h-full w-full object-cover" />
            <CadreCanvas fr={fr} W={SW} H={SH} />
            <StickerStage
              W={SW}
              H={SH}
              k={stickers}
              setK={setStickers}
              sel={sel}
              setSel={setSel}
              begin={snap}
              end={(changed) => {
                if (!changed) {
                  hist.current.pop()
                  setHistN(hist.current.length)
                }
              }}
            />
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setOrig(null)
                setShown(null)
                setStickers([])
                setTray(false)
              }}
              className="presse verre absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-encre"
              aria-label="Retirer la photo"
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                select()
                setTray(!tray)
                setSel(null)
              }}
              aria-pressed={tray}
              className={`presse flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sous font-semibold shadow-carte transition-colors ${tray ? 'bg-teinte text-white' : 'bg-carte text-teinte'}`}
            >
              <StickerIcon size={17} strokeWidth={2.3} /> Ajouter des stickers
            </button>
            <button
              onClick={() => {
                const h = hist.current.pop()
                if (h) setStickers(h)
                setSel(null)
                setHistN(hist.current.length)
              }}
              disabled={!hist.current.length}
              className="presse flex h-10 w-10 items-center justify-center rounded-full bg-carte text-encre shadow-carte disabled:opacity-35"
              aria-label="Annuler"
            >
              <Undo2 size={17} strokeWidth={2.4} />
            </button>
          </div>
          {tray ? (
            <StickerTray onPick={addSticker} onClose={() => setTray(false)} />
          ) : (
            <div className="mt-3">
              <div className="mb-1.5 flex gap-1.5 px-1">
                {(
                  [
                    ['filtres', 'Filtres'],
                    ['cadres', 'Cadres'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => {
                      select()
                      setOnglet(k)
                    }}
                    aria-pressed={onglet === k}
                    className={`min-h-11 rounded-full px-3.5 text-note font-semibold transition-colors ${onglet === k ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {onglet === 'filtres' ? <FilterRow f={f} setF={(k) => void filtrer(k)} vignettes={vignettes} /> : <CadreRow fr={fr} setFr={setFr} vignettes={vCadres} />}
            </div>
          )}
        </>
      ) : (
        <div className="groupe">
          <button onClick={() => camera.current?.click()} className="presse-ligne flex h-[52px] w-full items-center gap-3 border-b border-trait px-4 text-corps text-teinte">
            <Camera size={22} /> Prendre une photo
          </button>
          <button onClick={() => gallery.current?.click()} className="presse-ligne flex h-[52px] w-full items-center gap-3 px-4 text-corps text-teinte">
            <Images size={22} /> Choisir dans la photothèque
          </button>
        </div>
      )}
      <textarea
        className="champ mt-3 resize-none !bg-carte"
        rows={preview ? 2 : 3}
        maxLength={280}
        placeholder={preview ? 'Ajouter une légende' : 'Ou écris juste un petit mot à toute la famille'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus={startWith === 'mot'}
      />
      <Btn className="mt-3" onClick={send} disabled={busy || (!orig && !body.trim())}>
        {busy ? 'Envoi…' : 'Envoyer à la famille'}
      </Btn>
    </Sheet>
  )
}

// ───────── On pense à toi ─────────

const thoughtDrafts = new Map<string, {target?: string; kind: ThoughtKind; message: string}>()

export function ThoughtSheet({ onClose, to }: { onClose: () => void; to?: Member }) {
  const { state, run } = useHome()
  const others = state.members.filter((m) => m.id !== state.me.id)
  const draftKey = `${state.family.id}:${state.me.id}:${to?.id ?? 'libre'}`
  const draft = thoughtDrafts.get(draftKey)
  const [target, setTarget] = useState<Member | undefined>(to ?? others.find(m => m.id === draft?.target) ?? (others.length === 1 ? others[0] : undefined))
  const [kind, setKind] = useState<ThoughtKind>(draft?.kind ?? 'coeur')
  const [message, setMessage] = useState(draft?.message ?? '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const art = message.trim() ? 'geste-mot' : `geste-${kind}`

  useEffect(() => {if(!sent) thoughtDrafts.set(draftKey,{target:target?.id,kind,message})}, [draftKey,target?.id,kind,message,sent])
  const send = async () => {
    if (!target || busy) return
    setBusy(true)
    const k: ThoughtKind = message.trim() ? 'mot' : kind
    const ok = await run((api) => api.sendThought(state.family.id, state.me.id, target.id, k, message))
    setBusy(false)
    if (ok) {
      success()
      thoughtDrafts.delete(draftKey)
      setSent(true)
    }
  }

  if (sent && target) {
    return (
      <>
        <Envol art={art} />
        <Sheet title="Envoyé" onClose={onClose}>
          <div className="flex flex-col items-center pb-6 pt-3 text-center">
            <span className="anim-bat">
              <Avatar m={target} size={92} />
            </span>
            <p className="mt-4 font-rond text-titre2">{target.display_name} va le recevoir</p>
            <p className="mt-1 text-sous text-brume">Sans un mot de plus, juste une présence.</p>
          </div>
          <Btn onClick={onClose}>C’est fait</Btn>
        </Sheet>
      </>
    )
  }

  return (
    <Sheet title="Faire signe" onClose={() => {if(!busy) onClose()}}>
      {others.length === 0 ? (
        <p className="px-4 py-8 text-center text-sous text-brume">Invite d’abord un proche dans la maison pour lui envoyer une attention.</p>
      ) : (
        <>
          <div className="no-bar -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 pt-1.5">
            {others.map((m) => {
              const on = target?.id === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    select()
                    setTarget(m)
                  }}
                  aria-pressed={on}
                  className="presse flex w-[66px] shrink-0 flex-col items-center gap-2"
                >
                  <Avatar m={m} size={60} ring={on} mood />
                  <span className={`w-full truncate text-center text-legende ${on ? 'font-semibold text-encre' : 'text-brume'}`}>{m.display_name}</span>
                </button>
              )
            })}
          </div>
          {target && isToday(target.mood_at) && moodOf(target.mood) && (
            <div className="anim-entre mt-3 flex items-center gap-3 rounded-[18px] bg-carte px-3.5 py-2.5 shadow-carte">
              <Avatar m={target} size={42} mood />
              <p className="min-w-0 flex-1 text-sous">
                Humeur de {target.display_name} aujourd’hui : <span className="font-semibold">{moodOf(target.mood)!.label}</span>
                {target.mood_note && <span className="block truncate text-note text-brume">« {target.mood_note} »</span>}
              </p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {THOUGHTS.map((t) => {
              const on = kind === t.key && !message.trim()
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    select()
                    setKind(t.key)
                  }}
                  aria-pressed={on}
                  className={`presse flex flex-col items-center gap-1.5 rounded-[20px] px-1 pb-2.5 pt-3 ${on ? 'bg-teinte-doux ring-2 ring-teinte' : 'bg-carte'}`}
                >
                  <Art name={`geste-${t.key}`} size={50} />
                  <span className={`text-center text-mini leading-tight ${on ? 'font-semibold text-teinte-fonce' : 'font-medium'}`}>{t.label}</span>
                </button>
              )
            })}
          </div>
          <textarea aria-label="Ton petit mot" rows={3} className="champ mt-3 !bg-carte resize-none" placeholder="Ou glisse-lui un petit mot" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Btn className="mt-4" onClick={send} disabled={busy} manque={!target ? 'le proche à qui l’envoyer' : null}>
            {busy ? 'Envoi…' : target ? `Envoyer à ${target.display_name}` : 'Choisis un proche'}
          </Btn>
        </>
      )}
    </Sheet>
  )
}

// ───────── Attentions reçues ─────────

export function Incoming({ onClose }: {onClose?: () => void}) {
  const { state, run } = useHome()
  const [reply, setReply] = useState<string | null | undefined>(undefined)
  const drawings = useUnseenDrawings(state)
  const unseen = state.thoughts.filter((t) => t.to_member === state.me.id && !t.seen_at)
  const t = unseen[unseen.length - 1] // la plus ancienne d'abord
  const id = t?.id
  const kind = t?.kind
  useEffect(() => {
    if (id && kind) feel(kind)
  }, [id, kind])
  const sheet = reply !== undefined && <DrawSheet to={reply} onClose={() => {setReply(undefined); onClose?.()}} />
  if (!t) {
    const d = drawings[0]
    if (!d || reply !== undefined) return sheet || null
    return (
      <IncomingDrawing
        d={d}
        more={drawings.length - 1}
        onLater={onClose}
        onSeen={() => {markDrawingsSeen([d.id]); onClose?.()}}
        onReply={() => {
          markDrawingsSeen([d.id])
          setReply(d.to_member ? d.from_member : null)
        }}
      />
    )
  }
  const from = state.members.find((m) => m.id === t.from_member)
  if (!from) return null
  const th = thoughtOf(t.kind)
  const art = `geste-${t.kind}`
  const seen = async () => {if(await run((api) => api.markSeen([t.id]))) onClose?.()}
  const back = async () => {
    const ok = await run(async (api) => {
      await api.markSeen([t.id])
      await api.sendThought(state.family.id, state.me.id, from.id, 'calin')
    }, `Câlin envoyé à ${from.display_name}`)
    if(ok) onClose?.()
  }

  if (reply !== undefined) return sheet || null
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-9" role="dialog" aria-modal="true" aria-label="Attention reçue">
      <div className="anim-fondu absolute inset-0 bg-black/35 backdrop-blur-md" />
      <Envol art={art} />
      <div className="anim-pop relative z-[60] w-full max-w-[310px] rounded-[34px] bg-fond px-5 pb-5 pt-7 text-center shadow-[0_30px_80px_-20px_rgba(29,26,43,0.5)]">
        <div className="relative mx-auto w-fit">
          <span className="anim-bat inline-block">
            <Avatar m={from} size={96} />
          </span>
          <Art name={art} size={46} className="absolute -bottom-2 -right-4 drop-shadow-md" />
        </div>
        <p className="mt-4 font-rond text-titre2">
          {from.display_name} {th.said}
        </p>
        {t.message && <p className="mt-3 rounded-[18px] bg-carte px-4 py-3 text-corps">« {t.message} »</p>}
        <Btn className="mt-5" onClick={back}>Lui renvoyer un câlin</Btn>
        <Btn kind="gris" className="mt-2" onClick={seen}>
          {unseen.length > 1 ? `Suivant (${unseen.length - 1} de plus)` : `Merci, ${from.display_name}`}
        </Btn>
        {onClose && <button onClick={onClose} className="mt-1 min-h-11 text-sous text-teinte-fonce">Revoir plus tard</button>}
      </div>
    </div>
  )
}

/** Une ligne de la carte d'un événement : une icône, puis le texte. */
function Info({ icone, children, fleche, dernier }: { icone: React.ReactNode; children: React.ReactNode; fleche?: boolean; dernier?: boolean }) {
  return (
    <div className="flex items-start gap-3 pl-4">
      <span className="mt-[13px] flex h-[22px] w-[22px] shrink-0 items-center justify-center text-teinte">{icone}</span>
      <div className={`flex min-w-0 flex-1 items-center gap-2 py-3 pr-4 text-corps ${dernier ? '' : 'border-b border-trait'}`}>
        <div className="min-w-0 flex-1">{children}</div>
        {fleche && <ChevronRight size={17} className="shrink-0 text-pale" />}
      </div>
    </div>
  )
}

// ───────── Nouvel événement ─────────

const KINDS: { key: EventKind; label: string; art: string; aide: string; exemple: string }[] = [
  { key: 'evenement', label: 'Événement', art: 'picto-fete', aide: 'Un moment en famille : un repas, une sortie, les vacances…', exemple: 'Quoi ? Ex. : Repas chez Mamie' },
  { key: 'rdv', label: 'Rendez-vous', art: 'picto-lieu', aide: 'Un rendez-vous à une heure précise : médecin, école, coiffeur…', exemple: 'Quoi ? Ex. : Dentiste de Léa' },
  { key: 'anniversaire', label: 'Anniversaire', art: 'picto-gateau', aide: 'Il revient tout seul chaque année, à la même date.', exemple: 'Anniversaire de… (son prénom)' },
]
export const eventArt = (k: string) => KINDS.find((x) => x.key === k)?.art ?? 'picto-fete'
export function EventIcon({event,size=34,className=''}:{event:Pick<FamEvent,'kind'|'sticker'>;size?:number;className?:string}) {
  return event.sticker ? <StickerImg cle={event.sticker} className={`object-contain ${className}`} style={{width:size,height:size}} /> : <Art name={eventArt(event.kind)} size={size} className={className} />
}
/** Ce qu'on peut mettre dans l'agenda (pour les raccourcis « Ajouter »). */
export const TYPES_AGENDA = KINDS.map((k) => ({ key: k.key, label: k.label, art: k.art }))
const LIEU_EXEMPLE: Record<string, string> = { evenement: 'Ex. : Chez Mamie, à Lyon', rdv: 'Ex. : Cabinet du Dr Martin', anniversaire: 'Où se fête-t-il ?' }

/** Qui est concerné (Elisa, 21 novembre : « les personnes concernées, de manière UI UX ») : une rangée de têtes,
 *  comme pour partager à quelqu'un sur iPhone. « Toute la famille » d'abord ; toucher une tête la coche. */
export const WhoPicker = memo(function WhoPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { state } = useHome()
  const all = value.length === 0
  return (
    <div className="no-bar -mx-4 flex gap-1 overflow-x-auto px-3 pb-0.5 pt-1" role="group" aria-label="Les personnes concernées">
      <Bulle on={all} nom="Toute la famille" onClick={() => (select(), onChange([]))}>
        <span className="flex h-full w-full items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce">
          <Users size={22} strokeWidth={2.3} />
        </span>
      </Bulle>
      {state.members.map((m) => {
        const on = value.includes(m.id)
        return (
          <Bulle key={m.id} on={on} nom={m.id === state.me.id ? 'Moi' : m.display_name} onClick={() => (select(), onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id]))}>
            <Avatar m={m} size={50} />
          </Bulle>
        )
      })}
    </div>
  )
})

/** Une tête qu'on coche : un anneau violet et une petite coche qui arrive avec un rebond. */
function Bulle({ on, nom, onClick, children, taille = 50 }: { on: boolean; nom: string; onClick: () => void; children: React.ReactNode; taille?: number }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="presse flex w-[66px] shrink-0 flex-col items-center gap-1.5 py-1">
      <span className={`choix-pop relative rounded-full p-[3px] transition-shadow duration-200 ${on ? 'shadow-[0_0_0_2px_#7050D5]' : ''}`} data-on={on}>
        <span className="block overflow-hidden rounded-full" style={{ width: taille, height: taille }}>{children}</span>
        {on && (
          <span className="anim-pop absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-teinte text-white">
            <Check size={11} strokeWidth={3.4} />
          </span>
        )}
      </span>
      <span className={`line-clamp-2 w-full break-words text-center text-[12px] leading-[1.2] ${on ? 'font-bold text-teinte-fonce' : 'font-medium text-brume'}`}>{nom}</span>
    </button>
  )
}

/** Les proches concernés, chacun avec sa tête et son prénom. */
export function WhoList({ ids }: { ids: string[] }) {
  const { state } = useHome()
  const people = ids.length ? state.members.filter((m) => ids.includes(m.id)) : []
  if (!people.length)
    return (
      <div className="groupe flex items-center gap-3 px-4 py-3">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce">
          <Users size={18} strokeWidth={2.4} />
        </span>
        <p className="min-w-0 flex-1 text-corps">Toute la famille</p>
      </div>
    )
  return (
    <div className="groupe">
      {people.map((m, i) => (
        <div key={m.id} className="flex items-center gap-3 pl-4">
          <Avatar m={m} size={36} mood />
          <p className={`min-w-0 flex-1 py-3 pr-4 text-corps ${i < people.length - 1 ? 'border-b border-trait' : ''}`}>
            {m.display_name}
            {m.id === state.me.id && <span className="text-brume"> (moi)</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

/** Une carte de la fiche « Nouvel événement » : blanche, sans trait, une ombre à peine là (Elisa, 21 novembre :
 *  « alléger les bordures et les ombres »). */
const CarteEvt = forwardRef<HTMLElement, { children: React.ReactNode; className?: string }>(function CarteEvt({ children, className = '' }, ref) {
  return <section ref={ref} className={`carte-evt mt-3 rounded-[20px] bg-carte p-4 ${className}`}>{children}</section>
})
function TitreCarte({ icone: I, titre, extra }: { icone: typeof CalendarDays; titre: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-teinte-doux text-teinte"><I size={17} strokeWidth={2.3} /></span>
      <h3 className="min-w-0 flex-1 text-corps font-bold">{titre}</h3>
      {extra}
    </div>
  )
}
const FACULTATIF = <span className="text-note text-pale">Facultatif</span>
const NOTES_EXEMPLE: Record<string, string> = { evenement: 'Ajouter un détail (menu, qui apporte quoi…)', rdv: 'Ajouter un détail (papiers à apporter…)', anniversaire: 'Ajouter un détail (idée de cadeau…)' }

/** Nouvel événement ; « day » : le jour touché dans la vue de la semaine. */
/** Ajouter un événement, ou en modifier un (titre, type, jour, heure, lieu, qui, détails : tout se change). */
export function EventSheet({ onClose, day, kind: kind0 = 'evenement', event }: { onClose: () => void; day?: Date; kind?: EventKind; event?: FamEvent }) {
  const { state, run, api } = useHome()
  const [title, setTitle] = useState(event?.title ?? '')
  const [kind, setKind] = useState<EventKind>(event?.kind ?? kind0)
  const [sticker,setSticker] = useState<string|null>(event?.sticker ?? null)
  const [stickersOpen,setStickersOpen] = useState(false)
  const [busy,setBusy] = useState(false)
  const first = event ? new Date(event.starts_at) : (day ?? new Date(Date.now() + 86400000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const [date, setDate] = useState(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`)
  // « Toute la journée » se voit (avant, une case d'heure vide ne disait rien) ; un rendez-vous a une heure
  const [journee, setJournee] = useState(event ? event.all_day : kind0 !== 'rdv')
  // un week-end, des vacances : plusieurs jours d'affilée
  const [plusieurs, setPlusieurs] = useState(!!event?.ends_on)
  const [fin, setFin] = useState(event?.ends_on ?? '')
  // « Répéter » : jamais, chaque jour, chaque semaine… (les rythmes en plus attendent la colonne repete)
  const repOk = useRepetitions(api, state.events)
  const [rep, setRep] = useState<Repete | null>(event && event.kind !== 'anniversaire' ? repeteDe(event) : null)
  const [repOuvert, setRepOuvert] = useState(false)
  const [time, setTime] = useState(event && !event.all_day ? `${pad(first.getHours())}:${pad(first.getMinutes())}` : kind0 === 'rdv' ? '09:00' : '12:00')
  const [description, setDescription] = useState(event?.description ?? '')
  const [lieu, setLieu] = useState(event?.lieu ?? '')
  const [who, setWho] = useState<string[]>(event?.members ?? [])
  const birthday = kind === 'anniversaire'
  const nom = useRef<HTMLInputElement>(null)
  const imageEvt = useRef<HTMLSpanElement>(null)
  useEffect(() => rebond(imageEvt.current), [kind, sticker])
  // une seule partie ouverte à la fois (Elisa, 21 novembre) : toucher ailleurs referme « Répéter » et les stickers
  const carteRep = useRef<HTMLElement>(null)
  const carteNom = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!repOuvert && !stickersOpen) return
    const ailleurs = (e: PointerEvent) => {
      const t = e.target as Node
      if (repOuvert && !carteRep.current?.contains(t)) setRepOuvert(false)
      if (stickersOpen && !carteNom.current?.contains(t)) setStickersOpen(false)
    }
    document.addEventListener('pointerdown', ailleurs, true)
    return () => document.removeEventListener('pointerdown', ailleurs, true)
  }, [repOuvert, stickersOpen])
  // les lieux déjà utilisés par la famille (les plus récents d'abord), proposés quand le champ est vide
  const lieuxConnus = useMemo(() => [...new Set([...state.events].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map((e) => e.lieu?.trim()).filter((x): x is string => !!x))], [state.events])
  // l'heure proposée suit le genre (9h00 pour un rendez-vous, 12h00 pour un repas), tant qu'on ne l'a pas choisie
  const heureTouchee = useRef(!!event)
  const changeKind = (k: EventKind) => {
    setKind(k)
    if (k === 'rdv') setJournee(false)
    if (k === 'evenement' && kind === 'rdv') setJournee(true)
    if (!heureTouchee.current) setTime(k === 'rdv' ? '09:00' : '12:00')
  }
  const choisirHeure = (h: string) => {
    heureTouchee.current = true
    select()
    setTime(h)
  }

  const save = async () => {
    if (busy || !title.trim() || !date || (!birthday && journee && plusieurs && (!fin || fin < date))) return
    const allDay = birthday || journee || !time
    const starts = new Date(`${date}T${allDay ? '09:00' : time}`)
    if (Number.isNaN(starts.getTime())) return
    const ends_on = !birthday && allDay && plusieurs && fin > date ? fin : null
    const r: Repete | null = birthday ? 'annee' : rep
    const champs = { sticker, title: title.trim(), kind, starts_at: starts.toISOString(), all_day: allDay, yearly: r === 'annee', weekly: r === 'semaine', ...(repOk ? { repete: r } : {}), ends_on, lieu: lieu.trim() || null, description: description.trim() || null, members: who }
    setBusy(true)
    const ok = await run(
      (api) => (event ? api.updateEvent(event.id, champs) : api.addEvent(state.family.id, state.me.id, champs)),
      event ? 'Événement modifié' : 'Ajouté à l’agenda',
    )
    setBusy(false)
    if (ok) {
      success()
      confettis()
      onClose()
    }
  }

  // les raccourcis de date (Elisa, 21 novembre) : toujours aujourd'hui et demain, puis
  // - un événement : les jours qu'on fête dans les deux mois (Noël, l'Épiphanie, la fête de la musique…), sinon le week-end ;
  // - un rendez-vous : les prochains jours de semaine (ni week-end ni jour férié) ;
  // - un anniversaire : pas de raccourci, le jour se choisit (les membres de la famille sont près du prénom).
  // La date choisie ne s'écrit qu'une fois : sur son raccourci, ou sur « Autre date » (plus de résumé ni de champ en double).
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const auj = new Date()
  const dans = (n: number) => {
    const d = new Date(auj)
    d.setDate(d.getDate() + n)
    return d
  }
  const court = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('fr-FR', o).replace(/^./, (c) => c.toUpperCase())
  type Raccourci = { label: string; detail?: string; v: string; titre?: string }
  const suite: Raccourci[] = []
  if (kind === 'rdv') {
    for (let n = 2; suite.length < 3 && n < 16; n++) {
      const d = dans(n)
      if (d.getDay() !== 0 && d.getDay() !== 6 && !estFerie(d)) suite.push({ label: court(d, { weekday: 'short', day: 'numeric' }), v: iso(d) })
    }
  } else if (kind === 'evenement') {
    const fetes = prochainsJoursSpeciaux(auj)
    // les noms longs, raccourcis sur leur puce (le nom proposé pour l'événement reste entier)
    const NOM_COURT: Record<string, string> = { 'Réveillon de Noël': 'Réveillon', 'Fête des grands-mères': 'Grands-mères', 'Fête des grands-pères': 'Grands-pères' }
    if (fetes.length) for (const j of fetes.slice(0, 3)) suite.push({ label: NOM_COURT[j.nom] ?? j.nom, detail: court(j.date, { day: 'numeric', month: 'short' }), v: iso(j.date), titre: j.titre ?? j.nom })
    else {
      const samedi = dans(((6 - auj.getDay() + 7) % 7) || 7)
      const dimanche = dans(((7 - auj.getDay()) % 7) || 7)
      suite.push({ label: `Sam. ${samedi.getDate()}`, v: iso(samedi) }, { label: `Dim. ${dimanche.getDate()}`, v: iso(dimanche) })
    }
  }
  const jours: Raccourci[] = [{ label: 'Aujourd’hui', v: iso(auj) }, { label: 'Demain', v: iso(dans(1)) }, ...suite].filter((x, k, t) => t.findIndex((y) => y.v === x.v) === k)
  const surRaccourci = jours.some((j) => j.v === date)
  // un jour de fête choisi alors que le nom est vide : on le propose comme nom (on le remplace si on change de jour)
  const nomPropose = useRef('')
  const choisirJour = (j: Raccourci) => {
    select()
    setDate(j.v)
    if (j.titre && (!title.trim() || title === nomPropose.current)) {
      setTitle(j.titre)
      nomPropose.current = j.titre
    }
  }
  // les anniversaires de la famille : ceux qu'on n'a pas encore, et ceux déjà dans l'agenda
  const autres = state.events.filter((e) => e.id !== event?.id)
  const sansAnniv = birthday ? state.members.filter((m) => !anniversaireDe(m, autres)) : []
  const avecAnniv = birthday ? state.members.map((m) => ({ m, e: anniversaireDe(m, autres) })).filter((x) => x.e) : []
  const HEURES = kind === 'rdv' ? ['09:00', '14:00', '17:00'] : ['12:00', '16:00', '19:30']
  const heure = (h: string) => { const [a, b] = h.split(':'); return `${Number(a)}h${b}` }
  const dateDe = (v: string) => new Date(`${v}T12:00`)
  const dateCourte = (v: string) => {
    const d = dateDe(v)
    if (Number.isNaN(d.getTime())) return 'Choisir'
    const loin = d.getFullYear() !== auj.getFullYear() && (d < auj || d.getTime() - auj.getTime() > 330 * 86400000)
    return court(d, { weekday: 'short', day: 'numeric', month: 'short', ...(loin ? { year: 'numeric' } : {}) })
  }
  const ko = !birthday && journee && plusieurs && (!fin || fin < date)
  /** Ce qui manque : on y va, et le champ s'allume un instant. */
  const montrerManque = () => {
    const el = document.getElementById(!title.trim() ? 'event-name' : 'event-fin')
    const cadre = el?.closest('.champ-evt') ?? el
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (cadre instanceof HTMLElement) {
      cadre.classList.remove('a-remplir')
      void cadre.offsetWidth
      cadre.classList.add('a-remplir')
    }
    if (!title.trim()) window.setTimeout(() => (el as HTMLInputElement | null)?.focus({ preventScroll: true }), 350)
  }
  const puce = (on: boolean) => `presse choix-pop shrink-0 rounded-full px-3 py-[7px] text-[14.5px] font-semibold transition-colors duration-200 ${on ? 'bg-teinte text-white' : 'bg-doux text-encre'}`
  const repetitions = REPETITIONS.filter((o) => repOk || o.v === null || o.v === 'semaine' || o.v === 'annee')
  const repLabel = (r: Repete | null) => (r === 'annee' ? 'Chaque année' : r ? rythme({ starts_at: dateDe(date).toISOString(), yearly: false, repete: r }, dateDe(date)) ?? '' : 'Jamais')
  const ligne = 'flex min-h-[48px] items-center justify-between gap-3 text-corps'

  return (
    <Sheet title={event ? 'Modifier l’événement' : 'Nouvel événement'} tall cacherBasAuClavier onClose={() => {if(!busy) onClose()}} footer={
      <Btn onClick={save} disabled={busy} manque={!title.trim() ? (birthday ? 'son prénom' : 'le nom de l’événement') : !date ? 'la date' : ko ? 'la date de fin' : null} onManque={montrerManque}>
        {!busy && <Check size={19} strokeWidth={3} />}
        {busy ? 'Enregistrement…' : event ? 'Enregistrer' : 'Ajouter à l’agenda'}
      </Btn>
    }>
      {/* le genre : trois cartes basses (l'explication en dessous est partie, Elisa, 21 novembre) */}
      <div className="grid grid-cols-3 gap-2 pt-1" role="group" aria-label="Le genre d’événement">
        {KINDS.map((k) => {
          const on = kind === k.key
          return (
            <button key={k.key} type="button" aria-pressed={on} onClick={(e) => { select(); changeKind(k.key); rebond(e.currentTarget.querySelector('img')) }}
              className={`presse choix-pop relative flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[16px] text-[12.5px] font-bold transition-[box-shadow,background-color,color] duration-200 ${on ? 'bg-teinte-doux text-teinte-fonce shadow-[inset_0_0_0_1.5px_#7050D5]' : 'carte-evt bg-carte text-encre'}`}>
              <Art name={k.art} size={27} />
              {k.label}
              {on && <span className="anim-pop absolute right-1.5 top-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-teinte text-white"><Check size={10} strokeWidth={3.6} /></span>}
            </button>
          )
        })}
      </div>

      {/* le nom : un vrai champ, qu'on touche pour écrire ; l'image se change à côté (« Changer », plus de crayon ambigu) */}
      <CarteEvt ref={carteNom}>
        <div className="flex items-center gap-3.5">
          <button type="button" onClick={() => (tap(), setStickersOpen((v) => !v))} aria-label="Changer l’image de l’événement" aria-expanded={stickersOpen} className="presse relative flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-[18px] bg-teinte-doux pb-1.5">
            <span ref={imageEvt} className="inline-flex"><EventIcon event={{ kind, sticker }} size={40} /></span>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-[2px] text-[10.5px] font-bold text-teinte-fonce shadow-[0_2px_6px_rgba(29,26,43,0.12)]">Changer</span>
          </button>
          <div className="min-w-0 flex-1">
            <label htmlFor="event-name" className="mb-1.5 block px-0.5 text-note font-semibold text-brume">{birthday ? 'Anniversaire de…' : 'Nom de l’événement'} <span className="text-teinte" aria-hidden="true">*</span></label>
            <div className="champ-evt flex items-center rounded-[14px] bg-doux pl-3.5 pr-1 transition-shadow focus-within:shadow-[0_0_0_2px_rgba(112,80,213,0.35)]">
              <input ref={nom} id="event-name" required className="h-11 min-w-0 flex-1 bg-transparent font-rond text-[18px] font-extrabold text-encre outline-none placeholder:font-sans placeholder:text-[16px] placeholder:font-medium placeholder:text-pale" placeholder={birthday ? 'Son prénom' : kind === 'rdv' ? 'Ex. : Dentiste de Léa' : 'Ex. : Repas chez Mamie'} maxLength={60} value={title} onChange={e => setTitle(e.target.value)} enterKeyHint="done" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
              {title && (
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => (tap(), setTitle(''), nom.current?.focus())} aria-label="Effacer le nom" className="presse anim-pop flex h-9 w-9 shrink-0 items-center justify-center">
                  <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-[rgba(60,56,82,0.32)] text-white"><X size={11} strokeWidth={3.4} /></span>
                </button>
              )}
            </div>
          </div>
        </div>
        {stickersOpen && <div className="anim-entre mt-4"><StickerTray start="fete" onClose={() => setStickersOpen(false)} onPick={key => {setSticker(key);setStickersOpen(false)}} /><button onClick={() => {setSticker(null);setStickersOpen(false)}} className="mt-1 min-h-11 px-1 text-sous font-semibold text-teinte-fonce">Revenir à l’image de départ</button></div>}
        {birthday && sansAnniv.length > 0 && (
          <div className="mt-4">
            <p className="mb-0.5 px-0.5 text-note font-semibold text-brume">Dans la famille</p>
            <div className="no-bar -mx-4 flex gap-1 overflow-x-auto px-3" role="group" aria-label="C’est l’anniversaire de…">
              {sansAnniv.map((m) => (
                <Bulle key={m.id} taille={44} on={title.trim() === m.display_name} nom={m.id === state.me.id ? 'Moi' : m.display_name} onClick={() => (select(), setTitle(m.display_name), setWho([m.id]))}>
                  <Avatar m={m} size={44} />
                </Bulle>
              ))}
            </div>
          </div>
        )}
        {birthday && avecAnniv.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 px-0.5 text-note text-brume">
            <Cake size={14} className="mt-0.5 shrink-0 text-teinte" />
            <span>Déjà dans l’agenda : {avecAnniv.map(({ m, e }) => `${m.id === state.me.id ? 'toi' : m.display_name} (${new Date(e!.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })})`).join(', ')}</span>
          </p>
        )}
      </CarteEvt>

      {/* Date et horaire */}
      <CarteEvt>
        <TitreCarte icone={CalendarDays} titre={birthday ? 'Date' : 'Date et horaire'} extra={birthday ? undefined : (
          // « Autre date » en haut, avec une petite flèche qui fait signe (Elisa, 21 novembre)
          <label className="presse relative -my-1 flex min-h-9 items-center gap-0.5 rounded-full bg-teinte-doux py-1 pl-3 pr-2 text-note font-bold text-teinte-fonce">
            Autre date
            <ChevronRight size={16} strokeWidth={2.8} className="fleche-signe" />
            <input aria-label="Choisir une autre date" type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={date} onChange={e => e.target.value && (select(), setDate(e.target.value))} />
          </label>
        )} />
        {birthday ? (
          <label className="champ-evt presse relative flex h-12 items-center gap-2.5 rounded-[14px] bg-doux px-3.5 text-corps font-semibold">
            <CalendarDays size={18} className="shrink-0 text-teinte" />
            <span key={date} className="anim-entre flex-1">Le {dateDe(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
            <ChevronDown size={17} className="shrink-0 text-teinte" />
            <input aria-label="Le jour de l’anniversaire" type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={date} onChange={e => e.target.value && (select(), setDate(e.target.value))} />
          </label>
        ) : (
          // tous les raccourcis se voient en entier (Noël, le réveillon…), sur deux lignes s'il le faut ;
          // une autre date choisie vient en tête, en violet
          <div className="flex flex-wrap gap-2" role="group" aria-label="Raccourcis de date">
            {!surRaccourci && (
              <label key={date} className={`${puce(true)} relative flex items-center gap-1.5`} data-on="true">
                <CalendarDays size={15} strokeWidth={2.4} />
                {dateCourte(date)}
                <input aria-label="Changer la date" type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={date} onChange={e => e.target.value && (select(), setDate(e.target.value))} />
              </label>
            )}
            {jours.map((j) => (
              <button key={j.v} type="button" aria-pressed={date === j.v} onClick={() => choisirJour(j)} className={puce(date === j.v)}>
                {j.label}
                {j.detail && <span className={`ml-1.5 font-medium ${date === j.v ? 'text-white/80' : 'text-brume'}`}>{j.detail}</span>}
              </button>
            ))}
          </div>
        )}
        {birthday ? (
          <p className="mt-3 flex items-center gap-2 px-0.5 text-note text-brume"><Repeat size={14} className="text-teinte" /> Revient tout seul chaque année à cette date.</p>
        ) : (
          <>
            <div className={`${ligne} mt-3 border-t border-trait/60 pt-3`}>Toute la journée<Switch on={journee} onChange={setJournee} label="Toute la journée" /></div>
            {!journee && (
              <div className="anim-entre mt-2 flex gap-1.5" role="group" aria-label="L’heure">
                {HEURES.map((h) => (
                  <button key={h} type="button" aria-pressed={time === h} onClick={() => choisirHeure(h)} className={`${puce(time === h)} flex-1 !px-1`}>{heure(h)}</button>
                ))}
                <label className={`${puce(!HEURES.includes(time))} relative flex flex-1 items-center justify-center gap-1 !px-1`} data-on={!HEURES.includes(time)}>
                  <Clock size={15} strokeWidth={2.4} className={HEURES.includes(time) ? 'text-teinte' : ''} />
                  <span key={HEURES.includes(time) ? 'autre' : time}>{HEURES.includes(time) ? 'Autre' : heure(time)}</span>
                  <input aria-label="Choisir une autre heure" type="time" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={time} onChange={e => e.target.value && choisirHeure(e.target.value)} />
                </label>
              </div>
            )}
            {journee && (
              <div className={`${ligne} mt-2 border-t border-trait/60 pt-2`}>Sur plusieurs jours<Switch on={plusieurs} onChange={v => {setPlusieurs(v);if(v && !(fin > date)){const d=new Date(`${date}T12:00`);d.setDate(d.getDate()+1);setFin(iso(d))}}} label="Sur plusieurs jours" /></div>
            )}
            {journee && plusieurs && (
              <div className={`${ligne} anim-entre mt-1`}>
                Jusqu’au
                <label className="champ-evt presse relative flex items-center gap-1 rounded-full bg-teinte-doux px-3 py-1.5 text-sous font-semibold text-teinte-fonce">
                  <span key={fin}>{fin ? dateCourte(fin) : 'Choisir'}</span>
                  <ChevronDown size={15} className="opacity-70" />
                  <input id="event-fin" aria-label="Date de fin" type="date" min={date} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={fin} onChange={e => setFin(e.target.value)} />
                </label>
              </div>
            )}
          </>
        )}
        {ko && <p role="alert" className="mt-2 px-0.5 text-note text-rouge">La fin doit être le même jour ou après le début.</p>}
      </CarteEvt>

      {/* Répéter (plus seulement « chaque semaine ») */}
      {!birthday && (
        <CarteEvt ref={carteRep} className="!p-0">
          <button type="button" onClick={() => (tap(), setRepOuvert((v) => !v))} aria-expanded={repOuvert} className="flex w-full items-center gap-2.5 p-4 text-left transition-opacity active:opacity-60">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-teinte-doux text-teinte"><Repeat size={17} strokeWidth={2.3} /></span>
            <span className="flex-1 text-corps font-bold">Répéter</span>
            <span key={`${rep}${date}`} className={`anim-entre text-sous ${rep ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>{repLabel(rep)}</span>
            <ChevronRight size={17} className={`shrink-0 text-pale transition-transform duration-200 ${repOuvert ? 'rotate-90' : ''}`} />
          </button>
          {repOuvert && (
            <div className="anim-entre -mt-1 flex flex-wrap gap-1.5 px-4 pb-4" role="group" aria-label="Répéter">
              {repetitions.map((o) => (
                <button key={o.label} type="button" aria-pressed={rep === o.v} onClick={() => { select(); setRep(o.v); window.setTimeout(() => setRepOuvert(false), 260) }} className={puce(rep === o.v)}>{o.label}</button>
              ))}
            </div>
          )}
        </CarteEvt>
      )}

      {/* Lieu */}
      <CarteEvt>
        <TitreCarte icone={MapPin} titre="Lieu" extra={FACULTATIF} />
        <ChampLieu value={lieu} onChange={setLieu} placeholder={LIEU_EXEMPLE[kind] ?? 'Où ?'} recents={lieuxConnus} />
      </CarteEvt>

      {/* Les personnes concernées */}
      <CarteEvt>
        <TitreCarte icone={Users} titre="Personnes concernées" extra={<span key={who.length} className="anim-entre text-note text-brume">{who.length ? `${who.length} personne${who.length > 1 ? 's' : ''}` : 'Toute la famille'}</span>} />
        <WhoPicker value={who} onChange={setWho} />
      </CarteEvt>

      {/* Notes */}
      <CarteEvt>
        <TitreCarte icone={AlignLeft} titre="Notes" extra={FACULTATIF} />
        <textarea id="event-details" className="block min-h-[84px] w-full resize-none rounded-[14px] bg-doux px-3.5 py-3 text-corps outline-none transition-shadow placeholder:text-pale focus:shadow-[0_0_0_2px_rgba(112,80,213,0.35)]" placeholder={NOTES_EXEMPLE[kind]} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} aria-label="Notes" />
      </CarteEvt>
    </Sheet>
  )
}

/** Un bouton rond de la fiche d'un événement, comme sur une fiche de contact. */
function ActionEvt({ icone: I, label, onClick, href }: { icone: typeof CalendarPlus; label: string; onClick?: () => void; href?: string }) {
  // l'icône rebondit à chaque toucher (Elisa, 21 novembre : « mettre des interactions »)
  const [n, setN] = useState(0)
  const cls = 'presse flex min-w-0 flex-col items-center gap-1.5 rounded-[18px] bg-carte px-1 pb-2.5 pt-3 text-note font-semibold text-teinte-fonce shadow-carte'
  const dedans = (
    <>
      <span key={n} className={`flex h-10 w-10 items-center justify-center rounded-full bg-teinte-doux ${n ? 'saut' : ''}`}>
        <I size={19} strokeWidth={2.4} />
      </span>
      <span className="w-full truncate text-center">{label}</span>
    </>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => (tap(), setN((x) => x + 1))}>
      {dedans}
    </a>
  ) : (
    <button type="button" className={cls} onClick={() => (tap(), setN((x) => x + 1), onClick?.())}>
      {dedans}
    </button>
  )
}

/** Un événement ouvert, à lire tranquillement (Elisa, 21 novembre : « améliore lui l'UX »).
 *  En haut : son image, son nom, quand, et dans combien de jours. Puis les actions d'un coup d'œil
 *  (Calendrier, Itinéraire, Partager, Modifier), et une seule carte d'infos (où, avec qui, les détails). */
export function EventDetailSheet({ event, onClose }: { event: FamEvent; at?: Date; onClose: () => void }) {
  const { state, run, toast, api } = useHome()
  const ev = state.events.find((x) => x.id === event.id) ?? event // la version à jour, après une modification
  const [modif, setModif] = useState(false)
  const [toutLire, setToutLire] = useState(false)
  // les choses à faire pour cet événement (Elisa, 21 novembre) : tout le monde peut en ajouter et en cocher
  const peutLier = useLienTaches(api, state.items)
  const taches = state.items.filter((i) => i.kind === 'tache' && i.event_id === ev.id)
  const [nouvelle, setNouvelle] = useState('')
  const [arrivee, setArrivee] = useState('')
  const [touchees, setTouchees] = useState<string[]>([])
  const ajouterTache = async () => {
    const t = nouvelle.trim().slice(0, 80)
    if (!t) return
    setNouvelle('')
    tap()
    setArrivee(t)
    window.setTimeout(() => setArrivee((a) => (a === t ? '' : a)), 1600)
    if (!(await run((a) => a.addItem(state.family.id, state.me.id, 'tache', t, null, ev.id)))) setNouvelle(t)
  }
  const at = nextOccurrence(ev) // recalculé : la date a pu être modifiée
  const author = state.members.find((m) => m.id === ev.created_by)
  // seule la personne qui l'a ajouté peut le modifier ou le supprimer (Elisa, 21 novembre) ;
  // un événement dont l'auteur n'est plus dans la maison reste modifiable par tous
  const peutModifier = !author || author.id === state.me.id
  const fin = finDe(ev, at)
  // sur plusieurs jours : « Du samedi 28 au dimanche 29 novembre »
  const full = (joursEnPlus(ev)
    ? `Du ${at.toLocaleDateString('fr-FR', fin.getMonth() === at.getMonth() ? { weekday: 'long', day: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long' })} au ${fin.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  ).replace(/^./, (c) => c.toUpperCase())
  const quand = `${full}${ev.all_day ? '' : ` à ${timeLabel(at)}`}`
  const d0 = new Date()
  d0.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - d0.getTime()) / 86400000)
  const birthday = ev.kind === 'anniversaire'
  const soon = diff < 0 ? 'En ce moment' : diff === 0 ? (birthday ? 'C’est aujourd’hui !' : 'Aujourd’hui') : diff === 1 ? 'Demain' : diff <= 60 ? `Dans ${diff} jours` : null
  if (modif && peutModifier) return <EventSheet event={ev} onClose={() => setModif(false)} />
  const concernes = (ev.members ?? []).length ? state.members.filter((m) => ev.members!.includes(m.id)) : []
  const noms = concernes.map((m) => (m.id === state.me.id ? 'toi' : m.display_name))
  const qui = !concernes.length ? 'Toute la famille' : noms.length === 1 ? noms[0].replace(/^toi$/, 'Toi') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`.replace(/^toi/, 'Toi')
  // l'anniversaire d'un membre : sa tête à la place de l'image
  const fete = birthday ? state.members.find((m) => anniversaireDe(m, [ev])) : undefined
  const supprimer = async () => {
    if (!(await confirmer({ title: `Supprimer « ${ev.title} » ?`, message: 'Il disparaîtra de l’agenda de toute la famille.', confirm: 'Supprimer l’événement', destructive: true }))) return
    if (await run((api) => api.deleteEvent(ev.id), 'Événement supprimé')) onClose()
  }
  const calendrier = () => {
    if (ajouterAuCalendrier(ev) === 'safari') toast('Safari s’ouvre : touche « Ajouter » pour le mettre dans ton calendrier')
  }
  const partager = async () => {
    const r = await partagerTexte(`${titreCalendrier(ev)} : ${quand.charAt(0).toLowerCase()}${quand.slice(1)}${ev.lieu ? `, ${ev.lieu}` : ''}${ev.description ? `\n${ev.description}` : ''}`)
    if (r === 'copie') toast('Copié : tu peux le coller dans un message')
  }
  const actions = [
    <ActionEvt key="cal" icone={CalendarPlus} label="Calendrier" onClick={calendrier} />,
    ev.lieu ? <ActionEvt key="plans" icone={Navigation} label="Itinéraire" onClick={() => void ouvrirLieu(ev.lieu!)} /> : null,
    <ActionEvt key="partage" icone={Share} label="Partager" onClick={() => void partager()} />,
    peutModifier ? <ActionEvt key="modif" icone={PenLine} label="Modifier" onClick={() => setModif(true)} /> : null,
  ].filter(Boolean)

  return (
    <Sheet title={KINDS.find((k) => k.key === ev.kind)?.label ?? 'Événement'} onClose={onClose}>
      <div className="flex flex-col items-center pt-1 text-center">
        <span className="anim-pop relative">
          <span className="flotte-doux block">
          {fete ? (
            <>
              <Avatar m={fete} size={88} mood />
              <span className="absolute -bottom-1 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-carte shadow-carte">
                <EventIcon event={ev} size={28} />
              </span>
            </>
          ) : (
            <span className="flex h-[88px] w-[88px] items-center justify-center rounded-[28px] bg-teinte-doux">
              <EventIcon event={ev} size={60} />
            </span>
          )}
          </span>
        </span>
        <p className="mt-3 break-words px-2 font-rond text-titre2 leading-tight">{titreCalendrier(ev)}</p>
        <p className="mt-1 px-2 text-sous text-brume">{quand}</p>
        {(soon || repeteDe(ev)) && (
          <span className="mt-2 flex flex-wrap justify-center gap-1.5">
            {soon && <span className="anim-pop rounded-full bg-peche-doux px-2.5 py-1 text-legende font-bold text-peche-fonce" style={{ animationDelay: '160ms' }}>{soon}</span>}
            {repeteDe(ev) && (
              <span className="flex items-center gap-1 rounded-full bg-remplissage px-2.5 py-1 text-legende font-semibold text-brume">
                <Repeat size={12} strokeWidth={2.6} /> {repeteDe(ev) === 'annee' ? 'Chaque année' : rythme(ev, at)}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
        {actions}
      </div>

      <div className="groupe mt-4">
        {ev.lieu && (
          <button type="button" onClick={() => (tap(), void ouvrirLieu(ev.lieu!))} className="presse-ligne block w-full text-left">
            <Info icone={<MapPin size={18} strokeWidth={2.3} />} fleche>
              <span className="block break-words">{ev.lieu}</span>
              <span className="text-note text-brume">Plans, Google Maps, Citymapper ou Waze</span>
            </Info>
          </button>
        )}
        <Info icone={<Users size={18} strokeWidth={2.3} />} dernier={!ev.description}>
          <span className="flex items-center gap-2">
            {concernes.length > 0 && (
              <span className="flex shrink-0 -space-x-2">
                {concernes.slice(0, 4).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-carte">
                    <Avatar m={m} size={26} />
                  </span>
                ))}
              </span>
            )}
            <span className="min-w-0">{qui}</span>
          </span>
        </Info>
        {ev.description && (
          <Info icone={<AlignLeft size={18} strokeWidth={2.3} />} dernier>
            <button onClick={() => setToutLire((x) => !x)} className="block w-full whitespace-pre-wrap break-words text-left" style={toutLire ? undefined : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {ev.description}
            </button>
          </Info>
        )}
      </div>
      {peutLier && (
        <>
          <p className="mb-2 mt-5 flex items-baseline justify-between px-1 text-sous font-bold">
            À faire pour cet événement
            {taches.length > 0 && <span className="text-note font-semibold text-brume">{taches.filter((t) => t.done).length} / {taches.length}</span>}
          </p>
          <div className="groupe overflow-hidden">
            {taches.map((t) => {
              const qui = state.members.find((m) => m.id === t.assigned_to)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.done) tap()
                    else success()
                    setTouchees((x) => (x.includes(t.id) ? x : [...x, t.id]))
                    // coché tout de suite à l'écran, enregistré en arrière-plan
                    void run((a) => a.toggleItem(t, state.me.id), undefined, (st) => ({ ...st, items: st.items.map((x) => (x.id === t.id ? { ...x, done: !x.done, done_by: x.done ? null : st.me.id } : x)) }))
                  }}
                  aria-pressed={t.done}
                  className={`presse-ligne flex w-full items-center gap-3 pl-4 text-left ${t.title === arrivee ? 'ligne-arrive-pop ligne-arrive' : ''}`}
                >
                  <span key={String(t.done)} className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${t.done ? 'coche-saut bg-teinte text-white' : `${touchees.includes(t.id) ? 'coche-retire' : ''} border-2 border-pale`}`}>{t.done && <Check size={14} strokeWidth={3.2} />}</span>
                  <span className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-2 border-b border-trait py-2 pr-4 text-corps ${t.done ? 'text-pale line-through' : ''}`}>
                    <span className="min-w-0 flex-1">{t.title}</span>
                    {qui && <Avatar m={qui} size={24} />}
                  </span>
                </button>
              )
            })}
            <form onSubmit={(e) => (e.preventDefault(), void ajouterTache())} className="flex items-center gap-3 pl-4 pr-2">
              <Plus size={20} strokeWidth={2.6} className="shrink-0 text-teinte" />
              <input value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} maxLength={80} enterKeyHint="done" aria-label="Ajouter une chose à faire pour cet événement" placeholder={ev.kind === 'anniversaire' ? 'Ex. : acheter le cadeau' : 'Ex. : réserver, apporter le dessert…'} className="h-12 min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-brume" />
              {nouvelle.trim() && <button type="submit" className="presse anim-pop min-h-9 shrink-0 rounded-full bg-teinte px-3.5 text-note font-semibold text-white">Ajouter</button>}
            </form>
          </div>
        </>
      )}
      {author && (
        <p className="mt-2.5 flex items-center justify-center gap-1.5 px-1 text-note text-brume">
          <Avatar m={author} size={20} />
          {author.id === state.me.id ? 'Ajouté par toi · tu es la seule personne à pouvoir le modifier' : `Ajouté par ${author.display_name} · seule cette personne peut le modifier`}
        </p>
      )}
      {peutModifier && (
        <button onClick={() => void supprimer()} className="presse groupe mt-4 flex min-h-[50px] w-full items-center justify-center gap-1.5 text-corps font-semibold text-rouge">
          <Trash2 size={17} strokeWidth={2.4} /> Supprimer l’événement
        </button>
      )}
    </Sheet>
  )
}

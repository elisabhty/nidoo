import { AlignLeft, CalendarDays, CalendarPlus, Camera, ChevronRight, Images, MapPin, Navigation, PenLine, Repeat, Sticker as StickerIcon, Trash2, Undo2, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { moodOf, MOODS, THOUGHTS, thoughtOf } from '../lib/data'
import { Smiley } from './Smiley'
import { coeurs, confettis, petille } from '../lib/fete'
import { feel, select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { EventKind, FamEvent, Member, Sticker, ThoughtKind } from '../lib/types'
import { chargerImage, photoFinale, vignettesFiltres, type FiltreKey } from '../lib/filtres'
import { MAX_STICKERS } from '../lib/stickers'
import { CadreCanvas, CadreRow, FilterRow, nouveauSticker, StickerStage, StickerImg, StickerTray } from './stickers'
import { vignettesCadres } from '../lib/cadres'
import { compressImage, errorText, finDe, isToday, joursEnPlus, nextOccurrence, rythme, timeLabel } from '../lib/util'
import { ajouterAuCalendrier } from '../lib/calendrier'
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
const LIEU_EXEMPLE: Record<string, string> = { evenement: 'Où ? Ex. : Chez Mamie, à Lyon', rdv: 'Où ? Ex. : Cabinet du Dr Martin', anniversaire: 'Où se fête-t-il ? (facultatif)' }
/** Ouvre le lieu dans Plans (sur iPhone) ou dans la carte du navigateur. */
export const lienPlans = (lieu: string) => `https://maps.apple.com/?q=${encodeURIComponent(lieu)}`

/** Qui est concerné : toute la famille, ou les proches choisis (avec leur tête et leur prénom). */
export function WhoPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { state } = useHome()
  const all = value.length === 0
  const chip = (on: boolean) => `presse flex h-10 items-center gap-1.5 rounded-full text-sous font-medium ${on ? 'bg-teinte text-white' : 'bg-carte text-encre ring-1 ring-inset ring-trait'}`
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => {
          select()
          onChange([])
        }}
        aria-pressed={all}
        className={`${chip(all)} px-3.5`}
      >
        <Users size={17} strokeWidth={2.4} /> Toute la famille
      </button>
      {state.members.map((m) => {
        const on = value.includes(m.id)
        return (
          <button
            key={m.id}
            onClick={() => {
              select()
              onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])
            }}
            aria-pressed={on}
            className={`${chip(on)} pl-1 pr-3.5`}
          >
            <Avatar m={m} size={32} /> {m.id === state.me.id ? 'Moi' : m.display_name}
          </button>
        )
      })}
    </div>
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

/** Nouvel événement ; « day » : le jour touché dans la vue de la semaine. */
/** Ajouter un événement, ou en modifier un (titre, type, jour, heure, lieu, qui, détails : tout se change). */
export function EventSheet({ onClose, day, kind: kind0 = 'evenement', event }: { onClose: () => void; day?: Date; kind?: EventKind; event?: FamEvent }) {
  const { state, run } = useHome()
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
  // un week-end, des vacances : plusieurs jours d'affilée ; une activité : chaque semaine
  const [plusieurs, setPlusieurs] = useState(!!event?.ends_on)
  const [fin, setFin] = useState(event?.ends_on ?? '')
  const [hebdo, setHebdo] = useState(!!event?.weekly)
  const [time, setTime] = useState(event && !event.all_day ? `${pad(first.getHours())}:${pad(first.getMinutes())}` : '10:00')
  const [description, setDescription] = useState(event?.description ?? '')
  const [lieu, setLieu] = useState(event?.lieu ?? '')
  const [who, setWho] = useState<string[]>(event?.members ?? [])
  const birthday = kind === 'anniversaire'
  const changeKind = (k: EventKind) => {
    setKind(k)
    if (k === 'rdv') setJournee(false)
    if (k === 'evenement' && kind === 'rdv') setJournee(true)
  }

  const save = async () => {
    if (busy || !title.trim() || !date || (!birthday && journee && plusieurs && (!fin || fin < date))) return
    const allDay = birthday || journee || !time
    const starts = new Date(`${date}T${allDay ? '09:00' : time}`)
    if (Number.isNaN(starts.getTime())) return
    const ends_on = !birthday && allDay && plusieurs && fin > date ? fin : null
    const champs = { sticker, title: title.trim(), kind, starts_at: starts.toISOString(), all_day: allDay, yearly: birthday, weekly: !birthday && hebdo, ends_on, lieu: lieu.trim() || null, description: description.trim() || null, members: who }
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

  // les raccourcis de date : aujourd'hui, demain, et le prochain week-end
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const auj = new Date()
  const dans = (n: number) => {
    const d = new Date(auj)
    d.setDate(d.getDate() + n)
    return d
  }
  const samedi = dans(((6 - auj.getDay() + 7) % 7) || 7)
  const dimanche = dans(((7 - auj.getDay()) % 7) || 7)
  const jours = [
    { label: 'Aujourd’hui', v: iso(auj) },
    { label: 'Demain', v: iso(dans(1)) },
    { label: `Sam. ${samedi.getDate()}`, v: iso(samedi) },
    { label: `Dim. ${dimanche.getDate()}`, v: iso(dimanche) },
  ].filter((x, k, t) => t.findIndex((y) => y.v === x.v) === k)
  const HEURES = ['09:00', '12:00', '14:00', '19:30']
  const heure = (h: string) => { const [a, b] = h.split(':'); return `${Number(a)} h ${b}` }
  const jourLong = (v: string) => {
    const d = new Date(`${v}T12:00`)
    if (Number.isNaN(d.getTime())) return 'Choisir'
    const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== auj.getFullYear() ? { year: 'numeric' } : {}) })
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  const resume = [
    date ? jourLong(date) : '',
    birthday ? 'chaque année' : journee ? (plusieurs && fin > date ? `→ ${jourLong(fin).toLowerCase()}` : 'toute la journée') : heure(time),
    !birthday && hebdo ? 'chaque semaine' : '',
    lieu.trim(),
  ].filter(Boolean).join(' · ')
  const ko = !birthday && journee && plusieurs && (!fin || fin < date)
  /** Ce qui manque : on y va, et le champ s'allume un instant. */
  const montrerManque = () => {
    const el = document.getElementById(!title.trim() ? 'event-name' : 'event-fin')
    const cadre = el?.closest('.rounded-\\[22px\\], .groupe') ?? el
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (cadre instanceof HTMLElement) {
      cadre.classList.remove('a-remplir')
      void cadre.offsetWidth
      cadre.classList.add('a-remplir')
    }
    if (!title.trim()) window.setTimeout(() => (el as HTMLInputElement | null)?.focus({ preventScroll: true }), 350)
  }
  /** Une ligne du cadre « Quand » : un libellé, et à droite la valeur (le sélecteur d'iOS s'ouvre en touchant toute la valeur). */
  const ligneChoix = (label: string, valeur: string, input: React.ReactNode, haut = true) => (
    <label className={`relative flex min-h-[54px] items-center justify-between gap-3 px-4 text-corps ${haut ? 'border-t border-trait' : ''}`}>
      <span>{label}</span>
      <span className="relative flex items-center gap-1 rounded-full bg-teinte-doux px-3 py-1.5 text-sous font-semibold text-teinte-fonce">
        {valeur}
        <ChevronRight size={15} className="rotate-90 opacity-70" />
        {input}
      </span>
    </label>
  )
  const titreSection = (Icon: typeof CalendarDays, t: string, fond: string, encre: string, extra?: React.ReactNode) => (
    <div className="mb-2 mt-6 flex items-center gap-2 px-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: fond, color: encre }}><Icon size={16} strokeWidth={2.4} /></span>
      <p className="flex-1 text-sous font-bold">{t}</p>
      {extra}
    </div>
  )
  const puce = (on: boolean) => `presse shrink-0 rounded-full px-3.5 py-2 text-sous font-semibold transition-colors ${on ? 'bg-teinte text-white' : 'bg-carte text-encre ring-1 ring-inset ring-trait'}`

  return (
    <Sheet title={event ? 'Modifier l’événement' : 'Nouvel événement'} tall onClose={() => {if(!busy) onClose()}} footer={
      <Btn onClick={save} disabled={busy} manque={!title.trim() ? (birthday ? 'son prénom' : 'le nom de l’événement') : !date ? 'la date' : ko ? 'la date de fin' : null} onManque={montrerManque}>
        {busy ? 'Enregistrement…' : event ? 'Enregistrer' : 'Ajouter à l’agenda'}
      </Btn>
    }>
      {/* le genre : trois cartes illustrées */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Le genre d’événement">
        {KINDS.map((k) => {
          const on = kind === k.key
          return (
            <button key={k.key} type="button" aria-pressed={on} onClick={(e) => (select(), !on && petille(e.currentTarget), changeKind(k.key))}
              className={`presse flex flex-col items-center gap-1 rounded-[18px] px-1 pb-2 pt-2.5 text-note font-bold transition-[box-shadow,background-color] ${on ? 'bg-teinte-doux text-teinte-fonce ring-2 ring-teinte' : 'bg-carte text-encre ring-1 ring-inset ring-trait'}`}>
              <span key={on ? 'on' : 'off'} className={on ? 'saut' : ''}><Art name={k.art} size={34} /></span>
              {k.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-1 text-center text-note text-brume">{KINDS.find((k) => k.key === kind)?.aide}</p>

      {/* l'événement tel qu'il apparaîtra : son sticker, son nom, et le résumé qui se remplit */}
      <div className="mt-4 rounded-[22px] bg-carte p-3 shadow-carte">
        <div className="flex items-center gap-3">
          <button onClick={() => setStickersOpen(v => !v)} aria-label="Changer le sticker de l’événement" aria-expanded={stickersOpen} className="presse relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[18px] bg-teinte-doux">
            <EventIcon event={{kind,sticker}} size={42} />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-teinte-fonce shadow-carte"><PenLine size={12} /></span>
          </button>
          <div className="min-w-0 flex-1">
            <label htmlFor="event-name" className="block px-0.5 text-note font-semibold text-brume">{birthday ? 'Anniversaire de…' : 'Nom de l’événement'}</label>
            <input id="event-name" required aria-describedby="event-name-aide" className="h-10 w-full bg-transparent px-0.5 font-rond text-[20px] font-extrabold text-encre outline-none placeholder:font-sans placeholder:text-[17px] placeholder:font-semibold placeholder:text-brume/80" placeholder={birthday ? 'Ex. : Mamie' : kind === 'rdv' ? 'Ex. : Dentiste de Léa' : 'Ex. : Repas chez Mamie'} maxLength={60} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        </div>
        <p id="event-name-aide" className={`mt-2 flex items-center gap-1.5 rounded-[12px] bg-fond px-3 py-2 text-note font-semibold ${title.trim() ? 'text-teinte-fonce' : 'text-brume'}`}>
          <CalendarDays size={14} className="shrink-0" /> <span key={resume} className={`min-w-0 truncate ${title.trim() ? 'anim-entre' : ''}`}>{title.trim() ? resume : birthday ? 'Écris son prénom pour l’ajouter.' : 'Donne-lui un nom pour l’ajouter.'}</span>
        </p>
      </div>
      {stickersOpen && <div className="mt-3"><StickerTray start="fete" onClose={() => setStickersOpen(false)} onPick={key => {setSticker(key);setStickersOpen(false)}} /><button onClick={() => {setSticker(null);setStickersOpen(false)}} className="mt-1 min-h-11 px-1 text-sous font-semibold text-teinte-fonce">Revenir à l’icône par défaut</button></div>}

      {/* Quand */}
      {titreSection(CalendarDays, 'Quand ?', '#FFEDE2', '#E26F3C')}
      <div className="no-bar -mx-5 mb-2.5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Raccourcis de date">
        {jours.map((j) => <button key={j.v} type="button" aria-pressed={date === j.v} onClick={(e) => (select(), date !== j.v && petille(e.currentTarget), setDate(j.v))} className={puce(date === j.v)}>{j.label}</button>)}
      </div>
      <div className="groupe shadow-carte">
        {ligneChoix(birthday ? 'Le jour' : 'Date', jourLong(date), <input aria-label="Date de l’événement" type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={date} onChange={e => e.target.value && setDate(e.target.value)} />, false)}
        {birthday ? <p className="flex min-h-[48px] items-center gap-2 border-t border-trait px-4 text-sous text-brume"><Repeat size={15} className="text-teinte" /> Revient tout seul chaque année à cette date.</p> : <>
          <div className="flex min-h-[54px] items-center justify-between gap-2 border-t border-trait px-4 text-corps">Toute la journée<Switch on={journee} onChange={setJournee} label="Toute la journée" /></div>
          {!journee && <>
            {ligneChoix('Heure', heure(time), <input aria-label="Heure de l’événement" type="time" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={time} onChange={e => e.target.value && setTime(e.target.value)} />)}
            <div className="flex gap-1.5 px-4 pb-3" role="group" aria-label="Raccourcis d’heure">
              {HEURES.map((h) => <button key={h} type="button" aria-pressed={time === h} onClick={(e) => (select(), time !== h && petille(e.currentTarget), setTime(h))} className={`presse flex-1 rounded-full py-1.5 text-note font-bold ${time === h ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}>{heure(h)}</button>)}
            </div>
          </>}
          {journee && <div className="flex min-h-[54px] items-center justify-between border-t border-trait px-4 text-corps">Sur plusieurs jours<Switch on={plusieurs} onChange={v => {setPlusieurs(v);if(v && !(fin > date)){const d=new Date(`${date}T12:00`);d.setDate(d.getDate()+1);setFin(iso(d))}}} label="Sur plusieurs jours" /></div>}
          {journee && plusieurs && ligneChoix('Jusqu’au', fin ? jourLong(fin) : 'Choisir', <input id="event-fin" aria-label="Date de fin" type="date" min={date} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={fin} onChange={e => setFin(e.target.value)} />)}
          <div className="flex min-h-[54px] items-center justify-between border-t border-trait px-4 text-corps"><span className="flex items-center gap-2">Chaque semaine</span><Switch on={hebdo} onChange={setHebdo} label="Chaque semaine" /></div>
        </>}
      </div>
      {ko && <p role="alert" className="mt-2 px-1 text-note text-rouge">La fin doit être le même jour ou après le début.</p>}

      {/* Où */}
      {titreSection(MapPin, 'Où ?', '#E3F0FF', '#2F6FD6', <span className="text-note text-brume">facultatif</span>)}
      <div className="groupe flex items-center gap-3 px-4 shadow-carte"><MapPin size={19} className="shrink-0 text-[#2F6FD6]" /><input className="h-[54px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-brume" placeholder={LIEU_EXEMPLE[kind] ?? 'Où ?'} maxLength={200} value={lieu} onChange={e => setLieu(e.target.value)} aria-label="Lieu" /></div>

      {/* Avec qui */}
      {titreSection(Users, 'Avec qui ?', '#E3F6EC', '#14955A', <span className="text-note text-brume">{who.length ? `${who.length} personne${who.length > 1 ? 's' : ''}` : 'toute la famille'}</span>)}
      <WhoPicker value={who} onChange={setWho} />

      {/* Détails */}
      {titreSection(AlignLeft, 'Détails', '#FFF4D6', '#B07A00', <span className="text-note text-brume">facultatif</span>)}
      <textarea id="event-details" className="groupe block min-h-[88px] w-full resize-none px-4 py-3 text-corps shadow-carte outline-none placeholder:text-brume" placeholder="Qui apporte quoi, l’heure du départ…" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} aria-label="Détails" />
    </Sheet>
  )
}

/** Un événement ouvert, à lire tranquillement : le jour, l'heure, le lieu, qui est concerné, les détails.
 *  « Modifier » ouvre le formulaire complet ; supprimer demande une confirmation. */
export function EventDetailSheet({ event, onClose }: { event: FamEvent; at?: Date; onClose: () => void }) {
  const { state, run } = useHome()
  const ev = state.events.find((x) => x.id === event.id) ?? event // la version à jour, après une modification
  const [modif, setModif] = useState(false)
  const [toutLire, setToutLire] = useState(false)
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
  const d0 = new Date()
  d0.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - d0.getTime()) / 86400000)
  const soon = diff < 0 ? 'En ce moment' : diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : diff <= 30 ? `Dans ${diff} jours` : null
  if (modif && peutModifier) return <EventSheet event={ev} onClose={() => setModif(false)} />
  const concernes = (ev.members ?? []).length ? state.members.filter((m) => ev.members!.includes(m.id)) : []
  const noms = concernes.map((m) => (m.id === state.me.id ? 'toi' : m.display_name))
  const qui = !concernes.length ? 'Toute la famille' : noms.length === 1 ? noms[0].replace(/^toi$/, 'Toi') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`.replace(/^toi/, 'Toi')
  const supprimer = async () => {
    if (!(await confirmer({ title: `Supprimer « ${ev.title} » ?`, message: 'Il disparaîtra de l’agenda de toute la famille.', confirm: 'Supprimer l’événement', destructive: true }))) return
    if (await run((api) => api.deleteEvent(ev.id), 'Événement supprimé')) onClose()
  }

  // Tout tient sur un écran : l'en-tête (image, titre, quand), une seule carte d'infos, deux boutons côte à côte.
  return (
    <Sheet title={KINDS.find((k) => k.key === ev.kind)?.label ?? 'Événement'} onClose={onClose}>
      <div className="flex items-center gap-3.5">
        <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[22px] bg-teinte-doux">
          <EventIcon event={ev} size={48} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-rond text-titre2 leading-tight">{ev.title}</p>
          {(soon || ev.yearly || ev.weekly) && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {soon && <span className="rounded-full bg-peche-doux px-2.5 py-0.5 text-legende font-semibold text-peche-fonce">{soon}</span>}
              {ev.yearly && (
                <span className="flex items-center gap-1 rounded-full bg-remplissage px-2.5 py-0.5 text-legende font-semibold text-brume">
                  <Repeat size={12} strokeWidth={2.6} /> Chaque année
                </span>
              )}
              {ev.weekly && (
                <span className="flex items-center gap-1 rounded-full bg-remplissage px-2.5 py-0.5 text-legende font-semibold text-brume">
                  <Repeat size={12} strokeWidth={2.6} /> {rythme(ev, at)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="groupe mt-4">
        <Info icone={<CalendarDays size={18} strokeWidth={2.3} />}>
          {full}
          <span className="text-brume">{ev.all_day ? ' · toute la journée' : ` · ${timeLabel(at)}`}</span>
        </Info>
        {ev.lieu && (
          <a href={lienPlans(ev.lieu)} target="_blank" rel="noopener noreferrer" className="presse-ligne block">
            <Info icone={<MapPin size={18} strokeWidth={2.3} />} fleche>
              <span className="block break-words">{ev.lieu}</span>
              <span className="flex items-center gap-1 text-note font-semibold text-teinte-fonce">
                <Navigation size={11} strokeWidth={2.6} /> Ouvrir dans Plans
              </span>
            </Info>
          </a>
        )}
        <Info icone={<Users size={18} strokeWidth={2.3} />} dernier={!ev.description}>
          <span className="flex items-center gap-2">
            {concernes.length > 0 && (
              <span className="flex shrink-0 -space-x-2">
                {concernes.slice(0, 4).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-carte">
                    <Avatar m={m} size={24} />
                  </span>
                ))}
              </span>
            )}
            <span className="min-w-0">{qui}</span>
          </span>
        </Info>
        {ev.description && (
          <Info icone={<AlignLeft size={18} strokeWidth={2.3} />} dernier>
            <button onClick={() => setToutLire((x) => !x)} className="block w-full whitespace-pre-wrap break-words text-left" style={toutLire ? undefined : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {ev.description}
            </button>
          </Info>
        )}
      </div>
      {author && (
        <p className="mt-2 px-1 text-note text-brume">
          {author.id === state.me.id ? 'Ajouté par toi · tu es la seule personne à pouvoir le modifier ou le supprimer' : `Ajouté par ${author.display_name} · seule la personne qui l’a ajouté peut le modifier`}
        </p>
      )}

      <div className={`mt-4 grid gap-2.5 ${peutModifier ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {peutModifier && (
          <Btn
            onClick={() => {
              tap()
              setModif(true)
            }}
          >
            <PenLine size={17} strokeWidth={2.4} /> Modifier
          </Btn>
        )}
        <Btn
          kind="gris"
          onClick={() => {
            tap()
            ajouterAuCalendrier(ev)
          }}
        >
          <CalendarPlus size={17} strokeWidth={2.4} /> {peutModifier ? 'Calendrier' : 'Ajouter à mon calendrier'}
        </Btn>
      </div>
      {peutModifier && (
        <button onClick={() => void supprimer()} className="presse mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-sous font-semibold text-rouge">
          <Trash2 size={15} strokeWidth={2.4} /> Supprimer l’événement
        </button>
      )}
    </Sheet>
  )
}

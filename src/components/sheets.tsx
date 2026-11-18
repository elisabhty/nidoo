import { Camera, Images, MapPin, Navigation, PenLine, Repeat, Sticker as StickerIcon, Trash2, Undo2, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { moodOf, MOODS, THOUGHTS, thoughtOf } from '../lib/data'
import { Smiley } from './Smiley'
import { feel, select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { EventKind, FamEvent, Member, Sticker, ThoughtKind } from '../lib/types'
import { chargerImage, photoFinale, vignettesFiltres, type FiltreKey } from '../lib/filtres'
import { MAX_STICKERS } from '../lib/stickers'
import { CadreCanvas, CadreRow, FilterRow, nouveauSticker, StickerStage, StickerTray } from './stickers'
import { vignettesCadres } from '../lib/cadres'
import { compressImage, errorText, isToday, nextOccurrence, timeLabel } from '../lib/util'
import { IncomingDrawing, markDrawingsSeen, useUnseenDrawings } from './drawing'
import { DrawSheet } from './planche'
import { Art, Avatar, Btn, confirmer, Envol, Segments, Sheet, Switch } from './ui'

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
              onClick={() => {
                select()
                setMood(on ? null : m.key)
              }}
              aria-pressed={on}
              className={`presse flex flex-col items-center gap-1 rounded-[20px] pb-2.5 pt-2 ${on ? 'bg-teinte-doux ring-2 ring-teinte' : 'bg-carte'}`}
            >
              <span className="flex h-14 w-14 items-center justify-center">
                <Smiley mood={m.key} size={44} />
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
              className="presse verre absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-encre"
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
                    className={`h-8 rounded-full px-3.5 text-note font-semibold transition-colors ${onglet === k ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}
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
          <Btn className="mt-4" onClick={send} disabled={!target || busy}>
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

// ───────── Nouvel événement ─────────

const KINDS: { key: EventKind; label: string; art: string; aide: string; exemple: string }[] = [
  { key: 'evenement', label: 'Événement', art: 'picto-fete', aide: 'Un moment en famille : un repas, une sortie, les vacances…', exemple: 'Quoi ? Ex. : Repas chez Mamie' },
  { key: 'rdv', label: 'Rendez-vous', art: 'picto-lieu', aide: 'Un rendez-vous à une heure précise : médecin, école, coiffeur…', exemple: 'Quoi ? Ex. : Dentiste de Léa' },
  { key: 'anniversaire', label: 'Anniversaire', art: 'picto-gateau', aide: 'Il revient tout seul chaque année, à la même date.', exemple: 'Anniversaire de… (son prénom)' },
]
export const eventArt = (k: string) => KINDS.find((x) => x.key === k)?.art ?? 'picto-fete'
/** Ce qu'on peut mettre dans l'agenda (pour les raccourcis « Ajouter »). */
export const TYPES_AGENDA = KINDS.map((k) => ({ key: k.key, label: k.label, art: k.art }))
const LIEU_EXEMPLE: Record<string, string> = { evenement: 'Où ? Ex. : Chez Mamie, à Lyon', rdv: 'Où ? Ex. : Cabinet du Dr Martin', anniversaire: 'Où se fête-t-il ? (facultatif)' }
/** Ouvre le lieu dans Plans (sur iPhone) ou dans la carte du navigateur. */
export const lienPlans = (lieu: string) => `https://maps.apple.com/?q=${encodeURIComponent(lieu)}`

/** Qui est concerné : toute la famille, ou les proches choisis (avec leur tête et leur prénom). */
export function WhoPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { state } = useHome()
  const all = value.length === 0
  const chip = (on: boolean) => `presse flex h-10 items-center gap-1.5 rounded-full text-sous font-medium ${on ? 'bg-teinte text-white' : 'bg-carte text-encre shadow-carte'}`
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
  const first = event ? new Date(event.starts_at) : (day ?? new Date(Date.now() + 86400000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const [date, setDate] = useState(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`)
  // « Toute la journée » se voit (avant, une case d'heure vide ne disait rien) ; un rendez-vous a une heure
  const [journee, setJournee] = useState(event ? event.all_day : kind0 !== 'rdv')
  const [time, setTime] = useState(event && !event.all_day ? `${pad(first.getHours())}:${pad(first.getMinutes())}` : '10:00')
  const [description, setDescription] = useState(event?.description ?? '')
  const [lieu, setLieu] = useState(event?.lieu ?? '')
  const [who, setWho] = useState<string[]>(event?.members ?? [])
  const birthday = kind === 'anniversaire'
  const meta = KINDS.find((k) => k.key === kind)!
  const changeKind = (k: EventKind) => {
    setKind(k)
    if (k === 'rdv') setJournee(false)
    if (k === 'evenement' && kind === 'rdv') setJournee(true)
  }

  const save = async () => {
    const allDay = birthday || journee || !time
    const starts = new Date(`${date}T${allDay ? '09:00' : time}`)
    if (Number.isNaN(starts.getTime())) return
    const champs = { title: title.trim(), kind, starts_at: starts.toISOString(), all_day: allDay, yearly: birthday, lieu: lieu.trim() || null, description: description.trim() || null, members: who }
    const ok = await run(
      (api) => (event ? api.updateEvent(event.id, champs) : api.addEvent(state.family.id, state.me.id, champs)),
      event ? 'Événement modifié' : 'Ajouté à l’agenda',
    )
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet
      title={event ? 'Modifier l’événement' : 'Nouvel événement'}
      onClose={onClose}
      footer={
        <Btn onClick={save} disabled={!title.trim() || !date}>
          {!title.trim() ? (birthday ? 'Écris le prénom pour ajouter' : 'Écris d’abord ce que c’est') : event ? 'Enregistrer' : 'Ajouter à l’agenda'}
        </Btn>
      }
    >
      <p className="entete !mt-0 !px-1">C’est quoi ?</p>
      <Segments value={kind} onChange={changeKind} options={KINDS.map((k) => ({ key: k.key, label: k.label }))} />
      <p className="px-1 pt-2 text-note text-brume">{meta.aide}</p>
      <div className="groupe mt-3">
        <div className="flex items-center gap-3 border-b border-trait pl-3 pr-4">
          <Art name={eventArt(kind)} size={34} />
          <input className="h-[52px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-pale" placeholder={meta.exemple} maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titre" />
        </div>
        <label className="flex h-[52px] items-center justify-between border-b border-trait px-4 text-corps">
          {birthday ? 'Le jour de l’anniversaire' : 'Quel jour ?'}
          <input type="date" className="rounded-[8px] bg-remplissage px-2.5 py-1 text-corps text-encre outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {birthday ? (
          <p className="flex h-[52px] items-center justify-between px-4 text-corps">
            Revient <span className="text-brume">Chaque année 🎂</span>
          </p>
        ) : (
          <>
            <div className={`flex h-[52px] items-center justify-between px-4 text-corps ${journee ? '' : 'border-b border-trait'}`}>
              Toute la journée
              <Switch on={journee} onChange={setJournee} label="Toute la journée" />
            </div>
            {!journee && (
              <label className="flex h-[52px] items-center justify-between px-4 text-corps">
                À quelle heure ?
                <input type="time" className="rounded-[8px] bg-remplissage px-2.5 py-1 text-corps text-encre outline-none" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
            )}
          </>
        )}
        <label className="flex items-center gap-3 border-t border-trait pl-4 pr-4">
          <MapPin size={20} className="shrink-0 text-teinte" />
          <input className="h-[52px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-pale" placeholder={LIEU_EXEMPLE[kind]} maxLength={200} value={lieu} onChange={(e) => setLieu(e.target.value)} aria-label="Lieu" />
        </label>
      </div>
      <p className="entete mt-5 !px-1">Qui est concerné ?</p>
      <WhoPicker value={who} onChange={setWho} />
      <p className="px-1 pt-2 text-note text-brume">{who.length ? 'Seulement les personnes choisies.' : 'Toute la famille. Touche des prénoms pour ne choisir que certaines personnes.'}</p>
      <p className="entete mt-5 !px-1">Des détails ? (facultatif)</p>
      <textarea
        className="groupe block min-h-[88px] w-full resize-none px-4 py-3 text-corps outline-none placeholder:text-pale"
        placeholder="L’heure du départ, qui apporte quoi…"
        maxLength={500}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Détails"
      />
    </Sheet>
  )
}

/** Un événement ouvert, à lire tranquillement : le jour, l'heure, le lieu, qui est concerné, les détails.
 *  « Modifier » ouvre le formulaire complet ; supprimer demande une confirmation. */
export function EventDetailSheet({ event, onClose }: { event: FamEvent; at?: Date; onClose: () => void }) {
  const { state, run } = useHome()
  const ev = state.events.find((x) => x.id === event.id) ?? event // la version à jour, après une modification
  const [modif, setModif] = useState(false)
  const at = nextOccurrence(ev.starts_at, ev.yearly) // recalculé : la date a pu être modifiée
  const author = state.members.find((m) => m.id === ev.created_by)
  const full = at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())
  const d0 = new Date()
  d0.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - d0.getTime()) / 86400000)
  const soon = diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : diff > 1 && diff <= 30 ? `Dans ${diff} jours` : null
  if (modif) return <EventSheet event={ev} onClose={() => setModif(false)} />

  return (
    <Sheet title={KINDS.find((k) => k.key === ev.kind)?.label ?? 'Événement'} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Art name={eventArt(ev.kind)} size={72} />
        <p className="mt-2 font-rond text-titre2">{ev.title}</p>
        <p className="mt-1 text-corps text-brume">
          {full}
          {ev.all_day ? ' · toute la journée' : ` · ${timeLabel(at)}`}
        </p>
        <span className="mt-2 flex flex-wrap justify-center gap-1.5">
          {soon && <span className="rounded-full bg-peche-doux px-2.5 py-1 text-legende font-semibold text-peche-fonce">{soon}</span>}
          {ev.yearly && (
            <span className="flex items-center gap-1 rounded-full bg-remplissage px-2.5 py-1 text-legende font-semibold text-brume">
              <Repeat size={12} strokeWidth={2.6} /> Chaque année
            </span>
          )}
        </span>
        {ev.lieu && (
          <a
            href={lienPlans(ev.lieu)}
            target="_blank"
            rel="noopener noreferrer"
            className="presse mt-3 flex w-full items-center gap-3 rounded-[18px] bg-teinte-doux py-3 pl-3 pr-4 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teinte">
              <MapPin size={20} />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-corps font-semibold text-encre">{ev.lieu}</span>
              <span className="flex items-center gap-1 text-note font-semibold text-teinte-fonce">
                <Navigation size={12} strokeWidth={2.6} /> Ouvrir dans Plans
              </span>
            </span>
          </a>
        )}
      </div>

      <p className="entete mt-5 !px-1">Qui est concerné</p>
      <WhoList ids={ev.members ?? []} />

      {ev.description && (
        <>
          <p className="entete mt-5 !px-1">Détails</p>
          <p className="groupe whitespace-pre-wrap break-words px-4 py-3 text-corps">{ev.description}</p>
        </>
      )}

      {author && (
        <div className="groupe mt-4 flex items-center gap-3 px-4 py-3">
          <Avatar m={author} size={34} />
          <p className="text-sous">
            Ajouté par <span className="font-semibold">{author.id === state.me.id ? 'toi' : author.display_name}</span>
          </p>
        </div>
      )}
      <Btn
        className="mt-4"
        onClick={() => {
          tap()
          setModif(true)
        }}
      >
        <PenLine size={17} strokeWidth={2.4} /> Modifier
      </Btn>
      <p className="px-1 pt-1.5 text-center text-note text-brume">Toute la famille voit cet événement et peut le modifier.</p>
      <Btn
        className="mt-3 !text-rouge"
        kind="gris"
        onClick={async () => {
          if (!(await confirmer({ title: `Supprimer « ${ev.title} » ?`, message: 'Il disparaîtra de l’agenda de toute la famille.', confirm: 'Supprimer l’événement', destructive: true }))) return
          if (await run((api) => api.deleteEvent(ev.id), 'Événement supprimé')) onClose()
        }}
      >
        <Trash2 size={17} strokeWidth={2.4} /> Supprimer l’événement
      </Btn>
    </Sheet>
  )
}

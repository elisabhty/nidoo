import { Camera, Images, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MOODS, THOUGHTS, thoughtOf } from '../lib/data'
import { select, success } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { EventKind, Member, ThoughtKind } from '../lib/types'
import { compressImage, errorText, isToday } from '../lib/util'
import { DrawSheet, IncomingDrawing, markDrawingsSeen, useUnseenDrawings } from './drawing'
import { Art, Avatar, Btn, Envol, Segments, Sheet } from './ui'

// ───────── Humeur du jour ─────────

export function MoodSheet({ onClose }: { onClose: () => void }) {
  const { state, run } = useHome()
  const current = isToday(state.me.mood_at) ? state.me.mood : null
  const [mood, setMood] = useState<string | null>(current)
  const [note, setNote] = useState(current ? (state.me.mood_note ?? '') : '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const ok = await run((api) => api.setMood(state.me.id, mood, note.trim() || null), mood ? 'Ton humeur est partagée' : 'Humeur effacée')
    setBusy(false)
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet title="Mon humeur du jour" onClose={onClose}>
      <p className="text-center text-sous text-brume">Ta famille la verra sur la maison. Aucune obligation, juste des nouvelles.</p>
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
              <Art name={`humeur-${m.key}`} size={56} />
              <span className={`text-legende ${on ? 'font-semibold text-teinte-fonce' : 'font-medium text-encre'}`}>{m.label}</span>
            </button>
          )
        })}
      </div>
      <input className="champ mt-4 !bg-carte" placeholder="Un petit mot pour aller avec (facultatif)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
      <Btn className="mt-4" onClick={save} disabled={busy || (!mood && !current)}>
        {mood ? 'Partager mon humeur' : current ? 'Effacer mon humeur' : 'Choisis ton humeur'}
      </Btn>
    </Sheet>
  )
}

// ───────── Photo surprise / petit mot au mur ─────────

export function ComposeSheet({ onClose, challenge, startWith = 'photo' }: { onClose: () => void; challenge?: string; startWith?: 'photo' | 'mot' }) {
  const { state, run, toast } = useHome()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const pick = async (f: File | undefined) => {
    if (!f) return
    try {
      setBlob(await compressImage(f))
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }
  const send = async () => {
    setBusy(true)
    const ok = await run(
      (api) => api.postMoment(state.family.id, state.me.id, { blob: blob ?? undefined, body, challenge }),
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
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />

      {preview ? (
        <div className="relative overflow-hidden rounded-groupe bg-remplissage">
          <img src={preview} alt="Aperçu de la photo" className="max-h-[44vh] w-full object-cover" />
          <button onClick={() => setBlob(null)} className="presse verre absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-encre" aria-label="Retirer la photo">
            <Trash2 size={17} />
          </button>
        </div>
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
      <Btn className="mt-3" onClick={send} disabled={busy || (!blob && !body.trim())}>
        {busy ? 'Envoi…' : 'Envoyer à la famille'}
      </Btn>
    </Sheet>
  )
}

// ───────── On pense à toi ─────────

export function ThoughtSheet({ onClose, to }: { onClose: () => void; to?: Member }) {
  const { state, run } = useHome()
  const others = state.members.filter((m) => m.id !== state.me.id)
  const [target, setTarget] = useState<Member | undefined>(to ?? (others.length === 1 ? others[0] : undefined))
  const [kind, setKind] = useState<ThoughtKind>('coeur')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const art = message.trim() ? 'geste-mot' : `geste-${kind}`

  const send = async () => {
    if (!target) return
    const k: ThoughtKind = message.trim() ? 'mot' : kind
    const ok = await run((api) => api.sendThought(state.family.id, state.me.id, target.id, k, message))
    if (ok) {
      success()
      setSent(true)
      window.setTimeout(onClose, 1800)
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
        </Sheet>
      </>
    )
  }

  return (
    <Sheet title="On pense à toi" onClose={onClose}>
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
          <div className="mt-4 grid grid-cols-4 gap-2">
            {THOUGHTS.map((t) => {
              const on = kind === t.key && !message.trim()
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    select()
                    setKind(t.key)
                    setMessage('')
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
          <input className="champ mt-3 !bg-carte" placeholder="Ou glisse-lui un petit mot" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Btn className="mt-4" onClick={send} disabled={!target}>
            {target ? `Envoyer à ${target.display_name}` : 'Choisis un proche'}
          </Btn>
        </>
      )}
    </Sheet>
  )
}

// ───────── Attentions reçues ─────────

export function Incoming() {
  const { state, run } = useHome()
  const [reply, setReply] = useState<string | null | undefined>(undefined)
  const drawings = useUnseenDrawings(state)
  const unseen = state.thoughts.filter((t) => t.to_member === state.me.id && !t.seen_at)
  const t = unseen[unseen.length - 1] // la plus ancienne d'abord
  const id = t?.id
  useEffect(() => {
    if (id) success()
  }, [id])
  const sheet = reply !== undefined && <DrawSheet to={reply} onClose={() => setReply(undefined)} />
  if (!t) {
    const d = drawings[0]
    if (!d || reply !== undefined) return sheet || null
    return (
      <IncomingDrawing
        d={d}
        more={drawings.length - 1}
        onSeen={() => markDrawingsSeen([d.id])}
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
  const seen = () => run((api) => api.markSeen([t.id]))
  const back = () =>
    run(async (api) => {
      await api.markSeen([t.id])
      await api.sendThought(state.family.id, state.me.id, from.id, 'calin')
    }, `Câlin envoyé à ${from.display_name}`)

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
        <Btn className="mt-5" onClick={back}>Renvoyer un câlin</Btn>
        <Btn kind="gris" className="mt-2" onClick={seen}>
          {unseen.length > 1 ? `Suivant (${unseen.length - 1} de plus)` : 'Merci'}
        </Btn>
      </div>
    </div>
  )
}

// ───────── Nouvel événement ─────────

const KINDS: { key: EventKind; label: string; art: string }[] = [
  { key: 'evenement', label: 'Événement', art: 'picto-fete' },
  { key: 'rdv', label: 'Rendez-vous', art: 'picto-lieu' },
  { key: 'anniversaire', label: 'Anniversaire', art: 'picto-gateau' },
]
export const eventArt = (k: string) => KINDS.find((x) => x.key === k)?.art ?? 'picto-fete'

export function EventSheet({ onClose }: { onClose: () => void }) {
  const { state, run } = useHome()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EventKind>('evenement')
  const tomorrow = new Date(Date.now() + 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const [date, setDate] = useState(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`)
  const [time, setTime] = useState('')
  const birthday = kind === 'anniversaire'

  const save = async () => {
    const allDay = birthday || !time
    const starts = new Date(`${date}T${allDay ? '09:00' : time}`)
    if (Number.isNaN(starts.getTime())) return
    const ok = await run(
      (api) => api.addEvent(state.family.id, state.me.id, { title: title.trim(), kind, starts_at: starts.toISOString(), all_day: allDay, yearly: birthday }),
      'Ajouté à l’agenda',
    )
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet title="Nouvel événement" onClose={onClose}>
      <Segments value={kind} onChange={setKind} options={KINDS.map((k) => ({ key: k.key, label: k.label }))} />
      <div className="groupe mt-4">
        <div className="flex items-center gap-3 border-b border-trait pl-3 pr-4">
          <Art name={eventArt(kind)} size={34} />
          <input className="h-[52px] min-w-0 flex-1 bg-transparent text-corps outline-none placeholder:text-pale" placeholder={birthday ? 'Anniversaire de…' : 'Titre'} maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <label className="flex h-[52px] items-center justify-between border-b border-trait px-4 text-corps">
          Date
          <input type="date" className="rounded-[8px] bg-remplissage px-2.5 text-corps text-encre outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {birthday ? (
          <p className="flex h-[52px] items-center justify-between px-4 text-corps">
            Répétition <span className="text-brume">Chaque année</span>
          </p>
        ) : (
          <label className="flex h-[52px] items-center justify-between px-4 text-corps">
            Heure
            <input type="time" className="rounded-[8px] bg-remplissage px-2.5 text-corps text-encre outline-none" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
      </div>
      {!birthday && <p className="px-4 pt-2 text-note text-brume">Sans heure, l’événement dure toute la journée.</p>}
      <Btn className="mt-4" onClick={save} disabled={!title.trim() || !date}>Ajouter</Btn>
    </Sheet>
  )
}

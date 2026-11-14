import { Camera, Images, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MOODS, THOUGHTS, thoughtOf } from '../lib/data'
import { useHome } from '../lib/store'
import type { EventKind, Member, ThoughtKind } from '../lib/types'
import { compressImage, errorText, isToday } from '../lib/util'
import { Avatar, Btn, Coeurs, Sheet } from './ui'

// ───────── Météo des émotions ─────────

export function MoodSheet({ onClose }: { onClose: () => void }) {
  const { state, run } = useHome()
  const current = isToday(state.me.mood_at) ? state.me.mood : null
  const [mood, setMood] = useState<string | null>(current)
  const [note, setNote] = useState(current ? (state.me.mood_note ?? '') : '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const ok = await run((api) => api.setMood(state.me.id, mood, note.trim() || null), 'Ta météo est partagée')
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Sheet title="Ma météo du jour" onClose={onClose}>
      <p className="text-[14px] text-brume">Ta famille la verra sur la maison. Aucune obligation, juste des nouvelles.</p>
      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {MOODS.map((m) => {
          const on = mood === m.key
          return (
            <button
              key={m.key}
              onClick={() => setMood(on ? null : m.key)}
              aria-pressed={on}
              className={`appui flex flex-col items-center gap-1 rounded-3xl border-2 py-3 ${on ? 'border-lavande-400 bg-lavande-100' : 'border-transparent bg-white shadow-carte'}`}
            >
              <span className="text-[30px] leading-none">{m.emoji}</span>
              <span className="text-[12px] font-bold text-encre">{m.label}</span>
            </button>
          )
        })}
      </div>
      <input
        className="champ mt-4"
        placeholder="Un petit mot pour aller avec ? (facultatif)"
        maxLength={80}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Btn className="mt-4" onClick={save} disabled={busy || (!mood && !current)}>
        {mood ? 'Partager ma météo' : current ? 'Effacer ma météo' : 'Choisis ta météo'}
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
    if (ok) onClose()
  }

  return (
    <Sheet title={challenge ? 'Défi photo' : startWith === 'mot' ? 'Petit mot' : 'Photo surprise'} onClose={onClose}>
      {challenge && <p className="mb-3 rounded-2xl bg-peche-100 px-4 py-3 text-[15px] font-bold text-encre">📸 {challenge}</p>}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />

      {preview ? (
        <div className="relative overflow-hidden rounded-3xl bg-lin">
          <img src={preview} alt="Aperçu de la photo" className="max-h-[46vh] w-full object-cover" />
          <button onClick={() => setBlob(null)} className="appui absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-encre shadow-carte" aria-label="Retirer la photo">
            <Trash2 size={17} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => camera.current?.click()} className="appui flex h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-lavande-100 font-bold text-lavande-600">
            <Camera size={26} /> Prendre une photo
          </button>
          <button onClick={() => gallery.current?.click()} className="appui flex h-28 flex-col items-center justify-center gap-2 rounded-3xl bg-peche-100 font-bold text-peche-500">
            <Images size={26} /> Choisir une photo
          </button>
        </div>
      )}
      <textarea
        className="champ mt-3 resize-none"
        rows={preview ? 2 : 3}
        maxLength={280}
        placeholder={preview ? 'Une légende ? (facultatif)' : 'Ou écris juste un petit mot à toute la famille…'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus={startWith === 'mot'}
      />
      <Btn className="mt-3" onClick={send} disabled={busy || (!blob && !body.trim())}>
        <Send size={18} /> {busy ? 'Envoi…' : 'Envoyer à la famille'}
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

  const send = async () => {
    if (!target) return
    const k: ThoughtKind = message.trim() ? 'mot' : kind
    const ok = await run((api) => api.sendThought(state.family.id, state.me.id, target.id, k, message))
    if (ok) {
      setSent(true)
      window.setTimeout(onClose, 1700)
    }
  }

  if (sent && target) {
    return (
      <>
        <Coeurs emoji={message.trim() ? '💌' : thoughtOf(kind).emoji} />
        <Sheet title="C’est parti" onClose={onClose}>
          <div className="flex flex-col items-center py-6 text-center">
            <span className="anim-bat"><Avatar m={target} size={84} /></span>
            <p className="titre mt-4 text-[20px]">{target.display_name} va le recevoir</p>
            <p className="mt-1 text-[14px] text-brume">Sans un mot de plus, juste une présence.</p>
          </div>
        </Sheet>
      </>
    )
  }

  return (
    <Sheet title="On pense à toi" onClose={onClose}>
      {others.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-brume">Invite d’abord un proche dans la maison pour lui envoyer une attention.</p>
      ) : (
        <>
          <p className="text-[14px] text-brume">Un geste, sans avoir à lancer une conversation.</p>
          <div className="no-bar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
            {others.map((m) => {
              const on = target?.id === m.id
              return (
                <button key={m.id} onClick={() => setTarget(m)} aria-pressed={on} className="appui flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                  <Avatar m={m} size={58} ring={on} mood />
                  <span className={`w-full truncate text-center text-[12.5px] ${on ? 'font-extrabold text-encre' : 'font-semibold text-brume'}`}>{m.display_name}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {THOUGHTS.map((t) => {
              const on = kind === t.key && !message.trim()
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setKind(t.key)
                    setMessage('')
                  }}
                  aria-pressed={on}
                  className={`appui flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-3 text-left ${on ? 'border-lavande-400 bg-lavande-100' : 'border-transparent bg-white shadow-carte'}`}
                >
                  <span className="text-[26px] leading-none">{t.emoji}</span>
                  <span className="text-[14px] font-bold leading-tight">{t.label}</span>
                </button>
              )
            })}
          </div>
          <input className="champ mt-3" placeholder="Ou glisse-lui un petit mot…" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
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
  const unseen = state.thoughts.filter((t) => t.to_member === state.me.id && !t.seen_at)
  const t = unseen[unseen.length - 1] // la plus ancienne d'abord
  if (!t) return null
  const from = state.members.find((m) => m.id === t.from_member)
  if (!from) return null
  const th = thoughtOf(t.kind)
  const seen = () => run((api) => api.markSeen([t.id]))
  const back = () =>
    run(async (api) => {
      await api.markSeen([t.id])
      await api.sendThought(state.family.id, state.me.id, from.id, 'calin')
    }, `Câlin envoyé à ${from.display_name}`)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-8" role="dialog" aria-modal="true" aria-label="Attention reçue">
      <div className="anim-fondu absolute inset-0 bg-encre/40 backdrop-blur-[3px]" />
      <Coeurs emoji={th.emoji} />
      <div className="anim-pop relative z-[60] w-full max-w-[320px] rounded-4xl bg-creme px-6 pb-6 pt-8 text-center shadow-doux">
        <span className="anim-bat inline-block">
          <Avatar m={from} size={88} />
        </span>
        <p className="titre mt-4 text-[23px] leading-tight">
          {from.display_name} {th.said}
        </p>
        {t.message ? (
          <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-[16px] leading-snug shadow-carte">« {t.message} »</p>
        ) : (
          <p className="mt-2 text-[40px] leading-none">{th.emoji}</p>
        )}
        <Btn className="mt-5" onClick={back}>🤗 Renvoyer un câlin</Btn>
        <button onClick={seen} className="mt-3 h-10 w-full text-[15px] font-bold text-brume">
          {unseen.length > 1 ? `Suivant (${unseen.length - 1} de plus)` : 'Merci'}
        </button>
      </div>
    </div>
  )
}

// ───────── Nouvel événement ─────────

const KINDS: { key: EventKind; label: string; emoji: string }[] = [
  { key: 'evenement', label: 'Événement', emoji: '🎉' },
  { key: 'rdv', label: 'Rendez-vous', emoji: '📍' },
  { key: 'anniversaire', label: 'Anniversaire', emoji: '🎂' },
]
export const eventEmoji = (k: string) => KINDS.find((x) => x.key === k)?.emoji ?? '🎉'

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
      'Ajouté à l’agenda de la famille',
    )
    if (ok) onClose()
  }

  return (
    <Sheet title="Ajouter à l’agenda" onClose={onClose}>
      <div className="flex gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            aria-pressed={kind === k.key}
            className={`appui flex-1 rounded-2xl border-2 py-2.5 text-[13px] font-bold ${kind === k.key ? 'border-lavande-400 bg-lavande-100' : 'border-transparent bg-white shadow-carte'}`}
          >
            <span className="block text-[22px] leading-tight">{k.emoji}</span>
            {k.label}
          </button>
        ))}
      </div>
      <input className="champ mt-3" placeholder={birthday ? 'Anniversaire de…' : 'Quoi de prévu ?'} maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="mt-3 flex gap-3">
        <label className="flex-1 text-[13px] font-bold text-brume">
          Date
          <input type="date" className="champ mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {!birthday && (
          <label className="w-[38%] text-[13px] font-bold text-brume">
            Heure
            <input type="time" className="champ mt-1" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
      </div>
      {birthday && <p className="mt-2 text-[13px] text-brume">Il reviendra tout seul chaque année.</p>}
      <Btn className="mt-4" onClick={save} disabled={!title.trim() || !date}>Ajouter</Btn>
    </Sheet>
  )
}

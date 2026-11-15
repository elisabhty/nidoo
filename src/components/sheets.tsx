import { Camera, Images, Repeat, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { moodOf, MOODS, THOUGHTS, thoughtOf } from '../lib/data'
import { feel, select, success } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { EventKind, FamEvent, Member, ThoughtKind } from '../lib/types'
import { compressImage, errorText, isToday, timeLabel } from '../lib/util'
import { DrawSheet, IncomingDrawing, markDrawingsSeen, useUnseenDrawings } from './drawing'
import { Art, Avatar, Btn, confirmer, Envol, Segments, Sheet } from './ui'

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
              <Avatar m={{ ...who, mood: m.key, mood_at: new Date().toISOString() }} size={56} mood />
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
  const kind = t?.kind
  useEffect(() => {
    if (id && kind) feel(kind)
  }, [id, kind])
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
export function EventSheet({ onClose, day }: { onClose: () => void; day?: Date }) {
  const { state, run } = useHome()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EventKind>('evenement')
  const first = day ?? new Date(Date.now() + 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const [date, setDate] = useState(`${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`)
  const [time, setTime] = useState('')
  const [description, setDescription] = useState('')
  const [who, setWho] = useState<string[]>([])
  const birthday = kind === 'anniversaire'

  const save = async () => {
    const allDay = birthday || !time
    const starts = new Date(`${date}T${allDay ? '09:00' : time}`)
    if (Number.isNaN(starts.getTime())) return
    const ok = await run(
      (api) => api.addEvent(state.family.id, state.me.id, { title: title.trim(), kind, starts_at: starts.toISOString(), all_day: allDay, yearly: birthday, description: description.trim() || null, members: who }),
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
      <p className="entete mt-5 !px-1">Qui est concerné</p>
      <WhoPicker value={who} onChange={setWho} />
      <textarea
        className="groupe mt-4 block min-h-[96px] w-full resize-none px-4 py-3 text-corps outline-none placeholder:text-pale"
        placeholder="Description (facultatif) : l’adresse, qui apporte quoi…"
        maxLength={500}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Description"
      />
      <Btn className="mt-4" onClick={save} disabled={!title.trim() || !date}>Ajouter</Btn>
    </Sheet>
  )
}

/** Un événement ouvert : la date, qui l'a ajouté, et sa description, que chacun peut compléter. */
export function EventDetailSheet({ event, at, onClose }: { event: FamEvent; at: Date; onClose: () => void }) {
  const { state, run } = useHome()
  const [text, setText] = useState(event.description ?? '')
  const [who, setWho] = useState<string[]>(event.members ?? [])
  const [editWho, setEditWho] = useState(false)
  const sameWho = who.length === (event.members ?? []).length && who.every((id) => event.members?.includes(id))
  const changed = text.trim() !== (event.description ?? '').trim() || !sameWho
  const author = state.members.find((m) => m.id === event.created_by)
  const full = at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())
  const d0 = new Date()
  d0.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - d0.getTime()) / 86400000)
  const soon = diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : diff > 1 && diff <= 30 ? `Dans ${diff} jours` : null

  return (
    <Sheet title={KINDS.find((k) => k.key === event.kind)?.label ?? 'Événement'} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Art name={eventArt(event.kind)} size={72} />
        <p className="mt-2 font-rond text-titre2">{event.title}</p>
        <p className="mt-1 text-sous text-brume">
          {full}
          {event.all_day ? ' · toute la journée' : ` · ${timeLabel(at)}`}
        </p>
        <span className="mt-2 flex flex-wrap justify-center gap-1.5">
          {soon && <span className="rounded-full bg-peche-doux px-2.5 py-1 text-legende font-semibold text-peche-fonce">{soon}</span>}
          {event.yearly && (
            <span className="flex items-center gap-1 rounded-full bg-remplissage px-2.5 py-1 text-legende font-semibold text-brume">
              <Repeat size={12} strokeWidth={2.6} /> Chaque année
            </span>
          )}
        </span>
      </div>

      <div className="mt-5 flex items-baseline justify-between px-1">
        <p className="entete !px-0">Qui est concerné</p>
        <button
          onClick={() => {
            select()
            setEditWho((v) => !v)
          }}
          className="presse pb-1.5 text-sous font-medium text-teinte"
        >
          {editWho ? 'Terminé' : 'Modifier'}
        </button>
      </div>
      {editWho ? <WhoPicker value={who} onChange={setWho} /> : <WhoList ids={who} />}

      <p className="entete mt-5 !px-1">Description</p>
      <textarea
        className="groupe block min-h-[120px] w-full resize-none px-4 py-3 text-corps outline-none placeholder:text-pale"
        placeholder="Ajoute une description : l’adresse, l’heure du rendez-vous, qui apporte quoi…"
        maxLength={500}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Description de l’événement"
      />
      <p className="px-1 pt-1.5 text-note text-brume">Toute la famille la voit et peut la compléter.</p>
      {changed && (
        <Btn
          className="mt-3"
          onClick={async () => {
            const ok = await run((api) => api.updateEvent(event.id, { description: text.trim() || null, members: who }), 'Événement mis à jour')
            if (ok) {
              success()
              setEditWho(false)
            }
          }}
        >
          Enregistrer
        </Btn>
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
        className="mt-4 !text-rouge"
        kind="gris"
        onClick={async () => {
          if (!(await confirmer({ title: `Supprimer « ${event.title} » ?`, message: 'Il disparaîtra de l’agenda de toute la famille.', confirm: 'Supprimer l’événement', destructive: true }))) return
          if (await run((api) => api.deleteEvent(event.id), 'Événement supprimé')) onClose()
        }}
      >
        <Trash2 size={17} strokeWidth={2.4} /> Supprimer l’événement
      </Btn>
    </Sheet>
  )
}

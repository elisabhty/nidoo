import { ArrowUp, Check, ImagePlus, ListPlus, Mic, Pause, Play, Plus, Smile, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PhotoEditeur } from '../components/photoEditeur'
import { StickerImg, StickerTray } from '../components/stickers'
import { Art, Avatar, confirmer, Sheet } from '../components/ui'
import { REACTIONS } from '../lib/data'
import { select, success, tap } from '../lib/haptic'
import { bulle } from '../lib/sons'
import { useHome } from '../lib/store'
import { cleSticker, PERSO } from '../lib/stickers'
import type { Ecrit, Member, Moment } from '../lib/types'

// Le fil de la famille, comme une discussion : des bulles avec des photos (qu'on peut annoter), du texte,
// des liens, des vocaux et des stickers en feutrine. On voit en direct qui écrit, qui enregistre un vocal, qui choisit une photo.

const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const jour = (iso: string) => {
  const d = new Date(iso)
  const a = new Date()
  a.setHours(0, 0, 0, 0)
  const j = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - a.getTime()) / 86400000)
  if (j === 0) return 'Aujourd’hui'
  if (j === -1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ───────── Les liens ─────────

const LIEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"»])|(www\.[^\s<]+[^\s<.,;:!?)\]'"»])/gi
const urlDe = (s: string) => (s.startsWith('http') ? s : `https://${s}`)
function youtube(u: URL) {
  if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1) || null
  if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null)
  return null
}

function Texte({ body, mine }: { body: string; mine: boolean }) {
  const morceaux: (string | { url: string; txt: string })[] = []
  let i = 0
  for (const m of body.matchAll(LIEN)) {
    if (m.index! > i) morceaux.push(body.slice(i, m.index))
    morceaux.push({ url: urlDe(m[0]), txt: m[0] })
    i = m.index! + m[0].length
  }
  if (i < body.length) morceaux.push(body.slice(i))
  return (
    <p className="whitespace-pre-wrap break-words text-appel">
      {morceaux.map((x, k) =>
        typeof x === 'string' ? (
          x.replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') // pas de « ? » tout seul en début de ligne
        ) : (
          <a key={k} href={x.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`underline decoration-2 underline-offset-2 ${mine ? 'text-white' : 'text-teinte-fonce'}`}>
            {x.txt}
          </a>
        ),
      )}
    </p>
  )
}

/** L'aperçu du premier lien : la miniature d'une vidéo YouTube, sinon l'icône et le nom du site. */
function Apercu({ body, mine }: { body: string; mine: boolean }) {
  const m = body.match(LIEN)
  const [icone, setIcone] = useState(true)
  if (!m) return null
  let u: URL
  try {
    u = new URL(urlDe(m[0]))
  } catch {
    return null
  }
  const yt = youtube(u)
  const site = u.hostname.replace(/^www\./, '')
  return (
    <a
      href={u.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 block overflow-hidden rounded-[14px] ${mine ? 'bg-white/15' : 'bg-remplissage'}`}
    >
      {yt && <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" className="block aspect-video w-full object-cover" />}
      <span className="flex items-center gap-2 px-3 py-2">
        {yt ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#FF0033] text-[9px] text-white">▶</span>
        ) : icone ? (
          <img src={`https://${u.hostname}/favicon.ico`} alt="" className="h-5 w-5 rounded-[5px]" onError={() => setIcone(false)} />
        ) : (
          <span className="h-5 w-5 rounded-[5px] bg-white/40" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sous font-semibold">{yt ? 'Vidéo YouTube' : site}</span>
          <span className={`block truncate text-note ${mine ? 'text-white/75' : 'text-brume'}`}>{yt ? site : u.pathname === '/' ? 'Ouvrir le lien' : decodeURIComponent(u.pathname)}</span>
        </span>
      </span>
    </a>
  )
}

// ───────── Les vocaux ─────────

/** Une onde « au hasard » mais toujours la même pour un vocal sans onde enregistrée. */
function ondeDe(mo: Moment, n = 32) {
  const src = mo.ondes?.length ? mo.ondes : Array.from({ length: n }, (_, i) => 30 + ((mo.id.charCodeAt(i % mo.id.length) * (i + 7)) % 60))
  return Array.from({ length: n }, (_, i) => src[Math.floor((i * src.length) / n)] ?? 30)
}

function Vocal({ mo, mine }: { mo: Moment; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [joue, setJoue] = useState(false)
  const [t, setT] = useState(0)
  const duree = mo.duree ?? 0
  const onde = useMemo(() => ondeDe(mo), [mo])
  useEffect(() => () => audio.current?.pause(), [])
  const basculer = () => {
    tap()
    if (!mo.audio_url) return
    if (!audio.current) {
      const a = new Audio(mo.audio_url)
      a.ontimeupdate = () => setT(a.currentTime)
      a.onended = () => {
        setJoue(false)
        setT(0)
      }
      audio.current = a
    }
    if (joue) {
      audio.current.pause()
      setJoue(false)
    } else {
      void audio.current.play().then(() => setJoue(true)).catch(() => setJoue(false))
    }
  }
  const p = duree ? Math.min(1, t / duree) : 0
  return (
    <div className="flex items-center gap-2.5 py-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={basculer}
        className={`presse flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${mine ? 'bg-white text-teinte' : 'bg-teinte text-white'}`}
        aria-label={joue ? 'Pause' : 'Écouter le vocal'}
      >
        {joue ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={18} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
      </button>
      <span className="flex h-9 min-w-0 flex-1 items-center gap-[2px]" aria-hidden="true">
        {onde.map((v, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full transition-colors"
            style={{
              height: `${Math.max(14, Math.min(100, v)) * 0.34}px`,
              background: i / onde.length < p ? (mine ? '#FFFFFF' : '#6646CC') : mine ? 'rgba(255,255,255,0.45)' : 'rgba(102,70,204,0.3)',
              animation: joue && Math.abs(i / onde.length - p) < 0.06 ? 'points 0.6s ease-in-out infinite' : undefined,
            }}
          />
        ))}
      </span>
      <span className={`w-9 shrink-0 text-right text-note font-semibold tabular-nums ${mine ? 'text-white/85' : 'text-brume'}`}>{mmss(joue ? Math.max(0, duree - t) : duree)}</span>
    </div>
  )
}


/** Un sondage fait partie de la conversation, avec les résultats partagés en direct. */
function Sondage({ mo, mine, envoi }: { mo: Moment; mine: boolean; envoi?: boolean }) {
  const { state, run } = useHome()
  const options = mo.poll_options ?? []
  const votes = state.pollVotes.filter((v) => v.moment_id === mo.id)
  const mien = votes.find((v) => v.member_id === state.me.id)?.option_index
  const total = votes.length
  const [voteEnCours, setVoteEnCours] = useState(false)
  const choisirVote = async (index: number) => {
    if (envoi || voteEnCours || mien === index) return
    select()
    setVoteEnCours(true)
    try {
      await run((api) => api.votePoll(mo, state.me.id, index))
    } finally {
      setVoteEnCours(false)
    }
  }
  return (
    <div className="w-[min(72vw,330px)] min-w-[210px] max-w-full" onClick={(e) => e.stopPropagation()}>
      <p className={`mb-1 text-note font-bold ${mine ? 'text-white/80' : 'text-teinte-fonce'}`}>Sondage</p>
      <p className="mb-3 whitespace-pre-wrap break-words text-corps font-semibold">{mo.body}</p>
      <div className="space-y-2">
        {options.map((option, index) => {
          const nb = votes.filter((v) => v.option_index === index).length
          const pct = total ? Math.round((nb / total) * 100) : 0
          const selected = mien === index
          return (
            <button
              key={index}
              disabled={envoi || voteEnCours || selected}
              onClick={() => void choisirVote(index)}
              className={`presse relative flex min-h-[44px] w-full items-center gap-2 overflow-hidden rounded-[12px] border px-3 py-2 text-left text-sous disabled:opacity-85 ${mine ? 'border-white/30 bg-white/10 text-white' : 'border-teinte/20 bg-teinte-doux/60 text-encre'}`}
              aria-label={`${option}${mien !== undefined ? `, ${pct} %` : ''}`}
            >
              {mien !== undefined && <span className={`absolute inset-y-0 left-0 ${mine ? 'bg-white/20' : 'bg-teinte/15'}`} style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
                {selected && <Check size={15} className="shrink-0" strokeWidth={3} />}
                <span className="break-words">{option}</span>
              </span>
              {mien !== undefined && <span className="relative shrink-0 font-bold tabular-nums">{pct} %</span>}
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-note ${mine ? 'text-white/80' : 'text-brume'}`}>
        {total} vote{total > 1 ? 's' : ''}{mien === undefined ? ' · Choisis une réponse' : ' · Tu peux changer ton vote'}
      </p>
    </div>
  )
}

// ───────── Une bulle ─────────

/** Garde l’aperçu visible jusqu’au décodage de la photo confirmée. */
function PhotoDuFil({ src, alt, anim, onPhoto, releasePhoto }: { src: string; alt: string; anim: boolean; onPhoto: (url: string) => void; releasePhoto: (url: string) => void }) {
  const [visible, setVisible] = useState(src)
  useEffect(() => {
    if (src === visible) return
    let active = true
    const image = new Image()
    image.src = src
    void image.decode().then(() => {
      if (active) setVisible(src)
    }).catch(() => { /* L’aperçu reste visible si le téléchargement échoue. */ })
    return () => { active = false }
  }, [src, visible])
  const precedente = useRef(visible)
  useEffect(() => {
    const ancienne = precedente.current
    precedente.current = visible
    if (ancienne !== visible) releasePhoto(ancienne)
  }, [visible, releasePhoto])
  return <img
    src={visible}
    alt={alt}
    loading={anim ? 'eager' : 'lazy'}
    onClick={(e) => { e.stopPropagation(); onPhoto(visible) }}
    className="block max-h-[340px] w-full min-w-[180px] rounded-[18px] object-cover"
  />
}

function Bulle({ mo, auteur, mine, premier, dernier, ouvert, onOuvrir, onPhoto, anim, envoi, envoye, pret, releasePhoto }: { releasePhoto: (url: string) => void; mo: Moment; auteur: Member; mine: boolean; premier: boolean; dernier: boolean; ouvert: boolean; onOuvrir: () => void; onPhoto: (url: string) => void; /** un nouveau message : il entre en bougeant */ anim: boolean; /** en cours d'envoi */ envoi?: boolean; /** le dernier message, le nôtre, est bien parti */ envoye?: boolean; /** le fil est affiché depuis un moment : les nouvelles réactions sautent */ pret: boolean }) {
  const { state, run } = useHome()
  const rs = state.reactions.filter((r) => r.moment_id === mo.id)
  const maReaction = rs.find((r) => r.member_id === state.me.id)?.emoji
  const groupes = REACTIONS.map((r) => ({ ...r, n: rs.filter((x) => x.emoji === r.key).length })).filter((r) => r.n > 0)
  const photoSeule = !!mo.image_url && !mo.body && !mo.challenge
  const stickerSeul = !!mo.sticker && !mo.image_url && !mo.audio_path && !mo.body
  const coin = mine ? (dernier ? 'rounded-[22px] rounded-br-[8px]' : 'rounded-[22px] rounded-r-[10px]') : dernier ? 'rounded-[22px] rounded-bl-[8px]' : 'rounded-[22px] rounded-l-[10px]'

  return (
    <div className={`flex items-end gap-2 ${mine ? 'justify-end' : ''} ${dernier ? 'mb-3' : 'mb-[3px]'} ${groupes.length && !dernier ? 'pb-4' : ''}`}>
      {!mine && <span className="w-8 shrink-0">{dernier && <Avatar m={auteur} size={32} />}</span>}
      <div className={`relative flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && premier && <span className="mb-1 ml-3 text-note font-semibold text-brume">{auteur.display_name}</span>}
        {ouvert && (
          <div className={`anim-pop absolute bottom-full z-10 mb-1.5 flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(29,26,43,0.18)] ${mine ? 'right-0' : 'left-0'}`}>
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                onClick={(e) => {
                  e.stopPropagation()
                  select()
                  onOuvrir()
                  void run((api) => api.react(mo, state.me.id, maReaction === r.key ? null : r.key))
                }}
                className={`presse flex h-10 w-10 items-center justify-center rounded-full ${maReaction === r.key ? 'bg-teinte-doux' : ''}`}
                aria-label={r.label}
              >
                <Art name={r.art} size={26} />
              </button>
            ))}
            {mine && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  onOuvrir()
                  if (await confirmer({ title: 'Ce message sera supprimé pour toute la famille.', confirm: 'Supprimer', destructive: true })) void run((api) => api.deleteMoment(mo), 'Message supprimé')
                }}
                className="presse ml-0.5 flex h-10 w-10 items-center justify-center rounded-full text-[#E0604F]"
                aria-label="Supprimer"
              >
                <Trash2 size={19} />
              </button>
            )}
          </div>
        )}
        <div className="relative max-w-full">
        {stickerSeul ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (envoi) return
              tap()
              onOuvrir()
            }}
            className={`presse flex h-[136px] w-[116px] items-center justify-center bg-transparent py-1 ${anim ? 'anim-colle' : ''}`}
          >
            <StickerImg cle={mo.sticker!} className="block h-full w-full object-contain" />
          </div>
        ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (envoi) return
            tap()
            onOuvrir()
          }}
          className={`presse relative overflow-hidden transition-opacity ${anim ? (mine ? (mo.image_url ? 'anim-photo-envoi' : 'anim-envoi reflet') : 'anim-arrive') : ''} ${envoi && !mo.image_url ? 'opacity-75' : ''} ${coin} ${photoSeule ? 'p-1' : mo.image_url ? 'p-1 pb-2' : 'px-3.5 py-2'} ${mine ? 'text-white' : 'bg-white text-encre shadow-carte'}`}
          style={mine ? { background: 'linear-gradient(150deg, #8E6CF0, #6646CC)' } : undefined}
        >
          {mo.challenge && (
            <p className={`mb-1 text-note font-semibold ${mo.image_url ? 'px-2.5 pt-1.5' : ''} ${mine ? 'text-white/85' : 'text-peche-fonce'}`}>📸 Défi photo · {mo.challenge}</p>
          )}
          {mo.image_url && (
            <PhotoDuFil src={mo.image_url} alt={mo.body ?? `Photo de ${auteur.display_name}`} anim={anim} onPhoto={onPhoto} releasePhoto={releasePhoto} />
          )}
          {mo.audio_path && (mo.audio_url ? <Vocal mo={mo} mine={mine} /> : <p className="text-sous opacity-80">Vocal indisponible</p>)}
          {mo.body && (
            <div className={mo.image_url ? 'px-2.5 pt-2' : ''}>
              {mo.poll_options?.length ? <Sondage mo={mo} mine={mine} envoi={envoi} /> : <><Texte body={mo.body} mine={mine} /><Apercu body={mo.body} mine={mine} /></>}
            </div>
          )}
        </div>
        )}
        {groupes.length > 0 && (
          <span className={`absolute -bottom-4 flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 shadow-carte ${mine ? 'right-2' : 'left-2'}`}>
            {groupes.map((g) => (
              <span key={g.key} className={`flex items-center ${pret ? 'anim-pop' : ''}`}>
                <Art name={g.art} size={17} />
                {g.n > 1 && <span className="pr-0.5 text-mini font-semibold text-brume">{g.n}</span>}
              </span>
            ))}
          </span>
        )}
        </div>
        {envoi ? (
          <span className={`flex items-center gap-0.5 text-mini text-pale ${mine ? 'mr-1.5' : 'ml-3'} mt-1`}>
            Envoi
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-1 w-1 rounded-full bg-pale" style={{ animation: `points 1.2s ${k * 0.18}s ease-in-out infinite` }} />
            ))}
          </span>
        ) : (
          dernier && (
            <span className={`text-mini text-pale ${mine ? 'mr-1.5' : 'ml-3'} ${groupes.length ? 'mt-5' : 'mt-1'}`}>
              {heure(mo.created_at)}
              {envoye && <span className="anim-fondu font-semibold text-teinte"> · Envoyé ✓</span>}
            </span>
          )
        )}
      </div>
    </div>
  )
}

// ───────── Qui écrit ─────────

const FAIT: Record<Ecrit, [string, string]> = {
  texte: ['écrit…', 'écrivent…'],
  vocal: ['enregistre un vocal…', 'enregistrent un vocal…'],
  photo: ['choisit une photo…', 'choisissent une photo…'],
  sticker: ['choisit un sticker…', 'choisissent un sticker…'],
}

function Ecrivent({ qui }: { qui: { m: Member; quoi: Ecrit }[] }) {
  if (!qui.length) return null
  const quoi = qui[0].quoi
  const noms = qui.map((x) => x.m.display_name)
  const texte = `${noms.length > 2 ? `${noms.slice(0, 2).join(', ')} et ${noms.length - 2} autre${noms.length > 3 ? 's' : ''}` : noms.join(' et ')} ${FAIT[quoi][noms.length > 1 ? 1 : 0]}`
  return (
    <div className="anim-pop mb-3 flex items-end gap-2" aria-live="polite">
      <span className="flex w-8 shrink-0 justify-end">
        <span className="flex -space-x-3">
          {qui.slice(0, 3).map((x) => (
            <span key={x.m.id} className="rounded-full ring-2 ring-fond">
              <Avatar m={x.m} size={32} />
            </span>
          ))}
        </span>
      </span>
      <div className={`flex flex-col items-start ${qui.length > 1 ? 'ml-3' : ''}`}>
        <span className="flex h-10 items-center gap-1.5 rounded-[22px] rounded-bl-[8px] bg-white px-4 shadow-carte">
          {quoi === 'vocal' && <Mic size={15} className="mr-0.5 text-[#E0604F]" style={{ animation: 'scintille 1.2s ease-in-out infinite' }} />}
          {quoi === 'photo' && <ImagePlus size={15} className="mr-0.5 text-teinte" />}
          {quoi === 'sticker' && <Smile size={15} className="mr-0.5 text-teinte" />}
          {[0, 1, 2].map((k) => (
            <span key={k} className="h-2 w-2 rounded-full bg-brume" style={{ animation: `points 1.2s ${k * 0.18}s ease-in-out infinite` }} />
          ))}
        </span>
        <span className="ml-3 mt-1 text-mini text-brume">{texte}</span>
      </div>
    </div>
  )
}


/** La composition d'un sondage reprend la feuille iOS de l'application. */
function SondageCompose({ onClose, envoyer }: { onClose: () => void; envoyer: (m: NouvelEnvoi) => Promise<boolean> }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const cleaned = options.map((s) => s.trim()).filter(Boolean)
  const valid = question.trim().length > 0 && cleaned.length >= 2 && cleaned.length === options.length && new Set(cleaned.map((s) => s.toLowerCase())).size === cleaned.length
  const publier = async () => {
    if (!valid || loading) return
    setLoading(true)
    try {
      if (await envoyer({ body: question.trim().slice(0, 200), pollOptions: cleaned })) onClose()
    } finally {
      setLoading(false)
    }
  }
  return (
    <Sheet title="Nouveau sondage" onClose={onClose} footer={
      <button disabled={!valid || loading} onClick={() => void publier()} className="presse ios-primary btn-desactive flex min-h-[52px] w-full items-center justify-center rounded-full font-bold text-white">
        {loading ? 'Publication…' : 'Publier le sondage'}
      </button>
    }>
      <p className="mb-4 text-sous text-brume">Pose une question à toute la famille. Chacun pourra voter une fois, et modifier son choix.</p>
      <label className="mb-1 block text-sous font-semibold">Question</label>
      <textarea aria-label="Question du sondage" value={question} onChange={(e) => setQuestion(e.target.value.slice(0, 200))} maxLength={200} rows={2} placeholder="On se retrouve où dimanche ?" className="mb-5 w-full resize-none rounded-[16px] bg-white px-4 py-3 text-corps outline-none focus:ring-2 focus:ring-teinte" />
      <p className="mb-2 text-sous font-semibold">Réponses possibles</p>
      <div className="space-y-2">
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <input aria-label={`Réponse ${i + 1}`} value={option} maxLength={80} onChange={(e) => setOptions((x) => x.map((v, j) => j === i ? e.target.value : v))} placeholder={`Choix ${i + 1}`} className="min-h-[48px] min-w-0 flex-1 rounded-[14px] bg-white px-4 text-corps outline-none focus:ring-2 focus:ring-teinte" />
            {options.length > 2 && <button aria-label={`Retirer la réponse ${i + 1}`} onClick={() => setOptions((x) => x.filter((_, j) => j !== i))} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brume"><X size={18} /></button>}
          </div>
        ))}
      </div>
      {options.length < 6 && <button onClick={() => setOptions((x) => [...x, ''])} className="presse mt-3 flex min-h-[44px] items-center gap-2 font-semibold text-teinte-fonce"><Plus size={18} /> Ajouter une réponse</button>}
      <p className="mt-3 text-note text-brume">De 2 à 6 réponses · Une seule réponse par personne</p>
    </Sheet>
  )
}

// ───────── La barre d'envoi ─────────

type Enreg = { rec: MediaRecorder; stream: MediaStream; ctx: AudioContext; t0: number; niveaux: number[]; morceaux: Blob[]; timer: number }

function Saisie({ onPhoto, envoyer }: { onPhoto: (f: File) => void; envoyer: (m: NouvelEnvoi) => Promise<boolean> }) {
  const { state, api, toast } = useHome()
  const { family, me } = state
  const [texte, setTexte] = useState('')
  const [enreg, setEnreg] = useState<Enreg | null>(null)
  const [tiroir, setTiroir] = useState(false)
  const [sondage, setSondage] = useState(false)
  const [, tic] = useState(0)
  const zone = useRef<HTMLTextAreaElement>(null)
  const fichier = useRef<HTMLInputElement>(null)
  const dernierSignal = useRef(0)

  const signal = (quoi: Ecrit | null) => {
    const t = Date.now()
    if (quoi && t - dernierSignal.current < 2500) return
    dernierSignal.current = quoi ? t : 0
    api.ecrit(family.id, me.id, quoi)
  }
  useEffect(() => () => api.ecrit(family.id, me.id, null), []) // eslint-disable-line react-hooks/exhaustive-deps
  // la zone de texte grandit avec le message (jusqu'à 5 lignes)
  useEffect(() => {
    const z = zone.current
    if (!z) return
    z.style.height = 'auto'
    z.style.height = `${Math.min(z.scrollHeight, 22 * 5 + 16)}px`
  }, [texte])

  const envoyerTexte = async () => {
    const t = texte.trim()
    if (!t) return
    signal(null)
    setTexte('')
    if (!(await envoyer({ body: t.slice(0, 1000) }))) setTexte((x) => x || t)
  }

  // ── le vocal : le micro, une petite onde en direct, 2 minutes au plus
  const demarrer = async () => {
    tap()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Les vocaux ne marchent pas sur ce navigateur.', 'err')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((x) => MediaRecorder.isTypeSupported?.(x))
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      const morceaux: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && morceaux.push(e.data)
      rec.start(250)
      const ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.fftSize)
      const e: Enreg = { rec, stream, ctx, t0: Date.now(), niveaux: [], morceaux, timer: 0 }
      e.timer = window.setInterval(() => {
        an.getByteTimeDomainData(buf)
        let s = 0
        for (const v of buf) s += ((v - 128) / 128) ** 2
        e.niveaux.push(Math.min(100, Math.round(Math.sqrt(s / buf.length) * 320)))
        if (Date.now() - e.t0 > 120000) void arreter(e, true)
        tic((n) => n + 1)
      }, 100)
      setEnreg(e)
      signal('vocal')
    } catch {
      toast('Pour envoyer un vocal, autorise le micro : Réglages de l’iPhone › NIDOO › Micro.', 'err')
    }
  }
  const arreter = async (e: Enreg, garder: boolean) => {
    window.clearInterval(e.timer)
    setEnreg(null)
    signal(null)
    const fini = new Promise<void>((res) => {
      e.rec.onstop = () => res()
    })
    if (e.rec.state !== 'inactive') e.rec.stop()
    await fini
    e.stream.getTracks().forEach((t) => t.stop())
    void e.ctx.close()
    const duree = (Date.now() - e.t0) / 1000
    if (!garder || duree < 0.8) return
    const blob = new Blob(e.morceaux, { type: e.rec.mimeType || e.morceaux[0]?.type || 'audio/mp4' })
    const n = 40
    const ondes = Array.from({ length: n }, (_, i) => {
      const a = Math.floor((i * e.niveaux.length) / n)
      const b = Math.max(a + 1, Math.floor(((i + 1) * e.niveaux.length) / n))
      const tranche = e.niveaux.slice(a, b)
      return tranche.length ? Math.round(Math.max(...tranche)) : 10
    })
    void envoyer({ audio: { blob, duree, ondes } })
  }

  const envoyerSticker = async (key: string, t?: string, c?: number) => {
    const cle = key === PERSO ? cleSticker({ i: PERSO, t, c }) : key
    signal(null)
    await envoyer({ sticker: cle.slice(0, 60) })
  }

  const secondes = enreg ? (Date.now() - enreg.t0) / 1000 : 0
  // La zone qui défile garde 120 px de marge en bas (pour la barre d'onglets) : la barre d'envoi se cale juste au-dessus des onglets.
  return (
    <div className="fil-saisie sticky z-10 -mx-3 mt-2 px-3 pb-2 pt-1" style={{ bottom: 'calc(var(--sab) - 40px)', marginBottom: 'calc(var(--sab) - 40px)' }}>
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onPhoto(f)
          else signal(null)
        }}
      />
      {sondage && createPortal(<div className="fixed inset-0 z-[95]"><SondageCompose onClose={() => setSondage(false)} envoyer={envoyer} /></div>, document.body)}
      {tiroir && !enreg && (
        <div className="mb-2 [&>div]:!mt-0">
          <StickerTray
            start="emojis"
            onPick={(key, t, c) => void envoyerSticker(key, t, c)}
            onClose={() => {
              setTiroir(false)
              signal(null)
            }}
          />
        </div>
      )}
      {enreg ? (
        <div className="anim-pop flex h-[54px] items-center gap-2.5 rounded-full bg-white pl-2 pr-1.5 shadow-[0_8px_28px_rgba(29,26,43,0.16)]">
          <button onClick={() => void arreter(enreg, false)} className="presse flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#E0604F]" aria-label="Annuler le vocal">
            <Trash2 size={20} />
          </button>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E0604F]" style={{ animation: 'scintille 1s ease-in-out infinite' }} />
          <span className="w-10 shrink-0 text-sous font-semibold tabular-nums text-encre">{mmss(secondes)}</span>
          <span className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden="true">
            {enreg.niveaux.slice(-34).map((v, i) => (
              <span key={i} className="w-[3px] shrink-0 rounded-full bg-teinte" style={{ height: `${Math.max(3, v * 0.3)}px` }} />
            ))}
          </span>
          <button onClick={() => void arreter(enreg, true)} className="presse ios-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" aria-label="Envoyer le vocal">
            <ArrowUp size={22} strokeWidth={2.6} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 rounded-[28px] bg-white p-1.5 shadow-[0_8px_28px_rgba(29,26,43,0.16)]">
          <button
            onClick={() => {
              tap()
              signal('photo')
              fichier.current?.click()
            }}
            className="presse flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce"
            aria-label="Envoyer une photo"
          >
            <ImagePlus size={20} />
          </button>
          <button onClick={() => { tap(); setTiroir(false); signal(null); setSondage(true) }} className="presse flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce" aria-label="Créer un sondage" title="Sondage"><ListPlus size={20} /></button>
          <textarea
            ref={zone}
            rows={1}
            value={texte}
            maxLength={1000}
            onChange={(e) => {
              setTexte(e.target.value)
              signal(e.target.value.trim() ? 'texte' : null)
            }}
            onFocus={() => setTiroir(false)}
            onBlur={() => signal(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                e.preventDefault()
                void envoyerTexte()
              }
            }}
            placeholder="Écris un message…"
            aria-label="Ton message"
            className="min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-[10px] text-corps leading-[22px] outline-none placeholder:text-pale"
          />
          {!texte.trim() && (
            <button
              onClick={() => {
                tap()
                const ouvrir = !tiroir
                setTiroir(ouvrir)
                signal(ouvrir ? 'sticker' : null)
              }}
              className={`presse flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full ${tiroir ? 'bg-teinte text-white' : 'text-brume'}`}
              aria-pressed={tiroir}
              aria-label="Envoyer un sticker"
            >
              <Smile size={22} />
            </button>
          )}
          {texte.trim() ? (
            <button onClick={() => void envoyerTexte()} className="presse ios-primary anim-pop flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white" aria-label="Envoyer">
              <ArrowUp size={22} strokeWidth={2.6} />
            </button>
          ) : (
            <button onClick={() => void demarrer()} className="presse flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-remplissage text-encre" aria-label="Enregistrer un vocal">
              <Mic size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ───────── L'envoi immédiat ─────────

/** Ce qu'on envoie : du texte, un sticker, une photo (avec sa légende) ou un vocal. */
type NouvelEnvoi = { body?: string; sticker?: string; blob?: Blob; pollOptions?: string[]; audio?: { blob: Blob; duree: number; ondes: number[] } }
/** Un message affiché tout de suite, le temps qu'il parte ; le vrai le remplace sans bruit dès qu'il arrive. */
type Envoi = { mo: Moment; cle: string; connus: Set<string> }
const cleDe = (x: { body?: string | null; sticker?: string | null; image: boolean; audio: boolean; poll?: string[] | null }) =>
  `${x.poll?.length ? 'sondage' : x.audio ? 'vocal' : x.image ? 'photo' : x.sticker ? 'sticker' : 'texte'}|${(x.body ?? '').trim()}|${x.sticker ?? ''}|${(x.poll ?? []).join('|')}`
const cleMoment = (m: Moment) => cleDe({ body: m.body, sticker: m.sticker, image: !!(m.image_path || m.image_url), audio: !!m.audio_path, poll: m.poll_options })

// ───────── Le fil ─────────

export default function Fil(_: { onCompose?: () => void }) {
  const { state, api, run } = useHome()
  const { family, me, members, moments } = state
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [plein, setPlein] = useState<string | null>(null)
  const [ecrivent, setEcrivent] = useState<Record<string, { quoi: Ecrit; at: number }>>({})
  const fin = useRef<HTMLDivElement>(null)
  const msgs = useMemo(() => [...moments].sort((a, b) => a.created_at.localeCompare(b.created_at)), [moments])
  const msgsRef = useRef(msgs)
  msgsRef.current = msgs

  // les messages déjà là à l'ouverture restent sages ; seuls les nouveaux entrent en bougeant
  const initiaux = useRef<Set<string> | null>(null)
  if (!initiaux.current) initiaux.current = new Set(moments.map((m) => m.id))
  // un message parti garde la place (et l'animation en cours) de sa bulle « en attente »
  const alias = useRef(new Map<string, string>())
  const [pret, setPret] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setPret(true), 900)
    return () => window.clearTimeout(t)
  }, [])

  // ce qu'on vient d'envoyer s'affiche tout de suite ; le vrai message prend sa place dès qu'il arrive
  const [envois, setEnvois] = useState<Envoi[]>([])
  const enAttente: Envoi[] = []
  const pris = new Set<string>()
  const confirmes = new Set<string>()
  for (const e of envois) {
    const vrai = msgs.find((m) => m.member_id === me.id && !e.connus.has(m.id) && !pris.has(m.id) && (!alias.current.has(m.id) || alias.current.get(m.id) === e.mo.id) && cleMoment(m) === e.cle)
    if (vrai) {
      pris.add(vrai.id)
      confirmes.add(e.mo.id)
      alias.current.set(vrai.id, e.mo.id)
    } else enAttente.push(e)
  }
  // Ne retire l’envoi provisoire qu’après un rendu où son identifiant définitif
  // a été associé : même si React groupe la confirmation et le rechargement,
  // la bulle et son image gardent leur identité et ne rejouent pas l’entrée.
  useEffect(() => {
    if (confirmes.size) setEnvois((current) => current.filter((e) => !confirmes.has(e.mo.id)))
  }, [envois, msgs]) // eslint-disable-line react-hooks/exhaustive-deps

  const photosLocales = useRef(new Set<string>())
  const releasePhoto = useCallback((url: string) => {
    // Seuls les aperçus créés ici nous appartiennent, pas les URL du cache partagé.
    if (photosLocales.current.delete(url)) URL.revokeObjectURL(url)
  }, [])
  useEffect(() => {
    const urls = photosLocales.current
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear() }
  }, [])

  const envoyer = async (m: NouvelEnvoi, onPreviewReady?: () => void) => {
    const id = `envoi-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const mo: Moment = {
      id, family_id: family.id, member_id: me.id, image_path: null, image_url: m.blob ? URL.createObjectURL(m.blob) : null,
      body: m.body?.trim() || null, challenge: null, created_at: new Date().toISOString(), sticker: m.sticker ?? null, poll_options: m.pollOptions ?? null,
      audio_path: m.audio ? 'envoi' : null, audio_url: m.audio ? URL.createObjectURL(m.audio.blob) : null, duree: m.audio ? Math.round(m.audio.duree) : null, ondes: m.audio?.ondes ?? null,
    }
    if (mo.image_url) {
      photosLocales.current.add(mo.image_url)
      const preview = new Image()
      preview.src = mo.image_url
      try { await preview.decode() } catch { /* L’envoi reste possible si l’aperçu ne se décode pas. */ }
    }
    setEnvois((x) => [...x, { mo, cle: cleDe({ body: m.body, sticker: m.sticker, image: !!m.blob, audio: !!m.audio, poll: m.pollOptions }), connus: new Set(msgsRef.current.map((y) => y.id)) }])
    onPreviewReady?.()
    bulle('envoi')
    const ok = await run((a) => a.postMoment(family.id, me.id, m))
    if (ok) success()
    // En cas d’échec seulement, on enlève immédiatement l’aperçu.
    // Le succès est réconcilié après le rendu du message définitif ci-dessus.
    if (!ok) setEnvois((x) => x.filter((y) => y.mo.id !== id))
    window.setTimeout(() => {
      if (mo.audio_url) URL.revokeObjectURL(mo.audio_url)
    }, 5000)
    return ok
  }

  // un message d'un proche arrive pendant qu'on regarde : petit « plop »
  const nbAutres = msgs.filter((m) => m.member_id !== me.id).length
  const nbAutresAvant = useRef(nbAutres)
  useEffect(() => {
    if (nbAutres > nbAutresAvant.current) bulle('arrive')
    nbAutresAvant.current = nbAutres
  }, [nbAutres])
  const liste = [...msgs.map((mo) => ({ mo, envoi: false })), ...enAttente.map((e) => ({ mo: e.mo, envoi: true }))]
  const dernierMien = !enAttente.length && msgs.length > 0 && msgs[msgs.length - 1].member_id === me.id ? msgs[msgs.length - 1].id : null

  // qui écrit, en direct (on oublie quelqu'un qui ne fait plus signe depuis 6 secondes)
  useEffect(() => {
    const off = api.onEcrit(family.id, me.id, ({ m, quoi }) =>
      setEcrivent((x) => {
        const y = { ...x }
        if (quoi) y[m] = { quoi, at: Date.now() }
        else delete y[m]
        return y
      }),
    )
    const t = window.setInterval(() => setEcrivent((x) => (Object.values(x).some((v) => Date.now() - v.at > 6000) ? Object.fromEntries(Object.entries(x).filter(([, v]) => Date.now() - v.at <= 6000)) : x)), 2000)
    return () => {
      off()
      window.clearInterval(t)
    }
  }, [api, family.id, me.id])
  // un message arrivé : son auteur n'écrit plus
  const dernier = msgs[msgs.length - 1]
  useEffect(() => {
    if (dernier)
      setEcrivent((x) => {
        if (!x[dernier.member_id]) return x
        const y = { ...x }
        delete y[dernier.member_id]
        return y
      })
  }, [dernier])

  const qui = Object.entries(ecrivent)
    .map(([id, v]) => ({ m: members.find((x) => x.id === id), quoi: v.quoi }))
    .filter((x): x is { m: Member; quoi: Ecrit } => !!x.m)

  // On atterrit toujours à la fin du fil : à l'ouverture, en revenant sur l'onglet, et quand une photo ou un sticker
  // finit de charger. On y reste tant qu'on n'est pas remonté lire plus haut.
  const racine = useRef<HTMLDivElement>(null)
  const colle = useRef(true)
  const boite = () => {
    let box: HTMLElement | null = racine.current?.parentElement ?? null
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
    return box
  }
  const enBas = (doux = false) => {
    const box = boite()
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: doux ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    const el = racine.current
    const box = boite()
    if (!el || !box) return
    enBas()
    const surScroll = () => {
      if (box.clientHeight) colle.current = box.scrollHeight - box.scrollTop - box.clientHeight < 140
    }
    let h = el.getBoundingClientRect().height
    const ro = new ResizeObserver(() => {
      const nh = el.getBoundingClientRect().height
      if (!nh) return void (h = 0) // onglet caché
      if (!h) colle.current = true // l'onglet revient : on retourne à la fin
      h = nh
      if (colle.current) enBas()
    })
    ro.observe(el)
    box.addEventListener('scroll', surScroll, { passive: true })
    return () => {
      ro.disconnect()
      box.removeEventListener('scroll', surScroll)
    }
  }, [])
  // un message ou quelqu'un qui écrit arrive : on suit si on était en bas, et toujours pour ce qu'on envoie soi-même
  const nbAvant = useRef(msgs.length)
  useEffect(() => {
    const nouveauMien = msgs.length > nbAvant.current && dernier?.member_id === me.id
    nbAvant.current = msgs.length
    if (colle.current || nouveauMien || enAttente.length > 0) {
      colle.current = true
      enBas(true)
    }
  }, [msgs.length, qui.length, enAttente.length]) // eslint-disable-line react-hooks/exhaustive-deps

  let jourPrecedent = ''
  return (
    <div ref={racine} className="flex flex-col px-3" style={{ minHeight: 'calc(100dvh - var(--sat) - 278px)' }} onClick={() => ouvert && setOuvert(null)}>
      <div className="flex-1" />
      {liste.length === 0 && (
        <div className="flex flex-col items-center px-6 pb-6 pt-4 text-center">
          <Art name="picto-bulle" size={64} className="anim-flotte" />
          <p className="mt-2 font-rond text-titre3">Le fil est tout neuf</p>
          <p className="mt-1 max-w-[290px] text-sous text-brume">Un message, une photo sur laquelle tu écris un petit mot, un vocal : toute la famille le voit, et vous vous voyez écrire en direct.</p>
        </div>
      )}
      {liste.map(({ mo, envoi }, i) => {
        const auteur = members.find((m) => m.id === mo.member_id)
        if (!auteur) return null
        const avant = liste[i - 1]?.mo
        const apres = liste[i + 1]?.mo
        const j = jour(mo.created_at)
        const sep = j !== jourPrecedent
        jourPrecedent = j
        const colle = (a?: Moment, b?: Moment) => !!a && !!b && a.member_id === b.member_id && Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60000 && jour(a.created_at) === jour(b.created_at)
        return (
          <div key={alias.current.get(mo.id) ?? mo.id}>
            {sep && (
              <p className="my-3 text-center">
                <span className="rounded-full bg-remplissage px-3 py-1 text-mini font-semibold text-brume">{j}</span>
              </p>
            )}
            <Bulle
              mo={mo}
              auteur={auteur}
              mine={mo.member_id === me.id}
              premier={sep || !colle(avant, mo)}
              dernier={!colle(mo, apres)}
              ouvert={ouvert === mo.id}
              onOuvrir={() => setOuvert((x) => (x === mo.id ? null : mo.id))}
              onPhoto={setPlein}
              releasePhoto={releasePhoto}
              anim={!initiaux.current!.has(mo.id)}
              envoi={envoi}
              envoye={mo.id === dernierMien}
              pret={pret}
            />
          </div>
        )
      })}
      <Ecrivent qui={qui} />
      <div ref={fin} />
      <Saisie onPhoto={setPhoto} envoyer={envoyer} />
      {photo && (
        <PhotoEditeur
          file={photo}
          onClose={() => {
            setPhoto(null)
            api.ecrit(family.id, me.id, null)
          }}
          onSend={async (blob, mot) => {
            api.ecrit(family.id, me.id, null)
            await envoyer({ blob, body: mot || undefined }, () => setPhoto(null))
          }}
        />
      )}
      {plein &&
        createPortal(
          <button onClick={() => setPlein(null)} className="anim-fondu fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3" aria-label="Fermer la photo">
            <img src={plein} alt="" className="max-h-full max-w-full rounded-[14px] object-contain" />
            <span className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white" style={{ top: 'calc(var(--sat) + 12px)' }}>
              <X size={22} />
            </span>
          </button>,
          document.body,
        )}
    </div>
  )
}

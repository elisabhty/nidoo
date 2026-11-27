import { Check, Pause, Play, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Sheet } from '../components/ui'
import { select, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Moment } from '../lib/types'

// Ce qui fait une publication du fil : le texte et ses liens, l'aperçu du premier lien, les vocaux, les sondages, la
// photo ; et l'enregistreur de vocaux. Le fil lui-même (un fil d'actualité, façon Facebook, depuis le 27 novembre) est
// dans FilFamilial.tsx ; il n'y a plus de bulles de discussion.

export const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
export const jour = (iso: string) => {
  const d = new Date(iso)
  const a = new Date()
  a.setHours(0, 0, 0, 0)
  const j = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - a.getTime()) / 86400000)
  if (j === 0) return 'Aujourd’hui'
  if (j === -1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())
}
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ───────── Les liens ─────────

const LIEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"»])|(www\.[^\s<]+[^\s<.,;:!?)\]'"»])/gi
const urlDe = (s: string) => (s.startsWith('http') ? s : `https://${s}`)
function youtube(u: URL) {
  if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1) || null
  if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null)
  return null
}

export function Texte({ body, mine, grand = false }: { body: string; mine: boolean; /** un texte court publié seul : en grand, comme sur Facebook */ grand?: boolean }) {
  const morceaux: (string | { url: string; txt: string })[] = []
  let i = 0
  for (const m of body.matchAll(LIEN)) {
    if (m.index! > i) morceaux.push(body.slice(i, m.index))
    morceaux.push({ url: urlDe(m[0]), txt: m[0] })
    i = m.index! + m[0].length
  }
  if (i < body.length) morceaux.push(body.slice(i))
  return (
    <p className={`whitespace-pre-wrap break-words ${grand ? 'text-[22px] font-semibold leading-[29px] tracking-[-0.2px]' : 'text-appel'}`}>
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
export function Apercu({ body, mine }: { body: string; mine: boolean }) {
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

export function Vocal({ mo, mine }: { mo: Moment; mine: boolean }) {
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


/** Un sondage fait partie de la conversation, avec les résultats partagés en direct.
 *  Le vote s'affiche tout de suite (sans attendre le serveur) et les barres glissent : rien ne clignote. */
export function Sondage({ mo, mine, envoi, pleine = false }: { mo: Moment; mine: boolean; envoi?: boolean; /** dans une publication : toute la largeur */ pleine?: boolean }) {
  const { state, run } = useHome()
  const options = mo.poll_options ?? []
  const moi = state.me.id
  const duServeur = state.pollVotes.filter((v) => v.moment_id === mo.id)
  const serveur = duServeur.find((v) => v.member_id === moi)?.option_index
  // mon choix, affiché dès le toucher ; il s'efface quand le serveur dit la même chose (ou en cas d'erreur)
  const [optimiste, setOptimiste] = useState<number | null>(null)
  useEffect(() => {
    if (optimiste != null && serveur === optimiste) setOptimiste(null)
  }, [serveur, optimiste])
  const mien = optimiste ?? serveur
  const votes = optimiste == null ? duServeur : [...duServeur.filter((v) => v.member_id !== moi), { member_id: moi, option_index: optimiste }]
  const total = votes.length
  // qui a voté quoi (le plus récent devant) : on voit les portraits à côté de chaque réponse
  const qui = options.map((_, i) => votes.filter((v) => v.option_index === i).map((v) => state.members.find((m) => m.id === v.member_id)).filter((m): m is NonNullable<typeof m> => !!m))
  const enCours = useRef(false)
  const choisirVote = async (index: number) => {
    if (envoi || enCours.current || mien === index) return
    select()
    enCours.current = true
    setOptimiste(index)
    const ok = await run((api) => api.votePoll(mo, moi, index))
    enCours.current = false
    if (!ok) setOptimiste(null)
  }
  const vu = mien !== undefined
  return (
    // une largeur fixe : la bulle ne bouge pas quand les pourcentages et « Tu peux changer ton vote » apparaissent
    <div className="sondage-bulle" style={{ width: pleine ? '100%' : 'min(62vw, 300px)' }} onClick={(e) => e.stopPropagation()}>
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
              disabled={envoi}
              aria-pressed={selected}
              onClick={() => void choisirVote(index)}
              className={`relative flex min-h-[44px] w-full items-center gap-2 overflow-hidden rounded-[12px] border px-3 py-2 text-left text-sous transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] ${
                mine ? (selected ? 'border-white/70 bg-white/15 text-white' : 'border-white/30 bg-white/10 text-white') : selected ? 'border-teinte/50 bg-teinte-doux text-encre' : 'border-teinte/20 bg-teinte-doux/60 text-encre'
              }`}
              aria-label={`${option}${vu ? `, ${pct} %` : ''}${qui[index].length ? ` : ${qui[index].map((m) => (m.id === moi ? 'toi' : m.display_name)).join(', ')}` : ''}`}
            >
              {/* la barre des résultats, toujours là, qui glisse jusqu'à sa largeur */}
              <span
                className={`absolute inset-y-0 left-0 ${mine ? 'bg-white/20' : 'bg-teinte/15'}`}
                style={{ width: `${vu ? pct : 0}%`, transition: 'width 0.45s cubic-bezier(0.22, 0.8, 0.24, 1)' }}
                aria-hidden="true"
              />
              <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
                <Check size={15} className="shrink-0 transition-[opacity,width] duration-200" strokeWidth={3} style={{ opacity: selected ? 1 : 0, width: selected ? 15 : 0 }} aria-hidden="true" />
                <span className="break-words">{option}</span>
              </span>
              {/* qui a choisi cette réponse : leurs portraits, l'un sur l'autre */}
              {qui[index].length > 0 && (
                <span className="relative flex shrink-0 items-center pl-1" aria-hidden="true">
                  {qui[index].slice(0, 4).map((m, k) => (
                    // un cercle net de la taille du portrait (pas de boîte de texte autour, qui l'ovalisait),
                    // avec un fin liseré blanc qui sépare les portraits superposés
                    <span key={m.id} className="anim-pop flex h-6 w-6 shrink-0 rounded-full" style={{ marginLeft: k ? -7 : 0, zIndex: 4 - k, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)' }}>
                      <Avatar m={m} size={24} />
                    </span>
                  ))}
                  {qui[index].length > 4 && <span className="ml-1 text-note font-bold">+{qui[index].length - 4}</span>}
                </span>
              )}
              <span className="relative shrink-0 font-bold tabular-nums transition-opacity duration-300" style={{ opacity: vu ? 1 : 0 }} aria-hidden="true">
                {pct} %
              </span>
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-note ${mine ? 'text-white/80' : 'text-brume'}`}>
        {total} vote{total > 1 ? 's' : ''}
        {vu ? ' · Tu peux changer ton vote' : ' · Choisis une réponse'}
      </p>
    </div>
  )
}

/** Garde l’aperçu visible jusqu’au décodage de la photo confirmée. */
export function PhotoDuFil({ src, alt, anim, onPhoto, releasePhoto }: { src: string; alt: string; anim: boolean; onPhoto: (url: string) => void; releasePhoto: (url: string) => void }) {
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
/** La composition d'un sondage reprend la feuille iOS de l'application. */
export function SondageCompose({ question0 = '', onClose, envoyer }: { question0?: string; onClose: () => void; envoyer: (m: NouvelEnvoi) => Promise<boolean> }) {
  const [question, setQuestion] = useState(question0.slice(0, 200))
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

/** Ce qu'on publie : du texte, un sticker, une photo (avec sa légende) ou un sondage. (Les vocaux ne s'enregistrent
 *  plus depuis le 27 novembre ; ceux déjà publiés s'écoutent toujours.) */
export type NouvelEnvoi = { body?: string; sticker?: string; blob?: Blob; pollOptions?: string[]; audio?: { blob: Blob; duree: number; ondes: number[] } }

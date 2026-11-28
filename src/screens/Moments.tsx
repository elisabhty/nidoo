import { ChartNoAxesColumn, Check, ImagePlus, Pause, Play, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Btn, Sheet, useHauteurQuiTient } from '../components/ui'
import { compressImage } from '../lib/util'
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
export function Sondage({ mo, mine, envoi, pleine = false, sansQuestion = false }: { mo: Moment; mine: boolean; envoi?: boolean; /** dans une publication : toute la largeur */ pleine?: boolean; /** la question est déjà écrite au-dessus de la photo */ sansQuestion?: boolean }) {
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
      {!sansQuestion && (
        <>
          <p className={`mb-1 text-note font-bold ${mine ? 'text-white/80' : 'text-teinte-fonce'}`}>Sondage</p>
          <p className="mb-3 whitespace-pre-wrap break-words text-corps font-semibold">{insecable(mo.body)}</p>
        </>
      )}
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
const EXEMPLES_REPONSE = ['Ex. : Chez Mamie', 'Ex. : Au parc']
/** « Léa ? » ne se coupe pas avant le point d'interrogation. */
export const insecable = (t?: string | null) => (t ?? '').replace(/ ([?!:;»])/g, '\u00A0$1').replace(/« /g, '«\u00A0')

/** Nouveau sondage (refait le 28 nov.) : la question et les réponses comme elles apparaîtront dans le fil, une photo
 *  si on veut (« pouvoir mettre un sondage au sein d'une photo »), et tout tient dans la feuille. */
export function SondageCompose({ question0 = '', photo0, onClose, envoyer }: { question0?: string; photo0?: Blob; onClose: () => void; envoyer: (m: NouvelEnvoi) => Promise<boolean> }) {
  const { toast } = useHome()
  const [question, setQuestion] = useState(question0.slice(0, 200))
  const [options, setOptions] = useState(['', ''])
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(() => (photo0 ? { blob: photo0, url: URL.createObjectURL(photo0) } : null))
  const [ratio, setRatio] = useState(4 / 3)
  const [loading, setLoading] = useState(false)
  const zone = useRef<HTMLTextAreaElement>(null)
  const liste = useRef<HTMLDivElement>(null)
  const fichier = useRef<HTMLInputElement>(null)
  const cadre = useHauteurQuiTient(!!photo, ratio, 64, [options.length])
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo])
  useEffect(() => {
    const z = zone.current
    if (!z) return
    z.style.height = 'auto'
    z.style.height = `${Math.min(z.scrollHeight, 120)}px`
  }, [question])
  useEffect(() => {
    if (!question0) window.setTimeout(() => zone.current?.focus(), 350)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const remplies = options.map((s) => s.trim())
  const cleaned = remplies.filter(Boolean)
  const doublon = new Set(cleaned.map((s) => s.toLowerCase())).size !== cleaned.length
  const vide = remplies.findIndex((s) => !s)
  const manque = !question.trim() ? 'ta question' : vide >= 0 ? (cleaned.length < 2 ? 'au moins deux réponses' : `la réponse ${vide + 1}`) : doublon ? 'des réponses différentes' : null
  const allerAuManque = () => {
    if (!question.trim()) return zone.current?.focus()
    const i = vide >= 0 ? vide : 0
    liste.current?.querySelectorAll<HTMLInputElement>('input')[i]?.focus()
  }
  const reponse = (i: number) => liste.current?.querySelectorAll<HTMLInputElement>('input')[i]
  const ajouter = () => {
    if (options.length >= 6) return
    tap()
    setOptions((x) => [...x, ''])
    window.setTimeout(() => reponse(options.length)?.focus(), 30)
  }
  const poserPhoto = async (f?: File) => {
    if (!f) return
    try {
      const blob = await compressImage(f, 1600, 0.86)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch {
      toast('Cette photo ne s’ouvre pas. Essaie une autre.', 'err')
    }
  }
  const publier = async () => {
    if (manque || loading) return
    setLoading(true)
    try {
      if (await envoyer({ body: question.trim().slice(0, 200), pollOptions: cleaned, blob: photo?.blob })) onClose()
    } finally {
      setLoading(false)
    }
  }
  return (
    <Sheet title="Nouveau sondage" onClose={onClose} tall={!!photo} footer={
      <Btn onClick={() => void publier()} disabled={loading} manque={manque} onManque={allerAuManque}>
        {loading ? 'Publication…' : 'Publier le sondage'}
      </Btn>
    }>
      <input ref={fichier} type="file" accept="image/*" hidden onChange={(e) => void poserPhoto(e.target.files?.[0]).then(() => (e.target.value = ''))} />
      {/* la question, et la photo si on en met une */}
      <div className="rounded-[22px] bg-carte p-4 shadow-carte">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-note font-bold text-teinte-fonce"><ChartNoAxesColumn size={15} strokeWidth={2.6} /> Ta question</p>
          {question.length > 150 && <p className="text-note tabular-nums text-brume">{question.length}/200</p>}
        </div>
        <textarea
          ref={zone}
          aria-label="Question du sondage"
          value={question}
          onChange={(e) => setQuestion(e.target.value.replace(/\n/g, ' ').slice(0, 200))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); reponse(0)?.focus() } }}
          enterKeyHint="next"
          maxLength={200}
          rows={1}
          placeholder={insecable('Ex. : On se retrouve où dimanche ?')}
          className="mt-1.5 block w-full resize-none bg-transparent text-titre3 font-semibold text-encre outline-none placeholder:font-medium placeholder:text-brume/80"
        />
        {photo ? (
          // la place qui reste décide : grande photo, ou (petit écran) une vignette, pour que tout tienne
          <div ref={cadre.ref} className="mt-3">
            {cadre.h && cadre.h >= 130 ? (
              <div className="relative mx-auto overflow-hidden rounded-[16px] bg-remplissage" style={{ height: cadre.h, width: `min(100%, ${Math.round(cadre.h * ratio)}px)` }}>
                <img src={photo.url} alt="La photo du sondage" onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) setRatio(i.naturalWidth / i.naturalHeight) }} className="block h-full w-full object-cover" />
                <button onClick={() => { tap(); setPhoto(null) }} aria-label="Retirer la photo" className="presse verre absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-encre">
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>
            ) : (
              <div className="flex h-16 items-center gap-3">
                <img src={photo.url} alt="La photo du sondage" onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) setRatio(i.naturalWidth / i.naturalHeight) }} className="h-16 w-16 shrink-0 rounded-[12px] object-cover" />
                <p className="min-w-0 flex-1 text-sous font-semibold text-encre">Ta photo</p>
                <button onClick={() => { tap(); setPhoto(null) }} className="presse min-h-11 shrink-0 px-2 text-sous font-semibold text-teinte-fonce">Retirer</button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => { tap(); fichier.current?.click() }} className="presse mt-3 flex min-h-11 items-center gap-2 rounded-full bg-teinte-doux py-2 pl-3 pr-4 text-sous font-semibold text-teinte-fonce">
            <ImagePlus size={18} strokeWidth={2.4} /> Ajouter une photo
          </button>
        )}
      </div>

      {/* les réponses, comme on les verra dans le fil */}
      <div ref={liste} className="mt-3 space-y-2">
        {options.map((option, i) => (
          <div key={i} className="flex min-h-[50px] items-center gap-3 rounded-[16px] bg-carte pl-4 pr-1 shadow-carte focus-within:ring-2 focus-within:ring-teinte/40">
            <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-teinte/35" aria-hidden="true" />
            <input
              aria-label={`Réponse ${i + 1}`}
              value={option}
              maxLength={80}
              enterKeyHint={i === options.length - 1 && options.length >= 2 ? 'done' : 'next'}
              onChange={(e) => setOptions((x) => x.map((v, j) => (j === i ? e.target.value : v)))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (i < options.length - 1) reponse(i + 1)?.focus()
                else e.currentTarget.blur()
              }}
              placeholder={insecable(EXEMPLES_REPONSE[i]) || `Réponse ${i + 1}`}
              className="min-h-[50px] min-w-0 flex-1 bg-transparent text-corps text-encre outline-none placeholder:text-brume/80"
            />
            {options.length > 2 && (
              <button aria-label={`Retirer la réponse ${i + 1}`} onClick={() => { tap(); setOptions((x) => x.filter((_, j) => j !== i)) }} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brume">
                <X size={18} />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={ajouter} className="presse flex min-h-[50px] w-full items-center gap-3 rounded-[16px] border-[1.5px] border-dashed border-teinte/30 pl-[15px] text-corps font-semibold text-teinte-fonce">
            <Plus size={19} strokeWidth={2.6} /> Ajouter une réponse
          </button>
        )}
      </div>
      {/* la petite aide s'efface quand la place manque (petit écran avec une photo) */}
      {(doublon || !photo || (cadre.h ?? 0) >= 130) && (
        <p className={`mt-3 text-center text-note ${doublon ? 'font-semibold text-teinte-fonce' : 'text-brume'}`}>
          {doublon ? 'Deux réponses sont identiques.' : 'Chacun vote une fois et peut changer d’avis.'}
        </p>
      )}
    </Sheet>
  )
}

/** Ce qu'on publie : du texte, un sticker, une photo (avec sa légende) ou un sondage. (Les vocaux ne s'enregistrent
 *  plus depuis le 27 novembre ; ceux déjà publiés s'écoutent toujours.) */
export type NouvelEnvoi = { body?: string; sticker?: string; blob?: Blob; pollOptions?: string[]; audio?: { blob: Blob; duree: number; ondes: number[] }; video?: { blob: Blob; affiche: Blob | null; duree: number } }

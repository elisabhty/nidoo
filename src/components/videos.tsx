// Les vidéos à l'écran : préparer celle qu'on va envoyer (avec sa progression), et la regarder dans le fil.
import { Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { tap } from '../lib/haptic'
import type { Moment } from '../lib/types'
import { dureeEnMots, infosVideo, mmss, preparerVideo, texteErreurVideo, type Preparation } from '../lib/video'
import { choisir } from './ui'

export type VideoEnCours = {
  /** la vidéo choisie (pour l'aperçu pendant la préparation) */
  url: string
  etat: 'prep' | 'pret'
  progres: number
  prep?: Preparation
  /** la vidéo préparée et son affiche, pour l'aperçu */
  urlPrete?: string
  afficheUrl?: string
}

/** Choisir une vidéo, la préparer (720p, `maxS` secondes au plus : on propose de garder le début si elle est plus
 *  longue), et suivre la préparation. */
export function useVideoAPreparer(maxS: number | null, onErreur: (message: string) => void, onAutre: () => void) {
  const [video, setVideo] = useState<VideoEnCours | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const urls = useRef<string[]>([])
  const garder = (u: string) => (urls.current.push(u), u)
  const liberer = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    urls.current = []
  }
  useEffect(
    () => () => {
      ctrl.current?.abort()
      liberer()
    },
    [],
  )

  const retirer = () => {
    ctrl.current?.abort()
    ctrl.current = null
    liberer()
    setVideo(null)
  }

  const lancer = async (f: Blob) => {
    retirer()
    let couper = false
    if (maxS !== null) {
      const infos = await infosVideo(f).catch(() => null)
      if (infos && infos.duree > maxS + 0.25) {
        const i = await choisir({
          title: `Cette vidéo dure ${dureeEnMots(infos.duree)}`,
          message: `Dans le fil, une vidéo dure ${maxS === 60 ? '1 minute' : dureeEnMots(maxS)} au plus.`,
          actions: [{ label: maxS === 60 ? 'Garder la première minute' : `Garder les ${dureeEnMots(maxS)} du début` }, { label: 'Choisir une autre vidéo' }],
        })
        if (i === 1) return onAutre()
        if (i !== 0) return
        couper = true
      }
    }
    const c = new AbortController()
    ctrl.current = c
    const url = garder(URL.createObjectURL(f))
    setVideo({ url, etat: 'prep', progres: 0 })
    try {
      const prep = await preparerVideo(f, {
        maxS,
        couper,
        signal: c.signal,
        onProgres: (p) => !c.signal.aborted && setVideo((x) => (x && x.url === url ? { ...x, progres: p } : x)),
      })
      if (c.signal.aborted) return
      const urlPrete = garder(URL.createObjectURL(prep.blob))
      const afficheUrl = prep.affiche ? garder(URL.createObjectURL(prep.affiche)) : undefined
      setVideo((x) => (x && x.url === url ? { ...x, etat: 'pret', progres: 1, prep, urlPrete, afficheUrl } : x))
    } catch (e) {
      if (c.signal.aborted) return
      const m = texteErreurVideo(e, maxS)
      if (m) onErreur(m)
      retirer()
    }
  }

  return { video, lancer, retirer, enPreparation: video?.etat === 'prep' }
}

/** L'aperçu de la vidéo qu'on va envoyer : pendant la préparation, un anneau qui se remplit ; ensuite, la vidéo prête. */
export function ApercuVideo({ v, onRetirer }: { v: VideoEnCours; onRetirer: () => void }) {
  const pct = Math.round(v.progres * 100)
  const r = 26
  const tour = 2 * Math.PI * r
  return (
    <div className="relative mt-2 overflow-hidden rounded-[20px] bg-black">
      {v.etat === 'pret' && v.urlPrete ? (
        <video key={v.urlPrete} src={v.urlPrete} poster={v.afficheUrl} controls playsInline preload="metadata" className="block max-h-[360px] w-full" />
      ) : (
        <video key={v.url} src={v.url} muted playsInline preload="metadata" className="block max-h-[360px] min-h-[180px] w-full opacity-50" />
      )}
      {v.etat === 'prep' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white" role="status" aria-live="polite">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray={tour} strokeDashoffset={tour * (1 - v.progres)} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
            <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">{pct}%</text>
          </svg>
          <span className="text-sous font-semibold [text-shadow:0_1px_6px_rgba(0,0,0,0.4)]">Préparation de la vidéo…</span>
        </div>
      )}
      {v.etat === 'pret' && v.prep && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-note font-semibold tabular-nums text-white">
          {mmss(v.prep.duree)} · {(v.prep.blob.size / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo
        </span>
      )}
      <button onClick={() => { tap(); onRetirer() }} className="presse verre absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-encre" aria-label="Retirer la vidéo">
        <X size={19} />
      </button>
    </div>
  )
}

/** Une vidéo dans le fil : son affiche et sa durée ; elle ne se télécharge qu'au moment où on la lance. */
export function VideoDuFil({ mo }: { mo: Moment }) {
  const [lecture, setLecture] = useState(false)
  if (!mo.video_url) return <div className="mt-3 flex aspect-video w-full items-center justify-center bg-remplissage text-sous text-brume">Vidéo indisponible</div>
  return (
    <div className="relative mt-3 bg-black">
      {lecture ? (
        <video src={mo.video_url} poster={mo.poster_url ?? undefined} controls autoPlay playsInline className="block max-h-[540px] w-full" />
      ) : (
        <button onClick={() => { tap(); setLecture(true) }} className="relative block w-full" aria-label={`Regarder la vidéo${mo.duree ? `, ${dureeEnMots(mo.duree)}` : ''}`}>
          {mo.poster_url ? <img src={mo.poster_url} alt="" loading="lazy" className="block max-h-[540px] w-full object-cover" /> : <span className="block aspect-[4/3] w-full bg-gradient-to-br from-[#3A3358] to-[#17141F]" />}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-encre shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <Play size={28} fill="currentColor" className="ml-1" />
            </span>
          </span>
          {!!mo.duree && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-note font-semibold tabular-nums text-white">{mmss(mo.duree)}</span>}
        </button>
      )}
    </div>
  )
}

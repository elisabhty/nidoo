// Les vidéos à l'écran : couper le passage à garder (comme sur Snap), préparer la vidéo qu'on va envoyer (avec sa
// progression), et la regarder dans le fil.
import { Pause, Play, Scissors, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as PE } from 'react'
import { createPortal } from 'react-dom'
import { select, tap } from '../lib/haptic'
import type { Moment } from '../lib/types'
import { dureeEnMots, infosVideo, mmss, preparerVideo, texteErreurVideo, vignettes, type Extrait, type Preparation } from '../lib/video'

export type VideoEnCours = {
  /** la vidéo choisie (pour l'aperçu pendant la préparation, et pour la recouper) */
  fichier: Blob
  url: string
  dureeOrigine: number
  extrait: Extrait | null
  etat: 'prep' | 'pret'
  progres: number
  prep?: Preparation
  /** la vidéo préparée et son affiche, pour l'aperçu */
  urlPrete?: string
  afficheUrl?: string
}

type ACouper = { fichier: Blob; duree: number; extrait: Extrait }

/** Choisir une vidéo, choisir le passage à garder si elle dure plus de `maxS` secondes (comme sur Snap), la préparer
 *  (720p) et suivre la préparation. */
export function useVideoAPreparer(maxS: number | null, onErreur: (message: string) => void) {
  const [video, setVideo] = useState<VideoEnCours | null>(null)
  const [coupe, setCoupe] = useState<ACouper | null>(null)
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
    setCoupe(null)
  }

  const preparer = async (f: Blob, dureeOrigine: number, extrait: Extrait | null) => {
    ctrl.current?.abort()
    liberer()
    const c = new AbortController()
    ctrl.current = c
    const url = garder(URL.createObjectURL(f))
    setVideo({ fichier: f, url, dureeOrigine, extrait, etat: 'prep', progres: 0 })
    try {
      const prep = await preparerVideo(f, {
        maxS,
        extrait,
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

  /** Une vidéo choisie : trop longue, on choisit d'abord le passage à garder. */
  const lancer = async (f: Blob) => {
    retirer()
    const infos = await infosVideo(f).catch(() => null)
    if (infos && maxS !== null && infos.duree > maxS + 0.25) {
      setCoupe({ fichier: f, duree: infos.duree, extrait: { debut: 0, fin: maxS } })
      return
    }
    void preparer(f, infos?.duree ?? 0, null)
  }

  /** Couper la vidéo déjà choisie (raccourcir, choisir un autre passage). */
  const recouper = () => {
    if (!video?.dureeOrigine) return
    const d = video.dureeOrigine
    setCoupe({ fichier: video.fichier, duree: d, extrait: video.extrait ?? { debut: 0, fin: Math.min(d, maxS ?? d) } })
  }

  const validerCoupe = (e: Extrait) => {
    const c = coupe
    setCoupe(null)
    if (!c) return
    const entiere = e.debut <= 0.05 && e.fin >= c.duree - 0.05
    void preparer(c.fichier, c.duree, entiere ? null : e)
  }

  return {
    video,
    lancer,
    retirer,
    recouper,
    enPreparation: video?.etat === 'prep',
    /** la coupe en cours, à afficher avec <CoupeVideo> */
    coupe: coupe ? { ...coupe, maxS: maxS ?? coupe.duree, valider: validerCoupe, annuler: () => setCoupe(null) } : null,
  }
}

const MIN_S = 1
const NB_IMAGES = 10

/**
 * Couper une vidéo, comme sur Snap : la vidéo en haut, qui tourne en boucle sur le passage gardé ; en bas, la bande
 * des images, avec un cadre à tirer par ses poignées (le début, la fin) ou à faire glisser (le passage entier).
 */
export function CoupeVideo({ fichier, duree, maxS, extrait, valider, annuler }: { fichier: Blob; duree: number; maxS: number; extrait: Extrait; valider: (e: Extrait) => void; annuler: () => void }) {
  const max = Math.min(maxS, duree)
  const [debut, setDebut] = useState(extrait.debut)
  const [fin, setFin] = useState(Math.min(extrait.fin, duree))
  const [instant, setInstant] = useState(extrait.debut)
  const [lecture, setLecture] = useState(true)
  const [images, setImages] = useState<(string | null)[]>(() => Array(NB_IMAGES).fill(null))
  const url = useMemo(() => URL.createObjectURL(fichier), [fichier])
  const lecteur = useRef<HTMLVideoElement>(null)
  const bande = useRef<HTMLDivElement>(null)
  const glisse = useRef<{ mode: 'debut' | 'fin' | 'tout'; x0: number; d0: number; f0: number } | null>(null)
  const bornes = useRef({ debut, fin })
  bornes.current = { debut, fin }

  useEffect(() => () => URL.revokeObjectURL(url), [url])
  useEffect(() => {
    const c = new AbortController()
    const crees: string[] = []
    void vignettes(fichier, NB_IMAGES, 28, (i, u) => {
      if (u.startsWith('blob:')) crees.push(u)
      setImages((l) => l.map((x, k) => (k === i ? u : x)))
    }, c.signal)
    return () => {
      c.abort()
      crees.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [fichier])
  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && annuler()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [annuler])

  // la vidéo tourne en boucle sur le passage gardé
  const auDebut = () => {
    const v = lecteur.current
    if (!v) return
    v.currentTime = bornes.current.debut
    if (lecture) void v.play().catch(() => undefined)
  }
  const temps = () => {
    const v = lecteur.current
    if (!v || glisse.current) return
    setInstant(v.currentTime)
    if (v.currentTime >= bornes.current.fin - 0.04 || v.currentTime < bornes.current.debut - 0.3) v.currentTime = bornes.current.debut
  }
  const basculer = () => {
    const v = lecteur.current
    if (!v) return
    tap()
    if (v.paused) {
      if (v.currentTime < debut || v.currentTime >= fin - 0.05) v.currentTime = debut
      void v.play().catch(() => undefined)
      setLecture(true)
    } else {
      v.pause()
      setLecture(false)
    }
  }

  const pct = (t: number) => `${(t / duree) * 100}%`
  const commencer = (mode: 'debut' | 'fin' | 'tout') => (e: PE<HTMLElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    glisse.current = { mode, x0: e.clientX, d0: debut, f0: fin }
    lecteur.current?.pause()
    select()
  }
  const bouger = (e: PE<HTMLElement>) => {
    const g = glisse.current
    const b = bande.current
    if (!g || !b) return
    const dt = ((e.clientX - g.x0) / b.clientWidth) * duree
    let d = g.d0
    let f = g.f0
    if (g.mode === 'tout') {
      const l = g.f0 - g.d0
      d = Math.min(Math.max(0, g.d0 + dt), duree - l)
      f = d + l
    } else if (g.mode === 'debut') d = Math.min(Math.max(0, f - max, g.d0 + dt), f - MIN_S)
    else f = Math.max(Math.min(duree, d + max, g.f0 + dt), d + MIN_S)
    setDebut(d)
    setFin(f)
    // on montre l'image sous le doigt
    const v = lecteur.current
    const t = g.mode === 'fin' ? Math.max(d, f - 0.05) : d
    if (v) v.currentTime = t
    setInstant(t)
  }
  const lacher = () => {
    if (!glisse.current) return
    glisse.current = null
    select()
    auDebut()
  }
  // au clavier : les flèches déplacent le début, la fin (une seconde)
  const clavier = (mode: 'debut' | 'fin') => (e: KeyboardEvent) => {
    const pas = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0
    if (!pas) return
    e.preventDefault()
    if (mode === 'debut') setDebut((d) => Math.min(Math.max(0, fin - max, d + pas), fin - MIN_S))
    else setFin((f) => Math.max(Math.min(duree, debut + max, f + pas), debut + MIN_S))
  }

  const longueur = fin - debut
  const auMax = longueur >= max - 0.05 && max < duree
  return createPortal(
    <div className="anim-fondu fixed inset-0 z-[96] flex flex-col bg-fond text-encre" role="dialog" aria-modal="true" aria-label="Choisir le passage de la vidéo">
      {/* en haut : fermer, le titre, lecture / pause (comme l'appareil photo de Nidoo) */}
      <div className="relative flex h-[56px] shrink-0 items-center justify-between px-4" style={{ marginTop: 'var(--sat)' }}>
        <button onClick={() => { tap(); annuler() }} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-carte text-encre shadow-carte" aria-label="Annuler">
          <X size={20} />
        </button>
        <p className="pointer-events-none absolute inset-x-[72px] truncate text-center text-corps font-semibold">Choisis le passage</p>
        <button onClick={basculer} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-carte text-encre shadow-carte" aria-label={lecture ? 'Mettre en pause' : 'Lire le passage'}>
          {lecture ? <Pause size={18} fill="currentColor" strokeWidth={0} /> : <Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" />}
        </button>
      </div>

      {/* la vidéo, en boucle sur le passage gardé ; la toucher : pause / lecture */}
      <button onClick={basculer} className="relative mx-4 mt-1 min-h-0 flex-1 overflow-hidden rounded-[30px] bg-encre shadow-[0_16px_40px_-18px_rgba(36,16,110,0.55)]" aria-label={lecture ? 'Mettre en pause' : 'Lire le passage'}>
        <video
          ref={lecteur}
          src={url}
          muted
          playsInline
          autoPlay
          preload="auto"
          onLoadedMetadata={auDebut}
          onTimeUpdate={temps}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/40 px-3.5 py-1.5 text-note font-semibold tabular-nums text-white backdrop-blur-md">
          {mmss(debut)} → {mmss(fin)}
        </span>
        {!lecture && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-teinte shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <Play size={28} fill="currentColor" strokeWidth={0} className="ml-1" />
            </span>
          </span>
        )}
      </button>

      {/* en bas : la bande, la durée gardée, et les boutons */}
      <div className="shrink-0 px-4 pt-4" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
        <div className="rounded-[24px] bg-carte p-3 shadow-carte">
          <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
            <span className="flex min-w-0 items-center gap-2">
              <img src="./art/stickers/panda-heureux.webp" alt="" className="h-7 w-7 shrink-0 object-contain" />
              <span className="truncate text-note font-semibold text-brume">{max < duree ? 'Glisse le cadre violet' : 'Tire les poignées'}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-note font-bold tabular-nums transition-colors ${auMax ? 'bg-teinte text-white' : 'bg-teinte-doux text-teinte-fonce'}`} aria-live="polite">
              {dureeEnMots(Math.round(longueur))}
              {max < duree ? ` / ${dureeEnMots(max)}` : ''}
            </span>
          </div>
          <div ref={bande} className="relative mx-[11px] h-14 touch-none select-none" onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher}>
            {/* les images */}
            <div className="absolute inset-0 flex overflow-hidden rounded-[12px] bg-teinte-doux">
              {images.map((u, k) => (
                <span key={k} className={`h-full min-w-0 flex-1 bg-cover bg-center ${u ? '' : 'animate-pulse bg-teinte-doux'}`} style={u ? { backgroundImage: `url("${u}")` } : undefined} />
              ))}
            </div>
            {/* ce qui n'est pas gardé : voilé */}
            <span className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[12px] bg-carte/75" style={{ width: pct(debut) }} />
            <span className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[12px] bg-carte/75" style={{ width: `${((duree - fin) / duree) * 100}%` }} />
            {/* le cadre : glisser pour déplacer le passage */}
            <div
              className="absolute -inset-y-[3px] cursor-grab rounded-[14px] border-[3px] border-teinte shadow-[0_4px_14px_-4px_rgba(102,70,204,0.55)]"
              style={{ left: pct(debut), width: pct(longueur) }}
              onPointerDown={commencer('tout')}
              aria-hidden="true"
            >
              {/* là où en est la lecture */}
              <span className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(102,70,204,0.45)]" style={{ left: `${Math.min(100, Math.max(0, ((instant - debut) / Math.max(longueur, 0.1)) * 100))}%` }} />
            </div>
            {/* les poignées : le début, la fin */}
            {(['debut', 'fin'] as const).map((mode) => (
              <span
                key={mode}
                role="slider"
                tabIndex={0}
                aria-label={mode === 'debut' ? 'Début du passage' : 'Fin du passage'}
                aria-valuemin={0}
                aria-valuemax={Math.round(duree)}
                aria-valuenow={Math.round(mode === 'debut' ? debut : fin)}
                aria-valuetext={mmss(mode === 'debut' ? debut : fin)}
                onPointerDown={commencer(mode)}
                onKeyDown={clavier(mode)}
                className="absolute -inset-y-[3px] z-10 flex w-11 cursor-ew-resize items-center justify-center rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-teinte/50"
                style={{ left: `calc(${pct(mode === 'debut' ? debut : fin)} - 22px)` }}
              >
                <span className="flex h-full w-[20px] items-center justify-center rounded-[9px] bg-teinte shadow-[0_2px_8px_rgba(36,16,110,0.35)]">
                  <span className="h-5 w-[3px] rounded-full bg-white/85" />
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => { tap(); annuler() }} className="presse flex min-h-[56px] flex-1 items-center justify-center rounded-full bg-carte text-corps font-bold text-encre shadow-carte">
            Annuler
          </button>
          <button onClick={() => { tap(); valider({ debut, fin }) }} className="presse ios-primary flex min-h-[56px] flex-[1.35] items-center justify-center gap-2 rounded-full text-corps font-bold text-white">
            <Scissors size={19} strokeWidth={2.4} /> Garder ce passage
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** L'aperçu de la vidéo qu'on va envoyer : pendant la préparation, un anneau qui se remplit ; ensuite, la vidéo prête,
 *  qu'on peut encore couper. */
export function ApercuVideo({ v, onRetirer, onCouper }: { v: VideoEnCours; onRetirer: () => void; onCouper?: () => void }) {
  const pct = Math.round(v.progres * 100)
  return (
    <div className="relative mt-2 overflow-hidden rounded-[20px] bg-black">
      {v.etat === 'pret' && v.urlPrete ? (
        <video key={v.urlPrete} src={v.urlPrete} poster={v.afficheUrl} controls playsInline preload="metadata" className="block max-h-[360px] w-full" />
      ) : (
        <video key={v.url} src={v.url} muted playsInline preload="metadata" className="block max-h-[360px] min-h-[200px] w-full opacity-40" />
      )}
      {v.etat === 'prep' && (
        <div className="absolute inset-0 flex items-center justify-center p-4" role="status" aria-live="polite">
          <div className="anim-pop flex w-full max-w-[250px] flex-col items-center rounded-[22px] bg-carte/95 px-5 pb-4 pt-3 text-center text-encre shadow-[0_12px_32px_-12px_rgba(36,16,110,0.45)]">
            <img src="./art/stickers/panda-motive.webp" alt="" className="anim-flotte h-14 w-14 object-contain" />
            <p className="mt-1 font-rond text-sous font-bold">On prépare ta vidéo…</p>
            <span className="mt-2.5 block h-2 w-full overflow-hidden rounded-full bg-teinte-doux">
              <span className="block h-full rounded-full bg-teinte transition-[width] duration-300 ease-out" style={{ width: `${Math.max(4, pct)}%` }} />
            </span>
            <p className="mt-1.5 text-note tabular-nums text-brume">{pct} % · plus légère pour ta famille</p>
          </div>
        </div>
      )}
      {v.etat === 'pret' && v.prep && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-note font-semibold tabular-nums text-white">
          {mmss(v.prep.duree)} · {(v.prep.blob.size / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo
        </span>
      )}
      <div className="absolute right-2 top-2 flex gap-2">
        {v.etat === 'pret' && onCouper && v.dureeOrigine > MIN_S + 0.5 && (
          <button onClick={() => { tap(); onCouper() }} className="presse verre flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sous font-semibold text-encre">
            <Scissors size={16} strokeWidth={2.4} /> Couper
          </button>
        )}
        <button onClick={() => { tap(); onRetirer() }} className="presse verre flex h-11 w-11 items-center justify-center rounded-full text-encre" aria-label="Retirer la vidéo">
          <X size={19} />
        </button>
      </div>
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
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-teinte shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <Play size={28} fill="currentColor" strokeWidth={0} className="ml-1" />
            </span>
          </span>
          {!!mo.duree && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-note font-semibold tabular-nums text-white">{mmss(mo.duree)}</span>}
        </button>
      )}
    </div>
  )
}


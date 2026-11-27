// L'appareil photo de Nidoo (Elisa, 27 novembre : « améliore l'UI UX en mode Nidoo quand on prend une photo ») :
// plus l'écran noir de l'iPhone, mais un appareil aux couleurs de la maison. Le cadre arrondi et le défi du jour
// posé sur l'image ; un déclencheur violet ; le retardateur pour la photo de famille (le compte à
// rebours s'affiche en grand) ; puis la photo qui se développe comme un Polaroid, avant de la garder ou de la reprendre.
// L'image vient de la caméra du téléphone (getUserMedia : la coque iOS l'autorise déjà, rien de natif à changer).
// Pas de caméra ici (ordinateur) ou pas d'autorisation : la photothèque, ou l'appareil de l'iPhone.
import { Check, Images, RotateCcw, SwitchCamera, Timer, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { choc, select, success, tap, warn } from '../lib/haptic'

/** La photo prise ; « galerie » : la personne préfère sa photothèque ; « natif » : pas de caméra possible ici,
 *  on passe par l'appareil du téléphone ; null : fermé sans photo. */
export type ReponseAppareil = File | 'galerie' | 'natif' | null
type Options = { titre?: string; consigne?: string; galerie?: boolean }
type Demande = Options & { resolve: (r: ReponseAppareil) => void }

let ouvrir: ((d: Demande) => void) | null = null

/** Ouvre l'appareil photo de Nidoo, par-dessus tout le reste. */
export function prendrePhoto(o: Options = {}): Promise<ReponseAppareil> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return Promise.resolve('natif')
  return new Promise((resolve) => (ouvrir ? ouvrir({ ...o, resolve }) : resolve('natif')))
}

/** À poser une fois, en haut de l'appli. */
export function AppareilHote() {
  const [demande, setDemande] = useState<Demande | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    ouvrir = (d) => {
      setDemande((avant) => {
        avant?.resolve(null)
        return d
      })
      setN((x) => x + 1)
    }
    return () => {
      ouvrir = null
    }
  }, [])
  if (!demande) return null
  return (
    <Appareil
      key={n}
      demande={demande}
      fin={(r) => {
        demande.resolve(r)
        setDemande(null)
      }}
    />
  )
}

type Etat = 'allume' | 'pret' | 'refuse' | 'absent' | 'erreur'
type Face = 'environment' | 'user'
const RETARDATEURS = [0, 3, 10] as const
// le cadre et la photo : 3 × 4, en hauteur, comme une photo de téléphone
const LARGEUR_SUR_HAUTEUR = 3 / 4

function Appareil({ demande, fin }: { demande: Demande; fin: (r: ReponseAppareil) => void }) {
  const { titre = 'Une photo', consigne, galerie = false } = demande
  const video = useRef<HTMLVideoElement>(null)
  const flux = useRef<MediaStream | null>(null)
  const vivant = useRef(true)
  const occupe = useRef(false)
  const declencheur = useRef<HTMLButtonElement>(null)
  const [etat, setEtat] = useState<Etat>('allume')
  const [face, setFace] = useState<Face>('environment')
  const [deuxFaces, setDeuxFaces] = useState(true)
  const [zooms, setZooms] = useState<number[]>([])
  const [zoom, setZoom] = useState(1)
  const [zoomNatif, setZoomNatif] = useState(false)
  const [retardateur, setRetardateur] = useState<(typeof RETARDATEURS)[number]>(0)
  const [compte, setCompte] = useState<number | null>(null)
  const [eclair, setEclair] = useState(0)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  // ce qu'on vient de régler, dit sur l'image un court instant (« Retardateur : 3 secondes »)
  const [annonce, setAnnonce] = useState<{ n: number; texte: string } | null>(null)
  useEffect(() => {
    if (!annonce) return
    const t = window.setTimeout(() => setAnnonce(null), 1500)
    return () => window.clearTimeout(t)
  }, [annonce])
  const minuteur = useRef<number | null>(null)
  // la caméra en cours, pour la rallumer au retour dans l'appli
  const faceRef = useRef<Face>(face)
  faceRef.current = face

  const arreter = () => {
    flux.current?.getTracks().forEach((t) => t.stop())
    flux.current = null
  }

  const demarrer = async (f: Face) => {
    arreter()
    setEtat('allume')
    setZooms([])
    setZoom(1)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: f }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      })
      if (!vivant.current) return s.getTracks().forEach((t) => t.stop())
      flux.current = s
      const piste = s.getVideoTracks()[0]
      piste?.addEventListener('ended', () => vivant.current && document.visibilityState === 'visible' && void demarrer(f))
      const v = video.current
      if (v) {
        v.srcObject = s
        await v.play().catch(() => undefined)
      }
      // le zoom : celui de la caméra quand elle le permet, sinon un recadrage (le cadre et la photo restent fidèles)
      const cap = (piste?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      const natif = !!cap.zoom && cap.zoom.max >= 2
      setZoomNatif(natif)
      setZooms(f === 'environment' ? [1, 2] : [])
      // y a-t-il une autre caméra ? (un ordinateur n'en a souvent qu'une)
      navigator.mediaDevices
        .enumerateDevices()
        .then((d) => vivant.current && setDeuxFaces(d.filter((x) => x.kind === 'videoinput').length > 1))
        .catch(() => undefined)
      setEtat('pret')
      window.setTimeout(() => declencheur.current?.focus({ preventScroll: true }), 50)
    } catch (e) {
      if (!vivant.current) return
      const nom = (e as { name?: string })?.name
      warn()
      setEtat(nom === 'NotAllowedError' || nom === 'SecurityError' ? 'refuse' : nom === 'NotFoundError' || nom === 'OverconstrainedError' || nom === 'NotReadableError' ? 'absent' : 'erreur')
    }
  }

  useEffect(() => {
    vivant.current = true
    void demarrer('environment')
    // de retour dans l'appli : la caméra a pu être coupée par iOS, on la rallume
    const retour = () => {
      if (document.visibilityState !== 'visible') return
      const piste = flux.current?.getVideoTracks()[0]
      if (!piste || piste.readyState === 'ended') void demarrer(faceRef.current)
    }
    document.addEventListener('visibilitychange', retour)
    return () => {
      vivant.current = false
      document.removeEventListener('visibilitychange', retour)
      if (minuteur.current) window.clearInterval(minuteur.current)
      arreter()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // la photo affichée, libérée quand on la reprend ou qu'on s'en va
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo])

  // Échap : on ferme (au clavier, sur ordinateur)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      fermer()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const fermer = () => {
    tap()
    fin(null)
  }

  const retourner = () => {
    if (etat === 'allume') return
    select()
    const f: Face = face === 'environment' ? 'user' : 'environment'
    setFace(f)
    void demarrer(f)
  }

  const choisirZoom = async (z: number) => {
    select()
    setZoom(z)
    const piste = flux.current?.getVideoTracks()[0]
    if (zoomNatif && piste) await piste.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).catch(() => setZoomNatif(false))
  }

  // ce qu'on voit dans le cadre, rien de plus : le milieu de l'image en 3 × 4 (et recadré si zoom sans la caméra)
  const capturer = async () => {
    const v = video.current
    if (!v || !v.videoWidth || occupe.current) return
    occupe.current = true
    choc()
    setEclair((x) => x + 1)
    const vw = v.videoWidth
    const vh = v.videoHeight
    let sw = vw
    let sh = vh
    if (vw / vh > LARGEUR_SUR_HAUTEUR) sw = Math.round(vh * LARGEUR_SUR_HAUTEUR)
    else sh = Math.round(vw / LARGEUR_SUR_HAUTEUR)
    const z = zoomNatif ? 1 : zoom
    const cw = Math.round(sw / z)
    const ch = Math.round(sh / z)
    const sx = Math.round((vw - cw) / 2)
    const sy = Math.round((vh - ch) / 2)
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    const ctx = c.getContext('2d')
    if (!ctx) {
      occupe.current = false
      return
    }
    // la caméra de face : la photo comme dans le miroir, telle qu'on s'est vu
    if (face === 'user') {
      ctx.translate(cw, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, sx, sy, cw, ch, 0, 0, cw, ch)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92))
    occupe.current = false
    if (!blob || !vivant.current) return
    setPhoto({ blob, url: URL.createObjectURL(blob) })
  }

  const annulerCompte = () => {
    if (minuteur.current) window.clearInterval(minuteur.current)
    minuteur.current = null
    setCompte(null)
  }

  const declencher = () => {
    if (etat !== 'pret' || photo) return
    if (compte !== null) {
      select()
      return annulerCompte()
    }
    if (!retardateur) return void capturer()
    tap()
    let reste: number = retardateur
    setCompte(reste)
    minuteur.current = window.setInterval(() => {
      reste -= 1
      if (reste <= 0) {
        annulerCompte()
        void capturer()
      } else {
        tap()
        setCompte(reste)
      }
    }, 1000)
  }

  const reprendre = () => {
    tap()
    setPhoto(null)
  }

  const garder = () => {
    if (!photo) return
    success()
    const nom = `nidoo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`
    fin(new File([photo.blob], nom, { type: 'image/jpeg' }))
  }

  const dateDuJour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const ilFautDeLaLumiere = etat === 'allume'
  const fautVoirAilleurs = etat === 'refuse' || etat === 'absent' || etat === 'erreur'
  const tempsRetardateur = retardateur ? `${retardateur} s` : null

  return (
    <div
      className="appareil absolute inset-0 z-[65] flex flex-col bg-fond text-encre"
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      // le cadre : toute la largeur, ou ce que laisse la hauteur une fois le haut (56) et les boutons (176) posés
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)', containerType: 'size', '--cadre': 'min(calc(100cqw - 32px), calc((100cqh - 232px) * 0.75))' } as CSSProperties}
    >
      {/* en haut : fermer, ce qu'on photographie, le retardateur */}
      {/* le titre est centré sur l'écran, quoi qu'il y ait sur les côtés : rien ne bouge quand le retardateur change
          (Elisa, 27 novembre : « le texte bouge ») */}
      <div className="relative flex h-[56px] shrink-0 items-center justify-between px-4">
        <button onClick={fermer} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-carte text-encre shadow-carte" aria-label="Fermer l’appareil photo">
          <X size={20} strokeWidth={2.6} />
        </button>
        <p className="pointer-events-none absolute inset-x-[72px] truncate text-center text-corps font-semibold">{photo ? 'Ta photo' : titre}</p>
        {!photo && etat === 'pret' ? (
          // toujours un rond de 44 : l'horloge quand il est coupé, « 3 s » ou « 10 s » quand il est réglé ; pendant le
          // compte à rebours, le toucher l'arrête
          <button
            onClick={() => {
              if (compte !== null) {
                select()
                return annulerCompte()
              }
              select()
              const suivant = RETARDATEURS[(RETARDATEURS.indexOf(retardateur) + 1) % RETARDATEURS.length]
              setRetardateur(suivant)
              setAnnonce({ n: Date.now(), texte: suivant ? `Retardateur : ${suivant} secondes` : 'Retardateur coupé' })
            }}
            className={`presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-carte transition-colors ${retardateur ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}
            aria-label={compte !== null ? 'Arrêter le compte à rebours' : retardateur ? `Retardateur : ${retardateur} secondes. Toucher pour changer` : 'Retardateur : coupé. Toucher pour le régler'}
          >
            {tempsRetardateur ? <span className="text-note font-extrabold leading-none">{tempsRetardateur}</span> : <Timer size={20} strokeWidth={2.4} />}
          </button>
        ) : (
          <span className="w-11 shrink-0" aria-hidden="true" />
        )}
      </div>

      {/* le cadre (ou la photo prise), aussi grand que l'écran le permet */}
      <div className="relative mx-auto mt-1 shrink-0" style={{ width: 'var(--cadre)', aspectRatio: '3 / 4' }}>
        <div className={`absolute inset-0 overflow-hidden rounded-[30px] bg-encre shadow-[0_16px_40px_-18px_rgba(36,16,110,0.55)] ${photo ? 'invisible' : ''}`}>
          <video
            ref={video}
            playsInline
            muted
            autoPlay
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,filter] duration-300 ${ilFautDeLaLumiere ? 'opacity-0' : 'opacity-100'}`}
            style={{ transform: `${face === 'user' ? 'scaleX(-1) ' : ''}scale(${zoomNatif ? 1 : zoom})` }}
          />

          {/* ce qu'on photographie, posé sur l'image */}
          {consigne && etat === 'pret' && (
            <p className="absolute left-1/2 top-3 flex max-w-[88%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-3.5 py-1.5 text-note font-semibold text-white backdrop-blur-md">
              <span aria-hidden="true">📸</span>
              <span className="truncate">{consigne}</span>
            </p>
          )}

          {annonce && etat === 'pret' && compte === null && (
            <p key={annonce.n} role="status" className="appareil-annonce absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/45 px-4 py-2 text-sous font-bold text-white backdrop-blur-md">
              {annonce.texte}
            </p>
          )}

          {ilFautDeLaLumiere && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <img src="./art/stickers/panda-motive.webp" alt="" className="h-20 w-20 animate-pulse object-contain" />
              <p className="text-sous font-semibold text-white/85">On allume l’appareil photo…</p>
            </div>
          )}

          {fautVoirAilleurs && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#2A2340] px-6 text-center text-white">
              <img src="./art/stickers/panda-triste.webp" alt="" className="h-20 w-20 object-contain" />
              <p className="mt-3 font-rond text-titre3">
                {etat === 'refuse' ? 'Nidoo n’a pas accès à l’appareil photo' : etat === 'absent' ? 'Pas d’appareil photo ici' : 'L’appareil photo ne s’allume pas'}
              </p>
              <p className="mt-1.5 text-sous text-white/80 [text-wrap:pretty]">
                {etat === 'refuse'
                  ? `Autorise-le dans Réglages, puis Nidoo, puis Appareil photo.${galerie ? ' Ou choisis une photo déjà prise.' : ''}`
                  : etat === 'absent'
                    ? galerie
                      ? 'Choisis plutôt une photo déjà prise.'
                      : 'Cette photo se prend avec l’appareil photo du téléphone.'
                    : 'Réessaie dans un instant, ou passe par l’appareil photo du téléphone.'}
              </p>
              {/* sans photothèque (le défi du jour se relève sur le moment), on ne propose que de réessayer ou
                  l'appareil du téléphone */}
              <div className="mt-5 flex w-full max-w-[280px] flex-col gap-2.5">
                {galerie && etat !== 'erreur' && (
                  <button onClick={() => (tap(), fin('galerie'))} className="presse flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-4 text-sous font-bold text-teinte-fonce">
                    <Images size={18} strokeWidth={2.4} /> Choisir dans la photothèque
                  </button>
                )}
                {etat === 'erreur' && (
                  <button onClick={() => (tap(), fin('natif'))} className="presse flex min-h-12 items-center justify-center rounded-full bg-white px-4 text-sous font-bold text-teinte-fonce">
                    L’appareil photo du téléphone
                  </button>
                )}
                {etat !== 'absent' && (
                  <button onClick={() => (tap(), void demarrer(face))} className="presse flex min-h-12 items-center justify-center rounded-full bg-white/15 px-4 text-sous font-bold text-white">
                    Réessayer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 1× · 2× */}
          {etat === 'pret' && zooms.length > 1 && compte === null && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/35 p-1 backdrop-blur-md" role="group" aria-label="Zoom">
              {zooms.map((z) => (
                <button
                  key={z}
                  onClick={() => void choisirZoom(z)}
                  aria-pressed={zoom === z}
                  className={`presse cible flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-note font-bold transition-colors ${zoom === z ? 'bg-white text-encre' : 'text-white'}`}
                >
                  {z}×
                </button>
              ))}
            </div>
          )}

          {/* le retardateur : le compte à rebours, en grand */}
          {compte !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/15" aria-live="assertive">
              <span key={compte} className="anim-pop font-rond text-[120px] font-extrabold leading-none text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.35)]">
                {compte}
              </span>
              <span className="mt-2 rounded-full bg-black/35 px-3.5 py-1.5 text-sous font-semibold text-white backdrop-blur-md">{compte === 1 ? 'Souriez !' : 'Tout le monde dans le cadre'}</span>
            </div>
          )}

          {/* le petit éclair blanc du déclic */}
          {eclair > 0 && <span key={eclair} className="appareil-eclair pointer-events-none absolute inset-0 bg-white" aria-hidden="true" />}
        </div>

        {/* la photo prise : un Polaroid qui se pose et se développe */}
        {photo && (
          <div className="absolute inset-0 flex items-center justify-center">
          <figure className="polaroid bg-white p-[10px] pb-0 shadow-[0_22px_48px_-18px_rgba(36,16,110,0.5)]" style={{ width: 'calc(var(--cadre) - 44px)' }}>
            <img src={photo.url} alt="La photo que tu viens de prendre" className="polaroid-image block aspect-[3/4] w-full object-cover" />
            <figcaption className="flex h-[46px] items-center justify-center truncate px-2 text-center font-rond text-sous font-bold text-brume">{consigne ?? dateDuJour}</figcaption>
          </figure>
          </div>
        )}
      </div>

      {/* en bas : la photothèque, le déclencheur, la caméra de face ; ou, la photo prise, la garder ou la reprendre */}
      {photo ? (
        <div className="flex min-h-0 flex-1 items-center gap-3 px-5 py-3">
          <button onClick={reprendre} className="presse flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-full bg-carte text-corps font-bold text-encre shadow-carte">
            <RotateCcw size={19} strokeWidth={2.5} /> Reprendre
          </button>
          <button onClick={garder} className="presse ios-primary flex min-h-[56px] flex-[1.35] items-center justify-center gap-2 rounded-full text-corps font-bold text-white">
            <Check size={20} strokeWidth={2.8} /> Utiliser la photo
          </button>
        </div>
      ) : (
        <div className={`grid min-h-0 flex-1 grid-cols-3 items-center px-6 py-3 ${fautVoirAilleurs ? 'invisible' : ''}`}>
          <div className="flex justify-start">
            {galerie && (
              <button onClick={() => (tap(), fin('galerie'))} disabled={compte !== null} className="presse flex w-[76px] flex-col items-center gap-1.5 disabled:opacity-40">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[17px] bg-carte text-teinte shadow-carte">
                  <Images size={22} strokeWidth={2.3} />
                </span>
                <span className="text-legende font-semibold text-brume">Photothèque</span>
              </button>
            )}
          </div>
          <div className="flex justify-center">
            <button
              ref={declencheur}
              onClick={declencher}
              disabled={etat !== 'pret'}
              aria-label={compte !== null ? 'Annuler le retardateur' : tempsRetardateur ? `Prendre la photo dans ${retardateur} secondes` : 'Prendre la photo'}
              className="appareil-declencheur flex h-[84px] w-[84px] items-center justify-center rounded-full bg-carte shadow-[0_8px_22px_-8px_rgba(36,16,110,0.45)] disabled:opacity-50"
            >
              <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full text-white transition-transform duration-150" style={{ background: 'linear-gradient(140deg, #8E6CF0 0%, #6646CC 100%)' }}>
                {compte !== null && <X size={28} strokeWidth={2.8} />}
              </span>
            </button>
          </div>
          <div className="flex justify-end">
            {deuxFaces && (
              <button onClick={retourner} disabled={etat !== 'pret' || compte !== null} className="presse flex w-[76px] flex-col items-center gap-1.5 disabled:opacity-40" aria-label={face === 'environment' ? 'Passer à la caméra de face' : 'Passer à la caméra de dos'}>
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-carte text-teinte shadow-carte">
                  <SwitchCamera key={face} size={22} strokeWidth={2.3} className="appareil-tourne" />
                </span>
                <span className="text-legende font-semibold text-brume" aria-hidden="true">Retourner</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { Check, ImagePlus, RefreshCw, Users, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { petille } from '../lib/fete'
import { select, success, tap } from '../lib/haptic'
import { housePhotoSlots, housePhotoSources } from '../lib/housePhotos'
import { useHome } from '../lib/store'
import { errorText } from '../lib/util'
import { Btn, Sheet } from './ui'

/** Un souvenir dans la maison (Elisa, 21 novembre : une petite fenêtre qui s'adapte au contenu, une seule action
 *  claire, puis un aperçu à recadrer avant d'accrocher). À une place précise de la corde (index : remplacer une
 *  photo, ou remplir une place libre), ou en plus au bout de la corde. */
export function HousePhotosSheet({ mode, index, onClose }: { mode: 'add' | 'replace'; index?: number; onClose: () => void }) {
  const { state, api, reload, toast } = useHome()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const sources = housePhotoSources(state)
  const places = housePhotoSlots(sources, state.family.house_photo_ids)
  const ids = places.map((p) => p?.id ?? '')
  const remplace = mode === 'replace' && index != null && index < ids.length
  const full = !remplace && !ids.includes('') && ids.length >= 5
  const accrochees = ids.filter(Boolean).length
  /** les places une fois `id` posé : à la place touchée, sinon dans la première place libre, sinon au bout */
  const avec = (liste: string[], id: string) => {
    const out = liste.map((x) => (x === id ? '' : x))
    const i = remplace ? index! : out.indexOf('')
    if (i >= 0 && i < out.length) out[i] = id
    else out.push(id)
    return out.slice(0, 5)
  }
  const fini = (msg: string) => {
    success()
    petille()
    toast(msg)
    onClose()
  }
  const save = async (id: string) => {
    if (busy || ids.includes(id) || full) return
    select()
    setBusy(true)
    setError('')
    try {
      await api.updateFamily(state.family.id, { house_photo_ids: avec(ids, id) })
      await reload()
      fini(remplace ? 'Photo remplacée' : 'Photo accrochée dans la maison')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const upload = async (blob: Blob) => {
    if (busy || full) return
    setBusy(true)
    setError('')
    let shared = false
    try {
      const before = new Set(state.moments.map((m) => m.id))
      await api.postMoment(state.family.id, state.me.id, { blob })
      shared = true
      const fresh = await api.load(state.family.id)
      const added = fresh.moments.filter((m) => !before.has(m.id) && m.member_id === state.me.id && m.image_url).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (!added) throw new Error('Retrouve-la dans le fil pour l’accrocher dans la maison.')
      const latest = housePhotoSlots(housePhotoSources(fresh), fresh.family.house_photo_ids).map((p) => p?.id ?? '')
      await api.updateFamily(state.family.id, { house_photo_ids: avec(latest, `m:${added.id}`) })
      await reload()
      fini(remplace ? 'Photo remplacée et partagée dans le fil' : 'Photo accrochée et partagée dans le fil')
    } catch (e) {
      if (shared) await reload().catch(() => undefined)
      setError(`${shared ? 'La photo est dans le fil. ' : ''}${errorText(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const actuelle = remplace ? places[index!] : null
  const libres = sources.filter((p) => !ids.includes(p.id))

  return (
    <Sheet title={fichier ? 'Recadrer la photo' : actuelle ? 'Remplacer la photo 📸' : 'Un souvenir dans la maison 📸'} onClose={() => { if (!busy) onClose() }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setError(''); setFichier(f) } }} />
      {error && <p role="alert" className="anim-entre mb-3 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}

      {fichier ? (
        <Recadrer
          fichier={fichier}
          busy={busy}
          onAutre={() => (tap(), input.current?.click())}
          onValider={(blob) => void upload(blob)}
          libelle={actuelle ? 'Remplacer' : 'Accrocher'}
        />
      ) : (
        <>
          {actuelle ? (
            <div className="mb-4 flex items-center gap-3">
              <img src={actuelle.url} alt="" className="h-14 w-14 shrink-0 rounded-[14px] object-cover" />
              <p className="text-sous text-brume">Choisis la photo qui prend sa place sur la corde. Celle-ci reste dans le fil.</p>
            </div>
          ) : (
            <p className="text-sous text-brume">Choisis une photo à accrocher dans votre maison. Toute la famille pourra la voir.</p>
          )}

          {/* combien sont accrochées : un petit cadre par place */}
          {!remplace && (
            <div className="mt-4 flex items-center justify-between px-0.5">
              <span className="text-note font-semibold text-brume">Photos accrochées</span>
              <span className="flex items-center gap-2">
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${i < accrochees ? 'bg-teinte' : 'bg-teinte-doux'}`} />
                  ))}
                </span>
                <span className="text-sous font-bold text-encre">{accrochees} / 5</span>
              </span>
            </div>
          )}

          {full ? (
            <p className="mt-4 rounded-[18px] bg-doux p-4 text-sous text-brume">La corde est pleine : touche une photo de la maison pour la remplacer ou la décrocher.</p>
          ) : (
            <button disabled={busy} onClick={() => (tap(), input.current?.click())} className="presse mt-3 flex w-full flex-col items-center gap-1 rounded-[22px] bg-teinte-doux px-4 py-5 disabled:opacity-50">
              <ImagePlus size={30} strokeWidth={2} className="text-teinte" />
              <span className="mt-1 text-corps font-bold text-encre">Choisir une photo</span>
              <span className="text-note text-brume">Depuis ta galerie</span>
            </button>
          )}
          <p className="mt-3 flex items-center gap-2 px-0.5 text-note text-brume">
            <Users size={16} strokeWidth={2.2} className="shrink-0" /> Également partagée dans le fil familial
          </p>

          {/* ou une photo déjà dans le fil : une rangée de vignettes, sans agrandir la fenêtre */}
          {!full && libres.length > 0 && (
            <>
              <p className="mb-2 mt-5 px-0.5 text-note font-semibold text-brume">Ou une photo déjà dans le fil</p>
              <div className="no-bar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {libres.map((p, i) => (
                  <button key={p.id} disabled={busy} onClick={() => void save(p.id)} aria-label={`${actuelle ? 'Mettre' : 'Accrocher'} la photo ${i + 1} du fil`} className="presse ligne-arrive-pop relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[16px] bg-doux disabled:opacity-50" style={{ animationDelay: `${i * 35}ms` }}>
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
          {busy && <p role="status" className="mt-3 text-center text-note font-semibold text-teinte-fonce">Accrochage…</p>}
        </>
      )}
    </Sheet>
  )
}

/** L'aperçu à recadrer : la photo telle qu'elle sera accrochée (un carré), qu'on fait glisser et qu'on agrandit
 *  avec deux doigts (ou le curseur). Le carré choisi part en 1200 × 1200. */
function Recadrer({ fichier, busy, onAutre, onValider, libelle }: { fichier: File; busy: boolean; onAutre: () => void; onValider: (b: Blob) => void; libelle: string }) {
  const [url, setUrl] = useState('')
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [bouge, setBouge] = useState(false)
  const cadre = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const [S, setS] = useState(300)
  useEffect(() => {
    const u = URL.createObjectURL(fichier)
    setUrl(u)
    setNat(null)
    setZoom(1)
    setPos({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(u)
  }, [fichier])
  useEffect(() => {
    const el = cadre.current
    if (!el) return
    const ro = new ResizeObserver(() => setS(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const base = nat ? S / Math.min(nat.w, nat.h) : 1
  const W = nat ? nat.w * base * zoom : S
  const H = nat ? nat.h * base * zoom : S
  const borne = (p: { x: number; y: number }, w = W, h = H) => ({ x: Math.max(-(w - S) / 2, Math.min((w - S) / 2, p.x)), y: Math.max(-(h - S) / 2, Math.min((h - S) / 2, p.y)) })
  const changerZoom = (z: number) => {
    const nz = Math.max(1, Math.min(4, z))
    if (!nat) return setZoom(nz)
    setZoom(nz)
    setPos((p) => borne({ x: (p.x * nz) / zoom, y: (p.y * nz) / zoom }, nat.w * base * nz, nat.h * base * nz))
  }
  // les doigts : un pour déplacer, deux pour agrandir
  const doigts = useRef(new Map<number, { x: number; y: number }>())
  const depart = useRef<{ pos: { x: number; y: number }; zoom: number; d: number; mx: number; my: number } | null>(null)
  const repartir = () => {
    const pts = [...doigts.current.values()]
    if (!pts.length) return (depart.current = null)
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const d = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    depart.current = { pos, zoom, d, mx, my }
  }
  const bougerDoigts = () => {
    const a = depart.current
    if (!a || !nat) return
    const pts = [...doigts.current.values()]
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
    let nz = a.zoom
    if (pts.length > 1 && a.d > 0) nz = Math.max(1, Math.min(4, (a.zoom * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / a.d))
    const k = nz / a.zoom
    setZoom(nz)
    setPos(borne({ x: a.pos.x * k + (mx - a.mx), y: a.pos.y * k + (my - a.my) }, nat.w * base * nz, nat.h * base * nz))
  }
  const valider = () => {
    const i = img.current
    if (!i || !nat) return
    const k = base * zoom // pixels à l'écran par pixel de la photo
    const cx = nat.w / 2 - pos.x / k
    const cy = nat.h / 2 - pos.y / k
    const cote = S / k
    const c = document.createElement('canvas')
    c.width = c.height = 1200
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.drawImage(i, cx - cote / 2, cy - cote / 2, cote, cote, 0, 0, 1200, 1200)
    c.toBlob((b) => b && onValider(b), 'image/jpeg', 0.86)
  }

  return (
    <div>
      <p className="mb-3 text-sous text-brume">Fais glisser et agrandis avec deux doigts : la famille verra exactement ce carré.</p>
      <div
        ref={cadre}
        className="relative mx-auto aspect-square w-full max-w-[320px] touch-none select-none overflow-hidden rounded-[24px] bg-doux shadow-[0_10px_30px_-14px_rgba(29,26,43,0.35)]"
        onPointerDown={(e) => {
          e.preventDefault() // pas de texte sélectionné en glissant
          e.currentTarget.setPointerCapture(e.pointerId)
          doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          setBouge(true)
          repartir()
        }}
        onPointerMove={(e) => {
          if (!doigts.current.has(e.pointerId)) return
          doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          bougerDoigts()
        }}
        onPointerUp={(e) => {
          doigts.current.delete(e.pointerId)
          if (!doigts.current.size) setBouge(false)
          repartir()
        }}
        onPointerCancel={(e) => {
          doigts.current.delete(e.pointerId)
          if (!doigts.current.size) setBouge(false)
          repartir()
        }}
      >
        {url && (
          <img
            ref={img}
            src={url}
            alt="La photo à accrocher"
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className={`absolute left-1/2 top-1/2 max-w-none transition-opacity duration-300 ${nat ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: W, height: H, transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)` }}
          />
        )}
        {/* la grille des tiers, le temps qu'on bouge */}
        <span className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${bouge ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" style={{ backgroundImage: 'linear-gradient(to right, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.7) calc(33.33% - 0.5px), rgba(255,255,255,0.7) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.7) calc(66.66% - 0.5px), rgba(255,255,255,0.7) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), rgba(255,255,255,0.7) calc(33.33% - 0.5px), rgba(255,255,255,0.7) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,0.7) calc(66.66% - 0.5px), rgba(255,255,255,0.7) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))' }} />
      </div>
      <div className="mx-auto mt-4 flex max-w-[320px] items-center gap-3">
        <button type="button" onClick={() => (tap(), changerZoom(zoom - 0.25))} aria-label="Réduire" className="presse flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-doux text-encre/70"><ZoomOut size={17} /></button>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => changerZoom(Number(e.target.value))} aria-label="Agrandir la photo" className="h-1 min-w-0 flex-1 accent-[#7050D5]" />
        <button type="button" onClick={() => (tap(), changerZoom(zoom + 0.25))} aria-label="Agrandir" className="presse flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-doux text-encre/70"><ZoomIn size={17} /></button>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" disabled={busy} onClick={onAutre} className="presse flex min-h-[52px] items-center justify-center gap-1.5 rounded-full bg-doux px-4 text-sous font-semibold text-encre disabled:opacity-50">
          <RefreshCw size={16} strokeWidth={2.4} /> Une autre
        </button>
        <Btn className="flex-1" disabled={busy || !nat} onClick={valider}>
          {busy ? 'Accrochage…' : <><Check size={19} strokeWidth={3} /> {libelle}</>}
        </Btn>
      </div>
    </div>
  )
}

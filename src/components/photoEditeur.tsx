import { ArrowUp, Brush, Frame, Smile, Type, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CADRES, peindreCadre, type CadreKey } from '../lib/cadres'
import { select, tap } from '../lib/haptic'
import { drawStickers, MAX_STICKERS } from '../lib/stickers'
import type { Sticker } from '../lib/types'
import { nouveauSticker, StickerStage, StickerTray } from './stickers'

// Avant d'envoyer une photo dans le fil : on peut dessiner dessus, y poser des mots et des stickers en feutrine
// (qu'on déplace, agrandit et tourne du doigt) et ajouter une légende. Tout est recalculé à l'envoi dans une image JPEG de 1400 px au plus.

const COULEURS = ['#FFFFFF', '#1D1A2B', '#7050D5', '#E0604F', '#F58B5C', '#FFC93C', '#3FBF7F', '#3B82F6', '#F06BAA']
type Trait = { c: string; e: number; pts: [number, number][] } // coordonnées de 0 à 1, épaisseur en part de la largeur
type Mot = { id: number; t: string; x: number; y: number; c: string }
type Geste = { k: 'trait' } | { k: 'mot'; id: number } | { k: 'stickers'; avant: Sticker[] }
const SW = 1000 // la feuille des stickers fait 1000 de large ; sa hauteur suit la photo

const fond = (c: string) => (c === '#FFFFFF' ? 'rgba(29,26,43,0.55)' : c === '#1D1A2B' || c === '#FFC93C' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.92)')
const encre = (c: string) => (c === '#FFFFFF' ? '#FFFFFF' : c)

function dessinerTraits(ctx: CanvasRenderingContext2D, traits: Trait[], w: number, h: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const tr of traits) {
    ctx.strokeStyle = tr.c
    ctx.lineWidth = tr.e * w
    ctx.beginPath()
    tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)))
    if (tr.pts.length === 1) ctx.lineTo(tr.pts[0][0] * w + 0.1, tr.pts[0][1] * h)
    ctx.stroke()
  }
}

export function PhotoEditeur({ file, onClose, onSend, confirmLabel = 'Envoyer la photo', initialCaption = '', title = 'Préparer la photo', initialDrawing = false }: { file: File; onClose: () => void; onSend: (blob: Blob, legende: string) => void | Promise<void>; confirmLabel?: string; initialCaption?: string; title?: string; initialDrawing?: boolean }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [mode, setMode] = useState<'dessin' | 'rien'>(initialDrawing ? 'dessin' : 'rien')
  const [couleur, setCouleur] = useState(initialDrawing ? '#7050D5' : '#FFFFFF')
  const [traits, setTraits] = useState<Trait[]>([])
  const [mots, setMots] = useState<Mot[]>([])
  const [gestes, setGestes] = useState<Geste[]>([])
  const [saisie, setSaisie] = useState<{ id: number | null; t: string } | null>(null)
  const [legende, setLegende] = useState(initialCaption)
  const [cadre, setCadre] = useState<CadreKey>('aucun')
  const [cadresOuverts, setCadresOuverts] = useState(false)
  const [error, setError] = useState('')
  const [taille, setTaille] = useState({ w: 0, h: 0 })
  const [envoi, setEnvoi] = useState(false)
  const [colles, setColles] = useState<Sticker[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [tiroir, setTiroir] = useState(false)
  const kAvant = useRef<Sticker[] | null>(null)
  const zone = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const enCours = useRef<Trait | null>(null)
  const glisse = useRef<{ id: number; dx: number; dy: number; bouge: boolean } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // la photo tient dans la zone libre, sans être déformée
  useEffect(() => {
    if (!img || !zone.current) return
    const caler = () => {
      if (!zone.current) return
      const r = zone.current.getBoundingClientRect()
      const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight)
      setTaille({ w: Math.round(img.naturalWidth * s), h: Math.round(img.naturalHeight * s) })
    }
    caler()
    const ro = new ResizeObserver(caler)
    ro.observe(zone.current)
    return () => ro.disconnect()
  }, [img])

  // le dessin à l'écran
  useEffect(() => {
    const cv = toile.current
    if (!cv || !taille.w) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    cv.width = taille.w * dpr
    cv.height = taille.h * dpr
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, taille.w, taille.h)
    let active = true
    const render = () => {
      if (!active) return
      ctx.clearRect(0, 0, taille.w, taille.h)
      peindreCadre(ctx, cadre, taille.w, taille.h, render)
      dessinerTraits(ctx, enCours.current ? [...traits, enCours.current] : traits, taille.w, taille.h)
    }
    render()
    return () => { active = false }
  }, [traits, taille, cadre])

  const SH = img ? Math.round((SW * img.naturalHeight) / img.naturalWidth) : SW

  const point = (e: React.PointerEvent): [number, number] => {
    const r = (toile.current ?? (e.currentTarget as HTMLElement)).getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const redessiner = () => {
    const cv = toile.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0,0,taille.w,taille.h)
    peindreCadre(ctx,cadre,taille.w,taille.h)
    dessinerTraits(ctx,enCours.current ? [...traits,enCours.current] : traits,taille.w,taille.h)
  }

  const annuler = () => {
    const g = gestes[gestes.length - 1]
    if (!g) return
    tap()
    if (g.k === 'trait') setTraits((t) => t.slice(0, -1))
    else if (g.k === 'stickers') {
      setColles(g.avant)
      setSel(null)
    } else setMots((m) => m.filter((x) => x.id !== g.id))
    setGestes((x) => x.slice(0, -1))
  }

  const validerMot = () => {
    if (!saisie) return
    const t = saisie.t.trim().slice(0, 80)
    if (saisie.id != null) {
      setMots((m) => (t ? m.map((x) => (x.id === saisie.id ? { ...x, t, c: couleur } : x)) : m.filter((x) => x.id !== saisie.id)))
    } else if (t) {
      const id = Date.now() + Math.random()
      setMots((m) => [...m, { id, t, x: 0.5, y: 0.22, c: couleur }]) // en haut : les stickers, eux, arrivent au milieu
      setGestes((g) => [...g, { k: 'mot', id }])
    }
    setSaisie(null)
  }

  const envoyer = async () => {
    if (!img || envoi) return
    setEnvoi(true)
    setError('')
    try {
    const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight))
    const W = Math.round(img.naturalWidth * s)
    const H = Math.round(img.naturalHeight * s)
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')!
    await new Promise<void>((resolve, reject) => {
      let active = true
      const timer = window.setTimeout(() => { active = false; reject(new Error('Le cadre ne s’est pas chargé. Réessaie.')) }, 8000)
      const render = () => {
        if (!active) return
        ctx.clearRect(0, 0, W, H)
        ctx.drawImage(img, 0, 0, W, H)
        if (peindreCadre(ctx, cadre, W, H, render)) { active = false; clearTimeout(timer); resolve() }
      }
      render()
    })
    dessinerTraits(ctx, traits, W, H)
    const k = W / Math.max(1, taille.w) // les mots gardent la même taille relative qu'à l'écran
    for (const m of mots) {
      ctx.font = `800 ${26 * k}px Nunito, system-ui, sans-serif`
      const lw = ctx.measureText(m.t).width
      const px = 14 * k
      const hh = 44 * k
      const x = m.x * W
      const y = m.y * H
      ctx.fillStyle = fond(m.c)
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x - lw / 2 - px, y - hh / 2, lw + px * 2, hh, 14 * k)
      else ctx.rect(x - lw / 2 - px, y - hh / 2, lw + px * 2, hh)
      ctx.fill()
      ctx.fillStyle = encre(m.c)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(m.t, x, y + 1 * k)
    }
    if (colles.length) {
      // les images des stickers sont normalement déjà là ; au cas où, on les attend un peu
      await new Promise<void>((res) => {
        const essai = () => {
          if (drawStickers(document.createElement('canvas').getContext('2d')!, colles, 1, essai)) res()
        }
        essai()
        setTimeout(res, 4000)
      })
      ctx.save()
      ctx.setTransform(W / SW, 0, 0, W / SW, 0, 0)
      drawStickers(ctx, colles)
      ctx.restore()
    }
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/jpeg', 0.86))
    if (!blob) throw new Error('Impossible de préparer cette image.')
    await onSend(blob, legende.trim())
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer cette image.') }
    finally { setEnvoi(false) }
  }

  return createPortal(
    <div
      className="anim-fondu fixed inset-x-0 top-0 z-[80] flex flex-col bg-[#0E0C16] text-white"
      style={{ height: 'var(--app-height, 100%)', transform: 'translateY(var(--app-top, 0px))', paddingTop: 'var(--sat)', pointerEvents: envoi ? 'none' : undefined }}
      role="dialog"
      aria-busy={envoi}
      aria-label={title}
    >
      {error && <p role="alert" className="bg-rouge px-4 py-2 text-sous text-white">{error}</p>}
      {/* outils */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-2">
        <button onClick={annuler} disabled={!gestes.length} className="presse flex h-11 w-11 items-center justify-center rounded-full bg-white/15 disabled:opacity-40" aria-label="Annuler le dernier geste">
          <Undo2 size={20} />
        </button>
        <button
          onClick={() => {
            tap()
            setMode('rien')
            setTiroir(false)
            setSaisie({ id: null, t: '' })
          }}
          className="presse flex h-11 w-11 items-center justify-center rounded-full bg-white/15"
          aria-label={initialDrawing ? 'Écrire sur le dessin' : 'Écrire sur la photo'}
        >
          <Type size={20} />
        </button>
        <button onClick={() => { setCadresOuverts(v => !v); setTiroir(false) }} aria-label="Choisir un cadre" aria-pressed={cadresOuverts} className={`presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${cadresOuverts ? 'bg-white text-[#0E0C16]' : 'bg-white/15'}`}><Frame size={21} /></button>
        <button
          onClick={() => {
            tap()
            setMode('rien')
            setSel(null)
            setCadresOuverts(false)
            setTiroir((t) => !t)
          }}
          className={`presse flex h-11 w-11 items-center justify-center rounded-full ${tiroir ? 'bg-white text-[#0E0C16]' : 'bg-white/15'}`}
          aria-pressed={tiroir}
          aria-label="Coller un sticker"
        >
          <Smile size={21} />
        </button>
        <button
          onClick={() => {
            tap()
            setTiroir(false)
            setSel(null)
            setMode((m) => (m === 'dessin' ? 'rien' : 'dessin'))
          }}
          className={`presse flex h-11 w-11 items-center justify-center rounded-full ${mode === 'dessin' ? 'bg-white text-[#0E0C16]' : 'bg-white/15'}`}
          aria-pressed={mode === 'dessin'}
          aria-label={initialDrawing ? 'Dessiner sur la note' : 'Dessiner sur la photo'}
        >
          <Brush size={20} />
        </button>
        <span className="flex-1" />
        <button onClick={onClose} disabled={envoi} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15" aria-label="Annuler">
          <X size={22} />
        </button>
      </div>

      {/* couleurs */}
      <div className={`flex justify-center gap-2 px-3 pb-2 transition-opacity ${mode === 'dessin' || saisie ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden pb-0 opacity-0'}`}>
        {COULEURS.map((c) => (
          <button
            key={c}
            onClick={() => {
              select()
              setCouleur(c)
            }}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${couleur === c ? 'scale-110 border-white' : 'border-white/30'}`}
            style={{ background: c }}
            aria-label={`Couleur ${c}`}
          />
        ))}
      </div>

      {/* la photo */}
      <div ref={zone} className="relative mx-3 min-h-0 flex-1" onPointerDown={() => setSel(null)}>
        {img && taille.w > 0 && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[18px]" style={{ width: taille.w, height: taille.h }}>
            <img src={img.src} alt="" className="block h-full w-full select-none" draggable={false} />
            <canvas
              ref={toile}
              className="absolute inset-0 h-full w-full"
              style={{ touchAction: 'none', pointerEvents: mode === 'dessin' ? 'auto' : 'none' }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                enCours.current = { c: couleur, e: 0.012, pts: [point(e)] }
                redessiner()
              }}
              onPointerMove={(e) => {
                if (!enCours.current) return
                enCours.current.pts.push(point(e))
                redessiner()
              }}
              onPointerUp={() => {
                const t = enCours.current
                enCours.current = null
                if (!t) return
                setTraits((x) => [...x, t])
                setGestes((g) => [...g, { k: 'trait' }])
              }}
              onPointerCancel={() => {
                enCours.current = null
                redessiner()
              }}
            />
            {mots.map((m) => (
              <span
                key={m.id}
                className="absolute flex h-[44px] -translate-x-1/2 -translate-y-1/2 cursor-grab select-none items-center whitespace-nowrap rounded-[14px] px-[14px] text-[26px] font-extrabold leading-none"
                style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, background: fond(m.c), color: encre(m.c), touchAction: 'none', pointerEvents: mode === 'dessin' ? 'none' : 'auto' }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  const r = (e.currentTarget.parentElement ?? e.currentTarget).getBoundingClientRect()
                  glisse.current = { id: m.id, dx: (e.clientX - r.left) / r.width - m.x, dy: (e.clientY - r.top) / r.height - m.y, bouge: false }
                }}
                onPointerMove={(e) => {
                  const g = glisse.current
                  if (!g || g.id !== m.id) return
                  const r = (e.currentTarget.parentElement ?? e.currentTarget).getBoundingClientRect()
                  const x = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width - g.dx))
                  const y = Math.min(0.96, Math.max(0.04, (e.clientY - r.top) / r.height - g.dy))
                  if (Math.abs(x - m.x) + Math.abs(y - m.y) > 0.005) g.bouge = true
                  setMots((ms) => ms.map((z) => (z.id === m.id ? { ...z, x, y } : z)))
                }}
                onPointerUp={() => {
                  const g = glisse.current
                  glisse.current = null
                  if (g && !g.bouge) {
                    setCouleur(m.c)
                    setSaisie({ id: m.id, t: m.t })
                  }
                }}
              >
                {m.t}
              </span>
            ))}
            <div className={mode === 'dessin' ? 'sans-doigt' : ''}>
              <StickerStage
                W={SW}
                H={SH}
                k={colles}
                setK={setColles}
                sel={sel}
                setSel={setSel}
                begin={() => {
                  kAvant.current = colles
                }}
                end={(changed) => {
                  const avant = kAvant.current
                  kAvant.current = null
                  if (changed && avant) setGestes((g) => [...g, { k: 'stickers', avant }])
                }}
              />
            </div>
          </div>
        )}
      </div>

      {cadresOuverts && <div className="no-bar flex shrink-0 gap-2 overflow-x-auto px-3 py-2" role="group" aria-label="Cadres photo">{CADRES.map(c => <button key={c.key} onClick={() => { select(); setCadre(c.key) }} aria-pressed={cadre === c.key} className={`presse min-h-11 shrink-0 rounded-full px-4 text-sous font-semibold ${cadre === c.key ? 'bg-white text-[#0E0C16]' : 'bg-white/15 text-white'}`}>{c.label}</button>)}</div>}
      {/* les stickers à coller */}
      {tiroir && (
        <div className="px-3">
          <StickerTray
            start="emojis"
            onClose={() => setTiroir(false)}
            onPick={(key, t, c) => {
              if (colles.length >= MAX_STICKERS) return
              const nv = nouveauSticker(key, SW, SH, colles.length, t, c)
              setGestes((g) => [...g, { k: 'stickers', avant: colles }])
              setColles([...colles, nv])
              setSel(colles.length)
              setTiroir(false)
            }}
          />
        </div>
      )}

      {/* légende + envoi */}
      <div className="flex items-end gap-2 px-3 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 10px)' }}>
        <input
          value={legende}
          onChange={(e) => setLegende(e.target.value)}
          maxLength={initialDrawing ? 80 : 500}
          placeholder={initialDrawing ? 'Nom du dessin (facultatif)…' : 'Ajoute une légende…'}
          aria-label={initialDrawing ? 'Nom du dessin' : 'Légende'}
          className="h-12 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-appel text-white outline-none placeholder:text-white/50"
        />
        <button onClick={() => void envoyer()} disabled={!img || envoi} className="presse ios-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white" aria-label={confirmLabel}>
          <ArrowUp size={24} strokeWidth={2.6} />
        </button>
      </div>

      {/* écrire un mot sur la photo */}
      {saisie && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black/60" onClick={validerMot}>
          <div className="flex justify-end px-3" style={{ paddingTop: 'calc(var(--sat) + 8px)' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                validerMot()
              }}
              className="presse rounded-full bg-white px-5 py-2.5 font-bold text-[#0E0C16]"
            >
              OK
            </button>
          </div>
          <div className="flex justify-center gap-2 px-3 pt-3" onClick={(e) => e.stopPropagation()}>
            {COULEURS.map((c) => (
              <button key={c} onClick={() => setCouleur(c)} className={`h-8 w-8 rounded-full border-2 ${couleur === c ? 'scale-110 border-white' : 'border-white/30'}`} style={{ background: c }} aria-label={`Couleur ${c}`} />
            ))}
          </div>
          <div className="flex flex-1 items-center justify-center px-6">
            <input
              autoFocus
              value={saisie.t}
              maxLength={80}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setSaisie({ ...saisie, t: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && validerMot()}
              placeholder="Écris ici"
              aria-label="Texte sur la photo"
              className="w-full rounded-[14px] px-4 py-2 text-center text-[26px] font-extrabold outline-none placeholder:text-current placeholder:opacity-50"
              style={{ background: fond(couleur), color: encre(couleur) }}
            />
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

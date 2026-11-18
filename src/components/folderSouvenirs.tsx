import { Check, Mic, Plus, Square, Upload, Video } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { folderAsset } from '../lib/folderMedia'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Folder, FolderItem, Moment } from '../lib/types'
import { compressImage, errorText } from '../lib/util'
import { Art, Avatar, Btn, Sheet } from './ui'

export async function photoBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('PHOTO_DU_FIL_INACCESSIBLE')
  return compressImage(await response.blob(), 1600, 0.86)
}

export function PhotosDuFil({ folder, replace, onClose, onSaved }: { folder: Folder; replace?: FolderItem; onClose: () => void; onSaved: () => void }) {
  const { state, api, reload, toast } = useHome()
  const photos = state.moments.filter(m => m.image_url).sort((a,b) => b.created_at.localeCompare(a.created_at))
  const already = new Set(state.folderItems.filter(i => i.folder_id === folder.id).map(i => i.source_moment_id).filter(Boolean))
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const save = async () => {
    if (busy || !selected.length) return
    setBusy(true); setError(''); setProgress(0)
    let added = 0
    try {
      for (const id of selected) {
        const photo = photos.find(p => p.id === id)
        if (!photo?.image_url) throw new Error('PHOTO_DU_FIL_INACCESSIBLE')
        const blob = await photoBlob(photo.image_url)
        if (replace) await api.replaceFolderMedia(replace, blob, { body: photo.body, sourceMomentId: photo.id })
        else await api.addFolderItem(folder, state.me.id, { kind: 'photo', blob, body: photo.body ?? undefined, sourceMomentId: photo.id })
        added++; setProgress(added)
        setSelected(current => current.filter(x => x !== id))
      }
      await reload(); success(); toast(replace ? 'Photo remplacée dans le dossier' : `${added} photo${added > 1 ? 's ajoutées' : ' ajoutée'}`)
      onSaved(); onClose()
    } catch (e) {
      if (added) await reload().catch(() => undefined)
      setError(`${added ? `${added} photo${added > 1 ? 's ont été ajoutées' : ' a été ajoutée'}. ` : ''}${errorText(e)}`)
    } finally { setBusy(false) }
  }
  return <Sheet title={replace ? 'Remplacer la photo' : 'Photos du fil'} tall onClose={() => { if (!busy) onClose() }} footer={photos.length > 0 ? <Btn onClick={save} disabled={busy || !selected.length}>{busy ? `Enregistrement… ${progress}` : replace ? 'Remplacer dans le dossier' : selected.length ? `Ajouter ${selected.length} photo${selected.length > 1 ? 's' : ''}` : 'Choisis les photos à ajouter'}</Btn> : undefined}>
    <p className="mb-4 text-sous text-brume">{replace ? 'Choisis la photo qui prendra sa place dans ce dossier.' : 'Choisis parmi les photos déjà partagées dans le fil familial.'} Le fil d’origine reste inchangé.</p>
    {error && <p role="alert" className="mb-4 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}
    {!photos.length ? <div className="py-8 text-center"><Art name="picto-photo" size={80} className="mx-auto" /><h3 className="mt-4 font-rond text-titre2">Le fil n’a pas encore de photo</h3><p className="mt-2 text-sous text-brume">Partage une première photo dans l’onglet Fil, puis retrouve-la ici.</p></div> : <div className="grid grid-cols-3 gap-2">
      {photos.map((p, index) => {
        const on = selected.includes(p.id)
        const exists = !replace && already.has(p.id)
        const author = state.members.find(m => m.id === p.member_id)
        return <button key={p.id} disabled={busy || exists} onClick={() => { tap(); setSelected(current => on ? current.filter(id => id !== p.id) : replace ? [p.id] : current.length < 20 ? [...current, p.id] : current) }} aria-label={`Photo ${index+1} de ${author?.display_name ?? 'la famille'}${exists ? ', déjà dans le dossier' : ''}`} aria-pressed={on || exists} className="presse min-w-0 text-left disabled:opacity-65">
          <span className={`relative block aspect-square overflow-hidden rounded-[16px] bg-remplissage ${on ? 'ring-2 ring-teinte ring-offset-2' : ''}`}><img src={p.image_url!} alt="" loading="lazy" className="h-full w-full object-cover" /><span className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full ${on || exists ? 'bg-teinte text-white' : 'bg-white/90 text-teinte'}`}>{on || exists ? <Check size={15} /> : <Plus size={15} />}</span></span>
          <span className="mt-1 flex min-w-0 items-center gap-1 text-note text-brume">{author && <Avatar m={author} size={18} />}<span className="truncate">{exists ? 'Déjà ajoutée' : author?.display_name ?? 'Un proche'}</span></span>
        </button>
      })}
    </div>}
  </Sheet>
}

function usePreview(blob: Blob | null) {
  const url = useMemo(() => blob ? URL.createObjectURL(blob) : null, [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}
const clock = (seconds: number) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`
type Recording = { recorder: MediaRecorder; stream: MediaStream; timer: number; chunks: Blob[]; discard: boolean }

export function SouvenirMedia({ folder, kind, onClose, onSaved }: { folder: Folder; kind: 'audio' | 'video'; onClose: () => void; onSaved: () => void }) {
  const { state, run, toast } = useHome()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [title, setTitle] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const current = useRef<Recording | null>(null)
  const alive = useRef(true)
  const preview = usePreview(blob)
  useEffect(() => { alive.current = true; return () => {
    alive.current = false
    const r = current.current
    if (r) { r.discard = true; clearInterval(r.timer); if (r.recorder.state !== 'inactive') r.recorder.stop(); r.stream.getTracks().forEach(t => t.stop()) }
  } }, [])
  const choose = (selected?: File) => {
    if (!selected) return
    try { folderAsset(kind, selected); setBlob(selected); setError('') } catch (e) { setError(errorText(e)) }
  }
  const stop = (discard = false) => {
    const r = current.current
    if (!r) return
    r.discard = discard
    clearInterval(r.timer)
    if (r.recorder.state !== 'inactive') r.recorder.stop()
    r.stream.getTracks().forEach(t => t.stop())
  }
  const start = async () => {
    if (recording || starting) return
    setError(''); setStarting(true)
    let stream: MediaStream | null = null
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('MICRO_INDISPONIBLE')
      stream = await navigator.mediaDevices.getUserMedia({audio:true})
      if (!alive.current) { stream.getTracks().forEach(t => t.stop()); return }
      const mime = ['audio/mp4','audio/webm','audio/ogg'].find(t => MediaRecorder.isTypeSupported(t))
      if (!mime) throw new Error('MICRO_INDISPONIBLE')
      const recorder = new MediaRecorder(stream,{mimeType:mime})
      const r: Recording = { recorder, stream, timer:0, chunks:[], discard:false }
      current.current = r
      recorder.ondataavailable = e => { if (e.data.size) r.chunks.push(e.data) }
      recorder.onstop = () => {
        clearInterval(r.timer); r.stream.getTracks().forEach(t => t.stop()); current.current = null
        if (!alive.current) return
        setRecording(false)
        if (!r.discard) {
          const saved = new Blob(r.chunks,{type:recorder.mimeType || mime})
          if (saved.size) setBlob(saved)
          else setError('Le vocal est vide. Réessaie ou importe un audio.')
        }
      }
      recorder.onerror = () => { stop(true); if (alive.current) setError('L’enregistrement a été interrompu. Tu peux réessayer.') }
      recorder.start(250); setSeconds(0); setRecording(true)
      const began = Date.now()
      r.timer = window.setInterval(() => { const elapsed = Math.floor((Date.now()-began)/1000); if (alive.current) setSeconds(elapsed); if (elapsed >= 120) stop() },250)
    } catch (e) { stream?.getTracks().forEach(t => t.stop()); setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Autorise le micro pour enregistrer ton souvenir, ou importe un audio.' : errorText(e)) }
    finally { if (alive.current) setStarting(false) }
  }
  const save = async () => {
    if (!blob || busy || recording) return
    try { folderAsset(kind, blob) } catch (e) { setError(errorText(e)); return }
    setBusy(true)
    const ok = await run(api => api.addFolderItem(folder,state.me.id,{kind,blob,title:title.trim() || (kind === 'audio' ? 'Un souvenir vocal' : 'Un souvenir vidéo')}), 'Souvenir enregistré')
    setBusy(false)
    if (ok) { success(); onSaved(); onClose() } else setError('Ton souvenir n’a pas été enregistré. Il reste prêt à réessayer ici.')
  }
  return <Sheet title={kind === 'audio' ? 'Un souvenir vocal' : 'Une vidéo souvenir'} tall onClose={() => { if (!busy && !starting) onClose() }} footer={<Btn onClick={save} disabled={!blob || busy || recording || starting}>{busy ? 'Enregistrement…' : 'Garder dans le dossier'}</Btn>}>
    <p className="mb-5 text-sous text-brume">{kind === 'audio' ? 'Une voix, une histoire, un petit mot à réécouter ensemble.' : 'Un moment à regarder à nouveau, avec les membres de ce dossier.'}</p>
    <input ref={file} type="file" accept={kind === 'audio' ? 'audio/*' : 'video/mp4,video/quicktime,video/webm'} hidden onChange={e => {choose(e.target.files?.[0]);e.target.value=''}} />
    {error && <p role="alert" className="mb-4 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}
    {kind === 'audio' && <div className="rounded-[24px] bg-white p-6 text-center shadow-carte"><Mic size={36} className={`mx-auto ${recording ? 'text-rouge' : 'text-teinte'}`} /><p role="status" className="mt-3 font-rond text-titre1">{recording ? clock(seconds) : 'Ta voix raconte un souvenir'}</p><p className="mt-2 text-sous text-brume">{recording ? 'Enregistrement en cours · 2 minutes maximum' : 'Tu peux l’écouter avant de le garder.'}</p>{recording ? <><Btn className="mt-5" onClick={() => stop()}><Square size={18} fill="currentColor" />Arrêter</Btn><button onClick={() => stop(true)} className="mt-2 min-h-11 text-sous text-brume">Annuler l’enregistrement</button></> : <Btn className="mt-5" onClick={() => void start()} disabled={busy || starting}><Mic size={18} />{starting ? 'Ouverture du micro…' : blob ? 'Réenregistrer' : 'Enregistrer ma voix'}</Btn>}</div>}
    {preview && !recording && <div className="mt-4 rounded-[20px] bg-white p-3 shadow-carte">{kind === 'video' ? <video key={preview} src={preview} controls playsInline preload="metadata" className="max-h-[300px] w-full rounded-[14px] bg-black" /> : <audio key={preview} src={preview} controls preload="metadata" className="w-full" />}</div>}
    {!recording && <button onClick={() => file.current?.click()} disabled={busy || starting} className="presse mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce">{kind === 'video' ? <Video size={19} /> : <Upload size={19} />}{kind === 'video' ? blob ? 'Changer de vidéo' : 'Choisir une vidéo' : 'Importer un audio'}</button>}
    <p className="mt-2 text-center text-note text-brume">{kind === 'video' ? 'MP4, MOV ou WebM · 25 Mo maximum' : 'Audio · 10 Mo maximum'}</p>
    <label className="mb-2 mt-6 block text-sous font-semibold" htmlFor={`souvenir-${kind}`}>Nom du souvenir <span className="font-normal text-brume">(facultatif)</span></label>
    <input id={`souvenir-${kind}`} disabled={busy} value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder={kind === 'audio' ? 'Ex. : L’histoire de Mamie' : 'Ex. : Notre journée au lac'} className="champ" />
  </Sheet>
}

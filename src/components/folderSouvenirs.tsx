import { Check, Mic, Plus, Square, Upload, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { folderAsset } from '../lib/folderMedia'
import { success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Folder } from '../lib/types'
import { compressImage, errorText } from '../lib/util'
import { PhotoEditeur } from './photoEditeur'
import { Art, Avatar, Btn, Sheet } from './ui'
import { ApercuVideo, CoupeVideo, useVideoAPreparer } from './videos'

export async function photoBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('PHOTO_DU_FIL_INACCESSIBLE')
  return compressImage(await response.blob(), 1600, 0.86)
}

export function PhotosDuFil({ folder, onClose, onSaved }: { folder: Folder; onClose: () => void; onSaved: () => void }) {
  const { state, api, reload, toast } = useHome()
  const photos = state.moments.filter(m => m.image_url).sort((a,b) => b.created_at.localeCompare(a.created_at))
  const already = new Set(state.folderItems.filter(i => i.folder_id === folder.id).map(i => i.source_moment_id).filter(Boolean))
  const [source, setSource] = useState<'phone'|'thread'>('phone')
  const [selected, setSelected] = useState<string[]>([])
  const [files, setFiles] = useState<{id:string;file:File;caption?:string}[]>([])
  const [editing, setEditing] = useState<string|null>(null)
  const input = useRef<HTMLInputElement>(null)
  const previews = useMemo(() => files.map(f => ({...f,url:URL.createObjectURL(f.file)})),[files])
  useEffect(() => () => previews.forEach(f => URL.revokeObjectURL(f.url)),[previews])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const count = source === 'phone' ? files.length : selected.length
  const save = async () => {
    if (busy || !count) return
    setBusy(true); setError(''); setProgress(0)
    let added = 0
    try {
      if (source === 'phone') {
        for (const file of files) {
          const blob = await compressImage(file.file,1600,0.86)
          await api.addFolderItem(folder,state.me.id,{kind:'photo',blob,body:file.caption})
          added++; setProgress(added); setFiles(current => current.filter(f => f.id !== file.id))
        }
      } else {
        for (const id of selected) {
          const photo = photos.find(p => p.id === id)
          if (!photo?.image_url) throw new Error('PHOTO_DU_FIL_INACCESSIBLE')
          const blob = await photoBlob(photo.image_url)
          await api.addFolderItem(folder,state.me.id,{kind:'photo',blob,body:photo.body ?? undefined,sourceMomentId:photo.id})
          added++; setProgress(added); setSelected(current => current.filter(x => x !== id))
        }
      }
      await reload(); success(); toast(`${added} photo${added > 1 ? 's ajoutées' : ' ajoutée'}`)
      onSaved(); onClose()
    } catch (e) {
      if (added) await reload().catch(() => undefined)
      setError(`${added ? `${added} photo(s) ajoutée(s). ` : ''}${errorText(e)}`)
    } finally { setBusy(false) }
  }
  const edit = files.find(f => f.id === editing)
  return <>{!edit && <Sheet title="Ajouter des photos" tall onClose={() => { if (!busy) onClose() }} footer={<Btn onClick={save} disabled={busy || !count}>{busy ? `Enregistrement… ${progress}` : count ? `Ajouter ${count} photo${count > 1 ? 's' : ''}` : 'Choisis des photos'}</Btn>}>
    <div className="mb-4 flex gap-2" role="group" aria-label="Provenance des photos">{([['phone','Téléphone'],['thread','Fil familial']] as const).map(([key,label]) => <button key={key} disabled={busy} onClick={() => setSource(key)} aria-pressed={source === key} className={`presse min-h-11 flex-1 rounded-full px-4 text-sous font-semibold ${source === key ? 'bg-teinte text-white' : 'bg-remplissage text-encre'}`}>{label}</button>)}</div>
    <p className="mb-4 text-sous text-brume">{source === 'phone' ? 'Choisis des photos de ta photothèque, même si elles ne sont pas dans le fil. Tu peux les décorer avant de les ajouter.' : 'Sélectionne les photos du fil familial à garder ici. Le fil reste inchangé.'}</p>
    {error && <p role="alert" className="mb-4 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}
    <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { const incoming = Array.from(e.target.files ?? []); e.target.value=''; setFiles(current => [...current,...incoming.map(file => ({id:crypto.randomUUID(),file}))]); setError('') }} />
    {source === 'phone' ? <>
      <button onClick={() => input.current?.click()} disabled={busy} className="presse mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce"><Upload size={19} />Choisir dans la photothèque</button>
      <div className="grid grid-cols-2 gap-3">{previews.map(f => <div key={f.id} className="relative overflow-hidden rounded-[18px] bg-carte shadow-carte"><img src={f.url} alt="Photo à ajouter" className="aspect-square w-full object-cover" /><button disabled={busy} onClick={() => setFiles(current => current.filter(x => x.id !== f.id))} aria-label="Retirer cette sélection" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-rouge"><X size={19} /></button><button disabled={busy} onClick={() => setEditing(f.id)} className="min-h-11 w-full px-2 text-note font-semibold text-teinte-fonce">Cadres, stickers et dessin</button></div>)}</div>
    </> : !photos.length ? <div className="py-8 text-center"><Art name="picto-photo" size={80} className="mx-auto" /><h3 className="mt-4 font-rond text-titre2">Le fil n’a pas encore de photo</h3><p className="mt-2 text-sous text-brume">Tu peux en ajouter depuis ton téléphone.</p><button onClick={() => setSource('phone')} className="mt-3 min-h-11 font-semibold text-teinte-fonce">Depuis le téléphone</button></div> : <div className="grid grid-cols-3 gap-2">{photos.map((p,index) => {
      const on = selected.includes(p.id), exists = already.has(p.id)
      const author = state.members.find(m => m.id === p.member_id)
      return <button key={p.id} disabled={busy || exists} onClick={() => { tap(); setSelected(current => on ? current.filter(id => id !== p.id) : [...current,p.id]) }} aria-label={`Photo ${index+1} de ${author?.display_name ?? 'la famille'}${exists ? ', déjà dans l’album' : ''}`} aria-pressed={on || exists} className="presse min-w-0 text-left disabled:opacity-65"><span className={`relative block aspect-square overflow-hidden rounded-[16px] bg-remplissage ${on ? 'ring-2 ring-teinte ring-offset-2' : ''}`}><img src={p.image_url!} alt="" loading="lazy" className="h-full w-full object-cover" /><span className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full ${on || exists ? 'bg-teinte text-white' : 'bg-white/90 text-teinte'}`}>{on || exists ? <Check size={15} /> : <Plus size={15} />}</span></span><span className="mt-1 flex min-w-0 items-center gap-1 text-note text-brume">{author && <Avatar m={author} size={18} />}<span className="truncate">{exists ? 'Déjà ajoutée' : author?.display_name ?? 'Un proche'}</span></span></button>
    })}</div>}
  </Sheet>}{edit && <PhotoEditeur file={edit.file} initialCaption={edit.caption} title="Décorer la photo" confirmLabel="Garder cette version" onClose={() => setEditing(null)} onSend={(blob,caption) => {setFiles(current => current.map(f => f.id === edit.id ? {...f,file:new File([blob],'souvenir.jpg',{type:blob.type}),caption} : f));setEditing(null)}} />}</>
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
  // une vidéo est allégée avant l'envoi (720p) ; pas de limite de durée dans un album, 25 Mo au plus une fois prête
  const vid = useVideoAPreparer(null, (m) => setError(m))
  const videoPrete = kind === 'video' && vid.video?.etat === 'pret' ? vid.video.prep?.blob ?? null : null
  const aGarder = kind === 'video' ? videoPrete : blob
  useEffect(() => { alive.current = true; return () => {
    alive.current = false
    const r = current.current
    if (r) { r.discard = true; clearInterval(r.timer); if (r.recorder.state !== 'inactive') r.recorder.stop(); r.stream.getTracks().forEach(t => t.stop()) }
  } }, [])
  const choose = (selected?: File) => {
    if (!selected) return
    if (kind === 'video') {
      setError('')
      void vid.lancer(selected)
      return
    }
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
    const blob = aGarder
    if (!blob || busy || recording || vid.enPreparation) return
    try { folderAsset(kind, blob) } catch (e) { setError(errorText(e)); return }
    setBusy(true)
    const ok = await run(api => api.addFolderItem(folder,state.me.id,{kind,blob,title:title.trim() || (kind === 'audio' ? 'Un souvenir vocal' : 'Un souvenir vidéo')}), 'Souvenir enregistré')
    setBusy(false)
    if (ok) { success(); onSaved(); onClose() } else setError('Ton souvenir n’a pas été enregistré. Il reste prêt à réessayer ici.')
  }
  return <Sheet title={kind === 'audio' ? 'Un souvenir vocal' : 'Une vidéo souvenir'} tall onClose={() => { if (!busy && !starting) onClose() }} footer={<Btn onClick={save} disabled={!aGarder || busy || recording || starting || vid.enPreparation}>{busy ? 'Enregistrement…' : vid.enPreparation ? `Préparation de la vidéo… ${Math.round((vid.video?.progres ?? 0) * 100)} %` : 'Garder dans l’album'}</Btn>}>
    <p className="mb-5 text-sous text-brume">{kind === 'audio' ? 'Une voix, une histoire, un petit mot à réécouter ensemble.' : 'Un moment à regarder à nouveau, avec les membres de cet album.'}</p>
    <input ref={file} type="file" accept={kind === 'audio' ? 'audio/*' : 'video/mp4,video/quicktime,video/webm'} hidden onChange={e => {choose(e.target.files?.[0]);e.target.value=''}} />
    {error && <p role="alert" className="mb-4 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}
    {kind === 'audio' && <div className="rounded-[24px] bg-white p-6 text-center shadow-carte"><Mic size={36} className={`mx-auto ${recording ? 'text-rouge' : 'text-teinte'}`} /><p role="status" className="mt-3 font-rond text-titre1">{recording ? clock(seconds) : 'Ta voix raconte un souvenir'}</p><p className="mt-2 text-sous text-brume">{recording ? 'Enregistrement en cours · 2 minutes maximum' : 'Tu peux l’écouter avant de le garder.'}</p>{recording ? <><Btn className="mt-5" onClick={() => stop()}><Square size={18} fill="currentColor" />Arrêter</Btn><button onClick={() => stop(true)} className="mt-2 min-h-11 text-sous text-brume">Annuler l’enregistrement</button></> : <Btn className="mt-5" onClick={() => void start()} disabled={busy || starting}><Mic size={18} />{starting ? 'Ouverture du micro…' : blob ? 'Réenregistrer' : 'Enregistrer ma voix'}</Btn>}</div>}
    {kind === 'video' && vid.video && <ApercuVideo v={vid.video} onRetirer={vid.retirer} onCouper={vid.recouper} />}
    {vid.coupe && <CoupeVideo {...vid.coupe} />}
    {preview && !recording && kind !== 'video' && <div className="mt-4 rounded-[20px] bg-white p-3 shadow-carte"><audio key={preview} src={preview} controls preload="metadata" className="w-full" /></div>}
    {!recording && <button onClick={() => file.current?.click()} disabled={busy || starting} className="presse mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce">{kind === 'video' ? <Video size={19} /> : <Upload size={19} />}{kind === 'video' ? vid.video ? 'Changer de vidéo' : 'Choisir une vidéo' : 'Importer un audio'}</button>}
    <p className="mt-2 text-center text-note text-brume">{kind === 'video' ? 'Elle est allégée avant l’envoi · 25 Mo au plus' : 'Audio · 10 Mo maximum'}</p>
    <label className="mb-2 mt-6 block text-sous font-semibold" htmlFor={`souvenir-${kind}`}>Nom du souvenir <span className="font-normal text-brume">(facultatif)</span></label>
    <input id={`souvenir-${kind}`} disabled={busy} value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder={kind === 'audio' ? 'Ex. : L’histoire de Mamie' : 'Ex. : Notre journée au lac'} className="champ" />
  </Sheet>
}

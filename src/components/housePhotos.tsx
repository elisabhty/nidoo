import { Check, Minus, Plus, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { housePhotoSources, selectedHousePhotos } from '../lib/housePhotos'
import { useHome } from '../lib/store'
import { compressImage, errorText } from '../lib/util'
import { Btn, Sheet } from './ui'

export function HousePhotosSheet({mode,onClose}:{mode:'add'|'remove';onClose:()=>void}) {
  const {state,api,reload,toast} = useHome()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const sources = housePhotoSources(state)
  const current = selectedHousePhotos(sources,state.family.house_photo_ids)
  const ids = current.map(p => p.id)
  const photos = mode === 'remove' ? current : sources
  const full = ids.length >= 6
  const save = async (id:string) => {
    if (busy) return
    const exists = ids.includes(id)
    if (mode === 'add' && (exists || full)) return
    setBusy(true);setError('')
    try {
      await api.updateFamily(state.family.id,{house_photo_ids:exists ? ids.filter(x => x !== id) : [...ids,id]})
      await reload()
      toast(exists ? 'Photo retirée de la maison' : 'Photo ajoutée à la maison')
    } catch(e) {setError(errorText(e))} finally {setBusy(false)}
  }
  const upload = async (file?:File) => {
    if (!file || busy || full) return
    setBusy(true);setError('')
    let shared = false
    try {
      const blob = await compressImage(file,1600,0.86)
      const before = new Set(state.moments.map(m => m.id))
      await api.postMoment(state.family.id,state.me.id,{blob})
      shared = true
      const fresh = await api.load(state.family.id)
      const added = fresh.moments.filter(m => !before.has(m.id) && m.member_id === state.me.id && m.image_url).sort((a,b) => b.created_at.localeCompare(a.created_at))[0]
      if (!added) throw new Error('Retrouve-la dans le fil pour l’ajouter à la maison.')
      const latest = selectedHousePhotos(housePhotoSources(fresh),fresh.family.house_photo_ids).map(p => p.id)
      const key = `m:${added.id}`
      await api.updateFamily(state.family.id,{house_photo_ids:[key,...latest.filter(id => id !== key)].slice(0,6)})
      await reload();toast('Photo ajoutée à la maison et partagée dans le fil')
    } catch(e) {
      if (shared) await reload().catch(() => undefined)
      setError(`${shared ? 'La photo est dans le fil. ' : ''}${errorText(e)}`)
    } finally {setBusy(false)}
  }
  return <Sheet title={mode === 'add' ? 'Ajouter une photo' : 'Retirer une photo'} tall onClose={() => {if(!busy) onClose()}} footer={<Btn kind="gris" disabled={busy} onClick={onClose}>Terminer</Btn>}>
    <p className="mb-4 text-sous text-brume">{mode === 'add' ? 'Choisis les photos à accrocher dans la maison, jusqu’à 6. Elles sont visibles par toute la famille.' : 'Retire une photo du décor. Son original reste dans le fil ou les souvenirs partagés.'}</p>
    <p role="status" className="mb-4 text-note font-semibold text-teinte-fonce">{current.length} sur 6 photos accrochées{busy ? ' · Enregistrement…' : ''}</p>
    {error && <p role="alert" className="mb-4 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}
    {mode === 'add' && <>
      <input ref={input} type="file" accept="image/*" hidden onChange={e => {const file=e.target.files?.[0];e.target.value='';void upload(file)}} />
      <button disabled={busy || full} onClick={() => input.current?.click()} className="presse mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce disabled:opacity-40"><Upload size={19} />Depuis le téléphone</button>
      <p className="mb-5 text-center text-note text-brume">La nouvelle photo sera aussi partagée dans le fil familial.</p>
      {full && <p className="mb-4 text-sous text-brume">La corde est pleine. Utilise le bouton − de la maison pour libérer une place.</p>}
    </>}
    {photos.length === 0 ? <p className="py-8 text-center text-sous text-brume">{mode === 'remove' ? 'Aucune photo à retirer.' : 'Ajoute votre première photo depuis le téléphone.'}</p> : <div className="grid grid-cols-3 gap-3">{photos.map((p,i) => {
      const on = ids.includes(p.id)
      return <button key={p.id} disabled={busy || (mode === 'add' && (on || full))} onClick={() => void save(p.id)} aria-label={`${mode === 'remove' ? 'Retirer' : on ? 'Déjà accrochée' : 'Accrocher'} la photo ${i+1}`} className="presse relative aspect-square overflow-hidden rounded-[16px] bg-remplissage disabled:opacity-65"><img src={p.url} alt="" className="h-full w-full object-cover" /><span className={`absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-carte ${mode === 'remove' ? 'text-rouge' : 'text-teinte-fonce'}`}>{mode === 'remove' ? <Minus size={18} /> : on ? <Check size={18} /> : <Plus size={18} />}</span></button>
    })}</div>}
  </Sheet>
}

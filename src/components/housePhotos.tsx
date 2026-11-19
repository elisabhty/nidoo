import { Check, Plus, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { housePhotoSlots, housePhotoSources } from '../lib/housePhotos'
import { useHome } from '../lib/store'
import { compressImage, errorText } from '../lib/util'
import { Btn, Sheet } from './ui'

/** Accrocher une photo dans la maison : à une place précise de la corde (index : remplacer une photo, ou
 *  remplir une place libre), ou en plus au bout de la corde. */
export function HousePhotosSheet({ mode, index, onClose }: { mode: 'add' | 'replace'; index?: number; onClose: () => void }) {
  const { state, api, reload, toast } = useHome()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const sources = housePhotoSources(state)
  const places = housePhotoSlots(sources, state.family.house_photo_ids)
  const ids = places.map((p) => p?.id ?? '')
  const remplace = mode === 'replace' && index != null && index < ids.length
  const full = !remplace && !ids.includes('') && ids.length >= 5
  /** les places une fois `id` posé : à la place touchée, sinon dans la première place libre, sinon au bout */
  const avec = (liste: string[], id: string) => {
    const out = liste.map((x) => (x === id ? '' : x))
    const i = remplace ? index! : out.indexOf('')
    if (i >= 0 && i < out.length) out[i] = id
    else out.push(id)
    return out.slice(0, 5)
  }
  const save = async (id: string) => {
    if (busy || ids.includes(id) || full) return
    setBusy(true)
    setError('')
    try {
      await api.updateFamily(state.family.id, { house_photo_ids: avec(ids, id) })
      await reload()
      toast(remplace ? 'Photo remplacée' : 'Photo accrochée dans la maison')
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const upload = async (file?: File) => {
    if (!file || busy || full) return
    setBusy(true)
    setError('')
    let shared = false
    try {
      const blob = await compressImage(file, 1600, 0.86)
      const before = new Set(state.moments.map((m) => m.id))
      await api.postMoment(state.family.id, state.me.id, { blob })
      shared = true
      const fresh = await api.load(state.family.id)
      const added = fresh.moments.filter((m) => !before.has(m.id) && m.member_id === state.me.id && m.image_url).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      if (!added) throw new Error('Retrouve-la dans le fil pour l’accrocher dans la maison.')
      const latest = housePhotoSlots(housePhotoSources(fresh), fresh.family.house_photo_ids).map((p) => p?.id ?? '')
      await api.updateFamily(state.family.id, { house_photo_ids: avec(latest, `m:${added.id}`) })
      await reload()
      toast(remplace ? 'Photo remplacée et partagée dans le fil' : 'Photo accrochée et partagée dans le fil')
      onClose()
    } catch (e) {
      if (shared) await reload().catch(() => undefined)
      setError(`${shared ? 'La photo est dans le fil. ' : ''}${errorText(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const actuelle = remplace ? places[index!] : null
  return (
    <Sheet title={actuelle ? 'Remplacer la photo' : 'Accrocher une photo'} tall onClose={() => { if (!busy) onClose() }} footer={<Btn kind="gris" disabled={busy} onClick={onClose}>Annuler</Btn>}>
      {actuelle ? (
        <div className="mb-4 flex items-center gap-3">
          <img src={actuelle.url} alt="" className="h-14 w-14 rounded-[12px] object-cover" />
          <p className="text-sous text-brume">Choisis la photo qui prend sa place sur la corde. Celle-ci reste dans le fil.</p>
        </div>
      ) : (
        <p className="mb-4 text-sous text-brume">{remplace ? 'Choisis la photo à accrocher à cette place libre.' : 'Choisis une photo à accrocher dans la maison (5 au plus).'} Toute la famille la voit.</p>
      )}
      {busy && <p role="status" className="mb-3 text-note font-semibold text-teinte-fonce">Enregistrement…</p>}
      {error && <p role="alert" className="mb-4 rounded-[16px] bg-rouge/10 p-3 text-sous text-rouge">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file) }} />
      <button disabled={busy || full} onClick={() => input.current?.click()} className="presse mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-teinte-doux px-4 text-sous font-semibold text-teinte-fonce disabled:opacity-40">
        <Upload size={19} />
        Depuis le téléphone
      </button>
      <p className="mb-5 text-center text-note text-brume">La nouvelle photo sera aussi partagée dans le fil familial.</p>
      {full && <p className="mb-4 text-sous text-brume">La corde est pleine : touche une photo de la maison pour la remplacer ou la décrocher.</p>}
      {sources.length === 0 ? (
        <p className="py-8 text-center text-sous text-brume">Ajoute votre première photo depuis le téléphone.</p>
      ) : (
        <>
          <p className="mb-2 px-1 text-note font-semibold uppercase tracking-[0.02em] text-brume">Déjà dans le fil</p>
          <div className="grid grid-cols-3 gap-3">
            {sources.map((p, i) => {
              const on = ids.includes(p.id)
              return (
                <button
                  key={p.id}
                  disabled={busy || on || full}
                  onClick={() => void save(p.id)}
                  aria-label={on ? `Photo ${i + 1}, déjà accrochée` : `${actuelle ? 'Mettre' : 'Accrocher'} la photo ${i + 1}`}
                  className="presse relative aspect-square overflow-hidden rounded-[16px] bg-remplissage disabled:opacity-60"
                >
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-teinte-fonce shadow-carte">{on ? <Check size={18} /> : <Plus size={18} />}</span>
                  {on && <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[11px] font-semibold text-white">Accrochée</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}

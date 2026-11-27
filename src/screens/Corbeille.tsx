// « Supprimés récemment » (Elisa, 27 novembre : une corbeille de 30 jours, comme dans Photos sur l'iPhone).
// Ce que j'ai supprimé du fil ou des albums reste ici 30 jours : je peux le remettre, ou l'effacer pour de bon.
// Personne d'autre ne le voit.
import { BookImage, ChevronLeft, FileText, MessageSquareQuote, PenLine, Trash2, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { choisir, confirmer, Rond, Screen } from '../components/ui'
import { tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Backend, FamilyState, Folder, FolderItem, Jetable, Moment } from '../lib/types'

const JOUR = 86400000

type Ligne = {
  cle: string
  table: Jetable
  id: string
  at: string
  titre: string
  detail: string
  image?: string | null
  icone: ReactNode
  /** remis : « Remis dans le fil », « Remis dans l'album »… */
  remis: string
  effacer: (api: Backend) => Promise<void>
}

const extrait = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

function lignes(st: FamilyState): { publications: Ligne[]; albums: Ligne[]; souvenirs: Ligne[] } {
  const j = st.jetes ?? { moments: [], folderItems: [], folders: [] }
  const nomAlbum = (id: string) => [...st.folders, ...j.folders].find((f) => f.id === id)?.name
  const publications = j.moments.map((m: Moment): Ligne => ({
    cle: `m-${m.id}`,
    table: 'moments',
    id: m.id,
    at: m.deleted_at!,
    titre: m.body?.trim() ? extrait(m.body.trim()) : m.video_path ? 'Une vidéo' : m.image_path ? 'Une photo' : m.sticker ? 'Un sticker' : 'Une publication',
    detail: m.poll_options?.length ? 'Sondage du fil' : 'Publication du fil',
    image: m.image_url ?? m.poster_url,
    icone: m.video_path ? <Video size={20} /> : <MessageSquareQuote size={20} />,
    remis: 'Remise dans le fil',
    effacer: (api) => api.deleteMoment(m),
  }))
  const albums = j.folders.map((f: Folder): Ligne => ({
    cle: `f-${f.id}`,
    table: 'folders',
    id: f.id,
    at: f.deleted_at!,
    titre: f.name,
    detail: 'Album, avec tout son contenu',
    image: f.cover_url,
    icone: <BookImage size={20} />,
    remis: 'Album remis',
    effacer: (api) => api.deleteFolder(f),
  }))
  const souvenirs = j.folderItems.map((i: FolderItem): Ligne => ({
    cle: `i-${i.id}`,
    table: 'folder_items',
    id: i.id,
    at: i.deleted_at!,
    titre: i.title?.trim() || (i.body?.trim() ? extrait(i.body.trim()) : i.kind === 'photo' ? 'Une photo' : i.kind === 'video' ? 'Une vidéo' : i.kind === 'dessin' ? 'Un dessin' : i.kind === 'note' ? 'Une note' : 'Un souvenir'),
    detail: nomAlbum(i.folder_id) ? `Dans « ${nomAlbum(i.folder_id)} »` : 'Dans un album',
    image: i.image_url,
    icone: i.kind === 'video' ? <Video size={20} /> : i.kind === 'note' ? <FileText size={20} /> : i.kind === 'dessin' ? <PenLine size={20} /> : <MessageSquareQuote size={20} />,
    remis: 'Remis dans l’album',
    effacer: (api) => api.deleteFolderItem(i),
  }))
  const tri = (l: Ligne[]) => l.sort((a, b) => b.at.localeCompare(a.at))
  return { publications: tri(publications), albums: tri(albums), souvenirs: tri(souvenirs) }
}

/** Sans la ligne, dans les listes de la corbeille. */
const sans = (st: FamilyState, l: Ligne): FamilyState => {
  const j = st.jetes ?? { moments: [], folderItems: [], folders: [] }
  return {
    ...st,
    jetes: {
      moments: l.table === 'moments' ? j.moments.filter((x) => x.id !== l.id) : j.moments,
      folders: l.table === 'folders' ? j.folders.filter((x) => x.id !== l.id) : j.folders,
      folderItems: l.table === 'folder_items' ? j.folderItems.filter((x) => x.id !== l.id) : j.folderItems,
    },
  }
}

/** Remise à sa place, tout de suite à l'écran (la base suit). */
const remise = (st: FamilyState, l: Ligne): FamilyState => {
  const j = st.jetes ?? { moments: [], folderItems: [], folders: [] }
  const s = sans(st, l)
  if (l.table === 'moments') {
    const m = j.moments.find((x) => x.id === l.id)
    return m ? { ...s, moments: [{ ...m, deleted_at: null, deleted_by: null }, ...s.moments].sort((a, b) => b.created_at.localeCompare(a.created_at)) } : s
  }
  if (l.table === 'folder_items') {
    const i = j.folderItems.find((x) => x.id === l.id)
    return i && s.folders.some((f) => f.id === i.folder_id) ? { ...s, folderItems: [...s.folderItems, { ...i, deleted_at: null, deleted_by: null }] } : s
  }
  const f = j.folders.find((x) => x.id === l.id)
  return f ? { ...s, folders: [...s.folders, { ...f, deleted_at: null, deleted_by: null }] } : s
}

export function Corbeille({ onBack, retour = 'Albums' }: { onBack: () => void; retour?: string }) {
  const { state, run } = useHome()
  const { publications, albums, souvenirs } = lignes(state)
  const toutes = [...publications, ...albums, ...souvenirs]

  const remettre = (l: Ligne) => {
    tap()
    void run((api) => api.restaurer(l.table, l.id), l.remis, (st: FamilyState) => remise(st, l))
  }
  const effacer = async (l: Ligne) => {
    if (!(await confirmer({ title: 'Supprimer pour de bon ?', message: `« ${l.titre} » sera effacé. Ça ne pourra pas être annulé.`, confirm: 'Supprimer', destructive: true }))) return
    void run((api) => l.effacer(api), undefined, (st: FamilyState) => sans(st, l))
  }
  const options = async (l: Ligne) => {
    tap()
    const i = await choisir({ title: l.titre, actions: [{ label: 'Remettre' }, { label: 'Supprimer pour de bon', destructive: true }] })
    if (i === 0) remettre(l)
    else if (i === 1) void effacer(l)
  }
  const toutEffacer = async () => {
    tap()
    if (!(await confirmer({ title: 'Tout supprimer pour de bon ?', message: `${toutes.length} élément${toutes.length > 1 ? 's' : ''} ser${toutes.length > 1 ? 'ont' : 'a'} effacé${toutes.length > 1 ? 's' : ''}. Ça ne pourra pas être annulé.`, confirm: 'Tout supprimer', destructive: true }))) return
    void run(
      async (api) => {
        for (const l of toutes) await l.effacer(api)
      },
      undefined,
      (st: FamilyState) => ({ ...st, jetes: { moments: [], folders: [], folderItems: [] } }),
    )
  }

  const reste = (at: string) => {
    const j = Math.max(1, 30 - Math.floor((Date.now() - Date.parse(at)) / JOUR))
    return j <= 1 ? 'Effacé demain' : `Encore ${j} jours`
  }
  const partie = (titre: string, l: Ligne[]) =>
    l.length > 0 && (
      <section className="mt-5 first:mt-0">
        <h2 className="mb-2 px-5 text-note font-semibold uppercase tracking-wide text-brume">{titre}</h2>
        <div className="mx-4 overflow-hidden rounded-[22px] bg-carte shadow-carte">
          {l.map((x, k) => (
            <div key={x.cle} className={`flex min-h-[72px] items-center gap-3 pl-3 pr-2 ${k ? 'border-t border-trait' : ''}`}>
              <button onClick={() => void options(x)} className="presse flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-teinte-doux text-teinte-fonce">
                  {x.image ? <img src={x.image} alt="" className="h-full w-full object-cover" /> : x.icone}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-corps font-semibold">{x.titre}</span>
                  <span className="block truncate text-note text-brume">
                    {reste(x.at)} · {x.detail}
                  </span>
                </span>
              </button>
              <button onClick={() => remettre(x)} className="presse flex h-9 shrink-0 items-center rounded-full bg-teinte-doux px-3.5 text-note font-bold text-teinte-fonce">
                Remettre
              </button>
            </div>
          ))}
        </div>
      </section>
    )

  return (
    <Screen
      title="Supprimés récemment"
      leading={
        <button onClick={() => { tap(); onBack() }} className="presse verre flex h-11 items-center gap-0.5 rounded-full pl-1.5 pr-3.5 text-appel font-semibold" aria-label={`Retour : ${retour}`}>
          <ChevronLeft size={22} strokeWidth={2.4} className="shrink-0" />
          {retour}
        </button>
      }
      trailing={toutes.length > 0 ? <Rond label="Tout supprimer pour de bon" onClick={() => void toutEffacer()}><Trash2 size={18} /></Rond> : undefined}
    >
      <p className="-mt-1 mb-5 px-5 text-sous text-brume">Ce que tu supprimes reste ici 30 jours, puis s’efface pour de bon. Personne d’autre ne le voit.</p>
      {toutes.length === 0 ? (
        <div className="flex flex-col items-center px-8 pt-8 text-center">
          <img src="./art/stickers/panda-serein.webp" alt="" className="anim-flotte h-24 w-24 object-contain" />
          <p className="mt-3 font-rond text-titre3">Rien à remettre</p>
          <p className="mt-1 max-w-[290px] text-sous text-brume">Une publication, un souvenir ou un album supprimé t’attend ici pendant 30 jours.</p>
        </div>
      ) : (
        <>
          {partie('Publications', publications)}
          {partie('Albums', albums)}
          {partie('Dans les albums', souvenirs)}
        </>
      )}
    </Screen>
  )
}

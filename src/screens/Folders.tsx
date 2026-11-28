import { ProgressiveList } from '../components/listNavigation'
import {
  Check, ChevronLeft, ChevronRight, Ellipsis, FolderPlus, ImagePlus, Lock, Mic, Minus, NotebookPen, Plus, Video, Trash2, UsersRound, X,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { PhotoEditeur } from '../components/photoEditeur'
import { PhotosDuFil, SouvenirMedia } from '../components/folderSouvenirs'
import { FolderCover, MemberStack } from '../components/folder'
import { Art, Avatar, Btn, choisir, confirmer, Rond, Screen, SearchField, Sheet, Vide, ChampRequis, CHAMP_REQUIS } from '../components/ui'
import { contentLine, folderStats, membersOf, subtreeIds, whoText } from '../lib/folders'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { FamilyState, Folder, FolderItem } from '../lib/types'
import { ago, compressImage, errorText } from '../lib/util'

// Les albums (photos, notes, vocaux, vidéos), avec les proches de son choix. Ils vivent dans le fil depuis que le fil
// est devenu un fil d'actualité (Elisa, 27 novembre : « fusionner souvenirs et le fil ») : une bande d'albums en
// haut du fil, ce qu'on y ajoute dans le fil, et cette liste complète derrière « Tout voir ».

// ═════════════════════════ Tous les albums ═════════════════════════

export function AlbumsListe({ onOpen, onBack, onCorbeille }: { onOpen: (id: string) => void; onBack: () => void; onCorbeille?: () => void }) {
  const { state } = useHome()
  const nbJetes = (state.jetes?.moments.length ?? 0) + (state.jetes?.folderItems.length ?? 0) + (state.jetes?.folders.length ?? 0)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const roots = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.folders
      .map((f) => ({ f, s: folderStats(state.folders, state.folderItems, f) }))
      .filter(({ f }) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => b.s.last - a.s.last)
  }, [state.folders, state.folderItems, query])
  const total = state.folders.length

  return (
    <>
      <Screen
        title="Albums"
        leading={
          <button onClick={() => { tap(); onBack() }} className="presse verre flex h-11 items-center gap-0.5 rounded-full pl-1.5 pr-3.5 text-appel font-semibold" aria-label="Retour au fil">
            <ChevronLeft size={22} strokeWidth={2.4} className="shrink-0" />
            Le fil
          </button>
        }
        trailing={<Rond label="Nouvel album" tint onClick={() => setCreating(true)}><FolderPlus size={19} /></Rond>}
      >
        <p className="-mt-1 mb-4 px-5 text-sous text-brume">Photos, notes, dessins et vidéos, avec les proches de votre choix.</p>

        {total === 0 ? (
          <Vide art="picto-cadeau" title="Votre premier souvenir commence ici" text="Un album rassemble les souvenirs que tu choisis, avec les proches de ton choix. Les autres ne le voient pas.">
            <Btn onClick={() => setCreating(true)}>Créer un album</Btn>
          </Vide>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Rechercher un album" label="Rechercher un album" />
            <div className="mx-5 mb-4 flex items-center justify-between"><h2 className="font-rond text-titre2">{query ? 'Résultats' : 'Votre collection'}</h2><span className="text-note text-brume">{roots.length} album{roots.length > 1 ? 's' : ''}</span></div>
            {roots.length === 0 ? (
              <p className="px-8 py-10 text-center text-sous text-brume">Aucun album ne correspond à « {query.trim()} ».</p>
            ) : (
              <ProgressiveList key={query} items={roots} size={6}>{(pageRoots) => <div className="space-y-3 px-4">
                {pageRoots.map(({ f, s }) => (
                  <FolderCard key={f.id} folder={f} cover={s.cover} line={contentLine(s)} last={s.last} onOpen={() => onOpen(f.id)} />
                ))}

              </div>}</ProgressiveList>
            )}
          </>
        )}

        {/* comme dans Photos sur l'iPhone : ce qu'on a supprimé, gardé 30 jours */}
        {state.corbeille && onCorbeille && (
          <button onClick={() => { tap(); onCorbeille() }} className="presse mx-4 mt-6 flex min-h-[60px] w-[calc(100%-2rem)] items-center gap-3 rounded-[20px] bg-carte px-4 text-left shadow-carte">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte-fonce">
              <Trash2 size={19} strokeWidth={2.3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-corps font-semibold">Supprimés récemment</span>
              <span className="block text-note text-brume">Gardés 30 jours, puis effacés</span>
            </span>
            {nbJetes > 0 && <span className="text-sous font-semibold tabular-nums text-brume">{nbJetes}</span>}
            <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 text-pale" />
          </button>
        )}
      </Screen>
      {creating && <NewFolderSheet onClose={() => setCreating(false)} onCreated={onOpen} />}
    </>
  )
}

function FolderCard({ folder, cover, line, last, onOpen }: { folder: Folder; cover: string | null; line: string; last: number; onOpen: () => void }) {
  return (
    <button
      onClick={() => {
        tap()
        onOpen()
      }}
      className="presse relative block h-[180px] w-full overflow-hidden rounded-[24px] text-left shadow-carte"
    >
      <FolderCover folder={folder} url={cover} size="wide" />
      {cover && <span className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/60 via-black/20 to-transparent" />}
      <span className={`absolute left-4 right-[40%] bottom-4 ${cover ? 'text-white' : 'text-encre'}`}>
        <span className="line-clamp-2 font-rond text-titre2" style={cover ? { textShadow: '0 1px 8px rgba(0,0,0,0.25)' } : undefined}>{folder.name}</span>
        <span className={`block truncate text-legende ${cover ? 'text-white/85' : 'text-encre/65'}`}>{line}</span>
        <span className={`block truncate text-mini ${cover ? 'text-white/80' : 'text-encre/65'}`}>{ago(new Date(last).toISOString())}</span>
      </span>
    </button>
  )
}

// ═════════════════════════ Intérieur d'un dossier ═════════════════════════

type Open =
  | null
  | { k: 'note'; note?: FolderItem }
  | { k: 'membres' }
  | { k: 'renommer' }
  | { k: 'couverture' }
  | { k: 'photos' }
  | { k: 'media'; kind: 'audio' | 'video' }

const IL_RESTE = ' Tu pourras le remettre pendant 30 jours : Albums › Supprimés récemment.'

/** Retirer un souvenir d'un album : à la corbeille quand la base la connaît (30 jours pour le remettre), sinon effacé. */
function useRetirer() {
  const { state, run } = useHome()
  const corbeille = !!state.corbeille
  const retirer = (item: FolderItem, message: string) =>
    corbeille
      ? run(
          (api) => api.jeter('folder_items', item.id),
          message,
          (st: FamilyState) => ({
            ...st,
            folderItems: st.folderItems.filter((x) => x.id !== item.id),
            jetes: { moments: st.jetes?.moments ?? [], folders: st.jetes?.folders ?? [], folderItems: [{ ...item, deleted_at: new Date().toISOString(), deleted_by: st.me.id }, ...(st.jetes?.folderItems ?? [])] },
          }),
        )
      : run((api) => api.deleteFolderItem(item), message)
  return { retirer, apres: corbeille ? IL_RESTE : '' }
}

export function FolderView({ id, onBack, retour = 'Le fil' }: { id: string; onBack: () => void; retour?: string }) {
  const { retirer, apres } = useRetirer()
  const { state, run, toast } = useHome()
  const { me, members, folders, folderItems, folderMembers } = state
  const folder = folders.find((f) => f.id === id)!
  const root = folders.find((f) => f.id === folder.root_id) ?? folder
  const rootAdmin = !root.owner_id || root.owner_id === me.id
  const admin = rootAdmin || folder.owner_id === me.id
  const stats = folderStats(folders, folderItems, folder)

  const own = folderItems.filter((i) => i.folder_id === id)
  const photos = own.filter((i) => i.kind === 'photo').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const notes = own.filter((i) => i.kind === 'note' || i.kind === 'dessin').sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const [scrolled, setScrolled] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'tout' | 'photos' | 'notes' | 'audio' | 'video'>('tout')
  const [sheet, setSheet] = useState<Open>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [drawingViewer, setDrawingViewer] = useState<FolderItem | null>(null)
  const [editor, setEditor] = useState<{ file: File; kind: 'photo' | 'dessin' } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const heroText = useRef<HTMLDivElement>(null)

  const openEditor = async () => {
    if (preparing) return
    setPreparing(true)
    try {
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1200
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,900,1200)
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Impossible de préparer la feuille.')), 'image/jpeg'))
      setEditor({file:new File([blob],'souvenir.jpg',{type:blob.type}),kind:'dessin'})
    } catch (e) { toast(errorText(e),'err') } finally { setPreparing(false) }
  }
  const removeItem = async (item: FolderItem) => {
    const image = item.kind === 'photo'
    if (!(await confirmer({ title: image ? 'Retirer cette photo de l’album ?' : 'Retirer ce souvenir de l’album ?', message: (image ? 'La photo et son message restent dans le fil familial. Seule la copie de cet album est retirée.' : 'Il sera retiré pour toute la famille.') + apres, confirm:'Retirer de l’album',destructive:true }))) return
    await retirer(item, 'Souvenir retiré de l’album')
  }
  const add = async () => {
    const i = await choisir({ title:`Ajouter dans « ${folder.name} »`, actions:[{label:'Ajouter des photos'},{label:'Note écrite'},{label:'Note dessinée'},{label:'Vidéo souvenir'}] })
    if (i === 0) setSheet({k:'photos'})
    if (i === 1) setSheet({k:'note'})
    if (i === 2) void openEditor()
    if (i === 3) setSheet({k:'media',kind:'video'})
  }

  const remove = async () => {
    const corbeille = !!state.corbeille
    const ok = await confirmer({
      title: `Supprimer « ${folder.name} » ?`,
      message: corbeille ? 'Cet album et tout son contenu disparaissent pour tous les membres. Tu pourras le remettre pendant 30 jours : Albums › Supprimés récemment.' : 'Cet album et tout son contenu seront supprimés pour tous les membres.',
      confirm: 'Supprimer l’album',
      destructive: true,
    })
    if (!ok) return
    const fait = corbeille
      ? await run(
          (api) => api.jeter('folders', folder.id),
          'Album supprimé',
          (st: FamilyState) => ({
            ...st,
            folders: st.folders.filter((d) => d.id !== folder.id && d.root_id !== folder.id),
            folderItems: st.folderItems.filter((x) => x.root_id !== folder.id),
            jetes: { moments: st.jetes?.moments ?? [], folderItems: st.jetes?.folderItems ?? [], folders: [{ ...folder, deleted_at: new Date().toISOString(), deleted_by: st.me.id }, ...(st.jetes?.folders ?? [])] },
          }),
        )
      : await run((api) => api.deleteFolder(folder), 'Album supprimé')
    if (fait) onBack()
  }

  const leave = async () => {
    const ok = await confirmer({ title: `Quitter « ${root.name} » ?`, message: 'Tu ne le verras plus. Son créateur pourra te réinviter.', confirm: 'Quitter l’album', destructive: true })
    if (ok && (await run((api) => api.leaveFolder(root.id, me.id), 'Tu as quitté l’album'))) onBack()
  }

  const changeCover = async () => {
    const actions = [{ label: 'Choisir une photo' }, ...(stats.photos ? [{ label: 'Parmi les photos de l’album' }] : []), ...(folder.cover_path ? [{ label: 'Retirer la couverture', destructive: true }] : [])]
    const i = await choisir({ title: 'Couverture de l’album', actions })
    const label = actions[i]?.label
    if (label === 'Choisir une photo') coverInput.current?.click()
    if (label === 'Parmi les photos de l’album') setSheet({ k: 'couverture' })
    if (label === 'Retirer la couverture') void run((api) => api.setFolderCover(folder, null), 'Couverture retirée')
  }

  const menu = async () => {
    const actions: { label: string; destructive?: boolean; go: () => void }[] = [
      ...(admin ? [{ label: 'Renommer', go: () => setSheet({ k: 'renommer' }) }, { label: 'Changer la couverture', go: changeCover }] : []),
      ...(!folder.parent_id && root.owner_id !== me.id ? [{ label: 'Quitter l’album', destructive: true, go: leave }] : []),
      ...(admin ? [{ label: 'Supprimer l’album', destructive: true, go: remove }] : []),
    ]
    const i = await choisir({ actions })
    if (i >= 0) actions[i].go()
  }

  const media = own.filter(i => i.kind === 'audio' || i.kind === 'video').sort((a,b) => b.created_at.localeCompare(a.created_at))
  const empty = !photos.length && !notes.length && !media.length
  const normalise = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = normalise(query.trim())
  const matches = (...texts: (string | null | undefined)[]) => !q || texts.some(text => normalise(text ?? '').includes(q))
  const visiblePhotos = photos.filter(p => matches(p.body))
  const visibleMedia = media.filter(m => (filter === 'tout' || filter === m.kind) && matches(m.title,m.body))
  const visibleNotes = notes.filter(n => matches(n.title, n.body))
  const showPhotos = filter === 'tout' || filter === 'photos'
  const showNotes = filter === 'tout' || filter === 'notes'
  const hasResults = (showPhotos && visiblePhotos.length > 0) || (showNotes && visibleNotes.length > 0) || visibleMedia.length > 0
  // les filtres : « Tout », puis seulement les sortes de souvenirs que le dossier contient (et celui qu'on regarde)
  const filtres = ([
    { key: 'tout', label: 'Tout', n: 1 },
    { key: 'photos', label: 'Photos', n: photos.length },
    { key: 'notes', label: 'Notes', n: notes.length },
    { key: 'audio', label: 'Vocaux', n: media.filter((m) => m.kind === 'audio').length },
    { key: 'video', label: 'Vidéos', n: media.filter((m) => m.kind === 'video').length },
  ] as const).filter((t) => t.n > 0 || t.key === filter)
  const addCurrent = () => {
    if (filter === 'photos') setSheet({k:'photos'})
    else if (filter === 'notes') setSheet({ k: 'note' })
    // plus de nouveaux vocaux (27 novembre) : ceux déjà gardés s'écoutent toujours
    else if (filter === 'video') setSheet({k:'media',kind:'video'})
    else void add()
  }

  return (
    <>
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const blob = await compressImage(f, 1600, 0.82)
            await run((api) => api.setFolderCover(folder, { blob }), 'Couverture mise à jour')
          } catch (err) {
            toast(errorText(err), 'err')
          }
        }}
      />

      <div className="relative h-full">
        {/* barre du haut : boutons en verre sur la couverture, puis barre floutée au défilement */}
        <div
          className={`ios-topbar absolute inset-x-0 top-0 z-20 transition-[background-color,backdrop-filter,border-color] duration-200 ${scrolled ? 'ios-toolbar-active' : 'border-b border-transparent'}`}
          style={{ paddingTop: 'var(--sat)' }}
        >
          <div className="relative flex h-[52px] items-center justify-between px-4">
            <button
              onClick={() => {
                tap()
                onBack()
              }}
              className="presse verre flex h-11 max-w-[40%] items-center gap-0.5 rounded-full pl-1.5 pr-3.5 text-appel font-semibold"
              aria-label={`Retour : ${retour}`}
            >
              <ChevronLeft size={22} strokeWidth={2.4} className="shrink-0" />
              <span className="truncate">{retour}</span>
            </button>
            <p className={`pointer-events-none absolute inset-x-[34%] truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{folder.name}</p>
            <div className="flex items-center gap-2">
              <Rond label="Options de l’album" onClick={menu}><Ellipsis size={20} /></Rond>
              <button onClick={add} className="presse glass-tinted flex min-h-11 items-center gap-1 rounded-full pl-2.5 pr-3.5 text-sous font-semibold text-white"><Plus size={19} />Ajouter</button>
            </div>
          </div>
        </div>

        <div className="no-bar h-full overflow-y-auto overscroll-contain pb-[120px]" onScroll={(e) => {
            const y = e.currentTarget.scrollTop
            setScrolled(y > 110)
            if (heroText.current) heroText.current.style.opacity = String(Math.max(0, 1 - y / 100))
          }}>
          {/* couverture */}
          <div className="relative w-full overflow-hidden" style={{ height: 'calc(var(--sat) + 210px)' }}>
            <FolderCover folder={folder} url={stats.cover} size="lg" />
            {stats.cover && <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/25" />}
            <div ref={heroText} className={`absolute bottom-7 left-5 ${stats.cover ? 'right-5 text-white' : 'right-[40%] text-encre'}`}>
              <h1 className="break-words font-rond text-titre1" style={stats.cover ? { textShadow: '0 2px 16px rgba(0,0,0,0.25)' } : undefined}>{folder.name}</h1>
              <p className={`mt-0.5 text-sous ${stats.cover ? 'text-white/85' : 'text-encre/65'}`}>{contentLine({ ...stats, photos: photos.length, notes: notes.length, subfolders: 0, audios: media.filter(m => m.kind === 'audio').length, videos: media.filter(m => m.kind === 'video').length })}</p>
            </div>
          </div>

          <div className="relative -mt-5 rounded-t-[28px] bg-fond pb-4 pt-3">

            {!empty && <>
              <div className="mx-4 mt-4"><SearchField value={query} onChange={setQuery} placeholder="Rechercher dans cet album" /></div>
              {/* les filtres : seulement ce que le dossier contient (le nombre est dit sous son nom, en haut), et
                  aucun s'il n'y a qu'une sorte de souvenirs */}
              {(filtres.length > 2 || filter !== 'tout') && (
                <div className="no-bar mt-3 flex gap-1 overflow-x-auto px-4 pb-1" role="group" aria-label="Afficher le contenu">
                  {filtres.map(t => <button key={t.key} onClick={e => { tap(); setFilter(t.key); e.currentTarget.scrollIntoView({inline:'nearest',block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}) }} aria-pressed={filter === t.key} className={`presse flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-note font-semibold ${filter === t.key ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}>{t.label}</button>)}
                </div>
              )}
            </>}

            {preparing && <p role="status" className="mx-4 mt-3 rounded-[14px] bg-teinte-doux p-3 text-sous text-teinte-fonce">Préparation de l’image…</p>}

            {!hasResults && (q || filter !== 'photos') && <div className="px-5 py-7 text-center">
              <Art name={filter === 'notes' ? 'picto-missions' : 'picto-photo'} size={64} className="mx-auto" />
              <h2 className="mt-3 font-rond text-titre2">{q ? 'Aucun résultat' : filter === 'notes' ? 'Ta première note' : filter === 'audio' ? 'Une histoire à écouter' : filter === 'video' ? 'Un moment à regarder' : filter === 'photos' ? 'Vos photos auront leur place ici' : 'Vos souvenirs commencent ici'}</h2>
              <p className="mx-auto mt-2 max-w-[290px] text-sous text-brume">{q ? 'Essaie un autre mot ou retrouve tout le contenu de l’album.' : 'Photos du téléphone ou du fil, notes écrites ou dessinées, vidéos : garde ici ce qui compte.'}</p>
              {q ? <button onClick={() => { setQuery(''); setFilter('tout') }} className="presse mt-4 min-h-11 text-sous font-semibold text-teinte-fonce">Effacer la recherche</button> : <Btn className="mt-5" onClick={addCurrent}>{filter === 'photos' ? 'Ajouter des photos' : filter === 'notes' ? 'Écrire une note' : filter === 'video' ? 'Ajouter une vidéo' : 'Ajouter mon premier souvenir'}</Btn>}
            </div>}

            {/* les photos : dans « Tout », seulement s'il y en a (« Ajouter », en haut, sert à en mettre) */}
            {showPhotos && (visiblePhotos.length > 0 || (filter === 'photos' && !q)) && <Bloc title="Photos">
              {!visiblePhotos.length && <p className="-mt-1 mb-3 px-5 text-note text-brume">Ajoute des photos depuis ton téléphone ou le fil familial.</p>}
              <ProgressiveList key={query + filter + id + 'photos'} items={visiblePhotos} size={12}>{(pagePhotos) => <div className="mx-4 grid grid-cols-3 gap-2">
                {pagePhotos.map(p => <div key={p.id} className="relative aspect-square overflow-hidden rounded-[16px] bg-remplissage">
                  <button onClick={() => setViewer(photos.indexOf(p))} className="absolute inset-0 h-full w-full" aria-label={p.body ?? 'Ouvrir la photo'}>{p.image_url && <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</button>
                  {(admin || p.author_id === me.id) && <button onClick={() => void removeItem(p)} className="presse absolute right-0 top-0 flex h-11 w-11 items-center justify-center" aria-label="Retirer cette photo de l’album"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rouge shadow-carte"><Minus size={17} /></span></button>}
                </div>)}
                {!q && !visiblePhotos.length && <button onClick={() => setSheet({k:'photos'})} className="presse flex aspect-square flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-teinte/30 bg-teinte-doux text-teinte-fonce" aria-label="Ajouter des photos"><Plus size={28} /><span className="text-note font-semibold">Ajouter</span></button>}
              </div>}</ProgressiveList>
            </Bloc>}

            {showNotes && visibleNotes.length > 0 && <Bloc title="Notes">
              <ProgressiveList key={query + filter + id + 'notes'} items={visibleNotes} size={5}>{(pageNotes) => <div className="space-y-2 px-4">{pageNotes.map(n => {
                const by = members.find(m => m.id === n.author_id)
                return <button key={n.id} onClick={() => { tap(); n.kind === 'dessin' ? setDrawingViewer(n) : setSheet({ k:'note', note:n }) }} className="presse flex w-full items-start gap-3 rounded-[20px] bg-carte p-4 text-left shadow-carte">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#FFF5D7] text-[#AD7A13]">{n.kind === 'dessin' && n.image_url ? <img src={n.image_url} alt="" className="h-full w-full rounded-[12px] object-cover" /> : <NotebookPen size={20} />}</span>
                  <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-corps font-semibold">{n.title || (n.kind === 'dessin' ? 'Note dessinée' : 'Note sans titre')}</span><span className="mt-1 line-clamp-2 block whitespace-pre-line text-sous text-brume">{n.body}</span><span className="mt-2 flex items-center gap-1.5 text-note text-brume">{by && <Avatar m={by} size={18} />}<span className="truncate">{by?.display_name ?? 'Un proche'} · {ago(n.updated_at)}</span></span></span>
                  <ChevronRight size={16} className="mt-2 shrink-0 text-brume" />
                </button>
              })}</div>}</ProgressiveList>
            </Bloc>}
            {(['audio','video'] as const).map(kind => { const entries = visibleMedia.filter(m => m.kind === kind); return entries.length > 0 && <Bloc key={kind} title={kind === 'audio' ? 'À écouter' : 'Vidéos'}>
              <ProgressiveList key={query + filter + id + kind} items={entries} size={5}>{(pageMedia) => <div className="space-y-3 px-4">{pageMedia.map(m => <div key={m.id} className="rounded-[22px] bg-carte p-4 shadow-carte">
                <div className="mb-3 flex items-center gap-2.5">{m.kind === 'audio' ? <Mic size={21} className="shrink-0 text-teinte" /> : <Video size={21} className="shrink-0 text-teinte" />}<span className="min-w-0 flex-1 truncate text-corps font-semibold">{m.title || (m.kind === 'audio' ? 'Un souvenir vocal' : 'Un souvenir vidéo')}</span>{(admin || m.author_id === me.id) && <button onClick={() => void removeItem(m)} aria-label={`Retirer ${m.title || 'ce souvenir'}`} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-remplissage text-rouge"><Minus size={19} /></button>}</div>
                {m.media_url ? m.kind === 'audio' ? <audio src={m.media_url} controls preload="metadata" className="w-full" /> : <video src={m.media_url} controls playsInline preload="metadata" className="max-h-[320px] w-full rounded-[14px] bg-black" /> : <p className="text-sous text-brume">Ce souvenir ne peut pas être chargé. Réessaie dans un instant.</p>}
                <p className="mt-2 text-note text-brume">Ajouté par {members.find(member => member.id === m.author_id)?.display_name ?? 'un proche'} · {ago(m.created_at)}</p>
              </div>)}</div>}</ProgressiveList>
            </Bloc> })}

          </div>
        </div>

      </div>

      {viewer !== null && photos.length > 0 && (
        <PhotoViewer photos={photos} start={Math.min(viewer, photos.length - 1)} folder={folder} admin={admin} onClose={() => setViewer(null)} />
      )}
      {drawingViewer && <PhotoViewer photos={[drawingViewer]} start={0} folder={folder} admin={admin} onClose={() => setDrawingViewer(null)} />}
      {sheet?.k === 'photos' && <PhotosDuFil folder={folder} onClose={() => setSheet(null)} onSaved={() => { setQuery(''); setFilter('photos') }} />}
      {sheet?.k === 'media' && <SouvenirMedia folder={folder} kind={sheet.kind} onClose={() => setSheet(null)} onSaved={() => { setQuery(''); if (sheet.k === 'media') setFilter(sheet.kind) }} />}
      {editor && <PhotoEditeur file={editor.file} initialDrawing={editor.kind === 'dessin'} initialCaption="" title={editor.kind === 'dessin' ? 'Une note dessinée' : 'Décorer la photo'} confirmLabel="Enregistrer dans l’album" onClose={() => setEditor(null)} onSend={async (blob, caption) => {
        const ok = await run(api => api.addFolderItem(folder,me.id,{kind:'dessin',blob,title:caption || 'Note dessinée'}),'Souvenir enregistré')
        if (!ok) throw new Error('Ton image n’a pas été enregistrée. Réessaie.')
        setQuery(''); setFilter(editor.kind === 'dessin' ? 'notes' : 'photos'); setEditor(null)
      }} />}
      {sheet?.k === 'note' && <NoteSheet folder={folder} note={sheet.note} admin={admin} onClose={() => setSheet(null)} onSaved={() => { setQuery(''); setFilter('notes') }} />}
      {sheet?.k === 'renommer' && <RenameSheet folder={folder} onClose={() => setSheet(null)} />}
      {sheet?.k === 'couverture' && <CoverPicker folder={folder} onClose={() => setSheet(null)} />}
    </>
  )
}

/** Une partie du dossier (Photos, Notes…) : son titre seul, le nombre est déjà sous le nom de l’album. */
function Bloc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline gap-2 px-5">
        <h3 className="font-rond text-titre3">{title}</h3>
      </div>
      {children}
    </section>
  )
}

// ═════════════════════════ Visionneuse ═════════════════════════

function PhotoViewer({ photos, start, admin, onClose }: { photos: FolderItem[]; start: number; folder: Folder; admin: boolean; onClose: () => void }) {
  const { retirer, apres } = useRetirer()
  const { state } = useHome()
  const [i, setI] = useState(start)
  const [dx, setDx] = useState(0)
  const from = useRef<number | null>(null)
  const idx = Math.min(i, photos.length - 1)
  const p = photos[idx]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      if (e.key === 'ArrowRight') setI((n) => Math.min(photos.length - 1, n + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, photos.length])
  if (!p) return null
  const by = state.members.find((m) => m.id === p.author_id)
  const mine = p.author_id === state.me.id

  const actions = async () => {
    const list = mine || admin ? [{ label: 'Retirer de l’album', destructive: true }] : []
    if (!list.length) return
    const k = await choisir({ actions: list })
    const label = list[k]?.label
    if (label === 'Retirer de l’album' && (await confirmer({ title: 'Retirer ce souvenir de l’album ?', message: 'Le fil familial reste inchangé.' + apres, confirm: 'Retirer de l’album', destructive: true }))) {
      if (photos.length === 1) onClose()
      await retirer(p, 'Souvenir retiré de l’album')
    }
  }

  return (
    <div
      className="anim-fondu absolute inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onPointerDown={(e) => (from.current = e.clientX)}
      onPointerMove={(e) => from.current !== null && setDx(e.clientX - from.current)}
      onPointerUp={() => {
        if (dx < -60) setI((n) => Math.min(photos.length - 1, n + 1))
        if (dx > 60) setI((n) => Math.max(0, n - 1))
        from.current = null
        setDx(0)
      }}
      onPointerCancel={() => ((from.current = null), setDx(0))}
    >
      <div className="flex items-center justify-between px-4" style={{ paddingTop: 'calc(var(--sat) + 8px)' }}>
        {mine || admin ? (
          <button onClick={actions} className="presse flex h-11 w-11 items-center justify-center rounded-full bg-white/15" aria-label="Options de la photo">
            <Ellipsis size={20} />
          </button>
        ) : (
          <span className="w-11" />
        )}
        <span className="text-sous font-semibold text-white/80">{idx + 1} sur {photos.length}</span>
        <button onClick={onClose} className="presse flex h-11 w-11 items-center justify-center rounded-full bg-white/15" aria-label="Fermer">
          <X size={20} strokeWidth={2.6} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {p.image_url && (
          <img
            key={p.id}
            src={p.image_url}
            alt={p.body ?? ''}
            draggable={false}
            className="anim-fondu absolute inset-0 h-full w-full select-none object-contain"
            style={{ transform: `translateX(${dx}px)`, transition: from.current === null ? 'transform 0.25s var(--ressort)' : 'none' }}
          />
        )}
      </div>
      <div className="flex items-center gap-3 px-5 pt-3" style={{ paddingBottom: 'calc(var(--sab) + 18px)' }}>
        {by && <Avatar m={by} size={36} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sous font-semibold">{mine ? 'Toi' : (by?.display_name ?? 'Ancien membre')}</p>
          <p className="truncate text-note text-white/65">{ago(p.created_at)}</p>
        </div>
        {photos.length > 1 && (
          <div className="flex gap-1">
            <button disabled={idx === 0} onClick={() => setI(idx - 1)} className="presse flex h-10 w-10 items-center justify-center rounded-full bg-white/15 disabled:opacity-30" aria-label="Photo précédente">
              <ChevronLeft size={20} />
            </button>
            <button disabled={idx === photos.length - 1} onClick={() => setI(idx + 1)} className="presse flex h-10 w-10 items-center justify-center rounded-full bg-white/15 disabled:opacity-30" aria-label="Photo suivante">
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
      {p.body && <p className="px-5 pb-4 text-corps text-white/90">{p.body}</p>}
    </div>
  )
}

// ═════════════════════════ Feuilles ═════════════════════════

function NoteSheet({ folder, note, admin, onClose, onSaved }: { folder: Folder; note?: FolderItem; admin: boolean; onClose: () => void; onSaved: () => void }) {
  const { retirer, apres } = useRetirer()
  const { state, run } = useHome()
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [busy, setBusy] = useState(false)
  const by = note && state.members.find((m) => m.id === note.author_id)
  const changed = title !== (note?.title ?? '') || body !== (note?.body ?? '')

  const save = async () => {
    if (busy || (!title.trim() && !body.trim())) return
    setBusy(true)
    const ok = note
      ? await run((api) => api.updateFolderItem(note.id, { title: title || null, body: body || null }), 'Note enregistrée')
      : await run((api) => api.addFolderItem(folder, state.me.id, { kind: 'note', title, body }), 'Note ajoutée')
    setBusy(false)
    if (ok) {
      success()
      onSaved()
      onClose()
    }
  }

  return (
    <Sheet title={note ? 'Note' : 'Nouvelle note'} onClose={() => { if (!busy) onClose() }} tall footer={<Btn onClick={save} disabled={busy || (!title.trim() && !body.trim()) || (!!note && !changed)}>{busy ? 'Enregistrement…' : note ? 'Enregistrer' : 'Ajouter la note'}</Btn>}>
      <div className="groupe flex flex-col p-4">
        <input className="bg-transparent font-rond text-titre2 outline-none placeholder:text-pale" placeholder="Titre" aria-label="Titre de la note" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!note} />
        <textarea
          className="mt-2 min-h-[34vh] flex-1 resize-none bg-transparent text-corps leading-[24px] outline-none placeholder:text-pale"
          placeholder="Liste, idée, recette, adresse…" aria-label="Contenu de la note"
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {note && (
        <p className="flex items-center gap-1.5 px-2 pt-2 text-note text-brume">
          {by && <Avatar m={by} size={18} />}
          {by ? (by.id === state.me.id ? 'Créée par toi' : `Créée par ${by.display_name}`) : 'Note'} · modifiée {ago(note.updated_at)}
        </p>
      )}
      <p className="px-2 pt-1 text-note text-brume">Toute la famille peut la lire et la modifier.</p>
      {note && (note.author_id === state.me.id || admin) && (
        <Btn
          kind="gris"
          className="mt-2 [&>button]:!text-rouge"
          onClick={async () => {
            if (!(await confirmer({ title: 'Supprimer cette note ?', message: 'Elle disparaîtra pour tous les membres.' + apres.replace('le remettre', 'la remettre'), confirm: 'Supprimer', destructive: true }))) return
            if (await retirer(note, 'Note supprimée')) onClose()
          }}
        >
          <Trash2 size={17} /> Supprimer la note
        </Btn>
      )}
    </Sheet>
  )
}

/** Création d’un dossier indépendant. */
export function NewFolderSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { state, run, toast } = useHome()
  const { me, members, family } = state
  const [name, setName] = useState('')
  const nameId = useId()
  const [cover, setCover] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const others = members.filter((m) => m.id !== me.id)

  const create = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    let id = ''
    const ok = await run(async (api) => {
      id = await api.createFolder(family.id, { name: name.trim(), parentId: null, memberIds: others.map((m) => m.id) })
      if (cover) {
        const now = new Date().toISOString()
        const made: Folder = { id, family_id: family.id, parent_id: null, root_id: id, owner_id: me.id, name, cover_path: null, created_at: now, updated_at: now }
        await api.setFolderCover(made, { blob: cover })
      }
    })
    setBusy(false)
    if (ok && id) {
      success()
      onClose()
      onCreated(id)
    }
  }

  return (
    <Sheet title={'Nouvel album'} onClose={onClose} footer={<Btn onClick={create} disabled={busy} manque={!name.trim() ? 'le nom de l’album' : null} onManque={() => document.querySelector<HTMLInputElement>('[role=dialog] input')?.focus()}>{busy ? 'Création…' : 'Créer l’album'}</Btn>}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            setCover(await compressImage(f, 1600, 0.82))
          } catch (err) {
            toast(errorText(err), 'err')
          }
        }}
      />

      <ChampRequis id={nameId} label="Nom de l’album" aide="Toute la famille le verra et pourra y ajouter des souvenirs." className="mb-5">
        <input id={nameId} required aria-describedby={`${nameId}-aide`} className={CHAMP_REQUIS} placeholder="Ex. : Vacances en famille" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </ChampRequis>

      {(
        <button onClick={() => input.current?.click()} className="presse relative block aspect-[16/6] w-full overflow-hidden rounded-[22px] text-left shadow-carte">
          {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <FolderCover folder={{ id: name || 'nouveau', name: name || '·' }} url={null} size="md" />}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="verre absolute bottom-3 left-3 flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sous font-semibold text-encre">
            <ImagePlus size={17} strokeWidth={2.3} /> {cover ? 'Changer la couverture' : 'Couverture · facultative'}
          </span>
        </button>
      )}

    </Sheet>
  )
}

function RenameSheet({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const { run } = useHome()
  const [name, setName] = useState(folder.name)
  return (
    <Sheet title="Renommer" onClose={onClose}>
      <ChampRequis id="renommer-dossier" label="Nom de l’album" aide="Les proches qui y ont accès verront le nouveau nom.">
        <input id="renommer-dossier" required aria-describedby="renommer-dossier-aide" className={CHAMP_REQUIS} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </ChampRequis>
      <Btn className="mt-4" disabled={!name.trim() || name.trim() === folder.name} onClick={async () => (await run((api) => api.renameFolder(folder.id, name), 'Album renommé')) && onClose()}>
        Enregistrer
      </Btn>
    </Sheet>
  )
}

function CoverPicker({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const { state, run } = useHome()
  const ids = subtreeIds(state.folders, folder.id)
  const photos = state.folderItems.filter((i) => i.kind === 'photo' && ids.has(i.folder_id)).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Sheet title="Choisir la couverture" onClose={onClose} tall>
      <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-[20px]">
        {photos.map((p) => (
          <button
            key={p.id}
            onClick={async () => p.image_path && (await run((api) => api.setFolderCover(folder, { path: p.image_path! }), 'Couverture mise à jour')) && onClose()}
            className="relative aspect-square bg-remplissage"
            aria-label="Utiliser cette photo"
          >
            {p.image_url && <img src={p.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            {folder.cover_path === p.image_path && (
              <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-teinte text-white ring-2 ring-white">
                <Check size={14} strokeWidth={3.2} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

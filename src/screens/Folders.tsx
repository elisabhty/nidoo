import {
  Check, ChevronLeft, ChevronRight, Ellipsis, FolderPlus, ImagePlus, Lock, NotebookPen, Plus, Search, Trash2, UsersRound, X,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { FolderCover, MemberStack } from '../components/folder'
import { Art, Avatar, Btn, choisir, confirmer, Rond, Screen, SearchField, Sheet, Vide } from '../components/ui'
import { contentLine, folderStats, membersOf, plural, subtreeIds, whoText } from '../lib/folders'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Folder, FolderItem } from '../lib/types'
import { ago, compressImage, errorText } from '../lib/util'

// Souvenirs : les albums (dossiers de photos et notes). Le fil familial a son propre onglet.

// ═════════════════════════ L'onglet ═════════════════════════

export default function Dossiers() {
  const { state } = useHome()
  const [path, setPath] = useState<string[]>([])
  // Un dossier supprimé, ou dont on a été retiré, disparaît du chemin.
  const cut = path.findIndex((id) => !state.folders.some((f) => f.id === id))
  const live = cut === -1 ? path : path.slice(0, cut)
  useEffect(() => {
    if (live.length !== path.length) setPath(live)
  }, [live.length, path.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = live[live.length - 1]
  if (current) {
    const parent = state.folders.find((f) => f.id === live[live.length - 2])
    return (
      <FolderView
        key={current}
        id={current}
        backLabel={parent?.name ?? 'Souvenirs'}
        onBack={() => setPath(live.slice(0, -1))}
        onOpen={(id) => setPath([...live, id])}
      />
    )
  }
  return <Accueil onOpen={(id) => setPath([id])} />
}

// ═════════════════════════ Liste des dossiers ═════════════════════════

function Accueil({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useHome()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const roots = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.folders
      .filter((f) => !f.parent_id)
      .map((f) => ({ f, s: folderStats(state.folders, state.folderItems, f) }))
      .filter(({ f }) => !q || [...subtreeIds(state.folders, f.id)].some((id) => state.folders.find((d) => d.id === id)?.name.toLowerCase().includes(q)))
      .sort((a, b) => b.s.last - a.s.last)
  }, [state.folders, state.folderItems, query])
  const total = state.folders.filter((f) => !f.parent_id).length

  return (
    <>
      <Screen
        title="Souvenirs"
        trailing={<Rond label="Nouvel album" tint onClick={() => setCreating(true)}><FolderPlus size={19} /></Rond>}
      >
        <p className="-mt-1 mb-4 px-5 text-sous text-brume">Vos albums : photos et notes, avec les proches de votre choix.</p>

        {total === 0 ? (
          <Vide art="picto-cadeau" title="Votre premier souvenir commence ici" text="Un dossier rassemble photos et notes, avec les proches de ton choix. Les autres ne le voient pas.">
            <Btn onClick={() => setCreating(true)}>Créer un dossier</Btn>
          </Vide>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Rechercher un album" label="Rechercher un dossier" />
            <div className="mx-5 mb-4 flex items-center justify-between"><h2 className="font-rond text-titre2">{query ? 'Résultats' : 'Votre collection'}</h2><span className="text-note text-brume">{roots.length} dossier{roots.length > 1 ? 's' : ''}</span></div>
            {roots.length === 0 ? (
              <p className="px-8 py-10 text-center text-sous text-brume">Aucun dossier ne correspond à « {query.trim()} ».</p>
            ) : (
              <div className="space-y-3 px-4">
                {roots.map(({ f, s }) => (
                  <FolderCard key={f.id} folder={f} cover={s.cover} line={contentLine(s)} last={s.last} onOpen={() => onOpen(f.id)} />
                ))}

              </div>
            )}
          </>
        )}
      </Screen>
      {creating && <NewFolderSheet onClose={() => setCreating(false)} onCreated={onOpen} />}
    </>
  )
}

function FolderCard({ folder, cover, line, last, onOpen }: { folder: Folder; cover: string | null; line: string; last: number; onOpen: () => void }) {
  const { state } = useHome()
  const ids = membersOf(state.folderMembers, folder.id)
  const solo = ids.length <= 1
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
      <span className="absolute left-2.5 top-2.5">
        {solo ? (
          <span className="verre flex h-7 items-center gap-1 rounded-full px-2.5 text-legende font-semibold text-encre">
            <Lock size={12} strokeWidth={2.6} /> Juste toi
          </span>
        ) : (
          <span className="verre flex h-8 items-center rounded-full py-1 pl-1 pr-1">
            <MemberStack ids={ids} size={24} max={3} ring="rgba(255,255,255,0.9)" />
          </span>
        )}
      </span>
      <span className={`absolute left-4 right-[40%] bottom-4 ${cover ? 'text-white' : 'text-encre'}`}>
        <span className="line-clamp-2 font-rond text-titre2" style={cover ? { textShadow: '0 1px 8px rgba(0,0,0,0.25)' } : undefined}>{folder.name}</span>
        <span className={`block truncate text-legende ${cover ? 'text-white/85' : 'text-encre/65'}`}>{line}</span>
        <span className={`block truncate text-mini ${cover ? 'text-white/70' : 'text-encre/50'}`}>{ago(new Date(last).toISOString())}</span>
      </span>
    </button>
  )
}

// ═════════════════════════ Intérieur d'un dossier ═════════════════════════

type Open =
  | null
  | { k: 'note'; note?: FolderItem }
  | { k: 'sous-dossier' }
  | { k: 'membres' }
  | { k: 'renommer' }
  | { k: 'couverture' }

function FolderView({ id, backLabel, onBack, onOpen }: { id: string; backLabel: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { state, run, toast } = useHome()
  const { me, members, folders, folderItems, folderMembers } = state
  const folder = folders.find((f) => f.id === id)!
  const root = folders.find((f) => f.id === folder.root_id) ?? folder
  const memberIds = membersOf(folderMembers, root.id)
  const rootAdmin = !root.owner_id || root.owner_id === me.id
  const admin = rootAdmin || folder.owner_id === me.id
  const stats = folderStats(folders, folderItems, folder)

  const children = folders.filter((f) => f.parent_id === id).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const own = folderItems.filter((i) => i.folder_id === id)
  const photos = own.filter((i) => i.kind === 'photo').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const notes = own.filter((i) => i.kind === 'note').sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const [scrolled, setScrolled] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'tout' | 'photos' | 'notes' | 'dossiers'>('tout')
  const [sheet, setSheet] = useState<Open>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [sending, setSending] = useState(0)
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const heroText = useRef<HTMLDivElement>(null)

  // Ancêtres pour le fil d'Ariane : « Recettes de Mamie / Desserts »
  const crumbs: Folder[] = []
  for (let p = folders.find((f) => f.id === folder.parent_id); p; p = folders.find((f) => f.id === p!.parent_id)) crumbs.unshift(p)


  const addPhotos = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, 20)
    if (!list.length) return
    setSending(list.length)
    const ok = await run(async (api) => {
      for (const f of list) {
        await api.addFolderItem(folder, me.id, { kind: 'photo', blob: await compressImage(f, 1600, 0.82) })
        setSending((n) => n - 1)
      }
    }, list.length > 1 ? `${list.length} photos ajoutées` : 'Photo ajoutée')
    setSending(0)
    if (ok) { setQuery(''); setFilter('photos') }
  }

  const add = async () => {
    const i = await choisir({
      title: `Ajouter dans « ${folder.name} »`,
      actions: [{ label: 'Prendre une photo' }, { label: 'Choisir des photos' }, { label: 'Nouvelle note' }, { label: 'Nouveau sous-dossier' }],
    })
    if (i === 0) camera.current?.click()
    if (i === 1) gallery.current?.click()
    if (i === 2) setSheet({ k: 'note' })
    if (i === 3) setSheet({ k: 'sous-dossier' })
  }

  const remove = async () => {
    const ok = await confirmer({
      title: `Supprimer « ${folder.name} » ?`,
      message: 'Ce dossier et tout son contenu seront supprimés pour tous les membres.',
      confirm: 'Supprimer le dossier',
      destructive: true,
    })
    if (ok && (await run((api) => api.deleteFolder(folder), 'Dossier supprimé'))) onBack()
  }

  const leave = async () => {
    const ok = await confirmer({ title: `Quitter « ${root.name} » ?`, message: 'Tu ne le verras plus. Son créateur pourra te réinviter.', confirm: 'Quitter le dossier', destructive: true })
    if (ok && (await run((api) => api.leaveFolder(root.id, me.id), 'Tu as quitté le dossier'))) onBack()
  }

  const changeCover = async () => {
    const actions = [{ label: 'Choisir une photo' }, ...(stats.photos ? [{ label: 'Parmi les photos du dossier' }] : []), ...(folder.cover_path ? [{ label: 'Retirer la couverture', destructive: true }] : [])]
    const i = await choisir({ title: 'Couverture du dossier', actions })
    const label = actions[i]?.label
    if (label === 'Choisir une photo') coverInput.current?.click()
    if (label === 'Parmi les photos du dossier') setSheet({ k: 'couverture' })
    if (label === 'Retirer la couverture') void run((api) => api.setFolderCover(folder, null), 'Couverture retirée')
  }

  const menu = async () => {
    const actions: { label: string; destructive?: boolean; go: () => void }[] = [
      ...(admin ? [{ label: 'Renommer', go: () => setSheet({ k: 'renommer' }) }, { label: 'Changer la couverture', go: changeCover }] : []),
      { label: rootAdmin ? 'Gérer les membres' : 'Voir les membres', go: () => setSheet({ k: 'membres' }) },
      ...(!folder.parent_id && root.owner_id !== me.id ? [{ label: 'Quitter le dossier', destructive: true, go: leave }] : []),
      ...(admin ? [{ label: 'Supprimer le dossier', destructive: true, go: remove }] : []),
    ]
    const i = await choisir({ actions })
    if (i >= 0) actions[i].go()
  }

  const empty = !children.length && !photos.length && !notes.length
  const normalise = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = normalise(query.trim())
  const matches = (...texts: (string | null | undefined)[]) => !q || texts.some(text => normalise(text ?? '').includes(q))
  const visibleChildren = children.filter(c => matches(c.name))
  const visiblePhotos = photos.filter(p => matches(p.body))
  const visibleNotes = notes.filter(n => matches(n.title, n.body))
  const showFolders = filter === 'tout' || filter === 'dossiers'
  const showPhotos = filter === 'tout' || filter === 'photos'
  const showNotes = filter === 'tout' || filter === 'notes'
  const hasResults = (showFolders && visibleChildren.length > 0) || (showPhotos && visiblePhotos.length > 0) || (showNotes && visibleNotes.length > 0)
  const addCurrent = () => {
    if (filter === 'photos') gallery.current?.click()
    else if (filter === 'notes') setSheet({ k: 'note' })
    else if (filter === 'dossiers') setSheet({ k: 'sous-dossier' })
    else void add()
  }

  return (
    <>
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => void addPhotos(e.target.files).then(() => (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void addPhotos(e.target.files).then(() => (e.target.value = ''))} />
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
              aria-label={`Retour à ${backLabel}`}
            >
              <ChevronLeft size={22} strokeWidth={2.4} className="shrink-0" />
              <span className="truncate">{backLabel}</span>
            </button>
            <p className={`pointer-events-none absolute inset-x-[34%] truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{folder.name}</p>
            <div className="flex items-center gap-2">
              <Rond label="Options du dossier" onClick={menu}><Ellipsis size={20} /></Rond>
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
              {crumbs.length > 0 && <p className={`mb-0.5 truncate text-note font-medium ${stats.cover ? 'text-white/80' : 'text-encre/60'}`}>{crumbs.map((c) => c.name).join(' / ')}</p>}
              <h1 className="break-words font-rond text-titre1" style={stats.cover ? { textShadow: '0 2px 16px rgba(0,0,0,0.25)' } : undefined}>{folder.name}</h1>
              <p className={`mt-0.5 text-sous ${stats.cover ? 'text-white/85' : 'text-encre/65'}`}>{contentLine({ ...stats, photos: photos.length, notes: notes.length, subfolders: children.length })}</p>
            </div>
          </div>

          <div className="relative -mt-5 rounded-t-[28px] bg-fond pb-4 pt-3">
            <button onClick={() => { tap(); setSheet({ k: 'membres' }) }} className="presse mx-5 flex min-h-[52px] w-[calc(100%-2.5rem)] items-center gap-2.5 border-b border-trait pb-3 text-left" aria-label={`Accès au dossier : ${whoText(memberIds, me.id, members)}`}>
              {memberIds.length <= 1 ? <Lock size={18} className="shrink-0 text-teinte" /> : <MemberStack ids={memberIds} size={28} max={3} />}
              <span className="min-w-0 flex-1"><span className="block truncate text-sous font-semibold">{whoText(memberIds, me.id, members)}</span><span className="block text-note text-brume">{memberIds.length <= 1 ? 'Dossier privé' : 'Partagé avec ces proches uniquement'}</span></span>
              <ChevronRight size={16} className="shrink-0 text-brume" />
            </button>

            {!empty && <>
              <div className="mx-4 mt-4"><SearchField value={query} onChange={setQuery} placeholder="Rechercher dans ce dossier" /></div>
              <div className="no-bar mt-3 flex gap-1 overflow-x-auto px-4 pb-1" role="group" aria-label="Afficher le contenu">
                {([{key:'tout',label:'Tout',count:own.filter(i => i.kind !== 'message').length + children.length},{key:'photos',label:'Photos',count:photos.length},{key:'notes',label:'Notes',count:notes.length},{key:'dossiers',label:'Dossiers',count:children.length}] as const).map(t => <button key={t.key} onClick={() => { tap(); setFilter(t.key) }} aria-pressed={filter === t.key} className={`presse flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-note font-semibold ${filter === t.key ? 'bg-teinte text-white' : 'bg-carte text-encre'}`}>{t.label}<span className={filter === t.key ? 'text-white/75' : 'text-brume'}>{t.count}</span></button>)}
              </div>
            </>}

            {sending > 0 && <p role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-[14px] bg-teinte-doux px-3.5 py-2.5 text-sous font-medium text-teinte-fonce"><span className="h-4 w-4 animate-spin rounded-full border-2 border-teinte border-t-transparent" />Envoi de {plural(sending, 'photo', 'photos')}…</p>}

            {!hasResults && !sending && <div className="px-5 py-7 text-center">
              <Art name={filter === 'notes' ? 'picto-missions' : 'picto-photo'} size={64} className="mx-auto" />
              <h2 className="mt-3 font-rond text-titre2">{q ? 'Aucun résultat' : filter === 'notes' ? 'Ta première note' : filter === 'dossiers' ? 'Un peu d’organisation' : filter === 'photos' ? 'Vos photos auront leur place ici' : 'Vos souvenirs commencent ici'}</h2>
              <p className="mx-auto mt-2 max-w-[290px] text-sous text-brume">{q ? 'Essaie un autre mot ou retrouve tout le contenu du dossier.' : 'Rassemble les photos, les idées et les petits détails à garder ensemble.'}</p>
              {q ? <button onClick={() => { setQuery(''); setFilter('tout') }} className="presse mt-4 min-h-11 text-sous font-semibold text-teinte-fonce">Effacer la recherche</button> : <Btn className="mt-5" onClick={addCurrent}>{filter === 'photos' ? 'Ajouter des photos' : filter === 'notes' ? 'Écrire une note' : filter === 'dossiers' ? 'Créer un sous-dossier' : 'Ajouter mon premier souvenir'}</Btn>}
            </div>}

            {showFolders && visibleChildren.length > 0 && <Bloc title="Sous-dossiers" count={visibleChildren.length}>
              <div className="groupe mx-4 shadow-carte">{visibleChildren.map((c, i) => {
                const info = folderStats(folders, folderItems, c)
                return <button key={c.id} onClick={() => { tap(); onOpen(c.id) }} className="presse-ligne flex w-full items-center gap-3 px-3 text-left">
                  <span className="relative my-3 h-14 w-14 shrink-0 overflow-hidden rounded-[14px]"><FolderCover folder={c} url={info.cover} size="sm" /></span>
                  <span className={`flex min-h-[80px] min-w-0 flex-1 items-center gap-2 ${i < visibleChildren.length - 1 ? 'border-b border-trait' : ''}`}><span className="min-w-0 flex-1"><span className="block truncate text-corps font-semibold">{c.name}</span><span className="mt-0.5 block truncate text-note text-brume">{contentLine(info)}</span></span><ChevronRight size={17} className="shrink-0 text-brume" /></span>
                </button>
              })}</div>
            </Bloc>}

            {showPhotos && visiblePhotos.length > 0 && <Bloc title="Photos" count={visiblePhotos.length}>
              <div className="mx-4 grid grid-cols-3 gap-1 overflow-hidden rounded-[20px]">{visiblePhotos.map(p => <button key={p.id} onClick={() => setViewer(photos.indexOf(p))} className="relative aspect-square bg-remplissage" aria-label={p.body ?? 'Ouvrir la photo'}>{p.image_url && <img src={p.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}</button>)}</div>
            </Bloc>}

            {showNotes && visibleNotes.length > 0 && <Bloc title="Notes" count={visibleNotes.length}>
              <div className="space-y-2 px-4">{visibleNotes.map(n => {
                const by = members.find(m => m.id === n.author_id)
                return <button key={n.id} onClick={() => { tap(); setSheet({ k:'note', note:n }) }} className="presse flex w-full items-start gap-3 rounded-[20px] bg-carte p-4 text-left shadow-carte">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#FFF5D7] text-[#AD7A13]"><NotebookPen size={20} /></span>
                  <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-corps font-semibold">{n.title || 'Note sans titre'}</span><span className="mt-1 line-clamp-2 block whitespace-pre-line text-sous text-brume">{n.body}</span><span className="mt-2 flex items-center gap-1.5 text-note text-brume">{by && <Avatar m={by} size={18} />}<span className="truncate">{by?.display_name ?? 'Un proche'} · {ago(n.updated_at)}</span></span></span>
                  <ChevronRight size={16} className="mt-2 shrink-0 text-brume" />
                </button>
              })}</div>
            </Bloc>}
          </div>
        </div>

      </div>

      {viewer !== null && photos.length > 0 && (
        <PhotoViewer photos={photos} start={Math.min(viewer, photos.length - 1)} folder={folder} admin={admin} onClose={() => setViewer(null)} />
      )}
      {sheet?.k === 'note' && <NoteSheet folder={folder} note={sheet.note} admin={admin} onClose={() => setSheet(null)} onSaved={() => { setQuery(''); setFilter('notes') }} />}
      {sheet?.k === 'sous-dossier' && <NewFolderSheet parent={folder} onClose={() => setSheet(null)} onCreated={onOpen} />}
      {sheet?.k === 'membres' && <MembersSheet root={root} onClose={() => setSheet(null)} onLeft={onBack} />}
      {sheet?.k === 'renommer' && <RenameSheet folder={folder} onClose={() => setSheet(null)} />}
      {sheet?.k === 'couverture' && <CoverPicker folder={folder} onClose={() => setSheet(null)} />}
    </>
  )
}

function Bloc({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline gap-2 px-5">
        <h3 className="font-rond text-titre3">{title}</h3>
        <span className="text-sous text-brume">{count}</span>
      </div>
      {children}
    </section>
  )
}

// ═════════════════════════ Visionneuse ═════════════════════════

function PhotoViewer({ photos, start, folder, admin, onClose }: { photos: FolderItem[]; start: number; folder: Folder; admin: boolean; onClose: () => void }) {
  const { state, run } = useHome()
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
    const list = [...(admin ? [{ label: 'Utiliser comme couverture' }] : []), ...(mine || admin ? [{ label: 'Supprimer la photo', destructive: true }] : [])]
    if (!list.length) return
    const k = await choisir({ actions: list })
    const label = list[k]?.label
    if (label === 'Utiliser comme couverture' && p.image_path) void run((api) => api.setFolderCover(folder, { path: p.image_path! }), 'Couverture mise à jour')
    if (label === 'Supprimer la photo' && (await confirmer({ title: 'Cette photo sera supprimée pour tous les membres.', confirm: 'Supprimer', destructive: true }))) {
      if (photos.length === 1) onClose()
      await run((api) => api.deleteFolderItem(p), 'Photo supprimée')
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
        <button onClick={onClose} className="presse flex h-10 w-10 items-center justify-center rounded-full bg-white/15" aria-label="Fermer">
          <X size={20} strokeWidth={2.6} />
        </button>
        <span className="text-sous font-semibold text-white/80">{idx + 1} sur {photos.length}</span>
        {mine || admin ? (
          <button onClick={actions} className="presse flex h-10 w-10 items-center justify-center rounded-full bg-white/15" aria-label="Options de la photo">
            <Ellipsis size={20} />
          </button>
        ) : (
          <span className="w-10" />
        )}
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
      <p className="px-2 pt-1 text-note text-brume">Tous les membres du dossier peuvent la lire et la modifier.</p>
      {note && (note.author_id === state.me.id || admin) && (
        <Btn
          kind="gris"
          className="mt-2 !text-rouge"
          onClick={async () => {
            if (!(await confirmer({ title: 'Supprimer cette note ?', message: 'Elle disparaîtra pour tous les membres.', confirm: 'Supprimer', destructive: true }))) return
            if (await run((api) => api.deleteFolderItem(note), 'Note supprimée')) onClose()
          }}
        >
          <Trash2 size={17} /> Supprimer la note
        </Btn>
      )}
    </Sheet>
  )
}

/** Création d'un dossier (avec couverture et membres) ou d'un sous-dossier. */
function NewFolderSheet({ parent, onClose, onCreated }: { parent?: Folder; onClose: () => void; onCreated: (id: string) => void }) {
  const { state, run, toast } = useHome()
  const { me, members, family } = state
  const [name, setName] = useState('')
  const nameId = useId()
  const [who, setWho] = useState<Set<string>>(new Set())
  const [cover, setCover] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const others = members.filter((m) => m.id !== me.id)
  const root = parent && (state.folders.find((f) => f.id === parent.root_id) ?? parent)

  const toggle = (id: string) => {
    select()
    setWho((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const create = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    let id = ''
    const ok = await run(async (api) => {
      id = await api.createFolder(family.id, { name: name.trim(), parentId: parent?.id ?? null, memberIds: [...who] })
      if (cover) {
        const now = new Date().toISOString()
        const made: Folder = { id, family_id: family.id, parent_id: parent?.id ?? null, root_id: parent?.root_id ?? id, owner_id: me.id, name, cover_path: null, created_at: now, updated_at: now }
        await api.setFolderCover(made, { blob: cover })
      }
    }, parent ? 'Sous-dossier créé' : 'Dossier créé')
    setBusy(false)
    if (ok && id) {
      success()
      onClose()
      onCreated(id)
    }
  }

  return (
    <Sheet title={parent ? 'Nouveau sous-dossier' : 'Nouveau dossier'} onClose={onClose} tall={!parent} footer={<Btn onClick={create} disabled={busy || !name.trim()}>{busy ? 'Création…' : parent ? 'Créer le sous-dossier' : 'Créer le dossier'}</Btn>}>
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

      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <label htmlFor={nameId} className="text-corps font-semibold">{parent ? 'Nom du sous-dossier' : 'Nom du dossier'}</label>
          <span className="text-note font-semibold text-teinte-fonce">Obligatoire</span>
        </div>
        <div className="groupe border border-teinte/25 focus-within:border-teinte focus-within:ring-2 focus-within:ring-teinte/15">
          <input id={nameId} required aria-describedby={`${nameId}-hint`} className="h-[54px] w-full bg-transparent px-4 text-corps outline-none placeholder:text-brume" placeholder="Ex. : Vacances en famille" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!!parent} />
        </div>
        <p id={`${nameId}-hint`} className="mt-2 px-1 text-note text-brume">Donne un nom au dossier pour pouvoir le créer.</p>
      </div>

      {!parent && (
        <button onClick={() => input.current?.click()} className="presse relative block aspect-[16/6] w-full overflow-hidden rounded-[22px] text-left shadow-carte">
          {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <FolderCover folder={{ id: name || 'nouveau', name: name || '·' }} url={null} size="md" />}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="verre absolute bottom-3 left-3 flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sous font-semibold text-encre">
            <ImagePlus size={17} strokeWidth={2.3} /> {cover ? 'Changer la couverture' : 'Couverture · facultative'}
          </span>
        </button>
      )}

      {parent && root ? (
        <p className="flex items-center gap-1.5 px-2 pt-2.5 text-note text-brume">
          <UsersRound size={14} strokeWidth={2.4} /> Mêmes membres que « {root.name} » : {whoText(membersOf(state.folderMembers, root.id), me.id, members).replace(/^Toi/, 'toi')}.
        </p>
      ) : (
        <>
          <div className="mt-6 flex items-end justify-between px-2 pb-2">
            <p className="text-note font-semibold uppercase tracking-[0.02em] text-brume">Qui peut y entrer ?</p>
            {others.length > 0 && (
              <button onClick={() => (select(), setWho(who.size === others.length ? new Set() : new Set(others.map((m) => m.id))))} className="text-sous font-semibold text-teinte">
                {who.size === others.length ? 'Juste moi' : 'Toute la famille'}
              </button>
            )}
          </div>
          <div className="groupe">
            <div className="flex items-center gap-3 pl-3.5">
              <Avatar m={me} size={38} />
              <span className="flex min-h-[54px] flex-1 items-center border-b border-trait pr-4">
                <span className="flex-1 text-corps">Toi <span className="text-brume">· créateur</span></span>
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-teinte/40 text-white"><Check size={15} strokeWidth={3.2} /></span>
              </span>
            </div>
            {others.map((m, i) => {
              const on = who.has(m.id)
              return (
                <button key={m.id} onClick={() => toggle(m.id)} className="presse-ligne flex w-full items-center gap-3 pl-3.5 text-left" aria-pressed={on}>
                  <Avatar m={m} size={38} />
                  <span className={`flex min-h-[54px] flex-1 items-center pr-4 ${i < others.length - 1 ? 'border-b border-trait' : ''}`}>
                    <span className="flex-1 truncate text-corps">{m.display_name}</span>
                    <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors ${on ? 'bg-teinte text-white' : 'border-[1.5px] border-pale'}`}>
                      {on && <Check size={15} strokeWidth={3.2} />}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="flex items-start gap-1.5 px-2 pt-2.5 text-note text-brume">
            {who.size ? <UsersRound size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" /> : <Lock size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />}
            {who.size ? `${whoText([me.id, ...who], me.id, members)}. Les autres membres de la famille ne verront pas ce dossier.` : 'Toi seul verras ce dossier. Tu pourras inviter des proches plus tard.'}
          </p>
        </>
      )}

    </Sheet>
  )
}

function MembersSheet({ root, onClose, onLeft }: { root: Folder; onClose: () => void; onLeft: () => void }) {
  const { state, run } = useHome()
  const { me, members, folderMembers } = state
  const current = membersOf(folderMembers, root.id)
  const admin = !root.owner_id || root.owner_id === me.id
  const [sel, setSel] = useState<Set<string>>(new Set(current))
  const owner = members.find((m) => m.id === root.owner_id)
  const fixed = (id: string) => id === root.owner_id || id === me.id
  const changed = sel.size !== current.length || current.some((id) => !sel.has(id))
  const people = admin ? members : members.filter((m) => current.includes(m.id))
  const removed = current.filter((id) => !sel.has(id)).map((id) => members.find((m) => m.id === id)?.display_name).filter(Boolean)

  const role = (id: string) => (id === root.owner_id ? 'Créateur' : current.includes(id) || id === me.id ? 'Membre' : 'Pas dans ce dossier')

  return (
    <Sheet title={admin ? 'Membres du dossier' : `Dans « ${root.name} »`} onClose={onClose}>
      <p className="px-2 pb-3 text-center text-sous text-brume">Seules ces personnes voient le dossier, ses sous-dossiers, ses photos et ses notes.</p>
      <div className="groupe">
        {people.map((m, i) => {
          const on = sel.has(m.id)
          const locked = !admin || fixed(m.id)
          return (
            <button
              key={m.id}
              disabled={locked}
              onClick={() => {
                select()
                setSel((s) => {
                  const n = new Set(s)
                  if (n.has(m.id)) n.delete(m.id)
                  else n.add(m.id)
                  return n
                })
              }}
              className={`flex w-full items-center gap-3 pl-3.5 text-left ${locked ? '' : 'presse-ligne'}`}
              aria-pressed={on}
            >
              <Avatar m={m} size={40} mood />
              <span className={`flex min-h-[58px] flex-1 items-center gap-2 pr-4 ${i < people.length - 1 ? 'border-b border-trait' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-corps">{m.display_name}{m.id === me.id && m.id !== root.owner_id ? <span className="text-brume"> (toi)</span> : ''}</span>
                  <span className="block truncate text-note text-brume">{role(m.id)}</span>
                </span>
                {admin && (
                  <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors ${on ? (fixed(m.id) ? 'bg-teinte/40 text-white' : 'bg-teinte text-white') : 'border-[1.5px] border-pale'}`}>
                    {on && <Check size={15} strokeWidth={3.2} />}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {admin ? (
        <>
          {removed.length > 0 && <p className="px-2 pt-2.5 text-note text-rouge">{removed.join(', ')} n’{removed.length > 1 ? 'auront' : 'aura'} plus accès au dossier.</p>}
          <Btn className="mt-4" disabled={!changed} onClick={async () => (await run((api) => api.setFolderMembers(root.id, [...sel]), 'Membres mis à jour')) && onClose()}>
            Enregistrer
          </Btn>
        </>
      ) : (
        <>
          <p className="px-2 pt-2.5 text-note text-brume">Seul{owner ? ` ${owner.display_name}` : ' le créateur'} peut ajouter ou retirer des membres.</p>
          <Btn
            kind="gris"
            className="mt-4 !text-rouge"
            onClick={async () => {
              if (!(await confirmer({ title: `Quitter « ${root.name} » ?`, message: 'Tu ne le verras plus. Son créateur pourra te réinviter.', confirm: 'Quitter le dossier', destructive: true }))) return
              if (await run((api) => api.leaveFolder(root.id, me.id), 'Tu as quitté le dossier')) {
                onClose()
                onLeft()
              }
            }}
          >
            Quitter le dossier
          </Btn>
        </>
      )}
    </Sheet>
  )
}

function RenameSheet({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const { run } = useHome()
  const [name, setName] = useState(folder.name)
  return (
    <Sheet title="Renommer" onClose={onClose}>
      <div className="groupe">
        <input className="h-[52px] w-full bg-transparent px-4 text-corps outline-none" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Nom du dossier" />
      </div>
      <Btn className="mt-4" disabled={!name.trim() || name.trim() === folder.name} onClick={async () => (await run((api) => api.renameFolder(folder.id, name), 'Dossier renommé')) && onClose()}>
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

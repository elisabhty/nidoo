import {
  ArrowUp, Check, ChevronLeft, ChevronRight, Ellipsis, FolderPlus, ImagePlus, Lock, NotebookPen, Plus, Search, Trash2, UsersRound, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FolderCover, MemberStack } from '../components/folder'
import { Art, Avatar, Btn, choisir, confirmer, Rond, Screen, SearchField, Segments, Sheet, Vide } from '../components/ui'
import { contentLine, folderStats, membersOf, plural, subtreeIds, whoText } from '../lib/folders'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import type { Folder, FolderItem } from '../lib/types'
import { ago, compressImage, errorText } from '../lib/util'

// Souvenirs : les albums (dossiers de photos, notes et discussion). Le fil familial a son propre onglet.

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
        <p className="-mt-1 mb-4 px-5 text-sous text-brume">Vos albums : photos, notes et discussion, avec les proches de votre choix.</p>

        {total === 0 ? (
          <Vide art="picto-cadeau" title="Votre premier souvenir commence ici" text="Un dossier rassemble photos, notes et discussion, avec les proches de ton choix. Les autres ne le voient pas.">
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
  const messages = own.filter((i) => i.kind === 'message').sort((a, b) => a.created_at.localeCompare(b.created_at))

  const [tab, setTab] = useState<'contenu' | 'discussion'>('contenu')
  const [scrolled, setScrolled] = useState(false)
  const [sheet, setSheet] = useState<Open>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [sending, setSending] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const heroText = useRef<HTMLDivElement>(null)

  // Ancêtres pour le fil d'Ariane : « Recettes de Mamie / Desserts »
  const crumbs: Folder[] = []
  for (let p = folders.find((f) => f.id === folder.parent_id); p; p = folders.find((f) => f.id === p!.parent_id)) crumbs.unshift(p)

  useEffect(() => {
    if (tab === 'discussion') scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [tab, messages.length])

  const addPhotos = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, 20)
    if (!list.length) return
    setSending(list.length)
    await run(async (api) => {
      for (const f of list) {
        await api.addFolderItem(folder, me.id, { kind: 'photo', blob: await compressImage(f, 1600, 0.82) })
        setSending((n) => n - 1)
      }
    }, list.length > 1 ? `${list.length} photos ajoutées` : 'Photo ajoutée')
    setSending(0)
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
    const what = [stats.photos && plural(stats.photos, 'photo', 'photos'), stats.notes && plural(stats.notes, 'note', 'notes'), stats.subfolders && plural(stats.subfolders, 'sous-dossier', 'sous-dossiers')].filter(Boolean).join(', ')
    const ok = await confirmer({
      title: `Supprimer « ${folder.name} » ?`,
      message: `${what ? `Ses ${what} et sa` : 'Sa'} discussion seront supprimés pour tous les membres.`,
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
            <p className={`absolute inset-x-[34%] truncate text-center text-corps font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>{folder.name}</p>
            <div className="flex items-center gap-2">
              <Rond label="Options du dossier" onClick={menu}><Ellipsis size={20} /></Rond>
              <Rond label="Ajouter" tint onClick={add}><Plus size={21} strokeWidth={2.4} /></Rond>
            </div>
          </div>
        </div>

        <div ref={scroller} className="no-bar h-full overflow-y-auto overscroll-contain" style={{ paddingBottom: tab === 'discussion' ? 200 : 120 }} onScroll={(e) => {
            const y = e.currentTarget.scrollTop
            setScrolled(y > 150)
            if (heroText.current) heroText.current.style.opacity = String(Math.max(0, 1 - y / 130))
          }}>
          {/* couverture */}
          <div className="relative w-full overflow-hidden" style={{ height: 'calc(var(--sat) + 260px)' }}>
            <FolderCover folder={folder} url={stats.cover} size="lg" />
            {stats.cover && <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/25" />}
            <div ref={heroText} className={`absolute bottom-9 left-5 ${stats.cover ? 'right-5 text-white' : 'right-[40%] text-encre'}`}>
              {crumbs.length > 0 && <p className={`mb-0.5 truncate text-note font-medium ${stats.cover ? 'text-white/80' : 'text-encre/60'}`}>{crumbs.map((c) => c.name).join(' / ')}</p>}
              <h1 className="break-words font-rond text-grand" style={stats.cover ? { textShadow: '0 2px 16px rgba(0,0,0,0.25)' } : undefined}>{folder.name}</h1>
              <p className={`mt-0.5 text-sous ${stats.cover ? 'text-white/85' : 'text-encre/65'}`}>{contentLine(stats)}</p>
            </div>
          </div>

          <div className="relative -mt-5 rounded-t-[28px] bg-fond pt-4">
            {/* qui est dans ce dossier */}
            <button
              onClick={() => {
                tap()
                setSheet({ k: 'membres' })
              }}
              className="presse groupe mx-4 flex w-[calc(100%-2rem)] items-center gap-3 p-3 pr-3.5 text-left shadow-carte"
            >
              {memberIds.length <= 1 ? (
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-teinte-doux text-teinte"><Lock size={18} strokeWidth={2.4} /></span>
              ) : (
                <MemberStack ids={memberIds} size={36} max={4} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-corps font-semibold">{whoText(memberIds, me.id, members)}</span>
                <span className="block truncate text-note text-brume">
                  {memberIds.length <= 1
                    ? 'Personne d’autre ne voit ce dossier'
                    : folder.parent_id
                      ? `Les membres de « ${root.name} »`
                      : memberIds.length >= members.length
                        ? 'Toute la famille y a accès'
                        : 'Eux seuls voient ce dossier'}
                </span>
              </span>
              {rootAdmin ? <span className="shrink-0 text-sous font-semibold text-teinte">{memberIds.length <= 1 ? 'Inviter' : 'Gérer'}</span> : <ChevronRight size={17} strokeWidth={2.6} className="shrink-0 text-pale" />}
            </button>

            <div className="mx-4 mb-4 mt-4">
              <Segments
                value={tab}
                onChange={setTab}
                options={[
                  { key: 'contenu', label: 'Contenu' },
                  { key: 'discussion', label: messages.length ? `Discussion · ${messages.length}` : 'Discussion' },
                ]}
              />
            </div>

            {tab === 'contenu' ? (
              <>
                {/* raccourcis : ce qu'on peut ajouter, sans chercher */}
                <div className="mx-4 grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Photos', icon: <ImagePlus size={21} strokeWidth={2.1} />, tint: '#7A5AE0', go: () => gallery.current?.click() },
                    { label: 'Note', icon: <NotebookPen size={21} strokeWidth={2.1} />, tint: '#E0A92F', go: () => setSheet({ k: 'note' }) },
                    { label: 'Dossier', icon: <FolderPlus size={21} strokeWidth={2.1} />, tint: '#4A8CD8', go: () => setSheet({ k: 'sous-dossier' }) },
                  ].map((a) => (
                    <button
                      key={a.label}
                      onClick={() => {
                        tap()
                        a.go()
                      }}
                      className="presse groupe flex flex-col items-center gap-1.5 py-3 shadow-carte"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: a.tint }}>{a.icon}</span>
                      <span className="text-note font-semibold">{a.label}</span>
                    </button>
                  ))}
                </div>

                {sending > 0 && (
                  <p className="mx-4 mt-3 flex items-center gap-2 rounded-[14px] bg-teinte-doux px-3.5 py-2.5 text-sous font-medium text-teinte-fonce">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-teinte border-t-transparent" />
                    Envoi de {plural(sending, 'photo', 'photos')}…
                  </p>
                )}

                {empty && !sending && (
                  <Vide art="picto-cadeau" title="Ce dossier est vide" text={`Ajoute des photos, des notes ou un sous-dossier. ${memberIds.length <= 1 ? 'Toi seul y as accès.' : 'Seuls ses membres les verront.'}`} />
                )}

                {children.length > 0 && (
                  <Bloc title="Dossiers" count={children.length}>
                    <div className="no-bar flex gap-3 overflow-x-auto px-4 pb-1">
                      {children.map((c) => {
                        const s = folderStats(folders, folderItems, c)
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              tap()
                              onOpen(c.id)
                            }}
                            className="presse w-[148px] shrink-0 text-left"
                          >
                            <span className="relative block aspect-[4/3] overflow-hidden rounded-[18px] shadow-carte">
                              <FolderCover folder={c} url={s.cover} size="sm" />
                            </span>
                            <span className="mt-1.5 block truncate text-sous font-semibold">{c.name}</span>
                            <span className="block truncate text-legende text-brume">{contentLine(s)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Bloc>
                )}

                {photos.length > 0 && (
                  <Bloc title="Photos" count={photos.length}>
                    <div className="mx-4 grid grid-cols-3 gap-[3px] overflow-hidden rounded-[20px]">
                      {photos.map((p, i) => (
                        <button key={p.id} onClick={() => setViewer(i)} className="relative aspect-square bg-remplissage" aria-label={p.body ?? 'Photo'}>
                          {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                        </button>
                      ))}
                    </div>
                  </Bloc>
                )}

                {notes.length > 0 && (
                  <Bloc title="Notes" count={notes.length}>
                    <div className="grid grid-cols-2 gap-3 px-4">
                      {notes.map((n) => {
                        const by = members.find((m) => m.id === n.author_id)
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              tap()
                              setSheet({ k: 'note', note: n })
                            }}
                            className="presse groupe flex h-[156px] flex-col p-3.5 text-left shadow-carte"
                          >
                            <span className="mb-1 h-1 w-7 rounded-full bg-[#E0A92F]" />
                            <span className="line-clamp-2 text-appel font-semibold">{n.title || 'Sans titre'}</span>
                            <span className="mt-1 line-clamp-3 flex-1 whitespace-pre-line text-note text-brume">{n.body}</span>
                            <span className="mt-1.5 flex items-center gap-1.5 text-mini text-brume">
                              {by && <Avatar m={by} size={18} />}
                              <span className="truncate">{ago(n.updated_at)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </Bloc>
                )}
              </>
            ) : (
              <Discussion folder={folder} messages={messages} admin={admin} />
            )}
          </div>
        </div>

        {tab === 'discussion' && <Composer folder={folder} />}
      </div>

      {viewer !== null && photos.length > 0 && (
        <PhotoViewer photos={photos} start={Math.min(viewer, photos.length - 1)} folder={folder} admin={admin} onClose={() => setViewer(null)} />
      )}
      {sheet?.k === 'note' && <NoteSheet folder={folder} note={sheet.note} admin={admin} onClose={() => setSheet(null)} />}
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

// ═════════════════════════ Discussion ═════════════════════════

const dayOf = (iso: string) => new Date(iso).toDateString()
function dayTitle(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(Date.now() - 86400000)
  if (d.toDateString() === today.toDateString()) return 'Aujourd’hui'
  if (d.toDateString() === y.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function Discussion({ folder, messages, admin }: { folder: Folder; messages: FolderItem[]; admin: boolean }) {
  const { state, run } = useHome()
  const { me, members, folderMembers } = state
  const who = membersOf(folderMembers, folder.root_id)

  if (!messages.length) {
    return (
      <div className="flex flex-col items-center px-10 pt-8 text-center">
        <Art name="picto-bulle" size={84} />
        <p className="mt-3 font-rond text-titre3">Pas encore de message</p>
        <p className="mt-1 text-sous text-brume">{who.length <= 1 ? 'Note ici tes idées : personne d’autre ne les lira.' : `Écris le premier. Seuls ${whoText(who, me.id, members).replace(/^Toi/, 'toi')} le liront.`}</p>
      </div>
    )
  }

  return (
    <div className="px-3">
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const next = messages[i + 1]
        const newDay = !prev || dayOf(prev.created_at) !== dayOf(m.created_at)
        const close = (a?: FolderItem, b?: FolderItem) => !!a && !!b && a.author_id === b.author_id && dayOf(a.created_at) === dayOf(b.created_at) && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 8 * 60000
        const first = !close(prev, m)
        const last = !close(m, next)
        const mine = m.author_id === me.id
        const by = members.find((x) => x.id === m.author_id)
        const canDelete = mine || admin
        return (
          <div key={m.id}>
            {newDay && <p className="pb-2 pt-4 text-center text-legende font-semibold text-brume">{dayTitle(m.created_at)}</p>}
            {first && !mine && <p className="mb-0.5 ml-[46px] mt-2 text-legende text-brume">{by?.display_name ?? 'Ancien membre'}</p>}
            <div className={`flex items-end gap-2 ${mine ? 'justify-end' : ''} ${last ? 'mb-2' : 'mb-[3px]'}`}>
              {!mine && <span className="w-[34px] shrink-0">{last && by && <Avatar m={by} size={34} />}</span>}
              <button
                onClick={async () => {
                  if (!canDelete) return
                  const i = await choisir({ title: new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), actions: [{ label: 'Supprimer le message', destructive: true }] })
                  if (i === 0) void run((api) => api.deleteFolderItem(m))
                }}
                className={`max-w-[76%] whitespace-pre-wrap break-words px-3.5 py-2 text-left text-corps ${mine ? 'bg-teinte text-white' : 'bg-carte text-encre shadow-carte'} ${
                  mine ? `rounded-[20px] ${last ? 'rounded-br-[6px]' : ''}` : `rounded-[20px] ${last ? 'rounded-bl-[6px]' : ''}`
                }`}
              >
                {m.body}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Composer({ folder }: { folder: Folder }) {
  const { state, run } = useHome()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const t = box.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 110)}px`
  }, [text])
  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setText('')
    const ok = await run((api) => api.addFolderItem(folder, state.me.id, { kind: 'message', body }))
    if (ok) success()
    else setText(body)
    setBusy(false)
  }
  return (
    <div className="absolute inset-x-3 z-20" style={{ bottom: 'calc(var(--sab) + 80px)' }}>
      <div className="verre flex items-end gap-2 rounded-[24px] py-1.5 pl-4 pr-1.5">
        <textarea
          ref={box}
          rows={1}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="Message"
          className="min-w-0 flex-1 resize-none bg-transparent py-[7px] text-corps outline-none placeholder:text-brume"
          aria-label="Écrire un message"
        />
        <button onClick={send} disabled={!text.trim() || busy} className="presse flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teinte text-white disabled:opacity-30" aria-label="Envoyer">
          <ArrowUp size={20} strokeWidth={2.8} />
        </button>
      </div>
    </div>
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

function NoteSheet({ folder, note, admin, onClose }: { folder: Folder; note?: FolderItem; admin: boolean; onClose: () => void }) {
  const { state, run } = useHome()
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const by = note && state.members.find((m) => m.id === note.author_id)
  const changed = title !== (note?.title ?? '') || body !== (note?.body ?? '')

  const save = async () => {
    const ok = note
      ? await run((api) => api.updateFolderItem(note.id, { title: title || null, body: body || null }), 'Note enregistrée')
      : await run((api) => api.addFolderItem(folder, state.me.id, { kind: 'note', title, body }), 'Note ajoutée')
    if (ok) {
      success()
      onClose()
    }
  }

  return (
    <Sheet title={note ? 'Note' : 'Nouvelle note'} onClose={onClose} tall>
      <div className="groupe flex flex-col p-4">
        <input className="bg-transparent font-rond text-titre2 outline-none placeholder:text-pale" placeholder="Titre" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!note} />
        <textarea
          className="mt-2 min-h-[34vh] flex-1 resize-none bg-transparent text-corps leading-[24px] outline-none placeholder:text-pale"
          placeholder="Liste, idée, recette, adresse…"
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
      <Btn className="mt-3" onClick={save} disabled={note ? !changed : !title.trim() && !body.trim()}>{note ? 'Enregistrer' : 'Ajouter la note'}</Btn>
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
    setBusy(true)
    let id = ''
    const ok = await run(async (api) => {
      id = await api.createFolder(family.id, { name, parentId: parent?.id ?? null, memberIds: [...who] })
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
    <Sheet title={parent ? 'Nouveau sous-dossier' : 'Nouveau dossier'} onClose={onClose} tall={!parent}>
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

      {!parent && (
        <button onClick={() => input.current?.click()} className="presse relative block aspect-[16/8] w-full overflow-hidden rounded-[22px] text-left shadow-carte">
          {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <FolderCover folder={{ id: name || 'nouveau', name: name || '·' }} url={null} size="md" />}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="verre absolute bottom-3 left-3 flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sous font-semibold text-encre">
            <ImagePlus size={17} strokeWidth={2.3} /> {cover ? 'Changer la couverture' : 'Ajouter une couverture'}
          </span>
        </button>
      )}

      <div className={`groupe ${parent ? '' : 'mt-4'}`}>
        <input className="h-[52px] w-full bg-transparent px-4 text-corps outline-none placeholder:text-pale" placeholder={parent ? 'Nom du sous-dossier' : 'Nom du dossier'} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!!parent} />
      </div>

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

      <Btn className="mt-5" onClick={create} disabled={busy || !name.trim()}>{busy ? 'Création…' : parent ? 'Créer le sous-dossier' : 'Créer le dossier'}</Btn>
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
      <p className="px-2 pb-3 text-center text-sous text-brume">Seules ces personnes voient le dossier, ses sous-dossiers, ses photos, ses notes et sa discussion.</p>
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

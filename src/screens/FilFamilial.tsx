// L'onglet Fil, devenu un fil d'actualité façon Facebook (Elisa, 27 novembre : « comme un fil Facebook, fusionner
// souvenirs et le fil actuel »). En haut, « Quoi de neuf ? » pour publier (à toute la famille, ou dans un album) ;
// puis les albums (les anciens Souvenirs) ; puis le fil : les publications, des plus récentes aux plus anciennes, avec
// leurs réactions et leurs commentaires, et ce que chacun ajoute dans les albums qu'on partage avec lui.
import { ArrowUp, BookOpen, Video, BookmarkCheck, BookmarkPlus, ChartNoAxesColumn, ChevronDown, ChevronRight, Ellipsis, Heart, Images, Lock, MessageCircle, Plus, Search, Smile, Sparkles, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { prendrePhoto } from '../components/appareil'
import { FolderCover } from '../components/folder'
import { photoBlob } from '../components/folderSouvenirs'
import { PhotoEditeur } from '../components/photoEditeur'
import { StickerImg, StickerTray } from '../components/stickers'
import { Art, Avatar, Btn, choisir, confirmer, Rond, Screen, SearchField, Sheet, useHauteurQuiTient } from '../components/ui'
import { QuiAReagi, ReactionImg, ToutesReactions } from '../components/reactions'
import { ApercuVideo, CoupeVideo, useVideoAPreparer, VideoDuFil } from '../components/videos'
import { VIDEO_FIL_MAX_S } from '../lib/video'
import { lesPlusDonnees, motDe, RAPIDES, reaction, retenir } from '../lib/reactions'
import { folderStats, membersOf, whoText } from '../lib/folders'
import { select, success, tap } from '../lib/haptic'
import { useHome } from '../lib/store'
import { cleSticker, PERSO } from '../lib/stickers'
import type { FamilyState, Folder, FolderItem, Member, Moment } from '../lib/types'
import { ago, compressImage } from '../lib/util'
import { Corbeille } from './Corbeille'
import { AlbumsListe, FolderView, NewFolderSheet } from './Folders'
import { Apercu, Sondage, SondageCompose, Texte, Vocal, type NouvelEnvoi } from './Moments'

// ═════════════════════════ L'onglet : le fil, la liste des albums, un album ═════════════════════════

type Vue = { k: 'fil' } | { k: 'albums' } | { k: 'corbeille' } | { k: 'album'; id: string; depuis: 'fil' | 'albums' }

export default function FilFamilial() {
  const { state } = useHome()
  const [vue, setVue] = useState<Vue>({ k: 'fil' })
  const album = vue.k === 'album' && state.folders.some((f) => f.id === vue.id) ? vue : null
  const liste = vue.k === 'albums' || vue.k === 'corbeille' || album?.depuis === 'albums'
  // toucher l'onglet Fil quand on y est déjà : on revient au fil (comme sur l'iPhone)
  useEffect(() => {
    const f = (e: Event) => (e as CustomEvent<string>).detail === 'fil' && setVue({ k: 'fil' })
    window.addEventListener('nidoo:onglet', f)
    return () => window.removeEventListener('nidoo:onglet', f)
  }, [])
  // le fil (et la liste des albums) restent là, cachés, pendant qu'on regarde un album : au retour, on retrouve
  // l'endroit où l'on était
  return (
    <>
      <div className="h-full" hidden={vue.k !== 'fil' && !(vue.k === 'album' && !album)}>
        <Fil onAlbum={(id) => setVue({ k: 'album', id, depuis: 'fil' })} onAlbums={() => setVue({ k: 'albums' })} />
      </div>
      {liste && (
        <div className="h-full" hidden={!!album || vue.k === 'corbeille'}>
          <AlbumsListe onOpen={(id) => setVue({ k: 'album', id, depuis: 'albums' })} onBack={() => setVue({ k: 'fil' })} onCorbeille={() => setVue({ k: 'corbeille' })} />
        </div>
      )}
      {vue.k === 'corbeille' && <Corbeille onBack={() => setVue({ k: 'albums' })} />}
      {album && <FolderView key={album.id} id={album.id} retour={album.depuis === 'albums' ? 'Albums' : 'Le fil'} onBack={() => setVue(album.depuis === 'albums' ? { k: 'albums' } : { k: 'fil' })} />}
    </>
  )
}

// ═════════════════════════ Ce que montre le fil ═════════════════════════

/** Ce que quelqu'un a mis dans un album, d'un coup (même personne, même album, à moins de 3 heures d'écart). */
type Ajout = { id: string; folder: Folder; auteur: Member | undefined; items: FolderItem[]; at: string }
type Entree = { k: 'post'; id: string; at: string; mo: Moment } | { k: 'album'; id: string; at: string; a: Ajout }
type Filtre = 'tout' | 'photos' | 'videos' | 'vocaux' | 'sondages' | 'albums'

function ajoutsAlbums(items: FolderItem[], folders: Folder[], members: Member[]): Ajout[] {
  const tries = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const ajouts: Ajout[] = []
  for (const i of tries) {
    const folder = folders.find((f) => f.id === i.folder_id)
    // une photo du fil gardée dans un album est déjà dans le fil : on ne la montre pas deux fois
    if (!folder || i.source_moment_id) continue
    const dernier = ajouts[ajouts.length - 1]
    const plusAncien = dernier?.items[dernier.items.length - 1]
    if (dernier && dernier.folder.id === i.folder_id && dernier.auteur?.id === i.author_id && plusAncien && new Date(plusAncien.created_at).getTime() - new Date(i.created_at).getTime() < 3 * 3600000) {
      dernier.items.push(i)
    } else ajouts.push({ id: `album-${i.id}`, folder, auteur: members.find((m) => m.id === i.author_id), items: [i], at: i.created_at })
  }
  return ajouts
}

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** « a ajouté 3 photos à », « a écrit une note dans »… */
function ceQuIlAFait(items: FolderItem[]) {
  const n = items.length
  const sortes = new Set(items.map((i) => i.kind))
  if (sortes.size > 1) return `a ajouté ${n} souvenirs à`
  const k = items[0].kind
  if (k === 'photo') return n > 1 ? `a ajouté ${n} photos à` : 'a ajouté une photo à'
  if (k === 'note') return n > 1 ? `a écrit ${n} notes dans` : 'a écrit une note dans'
  if (k === 'dessin') return n > 1 ? `a dessiné ${n} notes dans` : 'a dessiné une note dans'
  if (k === 'audio') return n > 1 ? `a ajouté ${n} vocaux à` : 'a ajouté un vocal à'
  if (k === 'video') return n > 1 ? `a ajouté ${n} vidéos à` : 'a ajouté une vidéo à'
  return 'a écrit dans'
}

// ═════════════════════════ Le fil ═════════════════════════

function Fil({ onAlbum, onAlbums }: { onAlbum: (id: string) => void; onAlbums: () => void }) {
  const { state, run } = useHome()
  const { me, members, moments, folders, folderItems } = state
  const peutCommenter = !!state.commentaires
  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [chercher, setChercher] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [compose, setCompose] = useState<null | { fichier?: File; video?: File }>(null)
  const [sondage, setSondage] = useState<string | null>(null)
  const [commentaires, setCommentaires] = useState<{ id: string; ecrire: boolean } | null>(null)
  const [plein, setPlein] = useState<string | null>(null)
  // les feuilles des réactions (toutes les réactions, qui a réagi) : au niveau de l'écran, pas dans la carte
  const [reactionsDe, setReactionsDe] = useState<string | null>(null)
  const [quiDe, setQuiDe] = useState<string | null>(null)
  const reagirSur = useReagir()
  // un nouvel album ; avec la photo d'une publication à y garder, quand on le crée depuis « Garder »
  const [nouvelAlbum, setNouvelAlbum] = useState<null | { garder?: Moment }>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const filmerInput = useRef<HTMLInputElement>(null)

  // les commentaires, sous leur publication (du plus ancien au plus récent)
  const coms = useMemo(() => {
    const par = new Map<string, Moment[]>()
    for (const m of moments) if (m.reply_to) par.set(m.reply_to, [...(par.get(m.reply_to) ?? []), m])
    for (const l of par.values()) l.sort((a, b) => a.created_at.localeCompare(b.created_at))
    return par
  }, [moments])
  const entrees = useMemo<Entree[]>(() => {
    const posts: Entree[] = moments.filter((m) => !m.reply_to).map((mo) => ({ k: 'post', id: mo.id, at: mo.created_at, mo }))
    const albums: Entree[] = ajoutsAlbums(folderItems, folders, members).map((a) => ({ k: 'album', id: a.id, at: a.at, a }))
    return [...posts, ...albums].sort((x, y) => y.at.localeCompare(x.at))
  }, [moments, folderItems, folders, members])

  const passe = (e: Entree, f: Filtre) =>
    f === 'tout' ||
    (e.k === 'post'
      ? f === 'photos' ? !!e.mo.image_url : f === 'videos' ? !!e.mo.video_path : f === 'vocaux' ? !!e.mo.audio_path : f === 'sondages' ? !!e.mo.poll_options?.length : false
      : f === 'albums' || (f === 'photos' && e.a.items.some((i) => i.kind === 'photo')) || (f === 'videos' && e.a.items.some((i) => i.kind === 'video')) || (f === 'vocaux' && e.a.items.some((i) => i.kind === 'audio')))
  const q = sansAccents(recherche.trim())
  const nomDe = (id: string | null | undefined) => members.find((m) => m.id === id)?.display_name ?? ''
  const trouve = (e: Entree) => {
    if (!q) return true
    const textes =
      e.k === 'post'
        ? [e.mo.body, e.mo.challenge, nomDe(e.mo.member_id), ...(coms.get(e.mo.id) ?? []).map((c) => c.body)]
        : [e.a.folder.name, e.a.auteur?.display_name, ...e.a.items.flatMap((i) => [i.title, i.body])]
    return textes.some((t) => sansAccents(t ?? '').includes(q))
  }
  const visibles = entrees.filter((e) => passe(e, filtre) && trouve(e))
  // les filtres : « Tout », puis seulement ce que le fil contient (et celui qu'on regarde)
  const filtres = ([
    ['tout', 'Tout'],
    ['photos', 'Photos'],
    ['videos', 'Vidéos'],
    ['vocaux', 'Vocaux'],
    ['sondages', 'Sondages'],
    ['albums', 'Albums'],
  ] as const).filter(([k]) => k === 'tout' || k === filtre || entrees.some((e) => passe(e, k)))

  // ── de nouvelles publications pendant qu'on lit plus bas : une pastille pour remonter
  const racine = useRef<HTMLDivElement>(null)
  const connues = useRef<Set<string> | null>(null)
  if (!connues.current) connues.current = new Set(entrees.map((e) => e.id))
  const [nouvelles, setNouvelles] = useState(0)
  const boite = () => racine.current?.closest('.overflow-y-auto') as HTMLElement | null
  useEffect(() => {
    const neuves = entrees.filter((e) => !connues.current!.has(e.id) && (e.k === 'post' ? e.mo.member_id !== me.id : e.a.auteur?.id !== me.id))
    entrees.forEach((e) => connues.current!.add(e.id))
    if (!neuves.length) return
    if ((boite()?.scrollTop ?? 0) > 320) setNouvelles((n) => n + neuves.length)
  }, [entrees, me.id])
  useEffect(() => {
    const b = boite()
    if (!b) return
    const f = () => b.scrollTop < 120 && setNouvelles(0)
    b.addEventListener('scroll', f, { passive: true })
    return () => b.removeEventListener('scroll', f)
  }, [])
  const enHaut = () => {
    tap()
    setNouvelles(0)
    boite()?.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  // ce qu'on vient de publier : on remonte le voir
  const publie = () => {
    setFiltre('tout')
    setRecherche('')
    window.setTimeout(() => boite()?.scrollTo({ top: 0, behavior: 'smooth' }), 80)
  }

  // ── une photo : la prendre (l'appareil de Nidoo) ou la choisir, puis l'écrire
  const ajouterPhoto = async () => {
    tap()
    const i = await choisir({ title: 'Une photo', actions: [{ label: 'Prendre une photo' }, { label: 'Choisir dans la photothèque' }] })
    if (i === 1) return photoInput.current?.click()
    if (i !== 0) return
    const r = await prendrePhoto({ titre: 'Une photo pour le fil', galerie: true })
    if (r instanceof File) setCompose({ fichier: r })
    else if (r === 'galerie' || r === 'natif') photoInput.current?.click()
  }

  // ── une vidéo : la filmer (l'appareil de l'iPhone) ou la choisir ; elle est préparée pendant qu'on écrit
  const ajouterVideo = async () => {
    tap()
    const i = await choisir({ title: 'Une vidéo', message: 'Une minute au plus : tu choisis le passage à garder.', actions: [{ label: 'Filmer une vidéo' }, { label: 'Choisir dans la photothèque' }] })
    if (i === 0) filmerInput.current?.click()
    else if (i === 1) videoInput.current?.click()
  }

  const commentairesDe = commentaires ? moments.find((m) => m.id === commentaires.id && !m.reply_to) : undefined

  // les feuilles vont après l'écran, pas dedans : dans la zone qui défile, elles se décaleraient avec le fil
  return (
    <>
    <Screen title="Le fil" trailing={<Rond label={chercher ? 'Fermer la recherche' : 'Rechercher dans le fil'} onClick={() => {
        tap()
        setChercher(!chercher)
        setRecherche('')
        if (!chercher) window.setTimeout(() => racine.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(), 60)
      }}>{chercher ? <X size={19} /> : <Search size={19} />}</Rond>}>
      <div ref={racine}>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setCompose({ fichier: f })
          }}
        />
        {[videoInput, filmerInput].map((ref, k) => (
          <input
            key={k}
            ref={ref}
            type="file"
            accept="video/*"
            {...(k ? { capture: 'environment' as const } : {})}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setCompose({ video: f })
            }}
          />
        ))}
        {chercher && <SearchField value={recherche} onChange={setRecherche} placeholder="Une publication, un album, un proche" label="Rechercher dans le fil" />}

        {/* publier : « Quoi de neuf ? », et les raccourcis */}
        {!chercher && (
          <section className="mx-3 rounded-[24px] bg-carte p-3 shadow-carte" aria-label="Publier">
            <div className="flex items-center gap-2.5">
              <Avatar m={me} size={40} />
              <button onClick={() => { tap(); setCompose({}) }} className="presse flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-remplissage px-4 text-left text-corps text-brume">
                <span className="truncate">Quoi de neuf, {me.display_name} ?</span>
              </button>
            </div>
            <div className={`mt-2.5 grid gap-1 border-t border-trait pt-2 ${state.videos ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <Raccourci icone={<Images size={20} strokeWidth={2.2} className="text-vert-fonce" />} label="Photo" onClick={() => void ajouterPhoto()} />
              {state.videos && <Raccourci icone={<Video size={21} strokeWidth={2.2} className="text-rouge" />} label="Vidéo" onClick={() => void ajouterVideo()} />}
              <Raccourci icone={<ChartNoAxesColumn size={19} strokeWidth={2.4} className="text-peche-fonce" />} label="Sondage" onClick={() => { tap(); setSondage('') }} />
            </div>
          </section>
        )}

        {/* les albums (les anciens Souvenirs) */}
        {!chercher && <BandeAlbums onAlbum={onAlbum} onTout={onAlbums} onNouveau={() => setNouvelAlbum({})} />}

        {/* les filtres, seulement quand il y a de quoi trier */}
        {entrees.length > 0 && filtres.length > 2 && (
          <div className="no-bar mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 pt-[3px]" role="group" aria-label="Trier le fil">
            {filtres.map(([k, label]) => (
              <button key={k} onClick={() => { select(); setFiltre(k) }} aria-pressed={filtre === k} className={`presse cible flex h-9 shrink-0 items-center rounded-full px-3.5 text-note font-bold transition-colors ${filtre === k ? 'bg-teinte text-white' : 'bg-carte text-encre shadow-carte'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {nouvelles > 0 && (
          <div className="pointer-events-none sticky top-[60px] z-10 flex h-0 justify-center overflow-visible">
            <button onClick={enHaut} className="presse anim-pop pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-teinte px-4 text-sous font-bold text-white shadow-[0_8px_22px_-6px_rgba(102,70,204,0.6)]">
              <ArrowUp size={17} strokeWidth={2.6} /> {nouvelles > 1 ? 'Nouvelles publications' : 'Nouvelle publication'}
            </button>
          </div>
        )}

        {/* le fil */}
        <div className="mt-3 space-y-3">
          {visibles.length === 0 &&
            (entrees.length === 0 ? (
              <div className="flex flex-col items-center px-8 pb-6 pt-8 text-center">
                <Art name="picto-bulle" size={72} className="anim-flotte" />
                <p className="mt-3 font-rond text-titre3">Le fil est tout neuf</p>
                <p className="mt-1 max-w-[290px] text-sous text-brume">Une photo, un mot, un sondage : toute la famille le voit, réagit et commente.</p>
                <Btn className="mt-5 max-w-[240px]" onClick={() => setCompose({})}>Publier quelque chose</Btn>
              </div>
            ) : (
              <div className="px-8 py-10 text-center">
                <p className="font-rond text-titre3">Aucun résultat</p>
                <p className="mt-1 text-sous text-brume">{q ? 'Essaie un autre mot.' : 'Rien de ce genre dans le fil pour l’instant.'}</p>
                <button onClick={() => { setFiltre('tout'); setRecherche('') }} className="presse mt-3 min-h-11 text-sous font-semibold text-teinte-fonce">Tout afficher</button>
              </div>
            ))}
          <ParPaquets items={visibles} cle={filtre + q}>
            {(e) =>
              e.k === 'post' ? (
                <Publication
                  key={e.id}
                  mo={e.mo}
                  coms={coms.get(e.mo.id) ?? []}
                  peutCommenter={peutCommenter}
                  onPhoto={setPlein}
                  onCommentaires={(ecrire) => setCommentaires({ id: e.mo.id, ecrire })}
                  onNouvelAlbum={() => setNouvelAlbum({ garder: e.mo })}
                  onToutes={() => setReactionsDe(e.mo.id)}
                  onQui={() => setQuiDe(e.mo.id)}
                />
              ) : (
                <AjoutAlbum key={e.id} a={e.a} onAlbum={() => onAlbum(e.a.folder.id)} onPhoto={setPlein} />
              )
            }
          </ParPaquets>
        </div>
      </div>
    </Screen>

      {compose && (
        <NouvellePublication
          fichier={compose.fichier}
          video={compose.video}
          onSondage={(question) => { setCompose(null); setSondage(question) }}
          onClose={(ok) => {
            setCompose(null)
            if (ok) publie()
          }}
        />
      )}
      {sondage !== null && (
        <SondageCompose
          question0={sondage}
          onClose={() => setSondage(null)}
          envoyer={async (m: NouvelEnvoi) => {
            const ok = await run((api) => api.postMoment(state.family.id, me.id, m))
            if (ok) {
              success()
              publie()
            }
            return ok
          }}
        />
      )}
      {commentairesDe && <FeuilleCommentaires post={commentairesDe} ecrire={commentaires!.ecrire} onPhoto={setPlein} onClose={() => setCommentaires(null)} />}
      {nouvelAlbum && (
        <NewFolderSheet
          onClose={() => setNouvelAlbum(null)}
          onCreated={(id) => {
            const mo = nouvelAlbum.garder
            setNouvelAlbum(null)
            onAlbum(id)
            if (!mo?.image_url && !mo?.video_url) return
            const t = new Date().toISOString()
            const album: Folder = { id, family_id: state.family.id, parent_id: null, root_id: id, owner_id: me.id, name: '', cover_path: null, created_at: t, updated_at: t }
            void run(async (api) => {
              const g = await aGarder(mo)
              if (g) await api.addFolderItem(album, me.id, g.kind === 'photo' ? { kind: 'photo', blob: g.blob, body: mo.body ?? undefined, sourceMomentId: mo.id } : { kind: 'video', blob: g.blob, title: mo.body?.slice(0, 80) || undefined, sourceMomentId: mo.id })
            })
          }}
        />
      )}
      {reactionsDe && (() => {
        const mo = moments.find((m) => m.id === reactionsDe)
        if (!mo) return null
        return (
          <ToutesReactions
            ma={state.reactions.find((r) => r.moment_id === mo.id && r.member_id === me.id)?.emoji}
            onChoix={(cle) => {
              setReactionsDe(null)
              reagirSur(mo, cle)
            }}
            onClose={() => setReactionsDe(null)}
          />
        )
      })()}
      {quiDe && <QuiAReagi momentId={quiDe} onClose={() => setQuiDe(null)} />}
      {plein && <PhotoEnGrand url={plein} onClose={() => setPlein(null)} />}
    </>
  )
}

/** Le fil se montre par paquets de 8 : « Voir plus » en bas pour la suite. */
function ParPaquets<T>({ items, cle, children }: { items: T[]; cle: string; children: (x: T) => ReactNode }) {
  const [n, setN] = useState(8)
  useEffect(() => setN(8), [cle])
  return (
    <>
      {items.slice(0, n).map(children)}
      {items.length > n && (
        <button onClick={() => { tap(); setN((x) => x + 8) }} className="presse mx-auto mt-1 block min-h-11 rounded-full bg-teinte-doux px-5 text-note font-semibold text-teinte-fonce">
          Voir les publications plus anciennes
        </button>
      )}
    </>
  )
}

function Raccourci({ icone, label, onClick }: { icone: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="presse flex h-11 items-center justify-center gap-1.5 rounded-[14px] text-sous font-semibold text-encre">
      {icone}
      {label}
    </button>
  )
}

// ═════════════════════════ Les albums, en bande ═════════════════════════

function BandeAlbums({ onAlbum, onTout, onNouveau }: { onAlbum: (id: string) => void; onTout: () => void; onNouveau: () => void }) {
  const { state } = useHome()
  const { folders, folderItems, folderMembers, me, members } = state
  const albums = useMemo(
    () =>
      folders
        .filter((f) => !f.parent_id)
        .map((f) => ({ f, s: folderStats(folders, folderItems, f) }))
        .sort((a, b) => b.s.last - a.s.last),
    [folders, folderItems],
  )
  return (
    <section className="mt-5" aria-label="Albums">
      <div className="mb-2 flex items-baseline justify-between px-5">
        <h2 className="font-rond text-titre3">Albums</h2>
        {albums.length > 0 && (
          <button onClick={() => { tap(); onTout() }} className="presse cible flex items-center gap-0.5 text-note font-semibold text-teinte-fonce">
            Tout voir <ChevronRight size={15} strokeWidth={2.6} />
          </button>
        )}
      </div>
      <div className="no-bar flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5">
        <button onClick={() => { tap(); onNouveau() }} className="presse flex h-[156px] w-[118px] shrink-0 flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-teinte/30 bg-teinte-doux px-3 text-center text-teinte-fonce">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-carte">
            <Plus size={22} strokeWidth={2.6} />
          </span>
          <span className="text-note font-bold leading-tight">{albums.length ? 'Nouvel album' : 'Créer un premier album'}</span>
        </button>
        {albums.map(({ f, s }) => {
          const ids = membersOf(folderMembers, f.id)
          return (
            <button key={f.id} onClick={() => { tap(); onAlbum(f.id) }} className="presse relative h-[156px] w-[118px] shrink-0 overflow-hidden rounded-[20px] text-left shadow-carte" aria-label={`${f.name}, ${whoText(ids, me.id, members)}`}>
              <FolderCover folder={f} url={s.cover} size="md" />
              <span className={`absolute inset-x-0 bottom-0 h-[62%] ${s.cover ? 'bg-gradient-to-t from-black/65 via-black/25 to-transparent' : ''}`} />
              <span className="verre absolute left-2 top-2 flex h-6 items-center gap-1 rounded-full px-2 text-mini font-bold text-encre">
                {ids.length <= 1 ? <Lock size={11} strokeWidth={2.8} /> : <UsersRound size={12} strokeWidth={2.6} />}
                {ids.length <= 1 ? 'Toi' : ids.length}
              </span>
              <span className={`absolute inset-x-2.5 bottom-2.5 line-clamp-2 font-rond text-sous font-bold leading-tight ${s.cover ? 'text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.3)]' : 'text-encre'}`}>{f.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ═════════════════════════ Une publication ═════════════════════════

/** Ce qu'on garde d'une publication dans un album : sa photo, ou sa vidéo. */
async function aGarder(mo: Moment): Promise<{ kind: 'photo' | 'video'; blob: Blob } | null> {
  if (mo.image_url) return { kind: 'photo', blob: await photoBlob(mo.image_url) }
  if (mo.video_url) {
    const r = await fetch(mo.video_url)
    if (!r.ok) throw new Error('VIDEO_INACCESSIBLE')
    const b = await r.blob()
    const type = b.type.startsWith('video/') ? b.type.split(';')[0] : mo.video_path?.endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
    return { kind: 'video', blob: b.type === type ? b : new Blob([b], { type }) }
  }
  return null
}

/** « Toi et 2 autres », « Léa et Papa », « Léa, Papa et 3 autres » */
function quiAReagi(ids: string[], me: string, members: Member[]) {
  const noms = ids.filter((id) => id !== me).map((id) => members.find((m) => m.id === id)?.display_name).filter((x): x is string => !!x)
  const moi = ids.includes(me)
  if (moi) return noms.length ? `Toi et ${noms.length > 1 ? `${noms.length} autres` : noms[0]}` : 'Toi'
  if (noms.length <= 2) return noms.join(' et ')
  return `${noms[0]}, ${noms[1]} et ${noms.length - 2} autre${noms.length > 3 ? 's' : ''}`
}

/** Réagir à une publication (ou retirer sa réaction), tout de suite à l'écran. */
function useReagir() {
  const { state, run } = useHome()
  return (mo: Moment, cle: string | null) => {
    select()
    if (cle) retenir(cle)
    void run(
      (api) => api.react(mo, state.me.id, cle),
      undefined,
      (st: FamilyState) => ({ ...st, reactions: [...st.reactions.filter((r) => !(r.moment_id === mo.id && r.member_id === st.me.id)), ...(cle ? [{ moment_id: mo.id, member_id: st.me.id, emoji: cle }] : [])] }),
    )
  }
}

function Publication({ mo, coms, peutCommenter, onPhoto, onCommentaires, onNouvelAlbum, onToutes, onQui }: { mo: Moment; coms: Moment[]; peutCommenter: boolean; onPhoto: (url: string) => void; onCommentaires: (ecrire: boolean) => void; onNouvelAlbum: () => void; onToutes: () => void; onQui: () => void }) {
  const { state, run, toast } = useHome()
  const { me, members, reactions, folders, folderItems } = state
  const auteur = members.find((m) => m.id === mo.member_id)
  const mien = mo.member_id === me.id
  // les réactions qu'on sait afficher (une version plus récente de Nidoo peut en avoir d'autres)
  const rs = reactions.filter((r) => r.moment_id === mo.id && reaction(r.emoji))
  const ma = rs.find((r) => r.member_id === me.id)?.emoji
  const sortes = lesPlusDonnees(rs.map((r) => r.emoji)).slice(0, 3)
  const gardee = folderItems.some((i) => i.source_moment_id === mo.id)
  const sondage = !!mo.poll_options?.length
  const stickerSeul = !!mo.sticker && !mo.image_url && !mo.video_path && !mo.audio_path && !mo.body
  const court = !!mo.body && !mo.image_url && !mo.video_path && !mo.audio_path && !sondage && mo.body.length <= 90 && !/https?:|www\./.test(mo.body)
  // une photo ou une vidéo : on peut la garder dans un album
  const gardable = !!mo.image_url || !!mo.video_url
  const [choix, setChoix] = useState(false)
  const reagirSur = useReagir()
  const reagir = (cle: string | null) => {
    setChoix(false)
    reagirSur(mo, cle)
  }

  const garder = async () => {
    tap()
    // les albums où elle n'est pas encore
    const albums = folders.filter((f) => !f.parent_id && !folderItems.some((x) => x.folder_id === f.id && x.source_moment_id === mo.id))
    if (!folders.some((f) => !f.parent_id)) return onNouvelAlbum()
    const i = await choisir({ title: mo.video_url ? 'Garder la vidéo dans un album' : 'Garder la photo dans un album', message: gardee ? 'Elle est déjà gardée dans un album.' : undefined, actions: [...albums.map((f) => ({ label: f.name })), { label: 'Nouvel album' }] })
    if (i === albums.length) return onNouvelAlbum()
    const album = albums[i]
    if (!album || !gardable) return
    // le bouton devient « Gardée » : pas besoin d'un message en plus
    if (
      await run(async (api) => {
        const g = await aGarder(mo)
        if (!g) return
        await api.addFolderItem(album, me.id, g.kind === 'photo' ? { kind: 'photo', blob: g.blob, body: mo.body ?? undefined, sourceMomentId: mo.id } : { kind: 'video', blob: g.blob, title: mo.body?.slice(0, 80) || undefined, sourceMomentId: mo.id })
      })
    )
      success()
  }

  const options = async () => {
    tap()
    const actions: { label: string; destructive?: boolean; go: () => void }[] = [
      { label: 'Réagir', go: onToutes },
      ...(gardable ? [{ label: 'Garder dans un album', go: () => void garder() }] : []),
      ...(mo.body && !sondage ? [{ label: 'Copier le texte', go: () => void navigator.clipboard?.writeText(mo.body!).then(() => toast('Texte copié')).catch(() => undefined) }] : []),
      ...(mien ? [{ label: 'Supprimer la publication', destructive: true, go: async () => {
        const corbeille = !!state.corbeille
        const message = `Elle disparaît du fil pour toute la famille${coms.length ? ', avec ses commentaires' : ''}.${corbeille ? ' Tu pourras la remettre pendant 30 jours : Albums › Supprimés récemment.' : ''}`
        if (!(await confirmer({ title: 'Supprimer cette publication ?', message, confirm: 'Supprimer', destructive: true }))) return
        if (!corbeille) return void run((api) => api.deleteMoment(mo))
        // à la corbeille : elle quitte le fil tout de suite, et m'attend dans « Supprimés récemment »
        void run(
          (api) => api.jeter('moments', mo.id),
          undefined,
          (st: FamilyState) => ({ ...st, moments: st.moments.filter((m) => m.id !== mo.id), jetes: { moments: [{ ...mo, deleted_at: new Date().toISOString(), deleted_by: st.me.id }, ...(st.jetes?.moments ?? [])], folders: st.jetes?.folders ?? [], folderItems: st.jetes?.folderItems ?? [] } }),
        )
      } }] : []),
    ]
    const i = await choisir({ actions })
    if (i >= 0) actions[i].go()
  }

  if (!auteur) return null
  const derniers = coms.slice(-2)
  return (
    <article className="relative mx-3 rounded-[24px] bg-carte shadow-carte" aria-label={`Publication de ${auteur.display_name}`}>
      {/* qui, quand */}
      <header className="flex items-center gap-3 pl-4 pr-1.5 pt-3.5">
        <Avatar m={auteur} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-corps font-bold leading-tight">{auteur.display_name}</p>
          <p className="truncate text-note text-brume">{ago(mo.created_at)}{sondage ? ' · a lancé un sondage' : ''}</p>
        </div>
        <button onClick={() => void options()} className="presse flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brume" aria-label="Plus d’options">
          <Ellipsis size={21} />
        </button>
      </header>

      {/* ce qu'on publie */}
      {mo.challenge && (
        <p className="mx-4 mt-2.5 inline-flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full bg-peche-doux px-3 py-1 text-note font-semibold text-peche-fonce">
          <Sparkles size={13} strokeWidth={2.6} className="shrink-0" /> <span className="truncate">Défi photo · {mo.challenge}</span>
        </p>
      )}
      {mo.body && !sondage && (
        <div className="px-4 pt-2">
          <Texte body={mo.body} mine={false} grand={court} />
          <Apercu body={mo.body} mine={false} />
        </div>
      )}
      {sondage && (
        <div className="px-4 pt-2.5">
          <Sondage mo={mo} mine={false} pleine />
        </div>
      )}
      {stickerSeul && (
        <div className="px-4 pt-2">
          <StickerImg cle={mo.sticker!} className="block h-[128px] w-[128px] object-contain" />
        </div>
      )}
      {mo.video_path && <VideoDuFil mo={mo} />}
      {mo.image_url && (
        <button onClick={() => onPhoto(mo.image_url!)} className="mt-3 block w-full overflow-hidden bg-remplissage" aria-label="Voir la photo en grand">
          <img src={mo.image_url} alt={mo.body ?? `Photo de ${auteur.display_name}`} loading="lazy" className="block max-h-[540px] w-full object-cover" />
        </button>
      )}
      {mo.audio_path && (
        <div className="mx-4 mt-3 rounded-[18px] bg-teinte-doux px-3 py-1.5">
          {mo.audio_url ? <Vocal mo={mo} mine={false} /> : <p className="py-2 text-sous text-brume">Vocal indisponible</p>}
        </div>
      )}

      {/* qui a réagi, combien de commentaires */}
      {(rs.length > 0 || coms.length > 0) && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 text-note text-brume">
          {rs.length > 0 ? (
            <button onClick={() => { tap(); onQui() }} className="presse cible flex min-w-0 items-center gap-1.5 text-left" aria-label={`Réactions : ${quiAReagi(rs.map((r) => r.member_id), me.id, members)}. Voir qui a réagi`}>
              <span className="flex shrink-0">
                {sortes.map((r, k) => (
                  <span key={r.cle} className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white shadow-[0_0_0_2px_#fff]" style={{ marginLeft: k ? -6 : 0, zIndex: 3 - k }}>
                    <ReactionImg r={r} size={18} />
                  </span>
                ))}
              </span>
              <span className="truncate">{quiAReagi(rs.map((r) => r.member_id), me.id, members)}</span>
            </button>
          ) : (
            <span />
          )}
          {coms.length > 0 && peutCommenter && (
            <button onClick={() => { tap(); onCommentaires(false) }} className="presse cible shrink-0">
              {coms.length} commentaire{coms.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* réagir, commenter, garder */}
      <div className={`relative mx-2 mt-2 grid border-t border-trait ${[true, peutCommenter, gardable].filter(Boolean).length === 3 ? 'grid-cols-3' : [true, peutCommenter, gardable].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <BoutonReaction ma={ma} onTap={() => reagir(ma ? null : 'coeur')} onLong={() => { select(); setChoix(true) }} />
        {peutCommenter && (
          <button onClick={() => { tap(); onCommentaires(true) }} className="presse flex h-11 items-center justify-center gap-1.5 text-sous font-semibold text-brume">
            <MessageCircle size={19} strokeWidth={2.2} /> Commenter
          </button>
        )}
        {gardable && (
          <button onClick={() => void garder()} className={`presse flex h-11 items-center justify-center gap-1.5 text-sous font-semibold ${gardee ? 'text-teinte-fonce' : 'text-brume'}`}>
            {gardee ? <BookmarkCheck size={19} strokeWidth={2.2} /> : <BookmarkPlus size={19} strokeWidth={2.2} />} {gardee ? 'Gardée' : 'Garder'}
          </button>
        )}
        {choix && <ChoixReaction ma={ma} onChoix={reagir} onPlus={() => { tap(); setChoix(false); onToutes() }} onClose={() => setChoix(false)} />}
      </div>

      {/* les derniers commentaires, et l'endroit pour en écrire un */}
      {peutCommenter && (
        <div className="space-y-2 px-4 pb-3.5 pt-1">
          {coms.length > 2 && (
            <button onClick={() => { tap(); onCommentaires(false) }} className="presse cible text-sous font-semibold text-brume">
              Voir les {coms.length} commentaires
            </button>
          )}
          {derniers.map((c) => (
            <button key={c.id} onClick={() => { tap(); onCommentaires(false) }} className="flex w-full items-start gap-2 text-left">
              <Avatar m={members.find((m) => m.id === c.member_id) ?? auteur} size={30} />
              <span className="min-w-0 rounded-[18px] bg-remplissage px-3 py-1.5">
                <span className="block text-note font-bold">{nomCourt(members, c.member_id)}</span>
                <span className="line-clamp-3 block whitespace-pre-wrap break-words text-sous">{c.body}</span>
              </span>
            </button>
          ))}
          <button onClick={() => { tap(); onCommentaires(true) }} className="flex w-full items-center gap-2 text-left">
            <Avatar m={me} size={30} />
            <span className="flex min-h-[38px] flex-1 items-center rounded-full bg-remplissage px-3.5 text-sous text-brume">Écrire un commentaire…</span>
          </button>
        </div>
      )}
      {!peutCommenter && <div className="h-1.5" />}
    </article>
  )
}

const nomCourt = (members: Member[], id: string) => members.find((m) => m.id === id)?.display_name ?? 'Un proche'

/** Toucher : J'aime (ou retirer sa réaction). Appuyer longtemps : choisir sa réaction (comme sur Facebook). */
function BoutonReaction({ ma, onTap, onLong }: { ma?: string; onTap: () => void; onLong: () => void }) {
  const minuteur = useRef<number | null>(null)
  const long = useRef(false)
  const r = reaction(ma)
  const fin = () => {
    if (minuteur.current) window.clearTimeout(minuteur.current)
    minuteur.current = null
  }
  return (
    <button
      onPointerDown={() => {
        long.current = false
        fin()
        minuteur.current = window.setTimeout(() => {
          long.current = true
          minuteur.current = null
          onLong()
        }, 430)
      }}
      onPointerUp={fin}
      onPointerLeave={fin}
      onPointerCancel={fin}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (long.current) return void (long.current = false)
        onTap()
      }}
      aria-label={r ? `Ta réaction : ${r.emoji ?? r.label}. Toucher pour la retirer, appuyer longtemps pour en choisir une autre` : 'J’aime. Appuyer longtemps pour choisir une réaction'}
      className={`presse flex h-11 select-none items-center justify-center gap-1.5 text-sous font-semibold [-webkit-touch-callout:none] ${r ? 'text-teinte-fonce' : 'text-brume'}`}
    >
      {r ? <span key={r.cle} className="anim-pop flex"><ReactionImg r={r} size={21} /></span> : <Heart size={19} strokeWidth={2.2} />}
      <span className="max-w-[92px] truncate">{r ? motDe(r) : 'J’aime'}</span>
    </button>
  )
}

/** L'appui long sur J'aime : les cinq réactions du panda, la sienne si elle vient d'ailleurs, et « + » pour toutes les
 *  autres. */
function ChoixReaction({ ma, onChoix, onPlus, onClose }: { ma?: string; onChoix: (cle: string | null) => void; onPlus: () => void; onClose: () => void }) {
  const mienne = reaction(ma)
  const liste = mienne && !RAPIDES.some((r) => r.cle === mienne.cle) ? [...RAPIDES, mienne] : RAPIDES
  return (
    <>
      <button className="fixed inset-0 z-[60] cursor-default" aria-label="Fermer les réactions" onClick={onClose} />
      <div className="anim-pop absolute bottom-[calc(100%+6px)] left-1 z-[61] flex items-center gap-0.5 rounded-full bg-white p-1.5 shadow-[0_12px_32px_rgba(29,26,43,0.24)]" role="group" aria-label="Choisir une réaction">
        {liste.map((r, i) => (
          <button
            key={r.cle}
            onClick={() => onChoix(ma === r.cle ? null : r.cle)}
            aria-label={r.emoji ? `Réagir avec ${r.emoji}` : r.label}
            aria-pressed={ma === r.cle}
            className={`reaction-choix flex h-11 items-center justify-center rounded-full ${liste.length > 5 ? 'w-[42px]' : 'w-11'} ${ma === r.cle ? 'bg-teinte-doux' : ''}`}
            style={{ animationDelay: `${i * 0.035}s` } as CSSProperties}
          >
            <ReactionImg r={r} size={32} />
          </button>
        ))}
        <button
          onClick={onPlus}
          aria-label="Plus de réactions"
          className="reaction-choix ml-0.5 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ animationDelay: `${liste.length * 0.035}s` } as CSSProperties}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-remplissage text-encre">
            <Plus size={20} strokeWidth={2.6} />
          </span>
        </button>
      </div>
    </>
  )
}

// ═════════════════════════ Ce que quelqu'un a mis dans un album ═════════════════════════

function AjoutAlbum({ a, onAlbum, onPhoto }: { a: Ajout; onAlbum: () => void; onPhoto: (url: string) => void }) {
  const { state } = useHome()
  const { me, members, folderMembers } = state
  const ids = membersOf(folderMembers, a.folder.root_id)
  const photos = a.items.filter((i) => (i.kind === 'photo' || i.kind === 'dessin') && i.image_url)
  const autres = a.items.filter((i) => !(i.kind === 'photo' || i.kind === 'dessin'))
  const premier = autres[0]
  const qui = a.auteur?.id === me.id ? 'Tu' : a.auteur?.display_name ?? 'Un proche'
  const phrase = ceQuIlAFait(a.items).replace(/^a /, a.auteur?.id === me.id ? 'as ' : 'a ')
  return (
    <article className="mx-3 overflow-hidden rounded-[24px] bg-carte shadow-carte" aria-label={`${qui} ${phrase} ${a.folder.name}`}>
      <header className="flex items-start gap-3 px-4 pt-3.5">
        {a.auteur ? <Avatar m={a.auteur} size={42} /> : <span className="h-[42px] w-[42px] rounded-full bg-remplissage" />}
        <div className="min-w-0 flex-1">
          <p className="text-sous leading-snug">
            <b className="font-bold">{qui}</b> {phrase} <b className="font-bold">{a.folder.name}</b>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-note text-brume">
            {ago(a.at)} · {ids.length <= 1 ? <Lock size={12} strokeWidth={2.6} className="shrink-0" /> : <UsersRound size={13} strokeWidth={2.4} className="shrink-0" />}
            <span className="truncate">{whoText(ids, me.id, members)}</span>
          </p>
        </div>
      </header>

      {photos.length > 0 && <Mosaique photos={photos} onPhoto={onPhoto} />}
      {premier && (
        <div className="mx-4 mt-3">
          {premier.kind === 'note' && (
            <div className="rounded-[18px] bg-[#FFF7DE] px-4 py-3">
              <p className="font-rond text-corps font-bold">{premier.title || 'Une note'}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-sous text-encre/80">{premier.body}</p>
            </div>
          )}
          {premier.kind === 'message' && <p className="rounded-[18px] bg-remplissage px-3.5 py-2.5 text-corps">« {premier.body} »</p>}
          {premier.kind === 'audio' && (premier.media_url ? <audio src={premier.media_url} controls preload="metadata" className="w-full" /> : <p className="text-sous text-brume">Un souvenir vocal</p>)}
          {premier.kind === 'video' && premier.media_url && <video src={premier.media_url} controls playsInline preload="metadata" className="max-h-[340px] w-full rounded-[16px] bg-black" />}
          {autres.length > 1 && <p className="mt-2 text-note text-brume">Et {autres.length - 1} autre{autres.length > 2 ? 's' : ''} souvenir{autres.length > 2 ? 's' : ''}</p>}
        </div>
      )}
      {/* comme la barre d'une publication : une seule action, ouvrir l'album (on y réagit et on y écrit) */}
      <div className="mx-2 mt-3 border-t border-trait">
        <button onClick={() => { tap(); onAlbum() }} className="presse flex h-11 w-full items-center justify-center gap-1.5 text-sous font-semibold text-teinte-fonce">
          <BookOpen size={18} strokeWidth={2.3} /> Ouvrir l’album
        </button>
      </div>
    </article>
  )
}

/** Les photos d'un ajout : une seule en grand ; deux côte à côte ; trois, une grande et deux petites ; quatre et plus,
 *  un carré de quatre et « +N ». */
function Mosaique({ photos, onPhoto }: { photos: FolderItem[]; onPhoto: (url: string) => void }) {
  const n = photos.length
  const vues = photos.slice(0, 4)
  const tuile = (p: FolderItem, k: number, className: string) => (
    <button key={p.id} onClick={() => onPhoto(p.image_url!)} className={`relative overflow-hidden bg-remplissage ${className}`} aria-label={p.body ?? `Photo ${k + 1}`}>
      <img src={p.image_url!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      {k === 3 && n > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 font-rond text-titre2 text-white">+{n - 4}</span>}
    </button>
  )
  if (n === 1) return <div className="mt-3">{tuile(photos[0], 0, 'block aspect-[4/3] w-full')}</div>
  if (n === 2) return <div className="mt-3 grid grid-cols-2 gap-0.5">{vues.map((p, k) => tuile(p, k, 'aspect-[3/4]'))}</div>
  if (n === 3)
    return (
      <div className="mt-3 grid h-[300px] grid-cols-2 grid-rows-2 gap-0.5">
        {tuile(photos[0], 0, 'row-span-2')}
        {tuile(photos[1], 1, '')}
        {tuile(photos[2], 2, '')}
      </div>
    )
  return <div className="mt-3 grid grid-cols-2 gap-0.5">{vues.map((p, k) => tuile(p, k, 'aspect-square'))}</div>
}

// ═════════════════════════ Les commentaires ═════════════════════════

function FeuilleCommentaires({ post, ecrire, onPhoto, onClose }: { post: Moment; ecrire: boolean; onPhoto: (url: string) => void; onClose: () => void }) {
  const { state, run } = useHome()
  const { me, members, moments, reactions, family } = state
  const liste = moments.filter((m) => m.reply_to === post.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const auteur = members.find((m) => m.id === post.member_id)
  const [texte, setTexte] = useState('')
  const zone = useRef<HTMLTextAreaElement>(null)
  const fin = useRef<HTMLDivElement>(null)
  const avant = useRef(liste.length)
  // un commentaire arrive (le sien, ou celui d'un proche) : on le montre
  useEffect(() => {
    if (liste.length > avant.current) fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    avant.current = liste.length
  }, [liste.length])
  useEffect(() => {
    if (ecrire) window.setTimeout(() => zone.current?.focus(), 350)
  }, [ecrire])
  // la zone grandit avec le commentaire (jusqu'à 5 lignes)
  useEffect(() => {
    const z = zone.current
    if (!z) return
    z.style.height = 'auto'
    z.style.height = `${Math.min(z.scrollHeight, 22 * 5 + 20)}px`
  }, [texte])

  const envoyer = async () => {
    const t = texte.trim().slice(0, 1000)
    if (!t) return
    setTexte('')
    const provisoire: Moment = { id: `envoi-${Date.now().toString(36)}`, family_id: family.id, member_id: me.id, image_path: null, body: t, challenge: null, created_at: new Date().toISOString(), reply_to: post.id }
    const ok = await run((api) => api.postMoment(family.id, me.id, { body: t, replyTo: post.id }), undefined, (st: FamilyState) => ({ ...st, moments: [provisoire, ...st.moments] }))
    if (ok) success()
    else setTexte((x) => x || t)
  }

  return (
    <Sheet
      title="Commentaires"
      tall
      onClose={onClose}
      footer={
        <div className="flex items-end gap-2">
          <textarea
            ref={zone}
            rows={1}
            value={texte}
            maxLength={1000}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                e.preventDefault()
                void envoyer()
              }
            }}
            placeholder="Écrire un commentaire…"
            aria-label="Ton commentaire"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-[22px] bg-carte px-4 py-[10px] text-corps leading-[22px] shadow-carte outline-none placeholder:text-brume focus:ring-2 focus:ring-teinte/40"
          />
          <button onClick={() => void envoyer()} disabled={!texte.trim()} className="presse ios-primary btn-desactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" aria-label="Publier le commentaire">
            <ArrowUp size={21} strokeWidth={2.6} />
          </button>
        </div>
      }
    >
      {/* la publication, en petit */}
      {auteur && (
        <div className="mb-4 flex items-start gap-3 rounded-[20px] bg-carte p-3 shadow-carte">
          <Avatar m={auteur} size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-sous font-bold">
              {auteur.display_name} <span className="font-normal text-brume">· {ago(post.created_at)}</span>
            </p>
            {post.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-sous">{post.body}</p>}
            {!post.body && post.audio_path && <p className="mt-0.5 text-sous text-brume">Un vocal</p>}
            {!post.body && post.sticker && <p className="mt-0.5 text-sous text-brume">Un sticker</p>}
            {!post.body && post.video_path && <p className="mt-0.5 text-sous text-brume">Une vidéo</p>}
          </div>
          {!post.image_url && post.poster_url && (
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-black">
              <img src={post.poster_url} alt="" className="h-full w-full object-cover" />
              <Video size={16} className="absolute bottom-1 right-1 text-white drop-shadow" />
            </span>
          )}
          {post.image_url && (
            <button onClick={() => onPhoto(post.image_url!)} className="h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-remplissage" aria-label="Voir la photo en grand">
              <img src={post.image_url} alt="" className="h-full w-full object-cover" />
            </button>
          )}
        </div>
      )}

      {liste.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <Art name="picto-bulle" size={56} className="mx-auto" />
          <p className="mt-2 font-rond text-titre3">Pas encore de commentaire</p>
          <p className="mt-1 text-sous text-brume">Écris le premier : toute la famille le verra.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liste.map((c) => (
            <Commentaire key={c.id} c={c} aime={reactions.some((r) => r.moment_id === c.id && r.member_id === me.id)} nbAime={reactions.filter((r) => r.moment_id === c.id).length} />
          ))}
        </div>
      )}
      <div ref={fin} className="h-1" />
    </Sheet>
  )
}

function Commentaire({ c, aime, nbAime }: { c: Moment; aime: boolean; nbAime: number }) {
  const { state, run } = useHome()
  const { me, members } = state
  const auteur = members.find((m) => m.id === c.member_id)
  const provisoire = c.id.startsWith('envoi-')
  const mien = c.member_id === me.id
  if (!auteur) return null
  return (
    <div className={`flex items-start gap-2.5 transition-opacity ${provisoire ? 'opacity-60' : 'anim-fondu'}`}>
      <Avatar m={auteur} size={34} />
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-[18px] bg-carte px-3.5 py-2 shadow-carte">
          <p className="text-note font-bold">{auteur.display_name}</p>
          {c.body && <p className="whitespace-pre-wrap break-words text-sous">{c.body}</p>}
          {c.sticker && <StickerImg cle={c.sticker} className="mt-1 block h-16 w-16 object-contain" />}
        </div>
        <div className="mt-1 flex items-center gap-3.5 pl-2 text-note text-brume">
          <span>{provisoire ? 'Envoi…' : ago(c.created_at)}</span>
          {!provisoire && (
            <button
              onClick={() => {
                select()
                void run((api) => api.react(c, me.id, aime ? null : 'coeur'), undefined, (st: FamilyState) => ({
                  ...st,
                  reactions: [...st.reactions.filter((r) => !(r.moment_id === c.id && r.member_id === me.id)), ...(aime ? [] : [{ moment_id: c.id, member_id: me.id, emoji: 'coeur' }])],
                }))
              }}
              aria-pressed={aime}
              className={`presse cible font-semibold ${aime ? 'text-teinte-fonce' : ''}`}
            >
              J’aime
            </button>
          )}
          {nbAime > 0 && (
            <span className="flex items-center gap-0.5" aria-label={`${nbAime} j’aime`}>
              <Heart size={12} strokeWidth={0} fill="#D23F72" /> {nbAime}
            </span>
          )}
          {mien && !provisoire && (
            <button
              onClick={async () => {
                if (await confirmer({ title: 'Supprimer ce commentaire ?', confirm: 'Supprimer', destructive: true })) void run((api) => api.deleteMoment(c))
              }}
              className="presse cible font-semibold"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════ Publier ═════════════════════════

function NouvellePublication({ fichier, video: videoChoisie, onSondage, onClose }: { fichier?: File; video?: File; onSondage: (question: string) => void; onClose: (publie: boolean) => void }) {
  const { state, run, toast } = useHome()
  const { me, family, folders, folderMembers, members } = state
  const [texte, setTexte] = useState('')
  // où : toute la famille (null), ou un album (et seulement ses membres)
  const [ou, setOu] = useState<string | null>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [sticker, setSticker] = useState<string | null>(null)
  const [tiroir, setTiroir] = useState(false)
  const [decorer, setDecorer] = useState<File | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const filmerInput = useRef<HTMLInputElement>(null)
  const zone = useRef<HTMLTextAreaElement>(null)
  const albums = folders.filter((f) => !f.parent_id)
  const album = ou ? albums.find((f) => f.id === ou) ?? null : null
  // une vidéo, préparée pendant qu'on écrit (1 minute au plus, comme dans le fil)
  const vid = useVideoAPreparer(VIDEO_FIL_MAX_S, (m) => toast(m, 'err'))
  const video = vid.video
  // le fil sait-il garder une vidéo ? (la base à jour) ; un album, toujours
  const videoPossible = !!album || !!state.videos

  const poserPhoto = async (f: File) => {
    try {
      const blob = await compressImage(f, 1600, 0.86)
      setPhoto((x) => {
        if (x) URL.revokeObjectURL(x.url)
        return { blob, url: URL.createObjectURL(blob) }
      })
      setSticker(null)
      vid.retirer()
    } catch {
      toast('Cette photo ne s’ouvre pas. Essaie une autre.', 'err')
    }
  }
  useEffect(() => {
    if (fichier) void poserPhoto(fichier)
    else if (videoChoisie) void poserVideo(videoChoisie)
    else window.setTimeout(() => zone.current?.focus(), 350)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo])
  // avec une photo, une vidéo ou un sticker : texte plus court et barre d'ajout compacte, pour que tout tienne
  const joint = !!(photo || video || sticker)
  const [ratioPhoto, setRatioPhoto] = useState(4 / 3)
  const cadre = useHauteurQuiTient(!!photo && !tiroir, ratioPhoto, 170, [joint, album?.id])
  const etroite = !!cadre.h && cadre.h * ratioPhoto < 240
  useEffect(() => {
    const z = zone.current
    if (!z) return
    z.style.height = 'auto'
    z.style.height = `${Math.max(joint ? 52 : 96, Math.min(z.scrollHeight, joint ? 120 : 240))}px`
  }, [texte, joint])

  const choisirPhoto = async () => {
    tap()
    const i = await choisir({ title: 'Une photo', actions: [{ label: 'Prendre une photo' }, { label: 'Choisir dans la photothèque' }] })
    if (i === 1) return input.current?.click()
    if (i !== 0) return
    const r = await prendrePhoto({ titre: album ? album.name : 'Une photo pour le fil', galerie: true })
    if (r instanceof File) void poserPhoto(r)
    else if (r === 'galerie' || r === 'natif') input.current?.click()
  }
  const poserVideo = (f: File) => {
    setPhoto(null)
    setSticker(null)
    setTiroir(false)
    void vid.lancer(f)
  }
  const choisirVideo = async () => {
    tap()
    const i = await choisir({ title: 'Une vidéo', message: 'Une minute au plus : tu choisis le passage à garder.', actions: [{ label: 'Filmer une vidéo' }, { label: 'Choisir dans la photothèque' }] })
    if (i === 0) filmerInput.current?.click()
    else if (i === 1) videoInput.current?.click()
  }
  const choisirOu = async () => {
    tap()
    const i = await choisir({
      title: 'Qui le verra ?',
      actions: [{ label: 'Toute la famille' }, ...albums.map((f) => ({ label: `Album « ${f.name} »` }))],
    })
    if (i < 0) return
    const id = i === 0 ? null : albums[i - 1].id
    setOu(id)
    // un album garde des photos et des mots : pas de sticker seul
    if (id) setSticker(null)
  }
  const videoPrete = video?.etat === 'pret' && !!video.prep
  // une vidéo pour le fil alors que la base ne sait pas encore les garder : seulement dans un album
  const videoBloquee = !!video && !videoPossible
  const pret = !!(texte.trim() || photo || sticker || videoPrete) && !vid.enPreparation && !videoBloquee
  const publier = async () => {
    if (!pret || envoi) return
    setEnvoi(true)
    const t = texte.trim().slice(0, 1000)
    let ok: boolean
    if (album) {
      ok = await run(async (api) => {
        if (photo) await api.addFolderItem(album, me.id, { kind: 'photo', blob: photo.blob, body: t || undefined })
        else if (videoPrete) await api.addFolderItem(album, me.id, { kind: 'video', blob: video!.prep!.blob, title: t.slice(0, 80) || undefined })
        else await api.addFolderItem(album, me.id, { kind: 'message', body: t })
      })
    } else {
      const p = videoPrete ? video!.prep! : null
      const m: NouvelEnvoi = { body: t || undefined, blob: photo?.blob, sticker: sticker ?? undefined, video: p ? { blob: p.blob, affiche: p.affiche, duree: p.duree } : undefined }
      ok = await run((api) => api.postMoment(family.id, me.id, m))
    }
    setEnvoi(false)
    if (ok) {
      success()
      onClose(true)
    }
  }
  const fermer = async () => {
    if ((texte.trim() || photo || video) && !(await confirmer({ title: 'Abandonner cette publication ?', confirm: 'Abandonner', destructive: true }))) return
    vid.retirer()
    onClose(false)
  }

  const idsAlbum = album ? membersOf(folderMembers, album.id) : []

  return (
    <>
      <Sheet
        title="Nouvelle publication"
        tall
        onClose={() => void fermer()}
        footer={
          <Btn onClick={() => void publier()} disabled={!pret || envoi}>
            {envoi ? (videoPrete ? 'Envoi de la vidéo…' : 'Publication…') : vid.enPreparation ? `Préparation de la vidéo… ${Math.round((video?.progres ?? 0) * 100)} %` : album ? `Ajouter à l’album` : 'Publier'}
          </Btn>
        }
      >
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void poserPhoto(f)
          }}
        />
        {[videoInput, filmerInput].map((ref, k) => (
          <input
            key={k}
            ref={ref}
            type="file"
            accept="video/*"
            {...(k ? { capture: 'environment' as const } : {})}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) poserVideo(f)
            }}
          />
        ))}
        {/* qui publie, et pour qui */}
        <div className="flex items-center gap-3">
          <Avatar m={me} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-corps font-bold">{me.display_name}</p>
            <button onClick={() => void choisirOu()} className="presse mt-0.5 flex h-8 max-w-full items-center gap-1 rounded-full bg-teinte-doux pl-2.5 pr-2 text-note font-bold text-teinte-fonce" aria-label={`Qui le verra : ${album ? album.name : 'toute la famille'}. Toucher pour changer`}>
              {album ? <Lock size={13} strokeWidth={2.7} className="shrink-0" /> : <UsersRound size={14} strokeWidth={2.5} className="shrink-0" />}
              <span className="truncate">{album ? album.name : 'Toute la famille'}</span>
              <ChevronDown size={15} strokeWidth={2.6} className="shrink-0" />
            </button>
          </div>
        </div>
        {album && <p className="mt-2 text-note text-brume">Seulement dans l’album : {whoText(idsAlbum, me.id, members)}.</p>}

        <textarea
          ref={zone}
          value={texte}
          maxLength={1000}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={photo ? 'Dis quelques mots sur cette photo…' : video ? 'Dis quelques mots sur cette vidéo…' : `Quoi de neuf, ${me.display_name} ?`}
          aria-label="Ta publication"
          className={`mt-3 w-full resize-none bg-transparent text-encre outline-none placeholder:text-pale ${!photo && !video && !sticker && texte.length <= 90 ? 'text-[22px] font-semibold leading-[29px]' : 'text-corps leading-[24px]'}`}
        />

        {/* ce qu'on joint */}
        {video && <ApercuVideo v={video} onRetirer={vid.retirer} onCouper={vid.recouper} />}
        {videoBloquee && <p className="mt-2 rounded-[14px] bg-peche-doux px-3 py-2 text-note text-peche-fonce">Les vidéos arrivent bientôt dans le fil. En attendant, choisis un album pour la partager.</p>}
        {photo && (
          <div
            ref={cadre.ref}
            className="relative mx-auto mt-2 overflow-hidden rounded-[20px] bg-remplissage"
            style={cadre.h ? { height: cadre.h, width: `min(100%, ${Math.round(cadre.h * ratioPhoto)}px)` } : undefined}
          >
            <img
              src={photo.url}
              alt="La photo de ta publication"
              onLoad={(e) => {
                const i = e.currentTarget
                if (i.naturalWidth && i.naturalHeight) setRatioPhoto(i.naturalWidth / i.naturalHeight)
              }}
              className={`block w-full object-cover ${cadre.h ? 'h-full' : 'max-h-[360px]'}`}
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <button onClick={() => { tap(); setDecorer(new File([photo.blob], 'photo.jpg', { type: 'image/jpeg' })) }} aria-label="Décorer la photo" className={`presse verre flex h-11 items-center justify-center gap-1.5 rounded-full text-sous font-semibold text-encre ${etroite ? 'w-11' : 'px-3.5'}`}>
                <Sparkles size={16} strokeWidth={2.4} /> {!etroite && 'Décorer'}
              </button>
              <button onClick={() => { tap(); setPhoto(null) }} className="presse verre flex h-11 w-11 items-center justify-center rounded-full text-encre" aria-label="Retirer la photo">
                <X size={19} />
              </button>
            </div>
          </div>
        )}
        {sticker && (
          <div className="relative mt-2 inline-block">
            <StickerImg cle={sticker} className="block h-[120px] w-[120px] object-contain" />
            <button onClick={() => { tap(); setSticker(null) }} className="presse absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-carte text-encre shadow-carte" aria-label="Retirer le sticker">
              <X size={16} />
            </button>
          </div>
        )}

        {tiroir && !album && (
          <div className="mt-3 [&>div]:!mt-0">
            <StickerTray
              start="emojis"
              onPick={(key, t, c) => {
                setSticker((key === PERSO ? cleSticker({ i: PERSO, t, c }) : key).slice(0, 60))
                setPhoto(null)
                vid.retirer()
                setTiroir(false)
              }}
              onClose={() => setTiroir(false)}
            />
          </div>
        )}

        {/* ajouter à la publication */}
        <div className={`rounded-[20px] bg-carte p-1.5 shadow-carte ${joint ? 'mt-3' : 'mt-4'}`}>
          {!joint && <p className="px-2.5 pb-1 pt-1.5 text-note font-semibold text-brume">Ajouter à ta publication</p>}
          <div className={`grid gap-1 ${['p', videoPossible && 'v', !album && 's', !album && 'q'].filter(Boolean).length === 4 ? 'grid-cols-4' : ['p', videoPossible && 'v', !album && 's', !album && 'q'].filter(Boolean).length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <Ajouter icone={<Images size={21} strokeWidth={2.2} className="text-vert-fonce" />} label="Photo" actif={!!photo} onClick={() => void choisirPhoto()} />
            {videoPossible && <Ajouter icone={<Video size={22} strokeWidth={2.2} className="text-rouge" />} label="Vidéo" actif={!!video} onClick={() => void choisirVideo()} />}
            {!album && <Ajouter icone={<Smile size={21} strokeWidth={2.2} className="text-[#C28A00]" />} label="Sticker" actif={tiroir || !!sticker} onClick={() => { tap(); setTiroir(!tiroir) }} />}
            {!album && <Ajouter icone={<ChartNoAxesColumn size={20} strokeWidth={2.4} className="text-peche-fonce" />} label="Sondage" onClick={() => { tap(); onSondage(texte.trim()) }} />}
          </div>
        </div>
      </Sheet>
      {vid.coupe && <CoupeVideo {...vid.coupe} />}
      {decorer && (
        <PhotoEditeur
          file={decorer}
          title="Décorer la photo"
          confirmLabel="Garder la photo"
          initialCaption={texte}
          onClose={() => setDecorer(null)}
          onSend={(blob, legende) => {
            setPhoto((x) => {
              if (x) URL.revokeObjectURL(x.url)
              return { blob, url: URL.createObjectURL(blob) }
            })
            setTexte(legende)
            setDecorer(null)
          }}
        />
      )}
    </>
  )
}

function Ajouter({ icone, label, actif = false, onClick }: { icone: ReactNode; label: string; actif?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={actif} className={`presse flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[16px] text-note font-semibold ${actif ? 'bg-teinte-doux text-teinte-fonce' : 'text-encre'}`}>
      {icone}
      {label}
    </button>
  )
}

// ═════════════════════════ Une photo en grand ═════════════════════════

function PhotoEnGrand({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <button onClick={onClose} className="anim-fondu fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3" aria-label="Fermer la photo">
      <img src={url} alt="" className="max-h-full max-w-full rounded-[14px] object-contain" />
      <span className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white" style={{ top: 'calc(var(--sat) + 12px)' }}>
        <X size={22} />
      </span>
    </button>,
    document.body,
  )
}

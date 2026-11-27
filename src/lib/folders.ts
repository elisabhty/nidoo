import type { Folder, FolderItem, FolderMember, Member } from './types'

/** Le dossier et tous ses sous-dossiers. */
export function subtreeIds(folders: Folder[], id: string): Set<string> {
  const ids = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const d of folders) if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) ids.add(d.id), (grew = true)
  }
  return ids
}

export type FolderStats = { photos: number; notes: number; messages: number; audios: number; videos: number; subfolders: number; last: number; cover: string | null }

/** Ce que contient un dossier (sous-dossiers compris) et sa dernière activité. */
export function folderStats(folders: Folder[], items: FolderItem[], folder: Folder): FolderStats {
  const ids = subtreeIds(folders, folder.id)
  let photos = 0, notes = 0, messages = 0, audios = 0, videos = 0
  let last = new Date(folder.updated_at).getTime()
  let cover: { url: string; at: number } | null = null
  for (const i of items) {
    if (!ids.has(i.folder_id)) continue
    const at = Math.max(new Date(i.created_at).getTime(), new Date(i.updated_at).getTime())
    if (at > last) last = at
    if (i.kind === 'photo') {
      photos++
      if (i.image_url && (!cover || at > cover.at)) cover = { url: i.image_url, at }
    } else if (i.kind === 'note' || i.kind === 'dessin') notes++
    else if (i.kind === 'audio') audios++
    else if (i.kind === 'video') videos++
    else if (i.folder_id === folder.id) messages++
  }
  for (const d of folders) if (ids.has(d.id)) last = Math.max(last, new Date(d.updated_at).getTime())
  return { photos, notes, messages, audios, videos, subfolders: ids.size - 1, last, cover: folder.cover_url ?? cover?.url ?? null }
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export function contentLine(s: FolderStats): string {
  const parts = [
    s.photos && plural(s.photos, 'photo', 'photos'),
    s.notes && plural(s.notes, 'note', 'notes'),
    s.audios && plural(s.audios, 'vocal', 'vocaux'),
    s.videos && plural(s.videos, 'vidéo', 'vidéos'),
    s.subfolders && plural(s.subfolders, 'album', 'albums'),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Vide pour l’instant'
}

export const membersOf = (fm: FolderMember[], rootId: string) => fm.filter((x) => x.folder_id === rootId).map((x) => x.member_id)

/** « Juste toi », « Toi et Léa », « Toute la famille »… */
export function whoText(ids: string[], me: string, members: Member[]): string {
  const others = ids.filter((x) => x !== me).map((id) => members.find((m) => m.id === id)?.display_name).filter((x): x is string => !!x)
  if (!others.length) return 'Juste toi'
  if (members.length > 2 && others.length === members.length - 1) return 'Toute la famille'
  if (others.length === 1) return `Toi et ${others[0]}`
  if (others.length === 2) return `Toi, ${others[0]} et ${others[1]}`
  return `Toi, ${others[0]} et ${others.length - 1} autres`
}

// Couvertures sans photo : les mêmes tons pastel que les avatars, et une illustration 3D qui dit ce que contient le dossier.
const GRADIENTS = [
  'linear-gradient(155deg, #F3EEFE 0%, #D9CBF8 100%)',
  'linear-gradient(155deg, #FFF2E8 0%, #FFD3B8 100%)',
  'linear-gradient(155deg, #EAF7ED 0%, #C3E6CB 100%)',
  'linear-gradient(155deg, #E8F3FD 0%, #BFDDF6 100%)',
  'linear-gradient(155deg, #FEEBF1 0%, #F7C6D6 100%)',
]
export function gradientOf(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

const ARTS: [RegExp, string][] = [
  [/recett|cuisin|repas|gâteau|gateau|dessert|dîner|diner|resto/i, 'picto-gateau'],
  [/vacance|voyage|week-?end|plage|séjour|sejour|bretagne|montagne|road|trip|ski/i, 'picto-lieu'],
  [/surprise|cadeau|noël|noel|liste de souhaits/i, 'picto-cadeau'],
  [/anniv|fête|fete|soirée|soiree|mariage|baptême|bapteme/i, 'picto-fete'],
  [/course|achat|liste|magasin/i, 'picto-courses'],
  [/école|ecole|devoir|agenda|rdv|rendez|planning|santé|sante|médecin|medecin/i, 'picto-agenda'],
  [/idée|idee|projet|bricol|travaux|mission|maison/i, 'picto-missions'],
  [/souvenir|bébé|bebe|enfant|famille|naissance/i, 'geste-coeur'],
]
export const folderArt = (name: string) => ARTS.find(([re]) => re.test(name))?.[1] ?? 'picto-photo'

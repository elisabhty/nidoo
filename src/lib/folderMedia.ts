import type { ItemKind } from './types'

const MIME_EXT: Record<string, string> = {
  'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp',
  'audio/mp4':'m4a', 'audio/x-m4a':'m4a', 'audio/aac':'aac', 'audio/mpeg':'mp3', 'audio/webm':'webm', 'audio/ogg':'ogg', 'audio/wav':'wav', 'audio/x-wav':'wav',
  'video/mp4':'mp4', 'video/quicktime':'mov', 'video/webm':'webm',
}
export function folderAsset(kind: ItemKind, blob: Blob) {
  let mime = blob.type.split(';')[0].toLowerCase()
  if (!mime && blob instanceof File) {
    const ext = blob.name.split('.').pop()?.toLowerCase()
    mime = Object.keys(MIME_EXT).find(m => MIME_EXT[m] === ext) ?? ''
    if (kind === 'video' && ext === 'webm') mime = 'video/webm'
  }
  const category = kind === 'audio' ? 'audio/' : kind === 'video' ? 'video/' : 'image/'
  if (!MIME_EXT[mime] || !mime.startsWith(category)) throw new Error('FORMAT_SOUVENIR_INVALIDE')
  const max = kind === 'video' ? 25 : kind === 'audio' ? 10 : 8
  if (!blob.size) throw new Error('FICHIER_VIDE')
  if (blob.size > max * 1024 * 1024) throw new Error(kind === 'video' ? 'VIDEO_TROP_LOURDE' : kind === 'audio' ? 'VOCAL_TROP_LOURD' : 'IMAGE_TROP_LOURDE')
  return { mime, extension: MIME_EXT[mime] }
}

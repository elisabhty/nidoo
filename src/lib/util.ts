export const todayKey = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const isToday = (iso: string | null) => !!iso && todayKey(new Date(iso)) === todayKey()

export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'hier'
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

/** Prochaine occurrence d'un événement (les anniversaires reviennent chaque année). */
export function nextOccurrence(startsAt: string, yearly: boolean, from = new Date()): Date {
  const d = new Date(startsAt)
  if (!yearly) return d
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const n = new Date(start.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
  if (n < start) n.setFullYear(n.getFullYear() + 1)
  return n
}

export function dayLabel(d: Date): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(d) - start(new Date())) / 86400000)
  if (diff === 0) return 'Aujourd’hui'
  if (diff === 1) return 'Demain'
  if (diff > 1 && diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase())
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
export const timeLabel = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Encore debout'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Coucou'
  return 'Bonsoir'
}
export type Season = 'printemps' | 'ete' | 'automne' | 'hiver' | 'noel'
/** La saison de la maison : Noël du 1er décembre au 6 janvier. */
export function season(d = new Date()): Season {
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (m === 12 || (m === 1 && day <= 6)) return 'noel'
  if (m <= 2) return 'hiver'
  if (m < 6 || (m === 6 && day < 21)) return m === 3 && day < 20 ? 'hiver' : 'printemps'
  if (m < 9 || (m === 9 && day < 22)) return 'ete'
  return 'automne'
}
export const SEASON_LABEL: Record<Season, string> = { printemps: 'Printemps', ete: 'Été', automne: 'Automne', hiver: 'Hiver', noel: 'Noël' }

export function dayPhase(d = new Date()): 'matin' | 'jour' | 'soir' | 'nuit' {
  const h = d.getHours()
  if (h >= 6 && h < 10) return 'matin'
  if (h >= 10 && h < 18) return 'jour'
  if (h >= 18 && h < 21) return 'soir'
  return 'nuit'
}

/** Réduit une photo avant l'envoi : JPEG, grand côté limité. */
export async function compressImage(file: Blob, max = 1280, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('IMAGE_ILLISIBLE'))
      i.src = url
    })
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k)
    c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('IMAGE_ILLISIBLE'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}
export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

const ERRORS: Record<string, string> = {
  PAS_ADMIN: 'Seul le créateur du dossier peut faire ça.',
  DOSSIER_INCONNU: 'Ce dossier n’existe plus ou tu n’y as plus accès.',
  STOCKAGE_PLEIN: 'La mémoire de démo de ce téléphone est pleine. Supprime quelques photos.',
  CODE_INCONNU: 'Ce code ne correspond à aucune maison.',
  FAMILLE_PLEINE: 'Cette maison est complète. Avec Famille+, elle accueille jusqu’à 15 membres.',
  LIMITE_MAISONS: 'La version gratuite permet de créer une seule maison. Famille+ en débloque plusieurs.',
  PAS_ASSEZ_ETOILES: 'Pas encore assez d’étoiles pour cette décoration.',
  NON_CONNECTE: 'Connexion impossible pour le moment.',
  IMAGE_ILLISIBLE: 'Cette photo n’a pas pu être lue.',
  ANONYME_DESACTIVE: 'La connexion sans compte n’est pas encore activée sur le serveur.',
  CODE_EXPIRE: 'Ce code a expiré. Demande à un responsable de la famille de t’en envoyer un nouveau.',
  TROP_D_ESSAIS: 'Trop de codes essayés. Réessaie dans une heure.',
  TROP_DE_DEMANDES: 'Trop de demandes en attente pour le moment.',
  PAS_RESPONSABLE: 'Seul un responsable de la famille peut faire ça.',
  DEMANDE_INCONNUE: 'Cette demande n’existe plus.',
  DERNIER_RESPONSABLE: 'La famille doit garder au moins un responsable. Nommes-en un autre d’abord.',
  UTILISE_QUITTER: 'Pour partir toi-même, utilise « Quitter cette maison ».',
  MEMBRE_INCONNU: 'Ce membre n’est plus dans la famille.',
  DESSIN_VIDE: 'Ajoute une photo ou dessine quelque chose avant d’envoyer.',
  TROP_D_ENFANTS: 'Dix enfants et bébés au maximum par maison.',
  PROFIL_SANS_COMPTE: 'Un enfant sans téléphone ne peut pas être responsable.',
  DEFI_INCOMPLET: 'Le défi n’est pas encore relevé : encore un petit effort !',
  DEFI_DEJA_RECU: 'La récompense de cette semaine a déjà été reçue.',
  DEJA_FAIT: 'Quelqu’un de la famille s’en est déjà occupé aujourd’hui.',
  PAS_INSTALLE: 'Il n’est pas encore dans votre jardin.',
  PAS_DE_SOIN: 'Celui-là n’a besoin de rien.',
  REPONSE_VIDE: 'Écris une réponse ou ajoute une photo.',
}
/** Le jour d'il y a n jours, au format AAAA-MM-JJ. */
export const daysAgoKey = (n: number) => todayKey(new Date(Date.now() - n * 86400000))
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  const key = Object.keys(ERRORS).find((k) => msg.includes(k))
  if (key) return ERRORS[key]
  if (/fetch|network/i.test(msg)) return 'Pas de connexion. Réessaie dans un instant.'
  return 'Petit souci, réessaie dans un instant.'
}


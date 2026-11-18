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

/** Ce qu'il faut savoir d'un événement pour placer ses dates. */
type Quand = { starts_at: string; yearly: boolean; weekly?: boolean; ends_on?: string | null }

const minuit = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const plusJours = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())

/** Combien de jours en plus du premier (0 pour un événement d'un seul jour). */
export function joursEnPlus(e: Quand): number {
  if (!e.ends_on) return 0
  const [y, m, j] = e.ends_on.split('-').map(Number)
  return Math.max(0, Math.round((new Date(y, m - 1, j).getTime() - minuit(new Date(e.starts_at)).getTime()) / 86400000))
}

/**
 * La prochaine fois d'un événement, ou celle qui est en cours : un anniversaire revient chaque année,
 * une activité chaque semaine, et un week-end en cours compte encore jusqu'à son dernier jour.
 * Accepte aussi l'ancienne forme (starts_at, yearly).
 */
export function nextOccurrence(e: Quand | string, yearly = false, from = new Date()): Date {
  const q: Quand = typeof e === 'string' ? { starts_at: e, yearly } : e
  const d = new Date(q.starts_at)
  const duree = joursEnPlus(q)
  const jour = minuit(from)
  if (q.yearly) {
    let n = new Date(jour.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
    if (plusJours(minuit(n), duree) < jour) n = new Date(jour.getFullYear() + 1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
    return n
  }
  if (q.weekly && minuit(d) < jour) {
    // la dernière fois qui touche encore aujourd'hui, sinon la prochaine
    const ecart = Math.floor((jour.getTime() - minuit(d).getTime()) / 86400000)
    let n = plusJours(d, ecart - (ecart % 7))
    if (plusJours(minuit(n), duree) < jour) n = plusJours(n, 7)
    return n
  }
  return d
}

/** Le dernier jour d'une fois de l'événement (le même jour s'il ne dure qu'un jour). */
export function finDe(e: Quand, at: Date): Date {
  return plusJours(minuit(at), joursEnPlus(e))
}

/** L'événement a-t-il lieu ce jour-là ? Renvoie alors l'heure de début de cette fois-là. */
export function occursOn(e: Quand, day: Date): Date | null {
  const n = nextOccurrence(e, false, day)
  const debut = minuit(n)
  const j = minuit(day)
  if (j < debut || j > finDe(e, n)) return null
  return new Date(j.getFullYear(), j.getMonth(), j.getDate(), n.getHours(), n.getMinutes())
}

/** « Du 28 au 29 novembre », « Tous les mercredis »… : la petite ligne qui dit quand ça revient ou combien ça dure. */
export function rythme(e: Quand, at: Date): string | null {
  if (e.weekly) return `Tous les ${at.toLocaleDateString('fr-FR', { weekday: 'long' })}s`
  const n = joursEnPlus(e)
  if (!n) return null
  const fin = finDe(e, at)
  const memeMois = fin.getMonth() === at.getMonth()
  return `Du ${at.toLocaleDateString('fr-FR', memeMois ? { day: 'numeric' } : { day: 'numeric', month: 'long' })} au ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
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
  FORMAT_SOUVENIR_INVALIDE: 'Ce format n’est pas pris en charge. Choisis un autre fichier.',
  FICHIER_VIDE: 'Ce fichier est vide. Choisis-en un autre.',
  VIDEO_TROP_LOURDE: 'Choisis une vidéo de moins de 25 Mo.',
  VOCAL_TROP_LOURD: 'Choisis un audio de moins de 10 Mo.',
  IMAGE_TROP_LOURDE: 'Choisis une image de moins de 8 Mo.',
  PHOTO_DU_FIL_INACCESSIBLE: 'Cette photo n’est plus disponible dans le fil. Actualise puis réessaie.',
  MICRO_INDISPONIBLE: 'L’enregistrement n’est pas disponible ici. Tu peux importer un audio.',

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
  PLUS_DE_CROQUETTES: 'Plus de croquettes ! Rachetez un sac dans « Décorer la maison ».',
  STOCK_PLEIN: 'Le placard est plein : utilisez d’abord ce qu’il y a dedans.',
  DEJA_ACHETE: 'La famille l’a déjà.',
  DEJA_UN_COMPAGNON: 'La famille a déjà un compagnon.',
  PRENOM_VIDE: 'Donne-lui un prénom.',
  PAS_DE_COMPAGNON: 'La famille n’a pas encore de compagnon.',
  PAS_ACHETE: 'Il faut d’abord l’acheter au centre commercial.',
  PLUS_DE_FRIANDISES: 'Plus de friandises : il y en a à la supérette.',
  PAS_DE_POTAGER: 'Installez d’abord le potager dans « Décorer la maison ».',
  PARCELLE_PRISE: 'Quelque chose pousse déjà ici.',
  PARCELLE_INCONNUE: 'Cette parcelle n’existe pas.',
  PLANTE_INCONNUE: 'Cette plante n’existe pas.',
  PLUS_DE_GRAINES: 'Plus de graines : il y en a à la supérette.',
  AVENT_FERME: 'Le calendrier de l’Avent est fermé pour le moment.',
  CASE_INCONNUE: 'Cette case n’existe pas.',
  CASE_PAS_ENCORE: 'Patience : cette case s’ouvrira le jour venu.',
  RIEN_A_FAIRE_POUSSER: 'Rien n’est planté pour l’instant.',
  PLUS_D_ENGRAIS: 'Plus d’engrais : il y en a à la supérette.',
  PARCELLE_VIDE: 'Rien à récolter ici.',
  PAS_ENCORE_MUR: 'Pas encore mûr : encore quelques arrosages.',
  RESEAU: 'Impossible de joindre ton proche pour l’instant. Vérifie ta connexion et réessaie.',
  PAS_TON_TOUR: 'Patience, c’est à l’autre de jouer.',
  COLONNE_PLEINE: 'Cette colonne est pleine, choisis-en une autre.',
  COUP_INTERDIT: 'Ce coup n’est pas possible.',
  PARTIE_FINIE: 'Cette partie est terminée.',
  PARTIE_INCONNUE: 'Cette partie n’existe plus.',
  PAS_JOUEUR: 'Tu regardes cette partie : seuls les deux joueurs peuvent jouer.',
  ADVERSAIRE_INCONNU: 'Choisis un proche qui a l’appli sur son téléphone.',
  JEU_INCONNU: 'Ce jeu n’existe pas.',
  TROP_DE_PARTIES: 'Beaucoup de parties en cours : terminez-en quelques-unes d’abord.',
  MEMORY_TROP_DE_PHOTOS: 'Huit photos au plus pour un memory.',
  MEMORY_PHOTOS: 'Choisis au moins quatre photos pour le memory.',
  PHOTO_INCONNUE: 'Une des photos n’a pas pu être envoyée. Réessaie.',
  DEJA_TIRE: 'Tu as déjà tiré sur cette case.',
  JOUEURS: 'Ce jeu ne se joue pas avec ce nombre de joueurs.',
  ANNEE_INVALIDE: 'Choisis une année entre 1850 et aujourd’hui pour chaque photo.',
  PERSONNE_N_A_REPONDU: 'Personne n’a encore répondu.',
  MOT_5_LETTRES: 'Il faut un mot de 5 lettres.',
  MOT_FINI: 'Tu as fini le mot du jour : rendez-vous demain !',
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


/** Le nom affiché d'une maison : « Martin » ou « des Tilleuls » deviennent « Famille Martin », « Famille des Tilleuls » ;
 *  un nom déjà complet (« Notre maison », « Chez Mamie », « Famille Martin ») reste tel quel. */
export function familyLabel(name: string) {
  const n = name.trim()
  if (/^(de|des|du)\s/.test(n) || /^d[’']/.test(n)) return `Famille ${n}`
  if (!/\s/.test(n) && /^[A-ZÀ-ÖØ-Ý]/.test(n) && !/^(famille|maison|chez|nid|cocon|foyer)/i.test(n)) return `Famille ${n}`
  return n
}

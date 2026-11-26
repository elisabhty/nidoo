import { timeLabel } from './util'
import { endroitNomme } from './endroits'
import type { Endroit, FamEvent, FamilyState, Member, Moment } from './types'

/** Ce que la maison raconte à partir des événements réellement enregistrés par la famille. */
export type HomeStory = {
  id: string
  kind: 'evenement' | 'photo' | 'message' | 'invitation'
  /** la petite ligne du haut : quand, et qui (« Aujourd’hui · 18:00 », « Léa · il y a 5 min ») */
  label: string
  title: string
  detail: string
  target: 'fil' | 'organiser' | 'famille'
  event?: FamEvent
  /** la date de l'événement (pour la petite pastille calendrier) */
  at?: Date
  /** qui en parle (pour son portrait) */
  member?: Member
  /** la photo elle-même */
  image?: string | null
  /** un vocal (pour l'icône) */
  vocal?: boolean
}

/** `endroits` : nos adresses, pour lire « École » au lieu de l'adresse complète (Elisa, 26 novembre). */
type Sources = Pick<FamilyState, 'members' | 'moments'> & { endroits?: readonly Endroit[] }
type NextEvent = { e: FamEvent; at: Date } | null

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const dayDifference = (a: Date, b: Date) => Math.round((dayStart(a) - dayStart(b)) / 86400000)
const recent = (date: string, now: Date, days: number) => {
  const age = now.getTime() - new Date(date).getTime()
  return Number.isFinite(age) && age >= 0 && age <= days * 86400000
}
const extrait = (t: string, n = 70) => {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
}
/** « à l’instant », « il y a 5 min », « hier »… (comme ago() dans util.ts ; ce module reste sans dépendance pour ses tests) */
const ago = (iso: string, now: Date) => {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'hier' : `il y a ${d} j`
}
const duree = (s?: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '')

export function homeStories(state: Sources, meId: string, next: NextEvent, now = new Date()): HomeStory[] {
  const result: HomeStory[] = []
  const byId = new Map(state.members.map((m) => [m.id, m]))
  const hasOthers = state.members.some((m) => m.id !== meId)
  const qui = (m: Moment) => (m.member_id === meId ? 'Toi' : byId.get(m.member_id)?.display_name ?? 'Un proche')

  if (next) {
    const delta = dayDifference(next.at, now)
    if (delta <= 14) {
      const quand = delta < 0 ? 'En ce moment' : delta === 0 ? 'Aujourd’hui' : delta === 1 ? 'Demain' : next.at.toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase())
      const heure = next.e.all_day ? '' : timeLabel(next.at)
      const avec = (next.e.members ?? []).map((id) => byId.get(id)?.display_name).filter(Boolean) as string[]
      result.push({
        id: 'event:' + next.e.id,
        kind: 'evenement',
        label: [quand, heure].filter(Boolean).join(' · '),
        title: next.e.title,
        detail:
          (next.e.lieu ? (endroitNomme(next.e.lieu, state.endroits ?? [])?.nom ?? next.e.lieu) : '') ||
          (avec.length ? (avec.length > 2 ? `Avec ${avec.slice(0, 2).join(', ')} et ${avec.length - 2} autre${avec.length > 3 ? 's' : ''}` : `Avec ${avec.join(' et ')}`) : '') ||
          (next.e.kind === 'anniversaire' ? 'Pense à lui faire une surprise' : next.e.all_day ? 'Toute la journée, toute la famille' : 'Toute la famille'),
        target: 'organiser',
        event: next.e,
        at: next.at,
      })
    }
  }

  // Ce que les proches ont posté dans le fil cette semaine ; ses propres messages seulement s'il n'y a rien d'autre.
  const semaine = state.moments.filter((m) => recent(m.created_at, now, 7)).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const dAbord = (l: Moment[]) => [...l.filter((m) => m.member_id !== meId), ...l.filter((m) => m.member_id === meId)]
  const photo = dAbord(semaine.filter((m) => !!m.image_path || !!m.image_url))[0]
  if (photo) {
    const moi = photo.member_id === meId
    const autres = semaine.filter((m) => (m.image_path || m.image_url) && m.id !== photo.id).length
    result.push({
      id: 'photo:' + photo.id,
      kind: 'photo',
      label: `${qui(photo)} · ${ago(photo.created_at, now)}`,
      title: photo.body?.trim() ? `« ${extrait(photo.body, 50)} »` : moi ? 'Ta photo est dans le fil' : `Une photo de ${qui(photo)}`,
      detail: autres ? `Et ${autres} autre${autres > 1 ? 's' : ''} photo${autres > 1 ? 's' : ''} cette semaine` : moi ? 'Toute la famille peut la voir' : 'Touche pour la voir en grand',
      target: 'fil',
      member: byId.get(photo.member_id),
      image: photo.image_url ?? null,
    })
  }

  const message = dAbord(semaine.filter((m) => m.id !== photo?.id && !m.image_path && !m.image_url && (!!m.body?.trim() || !!m.audio_path)))[0]
  if (message) {
    const moi = message.member_id === meId
    const autres = semaine.filter((m) => m.member_id !== meId && m.id !== message.id && m.id !== photo?.id).length
    result.push({
      id: 'message:' + message.id,
      kind: 'message',
      label: `${qui(message)} · ${ago(message.created_at, now)}`,
      title: message.audio_path ? `Un message vocal${message.duree ? ` de ${duree(message.duree)}` : ''}` : `« ${extrait(message.body ?? '')} »`,
      detail: moi ? 'Ton dernier message dans le fil' : autres ? `Et ${autres} autre${autres > 1 ? 's' : ''} message${autres > 1 ? 's' : ''} à lire` : `Réponds à ${qui(message)} dans le fil`,
      target: 'fil',
      member: byId.get(message.member_id),
      vocal: !!message.audio_path,
    })
  }

  // les humeurs du jour ne sont plus une nouvelle ici : chaque proche a la sienne sous son prénom, juste en dessous
  // (et sur la maison), elles n'étaient que redites (Elisa, 26 novembre : « améliore les redondances »)
  const humeurs = state.members.some((m) => m.id !== meId && !!m.mood && !!m.mood_at && dayDifference(new Date(m.mood_at), now) === 0)

  // rien de neuf : un mot pour en donner (pas quand un proche a déjà donné son humeur aujourd'hui : ce n'est pas
  // « rien de neuf »). Seul dans la maison, rien du tout : l'accueil invite déjà ses proches juste en dessous
  // (Elisa, 26 novembre : « répétition »)
  if (!result.length && hasOthers && !humeurs) {
    result.push({
      id: 'invitation',
      kind: 'invitation',
      label: 'Rien de neuf cette semaine',
      title: 'Donne des nouvelles à la famille',
      detail: 'Une photo, un petit mot ou un vocal dans le fil',
      target: 'fil',
    })
  }
  return result.slice(0, 3)
}

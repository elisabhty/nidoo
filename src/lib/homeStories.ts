import type { FamEvent, FamilyState, Member, Moment } from './types'
import { ago } from './util'

/** Ce que la maison raconte à partir des événements réellement enregistrés par la famille. */
export type HomeStory = {
  id: string
  kind: 'evenement' | 'photo' | 'message' | 'humeur' | 'invitation'
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
  /** les proches qui ont donné leur humeur */
  members?: Member[]
  /** la photo elle-même */
  image?: string | null
  /** un vocal (pour l'icône) */
  vocal?: boolean
}

type Sources = Pick<FamilyState, 'members' | 'moments'>
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
      const heure = next.e.all_day ? '' : next.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const avec = (next.e.members ?? []).map((id) => byId.get(id)?.display_name).filter(Boolean) as string[]
      result.push({
        id: 'event:' + next.e.id,
        kind: 'evenement',
        label: [quand, heure].filter(Boolean).join(' · '),
        title: next.e.title,
        detail:
          next.e.lieu ||
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
      label: `${qui(photo)} · ${ago(photo.created_at)}`,
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
      label: `${qui(message)} · ${ago(message.created_at)}`,
      title: message.audio_path ? `Un message vocal${message.duree ? ` de ${duree(message.duree)}` : ''}` : `« ${extrait(message.body ?? '')} »`,
      detail: moi ? 'Ton dernier message dans le fil' : autres ? `Et ${autres} autre${autres > 1 ? 's' : ''} message${autres > 1 ? 's' : ''} à lire` : `Réponds à ${qui(message)} dans le fil`,
      target: 'fil',
      member: byId.get(message.member_id),
      vocal: !!message.audio_path,
    })
  }

  const moods = state.members.filter((m) => m.id !== meId && !!m.mood && !!m.mood_at && dayDifference(new Date(m.mood_at), now) === 0)
  if (moods.length) {
    result.push({
      id: 'humeur:' + moods.map((m) => m.id).join(','),
      kind: 'humeur',
      label: 'Les humeurs du jour',
      title:
        moods.length <= 2
          ? moods.map((m) => m.display_name).join(' et ')
          : moods.length === 3
            ? `${moods[0].display_name}, ${moods[1].display_name} et ${moods[2].display_name}`
            : `${moods[0].display_name}, ${moods[1].display_name} et ${moods.length - 2} autres`,
      detail: moods.length === 1 ? 'A partagé son humeur du jour' : 'Ont partagé leur humeur du jour',
      target: 'famille',
      members: moods,
    })
  }

  if (!result.length) {
    result.push({
      id: 'invitation',
      kind: 'invitation',
      label: hasOthers ? 'Rien de neuf cette semaine' : 'Pour commencer',
      title: hasOthers ? 'Donne des nouvelles à la famille' : 'Invite ta famille',
      detail: hasOthers ? 'Une photo, un petit mot ou un vocal dans le fil' : 'La maison s’anime quand vous êtes plusieurs',
      target: hasOthers ? 'fil' : 'famille',
    })
  }
  return result.slice(0, 3)
}

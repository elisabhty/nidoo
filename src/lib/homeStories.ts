import type { FamEvent, FamilyState } from './types'

/** Ce que la maison raconte à partir des événements réellement enregistrés par la famille. */
export type HomeStory = {
  id: string
  kind: 'evenement' | 'photo' | 'message' | 'humeur' | 'invitation'
  title: string
  detail: string
  label: string
  target: 'fil' | 'organiser' | 'famille'
  event?: FamEvent
}

type Sources = Pick<FamilyState, 'members' | 'moments'>
type NextEvent = { e: FamEvent; at: Date } | null

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const dayDifference = (a: Date, b: Date) => Math.round((dayStart(a) - dayStart(b)) / 86400000)
const recent = (date: string, now: Date, days: number) => {
  const age = now.getTime() - new Date(date).getTime()
  return Number.isFinite(age) && age >= 0 && age <= days * 86400000
}

export function homeStories(state: Sources, meId: string, next: NextEvent, now = new Date()): HomeStory[] {
  const result: HomeStory[] = []
  const names = new Map(state.members.map((m) => [m.id, m.display_name]))
  const hasOthers = state.members.some((m) => m.id !== meId)

  if (next) {
    const delta = dayDifference(next.at, now)
    if (delta <= 14) {
      const label = delta < 0 ? 'En ce moment' : delta === 0 ? 'Aujourd’hui' : delta === 1 ? 'Demain' : delta < 7 ? 'Cette semaine' : 'Prochainement'
      const details = [
        next.e.all_day ? null : next.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        next.e.lieu,
      ].filter(Boolean).join(' · ')
      result.push({
        id: 'event:' + next.e.id,
        kind: 'evenement',
        label,
        title: next.e.title,
        detail: details || (next.e.kind === 'anniversaire' ? 'Une belle occasion de se retrouver' : 'Un moment au programme'),
        target: 'organiser',
        event: next.e,
      })
    }
  }

  // Une photo envoyée dans le fil est visible par toute la maison ; les albums privés ne le sont pas.
  const posts = state.moments.filter((m) => recent(m.created_at, now, 7))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const photo = posts.find((m) => !!m.image_path)
  if (photo) {
    const name = names.get(photo.member_id) ?? 'Un proche'
    result.push({
      id: 'photo:' + photo.id,
      kind: 'photo',
      label: 'Nouveau souvenir',
      title: name + ' a partagé une photo',
      detail: 'À retrouver dans le fil familial',
      target: 'fil',
    })
  }

  const message = posts.find((m) => m.id !== photo?.id && (!!m.body?.trim() || !!m.audio_path))
  if (message) {
    const name = names.get(message.member_id) ?? 'Un proche'
    result.push({
      id: 'message:' + message.id,
      kind: 'message',
      label: 'Des nouvelles de la famille',
      title: name + (message.audio_path ? ' a envoyé un vocal' : ' a laissé un petit mot'),
      detail: 'À découvrir dans le fil familial',
      target: 'fil',
    })
  }

  const moods = state.members.filter((m) =>
    m.id !== meId && !!m.mood && !!m.mood_at && dayDifference(new Date(m.mood_at), now) === 0,
  )
  if (moods.length) {
    result.push({
      id: 'humeur:' + moods.map((m) => m.id).join(','),
      kind: 'humeur',
      label: 'Aujourd’hui dans la maison',
      title: moods.length === 1
        ? moods[0].display_name + ' a partagé son humeur'
        : moods.length + ' proches ont partagé leur humeur',
      detail: 'Prenez des nouvelles les uns des autres',
      target: 'famille',
    })
  }

  if (!result.length) {
    result.push({
      id: 'invitation',
      kind: 'invitation',
      label: 'La vie de notre maison',
      title: hasOthers ? 'Chaque petit moment compte' : 'Tout commence avec un proche',
      detail: hasOthers ? 'Partagez une photo ou un petit mot' : 'Invitez votre famille à vous rejoindre',
      target: hasOthers ? 'fil' : 'famille',
    })
  }
  return result.slice(0, 3)
}

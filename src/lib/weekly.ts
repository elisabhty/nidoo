import { DECOS } from './data'

// Le défi de la semaine : un objectif commun à toute la famille, qui change chaque lundi.
// Les objectifs doivent rester alignés avec private.weekly_goals (migration 0005).

export type WeeklyKey = 'photos' | 'calins' | 'missions' | 'dessins' | 'humeurs' | 'questions'
export type WeeklyCounts = Record<WeeklyKey, number>
export type WeeklyState = { counts: WeeklyCounts; claimed: string | null }

const LABELS: Record<WeeklyKey, (n: number) => string> = {
  photos: (n) => `Partager ${n} photo${n > 1 ? 's' : ''}`,
  calins: (n) => `Envoyer ${n} câlin${n > 1 ? 's' : ''}`,
  missions: (n) => `Terminer ${n} mission${n > 1 ? 's' : ''}`,
  dessins: (n) => `Envoyer ${n} dessin${n > 1 ? 's' : ''}`,
  humeurs: (n) => `Partager ${n} humeur${n > 1 ? 's' : ''}`,
  questions: (n) => `Répondre à ${n} question${n > 1 ? 's' : ''} du jour`,
}

export const WEEKLY: { title: string; goals: Partial<WeeklyCounts> }[] = [
  { title: 'Ensemble, embellissons le jardin', goals: { photos: 3, calins: 5, missions: 3 } },
  { title: 'Une semaine pleine de couleurs', goals: { dessins: 3, humeurs: 8, questions: 4 } },
  { title: 'Prenons des nouvelles les uns des autres', goals: { calins: 6, humeurs: 10, photos: 2 } },
  { title: 'On s’entraide à la maison', goals: { missions: 5, dessins: 2, questions: 3 } },
]

export const emptyCounts = (): WeeklyCounts => ({ photos: 0, calins: 0, missions: 0, dessins: 0, humeurs: 0, questions: 0 })

/** Lundi 0 h (UTC) de la semaine en cours : la même borne que la base. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now)
  const day = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)
}
export const weekIndex = (now = Date.now()) => Math.floor(weekStart(now) / 1000 / 604800) % WEEKLY.length
export const weekKey = (now = Date.now()) => new Date(weekStart(now)).toISOString().slice(0, 10)
export const daysLeft = (now = Date.now()) => Math.max(1, Math.ceil((weekStart(now) + 7 * 86400000 - now) / 86400000))

export function challenge(counts: WeeklyCounts, now = Date.now()) {
  const t = WEEKLY[weekIndex(now)]
  const goals = (Object.entries(t.goals) as [WeeklyKey, number][]).map(([k, n]) => ({ key: k, n, label: LABELS[k](n), done: Math.min(counts[k] ?? 0, n) }))
  return { title: t.title, goals, complete: goals.every((g) => g.done >= g.n) }
}

/** La récompense : la décoration la moins chère pas encore installée (sinon 20 étoiles). */
export const nextReward = (houseItems: string[]) => DECOS.find((d) => !houseItems.includes(d.key)) ?? null

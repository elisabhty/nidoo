// L'activité en direct « prochain rendez-vous » (Elisa, 25 novembre : « l'île dynamique, l'activité de l'écran ») :
// les règles, sans rien de natif (testées à part). Le reste : src/lib/direct.ts et ios/App/App/NidooPlugin.swift.
import type { FamEvent, Member } from './types'
import { nextOccurrence } from './util'

/** iOS garde une activité en direct 8 heures au plus : on ne la propose que pour un rendez-vous dans la journée. */
export const HEURES_MAX = 8
/** Lancée toute seule (à l'ouverture de l'appli) quand le rendez-vous commence dans moins de deux heures. */
export const HEURES_AUTO = 2

/** L'heure de ce rendez-vous s'il peut être suivi sur l'écran verrouillé : il a une heure, il commence
 *  dans plus d'une minute et dans moins de 8 heures. Sinon null. */
export function suivable(e: Pick<FamEvent, 'starts_at' | 'all_day' | 'yearly' | 'weekly' | 'repete' | 'ends_on'>, maintenant = new Date()): Date | null {
  if (e.all_day) return null
  const at = nextOccurrence(e as FamEvent, false, maintenant)
  const dans = at.getTime() - maintenant.getTime()
  return dans > 60_000 && dans <= HEURES_MAX * 3_600_000 ? at : null
}

/** « Toute la famille », « Avec Léa », « Avec Léa et Papa », « Avec Léa, Papa et Noé » (sans moi). */
export function avecQui(e: Pick<FamEvent, 'members'>, members: Pick<Member, 'id' | 'display_name'>[], moi: string): string | null {
  const ids = e.members ?? []
  if (!ids.length) return 'Toute la famille'
  const noms = members.filter((m) => ids.includes(m.id) && m.id !== moi).map((m) => m.display_name)
  if (!noms.length) return null
  return `Avec ${noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`}`
}

/** Me concerne-t-il ? Toute la famille, ou je suis parmi les proches choisis. */
export const meConcerne = (e: Pick<FamEvent, 'members'>, moi: string) => !(e.members ?? []).length || e.members!.includes(moi)

/** Le prochain rendez-vous à lancer tout seul : il me concerne, il commence dans moins de deux heures,
 *  et on ne l'a pas déjà lancé (ou retiré) pour cette fois-là. */
export function prochainASuivre<E extends FamEvent>(events: E[], moi: string, deja: string[], maintenant = new Date()): { e: E; at: Date } | null {
  let mieux: { e: E; at: Date } | null = null
  for (const e of events) {
    if (e.kind === 'anniversaire' || !meConcerne(e, moi)) continue
    const at = suivable(e, maintenant)
    if (!at || at.getTime() - maintenant.getTime() > HEURES_AUTO * 3_600_000) continue
    if (deja.includes(cleFois(e.id, at))) continue
    if (!mieux || at < mieux.at) mieux = { e, at }
  }
  return mieux
}

/** Une fois d'un rendez-vous (il peut revenir chaque semaine) : « id@2026-11-27T14:00 ». */
export const cleFois = (id: string, at: Date) => `${id}@${at.toISOString().slice(0, 16)}`

import { useEffect, useState } from 'react'
import type { Backend, FamEvent, ListItem } from './types'
import { nextOccurrence } from './util'

// Une chose à faire peut être liée à un événement (Elisa, 21 novembre). Tant que la base ne connaît pas
// encore ce lien (la colonne event_id), l'appli n'en parle pas : rien ne se perd.

let connu: boolean | null = null
export function useLienTaches(api: Backend, items: ListItem[]): boolean {
  const vu = items.some((i) => 'event_id' in i)
  const [ok, setOk] = useState(connu ?? vu)
  useEffect(() => {
    if (ok || vu) {
      connu = true
      return
    }
    let vivant = true
    api
      .lienTaches()
      .then((v) => {
        connu = v
        if (vivant) setOk(v)
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [api, ok, vu])
  return ok || vu
}

/** Les événements à venir (les 60 prochains jours), du plus proche au plus lointain. */
export function evenementsAVenir(events: FamEvent[], max = 8): { e: FamEvent; at: Date }[] {
  const maintenant = new Date()
  maintenant.setHours(0, 0, 0, 0)
  const limite = maintenant.getTime() + 60 * 86400000
  return events
    .map((e) => ({ e, at: nextOccurrence(e) }))
    .filter(({ at }) => at.getTime() >= maintenant.getTime() && at.getTime() <= limite)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, max)
}

export const jourCourt = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }).replace(/^./, (c) => c.toUpperCase())

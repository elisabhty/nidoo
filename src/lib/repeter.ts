import { useEffect, useState } from 'react'
import type { Backend, FamEvent } from './types'

// « Répéter » (Elisa, 21 novembre) : jamais, chaque jour, chaque semaine, toutes les 2 semaines, chaque mois, chaque année.
// Chaque semaine et chaque année existaient déjà ; les autres ont besoin de la colonne repete. Tant que la base ne la
// connaît pas, l'appli ne les propose pas : rien ne se perd.

let connu: boolean | null = null
export function useRepetitions(api: Backend, events: FamEvent[]): boolean {
  const vu = events.some((e) => 'repete' in e)
  const [ok, setOk] = useState(connu ?? vu)
  useEffect(() => {
    if (ok || vu) {
      connu = true
      return
    }
    let vivant = true
    api
      .repetitions()
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

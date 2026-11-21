import { useEffect, useRef } from 'react'

// Ce qu'un widget demande à l'onglet Organiser (Elisa, 21 novembre : « quand on ouvre, ça nous emmène que rien ») :
// l'agenda, les tâches ou les courses, et parfois la fiche d'un événement. L'onglet n'est peut-être pas encore
// affiché quand la demande arrive : elle attend qu'il la prenne.

export type DemandeOrganiser = { seg: 'agenda' | 'tache' | 'course'; evt?: string }

let enAttente: DemandeOrganiser | null = null
const ecoutes = new Set<(d: DemandeOrganiser) => void>()

export function demanderOrganiser(d: DemandeOrganiser) {
  enAttente = d
  for (const f of ecoutes) f(d)
}

/** L'onglet Organiser prend les demandes : celle qui attendait, puis les suivantes. */
export function useDemandeOrganiser(f: (d: DemandeOrganiser) => void) {
  const actuelle = useRef(f)
  actuelle.current = f
  useEffect(() => {
    const prendre = (d: DemandeOrganiser) => {
      enAttente = null
      actuelle.current(d)
    }
    if (enAttente) prendre(enAttente)
    ecoutes.add(prendre)
    return () => {
      ecoutes.delete(prendre)
    }
  }, [])
}

/** Le chemin d'un widget (« agenda/<id> », « afaire », « courses ») en demande pour l'onglet Organiser. */
export function demandeDuChemin(chemin: string): DemandeOrganiser | null {
  const [quoi, id] = chemin.split('/')
  if (quoi === 'agenda') return { seg: 'agenda', evt: id || undefined }
  if (quoi === 'afaire') return { seg: 'tache' }
  if (quoi === 'courses') return { seg: 'course' }
  return null
}

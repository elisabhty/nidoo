// L'activité en direct « prochain rendez-vous » : sur l'écran verrouillé et dans l'île dynamique de l'iPhone,
// le rendez-vous, le lieu, et le temps qu'il reste (iOS fait défiler le compte à rebours tout seul, sans serveur).
// On la lance depuis la fiche d'un événement, et toute seule à l'ouverture de l'appli quand un rendez-vous qui me
// concerne commence dans moins de deux heures (Réglages : « Rendez-vous sur l'écran verrouillé »).
// Sur le web et en démo, rien de tout ceci n'existe : les boutons ne s'affichent pas.
import { titreCalendrier } from './calendrier'
import { avecQui, cleFois, prochainASuivre, suivable } from './directRegles'
import { endroitNomme } from './endroits'
import { pont } from './pont'
import type { Endroit, FamEvent, Member } from './types'

const CLE_AUTO = 'nidoo.direct.auto'
const CLE_VUS = 'nidoo.direct.vus'

export type EtatDirect = { possible: boolean; ids: string[] }

/** Les activités en direct sont-elles permises sur cet iPhone (iOS 16.2, réglage d'iOS), et lesquelles sont à l'écran. */
export async function etatDirect(): Promise<EtatDirect> {
  if (!pont) return { possible: false, ids: [] }
  try {
    const r = await pont.activites()
    return { possible: !!r.possible, ids: r.ids ?? [] }
  } catch {
    return { possible: false, ids: [] } // une appli installée avant cette nouveauté
  }
}

const lire = (cle: string) => {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}
const ecrire = (cle: string, v: string) => {
  try {
    localStorage.setItem(cle, v)
  } catch {
    /* sans conséquence */
  }
}

export const autoActif = () => lire(CLE_AUTO) !== '0'
export const reglerAuto = (oui: boolean) => ecrire(CLE_AUTO, oui ? '1' : '0')

const vus = (): string[] => {
  try {
    const v = JSON.parse(lire(CLE_VUS) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
const noterVu = (cle: string) => ecrire(CLE_VUS, JSON.stringify([...vus().filter((x) => x !== cle), cle].slice(-30)))

/** Afficher ce rendez-vous sur l'écran verrouillé et dans l'île dynamique. */
export async function suivreRendezVous(e: FamEvent, members: Member[], moi: string, endroits: readonly Endroit[] = []): Promise<'lancee' | 'refusee' | 'indisponible'> {
  const at = suivable(e)
  if (!pont || !at) return 'indisponible'
  try {
    const r = await pont.activite({
      id: e.id,
      genre: e.kind,
      titre: titreCalendrier(e),
      debut: at.getTime(),
      // une de nos adresses : son nom (« École »), plutôt que le début de l'adresse
      ...(e.lieu?.trim() ? { lieu: (endroitNomme(e.lieu, endroits)?.nom ?? e.lieu.trim().split(',')[0]).slice(0, 60) } : {}),
      ...(avecQui(e, members, moi) ? { avec: avecQui(e, members, moi)! } : {}),
    })
    if (r.etat === 'lancee') noterVu(cleFois(e.id, at))
    return r.etat
  } catch {
    return 'indisponible'
  }
}

/** La retirer (et ne pas la relancer toute seule pour cette fois-là). */
export async function retirerRendezVous(e?: FamEvent) {
  if (!pont) return
  if (e) {
    const at = suivable(e)
    if (at) noterVu(cleFois(e.id, at))
  }
  try {
    await pont.activiteFin(e ? { id: e.id } : {})
  } catch {
    /* rien à retirer */
  }
}

let enCours = false
/** À l'ouverture de l'appli : le prochain rendez-vous qui me concerne, s'il commence dans moins de deux heures. */
export async function suivreProchain(events: FamEvent[], members: Member[], moi: string, endroits: readonly Endroit[] = []) {
  if (!pont || enCours || !autoActif()) return
  const prochain = prochainASuivre(events, moi, vus())
  if (!prochain) return
  enCours = true
  try {
    const etat = await etatDirect()
    if (!etat.possible || etat.ids.length) return // déjà un rendez-vous à l'écran : on ne le remplace pas tout seul
    await suivreRendezVous(prochain.e, members, moi, endroits)
  } finally {
    enCours = false
  }
}

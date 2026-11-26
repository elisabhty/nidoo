// « Je suis en route » (Elisa, 26 novembre, d'après la liste « Prévenir sa famille que l'on est sur le chemin du
// retour ») : un petit mot à ses proches, avec l'heure d'arrivée. Il part comme les autres petits mots (l'appli, et
// le widget des attentions) : rien de nouveau dans la base. Sans écran ici : testé à part (tests/enRoute.test.mjs).

/** « J'arrive dans… » : en minutes ; null, sans heure. */
export const DELAIS: readonly (number | null)[] = [5, 10, 15, 20, 30, 45, 60, null]

const INSECABLE = ' '
const CINQ_MIN = 5 * 60000

/** « 5 min », « 1 h », « 1 h 30 » ; sans heure : « Je ne sais pas ». */
export function libelleDelai(minutes: number | null): string {
  if (minutes == null) return 'Je ne sais pas'
  if (minutes < 60) return `${minutes}${INSECABLE}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}${INSECABLE}h${INSECABLE}${String(m).padStart(2, '0')}` : `${h}${INSECABLE}h`
}

/** L'heure d'arrivée, arrondie aux cinq minutes d'après (18 h 12 + 15 min : 18 h 30). */
export function arrivee(maintenant: number, minutes: number): Date {
  return new Date(Math.ceil((maintenant + minutes * 60000) / CINQ_MIN) * CINQ_MIN)
}

/** « 18 h 30 », « 19 h », « 9 h 05 » (insécables : l'heure ne se coupe pas en fin de ligne). */
export function texteHeure(d: Date): string {
  const m = d.getMinutes()
  return `${d.getHours()}${INSECABLE}h${m ? `${INSECABLE}${String(m).padStart(2, '0')}` : ''}`
}

/** Le petit mot : « Je suis en route, j'arrive vers 18 h 30 🚗 » (140 signes au plus, comme tous les petits mots ;
 *  la voiture reste collée à l'heure en fin de ligne). */
export function messageEnRoute(minutes: number | null, maintenant: number): string {
  return minutes == null ? `Je suis en route${INSECABLE}🚗` : `Je suis en route, j’arrive vers ${texteHeure(arrivee(maintenant, minutes))}${INSECABLE}🚗`
}

/** Le bouton : « Prévenir mes proches » (tous), « Prévenir Papa », « Prévenir Papa et Léa », « Prévenir 3 proches ». */
export function boutonPrevenir(noms: readonly string[], total: number): string {
  if (!noms.length) return 'Prévenir'
  if (noms.length === total && total > 1) return 'Prévenir mes proches'
  if (noms.length === 1) return `Prévenir ${noms[0]}`
  if (noms.length === 2) return `Prévenir ${noms[0]} et ${noms[1]}`
  return `Prévenir ${noms.length} proches`
}

// Les scènes de la maison (un geste qui vole d'un proche à l'autre) déjà jouées sur ce téléphone, par petit mot.
export const SCENES_JOUEES = 'nidoo.scenes.jouees'

/** Des petits mots envoyés d'un coup (« Je suis en route ») : pas une scène par proche à l'accueil, l'envoi s'est
 *  déjà vu dans la fiche. */
export function scenesDejaVues(ids: readonly string[]) {
  if (!ids.length) return
  try {
    const avant = JSON.parse(localStorage.getItem(SCENES_JOUEES) ?? '[]') as string[]
    localStorage.setItem(SCENES_JOUEES, JSON.stringify([...avant, ...ids].slice(-60)))
  } catch {
    /* tant pis : les scènes se joueront */
  }
}

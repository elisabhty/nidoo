// Se présenter à l'accueil (genre, âge, cheveux, peau, lunettes) pour qu'on te propose tout de suite
// la figurine qui te ressemble, dans la bonne couleur de peau. Sans import (les tests le chargent tel quel) :
// on reçoit la liste des figurines et leurs autres peaux.

export type Genre = 'femme' | 'homme' | 'neutre'
export type Age = 'enfant' | 'ado' | 'jeune' | 'adulte' | 'senior'
export type Cheveux = 'blond' | 'roux' | 'brun' | 'noir' | 'gris' | 'voile' | 'chauve'
export type Presentation = { genre?: Genre; age?: Age; cheveux?: Cheveux; teint?: number; lunettes?: boolean }

export const GENRES: { key: Genre; label: string }[] = [
  { key: 'femme', label: 'Une femme' },
  { key: 'homme', label: 'Un homme' },
  { key: 'neutre', label: 'Je préfère ne pas dire' },
]
export const AGES: { key: Age; label: string }[] = [
  { key: 'enfant', label: 'Moins de 12 ans' },
  { key: 'ado', label: '12 – 17 ans' },
  { key: 'jeune', label: '18 – 34 ans' },
  { key: 'adulte', label: '35 – 59 ans' },
  { key: 'senior', label: '60 ans et plus' },
]
export const CHEVEUX: { key: Cheveux; label: string; couleur: string }[] = [
  { key: 'blond', label: 'Blonds', couleur: '#E9C46A' },
  { key: 'roux', label: 'Roux', couleur: '#C8642E' },
  { key: 'brun', label: 'Châtains', couleur: '#7A4B2A' },
  { key: 'noir', label: 'Noirs', couleur: '#2B2224' },
  { key: 'gris', label: 'Gris ou blancs', couleur: '#D4D0D8' },
  { key: 'voile', label: 'Un voile', couleur: '#B9A6F2' },
  { key: 'chauve', label: 'Pas de cheveux', couleur: '#F2D6BF' },
]
/** Les cinq teints de la galerie, du plus clair au plus foncé (comme TONES dans persos.ts). */
export const TEINTS = [
  { couleur: '#F7DFCB', label: 'Peau très claire' },
  { couleur: '#EDC7A6', label: 'Peau claire' },
  { couleur: '#D4A276', label: 'Peau mate' },
  { couleur: '#A46B45', label: 'Peau foncée' },
  { couleur: '#6A4128', label: 'Peau très foncée' },
]

/** Reteindre des cheveux : le numéro de la couleur dans CHEVEUX (personnalise.ts), à partir de 1. */
const TEINTURE: Partial<Record<Cheveux, number>> = { noir: 1, brun: 3, blond: 4, roux: 6, gris: 7 }

type Fig = { id: string; g: string; a: number; t: number; c: string; l?: boolean; b?: boolean; s?: boolean }
type AutresPeaux = Record<string, { t: number; b: number }[]>

/** Les cheveux qu'on propose selon l'âge et le genre (pas de cheveux gris à 10 ans, pas de voile pour un homme). */
export function cheveuxPossibles(pr: Presentation): typeof CHEVEUX {
  return CHEVEUX.filter((c) => {
    if (c.key === 'gris' && (pr.age === 'enfant' || pr.age === 'ado')) return false
    if (c.key === 'voile' && pr.genre === 'homme') return false
    if (c.key === 'chauve' && (pr.genre === 'femme' || pr.age === 'enfant' || pr.age === 'ado')) return false
    return true
  })
}

/**
 * La figurine la plus ressemblante : d'abord le bon âge et le bon genre, puis les cheveux, les lunettes, la peau.
 * Renvoie son numéro (k, à partir de 1), sa taille (a), l'image de peau à prendre (q, 0 : la sienne)
 * et la couleur des cheveux si on doit les reteindre (x, 0 : les siens).
 * `hasard` (entre 0 et 1) départage deux figurines aussi ressemblantes.
 */
export function figurinePour(pr: Presentation, figurines: Fig[], peaux: AutresPeaux, hasard: () => number = Math.random): { k: number; a: number; q: number; x: number } | null {
  const filles = pr.genre === 'homme' ? [] : ['fille']
  const garcons = pr.genre === 'femme' ? [] : ['garcon']
  const groupes =
    pr.age === 'enfant' || pr.age === 'ado'
      ? [...filles, ...garcons]
      : [...(pr.genre === 'homme' ? [] : ['femme']), ...(pr.genre === 'femme' ? [] : ['homme'])]
  let meilleur: { k: number; a: number; q: number; x: number; score: number } | null = null
  for (let i = 0; i < figurines.length; i++) {
    const f = figurines[i]
    if (pr.age && !groupes.includes(f.g)) continue
    if (!pr.age && pr.genre && !(pr.genre === 'femme' ? ['femme', 'fille'] : pr.genre === 'homme' ? ['homme', 'garcon'] : [f.g]).includes(f.g)) continue
    if (f.g === 'bebe') continue
    let score = hasard() * 0.6
    // l'âge
    if (pr.age === 'enfant') score += f.a === 2 ? 6 : -6
    else if (pr.age === 'ado') score += f.a === 1 ? 6 : -6
    else if (pr.age === 'senior') score += f.s ? 6 : -4
    else if (pr.age) score += f.s ? -6 : 2
    // les cheveux : ceux de la figurine, sinon on les reteint (x : numéro dans CHEVEUX de personnalise.ts, à partir de 1)
    let x = 0
    if (pr.cheveux) {
      if (f.c === pr.cheveux) score += 5
      else if (pr.cheveux === 'chauve' && f.c === 'gris') score += 1
      else if (pr.cheveux === 'voile' || f.c === 'voile' || pr.cheveux === 'chauve' || f.c === 'chauve') score -= 6
      else {
        x = TEINTURE[pr.cheveux] ?? 0
        score += 2
      }
    } else if (f.c === 'voile' || f.c === 'chauve') score -= 1.5
    // les lunettes
    if (pr.lunettes !== undefined) score += !!f.l === pr.lunettes ? 2.5 : -1.5
    // la peau : la sienne, ou une autre image de la même figurine
    let q = 0
    if (pr.teint !== undefined) {
      if (f.t === pr.teint) score += 3
      else {
        const autre = (peaux[f.id] ?? []).find((x) => x.b === pr.teint)
        if (autre) {
          q = autre.t
          score += 2.4
        } else score -= Math.abs(f.t - pr.teint) * 1.5
      }
    }
    if (!meilleur || score > meilleur.score) meilleur = { k: i + 1, a: f.a, q, x, score }
  }
  return meilleur && { k: meilleur.k, a: meilleur.a, q: meilleur.q, x: meilleur.x }
}

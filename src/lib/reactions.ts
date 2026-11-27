// Les réactions du fil (Elisa, 27 novembre : « pouvoir mettre d'autres réactions »).
// Cinq réactions du panda à portée de pouce (appui long sur J'aime), puis toutes les autres : d'autres têtes du panda,
// les émojis en feutrine de Nidoo, et n'importe quel émoji du clavier.
// En base, une réaction tient en 8 caractères au plus (reactions.emoji) : les nôtres ont une clé courte, un émoji du
// clavier est gardé tel quel.
import { REACTIONS } from './data'

export type Reac = { cle: string; label: string; art?: string; sticker?: string; emoji?: string }

/** Les cinq d'origine : le cœur, le rire, l'amour, l'émotion, le bravo. */
export const RAPIDES: Reac[] = REACTIONS.map((r) => ({ cle: r.key, label: r.label, art: r.art }))

/** Les autres têtes du panda roux (celles qui ne doublent pas les cinq). */
export const PANDA: Reac[] = [
  { cle: 'p:heur', label: 'Heureux', sticker: 'panda-heureux' },
  { cle: 'p:fete', label: 'La fête', sticker: 'panda-fete' },
  { cle: 'p:zen', label: 'Zen', sticker: 'panda-serein' },
  { cle: 'p:motiv', label: 'Motivé', sticker: 'panda-motive' },
  { cle: 'p:fatig', label: 'Fatigué', sticker: 'panda-fatigue' },
  { cle: 'p:triste', label: 'Triste', sticker: 'panda-triste' },
  { cle: 'p:stress', label: 'Stressé', sticker: 'panda-stresse' },
]

/** Les émojis en feutrine de Nidoo. */
export const FEUTRINE: Reac[] = [
  { cle: 'e:mdr', label: 'Mort de rire', sticker: 'emo-mdr' },
  { cle: 'e:amour', label: 'Amoureux', sticker: 'emo-amoureux' },
  { cle: 'e:bisou', label: 'Bisou', sticker: 'emo-bisou' },
  { cle: 'e:calin', label: 'Câlin', sticker: 'emo-calin' },
  { cle: 'e:coucou', label: 'Coucou', sticker: 'emo-coucou' },
  { cle: 'e:merci', label: 'Merci', sticker: 'emo-merci' },
  { cle: 'e:bravo', label: 'Bravo', sticker: 'emo-bravo' },
  { cle: 'e:fete', label: 'La fête', sticker: 'emo-fete' },
  { cle: 'e:coquin', label: 'Clin d’œil', sticker: 'emo-coquin' },
  { cle: 'e:timide', label: 'Timide', sticker: 'emo-timide' },
  { cle: 'e:stp', label: 'S’il te plaît', sticker: 'emo-supplie' },
  { cle: 'e:pleure', label: 'Triste', sticker: 'emo-pleure' },
  { cle: 'e:wouah', label: 'Surpris', sticker: 'emo-surpris' },
  { cle: 'e:hmm', label: 'Je réfléchis', sticker: 'emo-reflechit' },
  { cle: 'e:dodo', label: 'Dodo', sticker: 'emo-dodo' },
  { cle: 'e:cool', label: 'Trop cool', sticker: 'emo-cool' },
  { cle: 'e:ange', label: 'Petit ange', sticker: 'emo-ange' },
  { cle: 'e:fort', label: 'Courage', sticker: 'emo-costaud' },
]

/** Des émojis du clavier, pour aller vite ; le champ « Un autre émoji » accepte tous les autres. */
export const CLAVIER = ['❤️', '😂', '😍', '🥰', '😘', '🤗', '🥹', '😮', '😢', '😭', '😅', '🤣', '😋', '😎', '🤩', '🥳', '😱', '🤔', '😴', '🙈', '👏', '🙌', '🙏', '👍', '💪', '🫶', '✨', '🔥', '💯', '🎉', '🎂', '🎁', '🎄', '❄️', '☀️', '🌸', '🌈', '⭐', '🍀', '🐼']

const NOTRES = new Map<string, Reac>([...RAPIDES, ...PANDA, ...FEUTRINE].map((r) => [r.cle, r]))

/** Un émoji du clavier (pas du texte) : un pictogramme, sans lettres ni chiffres. */
export function estEmoji(s: string) {
  if (!s || s.length > 32) return false
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s)) return false
  return !/[\p{L}\p{N}]/u.test(s.replace(/[\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, ''))
}

/** Le premier émoji tapé dans le champ (le clavier peut en ajouter plusieurs) ; null si ce n'est pas un émoji
 *  ou s'il ne tient pas en base (8 caractères au plus). */
export function premierEmoji(texte: string): string | null {
  const t = texte.trim()
  if (!t) return null
  let g = t
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter
  if (Seg) {
    for (const x of new Seg('fr', { granularity: 'grapheme' }).segment(t)) {
      g = x.segment
      break
    }
  } else g = [...t][0]
  return estEmoji(g) && [...g].length <= 8 ? g : null
}

/** Ce qu'une réaction montre ; null pour une clé qu'on ne sait pas afficher (une version plus récente de Nidoo). */
export function reaction(cle: string | null | undefined): Reac | null {
  if (!cle) return null
  return NOTRES.get(cle) ?? (estEmoji(cle) ? { cle, label: cle, emoji: cle } : null)
}

/** Le mot sous le bouton quand on a réagi : son nom, ou « Réagi » pour un émoji du clavier. */
export const motDe = (r: Reac) => (r.emoji ? 'Réagi' : r.label)

/** Les réactions d'une publication, les plus données d'abord (à égalité, les cinq d'origine d'abord). */
export function lesPlusDonnees(cles: string[]): Reac[] {
  const n = new Map<string, number>()
  for (const c of cles) if (reaction(c)) n.set(c, (n.get(c) ?? 0) + 1)
  const rang = (c: string) => {
    const i = RAPIDES.findIndex((r) => r.cle === c)
    return i < 0 ? 99 : i
  }
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || rang(a) - rang(b)).map((c) => reaction(c)!)
}

// ───────── Les dernières utilisées (sur ce téléphone) ─────────

const CLE_RECENTES = 'nidoo.reactions.recentes'

export function recentes(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_RECENTES) ?? '[]')
    return Array.isArray(l) ? l.filter((c): c is string => typeof c === 'string' && !!reaction(c)).slice(0, 8) : []
  } catch {
    return []
  }
}

export function retenir(cle: string) {
  // les cinq d'origine sont toujours à portée : on ne retient que les autres
  if (RAPIDES.some((r) => r.cle === cle) || !reaction(cle)) return
  try {
    localStorage.setItem(CLE_RECENTES, JSON.stringify([cle, ...recentes().filter((c) => c !== cle)].slice(0, 8)))
  } catch {
    /* rien : ce n'est qu'un raccourci */
  }
}

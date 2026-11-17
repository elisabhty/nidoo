import type { AdventDoor, AppFlag, FamilyState } from './types'

/**
 * Le calendrier de l'Avent : 24 cases, du 1er au 24 décembre, à ouvrir en famille.
 * Une case s'ouvre à partir de son jour (heure de Paris), une fois pour toute la maison ;
 * chaque case ouverte accroche une décoration sur le sapin de la famille et rapporte une étoile (3 le 24).
 * Il s'affiche seulement quand l'interrupteur « avent » (table app_flags) est allumé et dans sa période :
 * on peut donc le cacher à distance, sans nouvelle version de l'appli.
 */

/** Ce qu'on peut faire depuis une case : un raccourci vers un endroit de l'appli. */
export type AventAction = 'attention' | 'carte' | 'humeur' | 'souvenirs' | 'compagnon' | 'potager' | 'centre' | 'organiser'

export type Case = { titre: string; texte: string; action?: { k: AventAction; label: string } }

/** Les décorations en feutrine (public/art/avent-<nom>.webp), accrochées tour à tour sur le sapin. */
export const DECOS = ['boule', 'etoile', 'sucre-orge', 'chaussette', 'pain-epice', 'cadeau', 'bonhomme-neige', 'pomme-pin'] as const
export const decoDe = (day: number) => (day === 24 ? 'etoile' : DECOS[(day - 1) % DECOS.length])
export const etoilesDe = (day: number) => (day === 24 ? 3 : 1)

export const CASES: Case[] = [
  { titre: 'C’est parti !', texte: 'Chaque case ouverte accroche une décoration sur notre sapin. Pour bien commencer, envoie une attention à quelqu’un de la maison.', action: { k: 'attention', label: 'Créer une attention' } },
  { titre: 'Ta chanson de Noël', texte: 'Quelle chanson de Noël te donne envie de danser ? Chante-la à quelqu’un aujourd’hui, même faux : surtout faux.' },
  { titre: 'Un bout d’hiver', texte: 'Prends en photo un petit bout d’hiver (du givre, une écharpe, un chocolat chaud…) et partage-le avec la famille.', action: { k: 'souvenirs', label: 'Partager une photo' } },
  { titre: 'La lettre au Père Noël', texte: 'Chacun pense à trois souhaits… dont un pour quelqu’un d’autre de la famille. Lequel diras-tu tout haut ?' },
  { titre: 'Ton plus beau Noël', texte: 'Les grands, racontez votre plus beau Noël d’enfant. Les petits, posez-leur la question !' },
  { titre: 'C’est la Saint-Nicolas', texte: 'Partage une douceur aujourd’hui (un pain d’épice, une clémentine, un carré de chocolat) avec quelqu’un que tu aimes.' },
  { titre: 'Le compagnon a froid', texte: 'Va voir le compagnon de la maison : une caresse ou une friandise, pour qu’il passe un bon hiver.', action: { k: 'compagnon', label: 'Voir le compagnon' } },
  { titre: 'Une carte de Noël', texte: 'Une carte toute prête, avec le sapin et les cadeaux : il ne reste qu’à l’envoyer à un proche.', action: { k: 'carte', label: 'Envoyer une carte' } },
  { titre: 'Humeur d’hiver', texte: 'Comment tu te sens aujourd’hui ? Partage ton humeur du jour : la famille veille sur toi.', action: { k: 'humeur', label: 'Mon humeur' } },
  { titre: 'La recette des fêtes', texte: 'Quelle recette doit absolument être au menu cette année ? Demande-la à celui ou celle qui la réussit le mieux.' },
  { titre: 'Le bonhomme de neige', texte: 'Dessine un bonhomme de neige (les yeux fermés si tu es courageux) et envoie-le à la famille.', action: { k: 'attention', label: 'Dessiner' } },
  { titre: 'Un grand merci', texte: 'Dis merci à quelqu’un de la famille pour une chose qu’il a faite pour toi cette année.', action: { k: 'attention', label: 'Dire merci' } },
  { titre: 'Une petite lumière', texte: 'La nuit tombe tôt : allume une bougie ou une guirlande, prends-la en photo et partage un peu de lumière.', action: { k: 'souvenirs', label: 'Partager une photo' } },
  { titre: 'Un jeu ensemble', texte: 'Proposez une partie de jeu de société ce week-end, autour de la table ou à distance. Qui est le plus mauvais perdant ?' },
  { titre: 'Le potager d’hiver', texte: 'Passe au potager : même en hiver, ça pousse chez nous. Arrose, récolte, sème quelque chose de nouveau.', action: { k: 'potager', label: 'Aller au potager' } },
  { titre: 'Ton film de Noël', texte: 'Quel film de Noël faut-il regarder tous ensemble cette année ? Défends ton choix !' },
  { titre: 'Un appel surprise', texte: 'Appelle quelqu’un de la famille juste pour lui dire bonjour. Cinq minutes suffisent à faire une belle journée.' },
  { titre: 'Habillé pour l’hiver', texte: 'Un tour au centre commercial ? Un manteau, des bottes ou une écharpe pour ton personnage, avec les étoiles de la maison.', action: { k: 'centre', label: 'Aller au centre commercial' } },
  { titre: 'La photo d’avant', texte: 'Retrouve une vieille photo de Noël et partage-la : qui saura dire en quelle année elle a été prise ?', action: { k: 'souvenirs', label: 'Partager une photo' } },
  { titre: 'Un mot doux', texte: 'Glisse un petit mot à quelqu’un qui en a besoin en ce moment. Ça ne prend qu’une minute.', action: { k: 'attention', label: 'Écrire un petit mot' } },
  { titre: 'La nuit la plus longue', texte: 'C’est le solstice : dès demain, les jours rallongent ! Partage ton humeur de ce soir.', action: { k: 'humeur', label: 'Mon humeur' } },
  { titre: 'Qui apporte quoi ?', texte: 'Les fêtes approchent : la bûche, les jeux, les chaises en plus… Faites le point ensemble dans Organiser.', action: { k: 'organiser', label: 'Ouvrir Organiser' } },
  { titre: 'Pour ceux qui sont loin', texte: 'Envoie une carte de Noël à quelqu’un que tu ne verras pas pendant les fêtes : il saura que tu penses à lui.', action: { k: 'carte', label: 'Envoyer une carte' } },
  { titre: 'Joyeux Noël !', texte: 'Le sapin est prêt. Merci d’avoir ouvert le calendrier ensemble ! Embrassez-vous fort, en vrai ou en attention.', action: { k: 'attention', label: 'Envoyer un câlin' } },
]

/** La date du jour à Paris (année, mois 1-12, jour). */
export function parisToday(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number)
  return { y, m, d }
}

/** Un interrupteur est-il allumé en ce moment ? */
export function flagOn(f: AppFlag | undefined, now = Date.now()) {
  if (!f?.enabled) return false
  if (f.starts_at && now < Date.parse(f.starts_at)) return false
  if (f.ends_at && now >= Date.parse(f.ends_at)) return false
  return true
}

export type Avent = {
  /** Le calendrier s'affiche-t-il (interrupteur allumé, dans sa période) ? */
  visible: boolean
  year: number
  /** Jusqu'à quelle case on peut ouvrir (0 : pas encore décembre, ou c'est fini). */
  today: number
  /** Combien de jours avant le 1er décembre (avant décembre seulement). */
  dans: number
  /** Les cases ouvertes cette année, par jour. */
  doors: Map<number, AdventDoor>
  /** Les cases qu'on pourrait ouvrir et que personne n'a encore ouvertes. */
  aOuvrir: number[]
}

export function avent(state: Pick<FamilyState, 'flags' | 'advent'>, now = new Date()): Avent {
  const { y, m, d } = parisToday(now)
  const year = m <= 2 ? y - 1 : y
  const today = m === 12 ? Math.min(d, 24) : 0
  const dans = m < 12 && m > 2 ? Math.round((Date.UTC(y, 11, 1) - Date.UTC(y, m - 1, d)) / 86400000) : 0
  const doors = new Map(state.advent.filter((x) => x.year === year).map((x) => [x.day, x]))
  const aOuvrir = Array.from({ length: today }, (_, i) => i + 1).filter((k) => !doors.has(k))
  return { visible: flagOn(state.flags.avent, now.getTime()), year, today, dans, doors, aOuvrir }
}

import { PERSO } from './stickers'
import type { DrawingData, Sticker } from './types'

/**
 * Les cartes toutes prêtes : un papier, un cadre, un mot et quelques stickers déjà posés.
 * On peut ensuite tout bouger, ajouter une photo, dessiner dessus.
 * Le prénom de celui qui la reçoit s'écrit tout seul quand la carte est pour un proche.
 */

const NUIT = '#1E1B33'
const ROSE = '#FFE9EF'
const CREME = '#FFF6E5'
const CIEL = '#E6F2FF'

const st = (i: string, x: number, y: number, s: number, r = 0): Sticker => ({ i, x, y, s, r })
const mot = (t: string, c: number, x: number, y: number, s: number, r = 0): Sticker => ({ i: PERSO, t, c, x, y, s, r })

export type Carte = { key: string; label: string; data: (nom?: string) => DrawingData }

const pour = (debut: string, nom?: string) => (nom ? `${debut} ${nom} !` : `${debut} !`)

export const CARTES: Carte[] = [
  {
    key: 'anniversaire',
    label: 'Anniversaire',
    data: (nom) => ({
      v: 1,
      bg: ROSE,
      s: [],
      fr: 'fanions',
      k: [st('gateau', 175, 300, 190, -8), st('ballons', 835, 265, 200, 8), st('chapeau', 165, 130, 100, -16), mot(pour('Joyeux\nanniversaire', nom), 0, 505, 270, 380, -3)],
    }),
  },
  {
    key: 'fete',
    label: 'Bonne fête',
    data: (nom) => ({ v: 1, bg: ROSE, s: [], fr: 'dentelle', k: [st('fleurs', 190, 250, 180, -10), st('coeur', 815, 280, 130, 12), mot(pour('Bonne fête', nom), 6, 510, 235, 360, -2)] }),
  },
  {
    key: 'jetaime',
    label: 'Je t’aime',
    data: () => ({ v: 1, bg: ROSE, s: [], fr: 'coeurs', k: [st('coeurs', 225, 300, 160, -10), st('bisou', 785, 310, 160, 10), st('mot:jetaime', 500, 200, 380, -3)] }),
  },
  {
    key: 'manques',
    label: 'Tu me manques',
    data: () => ({ v: 1, bg: CIEL, s: [], fr: 'postale', k: [st('avion', 190, 140, 160, -12), st('lettre', 200, 345, 130, 8), st('maison', 650, 330, 140, 6), st('mot:manques', 440, 230, 330, -4)] }),
  },
  {
    key: 'coucou',
    label: 'Coucou',
    data: () => ({ v: 1, bg: CIEL, s: [], fr: 'scotch', k: [st('panda', 230, 230, 200, -8), st('soleil', 800, 140, 130, 10), st('mot:coucou', 640, 260, 330, 4)] }),
  },
  {
    key: 'merci',
    label: 'Merci',
    data: () => ({ v: 1, bg: CREME, s: [], fr: 'fleurs', k: [st('coeur', 690, 300, 120, 14), st('mot:merci', 480, 220, 330, -4)] }),
  },
  {
    key: 'bravo',
    label: 'Félicitations',
    data: (nom) => ({
      v: 1,
      bg: CREME,
      s: [],
      fr: 'or',
      k: [st('couronne', 500, 110, 150, -6), st('etoile', 175, 300, 110, -12), st('etoile', 825, 300, 110, 12), mot(nom ? `Bravo ${nom} !` : 'Félicitations !', 3, 500, 270, 400, -2)],
    }),
  },
  {
    key: 'courage',
    label: 'Courage',
    data: () => ({ v: 1, bg: CIEL, s: [], fr: 'arcenciel', k: [st('soleil', 190, 160, 150, -8), st('trefle', 810, 320, 130, 10), st('mot:courage', 500, 245, 360, -3)] }),
  },
  {
    key: 'nuit',
    label: 'Bonne nuit',
    data: () => ({ v: 1, bg: NUIT, s: [], fr: 'etoiles', k: [st('lune', 185, 230, 170, -6), st('nuage', 805, 320, 150, 6), st('mot:bonnenuit', 530, 240, 360, -3)] }),
  },
  {
    key: 'noel',
    label: 'Joyeux Noël',
    data: (nom) => ({
      v: 1,
      bg: NUIT,
      s: [],
      fr: 'noel',
      k: [st('etoile', 175, 140, 120, -10), st('cadeau', 820, 310, 170, 8), mot(nom ? `Joyeux Noël\n${nom} !` : 'Joyeux Noël !', 1, 490, 245, 400, -3)],
    }),
  },
  {
    key: 'annee',
    label: 'Bonne année',
    data: () => ({ v: 1, bg: NUIT, s: [], fr: 'etoiles', k: [st('chapeau', 180, 300, 130, -14), st('ballons', 830, 270, 180, 8), st('etoile', 780, 110, 90, 10), mot('Bonne année !', 3, 490, 230, 420, -3)] }),
  },
]

export const carteDe = (k: string) => CARTES.find((c) => c.key === k)

/** Le prénom à écrire sur une carte : on garde le premier mot s'il est long (« Mamie Jo » reste entier). */
export const prenom = (nom: string) => (nom.length > 12 ? nom.split(/\s+/)[0] : nom).slice(0, 14)

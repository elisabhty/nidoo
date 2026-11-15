import type { HouseType, ThoughtKind } from './types'

export const MOODS: { key: string; label: string }[] = [
  { key: 'heureux', label: 'Au top' },
  { key: 'serein', label: 'Zen' },
  { key: 'motive', label: 'À fond' },
  { key: 'fete', label: 'En fête' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'stresse', label: 'Stress' },
  { key: 'nostalgique', label: 'Nostalgie' },
  { key: 'triste', label: 'Coup de mou' },
]
export const moodOf = (key: string | null) => MOODS.find((m) => m.key === key) ?? null

export const AVATARS: { key: string; label: string }[] = [
  { key: 'panda', label: 'Panda' }, { key: 'renard', label: 'Renard' }, { key: 'ours', label: 'Ours' },
  { key: 'lapin', label: 'Lapin' }, { key: 'chat', label: 'Chat' }, { key: 'chien', label: 'Chien' },
  { key: 'hibou', label: 'Hibou' }, { key: 'koala', label: 'Koala' }, { key: 'lion', label: 'Lion' },
  { key: 'pingouin', label: 'Pingouin' }, { key: 'grenouille', label: 'Grenouille' }, { key: 'licorne', label: 'Licorne' },
]

export const COLORS: Record<string, { bg: string; deep: string; ring: string }> = {
  lavande: { bg: '#EFE8FD', deep: '#D5C6F7', ring: '#9B7FEA' },
  peche: { bg: '#FFEEE2', deep: '#FFD0B3', ring: '#F58B5C' },
  mousse: { bg: '#E6F5E9', deep: '#C3E6CB', ring: '#62B67A' },
  ciel: { bg: '#E3F1FC', deep: '#BDDDF7', ring: '#5AA3E0' },
  rose: { bg: '#FDE6EE', deep: '#F9C4D5', ring: '#E77BA0' },
  soleil: { bg: '#FDF3D2', deep: '#F9E19B', ring: '#E0B02F' },
}
export const COLOR_KEYS = Object.keys(COLORS)

export const HOUSES: { key: HouseType; label: string; hint: string }[] = [
  { key: 'maison', label: 'Maison', hint: 'Le grand classique' },
  { key: 'appartement', label: 'Appartement', hint: 'En ville, tout près' },
  { key: 'chalet', label: 'Chalet', hint: 'Au coin du feu' },
]

export const THOUGHTS: { key: ThoughtKind; label: string; said: string }[] = [
  { key: 'coeur', label: 'Je pense à toi', said: 'pense à toi' },
  { key: 'calin', label: 'Un gros câlin', said: 't’envoie un gros câlin' },
  { key: 'courage', label: 'Courage !', said: 't’envoie du courage' },
  { key: 'bisou', label: 'Bisous', said: 't’envoie des bisous' },
]
export const thoughtOf = (k: string) => THOUGHTS.find((t) => t.key === k) ?? { key: 'mot' as ThoughtKind, label: 'Petit mot', said: 't’a écrit un petit mot' }

export const REACTIONS: { key: string; art: string; label: string }[] = [
  { key: 'coeur', art: 'geste-coeur', label: 'J’aime' },
  { key: 'rire', art: 'reaction-rire', label: 'Trop drôle' },
  { key: 'amour', art: 'reaction-amour', label: 'J’adore' },
  { key: 'emu', art: 'humeur-nostalgique', label: 'Touché' },
  { key: 'bravo', art: 'reaction-bravo', label: 'Bravo' },
]

export type Deco = { key: string; name: string; cost: number }
// Les coûts doivent rester alignés avec la table house_catalog côté Supabase.
export const DECOS: Deco[] = [
  { key: 'fleurs', name: 'Massif de fleurs', cost: 5 },
  { key: 'boite', name: 'Boîte aux lettres', cost: 8 },
  { key: 'lanterne', name: 'Lanterne', cost: 12 },
  { key: 'arbre', name: 'Grand arbre', cost: 18 },
  { key: 'fumee', name: 'Feu de cheminée', cost: 20 },
  { key: 'guirlande', name: 'Guirlande lumineuse', cost: 25 },
  { key: 'chat', name: 'Chat du quartier', cost: 30 },
  { key: 'balancoire', name: 'Balançoire', cost: 40 },
  { key: 'potager', name: 'Petit potager', cost: 50 },
  { key: 'cabane', name: 'Cabane à oiseaux', cost: 70 },
  { key: 'fontaine', name: 'Fontaine', cost: 90 },
  { key: 'montgolfiere', name: 'Montgolfière', cost: 120 },
]

export const STAR_REASONS: Record<string, string> = {
  moment: 'a partagé un instant',
  attention: 'a envoyé une attention',
  dessin: 'a envoyé un dessin',
  humeur: 'a donné sa météo',
  question: 'a répondu à la question du jour',
  mission: 'a terminé une mission',
}

export const QUESTIONS: { key: string; text: string }[] = [
  { key: 'q01', text: 'Quel plat te rappelle le plus la maison ?' },
  { key: 'q02', text: 'Ton meilleur souvenir de vacances en famille ?' },
  { key: 'q03', text: 'Qui chante le plus faux à la maison ?' },
  { key: 'q04', text: 'Quelle expression répète-t-on tout le temps chez nous ?' },
  { key: 'q05', text: 'Le film que toute la famille devrait revoir ensemble ?' },
  { key: 'q06', text: 'Quelle odeur te ramène direct en enfance ?' },
  { key: 'q07', text: 'Qui est le plus mauvais perdant aux jeux de société ?' },
  { key: 'q08', text: 'Le prochain endroit où tu aimerais qu’on aille tous ensemble ?' },
  { key: 'q09', text: 'Quelle bêtise d’enfance n’as-tu jamais avouée ?' },
  { key: 'q10', text: 'La chanson qui te fait penser à la famille ?' },
  { key: 'q11', text: 'Qu’est-ce qui t’a fait sourire aujourd’hui ?' },
  { key: 'q12', text: 'Quel objet de la maison garderais-tu pour toujours ?' },
  { key: 'q13', text: 'Qui cuisine le mieux, et quel est son plat signature ?' },
  { key: 'q14', text: 'Une tradition de famille que tu veux transmettre ?' },
  { key: 'q15', text: 'Le cadeau le plus drôle reçu dans la famille ?' },
  { key: 'q16', text: 'Si notre famille était un animal, lequel serait-elle ?' },
  { key: 'q17', text: 'Quel surnom te donnait-on quand tu étais petit ?' },
  { key: 'q18', text: 'Le dimanche idéal en famille, c’est quoi ?' },
  { key: 'q19', text: 'Qui met le plus de temps à se préparer ?' },
  { key: 'q20', text: 'Une chose que tu admires chez quelqu’un de la famille ?' },
  { key: 'q21', text: 'Le fou rire de famille dont tu te souviens encore ?' },
  { key: 'q22', text: 'Quelle photo de famille préfères-tu, et pourquoi ?' },
  { key: 'q23', text: 'Quel talent caché a quelqu’un de la famille ?' },
  { key: 'q24', text: 'Le dessert qui met tout le monde d’accord ?' },
  { key: 'q25', text: 'Qu’aimerais-tu apprendre d’un membre de la famille ?' },
  { key: 'q26', text: 'Quel jeu faisait-on tout le temps quand on était petits ?' },
  { key: 'q27', text: 'La phrase culte de mamie ou de papi ?' },
  { key: 'q28', text: 'Qui est toujours en retard ?' },
  { key: 'q29', text: 'Un endroit qui te fait penser à nous ?' },
  { key: 'q30', text: 'Pour quoi dirais-tu merci à la famille cette semaine ?' },
]

export const PHOTO_CHALLENGES: string[] = [
  'Ce que tu vois par ta fenêtre',
  'Ton petit-déjeuner du jour',
  'Quelque chose de lavande ou de pêche',
  'Ta grimace la plus ridicule',
  'Un objet qui te fait penser à la famille',
  'Tes chaussures du jour',
  'Le ciel là où tu es',
  'Ce que tu cuisines ce soir',
  'Ton coin préféré de chez toi',
  'Un truc qui t’a fait rire',
  'Ta tasse du moment',
  'La plus belle plante autour de toi',
  'Ta vue en ce moment même',
  'Un souvenir retrouvé dans un tiroir',
]

const dayIndex = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000)
export const questionOfDay = (d = new Date()) => QUESTIONS[dayIndex(d) % QUESTIONS.length]
export const challengeOfDay = (d = new Date()) => PHOTO_CHALLENGES[dayIndex(d) % PHOTO_CHALLENGES.length]

export const PLAN_LIMITS = { free: 5, plus: 15 }

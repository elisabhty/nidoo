import type { HouseType, ThoughtKind } from './types'

export const MOODS: { key: string; emoji: string; label: string }[] = [
  { key: 'heureux', emoji: '😊', label: 'Au top' },
  { key: 'serein', emoji: '😌', label: 'Zen' },
  { key: 'motive', emoji: '💪', label: 'À fond' },
  { key: 'fete', emoji: '🥳', label: 'En fête' },
  { key: 'fatigue', emoji: '😴', label: 'Fatigue' },
  { key: 'stresse', emoji: '😣', label: 'Stress' },
  { key: 'nostalgique', emoji: '🥹', label: 'Nostalgie' },
  { key: 'triste', emoji: '😢', label: 'Coup de mou' },
]
export const moodOf = (key: string | null) => MOODS.find((m) => m.key === key) ?? null

export const AVATARS: { key: string; emoji: string }[] = [
  { key: 'panda', emoji: '🐼' }, { key: 'renard', emoji: '🦊' }, { key: 'ours', emoji: '🐻' },
  { key: 'lapin', emoji: '🐰' }, { key: 'chat', emoji: '🐱' }, { key: 'chien', emoji: '🐶' },
  { key: 'hibou', emoji: '🦉' }, { key: 'koala', emoji: '🐨' }, { key: 'lion', emoji: '🦁' },
  { key: 'pingouin', emoji: '🐧' }, { key: 'grenouille', emoji: '🐸' }, { key: 'licorne', emoji: '🦄' },
]
export const avatarEmoji = (key: string) => AVATARS.find((a) => a.key === key)?.emoji ?? '🐼'

export const COLORS: Record<string, { bg: string; ring: string }> = {
  lavande: { bg: '#E4D8F8', ring: '#A88CE0' },
  peche: { bg: '#FFDCC4', ring: '#F99263' },
  mousse: { bg: '#D5EBD9', ring: '#7FB88E' },
  ciel: { bg: '#D3E8F8', ring: '#74AEDD' },
  rose: { bg: '#FBD6E1', ring: '#E888A6' },
  soleil: { bg: '#FBEBB8', ring: '#E3B93F' },
}
export const COLOR_KEYS = Object.keys(COLORS)

export const HOUSES: { key: HouseType; label: string; hint: string }[] = [
  { key: 'maison', label: 'Maison', hint: 'Le grand classique' },
  { key: 'appartement', label: 'Appartement', hint: 'En ville, tout près' },
  { key: 'chalet', label: 'Chalet', hint: 'Au coin du feu' },
]

export const THOUGHTS: { key: ThoughtKind; emoji: string; label: string; said: string }[] = [
  { key: 'coeur', emoji: '💜', label: 'Je pense à toi', said: 'pense à toi' },
  { key: 'calin', emoji: '🤗', label: 'Un gros câlin', said: 't’envoie un gros câlin' },
  { key: 'courage', emoji: '💪', label: 'Courage !', said: 't’envoie du courage' },
  { key: 'bisou', emoji: '😘', label: 'Bisous', said: 't’envoie des bisous' },
]
export const thoughtOf = (k: string) => THOUGHTS.find((t) => t.key === k) ?? { key: 'mot', emoji: '💌', label: 'Petit mot', said: 't’a écrit un petit mot' }

export const REACTIONS = ['💜', '😂', '😍', '🥹', '👏']

export type Deco = { key: string; name: string; emoji: string; cost: number }
// Les coûts doivent rester alignés avec la table house_catalog côté Supabase.
export const DECOS: Deco[] = [
  { key: 'fleurs', name: 'Massif de fleurs', emoji: '🌷', cost: 5 },
  { key: 'boite', name: 'Boîte aux lettres', emoji: '📮', cost: 8 },
  { key: 'lanterne', name: 'Lanterne', emoji: '🏮', cost: 12 },
  { key: 'arbre', name: 'Grand arbre', emoji: '🌳', cost: 18 },
  { key: 'fumee', name: 'Feu de cheminée', emoji: '🔥', cost: 20 },
  { key: 'guirlande', name: 'Guirlande lumineuse', emoji: '✨', cost: 25 },
  { key: 'chat', name: 'Chat du quartier', emoji: '🐈', cost: 30 },
  { key: 'balancoire', name: 'Balançoire', emoji: '🛝', cost: 40 },
  { key: 'potager', name: 'Petit potager', emoji: '🥕', cost: 50 },
  { key: 'cabane', name: 'Cabane à oiseaux', emoji: '🐦', cost: 70 },
  { key: 'fontaine', name: 'Fontaine', emoji: '⛲', cost: 90 },
  { key: 'montgolfiere', name: 'Montgolfière', emoji: '🎈', cost: 120 },
]

export const STAR_REASONS: Record<string, string> = {
  moment: 'a partagé un instant',
  attention: 'a envoyé une attention',
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

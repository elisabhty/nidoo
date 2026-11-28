import type { HouseType, ThoughtKind } from './types'

/** color : la pastille de l'humeur dans la bulle au-dessus de chacun, devant la maison. */
export const MOODS: { key: string; label: string; color: string }[] = [
  { key: 'heureux', label: 'Au top', color: '#F5B700' },
  { key: 'serein', label: 'Zen', color: '#12A594' },
  { key: 'motive', label: 'Enthousiaste', color: '#F76B15' },
  { key: 'fete', label: 'En joie', color: '#D6409F' },
  { key: 'nostalgique', label: 'Un brin nostalgique', color: '#6E56CF' },
  { key: 'bof', label: 'Bof', color: '#9A94A8' },
  { key: 'fatigue', label: 'Fatigue', color: '#8E8AA6' },
  { key: 'malade', label: 'Pas en forme', color: '#6FA36B' },
  { key: 'stresse', label: 'Stress', color: '#E5484D' },
  { key: 'agace', label: 'Agacé', color: '#EF7D3C' },
  { key: 'triste', label: 'Coup de mou', color: '#3E9BE9' },
  { key: 'chagrin', label: 'Triste', color: '#4F7BD9' },
]
/** Pour la figurine de la maison, qui n'a que les huit premiers visages : la plus proche des nouvelles humeurs. */
export const VISAGE_PROCHE: Record<string, string> = { malade: 'fatigue', agace: 'stresse', chagrin: 'triste' }
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
  { key: 'maison', label: 'Le Cocon', hint: 'Doux et plein de tendresse' },
  { key: 'appartement', label: 'La Vie Citadine', hint: 'Un petit monde à partager' },
  { key: 'chalet', label: 'Le Refuge', hint: 'Plein de chaleur et de moments ensemble' },
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
  { key: 'balancoire', name: 'Balançoire', cost: 40 },
  { key: 'potager', name: 'Petit potager', cost: 50 },
  { key: 'cabane', name: 'Cabane à oiseaux', cost: 70 },
  { key: 'fontaine', name: 'Fontaine', cost: 90 },
  { key: 'montgolfiere', name: 'Montgolfière', cost: 120 },
]

/** Les animaux et les plantes du jardin : il faut s'en occuper chaque jour, en famille. */
export type Care = {
  verb: string; need: string; done: string; stars: number; kind: 'nourrir' | 'arroser'; adopt: string; act: string; warn: string
  /** « le chat », « les oiseaux » : pour les phrases */
  who: string; plural: boolean
}
export const CARE: Record<string, Care> = {
  // le compagnon : ses phrases prennent son prénom (voir careFor)
  compagnon: {
    verb: 'Nourrir le compagnon', need: 'Le compagnon a faim', done: 'a nourri le compagnon', stars: 3, kind: 'nourrir', who: 'le compagnon', plural: false,
    adopt: 'Adopter un compagnon ?', act: 'Adopter', warn: '',
  },
  cabane: {
    verb: 'Nourrir les oiseaux', need: 'Les oiseaux ont faim', done: 'a nourri les oiseaux', stars: 3, kind: 'nourrir', who: 'les oiseaux', plural: true,
    adopt: 'Accueillir les oiseaux ?', act: 'Accueillir', warn: 'Ils viendront nicher dans la cabane. Il faudra les nourrir chaque jour, en famille : n’importe qui peut le faire, et ça rapporte 3 étoiles à la maison.',
  },
  fleurs: {
    verb: 'Arroser les fleurs', need: 'Les fleurs ont soif', done: 'a arrosé les fleurs', stars: 1, kind: 'arroser', who: 'les fleurs', plural: true,
    adopt: 'Planter les fleurs ?', act: 'Planter', warn: 'Il faudra les arroser chaque jour, en famille : n’importe qui peut le faire, et ça rapporte 1 étoile à la maison.',
  },
  potager: {
    verb: 'Arroser le potager', need: 'Le potager a soif', done: 'a arrosé le potager', stars: 1, kind: 'arroser', who: 'le potager', plural: false,
    adopt: 'Planter le potager ?', act: 'Planter', warn: 'Il faudra l’arroser chaque jour, en famille : n’importe qui peut le faire, et ça rapporte 1 étoile à la maison.',
  },
}

/** Les croquettes : un stock commun au chat et aux oiseaux. */
export const FOOD = { meals: 10, cost: 15, max: 100 }
export const ANIMALS = ['compagnon', 'cabane']
/** Un animal oublié : triste (pas mangé hier), déprimé (deux jours), parti au 4e jour sans repas. */
export const GONE_AFTER = 4

export const STAR_REASONS: Record<string, string> = {
  moment: 'a partagé un instant',
  test: 'a reçu des étoiles pour tester la boutique',
  attention: 'a envoyé une attention',
  dessin: 'a envoyé un dessin',
  humeur: 'a partagé son humeur',
  defi: 'a relevé le défi de la semaine',
  question: 'a répondu à la question du jour',
  mission: 'a terminé une tâche',
  caresse: 'a caressé un animal',
  jeu: 'a joué avec le compagnon',
  partie: 'a gagné une partie',
  tour: 'a tenu bon à la tour',
  porte: 'a porté sans rien casser',
  accord: 'était d’accord avec toute la famille',
  trouve: 'a deviné un dessin',
  mot: 'a trouvé le mot mystère',
  album: 'a fini un téléphone dessiné',
  avent: 'a ouvert une case du calendrier de l’Avent',
  ...Object.fromEntries(['carotte', 'salade', 'tournesol', 'tomate', 'fraise', 'citrouille'].map((k) => [`recolte:${k}`, 'a fait une récolte au potager'])),
  ...Object.fromEntries(Object.entries(CARE).map(([k, c]) => [`soin:${k}`, c.done])),
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

// ───────── Le compagnon ─────────

/** Les huit compagnons, chacun avec son prénom (Elisa, 26 novembre : « le nom est déjà donné ») : on choisit Moka,
 *  Biscuit ou Glaçon, on ne baptise personne. */
export const SPECIES: { key: string; name: string; prenom: string }[] = [
  { key: 'chat', name: 'Chaton', prenom: 'Moka' },
  { key: 'chien', name: 'Chiot', prenom: 'Biscuit' },
  { key: 'lapin', name: 'Lapin', prenom: 'Flocon' },
  { key: 'renard', name: 'Renardeau', prenom: 'Paprika' },
  { key: 'panda', name: 'Panda', prenom: 'Mochi' },
  { key: 'koala', name: 'Koala', prenom: 'Kiwi' },
  { key: 'pingouin', name: 'Pingouin', prenom: 'Glaçon' },
  { key: 'hibou', name: 'Hibou', prenom: 'Plume' },
]
/** Le compagnon avec son prénom à lui (un compagnon adopté avant, baptisé autrement, le reprend aussi). */
export function avecSonPrenom<T extends { species: string; name: string }>(pet: T): T {
  const prenom = SPECIES.find((x) => x.key === pet.species)?.prenom
  return prenom && prenom !== pet.name ? { ...pet, name: prenom } : pet
}
/** Le caractère de chaque compagnon (Elisa, 21 novembre : « un cadre au début avec son caractère »). */
export type Caractere = { titre: string; adjectif: string; texte: string; traits: [string, string, string]; fond: string; encre: string }
export const CARACTERES: Record<string, Caractere> = {
  chat: { titre: 'Le curieux', adjectif: 'curieux', texte: 'Malin, joueur et toujours partant pour une aventure !', traits: ['Joueur', 'Curieux', 'Câlin'], fond: '#EFE7FF', encre: '#6B4FD8' },
  chien: { titre: 'Le fidèle', adjectif: 'fidèle', texte: 'Toujours joyeux, il adore la compagnie et veille sur la famille.', traits: ['Loyal', 'Énergique', 'Protecteur'], fond: '#FFF1D6', encre: '#B86A14' },
  lapin: { titre: 'Le doux', adjectif: 'doux', texte: 'Calme, tendre et très gourmand, il apporte de la douceur.', traits: ['Paisible', 'Affectueux', 'Gourmand'], fond: '#FFE6EE', encre: '#C2477A' },
  renard: { titre: 'Le malin', adjectif: 'malin', texte: 'Astucieux et débrouillard, il adore résoudre des petits défis !', traits: ['Intelligent', 'Aventurier', 'Créatif'], fond: '#FFE7D9', encre: '#C8571F' },
  panda: { titre: 'Le zen', adjectif: 'zen', texte: 'Calme et bienveillant, il apporte de la sérénité à la maison.', traits: ['Serein', 'Bienveillant', 'Positif'], fond: '#E6F4DF', encre: '#3F7F33' },
  koala: { titre: 'Le câlinou', adjectif: 'câlin', texte: 'Tout doux et tranquille, il adore les câlins et les moments calmes.', traits: ['Tranquille', 'Doux', 'Dormeur'], fond: '#E3EEFB', encre: '#3B67AD' },
  pingouin: { titre: 'Le téméraire', adjectif: 'téméraire', texte: 'Toujours partant pour explorer, il a un grand esprit d’équipe !', traits: ['Explorateur', 'Sociable', 'Patient'], fond: '#E0F0FA', encre: '#24759F' },
  hibou: { titre: 'Le sage', adjectif: 'sage', texte: 'Observateur et réfléchi, il adore apprendre de nouvelles choses !', traits: ['Intelligent', 'Curieux', 'Conseiller'], fond: '#EEE6FA', encre: '#7A4FC2' },
}
/** Des prénoms rigolos pour le bouton « Surprise ». */
export const PET_COST = 30
/** Il grandit avec l'amour : bébé, puis jeune (20 ♥), puis adulte (60 ♥). */
export const PET_STAGES = [
  { key: 'bebe', label: 'Bébé', min: 0, scale: 0.64 },
  { key: 'jeune', label: 'Jeune', min: 20, scale: 0.82 },
  { key: 'adulte', label: 'Adulte', min: 60, scale: 1 },
]
export const petStage = (love: number) => [...PET_STAGES].reverse().find((s) => love >= s.min) ?? PET_STAGES[0]
export const nextStage = (love: number) => PET_STAGES.find((s) => s.min > love) ?? null
export const LOVE = { feed: 2, pet: 1, treat: 3, play: 2 }

// ───────── Le potager ─────────

export type PlantInfo = { key: string; name: string; ripe: number; reward: number }
/** Combien d'arrosages avant la récolte, et ce qu'elle rapporte (les mêmes chiffres que la base). */
export const PLANTS: PlantInfo[] = [
  { key: 'carotte', name: 'Carottes', ripe: 4, reward: 8 },
  { key: 'salade', name: 'Salade', ripe: 4, reward: 8 },
  { key: 'tournesol', name: 'Tournesol', ripe: 5, reward: 10 },
  { key: 'tomate', name: 'Tomates', ripe: 6, reward: 13 },
  { key: 'fraise', name: 'Fraises', ripe: 7, reward: 17 },
  { key: 'citrouille', name: 'Citrouille', ripe: 9, reward: 22 },
]
export const plantOf = (k: string) => PLANTS.find((p) => p.key === k)
export type PlantStage = 'graine' | 'pousse' | 'jeune' | 'mur'
export function plantStage(plant: string, growth: number): PlantStage {
  const ripe = plantOf(plant)?.ripe ?? 5
  return growth <= 0 ? 'graine' : growth >= ripe ? 'mur' : growth < ripe / 2 ? 'pousse' : 'jeune'
}
export const plantArt = (plant: string, growth: number) => {
  const st = plantStage(plant, growth)
  return st === 'graine' ? 'plant-graine' : st === 'pousse' ? 'plant-pousse' : st === 'jeune' ? `${plant}-jeune` : plant
}
export const STAGE_LABEL: Record<PlantStage, string> = { graine: 'Graines semées', pousse: 'Petite pousse', jeune: 'Ça pousse', mur: 'Prêt à récolter' }

// ───────── Le centre commercial ─────────

const SEED_NAMES: Record<string, string> = {
  carotte: 'Graines de carottes', salade: 'Graines de salade', tournesol: 'Graines de tournesol',
  tomate: 'Graines de tomates', fraise: 'Plants de fraises', citrouille: 'Graines de citrouille',
}

export type Shop = 'superette' | 'animalerie' | 'boutique'
export type ShopItem = { key: string; name: string; cost: number; art: string; shop: Shop; group: string; qty?: number; text?: string }
/** Les mêmes prix que la base (private.shop_catalog). */
export const SHOP: ShopItem[] = [
  { key: 'friandises', name: 'Friandises', cost: 8, qty: 5, art: 'shop-friandises', shop: 'superette', group: 'Pour le compagnon', text: '5 friandises · +3 ♥ chacune' },
  { key: 'engrais', name: 'Engrais', cost: 6, qty: 1, art: 'shop-engrais', shop: 'superette', group: 'Pour le potager', text: 'Tout le potager pousse d’un cran' },
  ...PLANTS.map((p) => ({
    key: `graines:${p.key}`, name: SEED_NAMES[p.key],
    cost: [4, 4, 5, 6, 8, 10][PLANTS.indexOf(p)], qty: 1, art: p.key, shop: 'superette' as Shop, group: 'Pour le potager',
    text: `Prêt en ${p.ripe} arrosages · récolte +${p.reward} ★`,
  })),
  { key: 'lit:coussin', name: 'Coussin moelleux', cost: 15, art: 'lit-coussin', shop: 'animalerie', group: 'Son coin' },
  { key: 'lit:panier', name: 'Panier douillet', cost: 20, art: 'lit-panier', shop: 'animalerie', group: 'Son coin' },
  { key: 'lit:arbre', name: 'Arbre à grimper', cost: 35, art: 'lit-arbre', shop: 'animalerie', group: 'Son coin' },
  { key: 'lit:niche', name: 'Niche', cost: 40, art: 'lit-niche', shop: 'animalerie', group: 'Son coin' },
  { key: 'jeu:balle', name: 'Balle', cost: 10, art: 'jeu-balle', shop: 'animalerie', group: 'Jeux' },
  { key: 'jeu:pelote', name: 'Pelote de laine', cost: 10, art: 'jeu-pelote', shop: 'animalerie', group: 'Jeux' },
  { key: 'jeu:souris', name: 'Petite souris', cost: 10, art: 'jeu-souris', shop: 'animalerie', group: 'Jeux' },
  { key: 'jeu:os', name: 'Os à mâcher', cost: 12, art: 'jeu-os', shop: 'animalerie', group: 'Jeux' },
  { key: 'jeu:plumeau', name: 'Canne à plumes', cost: 12, art: 'jeu-plumeau', shop: 'animalerie', group: 'Jeux' },
  { key: 'habit:noeud', name: 'Nœud papillon', cost: 12, art: 'habit-noeud', shop: 'animalerie', group: 'Vêtements' },
  { key: 'habit:bandana', name: 'Bandana', cost: 12, art: 'habit-bandana', shop: 'animalerie', group: 'Vêtements' },
  { key: 'habit:bonnet', name: 'Bonnet à oreilles', cost: 15, art: 'habit-bonnet', shop: 'animalerie', group: 'Vêtements' },
  { key: 'habit:pull', name: 'Petit pull', cost: 20, art: 'habit-pull', shop: 'animalerie', group: 'Vêtements' },
  { key: 'gamelle:or', name: 'Gamelle dorée', cost: 25, art: 'shop-gamelle', shop: 'animalerie', group: 'Sa gamelle' },
  { key: 'mode:noeud', name: 'Barrette nœud', cost: 8, art: 'mode-noeud', shop: 'boutique', group: 'Accessoires' },
  { key: 'mode:bonnet', name: 'Bonnet à pompon', cost: 10, art: 'mode-bonnet', shop: 'boutique', group: 'Chapeaux' },
  { key: 'mode:casquette', name: 'Casquette', cost: 10, art: 'mode-casquette', shop: 'boutique', group: 'Chapeaux' },
  { key: 'mode:echarpe', name: 'Écharpe rayée', cost: 10, art: 'mode-echarpe', shop: 'boutique', group: 'Accessoires' },
  { key: 'mode:paille', name: 'Chapeau de paille', cost: 12, art: 'mode-paille', shop: 'boutique', group: 'Chapeaux' },
  { key: 'mode:lunettes', name: 'Lunettes de star', cost: 12, art: 'mode-lunettes', shop: 'boutique', group: 'Accessoires' },
  { key: 'mode:fleurs', name: 'Couronne de fleurs', cost: 15, art: 'mode-fleurs', shop: 'boutique', group: 'Chapeaux' },
  { key: 'mode:couronne', name: 'Couronne dorée', cost: 30, art: 'mode-couronne', shop: 'boutique', group: 'Chapeaux' },
  { key: 'mode:boucles', name: 'Boucles d’oreilles cœur', cost: 10, art: 'mode-boucles', shop: 'boutique', group: 'Accessoires' },
  { key: 'mode:montre', name: 'Montre dorée', cost: 20, art: 'mode-montre', shop: 'boutique', group: 'Accessoires' },
  { key: 'mode:colroule', name: 'Pull col roulé', cost: 20, art: 'mode-colroule', shop: 'boutique', group: 'Hauts' },
  { key: 'mode:torsade', name: 'Pull torsadé', cost: 20, art: 'mode-torsade', shop: 'boutique', group: 'Hauts' },
  { key: 'mode:chemise', name: 'Chemise rayée', cost: 18, art: 'mode-chemise', shop: 'boutique', group: 'Hauts' },
  { key: 'mode:gilet', name: 'Gilet à perles', cost: 18, art: 'mode-gilet', shop: 'boutique', group: 'Hauts' },
  { key: 'mode:mariniere', name: 'Marinière', cost: 16, art: 'mode-mariniere', shop: 'boutique', group: 'Hauts' },
  { key: 'mode:sweat', name: 'Sweat gris', cost: 14, art: 'mode-sweat', shop: 'boutique', group: 'Hauts' },
  { key: 'mode:manteau', name: 'Manteau à brandebourgs', cost: 25, art: 'mode-manteau', shop: 'boutique', group: 'Manteaux et vestes' },
  { key: 'mode:fourrure', name: 'Manteau fausse fourrure', cost: 30, art: 'mode-fourrure', shop: 'boutique', group: 'Manteaux et vestes' },
  { key: 'mode:trench', name: 'Trench ceinturé', cost: 28, art: 'mode-trench', shop: 'boutique', group: 'Manteaux et vestes' },
  { key: 'mode:blazer', name: 'Blazer oversize', cost: 24, art: 'mode-blazer', shop: 'boutique', group: 'Manteaux et vestes' },
  { key: 'mode:robe', name: 'Robe à bretelles', cost: 22, art: 'mode-robe', shop: 'boutique', group: 'Robes' },
  { key: 'mode:jupe', name: 'Jupe plissée', cost: 18, art: 'mode-jupe', shop: 'boutique', group: 'Bas' },
  { key: 'mode:short', name: 'Short en jean', cost: 16, art: 'mode-short', shop: 'boutique', group: 'Bas' },
  { key: 'mode:jean', name: 'Jean large', cost: 22, art: 'mode-jean', shop: 'boutique', group: 'Bas' },
  { key: 'mode:bottes', name: 'Bottes de pluie', cost: 14, art: 'mode-bottes', shop: 'boutique', group: 'Chaussures' },
  { key: 'mode:baskets', name: 'Baskets roses', cost: 12, art: 'mode-baskets', shop: 'boutique', group: 'Chaussures' },
]
export const shopItem = (k: string) => SHOP.find((i) => i.key === k)

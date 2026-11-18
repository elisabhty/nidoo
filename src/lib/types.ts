import type { GameKind, GameState } from './jeux'
import type { MotLigne, MotMoi, PartieKind, PartieState, Secret } from './parties'
import type { WeeklyState } from './weekly'

export type HouseType = 'maison' | 'appartement' | 'chalet'
export type ThoughtKind = 'coeur' | 'calin' | 'courage' | 'bisou' | 'mot'
export type ListKind = 'course' | 'tache'
export type EventKind = 'anniversaire' | 'rdv' | 'evenement'

export type Family = {
  id: string
  name: string
  house_type: HouseType
  invite_code: string
  plan: 'free' | 'plus'
  stars: number
  created_by: string
  /** Le code d'invitation ne marche plus après cette date. */
  invite_expires_at: string
  /** Repas de croquettes en stock, pour le chat et les oiseaux. */
  food: number
}

export type Member = {
  id: string
  family_id: string
  /** null : un enfant ou un bébé sans téléphone, ajouté par un proche */
  user_id: string | null
  managed_by?: string | null
  display_name: string
  avatar: string
  color: string
  mood: string | null
  mood_note: string | null
  mood_at: string | null
  joined_at: string
  /** Les responsables acceptent les nouveaux venus et gèrent le code d'invitation. */
  role: 'responsable' | 'membre'
}

/** Quelqu'un qui a tapé le code et attend qu'un responsable l'accepte (vu par les responsables). */
export type JoinRequest = {
  id: string
  family_id: string
  user_id: string
  display_name: string
  avatar: string
  color: string
  status: 'attente' | 'refusee'
  created_at: string
}
/** Mes propres demandes : la famille n'est pas encore lisible, on n'en connaît que le nom. */
export type MyRequest = { id: string; family_id: string; family_name: string; house_type: HouseType; status: 'attente' | 'refusee'; created_at: string }

export type Moment = {
  id: string
  family_id: string
  member_id: string
  image_path: string | null
  image_url?: string | null
  body: string | null
  challenge: string | null
  created_at: string
  /** un vocal : le fichier, sa durée (s) et son onde (0 à 100) */
  audio_path?: string | null
  audio_url?: string | null
  duree?: number | null
  ondes?: number[] | null
  /** un sticker envoyé seul (clé de src/lib/stickers.ts) */
  sticker?: string | null
}

/** Ce qu'un proche est en train de faire dans le fil (« écrit… », « enregistre un vocal… »). */
export type Ecrit = 'texte' | 'vocal' | 'photo' | 'sticker'

/** Un dossier racine a ses membres ; un sous-dossier (parent_id) hérite des membres de sa racine. */
export type Folder = {
  id: string
  family_id: string
  parent_id: string | null
  root_id: string
  owner_id: string | null
  name: string
  cover_path: string | null
  cover_url?: string | null
  created_at: string
  updated_at: string
}
export type FolderMember = { folder_id: string; member_id: string }
export type ItemKind = 'photo' | 'note' | 'message'
export type FolderItem = {
  id: string
  folder_id: string
  root_id: string
  family_id: string
  author_id: string | null
  kind: ItemKind
  title: string | null
  body: string | null
  image_path: string | null
  image_url?: string | null
  created_at: string
  updated_at: string
}
export type FolderCover = { blob: Blob } | { path: string } | null

export type Reaction = { moment_id: string; member_id: string; emoji: string }

/** Dessins : enregistrés trait par trait sur une feuille de 1000 × DRAW_H (forme d'un widget moyen). */
/** Dessiner à deux : une invitation reçue. */
export type LiveInvite = { session: string; from: string; to: string; at: number }
/** Ce qui passe entre les deux téléphones pendant qu'on dessine à deux. */
export type LiveEvent =
  /** je suis là (le premier arrivé renvoie alors toute la feuille) */
  | { t: 'hello'; who: string }
  | { t: 'bye'; who: string }
  /** des points d'un trait en cours (le premier envoi porte l'outil, la couleur et l'épaisseur) */
  | { t: 'pt'; who: string; id: string; s?: { o: DrawTool; c: string; w: number }; p: number[] }
  | { t: 'end'; who: string; id: string }
  | { t: 'undo'; who: string; id: string }
  /** les stickers, en entier */
  | { t: 'k'; who: string; k: Sticker[] }
  /** toute la feuille, pour celui qui arrive (ou après « tout effacer ») */
  | { t: 'state'; who: string; s: (Stroke & { id: string })[]; k: Sticker[]; bg: string; fr?: string; col?: string }
  | { t: 'fond'; who: string; bg: string; fr?: string }
  /** le dessin est envoyé : la séance est finie */
  | { t: 'fin'; who: string }
export interface LiveRoom {
  send(e: LiveEvent): void
  leave(): void
}

export type DrawTool = 'crayon' | 'feutre' | 'arcenciel' | 'paillettes' | 'coeurs' | 'remplir' | 'gomme'
export type Stroke = { o: DrawTool; c: string; w: number; p: number[] }
/** Un sticker collé : i = sa clé (« coeur », « mot:coucou »…), x/y = son centre, s = sa largeur (unités de la feuille), r = sa rotation en degrés */
export type Sticker = { i: string; x: number; y: number; s: number; r: number; /** mot écrit soi-même (i = « mot:perso ») */ t?: string; /** sa couleur */ c?: number }
/**
 * py : hauteur gardée de la photo de fond (0 : le haut, 1 : le bas) ; k : les stickers, collés par-dessus le dessin ;
 * fr : le cadre ; col : la page de coloriage (son trait passe par-dessus les couleurs)
 */
export type DrawingData = { v: 1; bg: string; s: Stroke[]; py?: number; k?: Sticker[]; fr?: string; col?: string }
export type Drawing = {
  id: string
  family_id: string
  from_member: string
  /** null : envoyé à toute la famille */
  to_member: string | null
  data: DrawingData
  /** photo de fond (photo seule ou photo dessinée) */
  photo_path?: string | null
  photo_url?: string | null
  created_at: string
}

export type Thought = {
  id: string
  family_id: string
  from_member: string
  to_member: string
  kind: ThoughtKind
  message: string | null
  created_at: string
  seen_at: string | null
}

export type FamEvent = {
  id: string
  family_id: string
  title: string
  kind: EventKind
  starts_at: string
  all_day: boolean
  yearly: boolean
  created_by: string | null
  /** Où ça se passe (l'adresse, « chez Mamie »…) */
  lieu?: string | null
  /** Ce qu'il faut savoir : l'adresse, qui apporte quoi… */
  description?: string | null
  /** Les proches concernés (vide : toute la famille). */
  members?: string[]
}

export type ListItem = {
  id: string
  family_id: string
  kind: ListKind
  title: string
  done: boolean
  done_by: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
}

export type Answer = { id: string; member_id: string; day: string; question_key: string; answer: string; photo_path?: string | null; photo_url?: string | null }
/** On a nourri le chat, arrosé les fleurs… (une fois par jour pour toute la famille). */
export type HouseCare = { item_key: string; day: string; member_id: string | null; created_at: string }
/** Le compagnon de la famille : il grandit avec l'amour qu'on lui donne. */
export type Pet = { species: string; name: string; love: number; outfit: string | null; bed: string | null; adopted_at: string }
/** Une parcelle du potager : ce qui y pousse, et combien de fois elle a été arrosée. */
export type Plot = { plot: number; plant: string; growth: number; planted_at: string }
/** Une partie entre deux proches (p1 a invité et joue le premier). */
export type Game = {
  id: string
  family_id: string
  kind: GameKind
  p1: string
  p2: string
  /** À qui de jouer (null : partie finie). */
  turn: string | null
  status: 'en_cours' | 'fini'
  /** Le gagnant ; null si égalité (ou partie en cours). */
  winner: string | null
  state: GameState
  created_at: string
  updated_at: string
  /** Memory : les liens des photos, dans l'ordre de state.paths. */
  photos?: (string | null)[]
}
/** Un jeu à plusieurs (players[0] l'a lancé). */
export type Partie = {
  id: string
  family_id: string
  kind: PartieKind
  players: string[]
  turn: string | null
  status: 'en_cours' | 'fini'
  winner: string | null
  state: PartieState
  created_at: string
  updated_at: string
  /** Devine l'année : les photos, lisibles par la famille. */
  photos?: (string | null)[]
}
export type StarEntry = { id: string | number; member_id: string | null; reason: string; amount: number; created_at: string }

export type FamilyState = {
  family: Family
  me: Member
  members: Member[]
  /** Demandes d'entrée en attente (vides si je ne suis pas responsable). */
  requests: JoinRequest[]
  moments: Moment[]
  folders: Folder[]
  folderMembers: FolderMember[]
  folderItems: FolderItem[]
  reactions: Reaction[]
  thoughts: Thought[]
  drawings: Drawing[]
  events: FamEvent[]
  items: ListItem[]
  answers: Answer[]
  houseItems: string[]
  /** Les soins du jardin des derniers jours. */
  cares: HouseCare[]
  /** Date d'arrivée de chaque décoration (pour savoir depuis quand un animal n'a pas mangé). */
  houseSince: Record<string, string>
  pet: Pet | null
  plots: Plot[]
  /** Le placard : friandises, graines, engrais (combien il en reste). */
  stock: Record<string, number>
  /** Ce que la famille a acheté et garde (coins, jeux, vêtements, accessoires). */
  owned: string[]
  starLog: StarEntry[]
  /** Défi de la semaine : progression de toute la famille, et récompense déjà reçue. */
  weekly: WeeklyState
  /** Les parties en cours, et celles finies depuis moins d'une semaine. */
  games: Game[]
  /** Les jeux à plusieurs (bataille navale, Qui de nous ?, dessine et devine, devine l'année, téléphone dessiné). */
  parties: Partie[]
  /** Le mot mystère du jour : les couleurs des essais de chacun (jamais les lettres). */
  mot: MotLigne[]
  /** Les interrupteurs à distance (table app_flags), par clé. */
  flags: Record<string, AppFlag>
  /** Calendrier de l'Avent : les cases déjà ouvertes par la maison. */
  advent: AdventDoor[]
}

/** Un interrupteur à distance : allumé, et éventuellement borné dans le temps. */
export type AppFlag = { enabled: boolean; starts_at: string | null; ends_at: string | null }
export type AdventDoor = { year: number; day: number; opened_by: string | null; opened_at: string }

export type Circle = { family: Family; me: Member }

export type NewEvent = { title: string; kind: EventKind; starts_at: string; all_day: boolean; yearly: boolean; lieu?: string | null; description?: string | null; members?: string[] }

export interface Backend {
  mode: 'supabase' | 'local'
  start(): Promise<string>
  circles(): Promise<Circle[]>
  createFamily(i: { name: string; houseType: HouseType; displayName: string; avatar: string; color: string }): Promise<string>
  previewFamily(code: string): Promise<{ name: string; house_type: HouseType; member_count: number } | null>
  /** Envoie une demande d'entrée (ou renvoie la famille si on en fait déjà partie). */
  joinFamily(i: { code: string; displayName: string; avatar: string; color: string }): Promise<string>
  myRequests(): Promise<MyRequest[]>
  cancelRequest(id: string): Promise<void>
  answerRequest(id: string, accept: boolean): Promise<void>
  renewInvite(familyId: string): Promise<void>
  setRole(memberId: string, role: Member['role']): Promise<void>
  removeMember(memberId: string): Promise<void>
  /** Ajoute un enfant ou un bébé sans téléphone. */
  addChild(familyId: string, i: { displayName: string; avatar: string; color: string }): Promise<void>
  load(familyId: string): Promise<FamilyState>
  subscribe(familyId: string, onChange: () => void): () => void
  setMood(memberId: string, mood: string | null, note: string | null): Promise<void>
  updateMember(memberId: string, patch: Partial<Pick<Member, 'display_name' | 'avatar' | 'color'>>): Promise<void>
  updateFamily(familyId: string, patch: Partial<Pick<Family, 'name' | 'house_type'>>): Promise<void>
  leave(memberId: string): Promise<void>
  postMoment(familyId: string, memberId: string, m: { blob?: Blob; body?: string; challenge?: string; audio?: { blob: Blob; duree: number; ondes: number[] }; sticker?: string }): Promise<void>
  /** Dire à la famille qu'on écrit (ou qu'on a arrêté : null), en direct, sans rien enregistrer. */
  ecrit(familyId: string, memberId: string, quoi: Ecrit | null): void
  onEcrit(familyId: string, me: string, cb: (e: { m: string; quoi: Ecrit | null }) => void): () => void
  deleteMoment(moment: Moment): Promise<void>
  // Dossiers
  createFolder(familyId: string, f: { name: string; parentId?: string | null; memberIds?: string[] }): Promise<string>
  renameFolder(id: string, name: string): Promise<void>
  setFolderCover(folder: Folder, cover: FolderCover): Promise<void>
  setFolderMembers(rootId: string, memberIds: string[]): Promise<void>
  leaveFolder(rootId: string, memberId: string): Promise<void>
  deleteFolder(folder: Folder): Promise<void>
  addFolderItem(folder: Folder, memberId: string, i: { kind: ItemKind; title?: string; body?: string; blob?: Blob }): Promise<void>
  updateFolderItem(id: string, patch: { title: string | null; body: string | null }): Promise<void>
  deleteFolderItem(item: FolderItem): Promise<void>
  react(moment: Moment, memberId: string, emoji: string | null): Promise<void>
  sendThought(familyId: string, from: string, to: string, kind: ThoughtKind, message?: string): Promise<void>
  markSeen(ids: string[]): Promise<void>
  /** to = null : pour toute la famille */
  sendDrawing(familyId: string, from: string, to: string | null, data: DrawingData, photo?: Blob | null): Promise<void>
  deleteDrawing(id: string): Promise<void>
  addEvent(familyId: string, memberId: string, e: NewEvent): Promise<void>
  updateEvent(id: string, patch: { lieu?: string | null; description?: string | null; members?: string[] }): Promise<void>
  deleteEvent(id: string): Promise<void>
  addItem(familyId: string, memberId: string, kind: ListKind, title: string, assignedTo?: string | null): Promise<void>
  toggleItem(item: ListItem, memberId: string): Promise<void>
  deleteItem(id: string): Promise<void>
  answer(familyId: string, memberId: string, questionKey: string, answer: string, photo?: Blob | null): Promise<void>
  /** Nourrit un animal ou arrose une plante du jardin ; renvoie les étoiles gagnées. */
  care(familyId: string, key: string): Promise<number>
  /** Un sac de croquettes : 10 repas pour 15 étoiles. Renvoie le stock. */
  buyFood(familyId: string): Promise<number>
  /** Caresser un animal : 1 étoile la première fois de la journée, pour chacun. */
  pet(familyId: string, key: string): Promise<number>
  /** Le centre commercial : un objet qu'on garde, ou un lot pour le placard. */
  buyItem(familyId: string, key: string): Promise<void>
  adoptPet(familyId: string, species: string, name: string): Promise<void>
  dressPet(familyId: string, patch: { outfit: string | null; bed: string | null; name: string }): Promise<void>
  /** Une friandise : renvoie son amour. */
  giveTreat(familyId: string): Promise<number>
  /** Jouer : 1 étoile (et de l'amour) la première fois de la journée, pour chacun. */
  playPet(familyId: string, toy: string): Promise<number>
  plant(familyId: string, plot: number, plant: string): Promise<void>
  fertilize(familyId: string): Promise<void>
  /** Récolter une parcelle mûre : renvoie les étoiles gagnées. */
  harvest(familyId: string, plot: number): Promise<number>
  /** Ouvre une case du calendrier de l'Avent (pour toute la maison). */
  openAdvent(familyId: string, day: number): Promise<void>
  unlock(familyId: string, key: string): Promise<void>
  /** Réclame la récompense du défi de la semaine ; renvoie la décoration offerte (ou « etoiles »). */
  claimWeekly(familyId: string): Promise<string>
  /** Rattache une adresse e-mail au compte pour le retrouver sur un autre téléphone. */
  linkEmail(email: string): Promise<void>
  accountEmail(): Promise<string | null>
  /** Dessiner à deux : inviter un proche sur une feuille partagée (renvoie le numéro de la séance). */
  inviteLive(familyId: string, from: string, to: string): Promise<string>
  /** Être prévenu quand un proche nous invite à dessiner à deux. */
  onLiveInvite(familyId: string, me: string, cb: (inv: LiveInvite) => void): () => void
  /** Rejoindre la feuille partagée : on y envoie et on y reçoit les traits en direct. */
  joinLive(familyId: string, session: string, me: string, on: (e: LiveEvent) => void): LiveRoom
  /** Jouer ensemble : lancer une partie contre un proche (au memory, de 4 à 8 photos) ; renvoie la partie. */
  startGame(familyId: string, opponent: string, kind: GameKind, photos?: Blob[]): Promise<string>
  /** Un coup : la colonne (Puissance 4), la case (morpion) ou la carte à retourner (memory). */
  playGame(game: Game, move: number): Promise<void>
  /** Abandonner la partie : l'autre gagne. */
  quitGame(gameId: string): Promise<void>
  /** Lancer un jeu à plusieurs ; setup : les questions de Qui de nous ?, les années de devine l'année. */
  startPartie(familyId: string, kind: PartieKind, players: string[], setup?: Record<string, unknown>, photos?: Blob[]): Promise<string>
  /** Jouer : un tir, un vote, un dessin, une réponse… */
  actPartie(partie: Partie, action: Record<string, unknown>): Promise<Record<string, unknown>>
  /** Ce que je suis seul à voir dans une partie. */
  secretPartie(partie: Partie): Promise<Secret>
  quitPartie(partieId: string): Promise<void>
  motEssai(familyId: string, mot: string): Promise<{ motif: string; trouve: boolean; solution: string | null }>
  motMesEssais(familyId: string): Promise<MotMoi>
  /** Mode démo uniquement : installe toutes les décorations, ou revient à la maison de départ. */
  demoDecos?(familyId: string, all: boolean): Promise<void>
}

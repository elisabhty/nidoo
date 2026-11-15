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
}

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
export type DrawTool = 'crayon' | 'feutre' | 'gomme'
export type Stroke = { o: DrawTool; c: string; w: number; p: number[] }
export type DrawingData = { v: 1; bg: string; s: Stroke[] }
export type Drawing = {
  id: string
  family_id: string
  from_member: string
  /** null : envoyé à toute la famille */
  to_member: string | null
  data: DrawingData
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

export type Answer = { id: string; member_id: string; day: string; question_key: string; answer: string }
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
  starLog: StarEntry[]
  /** Défi de la semaine : progression de toute la famille, et récompense déjà reçue. */
  weekly: WeeklyState
}

export type Circle = { family: Family; me: Member }

export type NewEvent = { title: string; kind: EventKind; starts_at: string; all_day: boolean; yearly: boolean }

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
  postMoment(familyId: string, memberId: string, m: { blob?: Blob; body?: string; challenge?: string }): Promise<void>
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
  sendDrawing(familyId: string, from: string, to: string | null, data: DrawingData): Promise<void>
  deleteDrawing(id: string): Promise<void>
  addEvent(familyId: string, memberId: string, e: NewEvent): Promise<void>
  deleteEvent(id: string): Promise<void>
  addItem(familyId: string, memberId: string, kind: ListKind, title: string, assignedTo?: string | null): Promise<void>
  toggleItem(item: ListItem, memberId: string): Promise<void>
  deleteItem(id: string): Promise<void>
  answer(familyId: string, memberId: string, questionKey: string, answer: string): Promise<void>
  unlock(familyId: string, key: string): Promise<void>
  /** Réclame la récompense du défi de la semaine ; renvoie la décoration offerte (ou « etoiles »). */
  claimWeekly(familyId: string): Promise<string>
  /** Rattache une adresse e-mail au compte pour le retrouver sur un autre téléphone. */
  linkEmail(email: string): Promise<void>
  accountEmail(): Promise<string | null>
  /** Mode démo uniquement : installe toutes les décorations, ou revient à la maison de départ. */
  demoDecos?(familyId: string, all: boolean): Promise<void>
}

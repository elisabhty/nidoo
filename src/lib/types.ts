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
}

export type Member = {
  id: string
  family_id: string
  user_id: string
  display_name: string
  avatar: string
  color: string
  mood: string | null
  mood_note: string | null
  mood_at: string | null
  joined_at: string
}

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

export type Reaction = { moment_id: string; member_id: string; emoji: string }

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
  moments: Moment[]
  reactions: Reaction[]
  thoughts: Thought[]
  events: FamEvent[]
  items: ListItem[]
  answers: Answer[]
  houseItems: string[]
  starLog: StarEntry[]
}

export type Circle = { family: Family; me: Member }

export type NewEvent = { title: string; kind: EventKind; starts_at: string; all_day: boolean; yearly: boolean }

export interface Backend {
  mode: 'supabase' | 'local'
  start(): Promise<string>
  circles(): Promise<Circle[]>
  createFamily(i: { name: string; houseType: HouseType; displayName: string; avatar: string; color: string }): Promise<string>
  previewFamily(code: string): Promise<{ name: string; house_type: HouseType; member_count: number } | null>
  joinFamily(i: { code: string; displayName: string; avatar: string; color: string }): Promise<string>
  load(familyId: string): Promise<FamilyState>
  subscribe(familyId: string, onChange: () => void): () => void
  setMood(memberId: string, mood: string | null, note: string | null): Promise<void>
  updateMember(memberId: string, patch: Partial<Pick<Member, 'display_name' | 'avatar' | 'color'>>): Promise<void>
  updateFamily(familyId: string, patch: Partial<Pick<Family, 'name' | 'house_type'>>): Promise<void>
  leave(memberId: string): Promise<void>
  postMoment(familyId: string, memberId: string, m: { blob?: Blob; body?: string; challenge?: string }): Promise<void>
  deleteMoment(moment: Moment): Promise<void>
  react(moment: Moment, memberId: string, emoji: string | null): Promise<void>
  sendThought(familyId: string, from: string, to: string, kind: ThoughtKind, message?: string): Promise<void>
  markSeen(ids: string[]): Promise<void>
  addEvent(familyId: string, memberId: string, e: NewEvent): Promise<void>
  deleteEvent(id: string): Promise<void>
  addItem(familyId: string, memberId: string, kind: ListKind, title: string, assignedTo?: string | null): Promise<void>
  toggleItem(item: ListItem, memberId: string): Promise<void>
  deleteItem(id: string): Promise<void>
  answer(familyId: string, memberId: string, questionKey: string, answer: string): Promise<void>
  unlock(familyId: string, key: string): Promise<void>
  /** Rattache une adresse e-mail au compte pour le retrouver sur un autre téléphone. */
  linkEmail(email: string): Promise<void>
  accountEmail(): Promise<string | null>
}

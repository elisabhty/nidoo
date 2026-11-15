import { DECOS, PLAN_LIMITS, THOUGHTS } from './data'
import type { Backend, Family, FamilyState, Folder, FolderItem, Member, Moment, ThoughtKind } from './types'
import { blobToDataUrl, compressImage, todayKey, uid } from './util'

// Mode démo : toute la maison vit sur l'appareil, avec trois proches fictifs
// qui répondent aux attentions. Même contrat que le backend Supabase.

type Raw = Omit<FamilyState, 'me'> & { dossiersDemo?: boolean }
type Db = { userId: string; families: Record<string, Raw> }
const KEY = 'nidoo.demo.v2'


const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString()
const inDays = (days: number, h = 9, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

type OldFolder = { id: string; family_id: string; owner_id: string; name: string; is_private: boolean; created_at: string }

// Dossiers d'exemple : chacun a ses membres, et un dossier dont Mamie est exclue (la surprise).
function demoDossiers(f: Raw) {
  const by = (name: string) => f.members.find((m) => m.display_name === name)?.id
  const moi = f.members.find((m) => !['Mamie Jo', 'Papa', 'Léa'].includes(m.display_name))?.id ?? f.members[0].id
  const mamie = by('Mamie Jo'), papa = by('Papa'), lea = by('Léa')
  const fid = f.family.id
  const folder = (name: string, owner: string | undefined, minsAgo: number, parent?: Folder): Folder => {
    const id = uid()
    const d: Folder = { id, family_id: fid, parent_id: parent?.id ?? null, root_id: parent?.root_id ?? id, owner_id: owner ?? moi, name, cover_path: null, created_at: iso(minsAgo), updated_at: iso(minsAgo) }
    f.folders.push(d)
    return d
  }
  const members = (d: Folder, ids: (string | undefined)[]) => {
    for (const id of new Set(ids.filter((x): x is string => !!x))) f.folderMembers.push({ folder_id: d.id, member_id: id })
  }
  const item = (d: Folder, author: string | undefined, kind: FolderItem['kind'], body: string, minsAgo: number, title: string | null = null) => {
    if (!author) return
    f.folderItems.push({ id: uid(), folder_id: d.id, root_id: d.root_id, family_id: fid, author_id: author, kind, title, body, image_path: null, created_at: iso(minsAgo), updated_at: iso(minsAgo) })
  }

  const recettes = folder('Recettes de Mamie', mamie, 60 * 72)
  members(recettes, [moi, mamie, papa, lea])
  item(recettes, mamie, 'note', '250 g de farine\n3 œufs\n50 cl de lait\nUne pincée de sel\n\nLaisser reposer une heure avant de cuire.', 60 * 70, 'Pâte à crêpes')
  item(recettes, mamie, 'note', '1 kg de pommes de terre\n50 cl de crème\nUne gousse d’ail\n\n1 h au four à 160 °C.', 60 * 69, 'Gratin dauphinois')
  item(recettes, mamie, 'message', 'J’ai rangé mes recettes ici, servez-vous !', 60 * 68)
  item(recettes, lea, 'message', 'Je teste les crêpes ce week-end', 60 * 30)
  const desserts = folder('Desserts', mamie, 60 * 67, recettes)
  item(desserts, mamie, 'note', '6 pommes\nUne pâte brisée\n50 g de sucre\n\n35 min à 180 °C.', 60 * 66, 'Tarte aux pommes')

  if (mamie) {
    const surprise = folder('Surprise pour Mamie', papa, 60 * 26)
    members(surprise, [moi, papa, lea])
    item(surprise, papa, 'message', 'On organise quelque chose pour ses 80 ans ? Elle ne voit pas ce dossier.', 60 * 26)
    item(surprise, lea, 'message', 'Oui ! Je m’occupe du gâteau.', 60 * 25)
    item(surprise, papa, 'note', 'Un album photo de famille\nUn week-end à la mer\nUn dîner chez Lucien', 60 * 24, 'Idées de cadeaux')
    folder('Invitations', lea, 60 * 20, surprise)
  }

  const vacances = folder('Vacances en Bretagne', moi, 60 * 5)
  members(vacances, [moi, lea])
  item(vacances, lea, 'message', 'Juste toi et moi pour organiser, je te laisse choisir les dates', 60 * 4)
  item(vacances, lea, 'note', 'Maillots\nCrème solaire\nCirés\nJeux de cartes', 60 * 3, 'À emporter')
  f.dossiersDemo = true
}

// Mise à niveau des maisons créées avec l'ancienne version des dossiers.
function migrate(f: Raw) {
  f.folderMembers ??= []
  f.folderItems ??= []
  f.folders = ((f.folders ?? []) as (Folder | OldFolder)[]).map((d) => {
    if (!('is_private' in d)) return d
    for (const id of d.is_private ? [d.owner_id] : f.members.map((m) => m.id)) f.folderMembers.push({ folder_id: d.id, member_id: id })
    return { id: d.id, family_id: d.family_id, parent_id: null, root_id: d.id, owner_id: d.owner_id, name: d.name, cover_path: null, created_at: d.created_at, updated_at: d.created_at }
  })
  // Les moments rangés dans un ancien dossier deviennent son contenu.
  const keep: Moment[] = []
  for (const m of f.moments as (Moment & { folder_id?: string | null })[]) {
    const d = m.folder_id ? f.folders.find((x) => x.id === m.folder_id) : undefined
    if (d) {
      f.folderItems.push({
        id: m.id, folder_id: d.id, root_id: d.root_id, family_id: d.family_id, author_id: m.member_id,
        kind: m.image_path ? 'photo' : 'note', title: null, body: m.body, image_path: m.image_path, created_at: m.created_at, updated_at: m.created_at,
      })
    } else {
      delete m.folder_id
      keep.push(m)
    }
  }
  f.moments = keep
  if (!f.dossiersDemo) demoDossiers(f)
}

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as Db
      for (const f of Object.values(db.families)) migrate(f)
      return db
    }
  } catch {
    /* stockage indisponible : on repart d'une maison vide */
  }
  return { userId: uid(), families: {} }
}

export function createLocalBackend(): Backend {
  let db = read()
  const listeners = new Set<() => void>()
  const save = (): boolean => {
    let ok = true
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      // Stockage plein : on allège en retirant les plus anciennes photos du fil.
      for (const f of Object.values(db.families)) f.moments = f.moments.slice(0, 6)
      try {
        localStorage.setItem(KEY, JSON.stringify(db))
      } catch {
        ok = false // l'état reste en mémoire
      }
    }
    listeners.forEach((l) => l())
    return ok
  }
  const photo = async (blob: Blob) => blobToDataUrl(await compressImage(blob, 1024, 0.72))
  const folderById = (id: string) => {
    for (const f of Object.values(db.families)) {
      const d = f.folders.find((x) => x.id === id)
      if (d) return { f, d }
    }
    throw new Error('DOSSIER_INCONNU')
  }
  const myId = (f: Raw) => f.members.find((m) => m.user_id === db.userId)!.id
  const subtree = (f: Raw, id: string) => {
    const ids = new Set([id])
    for (let grew = true; grew; ) {
      grew = false
      for (const d of f.folders) if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) ids.add(d.id), (grew = true)
    }
    return ids
  }
  // Un proche du dossier répond à un message, pour que la démo vive.
  const replies = ['Trop bien !', 'Merci de l’avoir mis ici', 'Je regarde ça ce soir', 'Super idée', 'Ça me va !']
  const answerIn = (f: Raw, d: Folder) => {
    const me = myId(f)
    const others = f.folderMembers.filter((x) => x.folder_id === d.root_id && x.member_id !== me).map((x) => x.member_id)
    const recent = f.folderItems.some((i) => i.root_id === d.root_id && i.kind === 'message' && i.author_id !== me && Date.now() - new Date(i.created_at).getTime() < 120000)
    if (!others.length || recent) return
    window.setTimeout(() => {
      if (!f.folders.some((x) => x.id === d.id)) return
      const now = new Date().toISOString()
      f.folderItems.push({
        id: uid(), folder_id: d.id, root_id: d.root_id, family_id: d.family_id, author_id: others[Math.floor(Math.random() * others.length)],
        kind: 'message', title: null, body: replies[Math.floor(Math.random() * replies.length)], image_path: null, created_at: now, updated_at: now,
      })
      save()
    }, 3500)
  }
  const fam = (id: string) => {
    const f = db.families[id]
    if (!f) throw new Error('PAS_MEMBRE')
    return f
  }
  const famOfMember = (memberId: string) => {
    const f = Object.values(db.families).find((x) => x.members.some((m) => m.id === memberId))
    if (!f) throw new Error('PAS_MEMBRE')
    return f
  }
  const award = (f: Raw, memberId: string, reason: string, amount: number, cap?: number) => {
    if (cap != null) {
      const n = f.starLog.filter((s) => s.member_id === memberId && s.reason === reason && todayKey(new Date(s.created_at)) === todayKey()).length
      if (n >= cap) return
    }
    f.starLog.unshift({ id: uid(), member_id: memberId, reason, amount, created_at: new Date().toISOString() })
    f.family.stars += amount
  }

  function seed(name: string, houseType: Family['house_type'], me: { displayName: string; avatar: string; color: string }): string {
    const fid = uid()
    const mk = (display_name: string, avatar: string, color: string, mood: string | null, note: string | null, user = uid()): Member => ({
      id: uid(), family_id: fid, user_id: user, display_name, avatar, color, mood, mood_note: note,
      mood_at: mood ? iso(90) : null, joined_at: new Date().toISOString(),
    })
    const moi = mk(me.displayName, me.avatar, me.color, null, null, db.userId)
    const mamie = mk('Mamie Jo', 'hibou', 'peche', 'nostalgique', 'Je trie de vieilles photos', )
    const papa = mk('Papa', 'ours', 'mousse', 'fatigue', 'Grosse semaine')
    const lea = mk('Léa', 'renard', 'rose', 'heureux', 'Partiels terminés !')
    db.families[fid] = {
      family: { id: fid, name, house_type: houseType, invite_code: 'DEMO42', plan: 'free', stars: 14, created_by: db.userId },
      members: [moi, mamie, papa, lea],
      moments: [
        { id: uid(), family_id: fid, member_id: lea.id, image_path: null, body: 'Devinez qui rentre ce week-end avec un gâteau ?', challenge: null, created_at: iso(55) },
        { id: uid(), family_id: fid, member_id: mamie.id, image_path: null, body: 'Le jardin est tout blanc ce matin. Pensées pour vous tous.', challenge: null, created_at: iso(60 * 20) },
      ],
      folders: [],
      folderMembers: [],
      folderItems: [],
      reactions: [],
      thoughts: [
        { id: uid(), family_id: fid, from_member: mamie.id, to_member: moi.id, kind: 'coeur', message: null, created_at: iso(3), seen_at: null },
      ],
      events: [
        { id: uid(), family_id: fid, title: 'Anniversaire de Mamie Jo', kind: 'anniversaire', starts_at: inDays(4), all_day: true, yearly: true, created_by: papa.id },
        { id: uid(), family_id: fid, title: 'Dîner tous ensemble', kind: 'evenement', starts_at: inDays(1, 19, 30), all_day: false, yearly: false, created_by: lea.id },
        { id: uid(), family_id: fid, title: 'Dentiste de Léa', kind: 'rdv', starts_at: inDays(2, 14, 0), all_day: false, yearly: false, created_by: lea.id },
      ],
      items: [
        { id: uid(), family_id: fid, kind: 'course', title: 'Farine et œufs', done: false, done_by: null, assigned_to: null, created_by: papa.id, created_at: iso(200) },
        { id: uid(), family_id: fid, kind: 'course', title: 'Bougies d’anniversaire', done: false, done_by: null, assigned_to: null, created_by: lea.id, created_at: iso(180) },
        { id: uid(), family_id: fid, kind: 'tache', title: 'Appeler Mamie Jo', done: false, done_by: null, assigned_to: moi.id, created_by: papa.id, created_at: iso(170) },
        { id: uid(), family_id: fid, kind: 'tache', title: 'Réserver le restaurant', done: true, done_by: papa.id, assigned_to: papa.id, created_by: papa.id, created_at: iso(400) },
      ],
      answers: [],
      houseItems: ['fleurs'],
      starLog: [
        { id: uid(), member_id: lea.id, reason: 'moment', amount: 3, created_at: iso(55) },
        { id: uid(), member_id: mamie.id, reason: 'attention', amount: 1, created_at: iso(3) },
      ],
    }
    demoDossiers(db.families[fid])
    return fid
  }

  // Un proche fictif répond quelques secondes plus tard, pour voir l'animation de réception.
  function echo(f: Raw, from: Member, to: Member) {
    if (to.user_id === db.userId) return
    // Pas de ping-pong sans fin : il ne répond pas à une réponse.
    if (f.thoughts.some((t) => t.from_member === to.id && Date.now() - new Date(t.created_at).getTime() < 600000)) return
    window.setTimeout(() => {
      const kinds: ThoughtKind[] = THOUGHTS.map((t) => t.key)
      f.thoughts.unshift({
        id: uid(), family_id: f.family.id, from_member: to.id, to_member: from.id,
        kind: kinds[Math.floor(Math.random() * kinds.length)], message: null,
        created_at: new Date().toISOString(), seen_at: null,
      })
      save()
    }, 4500)
  }

  return {
    mode: 'local',
    async start() {
      return db.userId
    },
    async circles() {
      return Object.values(db.families).map((f) => ({ family: f.family, me: f.members.find((m) => m.user_id === db.userId)! }))
    },
    async createFamily(i) {
      if (Object.values(db.families).some((f) => f.family.created_by === db.userId && f.family.plan === 'free')) throw new Error('LIMITE_MAISONS')
      const id = seed(i.name, i.houseType, i)
      save()
      return id
    },
    async previewFamily(code) {
      return code.trim().toUpperCase() === 'DEMO42' ? { name: 'des Tilleuls', house_type: 'chalet', member_count: 3 } : null
    },
    async joinFamily(i) {
      if (i.code.trim().toUpperCase() !== 'DEMO42') throw new Error('CODE_INCONNU')
      const existing = Object.values(db.families)[0]
      if (existing && existing.members.length >= PLAN_LIMITS[existing.family.plan]) throw new Error('FAMILLE_PLEINE')
      const id = seed('des Tilleuls', 'chalet', i)
      save()
      return id
    },
    async load(fid) {
      const f = fam(fid)
      const me = f.members.find((m) => m.user_id === db.userId)
      if (!me) throw new Error('PAS_MEMBRE')
      const day = todayKey()
      const mine = new Set(f.folderMembers.filter((x) => x.member_id === me.id).map((x) => x.folder_id))
      return structuredClone({
        ...f,
        me,
        answers: f.answers.filter((a) => a.day === day),
        moments: f.moments.map((m) => ({ ...m, image_url: m.image_path })),
        folders: f.folders.filter((d) => mine.has(d.root_id)).map((d) => ({ ...d, cover_url: d.cover_path })),
        folderMembers: f.folderMembers.filter((x) => mine.has(x.folder_id)),
        folderItems: f.folderItems.filter((i) => mine.has(i.root_id)).map((i) => ({ ...i, image_url: i.image_path })),
        dossiersDemo: undefined,
      })
    },
    subscribe(_fid, onChange) {
      listeners.add(onChange)
      return () => void listeners.delete(onChange)
    },
    async setMood(memberId, mood, note) {
      const f = famOfMember(memberId)
      const m = f.members.find((x) => x.id === memberId)!
      m.mood = mood
      m.mood_note = note
      m.mood_at = new Date().toISOString()
      if (mood) award(f, memberId, 'humeur', 1, 1)
      save()
    },
    async updateMember(memberId, patch) {
      Object.assign(famOfMember(memberId).members.find((x) => x.id === memberId)!, patch)
      save()
    },
    async updateFamily(familyId, patch) {
      Object.assign(fam(familyId).family, patch)
      save()
    },
    async leave(memberId) {
      delete db.families[famOfMember(memberId).family.id]
      save()
    },
    async postMoment(fid, memberId, m) {
      const f = fam(fid)
      const moment: Moment = {
        id: uid(), family_id: fid, member_id: memberId, image_path: m.blob ? await blobToDataUrl(m.blob) : null,
        body: m.body?.trim() || null, challenge: m.challenge ?? null, created_at: new Date().toISOString(),
      }
      f.moments.unshift(moment)
      award(f, memberId, 'moment', 3, 5)
      // Un proche réagit à la photo, comme dans une vraie famille.
      const other = f.members.find((x) => x.user_id !== db.userId)
      if (other) {
        window.setTimeout(() => {
          f.reactions.push({ moment_id: moment.id, member_id: other.id, emoji: 'amour' })
          save()
        }, 3500)
      }
      save()
    },
    async deleteMoment(moment) {
      const f = fam(moment.family_id)
      f.moments = f.moments.filter((m) => m.id !== moment.id)
      f.reactions = f.reactions.filter((r) => r.moment_id !== moment.id)
      save()
    },
    async createFolder(fid, x) {
      const f = fam(fid)
      const me = myId(f)
      const parent = x.parentId ? f.folders.find((d) => d.id === x.parentId) : undefined
      if (x.parentId && !parent) throw new Error('DOSSIER_INCONNU')
      const id = uid()
      const now = new Date().toISOString()
      f.folders.push({ id, family_id: fid, parent_id: parent?.id ?? null, root_id: parent?.root_id ?? id, owner_id: me, name: x.name.trim(), cover_path: null, created_at: now, updated_at: now })
      if (!parent) {
        const ids = new Set([me, ...(x.memberIds ?? []).filter((m) => f.members.some((y) => y.id === m))])
        for (const m of ids) f.folderMembers.push({ folder_id: id, member_id: m })
      }
      save()
      return id
    },
    async renameFolder(id, name) {
      folderById(id).d.name = name.trim()
      save()
    },
    async setFolderCover(folder, cover) {
      const { d } = folderById(folder.id)
      const before = d.cover_path
      d.cover_path = cover === null ? null : 'blob' in cover ? await photo(cover.blob) : cover.path
      if (!save()) {
        d.cover_path = before
        save()
        throw new Error('STOCKAGE_PLEIN')
      }
    },
    async setFolderMembers(rootId, memberIds) {
      const { f, d } = folderById(rootId)
      const keep = new Set([...memberIds.filter((m) => f.members.some((y) => y.id === m)), myId(f), ...(d.owner_id ? [d.owner_id] : [])])
      f.folderMembers = [...f.folderMembers.filter((x) => x.folder_id !== rootId), ...[...keep].map((m) => ({ folder_id: rootId, member_id: m }))]
      save()
    },
    async leaveFolder(rootId, memberId) {
      const { f, d } = folderById(rootId)
      if (d.owner_id === memberId) throw new Error('PAS_ADMIN')
      f.folderMembers = f.folderMembers.filter((x) => !(x.folder_id === rootId && x.member_id === memberId))
      save()
    },
    async deleteFolder(folder) {
      const { f } = folderById(folder.id)
      const ids = subtree(f, folder.id)
      f.folders = f.folders.filter((d) => !ids.has(d.id))
      f.folderItems = f.folderItems.filter((i) => !ids.has(i.folder_id))
      f.folderMembers = f.folderMembers.filter((x) => !ids.has(x.folder_id))
      save()
    },
    async addFolderItem(folder, memberId, x) {
      const { f, d } = folderById(folder.id)
      const now = new Date().toISOString()
      const item: FolderItem = {
        id: uid(), folder_id: d.id, root_id: d.root_id, family_id: d.family_id, author_id: memberId, kind: x.kind,
        title: x.title?.trim() || null, body: x.body?.trim() || null, image_path: x.blob ? await photo(x.blob) : null, created_at: now, updated_at: now,
      }
      f.folderItems.push(item)
      d.updated_at = now
      if (!save()) {
        f.folderItems = f.folderItems.filter((i) => i.id !== item.id)
        save()
        throw new Error('STOCKAGE_PLEIN')
      }
      if (x.kind === 'message') answerIn(f, d)
    },
    async updateFolderItem(id, patch) {
      for (const f of Object.values(db.families)) {
        const i = f.folderItems.find((x) => x.id === id)
        if (!i) continue
        i.title = patch.title?.trim() || null
        i.body = patch.body?.trim() || null
        i.updated_at = new Date().toISOString()
      }
      save()
    },
    async deleteFolderItem(item) {
      for (const f of Object.values(db.families)) {
        f.folderItems = f.folderItems.filter((i) => i.id !== item.id)
        if (item.image_path) for (const d of f.folders) if (d.cover_path === item.image_path) d.cover_path = null
      }
      save()
    },
    async react(moment, memberId, emoji) {
      const f = fam(moment.family_id)
      f.reactions = f.reactions.filter((r) => !(r.moment_id === moment.id && r.member_id === memberId))
      if (emoji) f.reactions.push({ moment_id: moment.id, member_id: memberId, emoji })
      save()
    },
    async sendThought(fid, from, to, kind, message) {
      const f = fam(fid)
      f.thoughts.unshift({
        id: uid(), family_id: fid, from_member: from, to_member: to, kind, message: message?.trim() || null,
        created_at: new Date().toISOString(), seen_at: null,
      })
      award(f, from, 'attention', 1, 5)
      echo(f, f.members.find((m) => m.id === from)!, f.members.find((m) => m.id === to)!)
      save()
    },
    async markSeen(ids) {
      const now = new Date().toISOString()
      for (const f of Object.values(db.families)) for (const t of f.thoughts) if (ids.includes(t.id)) t.seen_at = now
      save()
    },
    async addEvent(fid, memberId, e) {
      fam(fid).events.push({ id: uid(), family_id: fid, created_by: memberId, ...e })
      save()
    },
    async deleteEvent(id) {
      for (const f of Object.values(db.families)) f.events = f.events.filter((e) => e.id !== id)
      save()
    },
    async addItem(fid, memberId, kind, title, assignedTo) {
      fam(fid).items.push({
        id: uid(), family_id: fid, kind, title: title.trim(), done: false, done_by: null,
        assigned_to: assignedTo ?? null, created_by: memberId, created_at: new Date().toISOString(),
      })
      save()
    },
    async toggleItem(item, memberId) {
      const f = fam(item.family_id)
      const it = f.items.find((x) => x.id === item.id)
      if (!it) return
      it.done = !it.done
      it.done_by = it.done ? memberId : null
      if (it.done && it.kind === 'tache') award(f, memberId, 'mission', 1, 8)
      save()
    },
    async deleteItem(id) {
      for (const f of Object.values(db.families)) f.items = f.items.filter((e) => e.id !== id)
      save()
    },
    async answer(fid, memberId, questionKey, answer) {
      const f = fam(fid)
      const day = todayKey()
      if (f.answers.some((a) => a.member_id === memberId && a.day === day)) return
      f.answers.push({ id: uid(), member_id: memberId, day, question_key: questionKey, answer: answer.trim() })
      award(f, memberId, 'question', 2, 1)
      const samples = ['Le gratin de Mamie, sans hésiter', 'Les crêpes du dimanche !', 'Bonne question… je réfléchis encore']
      f.members.filter((m) => m.user_id !== db.userId).slice(0, 2).forEach((m, i) => {
        if (!f.answers.some((a) => a.member_id === m.id && a.day === day)) {
          f.answers.push({ id: uid(), member_id: m.id, day, question_key: questionKey, answer: samples[i % samples.length] })
        }
      })
      save()
    },
    async unlock(fid, key) {
      const f = fam(fid)
      const deco = DECOS.find((d) => d.key === key)
      if (!deco || f.houseItems.includes(key)) return
      if (f.family.stars < deco.cost) throw new Error('PAS_ASSEZ_ETOILES')
      f.family.stars -= deco.cost
      f.houseItems.push(key)
      const me = f.members.find((m) => m.user_id === db.userId)!
      f.starLog.unshift({ id: uid(), member_id: me.id, reason: `deco:${key}`, amount: -deco.cost, created_at: new Date().toISOString() })
      save()
    },
    async linkEmail() {
      throw new Error('DEMO')
    },
    async accountEmail() {
      return null
    },
    async demoDecos(fid, all) {
      fam(fid).houseItems = all ? DECOS.map((d) => d.key) : ['fleurs']
      save()
    },
  }
}

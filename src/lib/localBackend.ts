import { DECOS, PLAN_LIMITS, THOUGHTS } from './data'
import type { Backend, Family, FamilyState, Member, Moment, ThoughtKind } from './types'
import { blobToDataUrl, todayKey, uid } from './util'

// Mode démo : toute la maison vit sur l'appareil, avec trois proches fictifs
// qui répondent aux attentions. Même contrat que le backend Supabase.

type Raw = Omit<FamilyState, 'me'>
type Db = { userId: string; families: Record<string, Raw> }
const KEY = 'nidoo.demo.v2'

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString()
const inDays = (days: number, h = 9, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    /* stockage indisponible : on repart d'une maison vide */
  }
  return { userId: uid(), families: {} }
}

export function createLocalBackend(): Backend {
  let db = read()
  const listeners = new Set<() => void>()
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      // Stockage plein : on allège en retirant les plus anciennes photos.
      for (const f of Object.values(db.families)) f.moments = f.moments.slice(0, 6)
      try {
        localStorage.setItem(KEY, JSON.stringify(db))
      } catch {
        /* tant pis, l'état reste en mémoire */
      }
    }
    listeners.forEach((l) => l())
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
      return structuredClone({
        ...f,
        me,
        answers: f.answers.filter((a) => a.day === day),
        moments: f.moments.map((m) => ({ ...m, image_url: m.image_path })),
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

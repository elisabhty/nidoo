import { folderAsset } from './folderMedia'
import { ANIMALS, CARE, DECOS, FOOD, GONE_AFTER, PET_COST, PLAN_LIMITS, plantOf, shopItem, THOUGHTS } from './data'
import { demoDrawing, type DemoArt } from './drawing'
import { DEMO_LOOKS } from './look'
import { applyMove, botMemory, botMorpion, botPuissance4, isMemory, MEMORY_MAX, MEMORY_MIN, newState, shuffledDeck, type Side } from './jeux'
import { partiesDemo, type Cache, type MotDemo } from './partiesDemo'
import type { AnneeState } from './parties'
import { etoilesDe, parisToday } from './avent'
import type { AdventDoor, AppFlag, Backend, Drawing, Ecrit, Game, Family, FamilyState, Folder, FolderItem, JoinRequest, LiveEvent, Member, Moment, MyRequest, Sticker, ThoughtKind } from './types'
import { blobToDataUrl, compressImage, daysAgoKey, todayKey, uid } from './util'
import { challenge, nextReward, WEEKLY, weekIndex, weekKey, weekStart, type WeeklyCounts, type WeeklyKey } from './weekly'

// Mode démo : toute la maison vit sur l'appareil, avec des proches fictifs
// qui répondent aux attentions. Même contrat que le backend Supabase.

type Raw = Omit<FamilyState, 'me' | 'weekly' | 'houseSince' | 'mot' | 'flags' | 'advent'> & { houseSince?: Record<string, string>; advent?: AdventDoor[] }
  & { caches?: Record<string, Cache>; motDemo?: MotDemo } & { dossiersDemo?: boolean; enfantsDemo?: boolean; weeklyClaims?: Record<string, string>; aventDemo?: number }
  & { jeuxDemo?: boolean; decks?: Record<string, { deck: number[]; pending: number | null }> }
type Pending = MyRequest & { profile: { displayName: string; avatar: string; color: string } }
type Db = { userId: string; families: Record<string, Raw>; pending?: Pending[] }
const KEY = 'nidoo.demo.v2'
/** Dessiner à deux en démo : la séance et le proche invité. */
const seances = new Map<string, string>()
const DINER = 'À partir de 19 h 30. Chacun apporte un plat : Léa s’occupe du dessert, Mamie Jo du gratin.'

// Démo : ce que répondent les proches fictifs à la question du jour (des réponses qui collent à la question).
const REPONSES_QUESTIONS: Record<string, string[]> = {
  q01: ['Le gratin dauphinois du dimanche', 'La soupe de Mamie quand il pleut'],
  q02: ['La Bretagne, quand on a raté le ferry !', 'Le camping dans les Landes'],
  q03: ['Papa, sans aucun doute', 'Léa sous la douche…'],
  q04: ['« On n’est pas pressés »', '« Qui a pris mon chargeur ? »'],
  q05: ['Le Roi Lion', 'Les Visiteurs, évidemment'],
  q06: ['Les crêpes du mercredi', 'Le chocolat chaud de Mamie'],
  q07: ['Noé, au Uno', 'Papa au Monopoly'],
  q08: ['L’Écosse !', 'Un chalet à la montagne'],
  q09: ['Le vase cassé, c’était moi…', 'Les bonbons cachés sous mon lit'],
  q10: ['« Les Champs-Élysées »', 'Une chanson de Goldman'],
  q11: ['Le dessin de Noé', 'Un rayon de soleil ce matin'],
  q12: ['Le vieux fauteuil de Papi', 'L’album photo rouge'],
  q13: ['Mamie Jo, son gratin !', 'Papa et ses crêpes'],
  q14: ['La galette des rois tous ensemble', 'Les crêpes de la Chandeleur'],
  q15: ['Le pull de Noël qui clignote', 'Une plante en plastique'],
  q16: ['Une famille de pingouins, toujours collés !', 'Des loutres : on joue tout le temps'],
  q17: ['« Petit loup »', '« Mon poussin »'],
  q18: ['Grasse matinée, puis crêpes', 'Une balade et un bon goûter'],
  q19: ['Léa, et de loin !', 'Papa avec sa barbe'],
  q20: ['La patience de Mamie', 'L’humour de Papa'],
  q21: ['Le gâteau tombé par terre à Noël', 'Papa dans la piscine tout habillé'],
  q22: ['Celle de la plage en 2019', 'Le mariage de tonton'],
  q23: ['Mamie qui jongle !', 'Noé qui imite tout le monde'],
  q24: ['La mousse au chocolat', 'Le fraisier de Mamie'],
  q25: ['Le tricot avec Mamie', 'Les tours de magie de Papa'],
  q26: ['Cache-cache dans le jardin', 'Le Uno, tous les soirs'],
  q27: ['« Mange, tu es tout maigre ! »', '« De mon temps… »'],
  q28: ['Papa, toujours', 'Moi… pardon !'],
  q29: ['La maison de Mamie à Annecy', 'La plage en Bretagne'],
  q30: ['Pour le dîner de dimanche', 'Pour les petits messages du matin'],
}


const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString()
/** En démo, le calendrier de l'Avent suit la même période qu'en vrai : du 1er décembre au 1er janvier (heure de Paris). */
function demoFlag(): AppFlag {
  const { y, m } = parisToday()
  const an = m <= 2 ? y - 1 : y
  return { enabled: true, starts_at: `${an}-12-01T00:00:00+01:00`, ends_at: `${an + 1}-01-01T00:00:00+01:00` }
}
/** En démo, les proches ont déjà ouvert les cases d'avant (sauf une, à rattraper). */
function demoAdvent(f: Raw, meId: string) {
  const { y, m, d } = parisToday()
  if (m !== 12 || f.aventDemo === y) return
  f.aventDemo = y
  f.advent ??= []
  const proches = f.members.filter((x) => x.user_id && x.id !== meId)
  const today = Math.min(d, 24)
  for (let k = 1; k < today; k++) {
    if (k === today - 2 || f.advent.some((x) => x.year === y && x.day === k) || !proches.length) continue
    const who = proches[k % proches.length]
    f.advent.push({ year: y, day: k, opened_by: who.id, opened_at: new Date(Date.UTC(y, 11, k, 8 + (k % 10))).toISOString() })
  }
}
const inWeek = () => new Date(Date.now() + 7 * 86400000).toISOString()
const newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
// Un cousin qui a tapé le code et attend qu'on lui ouvre : pour voir l'acceptation en mode démo.
const demoRequest = (fid: string): JoinRequest => ({
  id: uid(), family_id: fid, user_id: uid(), display_name: 'Cousin Hugo', avatar: DEMO_LOOKS['Cousin Hugo'], color: 'ciel', status: 'attente', created_at: iso(8),
})
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
function migrate(f: Raw, userId: string) {
  f.pollVotes ??= []
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
  // Les proches fictifs passent des animaux aux personnages.
  // les proches de la démo prennent leur figurine (et les anciens personnages dessinés de la démo aussi)
  for (const m of f.members) if (DEMO_LOOKS[m.display_name] && m.user_id !== userId && !/\.k[1-9]/.test(m.avatar)) m.avatar = DEMO_LOOKS[m.display_name]
  for (const r of f.requests ?? []) if (DEMO_LOOKS[r.display_name] && !/\.k[1-9]/.test(r.avatar)) r.avatar = DEMO_LOOKS[r.display_name]
  // La guirlande lumineuse a quitté la boutique : ses étoiles sont rendues.
  if (f.houseItems.includes('guirlande')) {
    f.houseItems = f.houseItems.filter((k) => k !== 'guirlande')
    f.family.stars += 25
  }
  // Les petits arrivent dans les maisons de démo déjà créées.
  if (!f.enfantsDemo) {
    f.enfantsDemo = true
    const papa = f.members.find((m) => m.display_name === 'Papa' && m.user_id !== userId)
    if (papa) {
      const kid = (name: string, color: string): Member => ({
        id: uid(), family_id: f.family.id, user_id: null, managed_by: papa.id, display_name: name, avatar: DEMO_LOOKS[name], color,
        mood: null, mood_note: null, mood_at: null, joined_at: new Date().toISOString(), role: 'membre',
      })
      f.members.push(kid('Noé', 'soleil'), kid('Bébé Lou', 'rose'))
      const lea = f.members.find((m) => m.display_name === 'Léa' && m.user_id !== userId)
      if (lea) lea.avatar = DEMO_LOOKS['Léa']
    }
  }
  // Rôles : le créateur est responsable ; une famille garde toujours au moins un responsable.
  for (const m of f.members) m.role ??= m.user_id === f.family.created_by ? 'responsable' : 'membre'
  if (f.members.length && !f.members.some((m) => m.role === 'responsable')) f.members[0].role = 'responsable'
  f.family.invite_expires_at ??= inWeek()
  f.cares ??= []
  f.family.food ??= 0
  f.houseSince ??= {}
  for (const k of f.houseItems) f.houseSince[k] ??= new Date().toISOString()
  f.plots ??= []
  f.stock ??= {}
  f.owned ??= []
  if (f.pet === undefined) f.pet = null
  // Le chat du jardin devient le compagnon de la famille.
  if (f.houseItems.includes('chat')) {
    f.pet ??= { species: 'chat', name: 'Minou', love: 0, outfit: null, bed: null, adopted_at: f.houseSince.chat ?? new Date().toISOString() }
    f.houseItems = f.houseItems.filter((k) => k !== 'chat')
  }
  for (const c of f.cares) if (c.item_key === 'chat') c.item_key = 'compagnon'
  const diner = f.events.find((e) => e.title === 'Dîner tous ensemble' && e.description === undefined)
  if (diner) diner.description = DINER
  const dentiste = f.events.find((e) => e.title === 'Dentiste de Léa' && e.members === undefined)
  if (dentiste) dentiste.members = f.members.filter((m) => ['Léa', 'Papa'].includes(m.display_name)).map((m) => m.id)
  f.requests ??= [demoRequest(f.family.id)]
  f.games ??= []
  f.decks ??= {}
  f.parties ??= []
  if (!f.jeuxDemo) {
    // Léa a lancé un morpion et joué au centre : à toi de répondre.
    f.jeuxDemo = true
    const lea = f.members.find((m) => m.display_name === 'Léa' && m.user_id && m.user_id !== userId)
    const moi = f.members.find((m) => m.user_id === userId)
    if (lea && moi) {
      const g = [0, 0, 0, 0, 1, 0, 0, 0, 0]
      f.games.unshift({ id: uid(), family_id: f.family.id, kind: 'morpion', p1: lea.id, p2: moi.id, turn: moi.id, status: 'en_cours', winner: null, state: { g, last: 4, line: null }, created_at: iso(40), updated_at: iso(38) })
    }
  }
  if (!f.drawings) {
    // Un premier dessin de Léa pour toute la famille, pour voir le widget rempli.
    const lea = f.members.find((m) => m.display_name === 'Léa') ?? f.members[f.members.length - 1]
    f.drawings = [{ id: uid(), family_id: f.family.id, from_member: lea.id, to_member: null, data: demoDrawing('coeurs', 3), created_at: iso(150) }]
  }
}

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as Db
      for (const f of Object.values(db.families)) migrate(f, db.userId)
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
  // « X écrit… » en démo : les proches fictifs écrivent pour de vrai sous tes yeux, puis répondent.
  const ecrivains = new Set<(e: { m: string; quoi: Ecrit | null }) => void>()
  const signale = (m: string, quoi: Ecrit | null) => ecrivains.forEach((f) => f({ m, quoi }))
  const REPONSES: Record<'texte' | 'photo' | 'vocal' | 'sticker', string[]> = {
    sticker: ['emo-amoureux', 'emo-mdr', 'emo-calin', 'emo-bisou', 'emo-coucou', 'emo-fete', 'panda-amour'],
    texte: ['Oh trop bien ! On en parle dimanche ?', 'Hâte de te voir 🥰', 'Haha, je savais que tu dirais ça !', 'Bisous à toute la maison', 'Tu me manques déjà…', 'Bonne idée, je m’en occupe 😉'],
    photo: ['Trop belle cette photo ! 😍', 'Oh, j’adore. Tu me l’envoies en grand ?', 'C’est où ? On dirait des vacances !'],
    vocal: ['Ça fait du bien d’entendre ta voix 🥰', 'Haha, j’ai écouté deux fois !', 'Je te rappelle ce soir, promis.'],
  }
  const repondre = (fid: string, quoi: 'texte' | 'photo' | 'vocal' | 'sticker') => {
    const f = db.families[fid]
    const autres = f?.members.filter((x) => x.user_id && x.user_id !== db.userId) ?? []
    const qui = autres[Math.floor(Math.random() * autres.length)]
    if (!f || !qui) return
    window.setTimeout(() => signale(qui.id, 'texte'), 900)
    window.setTimeout(() => {
      // une fois sur trois (et toujours pour un sticker), le proche répond par un sticker
      const parSticker = quoi === 'sticker' || Math.random() < 0.3
      const textes = REPONSES[parSticker ? 'sticker' : quoi]
      const choix = textes[Math.floor(Math.random() * textes.length)]
      f.moments.unshift({ id: uid(), family_id: fid, member_id: qui.id, image_path: null, body: parSticker ? null : choix, sticker: parSticker ? choix : null, challenge: null, created_at: new Date().toISOString() })
      signale(qui.id, null)
      save()
    }, 3800)
  }
  const save = (prune = true): boolean => {
    let ok = true
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      if (!prune) ok = false
      else {
      // Stockage plein : on allège en retirant les plus anciennes photos du fil.
      for (const f of Object.values(db.families)) {
        f.moments = f.moments.slice(0, 6)
        f.drawings = f.drawings.filter((d, i) => i < 8 && (!d.photo_path || i < 3))
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(db))
      } catch {
        ok = false // l'état reste en mémoire
      }
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
  // ───── Jouer ensemble, en démo : les proches répondent après un petit temps de réflexion ─────
  const play = (f: Raw, g: Game, who: string, move: number) => {
    if (g.status !== 'en_cours') throw new Error('PARTIE_FINIE')
    if (g.turn !== who) throw new Error('PAS_TON_TOUR')
    const side: Side = who === g.p1 ? 1 : 2
    const d = f.decks?.[g.id]
    const r = applyMove(g.kind, g.state, side, move, d?.deck, d?.pending ?? null)
    if (d) d.pending = r.pending
    g.state = r.state
    g.updated_at = new Date().toISOString()
    if (r.next === 'other') g.turn = side === 1 ? g.p2 : g.p1
    if (r.next === 'end') {
      g.status = 'fini'
      g.turn = null
      g.winner = r.winner === 1 ? g.p1 : r.winner === 2 ? g.p2 : null
      if (g.winner) award(f, g.winner, 'partie', 2, 5)
    }
  }
  const thinking = new Set<string>()
  const botTurn = (f: Raw, g: Game) => {
    if (g.status !== 'en_cours' || !g.turn || g.turn === myId(f) || thinking.has(g.id)) return
    const bot = g.turn
    const side: Side = bot === g.p1 ? 1 : 2
    thinking.add(g.id)
    window.setTimeout(() => {
      thinking.delete(g.id)
      if (g.status !== 'en_cours' || g.turn !== bot) return
      const st = g.state
      const d = f.decks?.[g.id]
      const move = isMemory(st) ? botMemory(st, d?.deck ?? [], d?.pending ?? null) : g.kind === 'puissance4' ? botPuissance4(st.g, side) : botMorpion(st.g, side)
      try {
        play(f, g, bot, move)
      } catch {
        return
      }
      save()
      botTurn(f, g)
    }, isMemory(g.state) ? 1100 : 1500)
  }

  const award = (f: Raw, memberId: string, reason: string, amount: number, cap?: number) => {
    if (cap != null) {
      const n = f.starLog.filter((s) => s.member_id === memberId && s.reason === reason && todayKey(new Date(s.created_at)) === todayKey()).length
      if (n >= cap) return
    }
    f.starLog.unshift({ id: uid(), member_id: memberId, reason, amount, created_at: new Date().toISOString() })
    f.family.stars += amount
  }
  const pd = partiesDemo({ award, save, myId })

  /** joined : on arrive dans une famille existante (Papa en est le responsable), sinon on la crée. */
  function seed(name: string, houseType: Family['house_type'], me: { displayName: string; avatar: string; color: string }, joined = false, fid = uid()): string {
    const mk = (display_name: string, avatar: string, color: string, mood: string | null, note: string | null, user = uid()): Member => ({
      id: uid(), family_id: fid, user_id: user, display_name, avatar, color, mood, mood_note: note,
      mood_at: mood ? iso(90) : null, joined_at: new Date().toISOString(), role: 'membre',
    })
    const moi = mk(me.displayName, me.avatar, me.color, null, null, db.userId)
    const mamie = mk('Mamie Jo', DEMO_LOOKS['Mamie Jo'], 'peche', 'nostalgique', 'Je trie de vieilles photos')
    const papa = mk('Papa', DEMO_LOOKS.Papa, 'mousse', 'fatigue', 'Grosse semaine')
    const lea = mk('Léa', DEMO_LOOKS['Léa'], 'rose', 'heureux', 'Partiels terminés !')
    // les petits, sans téléphone : ajoutés par Papa
    const noe = { ...mk('Noé', DEMO_LOOKS['Noé'], 'soleil', 'fete', 'C’est mercredi !', null as unknown as string), user_id: null, managed_by: papa.id }
    const lou = { ...mk('Bébé Lou', DEMO_LOOKS['Bébé Lou'], 'rose', 'serein', 'Grosse sieste', null as unknown as string), user_id: null, managed_by: papa.id }
    ;(joined ? papa : moi).role = 'responsable'
    db.families[fid] = {
      family: { id: fid, name, house_type: houseType, invite_code: 'DEMO42', plan: 'free', stars: 14, created_by: joined ? papa.user_id! : db.userId, invite_expires_at: inWeek(), food: 0 },
      members: [moi, mamie, papa, lea, noe, lou],
      enfantsDemo: true,
      games: [],
      parties: [],
      requests: joined ? [] : [demoRequest(fid)],
      pollVotes: [],
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
      drawings: [{ id: uid(), family_id: fid, from_member: lea.id, to_member: null, data: demoDrawing('coeurs', 3), created_at: iso(150) }],
      events: [
        { id: uid(), family_id: fid, title: 'Anniversaire de Mamie Jo', kind: 'anniversaire', starts_at: inDays(4), all_day: true, yearly: true, created_by: papa.id },
        { id: uid(), family_id: fid, title: 'Dîner tous ensemble', kind: 'evenement', starts_at: inDays(1, 19, 30), all_day: false, yearly: false, created_by: lea.id, lieu: 'Chez Papa, 3 rue des Lilas, Annecy', description: DINER },
        { id: uid(), family_id: fid, title: 'Dentiste de Léa', kind: 'rdv', starts_at: inDays(2, 14, 0), all_day: false, yearly: false, created_by: lea.id, lieu: 'Cabinet du Dr Martin, Annecy', members: [lea.id, papa.id] },
      ],
      items: [
        { id: uid(), family_id: fid, kind: 'course', title: 'Farine et œufs', done: false, done_by: null, assigned_to: null, created_by: papa.id, created_at: iso(200) },
        { id: uid(), family_id: fid, kind: 'course', title: 'Bougies d’anniversaire', done: false, done_by: null, assigned_to: null, created_by: lea.id, created_at: iso(180) },
        { id: uid(), family_id: fid, kind: 'tache', title: 'Appeler Mamie Jo', done: false, done_by: null, assigned_to: moi.id, created_by: papa.id, created_at: iso(170) },
        { id: uid(), family_id: fid, kind: 'tache', title: 'Réserver le restaurant', done: true, done_by: papa.id, assigned_to: papa.id, created_by: papa.id, created_at: iso(400) },
      ],
      answers: [],
      houseItems: ['fleurs'],
      cares: [],
      houseSince: { fleurs: new Date().toISOString() },
      pet: null,
      plots: [],
      stock: {},
      owned: [],
      starLog: [
        { id: uid(), member_id: lea.id, reason: 'moment', amount: 3, created_at: iso(55) },
        { id: uid(), member_id: mamie.id, reason: 'attention', amount: 1, created_at: iso(3) },
      ],
    }
    demoDossiers(db.families[fid])
    migrate(db.families[fid], db.userId)
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
    }, 7500)
  }

  // Démo : chaque matin, les proches fictifs donnent leur humeur du jour (toujours la même pour un jour donné).
  const MOOD_NOTES: Record<string, string[]> = {
    heureux: ['Belle journée !', 'Rien ne peut m’arrêter'], serein: ['Tranquille', 'Thé et plaid'], motive: ['Séance de sport ce matin', 'Plein de projets'],
    fete: ['Ce soir on fête ça', 'Anniversaire d’une amie'], fatigue: ['Nuit trop courte', 'Grosse semaine'], stresse: ['Rendu à finir', 'Grosse journée'],
    nostalgique: ['Je trie de vieilles photos', 'Ça me rappelle l’été'], triste: ['Petit coup de mou', 'Journée grise'],
  }
  function dailyMoods(f: Raw) {
    const day = todayKey()
    const keys = Object.keys(MOOD_NOTES)
    for (const m of f.members) {
      // les enfants sans téléphone (Noé, Bébé Lou) n'ont pas d'humeur d'adulte au hasard
      if (m.user_id === db.userId || !m.user_id || (m.mood_at && todayKey(new Date(m.mood_at)) === day)) continue
      const h = [...(day + m.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
      const mood = keys[h % keys.length]
      const at = new Date()
      at.setHours(7 + (h % 3), (h >> 3) % 60, 0, 0)
      m.mood = mood
      m.mood_note = MOOD_NOTES[mood][(h >> 5) % 2]
      m.mood_at = (at.getTime() < Date.now() ? at : new Date()).toISOString()
    }
  }

  /** Le compagnon n'est pas une décoration : il est là si la famille en a un. */
  const has = (f: Raw, key: string) => (key === 'compagnon' ? !!f.pet : f.houseItems.includes(key))

  // Un animal oublié trop longtemps s'en va (même règle que la base : au 4e jour sans repas).
  function checkGarden(f: Raw) {
    const today = todayKey()
    const diff = (a: string) => {
      const [y, m, d] = a.split('-').map(Number)
      const [ty, tm, td] = today.split('-').map(Number)
      return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000)
    }
    let changed = false
    for (const key of ANIMALS.filter((k) => has(f, k))) {
      const last = f.cares.filter((c) => c.item_key === key).reduce<string | null>((a, c) => (!a || c.day > a ? c.day : a), null)
      const since = key === 'compagnon' ? f.pet!.adopted_at : f.houseSince?.[key]
      const base = last ?? todayKey(new Date(since ?? Date.now()))
      if (diff(base) >= GONE_AFTER) {
        const reason = key === 'compagnon' ? `parti:compagnon:${f.pet!.species}:${f.pet!.name}` : `parti:${key}`
        if (key === 'compagnon') f.pet = null
        else f.houseItems = f.houseItems.filter((k) => k !== key)
        f.starLog.unshift({ id: uid(), member_id: null, reason, amount: 0, created_at: new Date().toISOString() })
        changed = true
      }
    }
    if (changed) {
      try {
        localStorage.setItem(KEY, JSON.stringify(db))
      } catch {
        /* l'état reste en mémoire */
      }
    }
  }

  // Démo : une fois par visite, un proche s'occupe d'un animal ou d'une plante (jamais du dernier
  // qui reste à faire) : on voit son « +3 » ou son « +1 » arriver en direct dans le jardin.
  let demoCareSent = false
  function demoCare(f: Raw, meId: string) {
    if (demoCareSent) return
    const day = todayKey()
    const todo = Object.keys(CARE).filter((k) => has(f, k) && !f.cares.some((c) => c.item_key === k && c.day === day) && (!ANIMALS.includes(k) || f.family.food > 1))
    const helpers = f.members.filter((m) => m.user_id && m.id !== meId)
    if (todo.length < 2 || !helpers.length) return
    demoCareSent = true
    window.setTimeout(() => {
      const left = todo.filter((k) => !f.cares.some((c) => c.item_key === k && c.day === todayKey()))
      if (left.length < 2) return
      const key = left[left.length - 1]
      const who = helpers[Math.floor(Math.random() * helpers.length)]
      if (ANIMALS.includes(key)) {
        if (f.family.food <= 0) return
        f.family.food -= 1
      }
      f.cares.unshift({ item_key: key, day: todayKey(), member_id: who.id, created_at: new Date().toISOString() })
      grow(f, key)
      award(f, who.id, `soin:${key}`, CARE[key].stars)
      save()
    }, 25000)
  }

  /** Un repas fait grandir le compagnon ; un arrosage fait pousser le potager. */
  function grow(f: Raw, key: string) {
    if (key === 'compagnon' && f.pet) f.pet.love += 2
    if (key === 'potager') for (const p of f.plots) p.growth = Math.min(30, p.growth + 1)
  }

  // Le proche répond par un dessin quelques secondes plus tard, pour voir la réception en direct.
  const arts: DemoArt[] = ['soleil', 'fleur', 'maison', 'coeurs']
  function drawBack(f: Raw, from: Member, to: Member | null) {
    const others = f.members.filter((m) => m.user_id !== db.userId)
    const who = to && to.user_id !== db.userId ? to : others[Math.floor(Math.random() * others.length)]
    if (!who || f.drawings.some((d) => d.from_member === who.id && Date.now() - new Date(d.created_at).getTime() < 90000)) return
    window.setTimeout(() => {
      const art = arts[Math.floor(Math.random() * arts.length)]
      f.drawings.unshift({ id: uid(), family_id: f.family.id, from_member: who.id, to_member: from.id, data: demoDrawing(art, Date.now() % 997), created_at: new Date().toISOString() })
      save()
    }, 4000)
  }

  function acceptLater(req: Pending) {
    window.setTimeout(() => {
      if (!db.pending?.some((r) => r.id === req.id)) return // demande annulée entre-temps
      db.pending = db.pending.filter((r) => r.id !== req.id)
      seed(req.family_name, req.house_type, req.profile, true, req.family_id)
      save()
    }, 3500)
  }
  // Une demande restée en attente (application fermée) est acceptée à la réouverture.
  for (const r of db.pending ?? []) acceptLater(r)

  // Défi de la semaine : ce que la famille a fait depuis lundi. En démo, les proches fictifs ont déjà fait une partie du chemin.
  const weeklyCounts = (f: Raw): WeeklyCounts => {
    const since = weekStart()
    const after = (iso: string) => new Date(iso).getTime() >= since
    const logged = (reason: string) => f.starLog.filter((x) => x.reason === reason && after(x.created_at)).length
    const c: WeeklyCounts = {
      photos:
        f.moments.filter((m) => m.image_path && after(m.created_at)).length +
        f.folderItems.filter((i) => i.kind === 'photo' && after(i.created_at)).length +
        f.drawings.filter((d) => d.photo_path && after(d.created_at)).length,
      calins: f.thoughts.filter((t) => after(t.created_at)).length,
      dessins: f.drawings.filter((d) => d.data.s.length > 0 && after(d.created_at)).length,
      missions: logged('mission'),
      humeurs: logged('humeur'),
      questions: logged('question'),
    }
    for (const [k, n] of Object.entries(WEEKLY[weekIndex()].goals) as [WeeklyKey, number][]) c[k] += Math.max(0, n - 1)
    return c
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
    // Démo : la demande part, puis Papa (responsable fictif) l'accepte quelques secondes plus tard.
    async joinFamily(i) {
      if (i.code.trim().toUpperCase() !== 'DEMO42') throw new Error('CODE_INCONNU')
      const existing = Object.values(db.families)[0]
      if (existing && existing.members.filter((m) => m.user_id).length >= PLAN_LIMITS[existing.family.plan]) throw new Error('FAMILLE_PLEINE')
      const req: Pending = {
        id: uid(), family_id: uid(), family_name: 'des Tilleuls', house_type: 'chalet', status: 'attente', created_at: new Date().toISOString(),
        profile: { displayName: i.displayName, avatar: i.avatar, color: i.color },
      }
      db.pending = [...(db.pending ?? []), req]
      save()
      acceptLater(req)
      return req.family_id
    },
    async myRequests() {
      return (db.pending ?? []).map(({ profile: _p, ...r }) => r)
    },
    async cancelRequest(id) {
      db.pending = (db.pending ?? []).filter((r) => r.id !== id)
      save()
    },
    async answerRequest(id, accept) {
      for (const f of Object.values(db.families)) {
        const r = f.requests.find((x) => x.id === id)
        if (!r) continue
        if (f.members.find((m) => m.user_id === db.userId)?.role !== 'responsable') throw new Error('PAS_RESPONSABLE')
        if (accept) {
          if (f.members.filter((m) => m.user_id).length >= PLAN_LIMITS[f.family.plan]) throw new Error('FAMILLE_PLEINE')
          f.members.push({
            id: uid(), family_id: f.family.id, user_id: r.user_id, display_name: r.display_name, avatar: r.avatar, color: r.color,
            mood: null, mood_note: null, mood_at: null, joined_at: new Date().toISOString(), role: 'membre',
          })
        }
        f.requests = f.requests.filter((x) => x.id !== id)
        save()
        return
      }
      throw new Error('DEMANDE_INCONNUE')
    },
    async renewInvite(fid) {
      const f = fam(fid)
      f.family.invite_code = newCode()
      f.family.invite_expires_at = inWeek()
      save()
    },
    async setRole(memberId, role) {
      const f = famOfMember(memberId)
      const m = f.members.find((x) => x.id === memberId)!
      if (role === 'membre' && m.role === 'responsable' && f.members.filter((x) => x.role === 'responsable').length <= 1) throw new Error('DERNIER_RESPONSABLE')
      m.role = role
      save()
    },
    async addChild(fid, i) {
      const f = fam(fid)
      if (f.members.filter((m) => !m.user_id).length >= 10) throw new Error('TROP_D_ENFANTS')
      const me = f.members.find((m) => m.user_id === db.userId)!
      f.members.push({
        id: uid(), family_id: fid, user_id: null, managed_by: me.id, display_name: i.displayName.trim(), avatar: i.avatar, color: i.color,
        mood: null, mood_note: null, mood_at: null, joined_at: new Date().toISOString(), role: 'membre',
      })
      save()
    },
    async removeMember(memberId) {
      const f = famOfMember(memberId)
      const m = f.members.find((x) => x.id === memberId)!
      if (m.user_id === db.userId) throw new Error('UTILISE_QUITTER')
      const me = f.members.find((x) => x.user_id === db.userId)!
      if (me.role !== 'responsable' && !(m.user_id === null && m.managed_by === me.id)) throw new Error('PAS_RESPONSABLE')
      f.members = f.members.filter((x) => x.id !== memberId)
      f.folderMembers = f.folderMembers.filter((x) => x.member_id !== memberId)
      save()
    },
    async load(fid) {
      const f = fam(fid)
      const me = f.members.find((m) => m.user_id === db.userId)
      if (!me) throw new Error('PAS_MEMBRE')
      const day = todayKey()
      dailyMoods(f)
      checkGarden(f)
      demoCare(f, me.id)
      for (const g of f.games) botTurn(f, g)
      pd.bots(f)
      demoAdvent(f, me.id)
      for (const d of f.folders.filter(d => d.parent_id)) {
        const inherited = f.folderMembers.filter(m => m.folder_id === d.root_id)
        for (const m of inherited) if (!f.folderMembers.some(x => x.folder_id === d.id && x.member_id === m.member_id)) f.folderMembers.push({...m,folder_id:d.id})
        d.parent_id = null; d.root_id = d.id
        for (const item of f.folderItems.filter(i => i.folder_id === d.id)) item.root_id = d.id
      }
      const mine = new Set(f.folderMembers.filter((x) => x.member_id === me.id).map((x) => x.folder_id))
      return structuredClone({
        ...f,
        me,
        requests: me.role === 'responsable' ? f.requests.filter((r) => r.status === 'attente') : [],
        weekly: { counts: weeklyCounts(f), claimed: f.weeklyClaims?.[weekKey()] ?? null },
        weeklyClaims: undefined,
        answers: f.answers.filter((a) => a.day === day).map((a) => ({ ...a, photo_url: a.photo_path ?? null })),
        cares: f.cares.filter((c) => c.day >= daysAgoKey(6)),
        houseSince: { ...f.houseSince, ...(f.pet ? { compagnon: f.pet.adopted_at } : {}) },
        moments: f.moments.map((m) => ({ ...m, image_url: m.image_path, audio_url: m.audio_path ?? null })),
        drawings: f.drawings.filter((d) => !d.to_member || d.to_member === me.id || d.from_member === me.id).slice(0, 30).map((d) => ({ ...d, photo_url: d.photo_path ?? null })),
        folders: f.folders.filter((d) => mine.has(d.root_id)).map((d) => ({ ...d, cover_url: d.cover_path })),
        folderMembers: f.folderMembers.filter((x) => mine.has(x.folder_id)),
        folderItems: f.folderItems.filter((i) => mine.has(i.root_id)).map((i) => ({ ...i, image_url: i.image_path, media_url: i.media_path ?? null })),
        dossiersDemo: undefined,
        decks: undefined,
        jeuxDemo: undefined,
        games: f.games
          .filter((g) => g.status === 'en_cours' || Date.now() - new Date(g.updated_at).getTime() < 7 * 86400000)
          .map((g) => ({ ...g, photos: isMemory(g.state) ? g.state.paths : undefined })),
        parties: f.parties
          .filter((p) => p.status === 'en_cours' || Date.now() - new Date(p.updated_at).getTime() < 7 * 86400000)
          .map((p) => ({ ...p, photos: p.kind === 'annee' ? (p.state as AnneeState).photos : undefined })),
        caches: undefined,
        motDemo: undefined,
        mot: pd.motLignes(f),
        aventDemo: undefined,
        flags: { avent: demoFlag() },
        advent: f.advent ?? [],
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
      if (patch.house_photo_ids && patch.house_photo_ids.length > 6) throw new Error('La maison peut afficher 6 photos maximum.')
      const family = fam(familyId).family
      const before = {...family}
      Object.assign(family,patch)
      if (!save(false)) {Object.assign(family,before); if(before.house_photo_ids === undefined) delete family.house_photo_ids; throw new Error('STOCKAGE_PLEIN')}
    },
    async deleteAccount() {
      localStorage.removeItem(KEY)
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
        audio_path: m.audio ? await blobToDataUrl(m.audio.blob) : null, duree: m.audio ? Math.round(m.audio.duree) : null, ondes: m.audio?.ondes ?? null,
        sticker: m.sticker ?? null, poll_options: m.pollOptions ?? null,
      }
      f.moments.unshift(moment)
      award(f, memberId, 'moment', 3, 5)
      if (!m.pollOptions) repondre(fid, m.audio ? 'vocal' : m.blob ? 'photo' : m.sticker ? 'sticker' : 'texte')
      else {
        // un sondage : les proches de la démo votent, l'un après l'autre
        const votants = f.members.filter((x) => x.user_id && x.user_id !== db.userId)
        votants.forEach((v, k) => {
          window.setTimeout(() => {
            f.pollVotes = f.pollVotes.filter((x) => !(x.moment_id === moment.id && x.member_id === v.id))
            f.pollVotes.push({ moment_id: moment.id, member_id: v.id, family_id: fid, option_index: Math.floor(Math.random() * m.pollOptions!.length) })
            save()
          }, 2200 + k * 1700)
        })
      }
      // Un proche réagit à la photo, comme dans une vraie famille.
      const other = f.members.find((x) => x.user_id !== db.userId)
      if (other && !m.sticker && !m.pollOptions) {
        window.setTimeout(() => {
          f.reactions.push({ moment_id: moment.id, member_id: other.id, emoji: 'amour' })
          save()
        }, 3500)
      }
      save()
    },
    ecrit() {
      /* en démo, personne d'autre ne lit ce que tu tapes */
    },
    onEcrit(_fid, me, cb) {
      const f = (e: { m: string; quoi: Ecrit | null }) => e.m !== me && cb(e)
      ecrivains.add(f)
      return () => void ecrivains.delete(f)
    },
    async votePoll(moment, memberId, optionIndex) {
      const f = fam(moment.family_id)
      const poll = f.moments.find((m) => m.id === moment.id)
      if (!poll?.poll_options || optionIndex < 0 || optionIndex >= poll.poll_options.length || !f.members.some((m) => m.id === memberId)) throw new Error('SONDAGE_INVALIDE')
      f.pollVotes = f.pollVotes.filter((v) => !(v.moment_id === moment.id && v.member_id === memberId))
      f.pollVotes.push({ moment_id: moment.id, member_id: memberId, family_id: moment.family_id, option_index: optionIndex })
      save()
    },
    async deleteMoment(moment) {
      const f = fam(moment.family_id)
      f.moments = f.moments.filter((m) => m.id !== moment.id)
      f.reactions = f.reactions.filter((r) => r.moment_id !== moment.id)
      f.pollVotes = f.pollVotes.filter((v) => v.moment_id !== moment.id)
      save()
    },
    async createFolder(fid, x) {
      if (x.parentId) throw new Error('Les dossiers imbriqués ne sont plus disponibles.')
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
      if (x.blob) folderAsset(x.kind, x.blob)
      const { f, d } = folderById(folder.id)
      const now = new Date().toISOString()
      const item: FolderItem = {
        id: uid(), folder_id: d.id, root_id: d.root_id, family_id: d.family_id, author_id: memberId, kind: x.kind,
        title: x.title?.trim() || null, body: x.body?.trim() || null, image_path: x.blob && (x.kind === 'photo' || x.kind === 'dessin') ? await photo(x.blob) : null,
        media_path: x.blob && (x.kind === 'audio' || x.kind === 'video') ? await blobToDataUrl(x.blob) : null,
        source_moment_id: x.sourceMomentId ?? null, created_at: now, updated_at: now,
      }
      f.folderItems.push(item)
      d.updated_at = now
      if (!save(false)) {
        f.folderItems = f.folderItems.filter((i) => i.id !== item.id)
        save(false)
        throw new Error('STOCKAGE_PLEIN')
      }
      if (x.kind === 'message') answerIn(f, d)
    },
    async updateFolderItem(id, patch) {
      for (const f of Object.values(db.families)) {
        const i = f.folderItems.find((x) => x.id === id)
        if (!i) continue
        if (i.kind !== 'note') throw new Error('Seules les notes écrites peuvent être modifiées.')
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
    async sendDrawing(fid, from, to, data, image) {
      const f = fam(fid)
      if (!data.s.length && !data.k?.length && !image) throw new Error('DESSIN_VIDE')
      const d: Drawing = {
        id: uid(), family_id: fid, from_member: from, to_member: to, data: structuredClone(data),
        photo_path: image ? await photo(image) : null, created_at: new Date().toISOString(),
      }
      f.drawings.unshift(d)
      if (image) award(f, from, 'moment', 3, 5)
      else award(f, from, 'dessin', 1, 5)
      if (!save()) {
        f.drawings.shift()
        throw new Error('STOCKAGE_PLEIN')
      }
      drawBack(f, f.members.find((m) => m.id === from)!, to ? (f.members.find((m) => m.id === to) ?? null) : null)
    },
    async deleteDrawing(id) {
      for (const f of Object.values(db.families)) f.drawings = f.drawings.filter((d) => d.id !== id)
      save()
    },
    async markSeen(ids) {
      const now = new Date().toISOString()
      for (const f of Object.values(db.families)) for (const t of f.thoughts) if (ids.includes(t.id)) t.seen_at = now
      save()
    },
    async addEvent(fid, memberId, e) {
      const f = fam(fid)
      f.events.push({ id: uid(), family_id: fid, created_by: memberId, ...e, members: f.members.filter((m) => e.members?.includes(m.id)).map((m) => m.id) })
      save()
    },
    async updateEvent(id, patch) {
      for (const f of Object.values(db.families)) {
        const e = f.events.find((x) => x.id === id)
        if (e && patch.title !== undefined) e.title = patch.title.trim()
        if (e && patch.kind !== undefined) e.kind = patch.kind
        if (e && patch.sticker !== undefined) e.sticker = patch.sticker
        if (e && patch.starts_at !== undefined) e.starts_at = patch.starts_at
        if (e && patch.all_day !== undefined) e.all_day = patch.all_day
        if (e && patch.yearly !== undefined) e.yearly = patch.yearly
        if (e && patch.weekly !== undefined) e.weekly = patch.weekly
        if (e && patch.ends_on !== undefined) e.ends_on = patch.ends_on
        if (e && patch.description !== undefined) e.description = patch.description?.trim() || null
        if (e && patch.lieu !== undefined) e.lieu = patch.lieu?.trim() || null
        if (e && patch.members) e.members = f.members.filter((m) => patch.members!.includes(m.id)).map((m) => m.id)
      }
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
    async answer(fid, memberId, questionKey, answer, image) {
      const f = fam(fid)
      const day = todayKey()
      if (f.answers.some((a) => a.member_id === memberId && a.day === day)) return
      if (!answer.trim() && !image) throw new Error('REPONSE_VIDE')
      f.answers.push({ id: uid(), member_id: memberId, day, question_key: questionKey, answer: answer.trim(), photo_path: image ? await photo(image) : null })
      award(f, memberId, 'question', 2, 1)
      const samples = REPONSES_QUESTIONS[questionKey] ?? ['Bonne question… je réfléchis encore', 'Je te dis ça ce soir !']
      f.members.filter((m) => m.user_id !== db.userId).slice(0, 2).forEach((m, i) => {
        if (!f.answers.some((a) => a.member_id === m.id && a.day === day)) {
          f.answers.push({ id: uid(), member_id: m.id, day, question_key: questionKey, answer: samples[i % samples.length] })
        }
      })
      save()
    },
    async care(fid, key) {
      const f = fam(fid)
      const c = CARE[key]
      if (!c) throw new Error('PAS_DE_SOIN')
      if (!has(f, key)) throw new Error(key === 'compagnon' ? 'PAS_DE_COMPAGNON' : 'PAS_INSTALLE')
      const day = todayKey()
      if (f.cares.some((x) => x.item_key === key && x.day === day)) throw new Error('DEJA_FAIT')
      if (ANIMALS.includes(key)) {
        if (f.family.food <= 0) throw new Error('PLUS_DE_CROQUETTES')
        f.family.food -= 1
      }
      const me = myId(f)
      f.cares.unshift({ item_key: key, day, member_id: me, created_at: new Date().toISOString() })
      grow(f, key)
      award(f, me, `soin:${key}`, c.stars)
      save()
      return c.stars
    },
    async buyFood(fid) {
      const f = fam(fid)
      if (f.family.food > FOOD.max - FOOD.meals) throw new Error('STOCK_PLEIN')
      if (f.family.stars < FOOD.cost) throw new Error('PAS_ASSEZ_ETOILES')
      f.family.stars -= FOOD.cost
      f.family.food += FOOD.meals
      f.starLog.unshift({ id: uid(), member_id: myId(f), reason: 'croquettes', amount: -FOOD.cost, created_at: new Date().toISOString() })
      save()
      return f.family.food
    },
    async pet(fid, key) {
      const f = fam(fid)
      if (!ANIMALS.includes(key)) throw new Error('PAS_DE_SOIN')
      if (!has(f, key)) throw new Error(key === 'compagnon' ? 'PAS_DE_COMPAGNON' : 'PAS_INSTALLE')
      const me = myId(f)
      if (f.starLog.some((x) => x.reason === 'caresse' && x.member_id === me && todayKey(new Date(x.created_at)) === todayKey())) return 0
      if (key === 'compagnon' && f.pet) f.pet.love += 1
      award(f, me, 'caresse', 1)
      save()
      return 1
    },
    async buyItem(fid, key) {
      const f = fam(fid)
      const it = shopItem(key)
      if (!it) throw new Error('OBJET_INCONNU')
      if (!it.qty && f.owned.includes(key)) throw new Error('DEJA_ACHETE')
      if (it.qty && (f.stock[key] ?? 0) + it.qty > 99) throw new Error('STOCK_PLEIN')
      if (f.family.stars < it.cost) throw new Error('PAS_ASSEZ_ETOILES')
      f.family.stars -= it.cost
      if (it.qty) f.stock[key] = (f.stock[key] ?? 0) + it.qty
      else f.owned.push(key)
      f.starLog.unshift({ id: uid(), member_id: myId(f), reason: `achat:${key}`, amount: -it.cost, created_at: new Date().toISOString() })
      save()
    },
    async adoptPet(fid, species, name) {
      const f = fam(fid)
      if (f.pet) throw new Error('DEJA_UN_COMPAGNON')
      if (!name.trim()) throw new Error('PRENOM_VIDE')
      if (f.family.stars < PET_COST) throw new Error('PAS_ASSEZ_ETOILES')
      f.family.stars -= PET_COST
      f.pet = { species, name: name.trim().slice(0, 24), love: 0, outfit: null, bed: null, adopted_at: new Date().toISOString() }
      f.starLog.unshift({ id: uid(), member_id: myId(f), reason: 'adoption', amount: -PET_COST, created_at: new Date().toISOString() })
      save()
    },
    async dressPet(fid, patch) {
      const f = fam(fid)
      if (!f.pet) throw new Error('PAS_DE_COMPAGNON')
      if ((patch.outfit && !f.owned.includes(patch.outfit)) || (patch.bed && !f.owned.includes(patch.bed))) throw new Error('PAS_ACHETE')
      f.pet.outfit = patch.outfit || null
      f.pet.bed = patch.bed || null
      if (patch.name.trim()) f.pet.name = patch.name.trim().slice(0, 24)
      save()
    },
    async giveTreat(fid) {
      const f = fam(fid)
      if (!f.pet) throw new Error('PAS_DE_COMPAGNON')
      if (!f.stock.friandises) throw new Error('PLUS_DE_FRIANDISES')
      f.stock.friandises -= 1
      f.pet.love += 3
      save()
      return f.pet.love
    },
    async playPet(fid, toy) {
      const f = fam(fid)
      if (!f.pet) throw new Error('PAS_DE_COMPAGNON')
      if (!toy.startsWith('jeu:') || !f.owned.includes(toy)) throw new Error('PAS_ACHETE')
      const me = myId(f)
      if (f.starLog.some((x) => x.reason === 'jeu' && x.member_id === me && todayKey(new Date(x.created_at)) === todayKey())) return 0
      f.pet.love += 2
      award(f, me, 'jeu', 1)
      save()
      return 1
    },
    async plant(fid, plot, plant) {
      const f = fam(fid)
      if (!f.houseItems.includes('potager')) throw new Error('PAS_DE_POTAGER')
      if (plot < 0 || plot > 2) throw new Error('PARCELLE_INCONNUE')
      if (f.plots.some((p) => p.plot === plot)) throw new Error('PARCELLE_PRISE')
      if (!plantOf(plant)) throw new Error('PLANTE_INCONNUE')
      const k = `graines:${plant}`
      if (!f.stock[k]) throw new Error('PLUS_DE_GRAINES')
      f.stock[k] -= 1
      f.plots.push({ plot, plant, growth: 0, planted_at: new Date().toISOString() })
      f.plots.sort((a, b) => a.plot - b.plot)
      save()
    },
    async fertilize(fid) {
      const f = fam(fid)
      if (!f.plots.length) throw new Error('RIEN_A_FAIRE_POUSSER')
      if (!f.stock.engrais) throw new Error('PLUS_D_ENGRAIS')
      f.stock.engrais -= 1
      for (const p of f.plots) p.growth = Math.min(30, p.growth + 1)
      save()
    },
    async harvest(fid, plot) {
      const f = fam(fid)
      const p = f.plots.find((x) => x.plot === plot)
      if (!p) throw new Error('PARCELLE_VIDE')
      const info = plantOf(p.plant)!
      if (p.growth < info.ripe) throw new Error('PAS_ENCORE_MUR')
      f.plots = f.plots.filter((x) => x !== p)
      award(f, myId(f), `recolte:${p.plant}`, info.reward)
      save()
      return info.reward
    },
    async openAdvent(fid, day) {
      const f = fam(fid)
      const { y, m, d } = parisToday()
      const flag = demoFlag()
      if (Date.now() < Date.parse(flag.starts_at!) || Date.now() >= Date.parse(flag.ends_at!)) throw new Error('AVENT_FERME')
      if (!(day >= 1 && day <= 24)) throw new Error('CASE_INCONNUE')
      if (m !== 12 || d < day) throw new Error('CASE_PAS_ENCORE')
      f.advent ??= []
      if (f.advent.some((x) => x.year === y && x.day === day)) return
      const me = myId(f)
      f.advent.push({ year: y, day, opened_by: me, opened_at: new Date().toISOString() })
      award(f, me, 'avent', etoilesDe(day))
      save()
    },
    async unlock(fid, key) {
      const f = fam(fid)
      const deco = DECOS.find((d) => d.key === key)
      if (!deco || f.houseItems.includes(key)) return
      if (f.family.stars < deco.cost) throw new Error('PAS_ASSEZ_ETOILES')
      f.family.stars -= deco.cost
      f.houseItems.push(key)
      f.houseSince = { ...f.houseSince, [key]: new Date().toISOString() }
      const me = f.members.find((m) => m.user_id === db.userId)!
      f.starLog.unshift({ id: uid(), member_id: me.id, reason: `deco:${key}`, amount: -deco.cost, created_at: new Date().toISOString() })
      save()
    },
    async claimWeekly(fid) {
      const f = fam(fid)
      const wk = weekKey()
      if (f.weeklyClaims?.[wk]) throw new Error('DEFI_DEJA_RECU')
      if (!challenge(weeklyCounts(f)).complete) throw new Error('DEFI_INCOMPLET')
      const me = f.members.find((m) => m.user_id === db.userId)!
      const deco = nextReward(f.houseItems)
      if (deco) {
        f.houseItems.push(deco.key)
        f.houseSince = { ...f.houseSince, [deco.key]: new Date().toISOString() }
        f.starLog.unshift({ id: uid(), member_id: me.id, reason: 'defi', amount: 0, created_at: new Date().toISOString() })
      } else award(f, me.id, 'defi', 20)
      f.weeklyClaims = { ...f.weeklyClaims, [wk]: deco?.key ?? 'etoiles' }
      save()
      return deco?.key ?? 'etoiles'
    },
    async linkEmail() {
      throw new Error('DEMO')
    },
    async accountEmail() {
      return null
    },
    async startGame(fid, opponent, kind, photos) {
      const f = fam(fid)
      const me = myId(f)
      const opp = f.members.find((m) => m.id === opponent)
      if (!opp || opp.id === me || !opp.user_id) throw new Error('ADVERSAIRE_INCONNU')
      const cur = f.games.find((g) => g.kind === kind && g.status === 'en_cours' && [g.p1, g.p2].includes(me) && [g.p1, g.p2].includes(opponent))
      if (cur) return cur.id
      let paths: string[] = []
      if (kind === 'memory') {
        const n = photos?.length ?? 0
        if (n < MEMORY_MIN) throw new Error('MEMORY_PHOTOS')
        if (n > MEMORY_MAX) throw new Error('MEMORY_TROP_DE_PHOTOS')
        paths = await Promise.all((photos ?? []).map(async (b) => blobToDataUrl(await compressImage(b, 420, 0.7))))
      }
      const now = new Date().toISOString()
      const g: Game = { id: uid(), family_id: fid, kind, p1: me, p2: opponent, turn: me, status: 'en_cours', winner: null, state: newState(kind, paths), created_at: now, updated_at: now }
      f.games.unshift(g)
      if (kind === 'memory') (f.decks ??= {})[g.id] = { deck: shuffledDeck(paths.length), pending: null }
      save()
      return g.id
    },
    async playGame(game, move) {
      const f = fam(game.family_id)
      const g = f.games.find((x) => x.id === game.id)
      if (!g) throw new Error('PARTIE_INCONNUE')
      play(f, g, myId(f), move)
      save()
      botTurn(f, g)
    },
    async startPartie(fid, kind, players, setup = {}, photos) {
      const f = fam(fid)
      const paths = await Promise.all((photos ?? []).map(async (b) => blobToDataUrl(await compressImage(b, 600, 0.75))))
      const id = pd.start(f, kind, players, setup, paths)
      save()
      pd.bots(f)
      return id
    },
    async actPartie(partie, action) {
      const f = fam(partie.family_id)
      const p = f.parties.find((x) => x.id === partie.id)
      if (!p) throw new Error('PARTIE_INCONNUE')
      const r = pd.act(f, p, myId(f), action)
      save()
      pd.bots(f)
      return r
    },
    async secretPartie(partie) {
      const f = fam(partie.family_id)
      const p = f.parties.find((x) => x.id === partie.id)
      return p ? pd.secret(f, p, myId(f)) : {}
    },
    async quitPartie(id) {
      for (const f of Object.values(db.families)) {
        if (!f.parties?.some((p) => p.id === id)) continue
        pd.quit(f, id)
        save()
      }
    },
    async motEssai(fid, mot) {
      const f = fam(fid)
      const r = pd.motEssai(f, mot)
      save()
      return r
    },
    async motMesEssais(fid) {
      return pd.motMesEssais(fam(fid))
    },
    async quitGame(id) {
      for (const f of Object.values(db.families)) {
        const g = f.games.find((x) => x.id === id)
        if (!g) continue
        const me = myId(f)
        if (g.status === 'fini' || ![g.p1, g.p2].includes(me)) return
        g.status = 'fini'
        g.turn = null
        g.winner = me === g.p1 ? g.p2 : g.p1
        g.state = { ...g.state, abandon: true }
        g.updated_at = new Date().toISOString()
        save()
        return
      }
      throw new Error('PARTIE_INCONNUE')
    },
    // ───── Dessiner à deux, en démo : le proche invité arrive et dessine pour de vrai sous tes yeux ─────
    async inviteLive(_fid, _from, to) {
      const session = uid()
      seances.set(session, to)
      return session
    },
    onLiveInvite() {
      return () => {}
    },
    joinLive(fid, session, me, on) {
      const who = seances.get(session)
      const timers: number[] = []
      let fini = false
      let leurs: Sticker[] = []
      const later = (ms: number, f: () => void) => timers.push(window.setTimeout(() => !fini && f(), ms))
      if (who && who !== me) {
        // un dessin de démo, tracé petit à petit sur la droite de la feuille
        const arts: DemoArt[] = ['fleur', 'soleil', 'coeurs', 'maison']
        const art = demoDrawing(arts[Math.floor(Math.random() * arts.length)], Date.now() % 997)
        const tr = (p: number[]) => p.map((v, i) => Math.round(i % 2 ? 60 + v * 0.75 : 470 + v * 0.5))
        let t = 1800
        later(t, () => on({ t: 'hello', who }))
        t += 900
        art.s.forEach((s, j) => {
          const id = `demo-${session}-${j}`
          const p = tr(s.p)
          const w = Math.max(6, Math.round(s.w * 0.6))
          for (let i = 0; i < p.length; i += 8) {
            const part = p.slice(i, i + 8)
            const first = i === 0
            later(t, () => on({ t: 'pt', who, id, ...(first ? { s: { o: s.o, c: s.c, w } } : {}), p: part }))
            t += 45
          }
          later(t, () => on({ t: 'end', who, id }))
          t += 420
        })
        // pour finir, il colle un petit cœur à côté de ce que tu as mis
        later(t + 600, () => on({ t: 'k', who, k: [...leurs, { i: 'coeur', x: 900, y: 90, s: 120, r: 12 }] }))
      }
      return {
        send(e: LiveEvent) {
          if (e.t === 'k' || e.t === 'state') leurs = e.k
          if (e.t === 'fin') fini = true
        },
        leave() {
          fini = true
          timers.forEach((x) => window.clearTimeout(x))
          void fid
        },
      }
    },

    async demoDecos(fid, all) {
      const f = fam(fid)
      f.houseItems = all ? DECOS.map((d) => d.key) : ['fleurs']
      f.houseSince = Object.fromEntries(f.houseItems.map((k) => [k, new Date().toISOString()]))
      if (all) f.family.food = Math.max(f.family.food, FOOD.meals)
      save()
    },
  }
}

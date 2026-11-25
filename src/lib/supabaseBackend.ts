import { folderAsset } from './folderMedia'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { isMemory } from './jeux'
import { jourParis, type AnneeState, type MotLigne, type MotMoi, type Secret } from './parties'
import type { AdventDoor, AppFlag, Answer, Backend, Game, Partie, HouseCare, Pet, Plot, Circle, Drawing, DrawingData, FamEvent, Family, FamilyState, Folder, JoinRequest, LiveEvent, LiveInvite, MyRequest, FolderItem, FolderMember, ListItem, Member, Moment, PollVote, Position, Reaction, StarEntry, Thought, Ecrit } from './types'
import { compressImage, daysAgoKey, todayKey, uid } from './util'
import { createSignedUrlCache } from './signedUrls'
import { ecrireCopie, effacerCopies, lireCopie } from './cacheEtat'

/** Durée des liens signés des photos, en jours. */
const LIENS_JOURS = 7
let liensTimer: number | undefined
import { emptyCounts, type WeeklyCounts } from './weekly'

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

export function createSupabaseBackend(): Backend {
  const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nidoo.auth' },
  })
  // Les liens des photos durent 7 jours et sont gardés sur l'appareil (renouvelés au bout de 6) : une photo garde
  // la même adresse d'un lancement à l'autre, donc le téléphone la ressort de son cache au lieu de la retélécharger.
  const signedUrls = createSignedUrlCache(
    async (bucket, paths) => {
      const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, LIENS_JOURS * 86400)
      if (error) throw new Error(error.message)
      return (data ?? []).flatMap((item) => item.path && item.signedUrl ? [{ path: item.path, signedUrl: item.signedUrl }] : [])
    },
    undefined,
    (LIENS_JOURS - 1) * 86400000,
    {
      lire: async () => (userId ? ((await lireCopie<Record<string, { url: string; refreshAt: number }>>('liens', userId))?.valeur ?? null) : null),
      ecrire: (liens) => {
        if (!userId) return
        window.clearTimeout(liensTimer)
        const u = userId
        liensTimer = window.setTimeout(() => void ecrireCopie('liens', u, liens), 2000)
      },
    },
  )
  const removeUnusedAsset = async (path: string) => {
    const [items, covers] = await Promise.all([
      sb.from('folder_items').select('id').or(`image_path.eq.${path},media_path.eq.${path}`).limit(1),
      sb.from('folders').select('id').eq('cover_path', path).limit(1),
    ])
    if (!items.error && !covers.error && !items.data?.length && !covers.data?.length) await sb.storage.from('dossiers').remove([path])
  }
  let userId = ''
  const traits = new Map<string, DrawingData>()
  // Un seul canal privé par famille pour les invitations à dessiner à deux.
  const canaux = new Map<string, Promise<RealtimeChannel>>()
  const ecouteurs = new Map<string, Set<(m: { payload: LiveInvite }) => void>>()
  // « X écrit… » : sur le même canal privé de la famille
  const ecrivains = new Map<string, Set<(p: { m: string; quoi: Ecrit | null }) => void>>()
  const canalFamille = (fid: string, ecoute?: (m: { payload: LiveInvite }) => void) => {
    if (ecoute) {
      if (!ecouteurs.has(fid)) ecouteurs.set(fid, new Set())
      ecouteurs.get(fid)!.add(ecoute)
    }
    let p = canaux.get(fid)
    if (!p) {
      p = sb.realtime.setAuth().then(
        () =>
          new Promise<RealtimeChannel>((res, rej) => {
            const ch = sb.channel(`nidoo:famille:${fid}`, { config: { private: true, broadcast: { self: false } } })
            ch.on('broadcast', { event: 'invite' }, (m) => ecouteurs.get(fid)?.forEach((f) => f(m as unknown as { payload: LiveInvite })))
            ch.on('broadcast', { event: 'ecrit' }, (m) => {
              const p = (m as unknown as { payload: { m: string; quoi: Ecrit | null } }).payload
              if (p?.m) ecrivains.get(fid)?.forEach((f) => f(p))
            })
            ch.subscribe((st) => {
              if (st === 'SUBSCRIBED') res(ch)
              else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
                canaux.delete(fid)
                rej(new Error('RESEAU'))
              }
            })
          }),
      )
      canaux.set(fid, p)
    }
    return p
  }

  return {
    mode: 'supabase',

    async start() {
      const { data } = await sb.auth.getSession()
      if (data.session) {
        userId = data.session.user.id
        return userId
      }
      // Une session est gardée sur l'appareil mais n'a pas pu être prolongée (pas de réseau à cet instant) : surtout
      // ne pas ouvrir un nouveau compte invisible par-dessus — on perdrait sa famille. On réessaiera.
      // (Une session vraiment révoquée est retirée de l'appareil par la bibliothèque : on ne passe pas ici.)
      let gardee = false
      try {
        gardee = !!JSON.parse(localStorage.getItem('nidoo.auth') ?? 'null')?.refresh_token
      } catch {
        /* stockage indisponible ou illisible */
      }
      if (gardee) throw new Error('Failed to fetch (session)')
      // Pas de mot de passe à retenir : chaque téléphone reçoit un compte invisible,
      // qu'on peut ensuite rattacher à un e-mail depuis « Notre famille ».
      const r = await sb.auth.signInAnonymously()
      if (r.error || !r.data.user) {
        throw new Error(/anonymous/i.test(r.error?.message ?? '') ? 'ANONYME_DESACTIVE' : (r.error?.message ?? 'NON_CONNECTE'))
      }
      userId = r.data.user.id
      return userId
    },

    async circles() {
      const mine = check(await sb.from('members').select('*').eq('user_id', userId).order('joined_at')) as Member[]
      if (!mine.length) return []
      const fams = check(await sb.from('families').select('*').in('id', mine.map((m) => m.family_id))) as Family[]
      return mine
        .map((me) => ({ me, family: fams.find((f) => f.id === me.family_id)! }))
        .filter((c): c is Circle => !!c.family)
    },

    async createFamily(i) {
      return check(
        await sb.rpc('create_family', {
          p_name: i.name, p_house_type: i.houseType, p_display_name: i.displayName, p_avatar: i.avatar, p_color: i.color,
        }),
      ) as string
    },

    async previewFamily(code) {
      const rows = check(await sb.rpc('preview_family', { p_code: code })) as { name: string; house_type: Family['house_type']; member_count: number }[]
      return rows?.[0] ?? null
    },

    async joinFamily(i) {
      const id = check(await sb.rpc('join_family', { p_code: i.code, p_display_name: i.displayName, p_avatar: i.avatar, p_color: i.color })) as string | null
      if (!id) throw new Error('CODE_INCONNU')
      return id
    },
    async myRequests() {
      return (check(await sb.rpc('my_requests')) ?? []) as MyRequest[]
    },
    async cancelRequest(id) {
      check(await sb.from('join_requests').delete().eq('id', id))
    },
    async answerRequest(id, accept) {
      check(await sb.rpc('answer_request', { p_request: id, p_accept: accept }))
    },
    async claimWeekly(fid) {
      return check(await sb.rpc('claim_weekly', { p_family: fid })) as string
    },
    async renewInvite(fid) {
      check(await sb.rpc('renew_invite', { p_family: fid }))
    },
    async setRole(memberId, role) {
      check(await sb.rpc('set_member_role', { p_member: memberId, p_role: role }))
    },
    async addChild(fid, i) {
      check(await sb.rpc('add_child', { p_family: fid, p_name: i.displayName, p_avatar: i.avatar, p_color: i.color }))
    },
    async removeMember(memberId) {
      check(await sb.rpc('remove_member', { p_member: memberId }))
    },

    async load(fid) {
      // Les animaux oubliés trop longtemps s'en vont avant qu'on regarde le jardin.
      await sb.rpc('check_garden', { p_family: fid }).then(
        () => undefined,
        () => undefined,
      )
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const [family, members, requests, weekly, moments, pollVotes, folders, folderMembers, folderItems, reactions, thoughts, drawings, events, items, answers, house, stars, cares, pets, plots, stock, owned, games, jeux2, motJour, flags, advent, positions] = await Promise.all([
        sb.from('families').select('*').eq('id', fid).single(),
        sb.from('members').select('*').eq('family_id', fid).order('joined_at'),
        // Lisibles seulement par les responsables (RLS) : vide pour les autres.
        sb.from('join_requests').select('*').eq('family_id', fid).eq('status', 'attente').order('created_at'),
        sb.rpc('weekly_challenge', { p_family: fid }),
        sb.from('moments').select('*').eq('family_id', fid).order('created_at', { ascending: false }).limit(120),
        sb.from('poll_votes').select('moment_id, member_id, family_id, option_index').eq('family_id', fid),
        sb.from('folders').select('*').eq('family_id', fid).order('created_at'),
        sb.from('folder_members').select('folder_id, member_id').eq('family_id', fid),
        sb.from('folder_items').select('*').eq('family_id', fid).order('created_at').limit(2000),
        sb.from('reactions').select('moment_id, member_id, emoji').eq('family_id', fid),
        sb.from('thoughts').select('*').eq('family_id', fid).gte('created_at', since).order('created_at', { ascending: false }).limit(80),
        sb.from('drawings').select('id, family_id, from_member, to_member, created_at, photo_path').eq('family_id', fid).order('created_at', { ascending: false }).limit(30),
        sb.from('events').select('*').eq('family_id', fid).order('starts_at'),
        sb.from('list_items').select('*').eq('family_id', fid).order('created_at'),
        sb.from('daily_answers').select('id, member_id, day, question_key, answer, photo_path').eq('family_id', fid).eq('day', todayKey()),
        sb.from('house_items').select('item_key, unlocked_at').eq('family_id', fid),
        sb.from('star_log').select('id, member_id, reason, amount, created_at').eq('family_id', fid).order('created_at', { ascending: false }).limit(30),
        sb.from('house_care').select('item_key, day, member_id, created_at').eq('family_id', fid).gte('day', daysAgoKey(6)),
        sb.from('pets').select('species, name, love, outfit, bed, adopted_at').eq('family_id', fid),
        sb.from('garden_plots').select('plot, plant, growth, planted_at').eq('family_id', fid).order('plot'),
        sb.from('family_stock').select('item_key, qty').eq('family_id', fid),
        sb.from('shop_items').select('item_key').eq('family_id', fid),
        sb.from('games').select('*').eq('family_id', fid).or(`status.eq.en_cours,updated_at.gt."${weekAgo}"`).order('updated_at', { ascending: false }).limit(40),
        // Les jeux à plusieurs et le mot mystère : s'ils manquent (base pas encore à jour), l'appli marche sans.
        sb.from('parties').select('*').eq('family_id', fid).or(`status.eq.en_cours,updated_at.gt."${weekAgo}"`).order('updated_at', { ascending: false }).limit(40),
        sb.from('mot_essais').select('member_id, motifs, trouve').eq('family_id', fid).eq('day', jourParis()),
        // Les interrupteurs à distance et l'Avent : s'ils manquent, l'appli marche quand même (sans calendrier).
        sb.from('app_flags').select('key, enabled, starts_at, ends_at'),
        sb.from('advent_doors').select('year, day, opened_by, opened_at').eq('family_id', fid),
        // Où est la famille : si la table manque (base pas encore à jour), l'appli marche sans.
        sb.from('positions').select('member_id, family_id, lat, lon, precision_m, lieu, ville, batterie, updated_at').eq('family_id', fid),
      ])
      const pet = ((check(pets) ?? []) as Pet[])[0] ?? null
      const mem = check(members) as Member[]
      const me = mem.find((m) => m.user_id === userId)
      if (!me) throw new Error('PAS_MEMBRE')
      const moms = check(moments) as Moment[]
      const reponses = (check(answers) ?? []) as Answer[]
      // Photos du fil et de la question du jour : même espace privé, lisible par la famille.
      const paths = [...moms.map((m) => m.image_path), ...moms.map((m) => m.audio_path), ...reponses.map((a) => a.photo_path)].filter((x): x is string => !!x)
      if (paths.length) {
        const byPath = await signedUrls('moments', paths)
        for (const m of moms) {
          m.image_url = m.image_path ? (byPath.get(m.image_path) ?? null) : null
          m.audio_url = m.audio_path ? (byPath.get(m.audio_path) ?? null) : null
        }
        for (const a of reponses) a.photo_url = a.photo_path ? (byPath.get(a.photo_path) ?? null) : null
      }
      // Photos et couvertures des dossiers : liens signés, lisibles par les seuls membres.
      const dossiers = (check(folders) ?? []) as Folder[]
      const contenus = (check(folderItems) ?? []) as FolderItem[]
      const fichiers = [...new Set([...contenus.flatMap((i) => [i.image_path, i.media_path]), ...dossiers.map((d) => d.cover_path)].filter((x): x is string => !!x))]
      if (fichiers.length) {
        const byPath = await signedUrls('dossiers', fichiers)
        for (const i of contenus) {
          i.image_url = i.image_path ? (byPath.get(i.image_path) ?? null) : null
          i.media_url = i.media_path ? (byPath.get(i.media_path) ?? null) : null
        }
        for (const d of dossiers) d.cover_url = d.cover_path ? (byPath.get(d.cover_path) ?? null) : null
      }
      // Dessins : les traits ne sont téléchargés qu'une fois, puis gardés en mémoire.
      const dessins = (check(drawings) ?? []) as Omit<Drawing, 'data'>[]
      const manquants = dessins.filter((d) => !traits.has(d.id)).map((d) => d.id)
      if (manquants.length) {
        for (const r of check(await sb.from('drawings').select('id, data').in('id', manquants)) as { id: string; data: DrawingData }[]) traits.set(r.id, r.data)
      }
      // Photos des instants : liens signés, lisibles seulement par ceux qui voient l'instant.
      const fonds = dessins.map((d) => d.photo_path).filter((x): x is string => !!x)
      if (fonds.length) {
        const byPath = await signedUrls('instants', fonds)
        for (const d of dessins) d.photo_url = d.photo_path ? (byPath.get(d.photo_path) ?? null) : null
      }
      // Memory : les photos des cartes, lisibles par la famille.
      const parties = ((check(games) ?? []) as Game[])
      const groupes = (jeux2.data ?? []) as Partie[]
      const cartes = [...new Set([...parties.flatMap((g) => (isMemory(g.state) ? g.state.paths : [])), ...groupes.flatMap((p) => (p.kind === 'annee' ? (p.state as AnneeState).photos : []))])]
      if (cartes.length) {
        const byPath = await signedUrls('jeux', cartes)
        for (const g of parties) if (isMemory(g.state)) g.photos = g.state.paths.map((p) => byPath.get(p) ?? null)
        for (const p of groupes) if (p.kind === 'annee') p.photos = (p.state as AnneeState).photos.map((x) => byPath.get(x) ?? null)
      }
      const state: FamilyState = {
        family: check(family) as Family,
        me,
        members: mem,
        requests: (check(requests) ?? []) as JoinRequest[],
        weekly: (() => {
          const w = check(weekly) as { counts: Partial<WeeklyCounts>; claimed: string | null } | null
          return { counts: { ...emptyCounts(), ...w?.counts }, claimed: w?.claimed ?? null }
        })(),
        moments: moms,
        pollVotes: (check(pollVotes) ?? []) as PollVote[],
        folders: dossiers,
        folderMembers: (check(folderMembers) ?? []) as FolderMember[],
        folderItems: contenus,
        reactions: (check(reactions) ?? []) as Reaction[],
        thoughts: (check(thoughts) ?? []) as Thought[],
        drawings: dessins.filter((d) => traits.has(d.id)).map((d) => ({ ...d, data: traits.get(d.id)! })),
        events: (check(events) ?? []) as FamEvent[],
        items: (check(items) ?? []) as ListItem[],
        answers: reponses,
        houseItems: (check(house) as { item_key: string }[]).map((h) => h.item_key),
        houseSince: {
          ...Object.fromEntries((check(house) as { item_key: string; unlocked_at: string }[]).map((h) => [h.item_key, h.unlocked_at])),
          ...(pet ? { compagnon: pet.adopted_at } : {}),
        },
        pet,
        plots: (check(plots) ?? []) as Plot[],
        stock: Object.fromEntries(((check(stock) ?? []) as { item_key: string; qty: number }[]).map((x) => [x.item_key, x.qty])),
        owned: ((check(owned) ?? []) as { item_key: string }[]).map((x) => x.item_key),
        starLog: (check(stars) ?? []) as StarEntry[],
        cares: (check(cares) ?? []) as HouseCare[],
        games: parties,
        parties: groupes,
        mot: (motJour.data ?? []) as MotLigne[],
        flags: Object.fromEntries(((flags.data ?? []) as ({ key: string } & AppFlag)[]).map(({ key, ...f }) => [key, f])),
        advent: (advent.data ?? []) as AdventDoor[],
        positions: (positions.data ?? []) as Position[],
      }
      return state
    },

    subscribe(fid, onChange) {
      const ch = sb.channel(`famille:${fid}`)
      for (const table of ['members', 'join_requests', 'weekly_rewards', 'moments', 'poll_votes', 'folders', 'folder_members', 'folder_items', 'reactions', 'thoughts', 'drawings', 'events', 'list_items', 'daily_answers', 'house_items', 'house_care', 'pets', 'garden_plots', 'family_stock', 'shop_items', 'games', 'parties', 'mot_essais', 'advent_doors', 'positions']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${fid}` }, onChange)
      }
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${fid}` }, onChange)
      ch.subscribe()
      return () => {
        void sb.removeChannel(ch)
      }
    },

    // ───── Jeux en famille : les coups passent par des fonctions SQL qui vérifient tout (0017_jeux.sql) ─────
    async startGame(fid, opponent, kind, photos) {
      const paths: string[] = []
      try {
        if (kind === 'memory') {
          for (const p of photos ?? []) {
            const path = `${fid}/${uid()}.jpg`
            check(await sb.storage.from('jeux').upload(path, await compressImage(p, 720, 0.8), { contentType: 'image/jpeg' }))
            paths.push(path)
          }
        }
        return check(await sb.rpc('start_game', { p_family: fid, p_kind: kind, p_opponent: opponent, p_photos: kind === 'memory' ? paths : null })) as string
      } catch (e) {
        if (paths.length) await sb.storage.from('jeux').remove(paths)
        throw e
      }
    },
    async playGame(game, move) {
      check(await sb.rpc('play_game', { p_game: game.id, p_move: move }))
    },
    async quitGame(id) {
      check(await sb.rpc('quit_game', { p_game: id }))
    },
    async startPartie(fid, kind, players, setup = {}, photos) {
      const paths: string[] = []
      try {
        for (const p of photos ?? []) {
          const path = `${fid}/${uid()}.jpg`
          check(await sb.storage.from('jeux').upload(path, await compressImage(p, 900, 0.82), { contentType: 'image/jpeg' }))
          paths.push(path)
        }
        const config = kind === 'annee' ? { ...setup, photos: paths } : setup
        return check(await sb.rpc('start_partie', { p_family: fid, p_kind: kind, p_players: players, p_setup: config })) as string
      } catch (e) {
        if (paths.length) await sb.storage.from('jeux').remove(paths)
        throw e
      }
    },
    async actPartie(p, action) {
      return (check(await sb.rpc('act_partie', { p_partie: p.id, p_action: action })) ?? {}) as Record<string, unknown>
    },
    async secretPartie(p) {
      return (check(await sb.rpc('secret_partie', { p_partie: p.id })) ?? {}) as Secret
    },
    async quitPartie(id) {
      check(await sb.rpc('quit_partie', { p_partie: id }))
    },
    async motEssai(fid, mot) {
      return check(await sb.rpc('mot_essai', { p_family: fid, p_mot: mot })) as { motif: string; trouve: boolean; solution: string | null }
    },
    async motMesEssais(fid) {
      return check(await sb.rpc('mot_mes_essais', { p_family: fid })) as MotMoi
    },
    // ───── « À deux, on porte ! » : les records et les étoiles (supabase/migrations/20261120183500_porte.sql) ─────
    async porteRecords(fid, memberId) {
      const rows = check(await sb.from('porte_records').select('niveau, etoiles, temps').eq('family_id', fid).eq('member_id', memberId)) as { niveau: number; etoiles: number; temps: number }[]
      return Object.fromEntries(rows.map((r) => [r.niveau, { e: r.etoiles, t: Number(r.temps) }]))
    },
    // ───── Où est la famille (supabase/migrations/20261121220000_positions.sql) ─────
    async partagerPosition(fid, p) {
      check(await sb.rpc('position_partager', {
        p_family: fid, p_lat: p.lat, p_lon: p.lon, p_precision: p.precision ?? null, p_lieu: p.lieu ?? null, p_ville: p.ville ?? null, p_batterie: p.batterie ?? null,
      }))
    },
    async arreterPosition(fid) {
      check(await sb.rpc('position_arreter', { p_family: fid }))
    },
    async widgetCle(fid) {
      return (check(await sb.rpc('widget_cle', { p_family: fid })) as string) ?? ''
    },
    async porteFini(fid, niveau, etoiles, temps) {
      return check(await sb.rpc('porte_fini', { p_family: fid, p_niveau: niveau, p_etoiles: etoiles, p_temps: Math.round(temps * 10) / 10 })) as { gain: number }
    },
    // ───── Dessiner à deux : canaux privés de Supabase Realtime (règles dans 0014_dessin_a_deux.sql) ─────
    async inviteLive(fid, from, to, jeu) {
      const session = uid()
      const ch = await canalFamille(fid)
      const r = await ch.send({ type: 'broadcast', event: 'invite', payload: { session, from, to, at: Date.now(), ...(jeu ? { jeu } : {}) } satisfies LiveInvite })
      if (r !== 'ok') throw new Error('RESEAU')
      return session
    },
    onLiveInvite(fid, me, cb) {
      let ch: RealtimeChannel | null = null
      let off = false
      const ecoute = (m: { payload: LiveInvite }) => {
        const inv = m.payload
        if (inv?.to === me && Date.now() - inv.at < 120000) cb(inv)
      }
      void canalFamille(fid, ecoute)
        .then((c) => {
          if (off) return
          ch = c
        })
        .catch(() => undefined)
      return () => {
        off = true
        if (ch) ecouteurs.get(fid)?.delete(ecoute)
      }
    },
    joinLive(fid, session, me, on) {
      const ch = sb.channel(`nidoo:dessin:${fid}:${session}`, { config: { private: true, broadcast: { self: false } } })
      ch.on('broadcast', { event: 'live' }, (m) => on(m.payload as LiveEvent))
      let pret = false
      const file: LiveEvent[] = []
      void sb.realtime.setAuth().then(() =>
        ch.subscribe((st) => {
          if (st !== 'SUBSCRIBED') return
          pret = true
          for (const e of file.splice(0)) void ch.send({ type: 'broadcast', event: 'live', payload: e })
        }),
      )
      void me
      return {
        send(e) {
          if (pret) void ch.send({ type: 'broadcast', event: 'live', payload: e })
          else file.push(e)
        },
        leave() {
          setTimeout(() => void sb.removeChannel(ch), 300)
        },
      }
    },

    async setMood(memberId, mood, note) {
      check(await sb.from('members').update({ mood, mood_note: note }).eq('id', memberId))
    },
    async updateMember(memberId, patch) {
      check(await sb.from('members').update(patch).eq('id', memberId))
    },
    async updateFamily(familyId, patch) {
      check(await sb.from('families').update(patch).eq('id', familyId))
    },
    async leave(memberId) {
      check(await sb.from('members').delete().eq('id', memberId))
    },

    async deleteAccount() {
      // D'abord mes fichiers (photos et vocaux du fil, photos de mes dessins), tant qu'on sait encore lesquels
      // sont à moi ; puis la base efface tout le reste (public.delete_my_account), et on se déconnecte.
      try {
        const mes = (check(await sb.from('members').select('id').eq('user_id', userId)) as { id: string }[]).map((m) => m.id)
        if (mes.length) {
          const mo = check(await sb.from('moments').select('image_path,audio_path').in('member_id', mes)) as { image_path: string | null; audio_path: string | null }[]
          const fichiers = mo.flatMap((m) => [m.image_path, m.audio_path]).filter((x): x is string => !!x)
          for (let i = 0; i < fichiers.length; i += 100) await sb.storage.from('moments').remove(fichiers.slice(i, i + 100))
          const dr = check(await sb.from('drawings').select('photo_path').in('from_member', mes)) as { photo_path: string | null }[]
          const photos = dr.map((d) => d.photo_path).filter((x): x is string => !!x)
          for (let i = 0; i < photos.length; i += 100) await sb.storage.from('instants').remove(photos.slice(i, i + 100))
        }
      } catch {
        /* les fichiers restants ne sont plus reliés à personne ; on efface quand même le compte */
      }
      const r = await sb.rpc('delete_my_account')
      if (r.error) throw new Error(r.error.message)
      await sb.auth.signOut().catch(() => undefined)
      // plus rien de cette maison ne reste sur l'appareil
      window.clearTimeout(liensTimer)
      await effacerCopies()
    },

    async postMoment(fid, memberId, m) {
      let image_path: string | null = null
      if (m.blob) {
        image_path = `${fid}/${uid()}.jpg`
        const up = await sb.storage.from('moments').upload(image_path, m.blob, { contentType: 'image/jpeg' })
        if (up.error) throw new Error(up.error.message)
      }
      let audio_path: string | null = null
      if (m.audio) {
        const type = m.audio.blob.type.split(';')[0] || 'audio/mp4'
        const ext = type.includes('webm') ? 'webm' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : type.includes('aac') ? 'aac' : 'm4a'
        audio_path = `${fid}/${uid()}.${ext}`
        const up = await sb.storage.from('moments').upload(audio_path, m.audio.blob, { contentType: type })
        if (up.error) throw new Error(up.error.message)
      }
      check(
        await sb.from('moments').insert({
          family_id: fid, member_id: memberId, image_path, body: m.body?.trim() || null, challenge: m.challenge ?? null,
          audio_path, duree: m.audio ? Math.max(1, Math.min(300, Math.round(m.audio.duree))) : null, ondes: m.audio ? m.audio.ondes.slice(0, 64) : null, sticker: m.sticker?.slice(0, 60) || null, poll_options: m.pollOptions ?? null,
        }),
      )
    },
    async votePoll(moment, memberId, optionIndex) {
      if (!moment.poll_options || optionIndex < 0 || optionIndex >= moment.poll_options.length) throw new Error('SONDAGE_INVALIDE')
      check(await sb.from('poll_votes').upsert({ moment_id: moment.id, family_id: moment.family_id, member_id: memberId, option_index: optionIndex }, { onConflict: 'moment_id,member_id' }))
    },
    ecrit(fid, memberId, quoi) {
      void canalFamille(fid)
        .then((ch) => ch.send({ type: 'broadcast', event: 'ecrit', payload: { m: memberId, quoi } }))
        .catch(() => {})
    },
    onEcrit(fid, me, cb) {
      if (!ecrivains.has(fid)) ecrivains.set(fid, new Set())
      const f = (p: { m: string; quoi: Ecrit | null }) => p.m !== me && cb(p)
      ecrivains.get(fid)!.add(f)
      void canalFamille(fid).catch(() => {})
      return () => void ecrivains.get(fid)?.delete(f)
    },
    async deleteMoment(moment) {
      const fichiers = [moment.image_path, moment.audio_path].filter((x): x is string => !!x)
      if (fichiers.length) await sb.storage.from('moments').remove(fichiers)
      check(await sb.from('moments').delete().eq('id', moment.id))
    },
    // ───── Dossiers
    async createFolder(fid, f) {
      if (f.parentId) throw new Error('Les dossiers imbriqués ne sont plus disponibles.')
      return check(
        await sb.rpc('create_folder', { p_family: fid, p_name: f.name.trim(), p_parent: f.parentId ?? null, p_members: f.memberIds ?? [] }),
      ) as string
    },
    async renameFolder(id, name) {
      check(await sb.from('folders').update({ name: name.trim() }).eq('id', id))
    },
    async setFolderCover(folder, cover) {
      let path: string | null = null
      if (cover && 'blob' in cover) {
        path = `${folder.root_id}/couverture-${uid()}.jpg`
        const up = await sb.storage.from('dossiers').upload(path, cover.blob, { contentType: 'image/jpeg' })
        if (up.error) throw new Error(up.error.message)
      } else if (cover) {
        path = cover.path
      }
      check(await sb.from('folders').update({ cover_path: path }).eq('id', folder.id))
      // Une ancienne couverture envoyée exprès (pas une photo du dossier) n'a plus d'usage.
      if (folder.cover_path && folder.cover_path !== path && folder.cover_path.includes('/couverture-')) {
        await sb.storage.from('dossiers').remove([folder.cover_path])
      }
    },
    async setFolderMembers(rootId, memberIds) {
      check(await sb.rpc('set_folder_members', { p_folder: rootId, p_members: memberIds }))
    },
    async leaveFolder(rootId, memberId) {
      check(await sb.from('folder_members').delete().eq('folder_id', rootId).eq('member_id', memberId))
    },
    async deleteFolder(folder) {
      // Le dossier, ses sous-dossiers et leur contenu partent en base ; on efface aussi leurs fichiers.
      const all = (check(await sb.from('folders').select('id, parent_id, cover_path').eq('root_id', folder.root_id)) ?? []) as Pick<Folder, 'id' | 'parent_id' | 'cover_path'>[]
      const ids = new Set([folder.id])
      for (let grew = true; grew; ) {
        grew = false
        for (const d of all) if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) ids.add(d.id), (grew = true)
      }
      const rows = (check(await sb.from('folder_items').select('image_path,media_path').in('folder_id', [...ids])) ?? []) as { image_path: string | null; media_path: string | null }[]
      const covers = all.filter((d) => ids.has(d.id) && d.cover_path?.includes('/couverture-')).map((d) => d.cover_path!)
      check(await sb.from('folders').delete().eq('id', folder.id))
      const paths = [...rows.flatMap((r) => [r.image_path, r.media_path]), ...covers].filter((p): p is string => !!p)
      if (paths.length) await sb.storage.from('dossiers').remove(paths)
    },
    async addFolderItem(folder, memberId, i) {
      let path: string | null = null
      if (i.blob) {
        const asset = folderAsset(i.kind, i.blob)
        path = `${folder.root_id}/${uid()}.${asset.extension}`
        check(await sb.storage.from('dossiers').upload(path, i.blob, { contentType: asset.mime }))
      }
      try {
        check(await sb.from('folder_items').insert({
          folder_id: folder.id, author_id: memberId, kind: i.kind, title: i.title?.trim() || null, body: i.body?.trim() || null,
          image_path: i.kind === 'photo' || i.kind === 'dessin' ? path : null,
          media_path: i.kind === 'audio' || i.kind === 'video' ? path : null,
          source_moment_id: i.sourceMomentId ?? null,
        }))
      } catch (error) {
        if (path) await sb.storage.from('dossiers').remove([path])
        throw error
      }
    },
    async updateFolderItem(id, patch) {
      check(await sb.from('folder_items').update({ title: patch.title?.trim() || null, body: patch.body?.trim() || null }).eq('id', id).eq('kind', 'note').select('id').single())
    },
    async deleteFolderItem(item) {
      check(await sb.from('folder_items').delete().eq('id', item.id))
      if (item.image_path) await removeUnusedAsset(item.image_path)
      if (item.media_path) await removeUnusedAsset(item.media_path)
    },

    async react(moment, memberId, emoji) {
      if (!emoji) {
        check(await sb.from('reactions').delete().eq('moment_id', moment.id).eq('member_id', memberId))
      } else {
        check(
          await sb.from('reactions').upsert(
            { moment_id: moment.id, member_id: memberId, family_id: moment.family_id, emoji },
            { onConflict: 'moment_id,member_id' },
          ),
        )
      }
    },

    async sendThought(fid, from, to, kind, message) {
      check(await sb.from('thoughts').insert({ family_id: fid, from_member: from, to_member: to, kind, message: message?.trim() || null }))
    },
    async markSeen(ids) {
      if (ids.length) check(await sb.from('thoughts').update({ seen_at: new Date().toISOString() }).in('id', ids))
    },
    async sendDrawing(fid, from, to, data, photo) {
      let photo_path: string | null = null
      if (photo) {
        photo_path = `${fid}/${uid()}.jpg`
        check(await sb.storage.from('instants').upload(photo_path, photo, { contentType: 'image/jpeg' }))
      }
      const r = await sb.from('drawings').insert({ family_id: fid, from_member: from, to_member: to, data, photo_path })
      if (r.error && photo_path) await sb.storage.from('instants').remove([photo_path])
      check(r)
    },
    async deleteDrawing(id) {
      const row = (check(await sb.from('drawings').select('photo_path').eq('id', id).maybeSingle()) ?? null) as { photo_path: string | null } | null
      check(await sb.from('drawings').delete().eq('id', id))
      if (row?.photo_path) await sb.storage.from('instants').remove([row.photo_path])
      traits.delete(id)
    },

    async addEvent(fid, memberId, e) {
      check(await sb.from('events').insert({ family_id: fid, created_by: memberId, ...e }))
    },
    async updateEvent(id, patch) {
      check(
        await sb
          .from('events')
          .update({
            ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 60) } : {}),
            ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
            ...(patch.sticker !== undefined ? { sticker: patch.sticker } : {}),
            ...(patch.starts_at !== undefined ? { starts_at: patch.starts_at } : {}),
            ...(patch.all_day !== undefined ? { all_day: patch.all_day } : {}),
            ...(patch.yearly !== undefined ? { yearly: patch.yearly } : {}),
            ...(patch.weekly !== undefined ? { weekly: patch.weekly } : {}),
            ...(patch.repete !== undefined ? { repete: patch.repete } : {}),
            ...(patch.ends_on !== undefined ? { ends_on: patch.ends_on } : {}),
            ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
            ...(patch.lieu !== undefined ? { lieu: patch.lieu?.trim().slice(0, 200) || null } : {}),
            ...(patch.members ? { members: patch.members } : {}),
          })
          .eq('id', id),
      )
    },
    async deleteEvent(id) {
      check(await sb.from('events').delete().eq('id', id))
    },

    async addItem(fid, memberId, kind, title, assignedTo, eventId) {
      check(await sb.from('list_items').insert({ family_id: fid, created_by: memberId, kind, title: title.trim(), assigned_to: assignedTo ?? null, ...(eventId ? { event_id: eventId } : {}) }))
    },
    async toggleItem(item, memberId) {
      check(await sb.from('list_items').update({ done: !item.done, done_by: item.done ? null : memberId }).eq('id', item.id))
    },
    async linkItem(id, eventId) {
      check(await sb.from('list_items').update({ event_id: eventId }).eq('id', id))
    },
    async repetitions() {
      // la colonne repete existe-t-elle ? (ajoutée par 20261121170000_repeter.sql)
      const { error } = await sb.from('events').select('repete').limit(1)
      return !error
    },
    async lienTaches() {
      // la colonne event_id existe-t-elle ? (ajoutée par 20261121160000_taches_evenements.sql)
      const { error } = await sb.from('list_items').select('event_id').limit(1)
      return !error
    },
    async renameItem(id, title) {
      check(await sb.from('list_items').update({ title: title.trim().slice(0, 80) }).eq('id', id))
    },
    async deleteItem(id) {
      check(await sb.from('list_items').delete().eq('id', id))
    },

    async answer(fid, memberId, questionKey, answer, photo) {
      let photo_path: string | null = null
      if (photo) {
        photo_path = `${fid}/${uid()}.jpg`
        check(await sb.storage.from('moments').upload(photo_path, await compressImage(photo, 1400, 0.82), { contentType: 'image/jpeg' }))
      }
      check(await sb.from('daily_answers').insert({ family_id: fid, member_id: memberId, question_key: questionKey, answer: answer.trim(), photo_path, day: todayKey() }))
    },
    async care(fid, key) {
      return check(await sb.rpc('care_item', { p_family: fid, p_key: key })) as number
    },
    async buyFood(fid) {
      return check(await sb.rpc('buy_food', { p_family: fid })) as number
    },
    async pet(fid, key) {
      return check(await sb.rpc('pet_animal', { p_family: fid, p_key: key })) as number
    },
    async buyItem(fid, key) {
      check(await sb.rpc('buy_item', { p_family: fid, p_key: key }))
    },
    async adoptPet(fid, species, name) {
      check(await sb.rpc('adopt_pet', { p_family: fid, p_species: species, p_name: name.trim() }))
    },
    async dressPet(fid, patch) {
      check(await sb.rpc('dress_pet', { p_family: fid, p_outfit: patch.outfit ?? '', p_bed: patch.bed ?? '', p_name: patch.name }))
    },
    async giveTreat(fid) {
      return check(await sb.rpc('give_treat', { p_family: fid })) as number
    },
    async playPet(fid, toy) {
      return check(await sb.rpc('play_pet', { p_family: fid, p_toy: toy })) as number
    },
    async plant(fid, plot, plant) {
      check(await sb.rpc('plant_seed', { p_family: fid, p_plot: plot, p_plant: plant }))
    },
    async fertilize(fid) {
      check(await sb.rpc('fertilize', { p_family: fid }))
    },
    async harvest(fid, plot) {
      return check(await sb.rpc('harvest', { p_family: fid, p_plot: plot })) as number
    },
    async openAdvent(fid, day) {
      check(await sb.rpc('open_advent_door', { p_family: fid, p_day: day }))
    },
    async unlock(fid, key) {
      check(await sb.rpc('unlock_item', { p_family: fid, p_key: key }))
    },

    async linkEmail(email) {
      const r = await sb.auth.updateUser({ email })
      if (r.error) throw new Error(r.error.message)
    },
    async accountEmail() {
      const { data } = await sb.auth.getUser()
      return data.user?.email ?? data.user?.new_email ?? null
    },
  }
}

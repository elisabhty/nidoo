import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { Answer, Backend, HouseCare, Circle, Drawing, DrawingData, FamEvent, Family, FamilyState, Folder, JoinRequest, MyRequest, FolderItem, FolderMember, ListItem, Member, Moment, Reaction, StarEntry, Thought } from './types'
import { compressImage, daysAgoKey, todayKey, uid } from './util'
import { emptyCounts, type WeeklyCounts } from './weekly'

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

export function createSupabaseBackend(): Backend {
  const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nidoo.auth' },
  })
  let userId = ''
  const traits = new Map<string, DrawingData>()

  return {
    mode: 'supabase',

    async start() {
      const { data } = await sb.auth.getSession()
      if (data.session) {
        userId = data.session.user.id
        return userId
      }
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
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const [family, members, requests, weekly, moments, folders, folderMembers, folderItems, reactions, thoughts, drawings, events, items, answers, house, stars, cares] = await Promise.all([
        sb.from('families').select('*').eq('id', fid).single(),
        sb.from('members').select('*').eq('family_id', fid).order('joined_at'),
        // Lisibles seulement par les responsables (RLS) : vide pour les autres.
        sb.from('join_requests').select('*').eq('family_id', fid).eq('status', 'attente').order('created_at'),
        sb.rpc('weekly_challenge', { p_family: fid }),
        sb.from('moments').select('*').eq('family_id', fid).order('created_at', { ascending: false }).limit(120),
        sb.from('folders').select('*').eq('family_id', fid).order('created_at'),
        sb.from('folder_members').select('folder_id, member_id').eq('family_id', fid),
        sb.from('folder_items').select('*').eq('family_id', fid).order('created_at').limit(2000),
        sb.from('reactions').select('moment_id, member_id, emoji').eq('family_id', fid),
        sb.from('thoughts').select('*').eq('family_id', fid).gte('created_at', since).order('created_at', { ascending: false }).limit(80),
        sb.from('drawings').select('id, family_id, from_member, to_member, created_at, photo_path').eq('family_id', fid).order('created_at', { ascending: false }).limit(30),
        sb.from('events').select('*').eq('family_id', fid).order('starts_at'),
        sb.from('list_items').select('*').eq('family_id', fid).order('created_at'),
        sb.from('daily_answers').select('id, member_id, day, question_key, answer, photo_path').eq('family_id', fid).eq('day', todayKey()),
        sb.from('house_items').select('item_key').eq('family_id', fid),
        sb.from('star_log').select('id, member_id, reason, amount, created_at').eq('family_id', fid).order('created_at', { ascending: false }).limit(30),
        sb.from('house_care').select('item_key, day, member_id, created_at').eq('family_id', fid).gte('day', daysAgoKey(3)),
      ])
      const mem = check(members) as Member[]
      const me = mem.find((m) => m.user_id === userId)
      if (!me) throw new Error('PAS_MEMBRE')
      const moms = check(moments) as Moment[]
      const reponses = (check(answers) ?? []) as Answer[]
      // Photos du fil et de la question du jour : même espace privé, lisible par la famille.
      const paths = [...moms.map((m) => m.image_path), ...reponses.map((a) => a.photo_path)].filter((x): x is string => !!x)
      if (paths.length) {
        const signed = await sb.storage.from('moments').createSignedUrls(paths, 3600)
        const byPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))
        for (const m of moms) m.image_url = m.image_path ? (byPath.get(m.image_path) ?? null) : null
        for (const a of reponses) a.photo_url = a.photo_path ? (byPath.get(a.photo_path) ?? null) : null
      }
      // Photos et couvertures des dossiers : liens signés, lisibles par les seuls membres.
      const dossiers = (check(folders) ?? []) as Folder[]
      const contenus = (check(folderItems) ?? []) as FolderItem[]
      const fichiers = [...new Set([...contenus.map((i) => i.image_path), ...dossiers.map((d) => d.cover_path)].filter((x): x is string => !!x))]
      if (fichiers.length) {
        const signed = await sb.storage.from('dossiers').createSignedUrls(fichiers, 3600)
        const byPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))
        for (const i of contenus) i.image_url = i.image_path ? (byPath.get(i.image_path) ?? null) : null
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
        const signed = await sb.storage.from('instants').createSignedUrls(fonds, 3600)
        const byPath = new Map((signed.data ?? []).map((x) => [x.path, x.signedUrl]))
        for (const d of dessins) d.photo_url = d.photo_path ? (byPath.get(d.photo_path) ?? null) : null
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
        starLog: (check(stars) ?? []) as StarEntry[],
        cares: (check(cares) ?? []) as HouseCare[],
      }
      return state
    },

    subscribe(fid, onChange) {
      const ch = sb.channel(`famille:${fid}`)
      for (const table of ['members', 'join_requests', 'weekly_rewards', 'moments', 'folders', 'folder_members', 'folder_items', 'reactions', 'thoughts', 'drawings', 'events', 'list_items', 'daily_answers', 'house_items', 'house_care']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${fid}` }, onChange)
      }
      ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${fid}` }, onChange)
      ch.subscribe()
      return () => {
        void sb.removeChannel(ch)
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

    async postMoment(fid, memberId, m) {
      let image_path: string | null = null
      if (m.blob) {
        image_path = `${fid}/${uid()}.jpg`
        const up = await sb.storage.from('moments').upload(image_path, m.blob, { contentType: 'image/jpeg' })
        if (up.error) throw new Error(up.error.message)
      }
      check(
        await sb.from('moments').insert({
          family_id: fid, member_id: memberId, image_path, body: m.body?.trim() || null, challenge: m.challenge ?? null,
        }),
      )
    },
    async deleteMoment(moment) {
      if (moment.image_path) await sb.storage.from('moments').remove([moment.image_path])
      check(await sb.from('moments').delete().eq('id', moment.id))
    },
    // ───── Dossiers
    async createFolder(fid, f) {
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
      const rows = (check(await sb.from('folder_items').select('image_path').in('folder_id', [...ids]).not('image_path', 'is', null)) ?? []) as { image_path: string }[]
      const covers = all.filter((d) => ids.has(d.id) && d.cover_path?.includes('/couverture-')).map((d) => d.cover_path!)
      check(await sb.from('folders').delete().eq('id', folder.id))
      const paths = [...rows.map((r) => r.image_path), ...covers]
      if (paths.length) await sb.storage.from('dossiers').remove(paths)
    },
    async addFolderItem(folder, memberId, i) {
      let image_path: string | null = null
      if (i.blob) {
        image_path = `${folder.root_id}/${uid()}.jpg`
        const up = await sb.storage.from('dossiers').upload(image_path, i.blob, { contentType: 'image/jpeg' })
        if (up.error) throw new Error(up.error.message)
      }
      check(
        await sb.from('folder_items').insert({
          folder_id: folder.id, author_id: memberId, kind: i.kind, title: i.title?.trim() || null, body: i.body?.trim() || null, image_path,
        }),
      )
    },
    async updateFolderItem(id, patch) {
      check(await sb.from('folder_items').update({ title: patch.title?.trim() || null, body: patch.body?.trim() || null }).eq('id', id))
    },
    async deleteFolderItem(item) {
      check(await sb.from('folder_items').delete().eq('id', item.id))
      if (item.image_path) await sb.storage.from('dossiers').remove([item.image_path])
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
            ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
            ...(patch.members ? { members: patch.members } : {}),
          })
          .eq('id', id),
      )
    },
    async deleteEvent(id) {
      check(await sb.from('events').delete().eq('id', id))
    },

    async addItem(fid, memberId, kind, title, assignedTo) {
      check(await sb.from('list_items').insert({ family_id: fid, created_by: memberId, kind, title: title.trim(), assigned_to: assignedTo ?? null }))
    },
    async toggleItem(item, memberId) {
      check(await sb.from('list_items').update({ done: !item.done, done_by: item.done ? null : memberId }).eq('id', item.id))
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

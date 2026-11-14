import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import type { Answer, Backend, Circle, FamEvent, Family, FamilyState, ListItem, Member, Moment, Reaction, StarEntry, Thought } from './types'
import { todayKey, uid } from './util'

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

export function createSupabaseBackend(): Backend {
  const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nidoo.auth' },
  })
  let userId = ''

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
      return check(
        await sb.rpc('join_family', { p_code: i.code, p_display_name: i.displayName, p_avatar: i.avatar, p_color: i.color }),
      ) as string
    },

    async load(fid) {
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const [family, members, moments, reactions, thoughts, events, items, answers, house, stars] = await Promise.all([
        sb.from('families').select('*').eq('id', fid).single(),
        sb.from('members').select('*').eq('family_id', fid).order('joined_at'),
        sb.from('moments').select('*').eq('family_id', fid).order('created_at', { ascending: false }).limit(60),
        sb.from('reactions').select('moment_id, member_id, emoji').eq('family_id', fid),
        sb.from('thoughts').select('*').eq('family_id', fid).gte('created_at', since).order('created_at', { ascending: false }).limit(80),
        sb.from('events').select('*').eq('family_id', fid).order('starts_at'),
        sb.from('list_items').select('*').eq('family_id', fid).order('created_at'),
        sb.from('daily_answers').select('id, member_id, day, question_key, answer').eq('family_id', fid).eq('day', todayKey()),
        sb.from('house_items').select('item_key').eq('family_id', fid),
        sb.from('star_log').select('id, member_id, reason, amount, created_at').eq('family_id', fid).order('created_at', { ascending: false }).limit(30),
      ])
      const mem = check(members) as Member[]
      const me = mem.find((m) => m.user_id === userId)
      if (!me) throw new Error('PAS_MEMBRE')
      const moms = check(moments) as Moment[]
      const paths = moms.filter((m) => m.image_path).map((m) => m.image_path!)
      if (paths.length) {
        const signed = await sb.storage.from('moments').createSignedUrls(paths, 3600)
        const byPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))
        for (const m of moms) m.image_url = m.image_path ? (byPath.get(m.image_path) ?? null) : null
      }
      const state: FamilyState = {
        family: check(family) as Family,
        me,
        members: mem,
        moments: moms,
        reactions: (check(reactions) ?? []) as Reaction[],
        thoughts: (check(thoughts) ?? []) as Thought[],
        events: (check(events) ?? []) as FamEvent[],
        items: (check(items) ?? []) as ListItem[],
        answers: (check(answers) ?? []) as Answer[],
        houseItems: (check(house) as { item_key: string }[]).map((h) => h.item_key),
        starLog: (check(stars) ?? []) as StarEntry[],
      }
      return state
    },

    subscribe(fid, onChange) {
      const ch = sb.channel(`famille:${fid}`)
      for (const table of ['members', 'moments', 'reactions', 'thoughts', 'events', 'list_items', 'daily_answers', 'house_items']) {
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
      check(await sb.from('moments').delete().eq('id', moment.id))
      if (moment.image_path) await sb.storage.from('moments').remove([moment.image_path])
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

    async addEvent(fid, memberId, e) {
      check(await sb.from('events').insert({ family_id: fid, created_by: memberId, ...e }))
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

    async answer(fid, memberId, questionKey, answer) {
      check(await sb.from('daily_answers').insert({ family_id: fid, member_id: memberId, question_key: questionKey, answer: answer.trim(), day: todayKey() }))
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

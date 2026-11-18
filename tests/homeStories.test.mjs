import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'

const { homeStories } = await loadTs('src/lib/homeStories.ts')
const now = new Date('2026-11-18T12:00:00Z')
const members = [
  { id: 'moi', display_name: 'Moi', mood: null, mood_at: null },
  { id: 'lea', display_name: 'Léa', mood: null, mood_at: null },
]
const base = () => ({ members: members.map((m) => ({ ...m })), moments: [] })

test('annonce un événement réel et conserve son lien vers le détail', () => {
  const event = { id: 'fete', title: 'Dîner de famille', kind: 'evenement', all_day: false, lieu: 'Chez Mamie' }
  const stories = homeStories(base(), 'moi', { e: event, at: new Date('2026-11-19T19:30:00Z') }, now)
  assert.equal(stories[0].label, 'Demain')
  assert.equal(stories[0].event, event)
  assert.match(stories[0].detail, /Chez Mamie/)
})

test('mentionne une photo et un message réellement partagés, sans répétition', () => {
  const state = base()
  state.moments = [
    { id: 'p1', member_id: 'lea', image_path: 'famille/photo.jpg', body: 'À la mer', created_at: '2026-11-18T10:00:00Z' },
    { id: 'm1', member_id: 'lea', body: 'Coucou !', image_path: null, created_at: '2026-11-18T09:00:00Z' },
  ]
  const stories = homeStories(state, 'moi', null, now)
  assert.deepEqual(stories.map((s) => s.kind), ['photo', 'message'])
  assert.equal(stories[0].title, 'Léa a partagé une photo')
})

test('n’annonce pas un message ancien ou une humeur d’hier', () => {
  const state = base()
  state.moments = [{ id: 'ancien', member_id: 'lea', body: 'Bonjour', created_at: '2026-11-01T09:00:00Z' }]
  state.members[1].mood = 'heureux'
  state.members[1].mood_at = '2026-11-17T09:00:00Z'
  const stories = homeStories(state, 'moi', null, now)
  assert.equal(stories.length, 1)
  assert.equal(stories[0].kind, 'invitation')
})

test('affiche les humeurs du jour sans dévoiler un dossier privé', () => {
  const state = base()
  state.members[1].mood = 'heureux'
  state.members[1].mood_at = '2026-11-18T10:00:00Z'
  const stories = homeStories(state, 'moi', null, now)
  assert.equal(stories[0].kind, 'humeur')
  assert.match(stories[0].title, /Léa/)
})

test('une maison sans autre membre invite ses proches', () => {
  const state = { members: [members[0]], moments: [] }
  const stories = homeStories(state, 'moi', null, now)
  assert.equal(stories[0].target, 'famille')
})

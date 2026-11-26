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
  assert.match(stories[0].label, /^Demain · \d{1,2}h\d\d$/)
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
  // la légende de la photo, qui l'a envoyée et quand ; le message cité
  assert.equal(stories[0].title, '« À la mer »')
  assert.equal(stories[0].label, 'Léa · il y a 2 h')
  assert.equal(stories[1].title, '« Coucou ! »')
})

test('les nouvelles des proches passent avant les siennes', () => {
  const state = base()
  state.moments = [
    { id: 'moi1', member_id: 'moi', body: 'Mon message', created_at: '2026-11-18T11:00:00Z' },
    { id: 'lea1', member_id: 'lea', body: 'Celui de Léa', created_at: '2026-11-18T08:00:00Z' },
  ]
  const stories = homeStories(state, 'moi', null, now)
  assert.equal(stories[0].member.id, 'lea')
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


test('le lieu d’un événement qui est une de nos adresses se lit par son nom (« Maison »), pas l’adresse complète', () => {
  const maison = { id: 'm', family_id: 'f', nom: 'Maison', adresse: '15 Rue André Lalande, 91000 Évry-Courcouronnes', lat: 48.62, lon: 2.43, rayon_m: 150, created_at: '2026-11-26T00:00:00Z' }
  const at = new Date('2026-11-19T19:30:00Z')
  const par = (lieu, endroits) => homeStories({ ...base(), endroits }, 'moi', { e: { id: 'x', title: 'Goûter', kind: 'evenement', all_day: false, lieu }, at }, now)[0].detail
  assert.equal(par('15 Rue André Lalande, 91000 Évry-Courcouronnes', [maison]), 'Maison')
  assert.equal(par('maison', [maison]), 'Maison')
  assert.equal(par('15 Rue André Lalande, 91000 Évry-Courcouronnes', []), '15 Rue André Lalande, 91000 Évry-Courcouronnes')
  assert.equal(par('Gare de Lyon', [maison]), 'Gare de Lyon')
})

test('seul dans la maison et rien encore : pas de chronique (l’accueil invite déjà ses proches, juste en dessous)', () => {
  const state = { members: [members[0]], moments: [] }
  assert.deepEqual(homeStories(state, 'moi', null, now), [])
})

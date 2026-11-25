import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { suivable, avecQui, meConcerne, prochainASuivre, cleFois } = await loadTs('src/lib/directRegles.ts')

const maintenant = new Date(2026, 10, 27, 12, 0)
const dans = (min) => new Date(maintenant.getTime() + min * 60000).toISOString()
const evt = (id, min, plus = {}) => ({ id, family_id: 'f', title: id, kind: 'rdv', starts_at: dans(min), all_day: false, yearly: false, created_by: 'moi', ...plus })

test('activité en direct : seulement un rendez-vous avec une heure, dans les 8 heures', () => {
  assert.ok(suivable(evt('a', 42), maintenant))
  assert.equal(suivable(evt('a', 42), maintenant).getTime(), new Date(dans(42)).getTime())
  assert.equal(suivable(evt('a', 9 * 60), maintenant), null) // trop loin : iOS ne la garderait pas
  assert.equal(suivable(evt('a', -5), maintenant), null) // déjà commencé
  assert.equal(suivable(evt('a', 0.5), maintenant), null) // dans 30 secondes : trop tard
  assert.equal(suivable(evt('a', 60, { all_day: true }), maintenant), null) // toute la journée : pas d'heure
})

test('avec qui, et qui est concerné', () => {
  const membres = [{ id: 'moi', display_name: 'Ely' }, { id: 'lea', display_name: 'Léa' }, { id: 'papa', display_name: 'Papa' }, { id: 'noe', display_name: 'Noé' }]
  assert.equal(avecQui({ members: [] }, membres, 'moi'), 'Toute la famille')
  assert.equal(avecQui({ members: ['moi', 'lea'] }, membres, 'moi'), 'Avec Léa')
  assert.equal(avecQui({ members: ['lea', 'papa', 'noe'] }, membres, 'moi'), 'Avec Léa, Papa et Noé')
  assert.equal(avecQui({ members: ['moi'] }, membres, 'moi'), null)
  assert.ok(meConcerne({ members: [] }, 'moi') && meConcerne({ members: ['moi'] }, 'moi') && !meConcerne({ members: ['lea'] }, 'moi'))
})

test('lancée toute seule : le plus proche, dans les 2 heures, qui me concerne, une seule fois', () => {
  const events = [evt('loin', 5 * 60), evt('bientot', 90), evt('plusTot', 30, { members: ['lea'] }), evt('anniv', 20, { kind: 'anniversaire' }), evt('ensuite', 100)]
  const p = prochainASuivre(events, 'moi', [], maintenant)
  assert.equal(p.e.id, 'bientot') // « plusTot » ne me concerne pas, l'anniversaire n'a pas de compte à rebours
  // déjà lancée (ou retirée) pour cette fois-là : on passe à la suivante
  assert.equal(prochainASuivre(events, 'moi', [cleFois('bientot', p.at)], maintenant).e.id, 'ensuite')
  assert.equal(prochainASuivre([evt('loin', 5 * 60)], 'moi', [], maintenant), null)
})

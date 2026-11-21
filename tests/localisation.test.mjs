import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { ilYA, libelle, distance, texteDistance, cadre, ancienne } = await loadTs('src/lib/positions.ts')

test('il y a combien de temps', () => {
  const t = new Date(2026, 10, 21, 18, 0).getTime()
  const avant = (min) => new Date(t - min * 60000).toISOString()
  assert.equal(ilYA(avant(1), t), 'à l’instant')
  assert.equal(ilYA(avant(12), t), 'il y a 12 min')
  assert.equal(ilYA(avant(130), t), 'il y a 2 h')
  assert.equal(ilYA(new Date(2026, 10, 20, 21, 5).toISOString(), t), 'hier à 21:05')
  assert.match(ilYA(new Date(2026, 10, 12, 9, 0).toISOString(), t), /^le 12 nov/)
  assert.ok(ancienne({ updated_at: avant(13 * 60) }, t) && !ancienne({ updated_at: avant(30) }, t))
})

test('le lieu, la distance, le cadre de la carte', () => {
  assert.equal(libelle({ lieu: 'Rue André Lalande', ville: 'Évry' }), 'Rue André Lalande, Évry')
  assert.equal(libelle({ lieu: null, ville: 'Annecy' }), 'Annecy')
  assert.equal(libelle({ lieu: 'Gare d’Annecy', ville: 'Annecy' }), 'Gare d’Annecy')
  assert.equal(libelle({ lieu: null, ville: null }), 'Position partagée')
  // Annecy → Paris : environ 440 km
  const d = distance({ lat: 45.8992, lon: 6.1294 }, { lat: 48.8566, lon: 2.3522 })
  assert.ok(d > 430000 && d < 450000, String(d))
  assert.equal(texteDistance(40), 'tout près')
  assert.equal(texteDistance(320), 'à 300 m')
  assert.equal(texteDistance(2380), 'à 2,4 km')
  assert.equal(texteDistance(35400), 'à 35 km')
  // un seul point : un cadre d'au moins ~1 km autour de lui
  const [[w, s], [e, n]] = cadre([{ lat: 45.9, lon: 6.13 }])
  assert.ok(n - s >= 0.0099 && e - w >= 0.0099)
  assert.equal(cadre([]), null)
})

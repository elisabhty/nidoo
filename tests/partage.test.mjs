import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { DUREES, dureeDe, enCours, finDuree, libelle, prochaineFin, texteJusqua } = await loadTs('src/lib/positions.ts')
const { endroitDe } = await loadTs('src/lib/endroits.ts')

const NB = ' '
const t = new Date(2026, 10, 26, 18, 12).getTime()

test('un partage pour un temps fini ne se voit plus', () => {
  assert.equal(enCours({ jusqua: null }, t), true)
  assert.equal(enCours({}, t), true)
  assert.equal(enCours({ jusqua: new Date(t + 60000).toISOString() }, t), true)
  assert.equal(enCours({ jusqua: new Date(t - 1).toISOString() }, t), false)
})

test('la prochaine fin : la plus proche dans le futur', () => {
  const a = new Date(t + 3600000).toISOString()
  const b = new Date(t + 600000).toISOString()
  assert.equal(prochaineFin([{ jusqua: a }, { jusqua: null }, { jusqua: b }, { jusqua: new Date(t - 5).toISOString() }], t), t + 600000)
  assert.equal(prochaineFin([{ jusqua: null }], t), null)
})

test('pour combien de temps : une heure, ce soir à 23 h 59, toujours', () => {
  assert.deepEqual(DUREES.map((d) => d.cle), ['heure', 'soir', 'toujours'])
  assert.equal(finDuree('toujours', t), null)
  assert.equal(new Date(finDuree('heure', t)).getTime(), t + 3600000)
  const soir = new Date(finDuree('soir', t))
  assert.equal(soir.getHours(), 23)
  assert.equal(soir.getMinutes(), 59)
  // à 23 h 50, « ce soir » laisse quand même une demi-heure
  const tard = new Date(2026, 10, 26, 23, 50).getTime()
  assert.equal(new Date(finDuree('soir', tard)).getTime(), tard + 30 * 60000)
  // et l'on retrouve le bouton allumé
  assert.equal(dureeDe({ jusqua: null }), 'toujours')
  assert.equal(dureeDe({ jusqua: finDuree('soir', t) }), 'soir')
  assert.equal(dureeDe({ jusqua: finDuree('heure', t) }), 'heure')
})

test('« jusqu’à 19 h 12 », et rien pour un partage sans fin', () => {
  assert.equal(texteJusqua({ jusqua: new Date(2026, 10, 26, 19, 12).toISOString() }), `jusqu’à 19${NB}h${NB}12`)
  assert.equal(texteJusqua({ jusqua: null }), '')
})

test('une position approximative : la ville, jamais la rue ni un de nos lieux', () => {
  assert.equal(libelle({ lieu: 'Rue André Lalande', ville: 'Évry', approx: true }), '≈ Évry')
  assert.equal(libelle({ lieu: null, ville: null, approx: true }), '≈ Position approximative')
  assert.equal(libelle({ lieu: 'Rue André Lalande', ville: 'Évry' }), 'Rue André Lalande, Évry')
  const ecole = { id: 'e', family_id: 'f', nom: 'École', adresse: null, lat: 45.9061, lon: 6.1453, rayon_m: 150, created_at: '' }
  assert.equal(endroitDe({ lat: 45.9061, lon: 6.1453, precision_m: 10 }, [ecole])?.nom, 'École')
  assert.equal(endroitDe({ lat: 45.9061, lon: 6.1453, precision_m: 1000, approx: true }, [ecole]), null)
})

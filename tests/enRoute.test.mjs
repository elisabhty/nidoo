import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { arrivee, boutonPrevenir, DELAIS, libelleDelai, messageEnRoute, texteHeure } = await loadTs('src/lib/enRoute.ts')

const NB = ' '

test('l’heure d’arrivée est arrondie aux cinq minutes d’après', () => {
  const t = new Date(2026, 10, 26, 18, 12, 30).getTime()
  assert.equal(texteHeure(arrivee(t, 15)), `18${NB}h${NB}30`)
  // pile sur cinq minutes : on ne repousse pas
  assert.equal(texteHeure(arrivee(new Date(2026, 10, 26, 18, 25).getTime(), 5)), `18${NB}h${NB}30`)
  // on passe l’heure, et minuit
  assert.equal(texteHeure(arrivee(t, 45)), `19${NB}h`)
  assert.equal(texteHeure(arrivee(new Date(2026, 10, 26, 23, 50).getTime(), 20)), `0${NB}h${NB}10`)
})

test('l’heure s’écrit à la française, sans zéro devant les heures', () => {
  assert.equal(texteHeure(new Date(2026, 10, 26, 9, 5)), `9${NB}h${NB}05`)
  assert.equal(texteHeure(new Date(2026, 10, 26, 19, 0)), `19${NB}h`)
})

test('les délais proposés et leur libellé', () => {
  assert.deepEqual(DELAIS.map(libelleDelai), [`5${NB}min`, `10${NB}min`, `15${NB}min`, `20${NB}min`, `30${NB}min`, `45${NB}min`, `1${NB}h`, 'Je ne sais pas'])
  assert.equal(libelleDelai(90), `1${NB}h${NB}30`)
})

test('le petit mot, avec ou sans heure, tient dans les 140 signes', () => {
  const t = new Date(2026, 10, 26, 18, 12).getTime()
  assert.equal(messageEnRoute(15, t), `Je suis en route, j’arrive vers 18${NB}h${NB}30${NB}🚗`)
  assert.equal(messageEnRoute(null, t), `Je suis en route${NB}🚗`)
  for (const d of DELAIS) assert.ok(messageEnRoute(d, t).length <= 140)
})

test('le bouton dit qui on prévient', () => {
  assert.equal(boutonPrevenir(['Papa', 'Léa', 'Mamie Jo'], 3), 'Prévenir mes proches')
  assert.equal(boutonPrevenir(['Papa'], 3), 'Prévenir Papa')
  assert.equal(boutonPrevenir(['Papa'], 1), 'Prévenir Papa')
  assert.equal(boutonPrevenir(['Papa', 'Léa'], 3), 'Prévenir Papa et Léa')
  assert.equal(boutonPrevenir(['Papa', 'Léa', 'Mamie Jo'], 4), 'Prévenir 3 proches')
  assert.equal(boutonPrevenir([], 3), 'Prévenir')
})

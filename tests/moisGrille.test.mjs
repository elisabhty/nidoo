import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { grilleDuMois, decalerMois, moisDe, isoJour } = await loadTs('src/lib/moisGrille.ts')

test('novembre 2026 commence un dimanche et compte 30 jours', () => {
  const g = grilleDuMois(2026, 10)
  assert.equal(g.length, 42)
  assert.deepEqual(g.slice(0, 7), [null, null, null, null, null, null, '2026-11-01'])
  assert.equal(g[7], '2026-11-02') // lundi
  assert.equal(g.filter(Boolean).length, 30)
  assert.equal(g[35], '2026-11-30')
  assert.equal(g[36], null)
})

test('février : 28 jours, 29 les années bissextiles ; un mois qui commence un lundi tient sur la première ligne', () => {
  assert.equal(grilleDuMois(2027, 1).filter(Boolean).length, 28)
  assert.equal(grilleDuMois(2028, 1).filter(Boolean).length, 29)
  assert.equal(grilleDuMois(2027, 1)[0], '2027-02-01') // le 1er février 2027 est un lundi
})

test('le mois d’après décembre est janvier de l’année suivante, sauf pour un anniversaire', () => {
  assert.deepEqual(decalerMois({ a: 2026, m: 11 }, 1), { a: 2027, m: 0 })
  assert.deepEqual(decalerMois({ a: 2026, m: 0 }, -1), { a: 2025, m: 11 })
  assert.deepEqual(decalerMois({ a: 2026, m: 11 }, 1, true), { a: 2026, m: 0 })
  assert.deepEqual(decalerMois({ a: 2026, m: 0 }, -1, true), { a: 2026, m: 11 })
  assert.deepEqual(decalerMois({ a: 2026, m: 5 }, 1), { a: 2026, m: 6 })
})

test('le mois d’une date, et un secours si elle est vide', () => {
  assert.deepEqual(moisDe('2026-11-22'), { a: 2026, m: 10 })
  assert.deepEqual(moisDe('', new Date(2027, 2, 9)), { a: 2027, m: 2 })
  assert.equal(isoJour(2026, 0, 5), '2026-01-05')
})

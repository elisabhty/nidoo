import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { paques, joursSpeciaux, prochainsJoursSpeciaux, estFerie } = await loadTs('src/lib/joursSpeciaux.ts')

const jj = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const de = (an, nom) => jj(joursSpeciaux(an).find((j) => j.nom === nom).date)

test('Pâques et les fêtes mobiles', () => {
  assert.equal(jj(paques(2026)), '2026-04-05')
  assert.equal(jj(paques(2027)), '2027-03-28')
  assert.equal(de(2027, 'Ascension'), '2027-05-06')
  assert.equal(de(2027, 'Lundi de Pentecôte'), '2027-05-17')
  assert.equal(de(2027, 'Fête des mères'), '2027-05-30')
  assert.equal(de(2027, 'Fête des pères'), '2027-06-20')
  // quand le dernier dimanche de mai est la Pentecôte (2004), la fête des mères passe au premier dimanche de juin
  assert.equal(de(2004, 'Fête des mères'), '2004-06-06')
})

test('Épiphanie : le premier dimanche de janvier', () => {
  assert.equal(de(2027, 'Épiphanie'), '2027-01-03')
  assert.equal(de(2023, 'Épiphanie'), '2023-01-08')
  assert.equal(de(2028, 'Épiphanie'), '2028-01-02')
})

test('les deux mois qui viennent, sans aujourd’hui ni demain', () => {
  const n = prochainsJoursSpeciaux(new Date(2026, 10, 21, 10)).map((j) => j.nom)
  assert.deepEqual(n, ['Réveillon de Noël', 'Noël', 'Saint-Sylvestre', 'Jour de l’an', 'Épiphanie'])
  const juin = prochainsJoursSpeciaux(new Date(2027, 5, 17, 10)).map((j) => j.nom)
  assert.equal(juin[0], 'Fête des pères')
  assert.ok(juin.includes('Fête de la musique'))
  assert.ok(estFerie(new Date(2026, 11, 25)))
  assert.ok(!estFerie(new Date(2026, 11, 24)))
})

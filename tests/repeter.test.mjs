import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { nextOccurrence, occursOn, rythme, repeteDe } = await loadTs('src/lib/util.ts')

const jj = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ev = (debut, repete, plus = {}) => ({ starts_at: new Date(`${debut}T18:00`).toISOString(), yearly: repete === 'annee', weekly: repete === 'semaine', repete, ...plus })
const le = (j) => new Date(`${j}T10:00`)

test('les anciens événements gardent leur rythme', () => {
  assert.equal(repeteDe({ starts_at: '', yearly: true }), 'annee')
  assert.equal(repeteDe({ starts_at: '', yearly: false, weekly: true }), 'semaine')
  assert.equal(repeteDe({ starts_at: '', yearly: false }), null)
})

test('chaque jour, chaque semaine, une semaine sur deux', () => {
  assert.equal(jj(nextOccurrence(ev('2026-11-02', 'jour'), false, le('2026-11-21'))), '2026-11-21')
  assert.equal(jj(nextOccurrence(ev('2026-11-02', 'semaine'), false, le('2026-11-21'))), '2026-11-23') // un lundi
  assert.equal(jj(nextOccurrence(ev('2026-11-02', '2semaines'), false, le('2026-11-21'))), '2026-11-30')
  assert.equal(jj(nextOccurrence(ev('2026-11-02', '2semaines'), false, le('2026-11-16'))), '2026-11-16')
  assert.ok(occursOn(ev('2026-11-02', '2semaines'), le('2026-11-16')))
  assert.equal(occursOn(ev('2026-11-02', '2semaines'), le('2026-11-23')), null)
  // pas avant le premier jour
  assert.equal(jj(nextOccurrence(ev('2026-12-10', 'jour'), false, le('2026-11-21'))), '2026-12-10')
  assert.equal(occursOn(ev('2026-12-10', 'jour'), le('2026-11-21')), null)
})

test('chaque mois, le même jour (le 31 tombe le dernier jour des mois courts)', () => {
  assert.equal(jj(nextOccurrence(ev('2026-09-05', 'mois'), false, le('2026-11-21'))), '2026-12-05')
  assert.equal(jj(nextOccurrence(ev('2026-09-25', 'mois'), false, le('2026-11-21'))), '2026-11-25')
  assert.equal(jj(nextOccurrence(ev('2026-01-31', 'mois'), false, le('2027-02-10'))), '2027-02-28')
  assert.ok(occursOn(ev('2026-09-05', 'mois'), le('2027-03-05')))
  assert.equal(occursOn(ev('2026-09-05', 'mois'), le('2027-03-06')), null)
})

test('la petite phrase du rythme', () => {
  assert.equal(rythme(ev('2026-11-02', 'jour'), le('2026-11-21')), 'Tous les jours')
  assert.equal(rythme(ev('2026-11-02', 'semaine'), le('2026-11-23')), 'Tous les lundis')
  assert.equal(rythme(ev('2026-11-02', '2semaines'), le('2026-11-30')), 'Un lundi sur deux')
  assert.equal(rythme(ev('2026-11-01', 'mois'), le('2026-12-01')), 'Tous les mois, le 1er')
  assert.equal(rythme(ev('2026-11-14', 'mois'), le('2026-12-14')), 'Tous les mois, le 14')
})

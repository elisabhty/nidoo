import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { figurinePour, cheveuxPossibles } = await loadTs('src/lib/presentation.ts')

// un petit échantillon des figurines (même forme que PERSOS) et de leurs autres peaux
const FIG = [
  { id: 'f01', g: 'femme', a: 0, t: 0, c: 'blond' },
  { id: 'f05', g: 'femme', a: 0, t: 3, c: 'noir' },
  { id: 'f04', g: 'femme', a: 0, t: 2, c: 'voile' },
  { id: 'gf1', g: 'femme', a: 0, t: 0, c: 'gris', l: true, s: true },
  { id: 'h02', g: 'homme', a: 0, t: 1, c: 'brun', b: true },
  { id: 'h05', g: 'homme', a: 0, t: 4, c: 'chauve', b: true },
  { id: 'gm1', g: 'homme', a: 0, t: 0, c: 'gris', l: true, s: true },
  { id: 'fa1', g: 'fille', a: 1, t: 1, c: 'brun', l: true },
  { id: 'fi1', g: 'fille', a: 2, t: 0, c: 'blond' },
  { id: 'gi1', g: 'garcon', a: 2, t: 0, c: 'blond' },
  { id: 'ga1', g: 'garcon', a: 1, t: 1, c: 'roux' },
  { id: 'b1', g: 'bebe', a: 3, t: 0, c: 'blond' },
]
const PEAUX = { f01: [{ t: 6, b: 4 }], gf1: [{ t: 5, b: 4 }] }
const id = (r) => FIG[r.k - 1].id
const sansHasard = () => 0

test('une femme de 60 ans et plus : une mamie', () => {
  assert.equal(id(figurinePour({ genre: 'femme', age: 'senior' }, FIG, PEAUX, sansHasard)), 'gf1')
})
test('un homme de 35 ans, chauve : la bonne figurine', () => {
  assert.equal(id(figurinePour({ genre: 'homme', age: 'adulte', cheveux: 'chauve' }, FIG, PEAUX, sansHasard)), 'h05')
})
test('un garçon de 9 ans : un enfant, pas un ado', () => {
  const r = figurinePour({ genre: 'homme', age: 'enfant' }, FIG, PEAUX, sansHasard)
  assert.equal(id(r), 'gi1')
  assert.equal(r.a, 2)
})
test('une ado aux cheveux bruns avec des lunettes', () => {
  assert.equal(id(figurinePour({ genre: 'femme', age: 'ado', cheveux: 'brun', lunettes: true }, FIG, PEAUX, sansHasard)), 'fa1')
})
test('la peau très foncée : la figurine blonde garde ses traits, avec son autre peau', () => {
  const r = figurinePour({ genre: 'femme', age: 'jeune', cheveux: 'blond', teint: 4 }, FIG, PEAUX, sansHasard)
  assert.equal(id(r), 'f01')
  assert.equal(r.q, 6)
})
test('pas de garçon roux de cet âge : on reteint les cheveux d’un autre', () => {
  const r = figurinePour({ genre: 'homme', age: 'enfant', cheveux: 'roux' }, FIG, PEAUX, sansHasard)
  assert.equal(id(r), 'gi1')
  assert.equal(r.x, 6)
})
test('les cheveux de la figurine quand ils vont déjà', () => {
  assert.equal(figurinePour({ genre: 'homme', age: 'ado', cheveux: 'roux' }, FIG, PEAUX, sansHasard).x, 0)
})
test('le voile', () => {
  assert.equal(id(figurinePour({ genre: 'femme', age: 'adulte', cheveux: 'voile' }, FIG, PEAUX, sansHasard)), 'f04')
})
test('jamais un bébé, et sans réponse on propose quand même quelqu’un', () => {
  assert.notEqual(id(figurinePour({}, FIG, PEAUX, sansHasard)), 'b1')
})
test('pas de cheveux gris à 10 ans, pas de voile pour un homme', () => {
  assert.ok(!cheveuxPossibles({ age: 'enfant' }).some((c) => c.key === 'gris'))
  assert.ok(!cheveuxPossibles({ genre: 'homme' }).some((c) => c.key === 'voile'))
})

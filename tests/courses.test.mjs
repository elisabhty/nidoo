import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { comprendre, lireArticle, ecrireArticle, nombre, rayonDe, pourAllerAvec } = await loadTs('src/lib/courses.ts')

test('comprend la quantité tapée, devant ou derrière', () => {
  assert.deepEqual(comprendre('2 lait'), { nom: 'Lait', qte: '2' })
  assert.deepEqual(comprendre('500g de farine'), { nom: 'Farine', qte: '500 g' })
  assert.deepEqual(comprendre('œufs x6'), { nom: 'Œufs', qte: '6' })
  assert.deepEqual(comprendre('pommes 1 kg'), { nom: 'Pommes', qte: '1 kg' })
  assert.deepEqual(comprendre('3 bouteilles d’eau'), { nom: 'Eau', qte: '3 bouteilles' })
  assert.deepEqual(comprendre('pain'), { nom: 'Pain', qte: '' })
  assert.deepEqual(comprendre('Lait · 2'), { nom: 'Lait', qte: '2' })
})

test('écrit et relit un article, sans « · 1 »', () => {
  assert.equal(ecrireArticle({ nom: 'Lait', qte: '2' }), 'Lait · 2')
  assert.equal(ecrireArticle({ nom: 'Lait', qte: '1' }), 'Lait')
  assert.deepEqual(lireArticle('Farine · 500 g'), { nom: 'Farine', qte: '500 g' })
  assert.equal(nombre(''), 1)
  assert.equal(nombre('3'), 3)
  assert.equal(nombre('500 g'), null)
})

test('range chaque article dans son rayon', () => {
  assert.equal(rayonDe('Baguette').key, 'boulangerie')
  assert.equal(rayonDe('Lait').key, 'cremerie')
  assert.equal(rayonDe('Laitue').key, 'fruits')
  assert.equal(rayonDe('Lait d’avoine').key, 'boissons')
  assert.equal(rayonDe('Pâtes').key, 'epicerie')
  assert.equal(rayonDe('Papier toilette').key, 'maison')
  assert.equal(rayonDe('Truc bizarre').key, 'autres')
  assert.equal(rayonDe('Sauce tomate').key, 'epicerie')
  assert.equal(rayonDe('Tomates').key, 'fruits')
})

test('propose ce qui va avec, pas ce qui est déjà là', () => {
  const r = pourAllerAvec(['Pâtes', 'Parmesan'])
  assert.equal(r[0].avec, 'Pâtes')
  assert.deepEqual(r[0].idees, ['Sauce tomate'])
  assert.deepEqual(pourAllerAvec(['Farine et œufs'])[0].idees, ['Lait', 'Sucre'])
})

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { LES_RECETTES, lignesDe, portionsFamille, recetteDe, recettesAvec, recettesDuMoment } = await loadTs('src/lib/recettes.ts')
const { fiche } = await loadTs('src/lib/courses.ts')
const r = (id) => LES_RECETTES.find((x) => x.id === id)
const ligne = (res, nom) => res.lignes.find((l) => l.nom === nom)

test('61 recettes et 6 listes, chaque ingrédient connu du référentiel', () => {
  assert.equal(LES_RECETTES.filter((x) => x.cat !== 'liste').length, 61)
  assert.equal(LES_RECETTES.filter((x) => x.cat === 'liste').length, 6)
  for (const x of LES_RECETTES) for (const i of x.ingredients) assert.ok(fiche(i.nom), `${x.nom} : ${i.nom}`)
})

test('la bolognaise de la recherche : 2 adultes et 2 enfants', () => {
  const fam = portionsFamille([0, 0, 2, 2])
  assert.deepEqual(fam, { personnes: 4, parts: 3.2 })
  const res = lignesDe(r('Q01'), 4, fam.parts / fam.personnes)
  assert.equal(ligne(res, 'Spaghetti').besoin, '350 g')
  assert.equal(ligne(res, 'Spaghetti').achat, '1 paquet de 500 g')
  assert.equal(ligne(res, 'Viande hachée').qte, '350 g')
  assert.equal(ligne(res, 'Tomates concassées').achat, '1 boîte de 400 g')
  assert.equal(ligne(res, 'Sel').coche, false)
})

test('raclette pour 4, quiche pour 7, burgers, crêpes', () => {
  const rac = lignesDe(r('W08'), 4)
  assert.equal(ligne(rac, 'Fromage à raclette').qte, '800 g')
  assert.equal(ligne(rac, 'Pommes de terre').qte, '1 kg')
  const q = lignesDe(r('Q05'), 7)
  assert.equal(q.plats, 1)
  assert.equal(ligne(q, 'Œufs').qte, '6')
  assert.equal(ligne(q, 'Lait').coche, false)
  assert.equal(lignesDe(r('Q05'), 13).plats, 2)
  const b = lignesDe(r('Q23'), 4)
  assert.equal(ligne(b, 'Steak haché').qte, '4')
  assert.equal(ligne(b, 'Pains burger').achat, '1 sachet de 4')
  const c = lignesDe(r('Q02'), 4)
  assert.equal(ligne(c, 'Œufs').coche, false)
  assert.equal(ligne(c, 'Crème fraîche').achat, '1 pot de 20 cl')
})

test('trouver une recette', () => {
  assert.equal(recetteDe('soirée raclette').id, 'W08')
  assert.equal(recetteDe('bolo').id, 'Q01')
  assert.equal(recetteDe('pâtes'), null)
  assert.equal(recettesAvec(['Pâtes', 'Lardons'])[0].recette.id, 'Q02')
  assert.ok(recettesDuMoment(new Date(2026, 10, 21)).some((x) => x.id === 'W08'))
})

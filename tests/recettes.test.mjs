import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { LES_RECETTES, PAYS, REGIONS, chercherRecettes, recettesDuMonde, lignesDe, occasionsAVenir, occasionProche, portionsFamille, recetteDe, recettesAvec, recettesDe, recettesDuMoment } = await loadTs('src/lib/recettes.ts')
const { estVague, fiche, iconeDe, pourAllerAvec, precisions, souvent } = await loadTs('src/lib/courses.ts')
const r = (id) => LES_RECETTES.find((x) => x.id === id)
const ligne = (res, nom) => res.lignes.find((l) => l.nom === nom)

test('159 recettes et 6 listes, chaque ingrédient connu du référentiel, aucun nom vague', () => {
  assert.equal(LES_RECETTES.filter((x) => x.cat !== 'liste').length, 159)
  assert.equal(new Set(LES_RECETTES.map((x) => x.id)).size, LES_RECETTES.length)
  for (const x of LES_RECETTES) for (const i of x.ingredients) assert.ok(!estVague(i.nom), `${x.nom} : ${i.nom} est trop vague`)
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
  assert.ok(recettesDuMoment(new Date(2026, 10, 21), 10).some((x) => x.id === 'W08'))
})

test('par occasion : Noël, Nouvel An, Épiphanie, rangés entrées, plats, desserts', () => {
  const noel = recettesDe('noel')
  assert.ok(noel.length >= 10)
  assert.ok(noel.some((x) => x.id === 'F01') && noel.some((x) => x.id === 'D14') && noel.some((x) => x.id === 'E01'))
  const rang = (x) => (x.cat === 'entree' ? 0 : x.cat === 'dessert' ? 2 : 1)
  assert.deepEqual(noel.map(rang), [...noel.map(rang)].sort())
  assert.ok(recettesDe('epiphanie').some((x) => x.id === 'D12'))
  assert.ok(recettesDe('nouvelan').length >= 8)
  for (const o of ['chandeleur', 'saintvalentin', 'mardigras', 'paques', 'parents', 'halloween', 'anniversaire']) assert.ok(recettesDe(o).length >= 3, o)
  // le 21 novembre 2026 : Noël d'abord (dans 33 jours, le réveillon), puis le Nouvel An, l'Épiphanie (3 janvier 2027)
  const a = occasionsAVenir(new Date(2026, 10, 21, 10))
  assert.deepEqual(a.slice(0, 3).map((o) => o.key), ['noel', 'nouvelan', 'epiphanie'])
  assert.equal(a[0].dans, 33)
  assert.equal(a[a.length - 1].key, 'anniversaire')
  assert.equal(occasionProche(new Date(2026, 10, 21, 10)).key, 'noel')
  assert.equal(occasionProche(new Date(2026, 8, 1, 10)), null)
})

test('jamais « Légumes » : on précise (de saison), et chaque suggestion a sa vraie icône', () => {
  assert.ok(estVague('Légumes') && estVague('fruits') && estVague('Viande') && !estVague('Carottes'))
  assert.deepEqual(precisions('légumes', 1).slice(0, 4), ['Carottes', 'Avocats', 'Poireaux', 'Endives'])
  assert.ok(precisions('fruits', 7).includes('Pêches'))
  for (const n of [1, 4, 7, 10]) for (const k of ['légumes', 'fruits']) for (const x of precisions(k, n)) assert.ok(fiche(x), x)
  assert.equal(iconeDe('Pommes de terre'), 'pomme-de-terre')
  assert.equal(iconeDe('Pommes'), 'pomme')
  assert.equal(iconeDe('Choux de Bruxelles'), 'choux-bruxelles')
  assert.equal(iconeDe('Pain d’épices'), null)
  assert.equal(iconeDe('Jus d’orange'), 'jus-orange')
  assert.equal(iconeDe('Essuie-tout'), 'essuie-tout')
  assert.equal(iconeDe('Mouchoirs'), 'mouchoirs')
  assert.equal(iconeDe('Papier toilette'), 'papier-toilette')
  assert.ok(!souvent('famille-test', [], []).some((x) => estVague(x)))
})

test('aucune suggestion générale (Elisa, 21 novembre : « mes avocats, mes carottes, mais pas légumes »)', () => {
  for (const x of ['Légumes', 'Légumes verts', 'Fruits de saison', 'Viande', 'Poisson', 'Fromage', 'Charcuterie', 'Boissons', 'Surgelés', 'Légumes surgelés', 'Conserves', 'Desserts', 'Laitages', 'Produits laitiers', 'Féculents', 'Crudités'])
    assert.ok(estVague(x), x)
  for (const x of ['Carottes', 'Avocats', 'Fruits rouges', 'Bouillon de légumes', 'Fromage râpé', 'Poisson pané', 'Crème dessert', 'Jus d’orange'])
    assert.ok(!estVague(x), x)
  // ce qu'on propose à la place : du concret, connu du référentiel, au moins trois vraies icônes différentes
  for (const k of ['légumes', 'fruits', 'viande', 'poisson', 'fromage', 'charcuterie', 'boissons', 'surgelés', 'légumes surgelés', 'conserves', 'desserts', 'laitages', 'féculents', 'crudités'])
    for (const n of [1, 4, 7, 11]) {
      const p = precisions(k, n)
      for (const x of p) assert.ok(fiche(x) && !estVague(x), `${k} : ${x}`)
      assert.ok(new Set(p.map(iconeDe).filter(Boolean)).size >= 3, k)
    }
  // « pour aller avec » : jamais un mot général non plus
  const liste = ['Pain', 'Baguette', 'Fromage à raclette', 'Cornichons', 'Citron', 'Madeleines', 'Pâtes', 'Riz', 'Poulet', 'Yaourt nature', 'Lait']
  for (const g of pourAllerAvec(liste, 20)) for (const x of g.idees) assert.ok(!estVague(x), `${g.avec} : ${x}`)
  assert.ok(precisions('légumes', 11).includes('Avocats'))
})

test('du monde : chaque région, ses pays, les plats que tout le monde connaît', () => {
  for (const r of REGIONS) {
    const g = recettesDuMonde(r.key)
    assert.ok(g.length >= 2, r.key)
    for (const x of g) assert.ok(PAYS[x.pays], x.pays)
  }
  const tous = REGIONS.flatMap((r) => recettesDuMonde(r.key).flatMap((g) => g.recettes.map((x) => x.id)))
  assert.equal(new Set(tous).size, tous.length, 'une recette dans un seul pays de sa région')
  for (const mot of ['yassa', 'mafe', 'thieboudienne', 'tchep', 'attieke', 'moambe', 'pondu', 'harira', 'pastilla', 'chorba', 'bourek', 'brick', 'carbonnade', 'waterzooi', 'currywurst', 'fish and chips', 'empanadas', 'feijoada', 'nems', 'bo bun', 'pad thai', 'couscous', 'paella', 'fajitas'])
    assert.ok(recetteDe(mot), mot)
  assert.equal(recetteDe('fajitas').id, 'MX1')
  for (const x of LES_RECETTES) for (const p of x.pays) assert.ok(PAYS[p], `${x.nom} : ${p}`)
})

test('tout le monde compte, les tout-petits pour une petite part', () => {
  assert.deepEqual(portionsFamille([0, 3]), { personnes: 2, parts: 1.3 })
  assert.deepEqual(portionsFamille([0, 0, 0]), { personnes: 3, parts: 3 })
})

test('les farcis : tomates, poivrons, courgettes, chou, petits farcis, dinde farcie (Elisa, 21 novembre)', () => {
  const noms = chercherRecettes('farci').map((x) => x.nom)
  for (const n of ['Tomates farcies', 'Poivrons farcis au bœuf', 'Courgettes farcies', 'Chou farci', 'Petits farcis niçois', 'Dinde farcie aux marrons', 'Dinde farcie aux pommes']) assert.ok(noms.includes(n), n)
  assert.equal(chercherRecettes('dinde farcie')[0].id, 'F07')
  assert.ok(r('F07').occasions.includes('noel') && r('F14').occasions.includes('noel'))
  // la farce porc + bœuf des tomates farcies pour 4
  const tom = lignesDe(r('Q42'), 4)
  assert.equal(ligne(tom, 'Chair à saucisse').besoin, '300 g')
  assert.equal(ligne(tom, 'Viande hachée').besoin, '200 g')
  assert.equal(ligne(tom, 'Tomates').besoin, '8 pièces')
  // une dinde entière pour 8, la farce à la chair à saucisse et aux marrons
  const dinde = lignesDe(r('F07'), 8)
  assert.equal(ligne(dinde, 'Chair à saucisse').besoin, '400 g')
  assert.equal(ligne(dinde, 'Marrons').achat, '2 × bocal de 400 g')
  assert.equal(ligne(lignesDe(r('F14'), 8), 'Cidre').achat, '1 bouteille')
})

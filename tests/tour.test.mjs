import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { Monde, lacher, hauteurDeDepart, SOCLE, FORMES, coupDuPanda } = await loadTs('src/lib/tour.ts')

const empiler = (ks, dx = () => 0) => {
  let tour = []
  for (let i = 0; i < ks.length; i++) {
    const r = lacher(tour, { k: ks[i], x: dx(i), y: hauteurDeDepart(new Monde(tour).sommet()), a: 0 })
    if (r.tombe) return { tour: r.pieces, tombe: i }
    tour = r.pieces
  }
  return { tour, tombe: -1 }
}

test('une colonne de carrés bien posés tient debout', () => {
  const { tour, tombe } = empiler(Array(10).fill(0))
  assert.equal(tombe, -1)
  assert.equal(tour.length, 10)
  // dix carrés de 46 : environ 460 de haut
  assert.ok(new Monde(tour).sommet() < -430)
})

test('des briques croisées tiennent aussi', () => {
  const { tombe } = empiler(Array(8).fill(1), (i) => (i % 2 ? 8 : -8))
  assert.equal(tombe, -1)
})

test('une pièce lâchée à côté du socle tombe', () => {
  const r = lacher([], { k: 1, x: SOCLE.largeur / 2 + 40, y: -150, a: 0 })
  assert.equal(r.tombe, true)
})

test('une tour posée ne bouge pas toute seule', () => {
  const { tour } = empiler([0, 1, 5, 0])
  const m = new Monde(tour)
  for (let i = 0; i < 120; i++) m.pas()
  const apres = m.etat()
  assert.ok(apres.every((p, i) => Math.hypot(p.x - tour[i].x, p.y - tour[i].y) < 0.01))
})

test('chaque forme a ses couleurs et un nom', () => {
  for (const f of FORMES) {
    assert.ok(f.pts.length >= 3 && f.nom && /^#/.test(f.couleur) && /^#/.test(f.fonce))
  }
  // la base tire la forme suivante parmi 9 (floor(random() * 9))
  assert.equal(FORMES.length, 9)
})

test('le panda pose sa pièce sans faire tomber une tour bien droite', () => {
  const { tour } = empiler([0, 1, 0])
  const coup = coupDuPanda(tour, 5, () => 0.5)
  assert.equal(coup.k, 5)
  assert.equal(lacher(tour, coup).tombe, false)
})

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { loadTs } from './loadTs.mjs'
const { avantLesNoms, coucheBatiments } = await loadTs('src/lib/relief.ts')

// le fond de carte de l'appli (scripts/carte/style_nidoo.py → public/carte/nidoo.json)
const style = JSON.parse(readFileSync(new URL('../public/carte/nidoo.json', import.meta.url), 'utf8'))

test('le fond de carte est un style MapLibre valide', () => {
  assert.deepEqual(validateStyleMin(style).map((e) => e.message), [])
})

test('il ne parle qu’à OpenFreeMap (aucun serveur d’essai oublié dedans)', () => {
  const adresses = JSON.stringify(style).match(/https?:\/\/[^"]+/g) ?? []
  assert.ok(adresses.length > 0)
  for (const a of adresses) assert.match(a, /^https:\/\/tiles\.openfreemap\.org\//, a)
  assert.equal(style.sources.openmaptiles.url, 'https://tiles.openfreemap.org/planet')
})

test('les bâtiments en relief de l’appli s’y posent, sous les noms (et un seul relief)', () => {
  const b = coucheBatiments('openmaptiles')
  assert.equal(style.sources[b.source].type, 'vector')
  assert.ok(!style.layers.some((l) => l.type === 'fill-extrusion'), 'le fond a déjà ses bâtiments 3D')
  assert.ok(!style.layers.some((l) => l.id === 'building-top'), 'le faux relief du fond (toits décalés) est resté')
  const avant = avantLesNoms(style.layers)
  assert.ok(avant, 'pas de noms de rues')
  const i = style.layers.findIndex((l) => l.id === avant)
  assert.ok(style.layers.slice(i).every((l) => l.type === 'symbol'), 'des rues ou des bâtiments à plat seraient peints sur le relief')
  const avecLes3D = { ...style, layers: [...style.layers.slice(0, i), b, ...style.layers.slice(i)] }
  assert.deepEqual(validateStyleMin(avecLes3D).map((e) => e.message), [])
})

test('le relief se glisse avant le dernier bloc de noms, pas avant les flèches au milieu des rues', () => {
  const c = (id, type) => ({ id, type })
  assert.equal(avantLesNoms([c('fond', 'background'), c('rues', 'line'), c('fleches', 'symbol'), c('ponts', 'line'), c('bati', 'fill'), c('noms', 'symbol'), c('villes', 'symbol')]), 'noms')
  assert.equal(avantLesNoms([c('fond', 'background'), c('bati', 'fill')]), undefined, 'pas de noms : tout en haut')
  assert.equal(avantLesNoms([]), undefined)
})

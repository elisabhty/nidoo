import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { loadTs } from './loadTs.mjs'
const { coucheBatiments } = await loadTs('src/lib/relief.ts')

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

test('les bâtiments en relief de l’appli s’y posent, sous les noms (et une seule couche 3D)', () => {
  const b = coucheBatiments('openmaptiles')
  assert.equal(style.sources[b.source].type, 'vector')
  assert.ok(!style.layers.some((l) => l.type === 'fill-extrusion'), 'le style a déjà ses bâtiments 3D')
  assert.ok(style.layers.some((l) => l.type === 'symbol'), 'pas de noms de rues')
  const avecLes3D = { ...style, layers: [...style.layers, b] }
  assert.deepEqual(validateStyleMin(avecLes3D).map((e) => e.message), [])
})

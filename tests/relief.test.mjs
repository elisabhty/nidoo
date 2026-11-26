import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { cadrer, coucheBatiments, PENTE } = await loadTs('src/lib/relief.ts')

/**
 * Une carte d'essai : une caméra à sténopé comme celle de MapLibre (champ de 36,87°, distance au centre de 1,5 fois
 * la hauteur), au-dessus d'un sol plat en mètres. Le zoom double l'échelle ; l'orientation tourne le sol.
 */
function fausseCarte(w, h) {
  let v = { lon: 6.13, lat: 45.9, zoom: 14, pitch: 0, bearing: 0 }
  const D = 1.5 * h
  const mLat = 111195
  const mLon = () => mLat * Math.cos((v.lat * Math.PI) / 180)
  const px = () => 2 ** (v.zoom - 14) * 0.25 // pixels par mètre
  const rad = (x) => (x * Math.PI) / 180
  return {
    taille: () => ({ w, h }),
    lire: () => ({ ...v }),
    poser: (n) => {
      v = { ...v, ...Object.fromEntries(Object.entries(n).filter(([, x]) => x !== undefined)) }
    },
    projeter(lon, lat) {
      let dx = (lon - v.lon) * mLon()
      let dy = (lat - v.lat) * mLat
      const b = rad(v.bearing)
      ;[dx, dy] = [dx * Math.cos(b) - dy * Math.sin(b), dx * Math.sin(b) + dy * Math.cos(b)]
      const X = dx * px()
      const Y = dy * px()
      const p = rad(v.pitch)
      const prof = D + Y * Math.sin(p)
      return { x: w / 2 + (X * D) / prof, y: h / 2 - (Y * Math.cos(p) * D) / prof }
    },
    deprojeter(x, y) {
      const p = rad(v.pitch)
      const k = (h / 2 - y) / D
      const Y = (k * D) / (Math.cos(p) - k * Math.sin(p))
      const X = ((x - w / 2) * (D + Y * Math.sin(p))) / D
      let dx = X / px()
      let dy = Y / px()
      const b = -rad(v.bearing)
      ;[dx, dy] = [dx * Math.cos(b) - dy * Math.sin(b), dx * Math.sin(b) + dy * Math.cos(b)]
      return { lon: v.lon + dx / mLon(), lat: v.lat + dy / mLat }
    },
  }
}

const MARGES = { top: 84, bottom: 28, left: 44, right: 44 }
// la famille de la démo, à Annecy
const FAMILLE = [
  { lat: 45.9029, lon: 6.1269 },
  { lat: 45.9061, lon: 6.1453 },
  { lat: 45.9135, lon: 6.13 },
  { lat: 45.8993, lon: 6.1244 },
]
const depart = { lon: 6.13, lat: 45.905, zoom: 13 }

/** Tous les points dans la place laissée par les marges, et au moins un bord touché (pas de place perdue). */
function verifie(carte, vue, points, nom) {
  carte.poser(vue)
  const { w, h } = carte.taille()
  const e = points.map((p) => carte.projeter(p.lon, p.lat))
  for (const q of e) {
    assert.ok(q.x >= MARGES.left - 1 && q.x <= w - MARGES.right + 1, `${nom} : un point sort sur le côté (${q.x.toFixed(1)})`)
    assert.ok(q.y >= MARGES.top - 1 && q.y <= h - MARGES.bottom + 1, `${nom} : un point sort en haut ou en bas (${q.y.toFixed(1)})`)
  }
  const larg = (Math.max(...e.map((q) => q.x)) - Math.min(...e.map((q) => q.x))) / (w - MARGES.left - MARGES.right)
  const haut = (Math.max(...e.map((q) => q.y)) - Math.min(...e.map((q) => q.y))) / (h - MARGES.top - MARGES.bottom)
  assert.ok(Math.max(larg, haut) > 0.98, `${nom} : la famille ne remplit pas la carte (${larg.toFixed(2)} × ${haut.toFixed(2)})`)
}

test('à plat comme en 3D, toute la famille tient dans la carte, sans place perdue', () => {
  for (const pitch of [0, 30, PENTE, 60]) {
    const carte = fausseCarte(349, 300)
    const vue = cadrer(carte, FAMILLE, { depart, pitch, marges: MARGES, maxZoom: 15.5 })
    assert.ok(vue, `pas de vue à ${pitch}°`)
    assert.equal(vue.pitch, pitch)
    verifie(carte, vue, FAMILLE, `inclinée à ${pitch}°`)
  }
})

test('la carte tournée, et une famille alignée d’est en ouest ou du nord au sud', () => {
  const ligneEO = [{ lat: 45.9, lon: 6.1 }, { lat: 45.9, lon: 6.16 }]
  const ligneNS = [{ lat: 45.88, lon: 6.13 }, { lat: 45.93, lon: 6.13 }]
  for (const [nom, pts, bearing] of [['tournée', FAMILLE, -35], ['est-ouest', ligneEO, 0], ['nord-sud', ligneNS, 0], ['nord-sud tournée', ligneNS, 70]]) {
    const carte = fausseCarte(349, 300)
    carte.poser({ bearing })
    const vue = cadrer(carte, pts, { depart, pitch: PENTE, marges: MARGES, maxZoom: 15.5 })
    assert.equal(vue.bearing, bearing, `${nom} : l'orientation a changé`)
    verifie(carte, vue, pts, nom)
  }
})

test('une personne seule, ou des proches tout près : au milieu de la place, au zoom le plus serré permis', () => {
  for (const pts of [[{ lat: 45.9029, lon: 6.1269 }], [{ lat: 45.9029, lon: 6.1269 }, { lat: 45.9031, lon: 6.1272 }, { lat: 45.9027, lon: 6.1266 }]]) {
    const carte = fausseCarte(349, 300)
    const vue = cadrer(carte, pts, { depart, pitch: PENTE, marges: MARGES, maxZoom: 15.6 })
    assert.equal(vue.zoom, 15.6)
    carte.poser(vue)
    const e = pts.map((p) => carte.projeter(p.lon, p.lat))
    const mx = (Math.min(...e.map((q) => q.x)) + Math.max(...e.map((q) => q.x))) / 2
    const my = (Math.min(...e.map((q) => q.y)) + Math.max(...e.map((q) => q.y))) / 2
    assert.ok(Math.abs(mx - (MARGES.left + 349 - MARGES.right) / 2) < 1, `pas au milieu en largeur (${mx})`)
    assert.ok(Math.abs(my - (MARGES.top + 300 - MARGES.bottom) / 2) < 1, `pas au milieu en hauteur (${my})`)
  }
})

test('la carte n’a pas bougé : c’est à elle d’aller à la vue trouvée', () => {
  const carte = fausseCarte(349, 300)
  carte.poser({ lon: 2.35, lat: 48.85, zoom: 11, pitch: 20, bearing: 10 })
  const avant = carte.lire()
  cadrer(carte, FAMILLE, { depart, pitch: PENTE, marges: MARGES, maxZoom: 15.5 })
  assert.deepEqual(carte.lire(), avant)
  assert.equal(cadrer(carte, [], { depart, pitch: PENTE, marges: MARGES, maxZoom: 15.5 }), null)
  assert.equal(cadrer(fausseCarte(80, 100), FAMILLE, { depart, pitch: PENTE, marges: MARGES, maxZoom: 15.5 }), null, 'pas la place')
  assert.deepEqual(carte.lire(), avant)
})

test('les bâtiments en relief : la couche des tuiles OpenFreeMap, à partir du zoom 14', () => {
  const c = coucheBatiments('openmaptiles')
  assert.equal(c.type, 'fill-extrusion')
  assert.equal(c.source, 'openmaptiles')
  assert.equal(c['source-layer'], 'building')
  assert.equal(c.minzoom, 14)
  assert.deepEqual(c.filter, ['!', ['has', 'hide_3d']])
  assert.match(JSON.stringify(c.paint['fill-extrusion-height']), /render_height/)
})

test('loin les uns des autres, sur une carte basse, inclinée au maximum : en quelques essais', () => {
  const loin = [{ lat: 45.9, lon: 6.13 }, { lat: 45.76, lon: 4.84 }, { lat: 46.2, lon: 6.15 }] // Annecy, Lyon, Genève
  for (const [w, h, pitch] of [[349, 200, 60], [349, 300, PENTE], [700, 300, 45]]) {
    const carte = fausseCarte(w, h)
    let poses = 0
    const compte = { ...carte, poser: (v) => { poses++; carte.poser(v) } }
    const vue = cadrer(compte, loin, { depart, pitch, marges: MARGES, maxZoom: 15.5 })
    assert.ok(vue, `${w}×${h} à ${pitch}° : pas de vue`)
    assert.ok(poses < 50, `${poses} essais`)
    verifie(carte, vue, loin, `${w}×${h} à ${pitch}°`)
  }
})

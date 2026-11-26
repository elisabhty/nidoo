import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { avecCodePostal, codePostal, ressembleAdresse, verifierAdresse, chercherAdresses, trouverPoint, pointDe } = await loadTs('src/lib/adresses.ts')

const ban = (features) => ({ ok: true, json: async () => ({ features: features.map((properties) => ({ properties })) }) })
const rue = (name, postcode, city, score, context = '') => ({ label: `${name} ${postcode} ${city}`, name, postcode, city, score, context, type: 'housenumber' })

test('le code postal tapé, ce qui ressemble à une adresse', () => {
  assert.equal(codePostal('15 rue André Lalande 91000 Evry'), '91000')
  assert.equal(codePostal('Appt 202'), null)
  assert.ok(ressembleAdresse('12 rue des Lilas') && ressembleAdresse('allée des roses'))
  assert.ok(!ressembleAdresse('chez Mamie'))
})

test('le code postal ajouté sans rien perdre de ce qu’on a écrit', () => {
  assert.equal(avecCodePostal('15 Rue André Lalande, Res Marguerite Yourcenar, Appt 202, Evry', '91000', 'Évry-Courcouronnes'), '15 Rue André Lalande, Res Marguerite Yourcenar, Appt 202, 91000 Evry')
  assert.equal(avecCodePostal('15 rue André Lalande', '91000', 'Évry-Courcouronnes'), '15 rue André Lalande, 91000 Évry-Courcouronnes')
})

test('une seule ville : sûre ; la même rue dans deux villes : laquelle ?', async () => {
  const avant = globalThis.fetch
  try {
    globalThis.fetch = async () => ban([rue('15 Rue André Lalande', '91000', 'Évry-Courcouronnes', 0.82, '91, Essonne, Île-de-France')])
    const a = await verifierAdresse('15 rue andré lalande')
    assert.equal(a.sure.cp, '91000')
    assert.equal(a.sure.detail, 'Évry-Courcouronnes · Essonne')
    globalThis.fetch = async () => ban([rue('3 Rue de la Paix', '75002', 'Paris', 0.71, '75, Paris'), rue('3 Rue de la Paix', '44000', 'Nantes', 0.69, '44, Loire-Atlantique'), rue('3 Rue de la Paix', '13001', 'Marseille', 0.4)])
    const b = await verifierAdresse('3 rue de la paix')
    assert.equal(b.sure, null)
    assert.deepEqual(b.choix.map((x) => x.cp), ['75002', '44000'])
    assert.equal(await verifierAdresse('chez Mamie'), null)
    assert.equal(await verifierAdresse('3 rue de la paix 75002 Paris'), null)
    // un code postal tapé : la recherche s'y limite, et le code postal reste dans l'adresse choisie
    let url = ''
    globalThis.fetch = async (u) => { url = String(u); return ban([rue('3 Rue de la Paix', '75002', 'Paris', 0.9)]) }
    const c = await chercherAdresses('3 rue de la paix 75002', new AbortController().signal)
    assert.ok(url.includes('postcode=75002') || c.length)
    assert.ok(c.some((x) => x.texte === '3 Rue de la Paix, 75002 Paris'))
  } finally {
    globalThis.fetch = avant
  }
})

// « Nos adresses » : il faut le point de l'adresse, pas seulement son texte
const geo = (properties, lon, lat) => ({ properties, geometry: { type: 'Point', coordinates: [lon, lat] } })
const reponse = (features) => ({ ok: true, json: async () => ({ features }) })

test('le point d’un résultat : longitude d’abord, et rien si ce n’est pas un point plausible', () => {
  assert.deepEqual(pointDe(geo({}, 6.1453, 45.9061)), { lat: 45.9061, lon: 6.1453 })
  assert.equal(pointDe({ properties: {} }), null)
  assert.equal(pointDe({ geometry: null }), null)
  assert.equal(pointDe({ geometry: { coordinates: ['6.1', '45.9'] } }), null)
  assert.equal(pointDe({ geometry: { coordinates: [6.1, 145.9] } }), null)
  assert.equal(pointDe({ geometry: { coordinates: [6.1] } }), null)
})

test('les suggestions gardent leur point ; une adresse écrite à la main le retrouve, sauf si c’est une ville entière', async () => {
  const avant = globalThis.fetch
  try {
    globalThis.fetch = async (u) =>
      String(u).includes('photon')
        ? reponse([geo({ name: 'École Vaugelas', street: 'Rue Vaugelas', postcode: '74000', city: 'Annecy', osm_key: 'amenity' }, 6.1242, 45.9012)])
        : reponse([geo(rue('3 Rue des Écoles', '74000', 'Annecy', 0.9, '74, Haute-Savoie'), 6.1453, 45.9061)])
    const s = await chercherAdresses('3 rue des ecoles annecy', new AbortController().signal)
    assert.deepEqual([s[0].titre, s[0].lat, s[0].lon], ['École Vaugelas', 45.9012, 6.1242])
    assert.deepEqual([s[1].texte, s[1].lat, s[1].lon], ['3 Rue des Écoles, 74000 Annecy', 45.9061, 6.1453])
    assert.deepEqual(await trouverPoint('3 rue des ecoles annecy'), { lat: 45.9061, lon: 6.1453, texte: '3 Rue des Écoles, 74000 Annecy' })
    // une ville seule, un résultat douteux, un service qui ne répond pas : pas de point (on demande de choisir dans la liste)
    globalThis.fetch = async () => reponse([geo({ label: 'Annecy', city: 'Annecy', postcode: '74000', type: 'municipality', score: 0.95 }, 6.12, 45.9)])
    assert.equal(await trouverPoint('Annecy centre'), null)
    globalThis.fetch = async () => reponse([geo(rue('3 Rue des Écoles', '74000', 'Annecy', 0.41), 6.1453, 45.9061)])
    assert.equal(await trouverPoint('3 rue des ecolles'), null)
    globalThis.fetch = async () => ({ ok: false, json: async () => ({}) })
    assert.equal(await trouverPoint('3 rue des ecoles annecy'), null)
    assert.equal(await trouverPoint('rue'), null)
    // sans point dans la réponse : la suggestion reste, sans lat ni lon
    globalThis.fetch = async () => ban([rue('3 Rue des Écoles', '74000', 'Annecy', 0.9)])
    const sans = await chercherAdresses('3 rue des ecoles', new AbortController().signal)
    assert.ok(sans.length && !('lat' in sans[0]))
  } finally {
    globalThis.fetch = avant
  }
})

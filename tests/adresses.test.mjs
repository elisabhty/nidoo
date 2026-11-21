import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { avecCodePostal, codePostal, ressembleAdresse, verifierAdresse, chercherAdresses } = await loadTs('src/lib/adresses.ts')

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

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { reaction, estEmoji, premierEmoji, lesPlusDonnees, RAPIDES, PANDA, FEUTRINE, CLAVIER, motDe } = await loadTs('src/lib/reactions.ts')

test('toutes nos clés tiennent en base (8 caractères au plus) et ne se répètent pas', () => {
  const cles = [...RAPIDES, ...PANDA, ...FEUTRINE].map((r) => r.cle)
  assert.equal(new Set(cles).size, cles.length)
  for (const c of [...cles, ...CLAVIER]) assert.ok([...c].length <= 8, c)
  for (const e of CLAVIER) assert.ok(reaction(e)?.emoji === e, e)
})

test('un émoji du clavier : oui ; du texte, une clé inconnue : non', () => {
  for (const e of ['❤️', '👍🏽', '👨‍👩‍👧', '🇫🇷', '🐼']) assert.ok(estEmoji(e), e)
  for (const t of ['coeur', 'p:inconnu', 'abc😀', '12', '']) assert.ok(!estEmoji(t), t)
  assert.equal(reaction('p:inconnu'), null)
  assert.equal(reaction('coeur').art, 'geste-coeur')
  assert.equal(reaction('e:mdr').sticker, 'emo-mdr')
})

test('le champ « Un autre émoji » garde le premier émoji tapé', () => {
  assert.equal(premierEmoji('🥹🥹'), '🥹')
  assert.equal(premierEmoji(' 👍🏽 '), '👍🏽')
  assert.equal(premierEmoji('👨‍👩‍👧'), '👨‍👩‍👧')
  assert.equal(premierEmoji('salut'), null)
  assert.equal(premierEmoji('👨‍👩‍👧‍👦'), '👨‍👩‍👧‍👦') // 7 caractères : ça tient
  assert.equal(premierEmoji('👩🏽\u200d❤️\u200d💋\u200d👨🏻'), null) // 10 caractères : trop long pour la base
})

test('les plus données d’abord, les cinq d’origine en cas d’égalité', () => {
  assert.deepEqual(lesPlusDonnees(['e:mdr', 'rire', 'coeur', 'e:mdr', '???']).map((r) => r.cle), ['e:mdr', 'coeur', 'rire'])
  assert.equal(motDe(reaction('🔥')), 'Réagi')
  assert.equal(motDe(reaction('e:merci')), 'Merci')
})

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { codeExpire, codeValable, resteAvantExpiration } = await loadTs('src/lib/invitation.ts')

const dans = (ms) => new Date(Date.now() + ms).toISOString()
const maison = (id, code, ms) => ({ id, invite_code: code, invite_expires_at: dans(ms) })
/** Une fausse base : une maison, et le compte des renouvellements demandés. */
function base(f, { panne = false } = {}) {
  const b = {
    f: { ...f },
    renouvele: 0,
    async circles() {
      if (panne) throw new Error('RESEAU')
      return [{ family: { ...b.f } }]
    },
    async renewInvite() {
      b.renouvele++
      b.f = { ...b.f, invite_code: 'NEUF' + b.renouvele, invite_expires_at: dans(7 * 86400000) }
    },
  }
  return b
}

test('un code est expiré une fois sa date passée, ou s’il manque', () => {
  assert.equal(codeExpire(maison('a', 'ABC234', 60000)), false)
  assert.equal(codeExpire(maison('a', 'ABC234', -60000)), true)
  assert.equal(codeExpire(maison('a', '', 60000)), true)
  assert.equal(codeExpire({ invite_code: 'ABC234', invite_expires_at: 'pas une date' }), true)
  assert.equal(resteAvantExpiration(maison('a', 'ABC234', -5)), 0)
  assert.ok(resteAvantExpiration(maison('a', 'ABC234', 60000)) > 59000)
})

test('un code encore valable n’est pas changé', async () => {
  const f = maison('m1', 'ABC234', 3600000)
  const b = base(f)
  assert.equal((await codeValable(b, f, true)).invite_code, 'ABC234')
  assert.equal(b.renouvele, 0)
})

test('expiré : un responsable en reçoit un neuf tout seul, une seule fois même si deux écrans le demandent', async () => {
  const f = maison('m2', 'VIEUX2', -1000)
  const b = base(f)
  const [x, y] = await Promise.all([codeValable(b, f, true), codeValable(b, f, true)])
  assert.equal(x.invite_code, 'NEUF1')
  assert.equal(y.invite_code, 'NEUF1')
  assert.equal(b.renouvele, 1)
  assert.equal(codeExpire(x), false)
})

test('expiré ici mais déjà renouvelé par un autre responsable : on prend le sien', async () => {
  const f = maison('m3', 'VIEUX3', -1000)
  const b = base(maison('m3', 'AUTRE3', 86400000))
  assert.equal((await codeValable(b, f, true)).invite_code, 'AUTRE3')
  assert.equal(b.renouvele, 0)
})

test('expiré : un membre qui n’est pas responsable attend, sans rien demander à la base', async () => {
  const f = maison('m4', 'VIEUX4', -1000)
  const b = base(f)
  assert.equal(await codeValable(b, f, false), null)
  assert.equal(b.renouvele, 0)
})

test('sans réseau : rien, et on ne redemande pas en boucle, sauf si on touche le bouton', async () => {
  const f = maison('m5', 'VIEUX5', -1000)
  const panne = base(f, { panne: true })
  assert.equal(await codeValable(panne, f, true), null)
  const b = base(f)
  assert.equal(await codeValable(b, f, true), null) // échec tout récent : on patiente
  assert.equal(b.renouvele, 0)
  assert.equal((await codeValable(b, f, true, true)).invite_code, 'NEUF1')
})

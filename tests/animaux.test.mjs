import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { ANIMAUX } = await loadTs('src/lib/animaux.ts')
const { boiteHabit, boiteImage, depasse, menton, contourTete, OBJET, BUSTE_DU_PULL, pullSansManches } = await loadTs('src/lib/habitsAnimaux.ts')

const ESPECES = ['chat', 'chien', 'lapin', 'renard', 'panda', 'koala', 'pingouin', 'hibou']

test('chaque compagnon a ses repères, et ils tiennent debout', () => {
  for (const e of ESPECES) {
    const a = ANIMAUX[e]
    assert.ok(a, `pas de repères pour ${e}`)
    assert.ok(a.crane < a.ey && a.ey < menton(a) && menton(a) < a.pieds && a.pieds < 0.95, `${e} : crâne, yeux, menton et pattes dans le désordre`)
    assert.ok(a.d > 0.15 && a.d < 0.32 && a.tw > a.d && a.cw > 0.3 && a.cw < 0.85, `${e} : mesures hors du raisonnable`)
  }
})

test('le nœud et le bandana se portent au cou : sous la bouche, jamais sur le visage', () => {
  for (const e of ESPECES)
    for (const h of ['habit:noeud', 'habit:bandana']) {
      const a = ANIMAUX[e], b = boiteHabit(h, e)
      // il remonte à peine au-dessus du menton, et ce bout-là est caché par la tête, redessinée devant
      assert.ok(b.t > a.ey + a.d * 0.25, `${h} monte sur le visage de ${e}`)
      assert.ok(b.t + b.h * 0.5 > menton(a), `${h} est plus sur le visage de ${e} que sous son menton`)
      assert.ok(b.t + b.h < a.pieds && b.l > 0 && b.l + b.w < 1, `${h} sort du corps de ${e}`)
      assert.ok(Math.abs(b.l + b.w / 2 - a.ex) < 0.01, `${h} n'est pas centré sous le menton de ${e}`)
    }
})

test('le bonnet est posé sur le crâne, au-dessus des yeux, et ne sort jamais du cadre', () => {
  for (const e of ESPECES) {
    const a = ANIMAUX[e], b = boiteHabit('habit:bonnet', e)
    assert.ok(b.t + b.h < a.ey - a.d * 0.3, `le bonnet couvre les yeux de ${e}`)
    assert.ok(b.t + b.h > a.crane, `le bonnet flotte au-dessus de la tête de ${e}`)
    assert.ok(b.t >= a.crane - 0.1401, `le bonnet monte trop haut sur ${e}`)
    // ce qui dépasse en haut est rattrapé : tout rapetisse d'autant, posé en bas
    const trop = depasse('habit:bonnet', e)
    assert.ok(trop < 0.13, `${e} rapetisse trop sous son bonnet (${trop.toFixed(3)})`)
    assert.ok(1 - (1 - b.t) / (1 + trop) >= -1e-9, `le bonnet de ${e} sort du cadre`)
    assert.ok(b.l >= -0.02 && b.l + b.w <= 1.02, `le bonnet de ${e} est trop large`)
  }
  assert.equal(depasse('habit:pull', 'chien'), 0)
  assert.equal(depasse(null, 'chien'), 0)
})

test('le pull va du menton au haut des pattes arrière, et couvre la largeur du corps', () => {
  for (const e of ESPECES) {
    const a = ANIMAUX[e], b = boiteHabit('habit:pull', e)
    assert.ok(b.t < menton(a) && b.t > a.ey, `le col du pull de ${e} n'est pas sous son menton`)
    assert.ok(Math.abs(b.t + b.h - a.pieds) < 1e-9, `le pull de ${e} ne s'arrête pas au-dessus de ses pattes`)
    assert.ok(b.w * 0.7 >= Math.min(a.cw, 0.63) - 0.02, `le pull de ${e} est trop étroit pour son corps`)
  }
})

test('le pull est sans manches, sauf pour ceux qui ont des ailes où elles tombent', () => {
  assert.deepEqual(ESPECES.filter((e) => !pullSansManches(e)), ['pingouin', 'hibou'])
  assert.equal(pullSansManches('dragon'), true) // inconnu : comme le chat
  // le buste gardé couvre bien le corps de chacun (à 3 % près), sans dépasser de l'image du pull
  assert.ok(BUSTE_DU_PULL[0] > 0.1 && BUSTE_DU_PULL[1] < 0.9 && BUSTE_DU_PULL[1] - BUSTE_DU_PULL[0] > 0.6)
  for (const e of ESPECES.filter(pullSansManches)) {
    const a = ANIMAUX[e], im = boiteImage('habit:pull', boiteHabit('habit:pull', e))
    assert.ok((BUSTE_DU_PULL[1] - BUSTE_DU_PULL[0]) * im.w >= a.cw * 0.97, `le pull sans manches de ${e} est plus étroit que son corps`)
  }
})

test('l’image d’un habit est placée pour que l’objet tombe exactement dans sa boîte', () => {
  for (const h of Object.keys(OBJET)) {
    const b = boiteHabit(h, 'renard'), im = boiteImage(h, b)
    const [x0, y0, x1, y1] = OBJET[h]
    assert.ok(Math.abs(im.l + (im.w * x0) / 320 - b.l) < 1e-9 && Math.abs(im.t + (im.h * y0) / 320 - b.t) < 1e-9)
    assert.ok(Math.abs((im.w * (x1 - x0)) / 320 - b.w) < 1e-9 && Math.abs((im.h * (y1 - y0)) / 320 - b.h) < 1e-9)
  }
  assert.equal(boiteHabit('habit:inconnu', 'chat'), null)
  // un animal inconnu : les repères du chat, plutôt qu'une erreur
  assert.deepEqual(boiteHabit('habit:noeud', 'dragon'), boiteHabit('habit:noeud', 'chat'))
})

test('la tête redessinée devant s’arrête au menton', () => {
  for (const e of ESPECES) {
    const a = ANIMAUX[e]
    const bas = Math.max(...contourTete(a).map(([, y]) => y))
    assert.ok(Math.abs(bas - menton(a)) < 1e-9, `${e} : la tête redessinée ne s'arrête pas au menton`)
  }
})

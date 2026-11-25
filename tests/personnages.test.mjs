import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { teindreCheveux, rgb2lab, lab2rgb, amplitude } = await loadTs('src/lib/teinture.ts')
const { PERSOS, accPlace, accTop, accPieces, menton, HAUTS } = await loadTs('src/lib/persos.ts')
const { TENUES } = await loadTs('src/lib/tenues.ts')
const { zoneHabit, Z_HAUT, Z_BAS, Z_JAMBES, Z_CHAUSSURES } = await loadTs('src/lib/personnalise.ts')

// Une tête en miniature : 40 × 40, des cheveux noirs en haut (lignes 4 à 19), de la peau claire dessous (20 à 35),
// du vide autour. Le bord extérieur des cheveux est mêlé au fond blanc d'origine, comme sur les vraies figurines.
function tete() {
  const W = 40, H = 40
  const d = new Uint8ClampedArray(W * H * 4), m = new Uint8ClampedArray(W * H * 4)
  const peau = lab2rgb(76, 12, 28)
  for (let y = 4; y < 36; y++)
    for (let x = 6; x < 34; x++) {
      const i = (y * W + x) * 4
      const cheveux = y < 20
      // un relief de feutrine : des cheveux entre L 9 et L 21, quelques reflets
      const [r, g, b] = cheveux ? lab2rgb(14 + ((x * 7 + y * 3) % 9) - 4 + (x % 11 === 0 ? 10 : 0), 1, 2) : peau
      const bord = cheveux && (y === 4 || x === 6 || x === 33)
      d[i] = bord ? (r + 255) / 2 : r
      d[i + 1] = bord ? (g + 255) / 2 : g
      d[i + 2] = bord ? (b + 255) / 2 : b
      d[i + 3] = 255
      m[i] = cheveux ? 0 : 255
      m[i + 1] = cheveux ? 255 : 0
      m[i + 3] = 255
    }
  return { d, m, W, H }
}
const BLEU = [44, 6, -36]

test('des cheveux noirs passés au bleu : bleus partout, jamais de liseré blanc au bord, la peau intacte', () => {
  const { d, m, W, H } = tete()
  const avant = new Uint8ClampedArray(d)
  teindreCheveux(d, m, W, H, { vers: BLEU, cheveux: [14, 1, 2], peau: [76, 12, 28], ySep: 30, barbe: false })
  const amp = amplitude(BLEU[0])
  let pire = 0
  for (let y = 4; y < 20; y++)
    for (let x = 6; x < 34; x++) {
      const i = (y * W + x) * 4
      const [L, , b] = rgb2lab(d[i], d[i + 1], d[i + 2])
      assert.ok(b < -18, `le pixel ${x},${y} n'est pas bleu (b = ${b.toFixed(1)})`)
      // jamais plus clair que la couleur et ses reflets (avant : le relief était multiplié, le bord partait au blanc)
      assert.ok(L <= BLEU[0] + amp.haut * 1.4 + 2, `le pixel ${x},${y} est trop clair (L = ${L.toFixed(1)})`)
      if (y === 4 || x === 6 || x === 33) pire = Math.max(pire, L)
    }
  assert.ok(pire <= BLEU[0] + amp.haut * 0.3 + 3, `le bord de la silhouette est trop clair (L = ${pire.toFixed(1)})`)
  for (let y = 23; y < 36; y++)
    for (let x = 6; x < 34; x++) {
      const i = (y * W + x) * 4
      assert.deepEqual([d[i], d[i + 1], d[i + 2]], [avant[i], avant[i + 1], avant[i + 2]], `la peau a changé en ${x},${y}`)
    }
})

test('un serre-tête coloré dans des cheveux sans couleur garde la sienne', () => {
  const { d, m, W, H } = tete()
  const jaune = lab2rgb(78, 8, 60)
  for (let x = 10; x < 30; x++)
    for (let y = 10; y < 13; y++) {
      const i = (y * W + x) * 4
      d[i] = jaune[0]
      d[i + 1] = jaune[1]
      d[i + 2] = jaune[2]
    }
  teindreCheveux(d, m, W, H, { vers: BLEU, cheveux: [14, 1, 2], peau: [76, 12, 28], ySep: 30, barbe: false })
  const i = (11 * W + 20) * 4
  assert.ok(rgb2lab(d[i], d[i + 1], d[i + 2])[2] > 40, 'le serre-tête est resté jaune')
})

test('le bleu du masque dit à quel habit appartient un pixel, sans jamais se confondre avec un trait du visage', () => {
  assert.equal(zoneHabit(0), 0)
  assert.equal(zoneHabit(10), Z_HAUT)
  assert.equal(zoneHabit(20), Z_BAS)
  assert.equal(zoneHabit(30), Z_JAMBES)
  assert.equal(zoneHabit(38), Z_CHAUSSURES)
  for (const trait of [85, 170, 255]) assert.equal(zoneHabit(trait), 0)
})

test('chaque figurine a sa tenue, et ses repères tiennent debout', () => {
  for (const p of PERSOS) {
    const t = TENUES[p.id]
    assert.ok(t, `pas de tenue pour ${p.id}`)
    assert.ok(t.om <= t.oh + 1e-6, `${p.id} : l'ourlet remonte plus bas qu'il ne descend`)
    assert.ok(t.oh > menton(p) + 0.08 && t.oh < t.ct, `${p.id} : ourlet du haut hors du corps (${t.oh})`)
    assert.ok(t.ct > 0.8 && t.ct < 0.98, `${p.id} : haut des chaussures ${t.ct}`)
  }
})

test('un chapeau ne dépasse jamais du cadre de la cabine d’essayage', () => {
  // la cabine laisse 0,165 de la hauteur de la figurine au-dessus d'elle (voir centre.tsx)
  for (const p of PERSOS)
    for (const acc of ['bonnet', 'casquette', 'paille', 'fleurs', 'couronne', 'noeud']) {
      const pl = accPlace(p, acc)
      assert.ok(pl, `${acc} sur ${p.id}`)
      assert.ok(accTop(pl) > -0.16, `${acc} dépasse trop sur ${p.id} (${accTop(pl).toFixed(3)})`)
    }
})

test('un haut de la boutique couvre l’ourlet du haut d’origine (sauf tunique), un bas commence au-dessus', () => {
  for (const p of PERSOS) {
    const t = TENUES[p.id]
    for (const acc of HAUTS) {
      const [q] = accPieces(p, acc)
      const ourlet = q.t + q.h
      // soit il descend jusqu'à l'ancien ourlet, soit l'ancien haut est bien plus long (une tunique, qui reste dessous)
      assert.ok(ourlet >= t.oh + 0.007 || t.oh - ourlet > 0.08, `${acc} sur ${p.id} : ourlet ${ourlet.toFixed(3)}, ancien ${t.oh}`)
    }
    for (const acc of ['jean', 'jupe', 'short']) {
      const [q] = accPieces(p, acc)
      assert.ok(q.t <= t.om - 0.019, `${acc} sur ${p.id} commence sous l'ourlet du haut (${q.t.toFixed(3)} / ${t.om})`)
      assert.ok(q.w < 0.6 && q.w > 0.25, `${acc} sur ${p.id} : largeur ${q.w.toFixed(3)}`)
    }
  }
})

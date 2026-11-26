import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'
const { endroitDe, ouEst, endroitNomme, lieuAffiche, lieuComplet, endroitsQuiCollent, genreEndroit, nomPropre, nomPris, nomsLibres, cle, memeAdresse, cercle, TAILLES, RAYON, FLOU_MAX, NOM_MAX } = await loadTs('src/lib/endroits.ts')
const { distance } = await loadTs('src/lib/positions.ts')

// Annecy : l'école, le bureau à 1,2 km, la maison à 120 m de l'école
const endroit = (nom, lat, lon, adresse = null, rayon_m = RAYON) => ({ id: nom, family_id: 'f', nom, adresse, lat, lon, rayon_m, created_at: '2026-11-26T00:00:00Z' })
const ECOLE = endroit('École', 45.9061, 6.1453, '3 Rue des Écoles, 74000 Annecy')
const BUREAU = endroit('Bureau de Papa', 45.9135, 6.13, 'Avenue de Brogny, Annecy')
const MAISON = endroit('Maison', 45.9061, 6.14685, '15 Rue André Lalande, 91000 Évry-Courcouronnes')
const TOUS = [ECOLE, BUREAU, MAISON]
/** Un point à `m` mètres au nord d'un autre. */
const auNord = (p, m) => ({ lat: p.lat + m / 111195, lon: p.lon })
const pos = (p, extra = {}) => ({ lat: p.lat, lon: p.lon, precision_m: 10, lieu: 'Avenue d’Albigny', ville: 'Annecy', ...extra })

test('dans le rayon, on est à l’endroit ; au-delà, on retrouve la rue', () => {
  assert.equal(endroitDe(pos(ECOLE), [ECOLE])?.nom, 'École')
  assert.equal(endroitDe(pos(auNord(ECOLE, 140)), [ECOLE])?.nom, 'École')
  assert.equal(endroitDe(pos(auNord(ECOLE, 175)), [ECOLE]), null)
  assert.equal(ouEst(pos(auNord(ECOLE, 60)), TOUS), 'École')
  assert.equal(ouEst(pos(auNord(ECOLE, 600)), TOUS), 'Avenue d’Albigny, Annecy')
  assert.equal(ouEst(pos(ECOLE), []), 'Avenue d’Albigny, Annecy')
})

test('une position floue garde sa précision en plus du rayon, mais jamais plus de 200 m', () => {
  const a300 = auNord(ECOLE, 300)
  assert.equal(endroitDe(pos(a300, { precision_m: 10 }), [ECOLE]), null, 'à 300 m avec une bonne précision : pas à l’école')
  assert.equal(endroitDe(pos(a300, { precision_m: 165 }), [ECOLE])?.nom, 'École', 'à 300 m, précise à 165 m près : sans doute à l’école')
  assert.equal(endroitDe(pos(auNord(ECOLE, RAYON + FLOU_MAX + 20), { precision_m: 1500 }), [ECOLE]), null, 'une position très floue ne colle pas à tout le quartier')
  assert.equal(endroitDe(pos(auNord(ECOLE, 100), { precision_m: null }), [ECOLE])?.nom, 'École', 'sans précision connue : le rayon seul')
  assert.equal(endroitDe(pos(auNord(ECOLE, 100), { precision_m: -5 }), [ECOLE])?.nom, 'École')
})

test('deux endroits qui se touchent : le plus proche gagne, dans les deux sens', () => {
  assert.ok(distance(ECOLE, MAISON) < RAYON, 'la maison est dans le rayon de l’école')
  assert.equal(endroitDe(pos(ECOLE), TOUS)?.nom, 'École')
  assert.equal(endroitDe(pos(MAISON), TOUS)?.nom, 'Maison')
  assert.equal(endroitDe(pos(MAISON), [...TOUS].reverse())?.nom, 'Maison')
  assert.equal(endroitDe(pos(BUREAU), TOUS)?.nom, 'Bureau de Papa')
})

test('un rayon plus grand pour un grand endroit', () => {
  const campus = endroit('Fac', 45.92, 6.15, null, 400)
  assert.equal(endroitDe(pos(auNord(campus, 380)), [campus])?.nom, 'Fac')
  assert.equal(endroitDe(pos(auNord(campus, 430)), [campus]), null)
})

test('un nom se garde propre, et ne sert qu’une fois (accents et majuscules ne comptent pas)', () => {
  assert.equal(nomPropre('  École   de   Léa '), 'École de Léa')
  assert.equal(nomPropre('x'.repeat(80)).length, NOM_MAX)
  assert.equal(nomPropre('   '), '')
  assert.equal(cle('  École – de Léa ! '), 'ecole de lea')
  assert.ok(nomPris('ecole', TOUS) && nomPris(' ÉCOLE ', TOUS))
  assert.ok(!nomPris('École', TOUS, ECOLE.id), 'en modifiant « École », son propre nom reste libre')
  assert.ok(!nomPris('Crèche', TOUS) && !nomPris('', TOUS))
  assert.deepEqual(nomsLibres(TOUS), ['Travail', 'Crèche', 'Sport', 'Chez Mamie'])
})

test('le lieu d’un événement : une adresse enregistrée se reconnaît à son nom ou à son adresse écrite en entier', () => {
  assert.equal(endroitNomme('école', TOUS)?.id, ECOLE.id)
  assert.equal(endroitNomme(' Maison ', TOUS)?.id, MAISON.id)
  assert.equal(endroitNomme('15 rue andré lalande 91000 evry-courcouronnes', TOUS)?.id, MAISON.id, 'la même adresse, écrite autrement')
  assert.equal(endroitNomme('Avenue de Brogny, Annecy', TOUS), null, 'une rue sans numéro est trop longue pour être « le bureau »')
  assert.equal(endroitNomme('Restaurant Le Lac', TOUS), null)
  assert.equal(endroitNomme('', TOUS), null)
  assert.equal(endroitNomme(null, TOUS), null)
  assert.deepEqual(lieuAffiche('15 Rue André Lalande, 91000 Évry-Courcouronnes', TOUS), { titre: 'Maison', detail: MAISON.adresse, endroit: MAISON })
  assert.deepEqual(lieuAffiche('Chez Tonton', TOUS), { titre: 'Chez Tonton', detail: null, endroit: null })
})

test('pour le calendrier et le partage, le nom vient avec son adresse', () => {
  assert.equal(lieuComplet('École', TOUS), 'École, 3 Rue des Écoles, 74000 Annecy')
  assert.equal(lieuComplet('Gare de Lyon', TOUS), 'Gare de Lyon')
  assert.equal(lieuComplet('Parc', [endroit('Parc', 45.9, 6.1)]), 'Parc', 'sans adresse : le nom seul')
  assert.equal(lieuComplet('École', [endroit('École', 45.9, 6.1, 'École Vaugelas, Avenue d’Albigny, Annecy')]), 'École Vaugelas, Avenue d’Albigny, Annecy', 'l’adresse commence déjà par le nom')
  assert.equal(lieuComplet('15 Rue André Lalande, 91000 Évry-Courcouronnes', TOUS), 'Maison, 15 Rue André Lalande, 91000 Évry-Courcouronnes')
})

test('en tapant le lieu d’un événement, nos adresses qui collent arrivent d’abord', () => {
  assert.deepEqual(endroitsQuiCollent('', TOUS).map((e) => e.nom), ['École', 'Bureau de Papa', 'Maison'])
  assert.deepEqual(endroitsQuiCollent('ec', TOUS).map((e) => e.nom), ['École'])
  assert.deepEqual(endroitsQuiCollent('pap', TOUS).map((e) => e.nom), ['Bureau de Papa'], 'un mot du nom suffit')
  assert.deepEqual(endroitsQuiCollent('zzz', TOUS), [])
  const avec = [endroit('Travail de Maman', 1, 1), endroit('Maman', 2, 2)]
  assert.deepEqual(endroitsQuiCollent('mam', avec).map((e) => e.nom), ['Maman', 'Travail de Maman'], 'le début du nom passe devant')
})

test('l’image d’un endroit se devine à son nom', () => {
  const cas = {
    Maison: 'maison', 'Chez nous': 'maison', 'École': 'ecole', 'Collège de Léa': 'ecole', 'Lycée': 'ecole', Travail: 'travail', 'Bureau de Papa': 'travail',
    'Travail de Maman': 'travail', 'Crèche': 'creche', Nounou: 'creche', 'Assistante maternelle': 'creche', Maternelle: 'ecole', Sport: 'sport',
    'École de danse': 'sport', 'Club de foot': 'sport', Piscine: 'sport', 'Conservatoire': 'musique', 'École de musique': 'musique', 'Chez Mamie': 'famille',
    'Maison de Mamie': 'famille', 'Chez Léa': 'famille', 'Pédiatre': 'sante', 'Supermarché': 'courses', Gare: 'transport', 'Parc': 'nature', 'Le repaire': 'autre',
  }
  for (const [nom, genre] of Object.entries(cas)) assert.equal(genreEndroit(nom), genre, nom)
})

test('la même adresse, avec ou sans son code postal, garde son point', () => {
  assert.ok(memeAdresse('Place de l’Hôtel de Ville, Annecy', 'Place de l’Hôtel de Ville, 74000 Annecy'))
  assert.ok(memeAdresse('15 rue André Lalande, Evry', '15 Rue Andre Lalande, 91000 Evry'))
  assert.ok(!memeAdresse('15 rue André Lalande, Evry', '17 rue André Lalande, Evry'), 'un autre numéro : un autre endroit')
  assert.ok(!memeAdresse('Rue de la Paix, Paris', 'Rue de la Paix, Nantes'))
})

test('la zone sur la carte : un cercle fermé, au bon rayon dans toutes les directions', () => {
  const c = { lat: 45.9061, lon: 6.1453 }
  const pts = cercle(c, 150)
  assert.deepEqual(pts[0], pts[pts.length - 1], 'le contour se referme')
  for (const [lon, lat] of pts) assert.ok(Math.abs(distance(c, { lat, lon }) - 150) < 1.5, 'chaque point du bord est à 150 m')
  assert.deepEqual(TAILLES.map((t) => t.rayon), [100, RAYON, 300])
})

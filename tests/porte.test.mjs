import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadTs } from './loadTs.mjs'

const P = await loadTs('src/lib/porte.ts')
const DT = 1 / 60

/** Deux robots sages portent ensemble jusqu'au bout. */
function aDeuxRobots(n, max = 240) {
  const g = P.nouvellePartie()
  const ra = P.nouveauRobot(), rb = P.nouveauRobot()
  while (!g.fin && g.t < max) P.pas(n, g, P.robot(n, g, 'a', ra, false), P.robot(n, g, 'b', rb, false), DT)
  return g
}

test('tous les niveaux se finissent, sans grosse frayeur, quand on marche ensemble', () => {
  for (const n of P.NIVEAUX) {
    const g = aDeuxRobots(n)
    assert.equal(g.fin, 'gagne', `${n.nom} : ${g.fin} (${g.cause}) à ${g.a.x.toFixed(0)} / ${n.long}`)
    assert.ok(g.pic < 0.6, `${n.nom} : équilibre ${g.pic.toFixed(2)}`)
    assert.ok(g.t <= n.par, `${n.nom} : ${g.t.toFixed(1)} s pour un temps à battre de ${n.par} s`)
    assert.equal(P.etoiles(n, g.t, g.pic), 3)
  }
})

test('si celui de devant part seul, la planche échappe', () => {
  const n = P.NIVEAUX[0]
  const g = P.nouvellePartie()
  while (!g.fin && g.t < 20) P.pas(n, g, false, true, DT)
  assert.equal(g.fin, 'tombe')
  assert.equal(g.cause, 'devant')
  assert.ok(g.t < 3)
})

test('si celui de derrière pousse, ça tombe aussi', () => {
  const n = P.NIVEAUX[0]
  const g = P.nouvellePartie()
  while (!g.fin && g.t < 20) P.pas(n, g, true, false, DT)
  assert.equal(g.fin, 'tombe')
  assert.equal(g.cause, 'derriere')
})

test('foncer ensemble sans ralentir aux bosses fait tanguer, puis tomber quand c’est fragile', () => {
  const calme = P.NIVEAUX[0]
  const g = P.nouvellePartie()
  while (!g.fin && g.t < 60) P.pas(calme, g, true, true, DT)
  assert.equal(g.fin, 'gagne')
  assert.ok(g.pic > 0.25, `les bosses à pleine vitesse se sentent (${g.pic.toFixed(2)})`)
  assert.ok(P.etoiles(calme, g.t, g.pic) < 3 || g.pic < 0.6)
  const fragile = P.NIVEAUX[7]
  const h = P.nouvellePartie()
  while (!h.fin && h.t < 120) P.pas(fragile, h, true, true, DT)
  assert.equal(h.fin, 'tombe')
})

test('un animal assis sur le chemin arrête le porteur, puis s’en va', () => {
  const z = { k: 'animal', x: 300, qui: 'chat', cycle: 6, reste: 3, phase: 0 }
  const n = { ...P.NIVEAUX[0], zones: [z], long: 900 }
  assert.deepEqual(P.animalLa(z, 1), { la: true, vient: false })
  assert.equal(P.animalLa(z, 4).la, false)
  assert.equal(P.animalLa(z, 5.5).vient, true)
  const p = { x: 262, v: 90, bloque: false }
  P.pasPorteur(n, p, true, 1, 0.2)
  assert.equal(p.bloque, true)
  assert.equal(p.v, 0)
  assert.ok(p.x <= 270)
  P.pasPorteur(n, p, true, 4, 0.2)
  assert.equal(p.bloque, false)
  assert.ok(p.x > 270)
})

test('dans la boue on va deux fois moins vite, en côte on monte lentement et on descend vite', () => {
  const n = { ...P.NIVEAUX[0], zones: [{ k: 'boue', x: 100, l: 100 }, { k: 'cote', x: 400, l: 400, h: 50 }] }
  assert.equal(P.vitesseMax(n, 50), P.V_MAX)
  assert.equal(P.vitesseMax(n, 150), P.V_MAX / 2)
  assert.ok(P.vitesseMax(n, 500) < P.V_MAX)
  assert.ok(P.vitesseMax(n, 700) > P.V_MAX)
  assert.ok(Math.abs(P.sol(n, 600).h - 50) < 0.01)
  assert.equal(P.sol(n, 300).h, 0)
})

test('les étoiles : arrivé, sans frayeur, dans les temps', () => {
  const n = P.NIVEAUX[0]
  assert.equal(P.etoiles(n, n.par + 10, 0.9), 1)
  assert.equal(P.etoiles(n, n.par + 10, 0.3), 2)
  assert.equal(P.etoiles(n, n.par - 1, 0.3), 3)
  assert.equal(P.etoiles(n, n.par - 1, 0.7), 1)
})

/** Deux téléphones : chacun son moteur, des nouvelles huit fois par seconde qui mettent `retard` secondes à arriver. */
function aDistance(n, retard, max = 240) {
  const hote = P.nouvellePartie(), invite = P.nouvellePartie()
  const lb = P.nouveauLointain(P.LONG), la = P.nouveauLointain(0)
  const ra = P.nouveauRobot(), rb = P.nouveauRobot()
  const file = []
  let t = 0, envoi = 0, jInvite = 0, jRecu = 0
  while (!hote.fin && t < max) {
    t += DT
    for (let i = file.length - 1; i >= 0; i--) {
      if (file[i].a > t) continue
      const m = file.splice(i, 1)[0]
      if (m.vers === 'hote') {
        P.recu(lb, m.x, m.v, retard, t)
        jRecu = Math.max(jRecu, m.j)
      } else {
        P.recu(la, m.x, m.v, retard, t)
        invite.w = m.w
      }
    }
    P.pasHote(n, hote, P.robot(n, hote, 'a', ra, false), lb, jRecu, DT, retard)
    jRecu = 0
    jInvite = Math.max(jInvite, P.pasInvite(n, invite, P.robot(n, invite, 'b', rb, false), la, DT))
    if (t >= envoi) {
      envoi = t + 0.125
      file.push({ vers: 'hote', a: t + retard, x: invite.b.x, v: invite.b.v, j: jInvite })
      file.push({ vers: 'invite', a: t + retard, x: hote.a.x, v: hote.a.v, w: hote.w })
      jInvite = 0
    }
  }
  return hote
}

test('chacun sur son téléphone : avec du retard sur le réseau, on arrive quand même au bout', () => {
  for (const retard of [0.05, 0.15, 0.3]) {
    for (const n of P.NIVEAUX) {
      const g = aDistance(n, retard)
      assert.equal(g.fin, 'gagne', `${n.nom} avec ${retard * 1000} ms : ${g.fin} (${g.cause}), équilibre ${g.pic.toFixed(2)}`)
      assert.ok(g.pic < 0.9, `${n.nom} avec ${retard * 1000} ms : équilibre ${g.pic.toFixed(2)}`)
    }
  }
})

test('le panda rêveur s’arrête de temps en temps, et repart', () => {
  const n = P.NIVEAUX[3]
  const g = P.nouvellePartie()
  const ra = P.nouveauRobot(), rb = P.nouveauRobot()
  let h = 7
  const hasard = () => ((h = (h * 16807) % 2147483647) / 2147483647)
  let pauses = 0, avant = false
  while (!g.fin && g.t < 240) {
    P.pas(n, g, P.robot(n, g, 'a', ra, false), P.robot(n, g, 'b', rb, true, hasard), DT)
    const d = g.t < rb.distrait
    if (d && !avant) pauses++
    avant = d
  }
  assert.equal(g.fin, 'gagne')
  assert.ok(pauses >= 2, `${pauses} pauses`)
})

/** Deux téléphones et leurs écrans (décompte, jeu, fin), reliés par un réseau qui met `retard` ms. */
function deuxTelephones(retard, { muet = false } = {}) {
  const file = []
  let t = 1000
  const tel = (moi, hote, depart) => {
    const x = { etape: 'attente', n: depart, debut: 0, lances: 0, parti: false }
    x.s = new P.Seance(moi, hote, depart, (m) => {
      if (muet && !hote && m.t === 'p-x') return
      file.push({ a: t + retard, vers: hote ? 'invite' : 'hote', m })
    })
    x.suivre = (suite) => {
      if (suite.lancer !== undefined) {
        x.n = suite.lancer
        x.etape = 'decompte'
        x.debut = t + 2700
        x.lances++
        x.robot = P.nouveauRobot()
      }
      if (suite.parti) x.parti = true
    }
    x.robot = P.nouveauRobot()
    return x
  }
  const hote = tel('h', true, 0), invite = tel('i', false, 0)
  const tick = () => {
    t += 1000 / 60
    for (let i = 0; i < file.length; ) {
      if (file[i].a > t) { i++; continue }
      const { vers, m } = file.splice(i, 1)[0]
      const x = vers === 'hote' ? hote : invite
      x.suivre(x.s.recoit(m, x.etape, t))
    }
    for (const x of [hote, invite]) {
      if (x.etape === 'decompte' && t >= x.debut) x.etape = 'jeu'
      const n = P.NIVEAUX[x.n]
      const appui = x.etape === 'jeu' ? P.robot(n, x.s.g, x.s.hote ? 'a' : 'b', x.robot, false) : false
      x.suivre(x.s.tour(n, appui, x.etape, t, 1 / 60))
      if (x.etape === 'jeu' && x.s.g.fin) x.etape = 'fin'
    }
  }
  return { hote, invite, tick, file, temps: () => t, pousser: (vers, m) => file.push({ a: t, vers, m }) }
}

test('chacun sur son téléphone : l’invité arrive, l’hôte lance, on joue, et les deux voient la même fin', () => {
  for (const retard of [40, 160]) {
    const r = deuxTelephones(retard)
    // l'hôte arrive le premier (son salut se perd : personne n'écoute encore), puis l'invité
    r.hote.s.arrive()
    r.file.length = 0
    for (let i = 0; i < 60; i++) r.tick()
    assert.equal(r.hote.etape, 'attente')
    r.invite.s.arrive()
    for (let i = 0; i < 60 * 60 && !(r.hote.etape === 'fin' && r.invite.etape === 'fin'); i++) r.tick()
    assert.equal(r.hote.lances, 1)
    assert.equal(r.invite.lances, 1)
    assert.equal(r.hote.s.g.fin, 'gagne', `${retard} ms`)
    assert.equal(r.invite.s.g.fin, 'gagne')
    assert.equal(r.invite.s.g.t, Math.round(r.hote.s.g.t * 10) / 10)
    assert.ok(r.hote.s.g.pic < 0.6, `équilibre ${r.hote.s.g.pic.toFixed(2)} avec ${retard} ms`)
    assert.ok(Math.abs(r.hote.s.retard * 1000 - retard) < 40, `retard mesuré ${(r.hote.s.retard * 1000).toFixed(0)} ms pour ${retard}`)
    // on rejoue le niveau suivant : une annonce de fin de la manche d'avant, arrivée en retard, ne compte pas
    r.hote.suivre(r.hote.s.relancer(1))
    for (let i = 0; i < 30; i++) r.tick()
    assert.equal(r.invite.lances, 2)
    assert.equal(r.invite.n, 1)
    r.pousser('invite', { t: 'p-fin', who: 'h', m: 1, r: 'tombe', temps: 3, pic: 1 })
    for (let i = 0; i < 30; i++) r.tick()
    assert.equal(r.invite.s.g.fin, null)
    // un second salut en pleine partie ne la relance pas
    r.pousser('hote', { t: 'hello', who: 'i' })
    for (let i = 0; i < 400; i++) r.tick()
    assert.equal(r.hote.lances, 2)
    assert.equal(r.hote.etape, 'jeu')
  }
})

test('chacun sur son téléphone : si l’autre ne donne plus de nouvelles, on le dit ; s’il s’en va aussi', () => {
  const r = deuxTelephones(60, { muet: true })
  r.hote.s.arrive()
  r.invite.s.arrive()
  for (let i = 0; i < 60 * 12 && !r.hote.parti; i++) r.tick()
  assert.equal(r.hote.parti, true)
  const q = deuxTelephones(60)
  q.hote.s.arrive()
  q.invite.s.arrive()
  for (let i = 0; i < 60 * 5; i++) q.tick()
  assert.equal(q.hote.etape, 'jeu')
  q.invite.s.part()
  for (let i = 0; i < 30; i++) q.tick()
  assert.equal(q.hote.parti, true)
})

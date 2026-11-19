// Les jeux à plusieurs et le mot mystère en mode démo : les mêmes règles que la base
// (supabase/migrations/0019_jeux_famille.sql), et les proches fictifs qui jouent tout seuls.

import {
  bonneReponse,
  DESSINS_DEMO,
  DEVINETTES_DEMO,
  flotte,
  jourParis,
  motif,
  MOT_ESSAIS,
  MOTS_DEMO,
  norm,
  PHRASES_DEMO,
  type AnneeState,
  type BatailleState,
  type Dessin,
  type DessinState,
  type Etape,
  type MotLigne,
  type PartieKind,
  type QdnState,
  type Secret,
  type TelState,
  type TourState,
} from './parties'
import { FORMES, hauteurDeDepart, lacher, LIGNE_CHUTE, Monde } from './tour'
import type { Member, Partie } from './types'
import { uid } from './util'

/** Ce que la base garde caché (private.partie_secrets). */
export type Cache = {
  f1?: number[][]
  f2?: number[][]
  votes?: Record<string, string>
  mot?: string
  annees?: number[]
  reponses?: Record<string, number[]>
  carnets?: Etape[][]
}
export type MotDemo = { jour: string; mots: Record<string, string[]> }
type Fam = { family: { id: string; stars: number }; members: Member[]; parties?: Partie[]; caches?: Record<string, Cache>; motDemo?: MotDemo }
type Deps = { award: (f: never, member: string, reason: string, amount: number, cap?: number) => void; save: () => void; myId: (f: never) => string }

const MOTS_A_DESSINER = ['chat', 'soleil', 'maison', 'arbre', 'poisson', 'fleur', 'bateau', 'lune', 'nuage', 'cœur', 'voiture', 'avion', 'gâteau', 'pomme', 'lunettes', 'escargot', 'papillon', 'parapluie', 'fusée', 'château']
const hasard = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
const mauvais = ['un chien', 'une voiture', 'un ballon', 'une tortue', 'un robot', 'une étoile', 'une pomme']
const now = () => new Date().toISOString()
const ok = (d: unknown): d is Dessin => Array.isArray(d) && d.length >= 1 && d.length <= 400 && JSON.stringify(d).length < 90000

export function partiesDemo({ award: awardAny, save, myId: myIdAny }: Deps) {
  const award = awardAny as (f: Fam, member: string, reason: string, amount: number, cap?: number) => void
  const myId = myIdAny as (f: Fam) => string

  function start(f: Fam, kind: PartieKind, others: string[], setup: Record<string, unknown>, photos: string[]): string {
    const me = myId(f)
    const pl = [me]
    for (const x of others) if (x && !pl.includes(x)) pl.push(x)
    if (pl.some((x) => !f.members.find((m) => m.id === x && m.user_id))) throw new Error('ADVERSAIRE_INCONNU')
    const n = pl.length
    if ((['bataille', 'dessin'].includes(kind) && n !== 2) || (['quidenous', 'annee'].includes(kind) && (n < 2 || n > 8)) || (kind === 'telephone' && (n < 3 || n > 8)) || (kind === 'tour' && (n < 2 || n > 15))) throw new Error('JOUEURS')
    let state: Partie['state']
    let cache: Cache = {}
    let turn: string | null = null
    if (kind === 'bataille') {
      state = { phase: 'placement', pret: [false, false], b1: Array(64).fill(0), b2: Array(64).fill(0), s1: [], s2: [] }
      cache = { f1: flotte(), f2: flotte() }
    } else if (kind === 'quidenous') {
      const q = setup.q as number[]
      if (!Array.isArray(q) || q.length < 3 || q.length > 15) throw new Error('COUP_INTERDIT')
      state = { q, i: 0, votes: [], rondes: [], accords: 0 }
      cache = { votes: {} }
    } else if (kind === 'dessin') {
      state = { n: 4, i: 0, phase: 'dessin', dessin: null, essais: [], rondes: [], trouves: 0 }
      cache = { mot: hasard(MOTS_A_DESSINER) }
      turn = me
    } else if (kind === 'tour') {
      state = { pieces: [], prochaine: Math.floor(Math.random() * FORMES.length) }
      turn = me
    } else if (kind === 'annee') {
      const annees = setup.annees as number[]
      const an = new Date().getFullYear()
      if (!photos.length || photos.length > 5 || !Array.isArray(annees) || annees.length !== photos.length || annees.some((y) => !(y >= 1850 && y <= an))) throw new Error('ANNEE_INVALIDE')
      state = { photos, fait: [] }
      cache = { annees, reponses: {} }
    } else {
      state = { avance: Array(n).fill(0) }
      cache = { carnets: Array.from({ length: n }, () => []) }
    }
    const p: Partie = { id: uid(), family_id: f.family.id, kind, players: pl, turn, status: 'en_cours', winner: null, state, created_at: now(), updated_at: now() }
    ;(f.parties ??= []).unshift(p)
    ;(f.caches ??= {})[p.id] = cache
    return p.id
  }

  function finir(p: Partie, winner: string | null = null) {
    p.status = 'fini'
    p.turn = null
    p.winner = winner
  }

  /** Les règles, comme dans la base. */
  function act(f: Fam, p: Partie, who: string, a: Record<string, unknown>): Record<string, unknown> {
    if (p.status !== 'en_cours') throw new Error('PARTIE_FINIE')
    const side = p.players.indexOf(who) + 1
    if (!side) throw new Error('PAS_JOUEUR')
    const c = (f.caches ??= {})[p.id] ?? ((f.caches[p.id] = {}) as Cache)
    const n = p.players.length
    const t = a.t
    p.updated_at = now()

    if (p.kind === 'tour') {
      const s = p.state as TourState
      if (t !== 'pose') throw new Error('COUP_INTERDIT')
      if (p.turn !== who) throw new Error('PAS_TON_TOUR')
      const tas = a.tas as number[][]
      if (a.k !== s.prochaine || typeof a.tombe !== 'boolean' || !Array.isArray(tas) || tas.length !== s.pieces.length + 1) throw new Error('COUP_INTERDIT')
      if (tas.some((v) => !Array.isArray(v) || v.length !== 3 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 100000))) throw new Error('COUP_INTERDIT')
      const r2 = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d
      s.pieces = tas.map(([x, y, an], i) => ({ k: i < s.pieces.length ? s.pieces[i].k : s.prochaine, par: i < s.pieces.length ? s.pieces[i].par : who, x: r2(x, 2), y: r2(y, 2), a: r2(an, 4) }))
      s.dernier = who
      s.prochaine = Math.floor(Math.random() * FORMES.length)
      if (a.tombe) {
        s.tombe = true
        s.perdant = who
        finir(p, n === 2 ? (p.players.find((x) => x !== who) ?? null) : null)
        for (const x of p.players) if (x !== who) award(f, x, 'tour', 1, 5)
        return { fini: true }
      }
      p.turn = p.players[side % n]
      return { fini: false }
    }

    if (p.kind === 'bataille') {
      const s = p.state as BatailleState
      if (s.phase === 'placement') {
        if (s.pret[side - 1]) throw new Error('DEJA_FAIT')
        if (t === 'melanger') {
          c[side === 1 ? 'f1' : 'f2'] = flotte()
          return { flotte: c[side === 1 ? 'f1' : 'f2'] }
        }
        if (t !== 'pret') throw new Error('COUP_INTERDIT')
        s.pret[side - 1] = true
        if (s.pret[0] && s.pret[1]) {
          s.phase = 'tirs'
          p.turn = p.players[0]
        }
        return {}
      }
      if (t !== 'tir') throw new Error('COUP_INTERDIT')
      if (p.turn !== who) throw new Error('PAS_TON_TOUR')
      const cell = Number(a.c)
      const other = 3 - side
      const plateau = other === 1 ? s.b1 : s.b2
      if (!(cell >= 0 && cell < 64)) throw new Error('COUP_INTERDIT')
      if (plateau[cell]) throw new Error('DEJA_TIRE')
      const fl = (other === 1 ? c.f1 : c.f2) ?? []
      const vise = fl.find((b) => b.includes(cell))
      plateau[cell] = vise ? 2 : 1
      s.dernier = { c: cell, par: side as 1 | 2 }
      let r = 'eau'
      const coules = other === 1 ? s.s1 : s.s2
      if (vise) {
        r = 'touche'
        if (vise.every((x) => plateau[x] === 2)) {
          r = 'coule'
          coules.push(vise)
        }
      }
      if (coules.length === fl.length) {
        finir(p, who)
        award(f, who, 'partie', 2, 5)
        return { r, gagne: true }
      }
      p.turn = p.players[other - 1]
      return { r }
    }

    if (p.kind === 'quidenous') {
      const s = p.state as QdnState
      const cible = String(a.cible ?? '')
      if (t !== 'vote' || !p.players.includes(cible)) throw new Error('COUP_INTERDIT')
      if (s.votes.includes(who)) throw new Error('DEJA_FAIT')
      c.votes = { ...(c.votes ?? {}), [who]: cible }
      s.votes = [...s.votes, who]
      if (s.votes.length < n) return { revele: false }
      const accord = new Set(Object.values(c.votes)).size === 1
      s.rondes = [...s.rondes, { q: s.q[s.i], v: c.votes, accord }]
      if (accord) {
        s.accords += 1
        award(f, who, 'accord', 1, 10)
      }
      s.i += 1
      s.votes = []
      c.votes = {}
      if (s.i >= s.q.length) finir(p)
      return { revele: true, accord }
    }

    if (p.kind === 'dessin') {
      const s = p.state as DessinState
      const dessinateur = (s.i % 2) + 1
      if (p.turn !== who) throw new Error('PAS_TON_TOUR')
      if (s.phase === 'dessin') {
        if (side !== dessinateur) throw new Error('PAS_TON_TOUR')
        if (t === 'autre') {
          c.mot = hasard(MOTS_A_DESSINER.filter((m) => m !== c.mot))
          return { mot: c.mot }
        }
        if (t !== 'dessin') throw new Error('COUP_INTERDIT')
        if (!ok(a.d)) throw new Error('DESSIN_VIDE')
        s.dessin = a.d
        s.phase = 'devine'
        s.essais = []
        p.turn = p.players[2 - dessinateur]
        return {}
      }
      if (t !== 'devine' || side === dessinateur) throw new Error('COUP_INTERDIT')
      const essai = String(a.mot ?? '').trim().slice(0, 40)
      if (!norm(essai)) throw new Error('REPONSE_VIDE')
      const trouve = bonneReponse(essai, c.mot ?? '')
      s.essais = [...s.essais, essai]
      if (!trouve && s.essais.length < 3) return { trouve: false, reste: 3 - s.essais.length }
      const mot = c.mot ?? ''
      s.rondes = [...s.rondes, { mot, dessin: s.dessin ?? [], essais: s.essais, trouve, par: p.players[dessinateur - 1] }]
      if (trouve) {
        s.trouves += 1
        award(f, who, 'trouve', 1, 10)
      }
      s.i += 1
      s.phase = 'dessin'
      s.dessin = null
      s.essais = []
      const fin = s.i >= s.n
      if (fin) finir(p)
      else {
        c.mot = hasard(MOTS_A_DESSINER.filter((m) => m !== mot))
        p.turn = who
      }
      return { trouve, mot, fini: fin }
    }

    if (p.kind === 'annee') {
      const s = p.state as AnneeState
      const revele = () => {
        const totaux: Record<string, number> = {}
        let best: number | null = null
        let gagnant: string | null = null
        let exaequo = false
        for (const [k, rep] of Object.entries(c.reponses ?? {})) {
          const tot = (c.annees ?? []).reduce((acc, y, i) => acc + Math.abs((rep[i] ?? y) - y), 0)
          totaux[k] = tot
          if (best == null || tot < best) {
            best = tot
            gagnant = k
            exaequo = false
          } else if (tot === best) exaequo = true
        }
        Object.assign(s, { annees: c.annees, reponses: c.reponses, totaux })
        finir(p, exaequo ? null : gagnant)
        if (gagnant && !exaequo) award(f, gagnant, 'partie', 2, 5)
      }
      if (t === 'reveler') {
        if (side !== 1) throw new Error('PAS_TON_TOUR')
        if (!s.fait.length) throw new Error('PERSONNE_N_A_REPONDU')
        revele()
        return {}
      }
      if (t !== 'reponses' || side === 1) throw new Error('COUP_INTERDIT')
      if (s.fait.includes(who)) throw new Error('DEJA_FAIT')
      const r = a.r as number[]
      const an = new Date().getFullYear()
      if (!Array.isArray(r) || r.length !== s.photos.length || r.some((y) => !(y >= 1850 && y <= an))) throw new Error('ANNEE_INVALIDE')
      c.reponses = { ...(c.reponses ?? {}), [who]: r }
      s.fait = [...s.fait, who]
      if (s.fait.length >= n - 1) {
        revele()
        return { revele: true }
      }
      return { revele: false }
    }

    // le téléphone dessiné
    const s = p.state as TelState
    const k = Number(a.k)
    if (t !== 'etape' || !(k >= 0 && k < n)) throw new Error('COUP_INTERDIT')
    const j = s.avance[k]
    if (j >= n) throw new Error('DEJA_FAIT')
    if (p.players[(k + j) % n] !== who) throw new Error('PAS_TON_TOUR')
    let v = a.v as string | Dessin
    if (j % 2 === 0) {
      if (typeof v !== 'string' || v.trim().length < 2 || v.trim().length > 90) throw new Error('REPONSE_VIDE')
      v = v.trim()
    } else if (!ok(v)) throw new Error('DESSIN_VIDE')
    const carnets = (c.carnets ??= Array.from({ length: n }, () => []))
    carnets[k] = [...carnets[k], { par: who, v }]
    s.avance = s.avance.map((x, i) => (i === k ? x + 1 : x))
    if (s.avance.every((x) => x >= n)) {
      s.album = carnets
      finir(p)
      for (const x of p.players) award(f, x, 'album', 1, 5)
      return { fini: true }
    }
    return { fini: false }
  }

  function secret(f: Fam, p: Partie, who: string): Secret {
    const c = f.caches?.[p.id] ?? {}
    const side = p.players.indexOf(who) + 1
    if (!side) return {}
    const n = p.players.length
    switch (p.kind) {
      case 'bataille':
        return { flotte: side === 1 ? c.f1 : c.f2 }
      case 'quidenous':
        return { vote: c.votes?.[who] ?? null }
      case 'dessin':
        return p.status === 'en_cours' && (p.state as DessinState).phase === 'dessin' && p.turn === who ? { mot: c.mot } : {}
      case 'annee':
        return side === 1 ? { annees: c.annees } : { mes: c.reponses?.[who] ?? null }
      case 'tour':
        return {}
      case 'telephone': {
        if (p.status !== 'en_cours') return {}
        const s = p.state as TelState
        const etapes = s.avance.flatMap((j, k) => (j < n && p.players[(k + j) % n] === who ? [{ k, j, avant: j > 0 ? (c.carnets?.[k][j - 1]?.v ?? null) : null }] : []))
        return { etapes }
      }
    }
  }

  // ───── Les proches de la démo jouent ─────
  const enCours = new Set<string>()
  function bots(f: Fam) {
    const me = myId(f)
    for (const p of f.parties ?? []) {
      if (p.status !== 'en_cours') continue
      for (const bot of p.players) {
        if (bot === me) continue
        const key = `${p.id}:${bot}`
        if (enCours.has(key)) continue
        const action = coup(f, p, bot)
        if (!action) continue
        enCours.add(key)
        window.setTimeout(
          () => {
            enCours.delete(key)
            const a = coup(f, p, bot)
            if (!a) return
            try {
              act(f, p, bot, a)
            } catch {
              return
            }
            save()
            bots(f)
          },
          900 + Math.random() * 1400,
        )
      }
    }
  }

  /** Ce que joue un proche fictif, s'il a quelque chose à jouer. */
  function coup(f: Fam, p: Partie, bot: string): Record<string, unknown> | null {
    if (p.status !== 'en_cours') return null
    const c = f.caches?.[p.id] ?? {}
    const side = p.players.indexOf(bot) + 1
    const n = p.players.length
    switch (p.kind) {
      case 'bataille': {
        const s = p.state as BatailleState
        if (s.phase === 'placement') return s.pret[side - 1] ? null : { t: 'pret' }
        if (p.turn !== bot) return null
        const plateau = side === 1 ? s.b2 : s.b1
        const coules = new Set((side === 1 ? s.s2 : s.s1).flat())
        const libres = plateau.flatMap((v, i) => (v ? [] : [i]))
        // à côté d'un bateau touché mais pas coulé, sinon au hasard (une case sur deux)
        const autour = plateau.flatMap((v, i) => (v === 2 && !coules.has(i) ? [i - 8, i + 8, i % 8 ? i - 1 : -1, i % 8 < 7 ? i + 1 : -1] : [])).filter((x) => x >= 0 && x < 64 && !plateau[x])
        const damier = libres.filter((i) => (Math.floor(i / 8) + (i % 8)) % 2 === 0)
        return { t: 'tir', c: hasard(autour.length ? autour : damier.length ? damier : libres) }
      }
      case 'quidenous': {
        const s = p.state as QdnState
        if (s.votes.includes(bot)) return null
        const moi = c.votes?.[myId(f)]
        return { t: 'vote', cible: moi && Math.random() < 0.5 ? moi : hasard(p.players) }
      }
      case 'dessin': {
        const s = p.state as DessinState
        if (p.turn !== bot) return null
        if (s.phase === 'dessin') {
          const mot = hasard(Object.keys(DESSINS_DEMO))
          c.mot = mot
          return { t: 'dessin', d: DESSINS_DEMO[mot] }
        }
        return { t: 'devine', mot: Math.random() < 0.55 ? (c.mot ?? '') : hasard(mauvais) }
      }
      case 'annee': {
        const s = p.state as AnneeState
        if (side === 1 || s.fait.includes(bot)) return null
        const an = new Date().getFullYear()
        return { t: 'reponses', r: (c.annees ?? []).map((y) => Math.min(an, Math.max(1850, y + Math.round((Math.random() - 0.5) * 24)))) }
      }
      case 'tour': {
        // le proche vise le haut de la tour, plus ou moins adroitement, et laisse tomber la pièce
        if (p.turn !== bot) return null
        const s = p.state as TourState
        const m = new Monde(s.pieces)
        const haut = s.pieces.filter((q) => q.y < LIGNE_CHUTE).sort((u, v) => u.y - v.y)[0]
        const vise = haut ? haut.x : 0
        const piece = { k: s.prochaine, x: vise + (Math.random() - 0.5) * 24, y: hauteurDeDepart(m.sommet()), a: Math.random() < 0.85 ? 0 : (Math.round(Math.random() * 3) * Math.PI) / 2 }
        const r = lacher(s.pieces, piece)
        return { t: 'pose', k: s.prochaine, tas: r.pieces.map((q) => [q.x, q.y, q.a]), tombe: r.tombe }
      }
      case 'telephone': {
        const s = p.state as TelState
        const k = s.avance.findIndex((j, i) => j < n && p.players[(i + j) % n] === bot)
        if (k < 0) return null
        const j = s.avance[k]
        return { t: 'etape', k, v: j % 2 ? DESSINS_DEMO[hasard(Object.keys(DESSINS_DEMO))] : j === 0 ? hasard(PHRASES_DEMO) : hasard(DEVINETTES_DEMO) }
      }
    }
  }

  function quit(f: Fam, id: string) {
    const p = f.parties?.find((x) => x.id === id)
    const me = myId(f)
    if (!p || p.status === 'fini' || !p.players.includes(me)) return
    finir(p, ['bataille', 'dessin'].includes(p.kind) ? (p.players.find((x) => x !== me) ?? null) : null)
    p.state = { ...p.state, abandon: true, par: me }
    p.updated_at = now()
  }

  // ───── Le mot mystère ─────
  function motDuJour(jour: string) {
    const k = Math.round((Date.parse(`${jour}T12:00:00Z`) - Date.parse('2026-01-01T12:00:00Z')) / 86400000)
    return MOTS_DEMO[((k % MOTS_DEMO.length) + MOTS_DEMO.length) % MOTS_DEMO.length]
  }
  /** Les proches de la démo ont déjà joué : Mamie a trouvé en 4, Léa en 3, Papa cherche encore. */
  function motDemo(f: Fam): MotDemo {
    const jour = jourParis()
    if (f.motDemo?.jour === jour) return f.motDemo
    const sol = motDuJour(jour)
    const autres = MOTS_DEMO.filter((m) => m !== sol)
    const mots: Record<string, string[]> = {}
    const essais = { 'Mamie Jo': 4, Léa: 3, Papa: 2 } as Record<string, number>
    for (const m of f.members) {
      const k = essais[m.display_name]
      if (!k || !m.user_id) continue
      mots[m.id] = Array.from({ length: k }, (_, i) => (i === k - 1 && m.display_name !== 'Papa' ? sol : hasard(autres)))
    }
    f.motDemo = { jour, mots }
    return f.motDemo
  }
  function motLignes(f: Fam): MotLigne[] {
    const d = motDemo(f)
    const sol = motDuJour(d.jour)
    return Object.entries(d.mots).map(([member_id, mots]) => ({ member_id, motifs: mots.map((w) => motif(w, sol)), trouve: mots.includes(sol) }))
  }
  function motEssai(f: Fam, mot: string) {
    const w = norm(mot).toUpperCase()
    if (!/^[A-Z]{5}$/.test(w)) throw new Error('MOT_5_LETTRES')
    const d = motDemo(f)
    const me = myId(f)
    const sol = motDuJour(d.jour)
    const mine = (d.mots[me] ??= [])
    if (mine.includes(sol) || mine.length >= MOT_ESSAIS) throw new Error('MOT_FINI')
    mine.push(w)
    const trouve = w === sol
    if (trouve) award(f, me, 'mot', 2, 1)
    return { motif: motif(w, sol), trouve, solution: trouve || mine.length >= MOT_ESSAIS ? sol : null }
  }
  function motMesEssais(f: Fam) {
    const d = motDemo(f)
    const mine = d.mots[myId(f)] ?? []
    const sol = motDuJour(d.jour)
    return { jour: d.jour, mots: mine, solution: mine.includes(sol) || mine.length >= MOT_ESSAIS ? sol : null }
  }

  return { start, act, secret, bots, quit, motLignes, motEssai, motMesEssais }
}

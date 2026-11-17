// Jouer ensemble : Puissance 4, morpion et memory photos.
// Les règles sont vérifiées par la base (supabase/migrations/0017_jeux.sql) ; ce fichier les reprend
// pour le mode démo, et fait jouer les proches fictifs.

export type GameKind = 'puissance4' | 'morpion' | 'memory'
export type Side = 1 | 2
/** Puissance 4 et morpion : la grille (0 vide, 1 celui qui a invité, 2 l'autre), le dernier coup, l'alignement gagnant. */
export type GridState = { g: number[]; last?: number | null; line?: number[] | null; abandon?: boolean }
export type MemoryCard = { f: number; p: Side } | null
/** Memory : n photos (n paires), les cartes trouvées (photo et qui l'a trouvée), les cartes retournées en ce moment. */
export type MemoryState = { n: number; paths: string[]; found: MemoryCard[]; open: { i: number; f: number }[]; score: [number, number]; abandon?: boolean }
export type GameState = GridState | MemoryState

export const COLS = 7
export const ROWS = 6
export const MEMORY_MIN = 4
export const MEMORY_MAX = 8

export const GAMES: Record<GameKind, { name: string; hint: string; art: string }> = {
  puissance4: { name: 'Puissance 4', hint: 'Aligner 4 pions', art: 'jeu-puissance4' },
  morpion: { name: 'Morpion', hint: 'Aligner 3 signes', art: 'jeu-morpion' },
  memory: { name: 'Memory photos', hint: 'Trouver les paires', art: 'jeu-memory' },
}

export const isMemory = (s: GameState): s is MemoryState => 'n' in s

export function newState(kind: GameKind, paths: string[] = []): GameState {
  if (kind === 'memory') return { n: paths.length, paths, found: Array(paths.length * 2).fill(null), open: [], score: [0, 0] }
  return { g: Array(kind === 'puissance4' ? COLS * ROWS : 9).fill(0) }
}

/** Puissance 4 : la case où tombe le pion, ou -1 si la colonne est pleine. */
export function dropCell(g: number[], col: number) {
  for (let r = ROWS - 1; r >= 0; r--) if (g[r * COLS + col] === 0) return r * COLS + col
  return -1
}

export function p4Line(g: number[], idx: number, side: number): number[] | null {
  const r0 = Math.floor(idx / COLS)
  const c0 = idx % COLS
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [idx]
    for (const s of [1, -1]) {
      let r = r0 + dr * s
      let c = c0 + dc * s
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && g[r * COLS + c] === side) {
        line.push(r * COLS + c)
        r += dr * s
        c += dc * s
      }
    }
    if (line.length >= 4) return line
  }
  return null
}

const LINES3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
export const morpionLine = (g: number[], side: number) => LINES3.find((l) => l.every((i) => g[i] === side)) ?? null

/** Le coup d'un joueur : le nouvel état, et si la partie continue (au même joueur ou à l'autre) ou se termine. */
export function applyMove(
  kind: GameKind,
  st: GameState,
  side: Side,
  move: number,
  deck: number[] = [],
  pending: number | null = null,
): { state: GameState; next: 'same' | 'other' | 'end'; winner: Side | 0 | null; pending: number | null } {
  if (!isMemory(st)) {
    const g = [...st.g]
    let idx: number
    if (kind === 'puissance4') {
      if (!(move >= 0 && move < COLS)) throw new Error('COUP_INTERDIT')
      idx = dropCell(g, move)
      if (idx < 0) throw new Error('COLONNE_PLEINE')
    } else {
      if (!(move >= 0 && move < 9) || g[move] !== 0) throw new Error('COUP_INTERDIT')
      idx = move
    }
    g[idx] = side
    const line = kind === 'puissance4' ? p4Line(g, idx, side) : morpionLine(g, side)
    const state: GridState = { g, last: idx, line }
    if (line) return { state, next: 'end', winner: side, pending: null }
    if (!g.includes(0)) return { state, next: 'end', winner: 0, pending: null }
    return { state, next: 'other', winner: null, pending: null }
  }
  if (!(move >= 0 && move < st.n * 2) || st.found[move]) throw new Error('COUP_INTERDIT')
  if (pending == null) {
    return { state: { ...st, open: [{ i: move, f: deck[move] }] }, next: 'same', winner: null, pending: move }
  }
  if (pending === move) throw new Error('COUP_INTERDIT')
  const fa = deck[pending]
  const fb = deck[move]
  const open = [{ i: pending, f: fa }, { i: move, f: fb }]
  if (fa !== fb) return { state: { ...st, open }, next: 'other', winner: null, pending: null }
  const found = [...st.found]
  found[pending] = { f: fa, p: side }
  found[move] = { f: fb, p: side }
  const score: [number, number] = [...st.score]
  score[side - 1] += 1
  const state: MemoryState = { ...st, open, found, score }
  if (found.some((x) => !x)) return { state, next: 'same', winner: null, pending: null }
  return { state, next: 'end', winner: score[0] > score[1] ? 1 : score[1] > score[0] ? 2 : 0, pending: null }
}

export function shuffledDeck(n: number) {
  const d = [...Array(n).keys(), ...Array(n).keys()]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// ───────── Les proches de la démo jouent aussi ─────────

/** Puissance 4 : gagner si possible, sinon bloquer, sinon jouer plutôt au centre. */
export function botPuissance4(g: number[], side: Side): number {
  const other = side === 1 ? 2 : 1
  const cols = [...Array(COLS).keys()].filter((c) => dropCell(g, c) >= 0)
  for (const who of [side, other]) {
    for (const c of cols) {
      const t = [...g]
      const i = dropCell(t, c)
      t[i] = who
      if (p4Line(t, i, who)) return c
    }
  }
  // éviter de donner la victoire en jouant juste dessous
  const safe = cols.filter((c) => {
    const t = [...g]
    t[dropCell(t, c)] = side
    const above = dropCell(t, c)
    if (above < 0) return true
    t[above] = other
    return !p4Line(t, above, other)
  })
  const pool = safe.length ? safe : cols
  // sinon un peu au hasard, avec une préférence pour le centre
  const w = pool.map((c) => 4 - Math.abs(c - 3))
  let r = Math.random() * w.reduce((a, b) => a + b, 0)
  for (let k = 0; k < pool.length; k++) {
    r -= w[k]
    if (r < 0) return pool[k]
  }
  return pool[pool.length - 1]
}

/** Morpion : gagner, bloquer, le centre, un coin, au hasard. */
export function botMorpion(g: number[], side: Side): number {
  const other = side === 1 ? 2 : 1
  const free = [...Array(9).keys()].filter((i) => g[i] === 0)
  for (const who of [side, other]) {
    for (const i of free) {
      const t = [...g]
      t[i] = who
      if (morpionLine(t, who)) return i
    }
  }
  if (g[4] === 0 && Math.random() < 0.8) return 4
  const corners = [0, 2, 6, 8].filter((i) => g[i] === 0)
  if (corners.length && Math.random() < 0.7) return corners[Math.floor(Math.random() * corners.length)]
  return free[Math.floor(Math.random() * free.length)]
}

/** Memory : une carte au hasard parmi celles qui restent ; la deuxième, la bonne s'il s'en souvient (une fois sur deux). */
export function botMemory(st: MemoryState, deck: number[], first: number | null): number {
  const left = st.found.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0 && i !== first)
  if (first != null && Math.random() < 0.3) {
    const twin = left.find((i) => deck[i] === deck[first])
    if (twin != null) return twin
  }
  return left[Math.floor(Math.random() * left.length)]
}
